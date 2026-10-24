// Prompts and database access shared by the account scripts.

import { randomBytes } from "node:crypto";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import pg from "pg";

process.loadEnvFile(".env");

// Readline echoes typed keys to its output; route that through a stream we
// can silence while a password is typed.
let muted = false;
const output = new Writable({
  write(chunk, _encoding, done) {
    if (!muted) stdout.write(chunk);
    done();
  },
});
const rl = createInterface({ input: stdin, output, terminal: stdin.isTTY });
// Reading through the iterator buffers lines, so piped input isn't dropped.
const lines = rl[Symbol.asyncIterator]();

export async function ask(question) {
  stdout.write(question);
  const { value } = await lines.next();
  return value ?? "";
}

export async function askHidden(question) {
  muted = true;
  try {
    return await ask(question);
  } finally {
    muted = false;
    stdout.write("\n");
  }
}

export async function askYes(question) {
  const answer = (await ask(`${question} [Y/n] `)).trim().toLowerCase();
  return answer !== "n" && answer !== "no";
}

export function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

// A typed password (asked twice), or a generated one when left blank.
export async function askNewPassword() {
  const typed = await askHidden("Password (blank = generate): ");
  if (!typed)
    return { password: randomBytes(12).toString("base64url"), generated: true };
  if (typed.length < 8 || typed.length > 72)
    fail("Password must be 8–72 characters");
  if ((await askHidden("Repeat password: ")) !== typed)
    fail("Passwords don't match");
  return { password: typed, generated: false };
}

export function closePrompts() {
  rl.close();
}

export async function connect() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  return client;
}

export function printPassword(password) {
  console.log(`  Password: ${password}`);
  console.log("  Shown once; send it to them privately.");
}
