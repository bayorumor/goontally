import { App } from "@capacitor/app";
import type { createRouter } from "./router";

// Android's back button, in the order people expect:
//   1. On the lock screen or the first-launch disclaimer it leaves the app;
//      it never gets past either.
//   2. An open sheet, photo cropper or zoomed photo closes first.
//   3. Anywhere but Home, it goes back a page (or to Home, when there is
//      no page to go back to).
//   4. On Home it sends the app to the background, the way the Home button
//      does, so it opens again where it was.
//
// Sheets, the cropper and the zoomed photo all close on Escape, so pressing
// back sends one.

const BLOCKING =
  '[aria-label="Goontally is locked"], [aria-label="Before you start"]';
// Sheets, the photo cropper and the zoomed photo are all dialogs.
const OVERLAY = '[role="dialog"]';

export function installBackButton(router: ReturnType<typeof createRouter>) {
  void App.addListener("backButton", ({ canGoBack }) => {
    if (document.querySelector(BLOCKING)) {
      void App.minimizeApp();
      return;
    }
    if (document.querySelector(OVERLAY)) {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
      return;
    }
    if (location.pathname === "/") void App.minimizeApp();
    else if (canGoBack) history.back();
    // Nothing to go back to (e.g. the history was skipped): Home it is.
    else void router.navigate("/");
  });
}
