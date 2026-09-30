import { cookies } from "next/headers";
import { unlockDelivery, submitCustomerComment, submitCustomerApproval } from "../actions";
import { createServiceClient } from "@/lib/supabase/service";
import { deliveryAccessCookieName, verifyDeliveryAccess } from "@/lib/delivery-access-token";
import { DeliveryAudioPlayer, type PlayerVersion } from "../audio-player";

const BUCKET = "project-audio";

export default async function PublicDeliveryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug } = await params;
  const { error } = await searchParams;
  const service = createServiceClient();

  if (!service) {
    return (
      <Centered>
        <p className="text-sm text-neutral-600">Delivery links aren&apos;t configured yet. Please check back soon.</p>
      </Centered>
    );
  }

  const { data: link } = await service
    .from("delivery_links")
    .select("id, project_id, song_id, status, expires_at, allow_downloads, password_hash")
    .eq("slug", slug)
    .is("deleted_at", null)
    .single();

  if (!link) {
    return (
      <Centered>
        <p className="text-sm text-neutral-600">This link doesn&apos;t exist or is no longer available.</p>
      </Centered>
    );
  }

  if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) {
    return (
      <Centered>
        <p className="text-sm text-neutral-600">This link has expired. Ask your engineer for a new one.</p>
      </Centered>
    );
  }

  const { data: project } = await service
    .from("projects")
    .select("id, name, artist_name, customer_id")
    .eq("id", link.project_id)
    .single();

  if (!project) {
    return (
      <Centered>
        <p className="text-sm text-neutral-600">This link doesn&apos;t exist or is no longer available.</p>
      </Centered>
    );
  }

  if (link.password_hash) {
    const store = await cookies();
    const token = store.get(deliveryAccessCookieName(link.id))?.value;
    const unlocked = verifyDeliveryAccess(link.id, token);

    if (!unlocked) {
      return (
        <Centered>
          <h1 className="text-lg font-semibold text-neutral-900">{project.name}</h1>
          <p className="mt-1 text-sm text-neutral-500">This delivery is password-protected.</p>
          <form action={unlockDelivery.bind(null, slug)} className="mt-4 flex flex-col gap-3">
            <input
              type="password"
              name="password"
              required
              placeholder="Enter password"
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
            />
            {error ? (
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
            >
              View delivery
            </button>
          </form>
        </Centered>
      );
    }
  }

  const { data: bundled } = await service
    .from("delivery_link_versions")
    .select(
      "audio_version_id, audio_versions(id, version_label, status, duration_seconds, asset_id, project_assets(storage_path, file_name))"
    )
    .eq("delivery_link_id", link.id);

  const versionIds = (bundled ?? []).map((b) => b.audio_version_id);

  const [{ data: comments }, { data: approvals }] = await Promise.all([
    versionIds.length > 0
      ? service
          .from("audio_comments")
          .select("id, audio_version_id, timestamp_seconds, comment, author_type, status, author_profile_id, author_customer_id, profiles:author_profile_id(display_name)")
          .in("audio_version_id", versionIds)
      : Promise.resolve({ data: [] as never[] }),
    versionIds.length > 0
      ? service.from("audio_approvals").select("id, audio_version_id, approved_at").in("audio_version_id", versionIds)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const versions: PlayerVersion[] = await Promise.all(
    (bundled ?? []).flatMap((b) => {
      const v = b.audio_versions as {
        id: string;
        version_label: string;
        status: string;
        duration_seconds: number | null;
        asset_id: string;
        project_assets: { storage_path: string; file_name: string } | null;
      } | null;
      if (!v || !v.project_assets) return [];

      return [
        (async () => {
          const { data: signed } = await service.storage.from(BUCKET).createSignedUrl(v.project_assets!.storage_path, 3600);
          const versionComments = (comments ?? [])
            .filter((c) => c.audio_version_id === v.id)
            .map((c) => {
              const staffName = (c.profiles as { display_name: string | null } | null)?.display_name;
              return {
                id: c.id,
                timestamp_seconds: c.timestamp_seconds,
                comment: c.comment,
                status: c.status as "open" | "resolved",
                author_label: c.author_type === "staff" ? staffName || "Studio" : "You",
              };
            });
          const approval = (approvals ?? []).find((a) => a.audio_version_id === v.id);

          return {
            id: v.id,
            label: v.version_label,
            url: signed?.signedUrl ?? "",
            fileName: v.project_assets!.file_name,
            status: v.status,
            durationSeconds: v.duration_seconds,
            comments: versionComments,
            approved: approval ? { approvedAt: approval.approved_at } : null,
          } satisfies PlayerVersion;
        })(),
      ];
    })
  );

  await service.from("delivery_link_views").insert({ delivery_link_id: link.id });

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-wide text-neutral-500">{project.artist_name || "Disco Sundays"}</p>
        <h1 className="text-2xl font-semibold text-neutral-900">{project.name}</h1>
      </div>

      {versions.length === 0 ? (
        <p className="text-sm text-neutral-500">No audio has been attached to this link yet.</p>
      ) : (
        <DeliveryAudioPlayer
          versions={versions.filter((v) => v.url)}
          allowDownloads={link.allow_downloads}
          onSubmitComment={submitCustomerComment.bind(null, link.id, project.customer_id, slug)}
          onApprove={submitCustomerApproval.bind(null, link.id, project.customer_id, slug)}
        />
      )}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
