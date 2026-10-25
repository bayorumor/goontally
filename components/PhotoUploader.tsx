"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import PhotoCropperModal from "@/components/PhotoCropperModal";
import { useFeedback } from "@/components/ui/Feedback";

interface Props {
  // PATCH endpoint that accepts the cropped image as multipart form data.
  endpoint: string;
  field?: string;
  aspect: number;
  title?: string;
}

// The small camera button on hero photos: pick → crop → upload, then
// re-render the server page so the new photo shows everywhere.
export default function PhotoUploader({
  endpoint,
  field = "photo",
  aspect,
  title = "Change image",
}: Props) {
  const router = useRouter();
  const { toast } = useFeedback();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const upload = async (cropped: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append(field, cropped);
      const res = await fetch(endpoint, { method: "PATCH", body: formData });
      if (res.ok) {
        toast("Image updated");
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        toast(data.error || "Couldn't upload the image", "error");
      }
    } catch {
      toast("Couldn't upload. Check your connection.", "error");
    } finally {
      setUploading(false);
      setFile(null);
    }
  };

  return (
    <>
      {file && (
        <PhotoCropperModal
          file={file}
          aspect={aspect}
          uploading={uploading}
          onConfirm={upload}
          onCancel={() => {
            if (!uploading) setFile(null);
          }}
        />
      )}
      <button
        className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full border border-border-strong bg-surface-2 text-text shadow-lg transition hover:bg-surface-3"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        title={title}
        aria-label={title}
      >
        <Camera size={16} />
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const picked = e.target.files?.[0];
          if (picked) setFile(picked);
          e.target.value = "";
        }}
      />
    </>
  );
}
