import { readSetting, writeSetting } from "./settings";

// Whether the first-launch disclaimer was accepted. Bump VERSION when its
// wording changes in a way people should read again.
const KEY = "disclaimer";
const VERSION = 1;

export async function disclaimerAccepted() {
  const { version } = await readSetting(KEY, { version: 0 });
  return version >= VERSION;
}

export const acceptDisclaimer = () =>
  writeSetting(KEY, { version: VERSION, acceptedAt: new Date().toISOString() });
