"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createAudioVersion, createSupportingAsset } from "./actions";

const BUCKET = "project-audio";
const MAX_BYTES = 500 * 1024 * 1024; // 500MB — masters/stems ZIPs run larger than photos

const AUDIO_ASSET_TYPES = [
  { value: "rough_mix", label: "Rough mix" },
  { value: "mix_version", label: "Mix version" },
  { value: "master", label: "Master" },
  { value: "instrumental", label: "Instrumental" },
  { value: "acapella", label: "Acapella" },
  { value: "stems", label: "Stems" },
  { value: "wav", label: "WAV" },
  { value: "mp3", label: "MP3" },
];

const SUPPORTING_ASSET_TYPES = [
  { value: "artwork", label: "Artwork" },
  { value: "lyrics", label: "Lyrics" },
  { value: "document", label: "Document" },
  { value: "zip", label: "ZIP" },
  { value: "other", label: "Other" },
];

async function uploadFile(projectId: string, file: File): Promise<{ path: string } | { error: string }> {
  const supabase = createClient();
  const ext = file.name.split(".").pop() || "bin";
  const path = `${projectId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) return { error: error.message };
  return { path };
}

export function AudioVersionUploader({
  projectId,
  songOptions,
}: {
  projectId: string;
  songOptions: { value: string; label: string }[];
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    setError(null);
    const file = formData.get("file") as File | null;
    const versionLabel = String(formData.get("version_label") || "").trim();
    if (!file || file.size === 0) return setError("Choose a file.");
    if (file.size > MAX_BYTES) return setError("File is too large (max 500MB).");
    if (!versionLabel) return setError("Enter a version label (e.g. \"Mix v1\").");

    setStatus(`Uploading ${file.name}…`);
    const result = await uploadFile(projectId, file);
    if ("error" in result) {
      setStatus(null);
      return setError(`Upload failed: ${result.error}`);
    }

    await createAudioVersion(
      (() => {
        const fd = new FormData();
        fd.set("project_id", projectId);
        fd.set("song_id", String(formData.get("song_id") || ""));
        fd.set("asset_type", String(formData.get("asset_type") || "mix_version"));
        fd.set("version_label", versionLabel);
        fd.set("storage_path", result.path);
        fd.set("file_name", file.name);
        fd.set("mime_type", file.type);
        fd.set("size_bytes", String(file.size));
        return fd;
      })()
    );

    setStatus(null);
    formRef.current?.reset();
    router.refresh();
  }

  return (
    <form ref={formRef} action={handleSubmit} className="grid grid-cols-2 gap-2 sm:grid-cols-6">
      <input name="file" type="file" required className="col-span-2 rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
      <input name="version_label" placeholder="Version label (e.g. Mix v1)" required className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
      <select name="asset_type" defaultValue="mix_version" className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm">
        {AUDIO_ASSET_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
      <select name="song_id" className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm">
        <option value="">Whole project</option>
        {songOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <button type="submit" className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white hover:bg-neutral-800">
        Upload version
      </button>
      {status ? <p className="col-span-full text-xs text-neutral-500">{status}</p> : null}
      {error ? <p className="col-span-full text-xs text-red-600">{error}</p> : null}
    </form>
  );
}

export function SupportingAssetUploader({
  projectId,
  songOptions,
}: {
  projectId: string;
  songOptions: { value: string; label: string }[];
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    setError(null);
    const file = formData.get("file") as File | null;
    if (!file || file.size === 0) return setError("Choose a file.");
    if (file.size > MAX_BYTES) return setError("File is too large (max 500MB).");

    setStatus(`Uploading ${file.name}…`);
    const result = await uploadFile(projectId, file);
    if ("error" in result) {
      setStatus(null);
      return setError(`Upload failed: ${result.error}`);
    }

    await createSupportingAsset(
      (() => {
        const fd = new FormData();
        fd.set("project_id", projectId);
        fd.set("song_id", String(formData.get("song_id") || ""));
        fd.set("asset_type", String(formData.get("asset_type") || "other"));
        fd.set("storage_path", result.path);
        fd.set("file_name", file.name);
        fd.set("mime_type", file.type);
        fd.set("size_bytes", String(file.size));
        return fd;
      })()
    );

    setStatus(null);
    formRef.current?.reset();
    router.refresh();
  }

  return (
    <form ref={formRef} action={handleSubmit} className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      <input name="file" type="file" required className="col-span-2 rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
      <select name="asset_type" defaultValue="artwork" className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm">
        {SUPPORTING_ASSET_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
      <select name="song_id" className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm">
        <option value="">Whole project</option>
        {songOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <button type="submit" className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white hover:bg-neutral-800">
        Upload file
      </button>
      {status ? <p className="col-span-full text-xs text-neutral-500">{status}</p> : null}
      {error ? <p className="col-span-full text-xs text-red-600">{error}</p> : null}
    </form>
  );
}
