"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { addGalleryAsset } from "./actions";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/quicktime"];
const MAX_BYTES = 200 * 1024 * 1024; // 200MB, generous ceiling for video

export function GalleryUploader({ galleryId, bucket }: { galleryId: string; bucket: string }) {
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleFiles(files: FileList) {
    setError(null);
    const supabase = createClient();

    for (const file of Array.from(files)) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError(`${file.name}: unsupported file type.`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        setError(`${file.name}: file is too large (max 200MB).`);
        continue;
      }

      setStatus(`Uploading ${file.name}…`);
      const kind = file.type.startsWith("video") ? "video" : "image";
      const ext = file.name.split(".").pop() || (kind === "video" ? "mp4" : "jpg");
      const path = `${galleryId}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, {
        contentType: file.type,
        upsert: false,
      });

      if (uploadError) {
        setError(`${file.name}: upload failed (${uploadError.message}).`);
        continue;
      }

      await addGalleryAsset(galleryId, path, kind);
    }

    setStatus(null);
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED_TYPES.join(",")}
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
        className="block text-sm text-neutral-600 file:mr-3 file:rounded-md file:border file:border-neutral-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-neutral-50"
      />
      {status ? <p className="text-sm text-neutral-500">{status}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
