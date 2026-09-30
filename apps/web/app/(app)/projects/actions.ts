"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { logActivity } from "@/lib/activities";
import { hashGalleryPassword } from "@/lib/gallery-password";

export type FormState = { error: string | null };

function str(formData: FormData, key: string): string | null {
  const v = formData.get(key);
  const s = typeof v === "string" ? v.trim() : "";
  return s.length > 0 ? s : null;
}

function num(formData: FormData, key: string): number | null {
  const v = str(formData, key);
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function readProjectFields(formData: FormData) {
  return {
    customer_id: str(formData, "customer_id"),
    service_id: str(formData, "service_id"),
    name: str(formData, "name") ?? "",
    project_type: str(formData, "project_type") ?? "single",
    artist_name: str(formData, "artist_name"),
    description: str(formData, "description"),
    status: str(formData, "status") ?? "planning",
    stage: str(formData, "stage") ?? "inquiry",
    priority: str(formData, "priority") ?? "normal",
    project_manager_id: str(formData, "project_manager_id"),
    primary_engineer_id: str(formData, "primary_engineer_id"),
    estimated_revenue: num(formData, "estimated_revenue"),
    start_date: str(formData, "start_date"),
    due_date: str(formData, "due_date"),
    completion_date: str(formData, "completion_date"),
    notes: str(formData, "notes"),
  };
}

export async function createProject(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "projects", "create");
  if (!allowed) return { error: "You don't have permission to create projects." };

  const fields = readProjectFields(formData);
  if (!fields.customer_id) return { error: "Select a customer." };
  if (!fields.name) return { error: "Enter a project name." };
  const customer_id = fields.customer_id;

  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from("projects")
    .insert({ ...fields, customer_id })
    .select("id")
    .single();

  if (error || !created) {
    console.error("createProject failed", error);
    return { error: "Could not create the project. Try again." };
  }

  await logActivity(supabase, {
    customerId: customer_id,
    type: "project.created",
    title: `Project "${fields.name}" created`,
  });

  revalidatePath("/projects");
  redirect(`/projects/${created.id}`);
}

export async function updateProject(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const id = str(formData, "id");
  if (!id) return { error: "Missing project id." };

  const allowed = await hasPermission(profile.role, "projects", "edit");
  if (!allowed) return { error: "You don't have permission to edit projects." };

  const fields = readProjectFields(formData);
  if (!fields.customer_id) return { error: "Select a customer." };
  if (!fields.name) return { error: "Enter a project name." };
  const customer_id = fields.customer_id;

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({ ...fields, customer_id })
    .eq("id", id);

  if (error) {
    console.error("updateProject failed", error);
    return { error: "Could not save changes. Try again." };
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  redirect(`/projects/${id}`);
}

export async function updateProjectStage(id: string, formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "projects", "edit");
  if (!allowed) return;

  const stage = formData.get("stage");
  if (typeof stage !== "string" || !stage) return;

  const supabase = await createClient();
  const { data: project, error } = await supabase
    .from("projects")
    .update({ stage })
    .eq("id", id)
    .select("customer_id, name")
    .single();

  if (error) {
    console.error("updateProjectStage failed", error);
    return;
  }

  if (project) {
    await logActivity(supabase, {
      customerId: project.customer_id,
      type: "project.stage_changed",
      title: `Project "${project.name}" moved to ${stage.replace(/_/g, " ")}`,
    });
  }

  revalidatePath(`/projects/${id}`);
}

export async function archiveProject(id: string) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "projects", "delete");
  if (!allowed) redirect("/projects");

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) console.error("archiveProject failed", error);

  revalidatePath("/projects");
}

// ---------------------------------------------------------------------
// Songs
// ---------------------------------------------------------------------

export async function createSong(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "projects", "create");
  if (!allowed) return;

  const projectId = str(formData, "project_id");
  const title = str(formData, "title");
  if (!projectId || !title) return;

  const supabase = await createClient();
  const { error } = await supabase.from("project_songs").insert({
    project_id: projectId,
    title,
    track_number: num(formData, "track_number"),
    genre: str(formData, "genre"),
    bpm: num(formData, "bpm"),
    song_key: str(formData, "song_key"),
  });

  if (error) console.error("createSong failed", error);

  revalidatePath(`/projects/${projectId}`);
}

export async function updateSongStatusField(
  songId: string,
  projectId: string,
  field: "recording_status" | "editing_status" | "mixing_status" | "mastering_status",
  formData: FormData
) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "projects", "edit");
  if (!allowed) return;

  const value = formData.get("value");
  if (typeof value !== "string" || !value) return;

  const supabase = await createClient();
  // Supabase's generated Update type rejects a computed-key object here, so
  // branch to a statically-keyed literal per field instead of [field]: value.
  const { error } =
    field === "recording_status"
      ? await supabase.from("project_songs").update({ recording_status: value }).eq("id", songId)
      : field === "editing_status"
        ? await supabase.from("project_songs").update({ editing_status: value }).eq("id", songId)
        : field === "mixing_status"
          ? await supabase.from("project_songs").update({ mixing_status: value }).eq("id", songId)
          : await supabase.from("project_songs").update({ mastering_status: value }).eq("id", songId);

  if (error) console.error("updateSongStatusField failed", error);

  revalidatePath(`/projects/${projectId}`);
}

export async function deleteSong(songId: string, projectId: string) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "projects", "delete");
  if (!allowed) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("project_songs")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", songId);

  if (error) console.error("deleteSong failed", error);

  revalidatePath(`/projects/${projectId}`);
}

// ---------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------

export async function createSession(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "projects", "create");
  if (!allowed) return;

  const projectId = str(formData, "project_id");
  if (!projectId) return;

  const supabase = await createClient();
  const { error } = await supabase.from("project_sessions").insert({
    project_id: projectId,
    song_id: str(formData, "song_id"),
    engineer_id: str(formData, "engineer_id"),
    session_type: str(formData, "session_type") ?? "recording",
    starts_at: str(formData, "starts_at"),
    ends_at: str(formData, "ends_at"),
    notes: str(formData, "notes"),
  });

  if (error) console.error("createSession failed", error);

  revalidatePath(`/projects/${projectId}`);
}

export async function updateSessionStatus(sessionId: string, projectId: string, formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "projects", "edit");
  if (!allowed) return;

  const status = formData.get("value");
  if (typeof status !== "string" || !status) return;

  const supabase = await createClient();
  const { error } = await supabase.from("project_sessions").update({ status }).eq("id", sessionId);

  if (error) console.error("updateSessionStatus failed", error);

  revalidatePath(`/projects/${projectId}`);
}

// ---------------------------------------------------------------------
// Revisions
// ---------------------------------------------------------------------

export async function createRevision(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "projects", "create");
  if (!allowed) return;

  const projectId = str(formData, "project_id");
  const revisionNumber = num(formData, "revision_number");
  if (!projectId || revisionNumber === null) return;

  const supabase = await createClient();
  const { data: project, error } = await supabase
    .from("project_revisions")
    .insert({
      project_id: projectId,
      song_id: str(formData, "song_id"),
      revision_number: revisionNumber,
      description: str(formData, "description"),
    })
    .select("project_id, projects(customer_id, name)")
    .single();

  if (error) {
    console.error("createRevision failed", error);
    revalidatePath(`/projects/${projectId}`);
    return;
  }

  const projectInfo = project?.projects as { customer_id: string; name: string } | null;
  if (projectInfo) {
    await logActivity(supabase, {
      customerId: projectInfo.customer_id,
      type: "project.revision_requested",
      title: `Revision #${revisionNumber} requested on "${projectInfo.name}"`,
    });
  }

  revalidatePath(`/projects/${projectId}`);
}

export async function completeRevision(revisionId: string, projectId: string) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "projects", "edit");
  if (!allowed) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("project_revisions")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", revisionId);

  if (error) console.error("completeRevision failed", error);

  revalidatePath(`/projects/${projectId}`);
}

// ---------------------------------------------------------------------
// Deliveries
// ---------------------------------------------------------------------

export async function createDelivery(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "projects", "create");
  if (!allowed) return;

  const projectId = str(formData, "project_id");
  if (!projectId) return;

  const supabase = await createClient();
  const { data: project, error } = await supabase
    .from("project_deliveries")
    .insert({
      project_id: projectId,
      delivery_type: str(formData, "delivery_type") ?? "other",
      gallery_id: str(formData, "gallery_id"),
      delivered_by: profile.id,
      notes: str(formData, "notes"),
    })
    .select("project_id, projects(customer_id, name)")
    .single();

  if (error) {
    console.error("createDelivery failed", error);
    revalidatePath(`/projects/${projectId}`);
    return;
  }

  const projectInfo = project?.projects as { customer_id: string; name: string } | null;
  if (projectInfo) {
    await logActivity(supabase, {
      customerId: projectInfo.customer_id,
      type: "project.delivered",
      title: `Delivery recorded for "${projectInfo.name}"`,
    });
  }

  revalidatePath(`/projects/${projectId}`);
}

// ---------------------------------------------------------------------
// Phase B — Audio assets, versions, comments, approvals, delivery links.
// Files are already uploaded direct-to-storage by the client before
// these actions run (same pattern as gallery-uploader.tsx) — these
// actions only record the resulting storage_path in the database.
// ---------------------------------------------------------------------

const AUDIO_VERSION_STATUSES = [
  "draft",
  "internal_review",
  "client_review",
  "revision_requested",
  "approved",
  "final",
  "delivered",
] as const;

export async function createAudioVersion(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "projects", "create");
  if (!allowed) return;

  const projectId = str(formData, "project_id");
  const storagePath = str(formData, "storage_path");
  const fileName = str(formData, "file_name");
  const assetType = str(formData, "asset_type");
  const versionLabel = str(formData, "version_label");
  if (!projectId || !storagePath || !fileName || !assetType || !versionLabel) return;

  const supabase = await createClient();
  const songId = str(formData, "song_id");

  const { data: asset, error: assetError } = await supabase
    .from("project_assets")
    .insert({
      project_id: projectId,
      song_id: songId,
      asset_type: assetType,
      storage_path: storagePath,
      file_name: fileName,
      mime_type: str(formData, "mime_type"),
      size_bytes: num(formData, "size_bytes"),
      uploaded_by: profile.id,
    })
    .select("id")
    .single();

  if (assetError || !asset) {
    console.error("createAudioVersion: project_assets insert failed", assetError);
    return;
  }

  const { error: versionError, data: version } = await supabase
    .from("audio_versions")
    .insert({
      project_id: projectId,
      song_id: songId,
      asset_id: asset.id,
      version_label: versionLabel,
      duration_seconds: num(formData, "duration_seconds"),
      uploaded_by: profile.id,
    })
    .select("project_id, projects(customer_id, name)")
    .single();

  if (versionError) {
    console.error("createAudioVersion: audio_versions insert failed", versionError);
    revalidatePath(`/projects/${projectId}`);
    return;
  }

  const projectInfo = version?.projects as { customer_id: string; name: string } | null;
  if (projectInfo) {
    await logActivity(supabase, {
      customerId: projectInfo.customer_id,
      type: "project.audio_version_uploaded",
      title: `New audio version "${versionLabel}" uploaded for "${projectInfo.name}"`,
    });
  }

  revalidatePath(`/projects/${projectId}`);
}

export async function updateAudioVersionStatus(versionId: string, projectId: string, formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "projects", "edit");
  if (!allowed) return;

  const status = formData.get("value");
  if (typeof status !== "string" || !(AUDIO_VERSION_STATUSES as readonly string[]).includes(status)) return;

  const supabase = await createClient();
  const { error } = await supabase.from("audio_versions").update({ status }).eq("id", versionId);

  if (error) console.error("updateAudioVersionStatus failed", error);

  revalidatePath(`/projects/${projectId}`);
}

export async function createSupportingAsset(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "projects", "create");
  if (!allowed) return;

  const projectId = str(formData, "project_id");
  const storagePath = str(formData, "storage_path");
  const fileName = str(formData, "file_name");
  const assetType = str(formData, "asset_type");
  if (!projectId || !storagePath || !fileName || !assetType) return;

  const supabase = await createClient();
  const { error } = await supabase.from("project_assets").insert({
    project_id: projectId,
    song_id: str(formData, "song_id"),
    asset_type: assetType,
    storage_path: storagePath,
    file_name: fileName,
    mime_type: str(formData, "mime_type"),
    size_bytes: num(formData, "size_bytes"),
    uploaded_by: profile.id,
  });

  if (error) console.error("createSupportingAsset failed", error);

  revalidatePath(`/projects/${projectId}`);
}

export async function deleteSupportingAsset(assetId: string, projectId: string) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "projects", "delete");
  if (!allowed) return;

  const supabase = await createClient();
  // Only ever targets assets with no audio_versions row (enforced in the UI
  // by only rendering delete on the "supporting files" list) — audio
  // versions themselves are never deleted, only status-transitioned.
  const { error } = await supabase
    .from("project_assets")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", assetId);

  if (error) console.error("deleteSupportingAsset failed", error);

  revalidatePath(`/projects/${projectId}`);
}

export async function createStaffAudioComment(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "projects", "edit");
  if (!allowed) return;

  const projectId = str(formData, "project_id");
  const audioVersionId = str(formData, "audio_version_id");
  const comment = str(formData, "comment");
  const timestampSeconds = num(formData, "timestamp_seconds") ?? 0;
  if (!projectId || !audioVersionId || !comment) return;

  const supabase = await createClient();
  const { error } = await supabase.from("audio_comments").insert({
    audio_version_id: audioVersionId,
    timestamp_seconds: timestampSeconds,
    comment,
    author_type: "staff",
    author_profile_id: profile.id,
  });

  if (error) console.error("createStaffAudioComment failed", error);

  revalidatePath(`/projects/${projectId}`);
}

export async function resolveAudioComment(commentId: string, projectId: string) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "projects", "edit");
  if (!allowed) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("audio_comments")
    .update({ status: "resolved", resolved_by: profile.id, resolved_at: new Date().toISOString() })
    .eq("id", commentId);

  if (error) console.error("resolveAudioComment failed", error);

  revalidatePath(`/projects/${projectId}`);
}

export async function recordManualApproval(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "projects", "edit");
  if (!allowed) return;

  const projectId = str(formData, "project_id");
  const audioVersionId = str(formData, "audio_version_id");
  const customerId = str(formData, "customer_id");
  if (!projectId || !audioVersionId || !customerId) return;

  const supabase = await createClient();
  const { error } = await supabase.from("audio_approvals").insert({
    audio_version_id: audioVersionId,
    customer_id: customerId,
  });

  if (error) {
    console.error("recordManualApproval failed", error);
    revalidatePath(`/projects/${projectId}`);
    return;
  }

  await supabase.from("audio_versions").update({ status: "approved" }).eq("id", audioVersionId);

  await logActivity(supabase, {
    customerId,
    type: "project.audio_version_approved",
    title: "Audio version approved (logged by staff)",
  });

  revalidatePath(`/projects/${projectId}`);
}

// ---------------------------------------------------------------------
// Delivery links
// ---------------------------------------------------------------------

function generateDeliverySlug(): string {
  return `dl-${randomBytes(4).toString("hex")}`;
}

export async function createDeliveryLink(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "projects", "create");
  if (!allowed) return;

  const projectId = str(formData, "project_id");
  if (!projectId) return;

  const password = str(formData, "password");
  const expiresAt = str(formData, "expires_at");
  const allowDownloads = formData.get("allow_downloads") === "on";
  const versionIds = formData.getAll("version_ids").filter((v): v is string => typeof v === "string" && v.length > 0);

  const supabase = await createClient();

  let linkId: string | null = null;
  for (let attempt = 0; attempt < 3 && !linkId; attempt++) {
    const slug = generateDeliverySlug();
    const { data, error } = await supabase
      .from("delivery_links")
      .insert({
        project_id: projectId,
        song_id: str(formData, "song_id"),
        slug,
        password_hash: password ? hashGalleryPassword(password) : null,
        expires_at: expiresAt,
        allow_downloads: allowDownloads,
        created_by: profile.id,
      })
      .select("id")
      .single();

    if (!error && data) linkId = data.id;
    else if (error && error.code !== "23505") {
      console.error("createDeliveryLink failed", error);
      revalidatePath(`/projects/${projectId}`);
      return;
    }
  }

  if (!linkId) {
    console.error("createDeliveryLink: could not generate a unique slug");
    revalidatePath(`/projects/${projectId}`);
    return;
  }

  if (versionIds.length > 0) {
    const { error: joinError } = await supabase
      .from("delivery_link_versions")
      .insert(versionIds.map((audio_version_id) => ({ delivery_link_id: linkId!, audio_version_id })));
    if (joinError) console.error("createDeliveryLink: attaching versions failed", joinError);
  }

  revalidatePath(`/projects/${projectId}`);
}

export async function updateDeliveryLinkStatus(linkId: string, projectId: string, formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "projects", "edit");
  if (!allowed) return;

  const status = formData.get("value");
  if (typeof status !== "string" || !(AUDIO_VERSION_STATUSES as readonly string[]).includes(status)) return;

  const supabase = await createClient();
  const { error } = await supabase.from("delivery_links").update({ status }).eq("id", linkId);

  if (error) console.error("updateDeliveryLinkStatus failed", error);

  revalidatePath(`/projects/${projectId}`);
}

export async function archiveDeliveryLink(linkId: string, projectId: string) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "projects", "delete");
  if (!allowed) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("delivery_links")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", linkId);

  if (error) console.error("archiveDeliveryLink failed", error);

  revalidatePath(`/projects/${projectId}`);
}
