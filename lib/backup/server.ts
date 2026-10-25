import "server-only";
import { prisma } from "../prisma";
import { deleteImage } from "../cloudinary";
import type { BackupData, ImportMode, ImportResult } from "./format";

export type { ImportMode, ImportResult };

// Server half of backups. The browser packs and unpacks the .gtbak file
// itself (photos come straight from Cloudinary), so requests stay small:
// export sends rows with photo URLs, import takes rows and answers which
// photos to upload next.

// Everything the user has, in backup shape. `photo` holds the Cloudinary
// URL here; the browser swaps it for the photo's path in the zip.
export async function exportRows(userId: number): Promise<BackupData> {
  const [persons, groups, memberships, entries, options] = await Promise.all([
    prisma.person.findMany({
      where: { userId },
      select: { id: true, name: true, photoUrl: true, createdAt: true },
      orderBy: { id: "asc" },
    }),
    prisma.group.findMany({
      where: { userId },
      select: { id: true, name: true, photoUrl: true, createdAt: true },
      orderBy: { id: "asc" },
    }),
    prisma.personGroup.findMany({
      where: { group: { userId } },
      select: { personId: true, groupId: true, joinedAt: true },
    }),
    prisma.entry.findMany({
      where: { userId },
      select: {
        loggedAt: true,
        mediumTags: true,
        notes: true,
        createdAt: true,
        persons: { select: { personId: true } },
        thoughts: { select: { tag: true, personIds: true }, orderBy: { id: "asc" } },
      },
      orderBy: [{ loggedAt: "asc" }, { id: "asc" }],
    }),
    prisma.userCustomOption.findMany({
      where: { userId },
      select: { category: true, label: true, hidden: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const named = (r: (typeof persons)[number]) => ({
    id: r.id,
    name: r.name,
    photo: r.photoUrl,
    createdAt: r.createdAt.toISOString(),
  });

  return {
    persons: persons.map(named),
    groups: groups.map(named),
    memberships: memberships.map((m) => ({
      ...m,
      joinedAt: m.joinedAt.toISOString(),
    })),
    entries: entries.map((e) => ({
      loggedAt: e.loggedAt.toISOString(),
      mediumTags: e.mediumTags,
      notes: e.notes,
      personIds: e.persons.map((p) => p.personId),
      thoughts: e.thoughts,
      createdAt: e.createdAt.toISOString(),
    })),
    options: options.flatMap((o) =>
      o.category === "thought" || o.category === "medium"
        ? [
            {
              category: o.category,
              label: o.label,
              hidden: o.hidden,
              createdAt: o.createdAt.toISOString(),
            },
          ]
        : [],
    ),
  };
}

// Writes the backup's rows in one transaction. Persons and groups are
// matched by name ignoring case, so merging a backup into the account it
// came from adds nothing twice; an entry counts as the same when it has the
// same time and persons. "replace" empties the account first.
export async function importRows(
  userId: number,
  data: BackupData,
  mode: ImportMode,
): Promise<ImportResult> {
  const { result, oldPhotos } = await prisma.$transaction(
    async (tx) => {
      let oldPhotos: string[] = [];
      if (mode === "replace") {
        const rows = await Promise.all([
          tx.person.findMany({ where: { userId }, select: { photoUrl: true } }),
          tx.group.findMany({ where: { userId }, select: { photoUrl: true } }),
        ]);
        oldPhotos = rows.flat().flatMap((r) => (r.photoUrl ? [r.photoUrl] : []));
        // Links, entry persons and thoughts go with them (cascade).
        await tx.entry.deleteMany({ where: { userId } });
        await tx.person.deleteMany({ where: { userId } });
        await tx.group.deleteMany({ where: { userId } });
        await tx.userCustomOption.deleteMany({ where: { userId } });
      }

      const photos: ImportResult["photos"] = [];

      // Persons and groups: file id → database id, creating what's missing.
      const resolveNamed = async (kind: "person" | "group") => {
        const rows = kind === "person" ? data.persons : data.groups;
        const delegate = (kind === "person" ? tx.person : tx.group) as typeof tx.person;
        const existing = await delegate.findMany({
          where: { userId },
          select: { id: true, name: true, photoUrl: true },
        });
        const byName = new Map(
          existing.map((r) => [r.name.toLowerCase(), { id: r.id, hasPhoto: !!r.photoUrl }]),
        );

        const fresh = new Map<string, (typeof rows)[number]>();
        for (const r of rows) {
          const key = r.name.toLowerCase();
          if (!byName.has(key) && !fresh.has(key)) fresh.set(key, r);
        }
        const created = await delegate.createManyAndReturn({
          data: [...fresh.values()].map((r) => ({
            userId,
            name: r.name,
            createdAt: new Date(r.createdAt),
          })),
          select: { id: true, name: true },
        });
        for (const r of created)
          byName.set(r.name.toLowerCase(), { id: r.id, hasPhoto: false });

        const ids = new Map<number, number>();
        const wantsPhoto = new Set<number>();
        for (const r of rows) {
          const match = byName.get(r.name.toLowerCase())!;
          ids.set(r.id, match.id);
          // Only fill photos that are missing; never replace one.
          if (r.photo && !match.hasPhoto && !wantsPhoto.has(match.id)) {
            wantsPhoto.add(match.id);
            photos.push({ path: r.photo, kind, id: match.id });
          }
        }
        return { ids, added: created.length };
      };

      const persons = await resolveNamed("person");
      const groups = await resolveNamed("group");
      const personId = (id: number) => persons.ids.get(id)!;

      await tx.personGroup.createMany({
        data: data.memberships.map((m) => ({
          personId: personId(m.personId),
          groupId: groups.ids.get(m.groupId)!,
          joinedAt: new Date(m.joinedAt),
        })),
        skipDuplicates: true,
      });

      // Entries, minus ones that are already there.
      const entryKey = (loggedAt: Date, ids: number[]) =>
        `${loggedAt.getTime()}:${[...ids].sort((a, b) => a - b).join(",")}`;
      const seen = new Set<string>();
      if (mode === "merge") {
        const existing = await tx.entry.findMany({
          where: { userId },
          select: { loggedAt: true, persons: { select: { personId: true } } },
        });
        for (const e of existing)
          seen.add(entryKey(e.loggedAt, e.persons.map((p) => p.personId)));
      }

      const fresh = data.entries.flatMap((e) => {
        const loggedAt = new Date(e.loggedAt);
        const ids = [...new Set(e.personIds.map(personId))];
        const key = entryKey(loggedAt, ids);
        if (seen.has(key)) return [];
        seen.add(key);
        // Same rule as the log form: a thought about nobody is about everyone.
        const thoughts = e.thoughts.map((t) => {
          const about = [...new Set(t.personIds.map(personId))];
          return { tag: t.tag, personIds: about.length ? about : ids };
        });
        return [{ ...e, loggedAt, ids, thoughts }];
      });

      // Ids are reserved up front so the persons and thoughts of each entry
      // can be inserted in bulk too, instead of one entry at a time.
      const reserved = fresh.length
        ? await tx.$queryRaw<{ id: number }[]>`
            SELECT nextval(pg_get_serial_sequence('"Entry"', 'id'))::int AS id
            FROM generate_series(1, ${fresh.length}::int)
          `
        : [];
      const rows = fresh.map((e, i) => ({ ...e, id: reserved[i].id }));

      await tx.entry.createMany({
        data: rows.map((e) => ({
          id: e.id,
          userId,
          loggedAt: e.loggedAt,
          mediumTags: e.mediumTags,
          notes: e.notes || null,
          createdAt: new Date(e.createdAt),
        })),
      });
      await tx.entryPerson.createMany({
        data: rows.flatMap((e) => e.ids.map((personId) => ({ entryId: e.id, personId }))),
      });
      await tx.entryThought.createMany({
        data: rows.flatMap((e) => e.thoughts.map((t) => ({ entryId: e.id, ...t }))),
      });

      await tx.userCustomOption.createMany({
        data: data.options.map((o) => ({
          userId,
          category: o.category,
          label: o.label,
          hidden: o.hidden ?? false,
          createdAt: new Date(o.createdAt),
        })),
        skipDuplicates: true,
      });

      const result: ImportResult = {
        added: {
          persons: persons.added,
          groups: groups.added,
          entries: rows.length,
        },
        skippedEntries: data.entries.length - rows.length,
        photos,
      };
      return { result, oldPhotos };
    },
    // Bulk inserts keep this short, but a big backup over a slow link can
    // still outlast the 5 second default.
    { maxWait: 10_000, timeout: 120_000 },
  );

  // The old rows are gone, so their photos are unused now.
  await Promise.allSettled(oldPhotos.map(deleteImage));
  return result;
}
