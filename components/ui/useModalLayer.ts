"use client";

import { RefObject, useEffect, useRef } from "react";

// Open modals, oldest first. Only the top one reacts to Escape and Tab, so a
// confirm dialog over the log sheet closes on its own.
const layers: object[] = [];
// The page's own overflow, saved when the first modal opens.
let pageOverflow = "";

// The element focused before the current one. A dialog with an autoFocus
// field has already taken focus when its effect runs, so this is what had it
// before the dialog opened.
let focused: Element | null = null;
let previouslyFocused: Element | null = null;
if (typeof document !== "undefined")
  document.addEventListener("focusin", (e) => {
    previouslyFocused = focused;
    focused = e.target as Element;
  });

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Shared modal behaviour: Escape closes, Tab stays inside the dialog, the
// page behind doesn't scroll, and focus returns where it was on close.
export function useModalLayer(
  open: boolean,
  dialogRef: RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  // Read through a ref so a new onClose each render doesn't re-run the setup.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const layer = {};
    if (!layers.length) {
      pageOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    layers.push(layer);
    const isTop = () => layers[layers.length - 1] === layer;

    const dialog = dialogRef.current;
    const returnTo = (
      dialog?.contains(document.activeElement)
        ? previouslyFocused
        : document.activeElement
    ) as HTMLElement | null;
    // Keep an autoFocus field's focus; otherwise start on the dialog itself.
    if (dialog && !dialog.contains(document.activeElement)) dialog.focus();

    const onKey = (e: KeyboardEvent) => {
      if (!isTop() || !dialog) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
      } else if (e.key === "Tab") {
        const items = [
          ...dialog.querySelectorAll<HTMLElement>(FOCUSABLE),
        ].filter((el) => el.offsetParent !== null);
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || active === dialog)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      layers.splice(layers.indexOf(layer), 1);
      // The last modal to close gives scrolling back.
      if (!layers.length) document.body.style.overflow = pageOverflow;
      returnTo?.focus?.();
    };
  }, [open, dialogRef]);
}
