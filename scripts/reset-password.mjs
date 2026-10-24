// Gives an account a new temporary password, e.g. when someone forgot theirs.
// Run from the repo root:
//
//   npm run reset-password
//
// The account is signed out everywhere, any sign-in lock is lifted, and the
// next sign-in has to pick a new password. The temporary one expires after
// 7 days.

import bcrypt from "bcryptjs";
import {
  ask,
  askNewPassword,
  closePrompts,
  connect,
  fail,
  printPassword,
} from "./cli.mjs";

const who = (await ask("Email or username: ")).trim().toLowerCase();
if (!who) fail("Enter an email or username");

const client = await connect();
try {
  const { rows } = await client.query(
    `SELECT id, username FROM "User"
     WHERE lower(email) = $1 OR lower(username) = $1`,
    [who],
  );
  if (!rows.length) fail(`No account matches "${who}"`);
  if (rows.length > 1) fail(`"${who}" matches several accounts; use the email`);
  const [user] = rows;
  console.log(`Resetting ${user.username} (id ${user.id})`);

  const { password, generated } = await askNewPassword();
  closePrompts();

  await client.query(
    `UPDATE "User"
     SET password = $1, "mustChangePassword" = true,
         "passwordExpiresAt" = now() + interval '7 days',
         "sessionVersion" = "sessionVersion" + 1,
         "failedLogins" = 0, "lockedUntil" = NULL, "updatedAt" = now()
     WHERE id = $2`,
    [await bcrypt.hash(password, 10), user.id],
  );

  console.log(`✓ Reset ${user.username}; they're signed out everywhere`);
  if (generated) printPassword(password);
  console.log(
    "  They'll pick their own password at next sign-in, within 7 days.",
  );
} finally {
  await client.end();
}
