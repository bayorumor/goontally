// Case-insensitive exact match for Prisma `where` clauses. Prisma turns
// `mode: "insensitive"` into Postgres ILIKE without escaping, so `%` and `_`
// in the value would act as wildcards ("%" would match every row). Escape
// them, and the backslash ILIKE uses as its escape character.
export const equalsIgnoringCase = (value: string) => ({
  equals: value.replace(/[\\%_]/g, (c) => `\\${c}`),
  mode: "insensitive" as const,
});
