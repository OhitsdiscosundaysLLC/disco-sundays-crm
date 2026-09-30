"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { logActivity } from "@/lib/activities";

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
