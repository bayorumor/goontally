import { Capacitor } from "@capacitor/core";
import { readSetting, writeSetting } from "./settings";

// Checking GitHub Releases for a newer version. This is the app's only
// network request, and it can be turned off in Settings. It runs at most
// once a day, when the app opens or comes back to the front.
//
// Android doesn't let an app install updates silently, so a newer version is
// offered as a download: the browser fetches the APK, and Android asks to
// install it over the old one.

export const APP_VERSION = __APP_VERSION__;
export const RELEASES_URL = "https://github.com/bayorumor/goontally/releases";
const LATEST_API =
  "https://api.github.com/repos/bayorumor/goontally/releases/latest";
const DAY_MS = 24 * 60 * 60 * 1000;

// Fired whenever the update settings change, so the banner can redraw.
export const UPDATES_CHANGED = "goontally:updates";

export interface Release {
  version: string;
  notes: string;
  // The release's APK, or its page when it has none.
  downloadUrl: string;
  pageUrl: string;
}

export interface UpdateSettings {
  auto: boolean;
  lastCheckAt: string | null;
  // The newest release seen, if it's newer than this app.
  available: Release | null;
  // A version whose banner was closed; it stays hidden until a newer one.
  dismissed: string | null;
}

const KEY = "updates";
const DEFAULTS: UpdateSettings = {
  auto: true,
  lastCheckAt: null,
  available: null,
  dismissed: null,
};

export async function getUpdates(): Promise<UpdateSettings> {
  const saved = await readSetting<UpdateSettings>(KEY, DEFAULTS);
  // After updating, the release that was on offer is this app itself.
  if (saved.available && !isNewer(saved.available.version, APP_VERSION))
    saved.available = null;
  return saved;
}

export async function saveUpdates(patch: Partial<UpdateSettings>) {
  const next = { ...(await getUpdates()), ...patch };
  await writeSetting(KEY, next);
  window.dispatchEvent(new Event(UPDATES_CHANGED));
  return next;
}

// "v1.2.10" → [1, 2, 10]. Anything after the numbers ("-beta") is ignored.
const parts = (version: string) =>
  (version.replace(/^v/i, "").match(/^\d+(\.\d+)*/)?.[0] ?? "0")
    .split(".")
    .map(Number);

export function isNewer(candidate: string, current: string) {
  const a = parts(candidate);
  const b = parts(current);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return false;
}

// Release notes are Markdown; the app shows them as plain text, so links
// keep only their words and heading, bold and list marks are dropped.
function plainText(markdown: string) {
  return markdown
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*|__/g, "")
    .replace(/^\s*[*-]\s+/gm, "• ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Asks GitHub for the newest release. Resolves to it when it's newer than
// this app, null when the app is up to date or nothing is released yet;
// throws when GitHub can't be reached.
export async function fetchLatest(api = LATEST_API): Promise<Release | null> {
  const res = await fetch(api, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
  const release: {
    tag_name: string;
    body: string | null;
    html_url: string;
    assets: { name: string; browser_download_url: string }[];
  } = await res.json();

  if (!isNewer(release.tag_name, APP_VERSION)) return null;
  const apk = release.assets.find((a) => a.name.endsWith(".apk"));
  return {
    version: release.tag_name.replace(/^v/i, ""),
    notes: plainText(release.body ?? ""),
    downloadUrl: apk?.browser_download_url ?? release.html_url,
    pageUrl: release.html_url,
  };
}

// Checks now and records the result. Returns the release on offer, if any.
export async function checkForUpdate(): Promise<Release | null> {
  const available = await fetchLatest();
  await saveUpdates({ available, lastCheckAt: new Date().toISOString() });
  return available;
}

// The daily check. Silent when offline: it tries again next time.
export async function checkIfDue() {
  const { auto, lastCheckAt } = await getUpdates();
  if (!auto) return;
  if (lastCheckAt && Date.now() - Date.parse(lastCheckAt) < DAY_MS) return;
  await checkForUpdate().catch(() => {});
}

// Opens a link in the phone's browser. Capacitor hands any address outside
// the app to Android instead of loading it, so the app stays where it was.
export function openExternal(url: string) {
  if (Capacitor.isNativePlatform()) window.location.href = url;
  else window.open(url, "_blank", "noopener");
}
