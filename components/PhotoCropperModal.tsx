"use client";

import { useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import ReactCrop, {
  Crop,
  PixelCrop,
  centerCrop,
  makeAspectCrop,
} from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { useObjectUrl } from "@/lib/useObjectUrl";
import { useModalLayer } from "@/components/ui/useModalLayer";

import { PERSON_ASPECT } from "@/lib/image";

interface Props {
  file: File;
  aspect?: number;
  uploading?: boolean;
  confirmLabel?: string;
  onConfirm: (file: File) => void;
  onCancel: () => void;
}

function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number,
) {
  return centerCrop(
    makeAspectCrop({ unit: "%", width: 85 }, aspect, mediaWidth, mediaHeight),
    mediaWidth,
    mediaHeight,
  );
}

async function getCroppedFile(
  image: HTMLImageElement,
  crop: PixelCrop,
  fileName: string,
): Promise<File> {
  const canvas = document.createElement("canvas");

  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;

  const cropW = Math.floor(crop.width * scaleX);
  const cropH = Math.floor(crop.height * scaleY);

  // Cap at 1600px on longest side to keep file size reasonable
  const outputScale = Math.min(1, 1600 / Math.max(cropW, cropH));
  const outW = Math.round(cropW * outputScale);
  const outH = Math.round(cropH * outputScale);

  canvas.width = outW;
  canvas.height = outH;

  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";

  ctx.drawImage(
    image,
    Math.floor(crop.x * scaleX),
    Math.floor(crop.y * scaleY),
    cropW,
    cropH,
    0,
    0,
    outW,
    outH,
  );

  const jpegName = fileName.replace(/\.[^.]+$/, "") + ".jpg";
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(new File([blob], jpegName, { type: "image/jpeg" }))
          : reject(new Error("Could not process image")),
      "image/jpeg",
      0.9,
    );
  });
}

export default function PhotoCropperModal({
  file,
  aspect = PERSON_ASPECT,
  uploading = false,
  confirmLabel = "Upload",
  onConfirm,
  onCancel,
}: Props) {
  const imageSrc = useObjectUrl(file);
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  const onImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const { width, height } = e.currentTarget;
      setCrop(centerAspectCrop(width, height, aspect));
    },
    [aspect],
  );

  const handleConfirm = async () => {
    if (!completedCrop || !imgRef.current) return;
    setProcessing(true);
    setError("");
    try {
      onConfirm(await getCroppedFile(imgRef.current, completedCrop, file.name));
    } catch {
      setError("Couldn't read this image. Try another one.");
    } finally {
      setProcessing(false);
    }
  };

  const busy = processing || uploading;
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalLayer(true, dialogRef, () => {
    if (!busy) onCancel();
  });

  // At the end of <body>, above sheets (z-300), since it can open from
  // inside the log sheet, and clear of any `isolate` ancestor.
  return createPortal(
    <div className="animate-fade fixed inset-0 z-[450] flex items-center justify-center bg-black/75 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Crop photo"
        tabIndex={-1}
        className="animate-sheet outline-none flex max-h-full w-full max-w-md flex-col gap-4 rounded-xl border border-border-strong bg-surface-2 p-5"
      >
        <div>
          <h2 className="text-[17px] font-semibold">Crop photo</h2>
          <p className="text-[13px] text-muted">
            Drag to reposition, pull the corners to resize.
          </p>
        </div>

        <div className="flex min-h-0 justify-center overflow-hidden rounded-md bg-black/40">
          {imageSrc && (
            <ReactCrop
              crop={crop}
              onChange={(c) => setCrop(c)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={aspect}
              minWidth={50}
            >
              <img
                ref={imgRef}
                src={imageSrc}
                alt="Crop preview"
                onLoad={onImageLoad}
                className="max-h-[60dvh] w-auto"
              />
            </ReactCrop>
          )}
        </div>

        {error && <p className="text-[13px] text-danger">{error}</p>}

        <div className="flex gap-3">
          <button
            className="btn btn-secondary flex-1"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary flex-1"
            onClick={handleConfirm}
            disabled={!completedCrop || busy}
          >
            {uploading
              ? "Uploading…"
              : processing
                ? "Processing…"
                : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
