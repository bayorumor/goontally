// Adds a login account. Sign-up is closed in the app, so this is the only way
// in. Run from the repo root:
//
//   npm run add-user
//
// It asks for a username, email and password (typed hidden; leave it blank to
// generate one) and writes straight to the database in .env's DATABASE_URL.
// Someone given a password this way picks their own at first sign-in; the
// temporary one stops working after 7 days.

import bcrypt from "bcryptjs";
import {
  ask,
  askNewPassword,
  askYes,
  closePrompts,
  connect,
  fail,
  printPassword,
} from "./cli.mjs";

const username = (await ask("Username: ")).trim();
if (!username || username.length > 50) fail("Username must be 1–50 characters");

// Sign-in matches emails case-insensitively; store them lowercased.
const email = (await ask("Email: ")).trim().toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
  fail("Enter a valid email");

const { password, generated } = await askNewPassword();
// A generated password is always temporary; a typed one may be your own.
const mustChange =
  generated ||
  (await askYes("Ask them to pick a new password at first sign-in?"));
closePrompts();

const client = await connect();
try {
  const { rows: taken } = await client.query(
    `SELECT lower(email) AS email FROM "User"
     WHERE lower(email) = $1 OR lower(username) = lower($2)`,
    [email, username],
  );
  if (taken.length)
    fail(
      taken[0].email === email
        ? "Email already registered"
        : "Username already taken",
    );

  const hash = await bcrypt.hash(password, 10);
  const { rows } = await client.query(
    `INSERT INTO "User"
       (username, email, password, "mustChangePassword", "passwordExpiresAt",
        "updatedAt")
     VALUES ($1, $2, $3, $4::boolean,
             CASE WHEN $4::boolean THEN now() + interval '7 days' END, now())
     RETURNING id`,
    [username, email, hash, mustChange],
  );

  console.log(`✓ Added ${username} (id ${rows[0].id})`);
  if (generated) printPassword(password);
  if (mustChange)
    console.log(
      "  They'll pick their own password at first sign-in, within 7 days.",
    );
} finally {
  await client.end();
}
