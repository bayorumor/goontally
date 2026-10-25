import { Capacitor, registerPlugin } from "@capacitor/core";
import { readSetting, writeSetting } from "./settings";

// The app lock: an optional PIN, locking again after time in the
// background, and hiding the app in recent apps.
//
// The PIN itself is never stored, only a slow salted hash of it (PBKDF2), in
// the app's private database. There's no way back from a forgotten PIN but
// reinstalling and restoring a backup; anything easier would also work for
// whoever picked up the phone.

export const PIN_MIN = 4;
export const PIN_MAX = 8;
// Background time before the app locks again, in seconds.
export const LOCK_AFTER = [0, 60, 300, 900] as const;

// Wrong PINs in a row before a pause, and the first pause. Each wrong PIN
// after that doubles it, up to MAX_WAIT_MS.
const FREE_TRIES = 5;
const FIRST_WAIT_MS = 30_000;
const MAX_WAIT_MS = 15 * 60_000;
const ITERATIONS = 150_000;

export interface LockSettings {
  pin: { hash: string; salt: string; iterations: number } | null;
  lockAfter: (typeof LOCK_AFTER)[number];
  hideInRecents: boolean;
  // Whether the first-launch "set a PIN?" offer was answered.
  offered: boolean;
  failed: number;
  blockedUntil: number | null;
}

const KEY = "lock";
const DEFAULTS: LockSettings = {
  pin: null,
  lockAfter: 60,
  hideInRecents: false,
  offered: false,
  failed: 0,
  blockedUntil: null,
};

export const getLock = () => readSetting<LockSettings>(KEY, DEFAULTS);

export async function saveLock(patch: Partial<LockSettings>) {
  const next = { ...(await getLock()), ...patch };
  await writeSetting(KEY, next);
  return next;
}

export const validPin = (pin: string) =>
  new RegExp(`^\\d{${PIN_MIN},${PIN_MAX}}$`).test(pin);

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromBase64 = (text: string) =>
  Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

async function hash(pin: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: salt as Uint8Array<ArrayBuffer>,
      iterations,
    },
    key,
    256,
  );
  return toBase64(new Uint8Array(bits));
}

export async function setPin(pin: string) {
  if (!validPin(pin)) throw new Error(`Use ${PIN_MIN} to ${PIN_MAX} digits`);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return saveLock({
    pin: {
      hash: await hash(pin, salt, ITERATIONS),
      salt: toBase64(salt),
      iterations: ITERATIONS,
    },
    offered: true,
    failed: 0,
    blockedUntil: null,
  });
}

export const clearPin = () =>
  saveLock({ pin: null, failed: 0, blockedUntil: null });

export type PinCheck =
  { ok: true } | { ok: false; waitMs: number; triesLeft: number };

// Checks a PIN, counting wrong ones. While a pause is running, nothing is
// checked at all.
export async function checkPin(pin: string): Promise<PinCheck> {
  const lock = await getLock();
  if (!lock.pin) return { ok: true };
  const waitMs = Math.max(0, (lock.blockedUntil ?? 0) - Date.now());
  if (waitMs) return { ok: false, waitMs, triesLeft: 0 };

  const salt = fromBase64(lock.pin.salt);
  if ((await hash(pin, salt, lock.pin.iterations)) === lock.pin.hash) {
    if (lock.failed) await saveLock({ failed: 0, blockedUntil: null });
    return { ok: true };
  }

  const failed = lock.failed + 1;
  const over = failed - FREE_TRIES;
  const wait = over >= 0 ? Math.min(FIRST_WAIT_MS * 2 ** over, MAX_WAIT_MS) : 0;
  await saveLock({ failed, blockedUntil: wait ? Date.now() + wait : null });
  return { ok: false, waitMs: wait, triesLeft: Math.max(0, -over) };
}

// Hiding the app's content in recent apps (Android 13 and newer). Android
// forgets it when the app closes, so it's applied again on every start.
interface PrivacyPlugin {
  setHideInRecents(options: { hide: boolean }): Promise<{ supported: boolean }>;
  isHideInRecentsSupported(): Promise<{ supported: boolean }>;
}
const Privacy = registerPlugin<PrivacyPlugin>("Privacy");

export async function applyHideInRecents(hide: boolean) {
  if (!Capacitor.isNativePlatform()) return;
  await Privacy.setHideInRecents({ hide }).catch(() => {});
}

export async function hideInRecentsSupported() {
  if (!Capacitor.isNativePlatform()) return false;
  return (
    (await Privacy.isHideInRecentsSupported().catch(() => null))?.supported ??
    false
  );
}
