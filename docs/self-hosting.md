# Self-hosting the web version

Goontally also runs as a website you host yourself. It has the same screens
as the [Android app](../README.md), with accounts, so one copy can be shared
with friends: each account gets its own private library and only ever sees
its own data.

Obviously, the Android app instead is easier; it needs no setup. This guide is
for people who want it accessible online via web and comfortable with databases, environment variables and deploying.

Sign-up is closed. Whoever hosts a copy adds the accounts from the terminal
(see [Adding a user](#adding-a-user)).

## Setup

You need [Node.js](https://nodejs.org) 20.19 or newer and free accounts on
[Supabase](https://supabase.com) (database), [Cloudinary](https://cloudinary.com)
(images) and [Vercel](https://vercel.com) (hosting).

Get the code either way:

- **With a GitHub account:** fork this repo. Vercel then redeploys on its own
  whenever your fork changes.
- **Without one:** the repo is public, so anyone can grab it, either with
  **Code → Download ZIP** or with
  `git clone https://github.com/bayorumor/goontally.git`. You then deploy
  from your computer with Vercel's command-line tool (see
  [Hosting](#4-hosting-vercel)).

> **Not on Supabase?** Any PostgreSQL database works, e.g. Neon, Railway,
> Render or your own server, as long as it's PostgreSQL (MySQL, SQLite and
> others won't work: the schema and the Insights queries use
> PostgreSQL-only features). Goontally was first built on Supabase, so the
> steps below are written for it. Elsewhere, put your connection string in
> both `DATABASE_URL` and `DIRECT_URL` (or the provider's pooled and direct
> URLs, if it gives you two), and skip `npm run db:lock`: it closes off an
> API that only Supabase has.

### 1. Database (Supabase)

1. Create a new project. Save the database password it asks for, because you
   need it in the connection strings.
2. Open **Connect** (top of the project page) and copy two connection strings:
   - **Transaction pooler** (port 6543) → `DATABASE_URL`. The app uses this
     one at runtime.
   - **Session pooler** (port 5432) → `DIRECT_URL`. Prisma uses this one to
     create the tables.

   Replace `[YOUR-PASSWORD]` in both with your database password.

Free Supabase projects pause after about a week without activity. Open the
project dashboard and restore it if the app stops loading data.

### 2. Images (Cloudinary)

1. Sign up for a free account.
2. On the dashboard, copy the **Cloud name**, **API Key** and **API Secret**.

Images are stored in a `goontally/` folder in your Cloudinary media library.

> **Cloudinary is required.** Unlike the database, image storage is written
> specifically for Cloudinary: uploads, deletes, and the on-the-fly resizing
> and format conversion that keep images small (`lib/cloudinary.ts` and
> `lib/image.ts`). Using another provider means rewriting those parts. You're
> welcome to do that in your own copy, but it isn't supported here.

**Will the free plan be enough?** Almost certainly, for a personal library.
The free plan gives 25 credits a month, where one credit is 1 GB of storage,
1 GB of bandwidth, or 1,000 image transformations (a resized or reformatted
version of an image).

Images are kept small at every step:

- The browser crops each image and scales it down to at most 1600 px before
  uploading, as a JPEG.
- On upload, Cloudinary shrinks person images to at most 800 px wide with
  automatic quality, and group images and avatars to 400 × 400.
- Pages ask for each image at the size it's shown, in WebP or AVIF when the
  browser supports it, so little bandwidth is used.

For scale, a real library of about 120 images takes around 15 MB: roughly
90 KB per person image and 10 KB per group image. Transformations count the
most: each image is generated once per display size and format, then served
from Cloudinary's cache. That library used under 7% of the monthly free
credits.

### 3. Run it locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env` file in the repo root:

   ```ini
   DATABASE_URL=
   DIRECT_URL=

   # 32+ random characters; it encrypts every session. Generate one with
   # `openssl rand -base64 32` or
   # `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
   NEXTAUTH_SECRET=
   NEXTAUTH_URL=http://localhost:3000

   CLOUDINARY_CLOUD_NAME=
   CLOUDINARY_API_KEY=
   CLOUDINARY_API_SECRET=
   ```

   `.env` is gitignored, so keep it that way. Whoever holds `DATABASE_URL`
   has full access to the data. If it leaks, reset the database password in
   Supabase and update the URLs here and on Vercel.

3. Create the tables and the Prisma client, then lock the tables away from
   Supabase's public API:

   ```bash
   npx prisma db push
   npx prisma generate
   npm run db:lock
   ```

   Supabase exposes every table through a public REST API that anyone with
   the project's (non-secret) anon key can use. The app doesn't use that API,
   so `db:lock` turns on row level security and revokes the API's access.
   Run it again after any schema change that adds a table.

4. Add yourself an account (see [Adding a user](#adding-a-user)).

5. Start the app:

   ```bash
   npm run dev
   ```

   It runs at http://localhost:3000.

### 4. Hosting (Vercel)

Vercel's free Hobby plan is enough.

**From your GitHub fork**

1. **Add New → Project** and import your copy of the repo. The framework is
   detected as Next.js; leave the build settings as they are.
2. Before deploying, open **Environment Variables** and add everything from
   your `.env`:
   - Set `NEXTAUTH_URL` to your site's address, e.g.
     `https://your-app.vercel.app`.
   - You can use a different `NEXTAUTH_SECRET` than locally.
3. Deploy. If you only learn the address after the first deploy, update
   `NEXTAUTH_URL` and redeploy.

**From your computer (no GitHub needed)**

Run these in the project folder. The first one asks you to sign in to
Vercel and sets up a project; answer the questions with the defaults:

```bash
npx vercel
```

Then add every variable from your `.env` in the Vercel dashboard
(**Settings → Environment Variables**), with `NEXTAUTH_URL` set to the
address Vercel gave you, and deploy the real site:

```bash
npx vercel --prod
```

Run `npx vercel --prod` again whenever you change or update the code. Your
`.env` and local folders stay on your computer: `.vercelignore` keeps them out
of the upload.

**Your address**

Your site gets a free address ending in `.vercel.app`, taken from the project
name (e.g. `your-app.vercel.app`). You can change it under **Settings →
Domains**, as long as nobody else has taken that name.

- The site already asks search engines not to list it, but a short, obvious
  name is easy to stumble on. Something only you'd think of is more private,
  e.g. `quiet-harbor-42.vercel.app` rather than `something-obvious.vercel.app`.
- Avoid putting your real name or usual handle in it.
- Want your own domain instead? Buy one from any registrar and add it under
  the same **Domains** page. That's optional; the `.vercel.app` address is
  free and works the same.
- After changing the address, update `NEXTAUTH_URL` to match and redeploy,
  or sign-in stops working.

Accounts and data live in the database, so the users you add from your
computer can sign in on the hosted site straight away.

To use it like an app on your phone, open the site and choose **Add to Home
Screen**.

## Adding a user

There's no sign-up page. To give someone an account, for example a friend
using your copy, add them from your computer:

```bash
npm run add-user
```

The script asks for a username, an email and a password:

- **For a friend**, leave the password blank. You get a generated one,
  printed once. Send them the email and that password privately. At their
  first sign-in they have to pick their own password, so the one you sent
  stops working. If they don't sign in within 7 days, it expires; run
  `npm run reset-password` to send a new one.
- **For yourself**, type your own password. It stays hidden while you type,
  and you can skip the first-sign-in change.

Anyone can change their password later from **Profile → Change password**.

If someone forgets their password, give them a new temporary one:

```bash
npm run reset-password
```

It asks for their email or username, signs them out everywhere, lifts any
sign-in lock, and makes them pick a new password at the next sign-in.

It writes straight to the database in `DATABASE_URL`, so it only works where
that `.env` is present. A copy of this repo with its own database only adds
users to that database.

To remove someone, delete their row from the `User` table, e.g. in
Supabase's Table Editor. Their persons, groups and entries go with it, and
they're signed out on their next request.

A locked account unlocks by itself after 15 minutes. `npm run
reset-password` also unlocks it straight away.

## Updating your copy

When this repo gets fixes or new features, bring them into your copy:

- **If you forked it:** open your fork on GitHub and click **Sync fork**.
  Vercel redeploys on its own.
- **If you cloned it into your own repo:** pull from this one and push;
  Vercel redeploys on its own after the push:

  ```bash
  git pull https://github.com/bayorumor/goontally.git main
  git push
  ```

- **If you deploy from your computer:** run `git pull` in your clone (or
  download the ZIP again and copy your `.env` into it), then
  `npx vercel --prod`.

If an update changes the database schema (`prisma/schema.prisma`), also run
these once from your computer, with your `.env` in place:

```bash
npx prisma db push
npm run db:lock
```

`db push` adds the new columns or tables, and `db:lock` keeps any new table
closed to Supabase's public API.

## Backups

Your entries live only in the copy's database, and Supabase's free plan
doesn't include backups you can download, so keep your own.

**From the app (any account):** Profile → Backup → **Export backup** saves
one `.gtbak` file with your persons, groups, memberships, entries, finishes,
mediums, notes and custom options.

- **Data + images** or **Data only**.
- **Password (optional):** the file is encrypted (AES-256-GCM) and can't be
  opened without it. A forgotten password can't be recovered.
- Your account's avatar isn't included.

**Import backup** opens a `.gtbak` file, shows what's inside, then either:

- **Merge:** adds what's missing. Persons and groups with the same name
  (ignoring case) count as the same; entries with the same time and persons
  are skipped. Existing images are never replaced.
- **Replace everything:** deletes everything in your account first, then
  imports the backup.

The same file opens in the Android app, so this is also how you move your
library onto a phone.

The file is packed and opened in your browser; the server only sees the
rows, and images are uploaded one by one afterwards. A `.gtbak` is a zip
(`manifest.json`, `data.json`, `photos/`); the format lives in
`lib/backup/format.ts`.

**Whole database (hosts):** to copy every account at once, dump the database
(needs the PostgreSQL client tools):

```bash
pg_dump "<your DIRECT_URL>" --data-only --schema=public > goontally-backup.sql
```

Images for a dump stay in your Cloudinary account; you can download them
from its Media Library. Keep backups private: they contain everything you've
logged.

## Tidying ids

Ids only ever count up, so deleting persons, groups or entries leaves gaps:
after deleting person 24, the next new one is still 25. That's harmless, but
if you'd like the numbers back in order:

```bash
npm run db:renumber
npm run db:renumber -- --apply
```

The first command is a dry run that only shows the result; the second does
it. Persons, groups, entries, finishes and custom options are renumbered from
1 in their original order, and every link between them follows along. User
ids stay as they are.

- A full JSON backup goes to `backups/` (gitignored) before anything changes.
- It all happens in one transaction, which rolls back unless every person,
  group, entry and option comes out exactly as it was.
- Page links like `/persons/12` point somewhere else afterwards, so run it
  while nobody is using the app.

## Rules only the web version has

**Sign-in**

- Email is matched ignoring case.
- After 5 wrong passwords in a row, that account can't sign in for 15
  minutes. Wrong "current password" attempts on the change-password page
  count too.
- Accounts made or reset from the terminal must pick their own password at
  their first sign-in. Until they do, the app and its API are closed to
  them, and the temporary password stops working after 7 days.
- Passwords people pick are 8 to 72 characters.
- Changing a password signs out the account's other devices.
- Every account is asked once, before it first uses the app, to agree to
  the terms of use (the same as the README's Disclaimer). They can be reread
  in **Profile → Terms of Use**.

**Images (web)**

- Must be a JPEG, PNG, WebP or GIF image of 4 MB or less.
- Cropped in the browser before upload: persons are cropped to 11:16, groups
  and avatars to a square.
- If an image upload fails while adding someone, the person is still saved
  without it.
- Each image is stored under a random name. Cloudinary serves images to
  anyone who has the exact address, so random names keep one shared link from
  leading to the others.
- Changing or deleting an image removes the old file from Cloudinary.

## Privacy of a hosted copy

**Who can see my entries?**
Only your own account. Other accounts on the same copy never see your
persons, groups, entries or stats.

**And whoever hosts the copy?**
They can, technically. Whoever holds the `.env` (the database and Cloudinary
keys) can read everything stored in that copy. If you use a friend's copy,
you're trusting them with your data; if you'd rather not, host your own.

**Are my images public?**
Images live in the host's Cloudinary account. Anyone who has an image's exact
address can open it, but addresses are random and can't be guessed from one
another, and the app only shows them to the account that owns them.

**Will the site show up on Google?**
No. Every page and response asks search engines not to index it.

**Does the app track me?**
No analytics, no ads, no third-party trackers. It only stores what you log,
plus the cookies sign-in needs and one for your timezone.

**How do I delete everything?**
Deleting a person removes their entries and image. To remove a whole
account, the host deletes its row from the `User` table (see
[Adding a user](#adding-a-user)). Everything that account logged goes with it.

## Scripts

| Command                  | What it does                                   |
| ------------------------ | ---------------------------------------------- |
| `npm run dev`            | Development server                             |
| `npm run build`          | Generates the Prisma client and builds the app |
| `npm start`              | Serves the production build                    |
| `npm run lint`           | ESLint                                         |
| `npm run add-user`       | Adds a login account                           |
| `npm run reset-password` | Gives an account a new temporary password      |
| `npm run db:lock`        | Closes Supabase's public API off from the data |
| `npm run db:renumber`    | Closes gaps in ids (dry run unless `--apply`)  |
