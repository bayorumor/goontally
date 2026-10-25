import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import Sheet from "@/components/ui/Sheet";
import {
  getUpdates,
  openExternal,
  saveUpdates,
  UPDATES_CHANGED,
  type Release,
} from "../local/updates";

// A strip under the top bar when a newer version is out: what's new, a
// download, or hide it until the next version.
export default function UpdateBanner() {
  const [release, setRelease] = useState<Release | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);

  useEffect(() => {
    const load = () =>
      void getUpdates().then((u) =>
        setRelease(
          u.available && u.available.version !== u.dismissed
            ? u.available
            : null,
        ),
      );
    load();
    window.addEventListener(UPDATES_CHANGED, load);
    return () => window.removeEventListener(UPDATES_CHANGED, load);
  }, []);

  if (!release) return null;

  return (
    <>
      <div className="border-b border-border bg-primary-soft">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2 md:px-6">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium">
              Version {release.version} is out
            </p>
            {release.notes && (
              <button
                className="text-[12px] text-primary-text underline"
                onClick={() => setNotesOpen(true)}
              >
                See what&apos;s new
              </button>
            )}
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => openExternal(release.downloadUrl)}
          >
            <Download size={15} /> Download
          </button>
          <button
            className="icon-btn -mr-2"
            aria-label="Hide until the next version"
            onClick={() => void saveUpdates({ dismissed: release.version })}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <Sheet
        open={notesOpen}
        onClose={() => setNotesOpen(false)}
        title={`What's new in ${release.version}`}
        footer={
          <button
            className="btn btn-primary btn-block"
            onClick={() => openExternal(release.downloadUrl)}
          >
            <Download size={17} /> Download
          </button>
        }
      >
        <p className="whitespace-pre-wrap text-[14px] text-muted">
          {release.notes}
        </p>
        <p className="mt-4 text-[13px] text-subtle">
          The download opens in your browser. Open the file when it&apos;s done
          and tap Install; your data stays.
        </p>
      </Sheet>
    </>
  );
}
