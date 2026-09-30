"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type PlayerComment = {
  id: string;
  timestamp_seconds: number;
  comment: string;
  author_label: string;
  status: "open" | "resolved";
};

export type PlayerVersion = {
  id: string;
  label: string;
  url: string;
  fileName: string;
  status: string;
  durationSeconds: number | null;
  comments: PlayerComment[];
  approved: { approvedAt: string } | null;
};

const APPROVABLE_STATUSES = new Set(["draft", "internal_review", "client_review", "revision_requested"]);

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function DeliveryAudioPlayer({
  versions,
  allowDownloads,
  onSubmitComment,
  onApprove,
}: {
  versions: PlayerVersion[];
  allowDownloads: boolean;
  onSubmitComment: (formData: FormData) => Promise<void>;
  onApprove: (formData: FormData) => Promise<void>;
}) {
  const [activeId, setActiveId] = useState(versions[0]?.id ?? "");
  const active = versions.find((v) => v.id === activeId) ?? versions[0];
  const audioRef = useRef<HTMLAudioElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(active?.durationSeconds ?? 0);
  const [volume, setVolume] = useState(1);
  const [commentDraft, setCommentDraft] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setCurrentTime(0);
    setPlaying(false);
    setDuration(active?.durationSeconds ?? 0);
    // Only re-sync when the selected version changes — active.durationSeconds
    // is derived from activeId via the versions array, not an independent trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  const sortedComments = useMemo(
    () => [...(active?.comments ?? [])].sort((a, b) => a.timestamp_seconds - b.timestamp_seconds),
    [active]
  );

  if (!active) return <p className="text-sm text-neutral-500">No audio available on this link.</p>;

  function togglePlay() {
    const el = audioRef.current;
    if (!el) return;
    if (playing) el.pause();
    else el.play();
  }

  function seekTo(seconds: number) {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, Math.min(seconds, duration || seconds));
    setCurrentTime(el.currentTime);
  }

  function handleBarClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!barRef.current || !duration) return;
    const rect = barRef.current.getBoundingClientRect();
    const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    seekTo(ratio * duration);
  }

  async function handleCommentSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!commentDraft.trim()) return;
    setPending(true);
    const fd = new FormData();
    fd.set("audio_version_id", active.id);
    fd.set("timestamp_seconds", String(currentTime));
    fd.set("comment", commentDraft.trim());
    await onSubmitComment(fd);
    setCommentDraft("");
    setPending(false);
  }

  async function handleApprove() {
    if (!confirm(`Approve "${active.label}"? This cannot be undone.`)) return;
    setPending(true);
    const fd = new FormData();
    fd.set("audio_version_id", active.id);
    await onApprove(fd);
    setPending(false);
  }

  const canApprove = !active.approved && APPROVABLE_STATUSES.has(active.status);

  return (
    <div className="space-y-4 rounded-xl border border-neutral-200 p-5">
      {versions.length > 1 ? (
        <select
          value={activeId}
          onChange={(e) => setActiveId(e.target.value)}
          className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
        >
          {versions.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label} ({v.status.replace(/_/g, " ")})
            </option>
          ))}
        </select>
      ) : (
        <p className="text-sm font-medium text-neutral-900">{active.label}</p>
      )}

      <audio
        ref={audioRef}
        src={active.url}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        className="hidden"
      />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white hover:bg-neutral-800"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? "❚❚" : "▶"}
        </button>

        <div className="flex-1">
          <div
            ref={barRef}
            onClick={handleBarClick}
            className="relative h-2 cursor-pointer rounded-full bg-neutral-200"
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-neutral-900"
              style={{ width: duration ? `${(currentTime / duration) * 100}%` : "0%" }}
            />
            {sortedComments.map((c) => (
              <button
                key={c.id}
                type="button"
                title={`${formatTime(c.timestamp_seconds)} — ${c.comment}`}
                onClick={(e) => {
                  e.stopPropagation();
                  seekTo(c.timestamp_seconds);
                }}
                className={`absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white ${c.status === "resolved" ? "bg-green-500" : "bg-amber-500"}`}
                style={{ left: duration ? `${(c.timestamp_seconds / duration) * 100}%` : "0%" }}
              />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-xs text-neutral-500">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => {
            const v = Number(e.target.value);
            setVolume(v);
            if (audioRef.current) audioRef.current.volume = v;
          }}
          className="w-20"
          aria-label="Volume"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium capitalize text-neutral-700">
          {active.status.replace(/_/g, " ")}
        </span>
        {active.approved ? (
          <span className="text-xs font-medium text-green-700">
            Approved {new Date(active.approved.approvedAt).toLocaleString()}
          </span>
        ) : canApprove ? (
          <button
            type="button"
            disabled={pending}
            onClick={handleApprove}
            className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            Approve this version
          </button>
        ) : null}
        {allowDownloads ? (
          <a href={active.url} download={active.fileName} className="text-xs text-neutral-500 underline hover:text-neutral-900">
            Download
          </a>
        ) : null}
      </div>

      <div className="border-t border-neutral-100 pt-4">
        <h3 className="text-sm font-medium text-neutral-900">Feedback</h3>
        <form onSubmit={handleCommentSubmit} className="mt-2 flex gap-2">
          <span className="flex shrink-0 items-center rounded-md bg-neutral-100 px-2 text-xs text-neutral-600">
            {formatTime(currentTime)}
          </span>
          <input
            value={commentDraft}
            onChange={(e) => setCommentDraft(e.target.value)}
            placeholder="Leave a note at this timestamp…"
            className="flex-1 rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
          />
          <button
            type="submit"
            disabled={pending || !commentDraft.trim()}
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            Send
          </button>
        </form>

        {sortedComments.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">No feedback yet — play the track and leave a note at any point.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {sortedComments.map((c) => (
              <li key={c.id} className="flex items-start gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => seekTo(c.timestamp_seconds)}
                  className="mt-0.5 shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-mono text-neutral-600 hover:bg-neutral-200"
                >
                  {formatTime(c.timestamp_seconds)}
                </button>
                <div>
                  <p className="text-neutral-800">{c.comment}</p>
                  <p className="text-xs text-neutral-400">
                    {c.author_label} {c.status === "resolved" ? "· resolved" : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
