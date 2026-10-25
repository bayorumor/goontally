import { NAME_MAX } from "@/lib/constants";
import {
  addPersonsBody,
  getImageFile,
  nameField,
  readPhotos,
  validateImage,
} from "@/lib/schemas";
import { db, type Tx } from "./db";
import { deletePhoto, savePhoto, type PhotoKind } from "./photos";
import { listEntries } from "./queries";

// The phone's stand-in for app/api: the shared components keep calling
// fetch("/api/..."), and this answers from SQLite instead of a server. Same
// paths, same validation (lib/schemas.ts), same replies and error messages.

type Params = Record<string, string>;
type Handler = (req: Request, params: Params) => Promise<Response>;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const jsonError = (error: string, status: number) => json({ error }, status);

// Thrown inside a transaction so it rolls back, carrying the reply.
class Rejected extends Error {
  constructor(readonly response: Response) {
    super("rejected");
  }
}

// Positive integer id from a route param, or null.
function parseId(value: string | null | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

const now = () => new Date().toISOString();
const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

const TABLE: Record<PhotoKind, string> = { person: "persons", group: "groups" };
const LABEL: Record<PhotoKind, (name: string) => string> = {
  person: (name) => `"${name}" already exists`,
  group: (name) => `Group "${name}" already exists`,
};
const NOT_FOUND: Record<PhotoKind, string> = {
  person: "Person not found",
  group: "Group not found",
};

type NamedRow = { id: number; name: string; photo: string | null };

// Case-insensitive lookup by name. Done in JavaScript because SQLite's
// NOCASE only folds ASCII letters.
async function findByName(
  tx: Tx,
  kind: PhotoKind,
  name: string,
  exceptId?: number,
) {
  const rows = await tx.all<NamedRow>(
    `SELECT id, name, photo FROM ${TABLE[kind]}`,
  );
  return rows.find((r) => r.id !== exceptId && sameName(r.name, name));
}

async function insertNamed(tx: Tx, kind: PhotoKind, name: string) {
  const at = now();
  const { lastId } = await tx.run(
    `INSERT INTO ${TABLE[kind]} (name, createdAt, updatedAt) VALUES (?, ?, ?)`,
    [name, at, at],
  );
  return lastId;
}

type PhotoUpload = { kind: PhotoKind; id: number; file: File };

// Stores photos for rows that were just committed. Like the web app, a
// failed photo never undoes the rows; they simply stay without one.
// Returns whether any photo failed.
async function savePhotos(uploads: PhotoUpload[]) {
  let failed = false;
  // One at a time: resizing is memory-hungry on a phone.
  for (const { kind, id, file } of uploads) {
    try {
      const photo = await savePhoto(file, kind);
      await db.run(
        `UPDATE ${TABLE[kind]} SET photo = ?, updatedAt = ? WHERE id = ?`,
        [photo, now(), id],
      );
    } catch (err) {
      console.error("Couldn't save a photo", err);
      failed = true;
    }
  }
  return failed;
}

async function readForm(req: Request) {
  try {
    const form = await req.formData();
    return { form, raw: JSON.parse(String(form.get("data") ?? "")) as unknown };
  } catch {
    return null;
  }
}

// POST /api/persons: adds persons to the library, optionally into a group.
const addPersons: Handler = async (req) => {
  const body = await readForm(req);
  if (!body) return jsonError("Invalid request body", 400);
  const parsed = addPersonsBody.safeParse(body.raw);
  if (!parsed.success)
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid data", 400);
  const { group, persons } = parsed.data;

  const photos = readPhotos(body.form, [
    group?.groupPhotoKey,
    ...persons.map((r) => r.personPhotoKey),
  ]);
  if (typeof photos === "string") return jsonError(photos, 400);

  const newNames = persons.flatMap((r) =>
    r.newPersonName ? [r.newPersonName] : [],
  );
  const seen = new Set<string>();
  for (const n of newNames) {
    if (seen.has(n.toLowerCase())) return jsonError(LABEL.person(n), 409);
    seen.add(n.toLowerCase());
  }

  const uploads: PhotoUpload[] = [];
  let groupId: number | null;
  try {
    groupId = await db.transaction(async (tx) => {
      let groupId = group?.groupId ?? null;
      if (groupId) {
        const owned = await tx.get("SELECT id FROM groups WHERE id = ?", [
          groupId,
        ]);
        if (!owned) throw new Rejected(jsonError(NOT_FOUND.group, 404));
      } else if (group?.newGroupName) {
        const clash = await findByName(tx, "group", group.newGroupName);
        if (clash) throw new Rejected(jsonError(LABEL.group(clash.name), 409));
        groupId = await insertNamed(tx, "group", group.newGroupName);
        const file = group.groupPhotoKey && photos.get(group.groupPhotoKey);
        if (file) uploads.push({ kind: "group", id: groupId, file });
      }

      const existingIds = [
        ...new Set(persons.flatMap((r) => (r.personId ? [r.personId] : []))),
      ];
      for (const id of existingIds) {
        const owned = await tx.get("SELECT id FROM persons WHERE id = ?", [id]);
        if (!owned) throw new Rejected(jsonError(NOT_FOUND.person, 404));
      }
      for (const n of newNames) {
        const clash = await findByName(tx, "person", n);
        if (clash) throw new Rejected(jsonError(LABEL.person(clash.name), 409));
      }

      const memberIds = [...existingIds];
      for (const row of persons) {
        if (!row.newPersonName) continue;
        const id = await insertNamed(tx, "person", row.newPersonName);
        memberIds.push(id);
        const file = row.personPhotoKey && photos.get(row.personPhotoKey);
        if (file) uploads.push({ kind: "person", id, file });
      }

      if (groupId)
        for (const personId of memberIds)
          await tx.run(
            "INSERT OR IGNORE INTO memberships (personId, groupId, joinedAt) VALUES (?, ?, ?)",
            [personId, groupId, now()],
          );
      return groupId;
    });
  } catch (err) {
    if (err instanceof Rejected) return err.response;
    throw err;
  }

  const photoFailed = await savePhotos(uploads);
  return json(
    {
      groupId,
      ...(photoFailed
        ? { warning: "Saved, but some photos failed to upload" }
        : {}),
    },
    201,
  );
};

// PATCH /api/{persons,groups}/:id: a new "name" and/or "photo".
const updateNamed =
  (kind: PhotoKind): Handler =>
  async (req, { id: rawId }) => {
    const id = parseId(rawId);
    const row =
      id &&
      (await db.get<NamedRow>(
        `SELECT id, name, photo FROM ${TABLE[kind]} WHERE id = ?`,
        [id],
      ));
    if (!id || !row) return jsonError(NOT_FOUND[kind], 404);

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return jsonError("Invalid request body", 400);
    }
    const rawName = String(form.get("name") ?? "").trim();
    const file = getImageFile(form.get("photo"));
    let name: string | undefined;
    let photo: string | undefined;

    if (rawName && rawName !== row.name) {
      const parsed = nameField.safeParse(rawName);
      if (!parsed.success)
        return jsonError(`Names can be up to ${NAME_MAX} characters`, 400);
      const clash = await db.transaction((tx) =>
        findByName(tx, kind, parsed.data, id),
      );
      if (clash) return jsonError(LABEL[kind](clash.name), 409);
      name = parsed.data;
    }

    if (file) {
      const invalid = validateImage(file);
      if (invalid) return jsonError(invalid, 400);
      try {
        photo = await savePhoto(file, kind);
      } catch {
        return jsonError("Couldn't save the photo, please try again", 500);
      }
    }

    await db.run(
      `UPDATE ${TABLE[kind]} SET name = ?, photo = ?, updatedAt = ? WHERE id = ?`,
      [name ?? row.name, photo ?? row.photo, now(), id],
    );
    // A new photo has a new name, so the old file is now unused.
    if (photo) await deletePhoto(row.photo);
    return json({ ok: true });
  };

// DELETE /api/persons/:id: also tidies up entries that were about them.
const deletePerson: Handler = async (_req, { id: rawId }) => {
  const id = parseId(rawId);
  const person =
    id &&
    (await db.get<NamedRow>(
      "SELECT id, name, photo FROM persons WHERE id = ?",
      [id],
    ));
  if (!id || !person) return jsonError(NOT_FOUND.person, 404);

  await db.transaction(async (tx) => {
    const affected = (
      await tx.all<{ entryId: number }>(
        "SELECT entryId FROM entryPersons WHERE personId = ?",
        [id],
      )
    ).map((r) => r.entryId);

    await tx.run("DELETE FROM persons WHERE id = ?", [id]);
    if (!affected.length) return;
    const marks = affected.map(() => "?").join(",");

    // Thoughts store person ids as JSON with no foreign key, so drop the
    // deleted id by hand, and drop thoughts that were only about them.
    const thoughts = await tx.all<{ id: number; personIds: string }>(
      `SELECT id, personIds FROM entryThoughts WHERE entryId IN (${marks})`,
      affected,
    );
    for (const t of thoughts) {
      const ids: number[] = JSON.parse(t.personIds);
      if (!ids.includes(id)) continue;
      const rest = ids.filter((p) => p !== id);
      if (rest.length)
        await tx.run("UPDATE entryThoughts SET personIds = ? WHERE id = ?", [
          JSON.stringify(rest),
          t.id,
        ]);
      else await tx.run("DELETE FROM entryThoughts WHERE id = ?", [t.id]);
    }

    // Entries that were only about this person are now empty.
    await tx.run(
      `DELETE FROM entries WHERE id IN (${marks})
       AND NOT EXISTS (SELECT 1 FROM entryPersons ep WHERE ep.entryId = entries.id)`,
      affected,
    );
  });

  await deletePhoto(person.photo);
  return json({ message: "Person deleted" });
};

// DELETE /api/groups/:id: members stay in the library.
const deleteGroup: Handler = async (_req, { id: rawId }) => {
  const id = parseId(rawId);
  const group =
    id &&
    (await db.get<NamedRow>("SELECT id, name, photo FROM groups WHERE id = ?", [
      id,
    ]));
  if (!id || !group) return jsonError(NOT_FOUND.group, 404);
  await db.run("DELETE FROM groups WHERE id = ?", [id]);
  await deletePhoto(group.photo);
  return json({ message: "Group deleted" });
};

// GET /api/entries: a page of entries, for "Load more".
const getEntries: Handler = async (req) => {
  const { searchParams } = new URL(req.url);
  const personParam = searchParams.get("personId");
  const personId = personParam ? parseId(personParam) : null;
  if (personParam && !personId) return jsonError("Invalid personId", 400);

  const limit = Math.min(
    Math.max(parseInt(searchParams.get("limit") ?? "20") || 20, 1),
    100,
  );
  const afterAt = searchParams.get("afterAt");
  const afterId = parseId(searchParams.get("afterId"));
  const after =
    afterId && afterAt && !isNaN(Date.parse(afterAt))
      ? { loggedAt: new Date(afterAt).toISOString(), id: afterId }
      : undefined;

  return json(
    await listEntries({ personId: personId ?? undefined, limit, after }),
  );
};

const ROUTES: [method: string, path: RegExp, handler: Handler][] = [
  ["POST", /^\/api\/persons$/, addPersons],
  ["PATCH", /^\/api\/persons\/(?<id>[^/]+)$/, updateNamed("person")],
  ["DELETE", /^\/api\/persons\/(?<id>[^/]+)$/, deletePerson],
  ["PATCH", /^\/api\/groups\/(?<id>[^/]+)$/, updateNamed("group")],
  ["DELETE", /^\/api\/groups\/(?<id>[^/]+)$/, deleteGroup],
  ["GET", /^\/api\/entries$/, getEntries],
];

// Routes fetch("/api/...") on this origin to the handlers above; everything
// else goes out as usual.
export function installLocalApi() {
  const network = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const req = new Request(input, init);
    const url = new URL(req.url);
    if (url.origin !== location.origin || !url.pathname.startsWith("/api/"))
      return network(input, init);

    for (const [method, path, handler] of ROUTES) {
      const match = url.pathname.match(path);
      if (match && req.method === method) {
        try {
          return await handler(req, match.groups ?? {});
        } catch (err) {
          console.error(`${method} ${url.pathname}`, err);
          return jsonError("Something went wrong, please try again", 500);
        }
      }
    }
    return jsonError("Not available in this version of the app", 404);
  };
}
