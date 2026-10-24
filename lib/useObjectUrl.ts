"use client";

import { useEffect, useState } from "react";

// Blob URL for a local file, revoked when the file changes or on unmount.
export function useObjectUrl(file: File | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing with the browser's blob URL registry
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);

  return url;
}
