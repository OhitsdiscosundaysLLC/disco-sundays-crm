import { cookies } from "next/headers";
import { unlockGallery } from "../actions";
import { createServiceClient } from "@/lib/supabase/service";
import { galleryAccessCookieName, verifyGalleryAccess } from "@/lib/gallery-access-token";

const BUCKET_FOR_VISIBILITY = {
  public: "gallery-public",
  private: "gallery-private",
} as const;

export default async function PublicGalleryPage({
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
        <p className="text-sm text-neutral-600">
          Gallery viewing isn&apos;t configured yet. Please check back soon.
        </p>
      </Centered>
    );
  }

  const { data: gallery } = await service
    .from("galleries")
    .select("*")
    .eq("slug", slug)
    .eq("published", true)
    .is("deleted_at", null)
    .single();

  if (!gallery) {
    return (
      <Centered>
        <p className="text-sm text-neutral-600">This gallery doesn&apos;t exist or is no longer available.</p>
      </Centered>
    );
  }

  if (gallery.expires_at && new Date(gallery.expires_at).getTime() < Date.now()) {
    return (
      <Centered>
        <p className="text-sm text-neutral-600">This gallery has expired.</p>
      </Centered>
    );
  }

  if (gallery.visibility === "private") {
    const store = await cookies();
    const token = store.get(galleryAccessCookieName(gallery.id))?.value;
    const unlocked = verifyGalleryAccess(gallery.id, token);

    if (!unlocked) {
      return (
        <Centered>
          <h1 className="text-lg font-semibold text-neutral-900">{gallery.title}</h1>
          <p className="mt-1 text-sm text-neutral-500">This gallery is password-protected.</p>
          <form action={unlockGallery.bind(null, slug)} className="mt-4 flex flex-col gap-3">
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
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-neutral-900">{gallery.title}</h1>
        {gallery.description ? <p className="mt-2 text-neutral-600">{gallery.description}</p> : null}
      </div>

      {assetsWithUrls.length === 0 ? (
        <p className="text-sm text-neutral-500">This gallery doesn&apos;t have any media yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {assetsWithUrls.map((asset) =>
            asset.url ? (
              <a
                key={asset.id}
                href={gallery.allow_downloads ? asset.url : undefined}
                target={gallery.allow_downloads ? "_blank" : undefined}
                rel={gallery.allow_downloads ? "noreferrer" : undefined}
                className={gallery.allow_downloads ? "cursor-pointer" : "cursor-default"}
              >
                {asset.kind === "video" ? (
                  <video src={asset.url} className="aspect-square w-full rounded-lg object-cover" muted controls />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={asset.url} alt="" className="aspect-square w-full rounded-lg object-cover" />
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
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
