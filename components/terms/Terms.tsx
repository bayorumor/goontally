// The terms of use, in one place for both apps: agreed to once before first
// use (TermsScreen) and kept to reread (TermsCard). Only the last point
// differs, as data lives on the phone in one app and in a hosted database
// in the other.

export type TermsWhere = "phone" | "web";

const SHARED: { title: string; body: string }[] = [
  {
    title: "No content included",
    body: "Goontally is only a tracker. It comes empty and doesn't provide, host, link to or recommend any media, persons or characters.",
  },
  {
    title: "What you log is on you",
    body: "Everything you add is your own responsibility: names, persons, characters, notes, and the images you use. The app and its author(s) aren't responsible for any of it, and don't endorse or condone what anyone logs.",
  },
  {
    title: "No affiliation",
    body: "The author(s) have no connection to anyone or anything you log.",
  },
];

const DATA: Record<TermsWhere, { title: string; body: string }> = {
  phone: {
    title: "It stays on this phone",
    body: "Nothing you log leaves the phone, and nobody can recover it for you. Keep your own backups (Settings → Backup).",
  },
  web: {
    title: "Your data, your copy",
    body: "What you log is stored in this copy's database, run by whoever hosts it. The author(s) can't see, recover or delete it. Keep your own backups (Profile → Backup).",
  },
};

export default function Terms({ where }: { where: TermsWhere }) {
  return (
    <div className="flex flex-col gap-5 text-[15px] leading-relaxed text-muted">
      {[...SHARED, DATA[where]].map((t) => (
        <section key={t.title}>
          <h2 className="mb-1 text-[15px] font-semibold text-text">
            {t.title}
          </h2>
          <p>{t.body}</p>
        </section>
      ))}
    </div>
  );
}
