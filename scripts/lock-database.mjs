// Closes Supabase's public Data API (PostgREST) off from the app's tables.
// Run from the repo root after `npx prisma db push`, and again after any
// schema change that adds a table:
//
//   npm run db:lock
//
// Supabase lets its public `anon` and `authenticated` roles reach every table
// in the `public` schema, and anyone holding the project's anon key can use
// them. The app never needs those roles: it connects as `postgres`, which
// bypasses row level security. So this turns RLS on everywhere (with no
// policies, nothing is visible through the API) and revokes those roles'
// rights, including on tables created later.

import pg from "pg";

process.loadEnvFile(".env");

const client = new pg.Client({
  connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
});
await client.connect();
try {
  const { rows: tables } = await client.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1`,
  );
  const { rows: roles } = await client.query(
    `SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')`,
  );
  const apiRoles = roles.map((r) => r.rolname).join(", ");

  await client.query("BEGIN");
  for (const { tablename } of tables)
    await client.query(
      `ALTER TABLE public."${tablename}" ENABLE ROW LEVEL SECURITY`,
    );
  if (apiRoles) {
    for (const what of ["TABLES", "SEQUENCES", "FUNCTIONS"]) {
      await client.query(
        `REVOKE ALL ON ALL ${what} IN SCHEMA public FROM ${apiRoles}`,
      );
      await client.query(
        `ALTER DEFAULT PRIVILEGES IN SCHEMA public
         REVOKE ALL ON ${what} FROM ${apiRoles}`,
      );
    }
  }
  await client.query("COMMIT");

  console.log(`✓ Row level security on for ${tables.length} tables`);
  if (apiRoles) console.log(`✓ Revoked access for ${apiRoles}`);
} catch (err) {
  await client.query("ROLLBACK").catch(() => {});
  throw err;
} finally {
  await client.end();
}
