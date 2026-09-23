import { cookies } from "next/headers";
import { unlockGallery } from "../../../gallery/actions";
import { createServiceClient } from "@/lib/supabase/service";
import { galleryAccessCookieName, verifyGalleryAccess } from "@/lib/gallery-access-token";

const BUCKET_FOR_VISIBILITY = {
  public: "gallery-public",
  private: "gallery-private",
} as const;

/**
 * Stripped-chrome version of /gallery/[slug] for iframe embedding (e.g. on
 * the Shopify storefront) — same access rules, no page title/description
 * header. docs/ARCHITECTURE.md §4: intentionally permissive framing, no
 * X-Frame-Options set anywhere in this app by default.
 */
export default async function EmbedGalleryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const service = createServiceClient();

  if (!service) {
    return <Centered>Gallery viewing isn&apos;t configured yet.</Centered>;
  }

  const { data: gallery } = await service
    .from("galleries")
    .select("*")
    .eq("id", id)
    .eq("published", true)
    .is("deleted_at", null)
    .single();

  if (!gallery) return <Centered>This gallery is no longer available.</Centered>;
  if (gallery.expires_at && new Date(gallery.expires_at).getTime() < Date.now()) {
    return <Centered>This gallery has expired.</Centered>;
  }

  if (gallery.visibility === "private") {
    const store = await cookies();
    const token = store.get(galleryAccessCookieName(gallery.id))?.value;
    const unlocked = verifyGalleryAccess(gallery.id, token);

    if (!unlocked) {
      return (
        <Centered>
          <form action={unlockGallery.bind(null, gallery.slug)} className="flex flex-col gap-3">
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
              View gallery
            </button>
          </form>
        </Centered>
      );
    }
  }

  const bucket = BUCKET_FOR_VISIBILITY[gallery.visibility as "public" | "private"] ?? "gallery-private";

  const { data: assets } = await service
    .from("gallery_assets")
    .select("*")
    .eq("gallery_id", gallery.id)
    .order("position")
    .order("created_at");

  const assetsWithUrls = await Promise.all(
    (assets ?? []).map(async (asset) => {
      if (bucket === "gallery-public") {
        const { data } = service.storage.from(bucket).getPublicUrl(asset.storage_path);
        return { ...asset, url: data.publicUrl };
      }
      const { data } = await service.storage.from(bucket).createSignedUrl(asset.storage_path, 3600);
      return { ...asset, url: data?.signedUrl ?? null };
    })
  );

  await service.from("gallery_views").insert({ gallery_id: gallery.id });

  return (
    <div className="p-3">
      {assetsWithUrls.length === 0 ? (
        <p className="text-sm text-neutral-500">No media yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {assetsWithUrls.map((asset) =>
            asset.url ? (
              <a
                key={asset.id}
                href={gallery.allow_downloads ? asset.url : undefined}
                target={gallery.allow_downloads ? "_blank" : undefined}
                rel={gallery.allow_downloads ? "noreferrer" : undefined}
              >
                {asset.kind === "video" ? (
                  <video src={asset.url} className="aspect-square w-full rounded-md object-cover" muted controls />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={asset.url} alt="" className="aspect-square w-full rounded-md object-cover" />
                )}
              </a>
            ) : null
          )}
        </div>
      )}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[200px] items-center justify-center p-4 text-center text-sm text-neutral-600">
      {children}
    </div>
  );
}
