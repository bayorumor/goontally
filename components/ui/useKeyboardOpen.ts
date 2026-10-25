"use client";

import { useEffect, useState } from "react";

// Whether the on-screen keyboard is up. Phones report it as the visible
// viewport getting much shorter than it has been at this width; turning the
// phone changes the width and starts over.
export function useKeyboardOpen() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    let width = viewport.width;
    let tallest = viewport.height;

    const onResize = () => {
      if (viewport.width !== width) {
        width = viewport.width;
        tallest = viewport.height;
      }
      tallest = Math.max(tallest, viewport.height);
      setOpen(tallest - viewport.height > 150);
    };
    viewport.addEventListener("resize", onResize);
    return () => viewport.removeEventListener("resize", onResize);
  }, []);

  return open;
}
