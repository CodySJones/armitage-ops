import { promises as fs } from "fs";
import path from "path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { changeOrderDrafts, getProject, reports as seededReports } from "@/lib/operations/demo-data";
import type { ChangeOrderDraft, FieldReport, LaborEntry, PhotoRecord, Variance } from "@/lib/operations/types";

const storageDir = path.join(process.cwd(), "storage", "operations");
const uploadDir = path.join(storageDir, "photos");
const reportsFile = path.join(storageDir, "field-reports.json");

async function ensureStore() {
  await fs.mkdir(uploadDir, { recursive: true });

  try {
    await fs.access(reportsFile);
  } catch {
    await fs.writeFile(reportsFile, "[]\n", "utf8");
  }
}

export async function listSubmittedReports() {
  await ensureStore();
  const raw = await fs.readFile(reportsFile, "utf8");
  return JSON.parse(raw) as FieldReport[];
}

export async function getSubmittedReport(projectId: string, reportId: string) {
  const reports = await listSubmittedReports();
  return reports.find((report) => report.projectId === projectId && report.id === reportId) ?? null;
}

export async function listFieldReports(projectId: string) {
  const submitted = await listSubmittedReports();
  return [...submitted, ...seededReports]
    .filter((report) => report.projectId === projectId)
    .sort((a, b) => b.reportDate.localeCompare(a.reportDate));
}

export async function getFieldReport(projectId: string, reportId: string) {
  const reports = await listFieldReports(projectId);
  return reports.find((report) => report.id === reportId) ?? null;
}

function draftFromVariance(report: FieldReport, variance: Variance): ChangeOrderDraft {
  return {
    id: `co-${variance.id}`,
    projectId: report.projectId,
    reportId: report.id,
    varianceIds: [variance.id],
    title: `${variance.affectedArea || variance.type} variance`,
    aiSummary:
      `${variance.description} Field evidence indicates ${variance.estimatedLaborImpactHours} labor hours, ${variance.estimatedMaterialImpact || "material impact TBD"}, and ${variance.estimatedScheduleImpactDays} schedule day(s). PM review is required before manual client send.`,
    scopeNarrative:
      "Review field report evidence, confirm entitlement and pricing, then convert this draft into the client-facing change order outside the app.",
    laborImpactHours: variance.estimatedLaborImpactHours,
    materialImpact: variance.estimatedMaterialImpact,
    scheduleImpactDays: variance.estimatedScheduleImpactDays,
    status: "pm_review_required",
    createdAt: report.createdAt,
  };
}

export async function listChangeOrderDrafts(projectId: string) {
  const submittedReports = await listSubmittedReports();
  const generated = submittedReports.flatMap((report) =>
    report.variances
      .filter((variance) => variance.requiresChangeOrder === "yes")
      .map((variance) => draftFromVariance(report, variance)),
  );

  return [...generated, ...changeOrderDrafts].filter((draft) => draft.projectId === projectId);
}

export async function getChangeOrderDraft(projectId: string, id: string) {
  const drafts = await listChangeOrderDrafts(projectId);
  return drafts.find((draft) => draft.id === id) ?? null;
}

function stringList(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function selectedList(formData: FormData, key: string) {
  return formData.getAll(key).map(String).filter(Boolean);
}

function slug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function savePhotos(formData: FormData, reportId: string) {
  const photos = formData.getAll("photos").filter((value): value is File => value instanceof File && value.size > 0);
  const captions = stringList(formData.get("photoCaptions"));
  const saved: PhotoRecord[] = [];

  for (const [index, photo] of photos.entries()) {
    const extension = path.extname(photo.name) || ".jpg";
    const fileName = `${reportId}-${index + 1}${extension}`;
    const filePath = path.join(uploadDir, fileName);
    const bytes = Buffer.from(await photo.arrayBuffer());
    await fs.writeFile(filePath, bytes);
    saved.push({
      id: `photo-${reportId}-${index + 1}`,
      caption: captions[index] || photo.name,
      storagePath: `/storage/operations/photos/${fileName}`,
    });
  }

  return saved;
}

function parseLabor(formData: FormData): LaborEntry[] {
  const employees = formData.getAll("laborEmployee").map(String);
  const hours = formData.getAll("laborHours").map(String);
  const phases = formData.getAll("laborPhase").map(String);
  const notes = formData.getAll("laborNotes").map(String);

  return employees
    .map((employeeName, index) => ({
      id: `labor-${index + 1}`,
      employeeName: employeeName.trim(),
      hours: Number(hours[index] || 0),
      phaseCode: phases[index] as LaborEntry["phaseCode"],
      notes: notes[index]?.trim(),
    }))
    .filter((entry) => entry.employeeName && entry.hours > 0);
}

function parseVariance(formData: FormData, photos: PhotoRecord[]): Variance[] {
  const description = String(formData.get("varianceDescription") ?? "").trim();

  if (!description) {
    return [];
  }

  const varianceId = `variance-${Date.now()}`;
  return [
    {
      id: varianceId,
      type: String(formData.get("varianceType") ?? "schedule") as Variance["type"],
      description,
      discoveredBy: String(formData.get("discoveredBy") ?? "").trim(),
      discoveredAt: String(formData.get("discoveredAt") ?? new Date().toISOString()),
      affectedArea: String(formData.get("affectedArea") ?? "").trim(),
      relatedPhotoIds: photos.map((photo) => photo.id),
      estimatedLaborImpactHours: Number(formData.get("laborImpactHours") ?? 0),
      estimatedMaterialImpact: String(formData.get("materialImpact") ?? "").trim(),
      estimatedScheduleImpactDays: Number(formData.get("scheduleImpactDays") ?? 0),
      requiresChangeOrder: String(formData.get("requiresChangeOrder") ?? "unknown") as Variance["requiresChangeOrder"],
      clientNotified: formData.get("clientNotified") === "on",
      internalNotes: String(formData.get("internalNotes") ?? "").trim(),
      status: formData.get("requiresChangeOrder") === "yes" ? "pm_review" : "open",
    },
  ];
}

export async function submitFieldReportAction(projectId: string, formData: FormData) {
  "use server";

  const project = getProject(projectId);
  if (!project) {
    throw new Error("Project not found.");
  }

  await ensureStore();
  const existing = await listSubmittedReports();
  const reportDate = String(formData.get("reportDate") ?? new Date().toISOString().slice(0, 10));
  const reportId = `report-${slug(projectId)}-${reportDate}-${existing.length + 1}`;
  const photos = await savePhotos(formData, reportId);
  const variances = parseVariance(formData, photos);

  const report: FieldReport = {
    id: reportId,
    projectId,
    reportDate,
    submittedBy: String(formData.get("submittedBy") ?? "").trim() || "Field lead",
    crewMembers: stringList(formData.get("crewMembers")).map((name, index) => ({
      id: `crew-${index + 1}`,
      name,
      role: "Crew",
    })),
    laborEntries: parseLabor(formData),
    plannedTaskIds: selectedList(formData, "plannedTaskIds"),
    completedTaskIds: selectedList(formData, "completedTaskIds"),
    incompleteTaskIds: selectedList(formData, "incompleteTaskIds"),
    blockers: stringList(formData.get("blockers")),
    variances,
    photos,
    tomorrowRecommendations: String(formData.get("tomorrowRecommendations") ?? "").trim(),
    createdAt: new Date().toISOString(),
  };

  await fs.writeFile(reportsFile, `${JSON.stringify([report, ...existing], null, 2)}\n`, "utf8");
  revalidatePath(`/projects/${projectId}/board`);
  revalidatePath(`/projects/${projectId}/reports/${reportId}`);
  revalidatePath("/");
  redirect(`/projects/${projectId}/reports/${reportId}`);
}
