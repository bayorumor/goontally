import "server-only";
import { prisma } from "./prisma";
import {
  isDefault,
  visibleOptions,
  type OptionCategory,
  type OptionList,
} from "./options";

// Finishes and mediums on the web: what's offered when logging, and the
// "Log options" sheet's rename and remove. mobile/src/local/options.ts does
// the same on the phone.

async function rows(userId: number, category: OptionCategory) {
  return prisma.userCustomOption.findMany({
    where: { userId, category },
    select: { label: true, hidden: true },
    orderBy: { createdAt: "asc" },
  });
}

// What the log sheet offers.
export async function listLogOptions(userId: number, category: OptionCategory) {
  return visibleOptions(category, await rows(userId, category));
}

// Every offered option with how many entries use it.
export async function listOptions(userId: number): Promise<OptionList> {
  const [thoughtRows, mediumRows, thoughtUses, mediumUses] = await Promise.all([
    rows(userId, "thought"),
    rows(userId, "medium"),
    prisma.$queryRaw<{ label: string; uses: number }[]>`
      SELECT t.tag AS label, COUNT(DISTINCT t."entryId")::int AS uses
      FROM "EntryThought" t JOIN "Entry" e ON e.id = t."entryId"
      WHERE e."userId" = ${userId}
      GROUP BY t.tag`,
    prisma.$queryRaw<{ label: string; uses: number }[]>`
      SELECT m AS label, COUNT(DISTINCT e.id)::int AS uses
      FROM "Entry" e, unnest(e."mediumTags") AS m
      WHERE e."userId" = ${userId}
      GROUP BY m`,
  ]);
  const describe = (
    category: OptionCategory,
    optionRows: typeof thoughtRows,
    uses: { label: string; uses: number }[],
  ) => {
    const count = new Map(uses.map((u) => [u.label, u.uses]));
    return visibleOptions(category, optionRows).map((label) => ({
      label,
      isDefault: isDefault(category, label),
      uses: count.get(label) ?? 0,
    }));
  };
  return {
    thought: describe("thought", thoughtRows, thoughtUses),
    medium: describe("medium", mediumRows, mediumUses),
  };
}

// Saved from the log sheet for next time. Adding one that was hidden
// offers it again.
export async function addOption(
  userId: number,
  category: OptionCategory,
  label: string,
) {
  return prisma.userCustomOption.upsert({
    where: { userId_category_label: { userId, category, label } },
    update: { hidden: false },
    create: { userId, category, label },
  });
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// Stops offering a label: a built-in one is marked hidden, the user's own
// is deleted.
async function retire(
  tx: Tx,
  userId: number,
  category: OptionCategory,
  label: string,
) {
  if (isDefault(category, label))
    await tx.userCustomOption.upsert({
      where: { userId_category_label: { userId, category, label } },
      update: { hidden: true },
      create: { userId, category, label, hidden: true },
    });
  else
    await tx.userCustomOption.deleteMany({ where: { userId, category, label } });
}

// Renames an option and every past use of it. A new name that's already an
// option (ignoring case) merges into that one, so Insights counts them
// together.
export async function renameOption(
  userId: number,
  category: OptionCategory,
  from: string,
  newName: string,
) {
  const offered = await listLogOptions(userId, category);
  const to =
    offered.find(
      (o) => o !== from && o.toLowerCase() === newName.toLowerCase(),
    ) ?? newName;
  if (to === from) return;

  await prisma.$transaction(async (tx) => {
    if (category === "thought") {
      // An entry with both: one finish, for everyone either was about.
      await tx.$executeRaw`
        UPDATE "EntryThought" t
        SET "personIds" = ARRAY(SELECT DISTINCT unnest(t."personIds" || f."personIds"))
        FROM "EntryThought" f JOIN "Entry" e ON e.id = f."entryId"
        WHERE e."userId" = ${userId} AND f.tag = ${from}
          AND t."entryId" = f."entryId" AND t.tag = ${to}`;
      await tx.$executeRaw`
        DELETE FROM "EntryThought" f USING "Entry" e
        WHERE e.id = f."entryId" AND e."userId" = ${userId} AND f.tag = ${from}
          AND EXISTS (
            SELECT 1 FROM "EntryThought" t
            WHERE t."entryId" = f."entryId" AND t.tag = ${to}
          )`;
      await tx.$executeRaw`
        UPDATE "EntryThought" f SET tag = ${to}
        FROM "Entry" e
        WHERE e.id = f."entryId" AND e."userId" = ${userId} AND f.tag = ${from}`;
    } else {
      // Same as renameIn() in lib/options.ts.
      await tx.$executeRaw`
        UPDATE "Entry"
        SET "mediumTags" = CASE
          WHEN ${to} = ANY("mediumTags") THEN array_remove("mediumTags", ${from})
          ELSE array_replace("mediumTags", ${from}, ${to})
        END
        WHERE "userId" = ${userId} AND ${from} = ANY("mediumTags")`;
    }

    await retire(tx, userId, category, from);
    await tx.userCustomOption.upsert({
      where: { userId_category_label: { userId, category, label: to } },
      update: { hidden: false },
      create: { userId, category, label: to },
    });
  });
}

// Stops offering an option. Past entries keep it unless fromEntries is set.
export async function removeOption(
  userId: number,
  category: OptionCategory,
  label: string,
  fromEntries: boolean,
) {
  await prisma.$transaction(async (tx) => {
    await retire(tx, userId, category, label);
    if (!fromEntries) return;
    if (category === "thought")
      await tx.$executeRaw`
        DELETE FROM "EntryThought" f USING "Entry" e
        WHERE e.id = f."entryId" AND e."userId" = ${userId} AND f.tag = ${label}`;
    else
      await tx.$executeRaw`
        UPDATE "Entry" SET "mediumTags" = array_remove("mediumTags", ${label})
        WHERE "userId" = ${userId} AND ${label} = ANY("mediumTags")`;
  });
}
