import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { customerLabel, formatDate } from "@/lib/format";
import { EmptyState } from "@/components/empty-state";
import { SubmitButton } from "@/components/submit-button";
import { GalleryUploader } from "../gallery-uploader";
import { archiveGallery, deleteGalleryAsset, setCoverAsset, togglePublish } from "../actions";

const BUCKET_FOR_VISIBILITY = {
  public: "gallery-public",
  private: "gallery-private",
} as const;

export default async function GalleryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const canView = await hasPermission(profile.role, "galleries", "view");
  if (!canView) redirect("/galleries");

  const [canEdit, canDelete] = await Promise.all([
    hasPermission(profile.role, "galleries", "edit"),
    hasPermission(profile.role, "galleries", "delete"),
  ]);

  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const [{ data: gallery }, { data: assets }] = await Promise.all([
    supabase
      .from("galleries")
      .select("*, customers(id, display_name, email, phone)")
      .eq("id", id)
      .single(),
    supabase.from("gallery_assets").select("*").eq("gallery_id", id).order("position").order("created_at"),
  ]);

  if (!gallery || gallery.deleted_at) notFound();

  const bucket = BUCKET_FOR_VISIBILITY[gallery.visibility as "public" | "private"] ?? "gallery-private";

  const assetsWithUrls = await Promise.all(
    (assets ?? []).map(async (asset) => {
      if (bucket === "gallery-public") {
        const { data } = supabase.storage.from(bucket).getPublicUrl(asset.storage_path);
        return { ...asset, url: data.publicUrl };
      }
      const { data } = await supabase.storage.from(bucket).createSignedUrl(asset.storage_path, 3600);
      return { ...asset, url: data?.signedUrl ?? null };
    })
  );

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const publicUrl = appUrl ? `${appUrl}/gallery/${gallery.slug}` : `/gallery/${gallery.slug}`;

  return (
    <div className="max-w-4xl space-y-8">
      {error ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">{gallery.title}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {gallery.customers ? customerLabel(gallery.customers) : "—"} · {gallery.visibility} ·{" "}
            {gallery.published ? "published" : "draft"} · added {formatDate(gallery.created_at)}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {canEdit ? (
            <Link
              href={`/galleries/${gallery.id}/edit`}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50"
            >
              Settings
            </Link>
          ) : null}
          {canEdit ? (
            <form action={togglePublish.bind(null, gallery.id, !gallery.published)}>
              <SubmitButton
                pendingLabel="…"
                className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800"
              >
                {gallery.published ? "Unpublish" : "Publish"}
              </SubmitButton>
            </form>
          ) : null}
          {canDelete ? (
            <form action={archiveGallery.bind(null, gallery.id)}>
              <SubmitButton
                pendingLabel="…"
                className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
              >
                Archive
              </SubmitButton>
            </form>
          ) : null}
        </div>
      </div>

      {gallery.published ? (
        <div className="rounded-lg border border-neutral-200 p-4 text-sm">
          <p className="font-medium text-neutral-900">Public link</p>
          <p className="mt-1 break-all text-neutral-600">{publicUrl}</p>
          <p className="mt-2 text-xs text-neutral-500">
            Embed with: <code className="rounded bg-neutral-100 px-1 py-0.5">{`<iframe src="${appUrl || ""}/embed/gallery/${gallery.id}">`}</code>
          </p>
        </div>
      ) : null}

      {canEdit ? (
        <section className="rounded-lg border border-neutral-200 p-4">
          <h2 className="text-sm font-medium text-neutral-900">Upload media</h2>
          <div className="mt-3">
            <GalleryUploader galleryId={gallery.id} bucket={bucket} />
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="text-sm font-medium text-neutral-900">Assets</h2>
        {assetsWithUrls.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="No media yet" description="Upload photos or videos above to build this gallery." />
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {assetsWithUrls.map((asset) => (
              <div key={asset.id} className="group relative overflow-hidden rounded-lg border border-neutral-200">
                {asset.kind === "video" ? (
                  <video src={asset.url ?? undefined} className="aspect-square w-full object-cover" muted />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={asset.url ?? ""}
                    alt=""
                    className="aspect-square w-full object-cover"
                  />
                )}
                {gallery.cover_asset_id === asset.id ? (
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-neutral-900/80 px-2 py-0.5 text-xs font-medium text-white">
                    Cover
                  </span>
                ) : null}
                {canEdit ? (
                  <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/60 px-2 py-1 opacity-0 transition group-hover:opacity-100">
                    <form action={setCoverAsset.bind(null, gallery.id, asset.id)}>
                      <button type="submit" className="text-xs text-white hover:underline">
                        Set cover
                      </button>
                    </form>
                    {canDelete ? (
                      <form action={deleteGalleryAsset.bind(null, gallery.id, asset.id, asset.storage_path, bucket)}>
                        <button type="submit" className="text-xs text-white hover:underline">
                          Delete
                        </button>
                      </form>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
