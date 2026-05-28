import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type {
  Alert,
  AlertStatus,
  ChangeOrderDraft,
  ChangeOrderRequirement,
  DailyBoardPhoto,
  FieldReport,
  FieldTask,
  LaborEntry,
  OpsProject,
  PhotoRecord,
  ScheduleRevision,
  ScheduleTask,
  TaskStatus,
  Variance,
  VarianceType,
} from "@/lib/ops-types";
import { AUTO_CLEARING_ALERT_TYPES, evaluateAlerts } from "@/lib/rules-engine";

// ---------------------------------------------------------------------------
// Prisma singleton — prevents hot-reload from spawning multiple clients
// ---------------------------------------------------------------------------

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function idFrom(label: string) {
  return label.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

function splitLines(value: FormDataEntryValue | null) {
  return String(value ?? "").split("\n").map((line) => line.trim()).filter(Boolean);
}

function numberFrom(value: FormDataEntryValue | null) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function valueFor(row: string[], header: string[], names: string[]) {
  for (const name of names) {
    const index = header.indexOf(normalizeHeader(name));
    if (index >= 0) return row[index]?.trim() ?? "";
  }
  return "";
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (char === "," && !inQuotes) {
      cells.push(current); current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

// ---------------------------------------------------------------------------
// Type mappers: Prisma result → app types
// ---------------------------------------------------------------------------

const reportInclude = { laborEntries: true, tasks: true, variances: true, photos: true } as const;

function mapReport(r: any): FieldReport {
  return {
    id: r.id, projectId: r.projectId, reportDate: r.reportDate,
    crewMembers: r.crewMembers, submittedBy: r.submittedBy,
    plannedTaskIds: r.plannedTaskIds, blockers: r.blockers,
    tomorrowRecommendations: r.tomorrowRecommendations, createdAt: r.createdAt,
    laborEntries: (r.laborEntries ?? []).map((e: any): LaborEntry => ({
      id: e.id, employeeName: e.employeeName, phaseCode: e.phaseCode,
      hours: e.hours, notes: e.notes ?? undefined,
    })),
    tasks: (r.tasks ?? []).map((t: any): FieldTask => ({
      id: t.id, boardTaskId: t.boardTaskId ?? undefined, phaseCode: t.phaseCode,
      area: t.area, taskName: t.taskName, status: t.status as TaskStatus, note: t.note ?? undefined,
    })),
    variances: (r.variances ?? []).map((v: any): Variance => ({
      id: v.id, type: v.type as VarianceType, description: v.description,
      discoveredBy: v.discoveredBy, discoveredAt: v.discoveredAt, affectedArea: v.affectedArea,
      relatedPhotoIds: v.relatedPhotoIds,
      estimatedLaborImpactHours: v.estimatedLaborImpactHours,
      estimatedMaterialImpactDollars: v.estimatedMaterialImpactDollars,
      estimatedScheduleImpactDays: v.estimatedScheduleImpactDays,
      requiresChangeOrder: v.requiresChangeOrder as ChangeOrderRequirement,
      clientNotified: v.clientNotified, internalNotes: v.internalNotes,
    })),
    photos: (r.photos ?? []).map((p: any): PhotoRecord => ({
      id: p.id, fileName: p.fileName, storageKey: p.storageKey,
      caption: p.caption, relatedVarianceId: p.relatedVarianceId ?? undefined,
    })),
  };
}

// ---------------------------------------------------------------------------
// CSV / form parsing
// ---------------------------------------------------------------------------

function parseScheduleCsv(text: string): Omit<ScheduleTask, "id" | "revisionId" | "projectId">[] {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];
  const header = parseCsvLine(lines[0]).map(normalizeHeader);
  return lines.slice(1).flatMap((line) => {
    const row = parseCsvLine(line);
    if (row.every((c) => !c.trim())) return [];
    return [{
      taskName: valueFor(row, header, ["task_name", "taskname", "materio_task_name", "task"]),
      phaseCode: valueFor(row, header, ["phase_code", "phasecode", "phase"]).toUpperCase(),
      area: valueFor(row, header, ["area"]),
      plannedStart: valueFor(row, header, ["planned_start", "plannedstart", "start", "materio_start"]),
      plannedFinish: valueFor(row, header, ["planned_finish", "plannedfinish", "finish", "end", "materio_end"]),
      owner: valueFor(row, header, ["owner"]),
      dependency: valueFor(row, header, ["dependency", "dependencies"]),
      milestone: valueFor(row, header, ["milestone"]).toLowerCase() === "yes",
      sourceNotes: valueFor(row, header, ["notes", "materio_notes"]) || undefined,
      readinessNote: valueFor(row, header, ["readiness_note", "readinessnote"]) || undefined,
      needsPmFill: valueFor(row, header, ["needs_pm_fill", "needsPmFill"]).toLowerCase() === "yes",
    }];
  });
}

function parseBoardTaskLines(projectId: string, boardDate: string, input: string) {
  return splitLines(input).map((line, index) => {
    const [taskName = "", phaseCode = "GEN", area = "", owner = "", hoursStr = "0", readinessDependency = ""] =
      line.split(",").map((p) => p.trim());
    return {
      id: `board-${projectId}-${boardDate}-${Date.now()}-${index}`,
      projectId, boardDate,
      phaseCode: phaseCode.toUpperCase(),
      area, taskName, owner,
      plannedHours: Number(hoursStr) || 0,
      readinessDependency: readinessDependency || null,
    };
  });
}

// ---------------------------------------------------------------------------
// Data access
// ---------------------------------------------------------------------------

export async function listOpsProjects(): Promise<OpsProject[]> {
  return prisma.project.findMany({ orderBy: { name: "asc" } }) as Promise<OpsProject[]>;
}

export async function getOpsProject(projectId: string): Promise<OpsProject | null> {
  return prisma.project.findUnique({ where: { id: projectId } }) as Promise<OpsProject | null>;
}

export async function getDailyBoard(projectId: string) {
  const tasks = await prisma.dailyBoardTask.findMany({ where: { projectId }, orderBy: { boardDate: "desc" } });
  if (!tasks.length) return [];
  const latestDate = tasks[0].boardDate;
  return tasks.filter((t) => t.boardDate === latestDate);
}

export async function listDailyBoardPhotos(projectId: string): Promise<DailyBoardPhoto[]> {
  return prisma.dailyBoardPhoto.findMany({ where: { projectId }, orderBy: { boardDate: "desc" } }) as Promise<DailyBoardPhoto[]>;
}

export async function listProjectScheduleRevisions(projectId: string): Promise<ScheduleRevision[]> {
  return prisma.scheduleRevision.findMany({ where: { projectId }, orderBy: { revisionNo: "desc" } }) as Promise<ScheduleRevision[]>;
}

export async function listProjectScheduleTasks(projectId: string, revisionId?: string): Promise<ScheduleTask[]> {
  if (revisionId) return prisma.scheduleTask.findMany({ where: { revisionId } }) as Promise<ScheduleTask[]>;
  const active = await prisma.scheduleRevision.findFirst({ where: { projectId, isActive: true } });
  if (!active) return [];
  return prisma.scheduleTask.findMany({ where: { revisionId: active.id } }) as Promise<ScheduleTask[]>;
}

export async function getBaselineScheduleTasks(projectId: string): Promise<ScheduleTask[]> {
  const baseline = await prisma.scheduleRevision.findFirst({ where: { projectId, isBaseline: true } });
  if (!baseline) return [];
  return prisma.scheduleTask.findMany({ where: { revisionId: baseline.id } }) as Promise<ScheduleTask[]>;
}

export async function listProjectReports(projectId: string): Promise<FieldReport[]> {
  const reports = await prisma.fieldReport.findMany({
    where: { projectId }, include: reportInclude, orderBy: { reportDate: "desc" },
  });
  return reports.map(mapReport);
}

export async function getFieldReport(projectId: string, reportId: string): Promise<FieldReport | null> {
  const report = await prisma.fieldReport.findFirst({ where: { id: reportId, projectId }, include: reportInclude });
  return report ? mapReport(report) : null;
}

export async function listProjectChangeOrders(projectId: string): Promise<ChangeOrderDraft[]> {
  return prisma.changeOrderDraft.findMany({ where: { projectId }, orderBy: { createdAt: "desc" } }) as Promise<ChangeOrderDraft[]>;
}

export async function getChangeOrder(projectId: string, changeOrderId: string): Promise<ChangeOrderDraft | null> {
  return prisma.changeOrderDraft.findFirst({ where: { id: changeOrderId, projectId } }) as Promise<ChangeOrderDraft | null>;
}

export async function listProjectAlerts(projectId: string): Promise<Alert[]> {
  return prisma.alert.findMany({
    where: { projectId }, orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  }) as Promise<Alert[]>;
}

export async function listOpenAlerts(): Promise<Alert[]> {
  return prisma.alert.findMany({
    where: { status: { not: "RESOLVED" } }, orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
  }) as Promise<Alert[]>;
}

// ---------------------------------------------------------------------------
// Server actions
// ---------------------------------------------------------------------------

export async function updateChangeOrderAction(coId: string, formData: FormData) {
  "use server";
  const draft = await prisma.changeOrderDraft.findUnique({ where: { id: coId } });
  if (!draft) throw new Error("CO draft not found.");

  const action = String(formData.get("_action") || "save");
  const now = new Date().toISOString();

  await prisma.changeOrderDraft.update({
    where: { id: coId },
    data: {
      coNumber: String(formData.get("coNumber") || draft.coNumber),
      title: String(formData.get("title") || draft.title),
      aiSummary: String(formData.get("description") || draft.aiSummary),
      estimatedLaborHours: numberFrom(formData.get("laborHours")),
      laborRateDollars: numberFrom(formData.get("laborRate")),
      estimatedMaterialDollars: numberFrom(formData.get("materialDollars")),
      estimatedScheduleDays: numberFrom(formData.get("scheduleDays")),
      reviewStatus: action === "approve" ? "approved" : action === "reject" ? "rejected" : "pm_review_required",
      approvedBy: action === "approve" ? String(formData.get("approvedBy") || "") : (draft.approvedBy ?? null),
      approvedAt: action === "approve" ? now : (draft.approvedAt ?? null),
    },
  });

  revalidatePath(`/projects/${draft.projectId}`);
  revalidatePath(`/projects/${draft.projectId}/change-orders/${coId}`);
}

export async function acknowledgeAlertAction(alertId: string) {
  "use server";
  await prisma.alert.update({ where: { id: alertId }, data: { status: "ACKNOWLEDGED" } });
  revalidatePath("/"); revalidatePath("/projects");
}

export async function resolveAlertAction(alertId: string) {
  "use server";
  await prisma.alert.update({ where: { id: alertId }, data: { status: "RESOLVED", resolvedAt: new Date().toISOString() } });
  revalidatePath("/"); revalidatePath("/projects");
}

export async function createProjectAction(formData: FormData) {
  "use server";
  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("Project name is required.");
  const id = idFrom(name);
  await prisma.project.create({
    data: {
      id, name,
      clientName: String(formData.get("clientName") || ""),
      address: String(formData.get("address") || ""),
      status: String(formData.get("status") || "precon") as any,
      currentPhase: String(formData.get("currentPhase") || ""),
      plannedStartDate: String(formData.get("plannedStartDate") || "") || null,
      plannedEndDate: String(formData.get("plannedEndDate") || ""),
      projectManager: String(formData.get("projectManager") || "") || null,
      fieldLead: String(formData.get("fieldLead") || "") || null,
    },
  });
  revalidatePath("/projects");
  redirect(`/projects/${id}/schedule`);
}

export async function saveProjectScheduleAction(projectId: string, formData: FormData) {
  "use server";
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error("Project not found.");

  const csvText = String(formData.get("scheduleImportText") || "");
  const scheduleFile = formData.get("scheduleFile") as File | null;
  const fileName = scheduleFile?.size ? scheduleFile.name : null;
  const revisionReason = String(formData.get("revisionReason") || "");
  const parsedTasks = parseScheduleCsv(csvText);

  const lastRevision = await prisma.scheduleRevision.findFirst({ where: { projectId }, orderBy: { revisionNo: "desc" } });
  const revisionNo = (lastRevision?.revisionNo ?? 0) + 1;
  const isBaseline = revisionNo === 1;
  const revisionId = `rev-${projectId}-${revisionNo}`;

  await prisma.scheduleRevision.updateMany({ where: { projectId }, data: { isActive: false } });
  await prisma.scheduleRevision.create({
    data: {
      id: revisionId, projectId, revisionNo, isBaseline, isActive: true,
      importedAt: new Date().toISOString(),
      importedFrom: fileName || csvText ? "csv" : "manual",
      fileName, taskCount: parsedTasks.length,
      reason: revisionReason || (isBaseline ? "Baseline schedule" : null),
    },
  });

  const ts = Date.now();
  if (parsedTasks.length) {
    await prisma.scheduleTask.createMany({
      data: parsedTasks.map((task, i) => ({
        id: `task-${revisionId}-${ts}-${i}`, revisionId, projectId,
        ...task, sourceNotes: task.sourceNotes ?? null, readinessNote: task.readinessNote ?? null,
      })),
    });
  }

  const boardDate = String(formData.get("boardDate") || new Date().toISOString().slice(0, 10));
  const boardTaskText = String(formData.get("boardTaskText") || "");
  if (boardTaskText) {
    await prisma.dailyBoardTask.deleteMany({ where: { projectId, boardDate } });
    await prisma.dailyBoardTask.createMany({ data: parseBoardTaskLines(projectId, boardDate, boardTaskText) });
  }

  revalidatePath(`/projects/${projectId}/schedule`);
  revalidatePath(`/projects/${projectId}/board`);
  redirect(`/projects/${projectId}/schedule`);
}

export async function setActiveRevisionAction(projectId: string, revisionId: string) {
  "use server";
  await prisma.scheduleRevision.updateMany({ where: { projectId }, data: { isActive: false } });
  await prisma.scheduleRevision.update({ where: { id: revisionId }, data: { isActive: true } });
  revalidatePath(`/projects/${projectId}/schedule`);
}

export async function updateProjectScheduleTasksAction(projectId: string, formData: FormData) {
  "use server";
  const taskIds = formData.getAll("taskId").map(String);
  const phaseCodes = formData.getAll("phaseCode").map(String);
  const areas = formData.getAll("area").map(String);
  const owners = formData.getAll("owner").map(String);
  const dependencies = formData.getAll("dependency").map(String);
  const readinessNotes = formData.getAll("readinessNote").map(String);
  const milestoneIds = new Set(formData.getAll("milestoneTaskId").map(String));
  const needsPmFillIds = new Set(formData.getAll("needsPmFillTaskId").map(String));

  for (let i = 0; i < taskIds.length; i++) {
    const id = taskIds[i];
    await prisma.scheduleTask.update({
      where: { id },
      data: {
        phaseCode: phaseCodes[i] ?? "", area: areas[i] ?? "",
        owner: owners[i] ?? "", dependency: dependencies[i] ?? "",
        readinessNote: readinessNotes[i] ?? null,
        milestone: milestoneIds.has(id), needsPmFill: needsPmFillIds.has(id),
      },
    });
  }
  revalidatePath(`/projects/${projectId}/schedule`);
  redirect(`/projects/${projectId}/board`);
}

export async function createFieldReportAction(projectId: string, formData: FormData) {
  "use server";
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error("Project not found.");

  const ts = Date.now();
  const reportDate = String(formData.get("reportDate") || new Date().toISOString().slice(0, 10));
  const reportId = `report-${projectId}-${reportDate}-${ts}`;

  // Labor
  const laborEmployees = formData.getAll("laborEmployee").map(String);
  const laborEntries = laborEmployees.length
    ? laborEmployees.flatMap((name, i) => {
        const hours = numberFrom(formData.getAll("laborHours")[i] ?? null);
        if (!name.trim() || hours <= 0) return [];
        return [{ id: `labor-${ts}-${i}`, fieldReportId: reportId, employeeName: name.trim(), hours, phaseCode: String(formData.getAll("laborPhase")[i] || "GEN"), notes: String(formData.getAll("laborNotes")[i] || "") || null }];
      })
    : splitLines(formData.get("laborEntries")).map((line, i) => {
        const [emp = "Unknown", hrs = "0", phase = "GEN", notes = ""] = line.split(",").map((p) => p.trim());
        return { id: `labor-${ts}-${i}`, fieldReportId: reportId, employeeName: emp, hours: Number(hrs) || 0, phaseCode: phase, notes: notes || null };
      });

  // Tasks
  const completedIds = formData.getAll("completedTaskIds").map(String).filter(Boolean);
  const incompleteIds = formData.getAll("incompleteTaskIds").map(String).filter(Boolean);
  let fieldTasks: any[] = [];
  if (completedIds.length || incompleteIds.length) {
    const bts = await prisma.dailyBoardTask.findMany({ where: { projectId, id: { in: [...completedIds, ...incompleteIds] } } });
    const btMap = new Map(bts.map((t) => [t.id, t]));
    fieldTasks = [
      ...completedIds.map((id, i) => { const bt = btMap.get(id); return { id: `completed-${ts}-${i}`, fieldReportId: reportId, boardTaskId: id, phaseCode: bt?.phaseCode ?? "GEN", area: bt?.area ?? "", taskName: bt?.taskName ?? id, status: "completed", note: null }; }),
      ...incompleteIds.map((id, i) => { const bt = btMap.get(id); return { id: `incomplete-${ts}-${i}`, fieldReportId: reportId, boardTaskId: id, phaseCode: bt?.phaseCode ?? "GEN", area: bt?.area ?? "", taskName: bt?.taskName ?? id, status: "incomplete", note: null }; }),
    ];
  }

  // Variance
  const varianceDescription = String(formData.get("varianceDescription") || "").trim();
  const varianceId = `variance-${ts}`;
  const variance = varianceDescription ? {
    id: varianceId, fieldReportId: reportId,
    type: String(formData.get("varianceType") || "schedule") as any,
    description: varianceDescription,
    discoveredBy: String(formData.get("discoveredBy") || formData.get("submittedBy") || ""),
    discoveredAt: String(formData.get("discoveredAt") || new Date().toISOString()),
    affectedArea: String(formData.get("affectedArea") || ""),
    relatedPhotoIds: [],
    estimatedLaborImpactHours: numberFrom(formData.get("laborImpactHours")),
    estimatedMaterialImpactDollars: numberFrom(formData.get("materialImpact")),
    estimatedScheduleImpactDays: numberFrom(formData.get("scheduleImpactDays")),
    requiresChangeOrder: String(formData.get("requiresChangeOrder") || "unknown") as any,
    clientNotified: formData.get("clientNotified") === "on",
    internalNotes: String(formData.get("internalNotes") || ""),
  } : null;

  // Photos (metadata only — actual file upload via Supabase Storage to be added)
  const photos: any[] = [];
  const uploaded = formData.getAll("photos").filter((e): e is File => e instanceof File && e.size > 0);
  const captions = splitLines(formData.get("photoCaptions"));
  uploaded.forEach((file, i) => photos.push({ id: `photo-${ts}-${i}`, fieldReportId: reportId, fileName: file.name, storageKey: `${projectId}/${reportId}/${file.name}`, caption: captions[i] ?? "", relatedVarianceId: null }));

  // Write report + related records
  await prisma.$transaction(async (tx) => {
    await tx.fieldReport.create({
      data: {
        id: reportId, projectId, reportDate,
        submittedBy: String(formData.get("submittedBy") || ""),
        crewMembers: splitLines(formData.get("crewMembers")).flatMap((s) => s.split(",").map((n) => n.trim())).filter(Boolean),
        plannedTaskIds: formData.getAll("plannedTaskIds").map(String),
        blockers: splitLines(formData.get("blockers")),
        tomorrowRecommendations: String(formData.get("tomorrowRecommendations") || ""),
        createdAt: new Date().toISOString(),
      },
    });
    if (laborEntries.length) await tx.laborEntry.createMany({ data: laborEntries });
    if (fieldTasks.length) await tx.fieldTask.createMany({ data: fieldTasks });
    if (variance) await tx.variance.create({ data: variance });
    if (photos.length) await tx.photoRecord.createMany({ data: photos });
  });

  // Rules engine
  const activeRevision = await prisma.scheduleRevision.findFirst({ where: { projectId, isActive: true } });
  const scheduleTasks = await prisma.scheduleTask.findMany({ where: activeRevision ? { revisionId: activeRevision.id } : { projectId } });
  const recentReports = await prisma.fieldReport.findMany({ where: { projectId, id: { not: reportId } }, include: reportInclude, orderBy: { reportDate: "desc" }, take: 5 });
  const currentReport = await prisma.fieldReport.findUnique({ where: { id: reportId }, include: reportInclude });

  if (currentReport) {
    const { created: newAlerts, cleared } = evaluateAlerts({
      project: project as any, scheduleTasks: scheduleTasks as any,
      recentReports: recentReports.map(mapReport), report: mapReport(currentReport),
    });
    if (cleared.length) {
      await prisma.alert.updateMany({ where: { projectId, alertType: { in: cleared as any }, status: { not: "RESOLVED" } }, data: { status: "RESOLVED", resolvedAt: new Date().toISOString() } });
    }
    if (newAlerts.length) {
      await prisma.alert.createMany({ data: newAlerts.map((a) => ({ id: a.id, projectId: a.projectId, fieldReportId: a.fieldReportId ?? null, alertType: a.alertType as any, severity: a.severity as any, status: a.status as any, title: a.title, detail: a.detail, actionRequired: a.actionRequired, createdAt: a.createdAt, resolvedAt: null })) });
    }
  }

  // Change order draft
  if (variance?.requiresChangeOrder === "yes") {
    await prisma.changeOrderDraft.create({
      data: {
        id: `co-${ts}`, projectId, fieldReportId: reportId, varianceId,
        title: `Change order — ${variance.affectedArea || variance.type}`,
        aiSummary: `${variance.description} Estimated impact: ${variance.estimatedLaborImpactHours}h labor, $${variance.estimatedMaterialImpactDollars} materials, ${variance.estimatedScheduleImpactDays} schedule days. PM review required before any client communication.`,
        estimatedLaborHours: variance.estimatedLaborImpactHours,
        estimatedMaterialDollars: variance.estimatedMaterialImpactDollars,
        estimatedScheduleDays: variance.estimatedScheduleImpactDays,
        reviewStatus: "pm_review_required", createdAt: new Date().toISOString(),
      },
    });
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/board`);
  revalidatePath("/");
  redirect(`/projects/${projectId}/reports/${reportId}`);
}

export async function saveTodayBoardAction(projectId: string, formData: FormData) {
  "use server";
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error("Project not found.");

  const boardDate = String(formData.get("boardDate") || new Date().toISOString().slice(0, 10));
  const boardTaskText = String(formData.get("boardTaskText") || "");
  const boardNotes = String(formData.get("boardNotes") || "");

  await prisma.dailyBoardTask.deleteMany({ where: { projectId, boardDate } });
  if (boardTaskText) {
    await prisma.dailyBoardTask.createMany({ data: parseBoardTaskLines(projectId, boardDate, boardTaskText) });
  }

  const boardPhoto = formData.get("boardPhoto") as File | null;
  if (boardPhoto && boardPhoto.size > 0) {
    await prisma.dailyBoardPhoto.deleteMany({ where: { projectId, boardDate } });
    await prisma.dailyBoardPhoto.create({
      data: {
        id: `bphoto-${projectId}-${boardDate}-${Date.now()}`, projectId, boardDate,
        fileName: boardPhoto.name, storageKey: `board/${projectId}/${boardDate}/${boardPhoto.name}`,
        notes: boardNotes || null, uploadedAt: new Date().toISOString(),
      },
    });
  }

  revalidatePath(`/projects/${projectId}/board`);
  revalidatePath(`/projects/${projectId}/field-report/new`);
  redirect(`/projects/${projectId}/board`);
}
