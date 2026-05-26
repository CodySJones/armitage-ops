import { promises as fs } from "fs";
import path from "path";
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
  OpsState,
  PhotoRecord,
  ScheduleRevision,
  ScheduleTask,
  TaskStatus,
  Variance,
  VarianceType,
} from "@/lib/ops-types";
import { AUTO_CLEARING_ALERT_TYPES, evaluateAlerts } from "@/lib/rules-engine";

const storageDir = path.join(process.cwd(), "storage");
const opsFile = path.join(storageDir, "ops.json");
const photoDir = path.join(storageDir, "ops-photos");
const boardPhotoDir = path.join(storageDir, "board-photos");

const seedState: OpsState = {
  projects: [],
  scheduleRevisions: [],
  scheduleTasks: [],
  dailyBoards: [],
  dailyBoardPhotos: [],
  fieldReports: [],
  changeOrderDrafts: [],
  alerts: [],
};

async function ensureOpsStorage() {
  await fs.mkdir(photoDir, { recursive: true });
  await fs.mkdir(boardPhotoDir, { recursive: true });
  try {
    await fs.access(opsFile);
  } catch {
    await fs.writeFile(opsFile, `${JSON.stringify(seedState, null, 2)}\n`, "utf8");
  }
}

function migrateScheduleRevisions(state: OpsState): OpsState {
  type LegacyTask = ScheduleTask & { revisionId?: string };
  const untagged = (state.scheduleTasks as LegacyTask[]).filter((t) => !t.revisionId);
  if (!untagged.length) return state;

  const byProject = new Map<string, LegacyTask[]>();
  for (const task of untagged) {
    const bucket = byProject.get(task.projectId) ?? [];
    bucket.push(task);
    byProject.set(task.projectId, bucket);
  }

  const newRevisions: ScheduleRevision[] = [];
  const updatedTasks = state.scheduleTasks.map((t) => ({ ...t })) as LegacyTask[];

  for (const [projectId, tasks] of byProject) {
    const existing = state.scheduleRevisions.find((r) => r.projectId === projectId && r.isBaseline);
    const revId = existing?.id ?? `rev-${projectId}-1`;

    if (!existing) {
      const project = state.projects.find((p) => p.id === projectId);
      newRevisions.push({
        id: revId,
        projectId,
        revisionNo: 1,
        isBaseline: true,
        isActive: true,
        importedAt: project?.scheduleImportedAt ?? new Date().toISOString(),
        importedFrom: (project?.scheduleSource as ScheduleRevision["importedFrom"]) ?? "manual",
        fileName: project?.scheduleFileName,
        reason: "Baseline schedule",
        taskCount: tasks.length,
      });
    }

    for (const task of tasks) {
      const idx = updatedTasks.findIndex((t) => t.id === task.id);
      if (idx >= 0) updatedTasks[idx] = { ...updatedTasks[idx], revisionId: revId };
    }
  }

  return {
    ...state,
    scheduleRevisions: [...state.scheduleRevisions, ...newRevisions],
    scheduleTasks: updatedTasks as ScheduleTask[],
  };
}

async function readState(): Promise<OpsState> {
  await ensureOpsStorage();
  const stored = JSON.parse(await fs.readFile(opsFile, "utf8")) as Partial<OpsState>;
  const raw: OpsState = {
    projects: stored.projects ?? [],
    scheduleRevisions: stored.scheduleRevisions ?? [],
    scheduleTasks: stored.scheduleTasks ?? [],
    dailyBoards: stored.dailyBoards ?? [],
    dailyBoardPhotos: stored.dailyBoardPhotos ?? [],
    fieldReports: stored.fieldReports ?? [],
    changeOrderDrafts: stored.changeOrderDrafts ?? [],
    alerts: stored.alerts ?? [],
  };
  return migrateScheduleRevisions(raw);
}

async function writeState(state: OpsState) {
  await ensureOpsStorage();
  await fs.writeFile(opsFile, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

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
    if (index >= 0) {
      return row[index]?.trim() ?? "";
    }
  }

  return "";
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;

  for (const char of line) {
    if (char === "\"") {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += char;
    }
  }

  cells.push(cell.trim());
  return cells;
}

function parseScheduleCsv(projectId: string, input: string): Omit<ScheduleTask, "revisionId">[] {
  const rows = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseCsvLine);

  if (rows.length < 2) {
    return [];
  }

  const header = rows[0].map(normalizeHeader);
  return rows.slice(1).map((row, index) => {
    const taskName =
      valueFor(row, header, ["task name", "task", "name", "title", "description", "materio task name", "materio_task_name"]) ||
      valueFor(row, header, ["phase"]) ||
      `Task ${index + 1}`;

    return {
      id: `schedule-${projectId}-${Date.now()}-${index}`,
      projectId,
      taskName,
      phaseCode: valueFor(row, header, ["phase code", "phase_code", "phasecode", "ops phase", "ops_phase"]) || "GEN",
      area: valueFor(row, header, ["area", "room", "location"]),
      plannedStart: valueFor(row, header, ["planned start", "planned_start", "start", "start date", "materio start", "materio_start"]),
      plannedFinish: valueFor(row, header, ["planned finish", "planned_finish", "finish", "finish date", "end date", "end", "materio end", "materio_end"]),
      owner: valueFor(row, header, ["owner", "trade", "crew", "responsible", "assigned to", "assignee"]) || "Unassigned",
      dependency: valueFor(row, header, ["dependency", "dependencies", "predecessor", "predecessors"]),
      milestone: ["yes", "true", "1", "milestone"].includes(valueFor(row, header, ["milestone"]).toLowerCase()),
      sourceNotes: valueFor(row, header, ["notes", "note", "materio notes", "materio_notes"]),
      readinessNote: valueFor(row, header, ["readiness note", "readiness_note"]),
      needsPmFill: ["yes", "true", "1"].includes(valueFor(row, header, ["needs pm fill", "needs_pm_fill"]).toLowerCase()),
    };
  });
}

function parseBoardTasks(projectId: string, boardDate: string, input: string) {
  return splitLines(input).map((line, index) => {
    const [taskName = "", phaseCode = "GEN", area = "", owner = "Unassigned", plannedHours = "0", readinessDependency = ""] = line
      .split(",")
      .map((part) => part.trim());

    return {
      id: `board-${projectId}-${Date.now()}-${index}`,
      projectId,
      boardDate,
      phaseCode,
      area,
      taskName,
      owner,
      plannedHours: Number(plannedHours) || 0,
      readinessDependency,
    };
  }).filter((task) => task.taskName);
}

async function saveBoardPhoto(projectId: string, boardDate: string, formData: FormData): Promise<DailyBoardPhoto | null> {
  const file = formData.get("boardPhoto");

  if (!(file instanceof File) || file.size === 0) {
    return null;
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const storageKey = `${projectId}-${boardDate}-${Date.now()}-${safeName}`;
  await fs.writeFile(path.join(boardPhotoDir, storageKey), Buffer.from(await file.arrayBuffer()));

  return {
    id: `board-photo-${projectId}-${Date.now()}`,
    projectId,
    boardDate,
    fileName: file.name,
    storageKey,
    notes: String(formData.get("boardNotes") || ""),
    uploadedAt: new Date().toISOString(),
  };
}

async function applyBoardCapture(state: OpsState, projectId: string, formData: FormData) {
  const boardDate = String(formData.get("boardDate") || new Date().toISOString().slice(0, 10));
  const uploadedPhoto = await saveBoardPhoto(projectId, boardDate, formData);
  const manualTasks = parseBoardTasks(projectId, boardDate, String(formData.get("boardTaskText") || ""));

  if (uploadedPhoto) {
    state.dailyBoardPhotos = [
      uploadedPhoto,
      ...state.dailyBoardPhotos.filter((photo) => !(photo.projectId === projectId && photo.boardDate === boardDate)),
    ];
  }

  if (manualTasks.length > 0) {
    state.dailyBoards = [
      ...state.dailyBoards.filter((task) => !(task.projectId === projectId && task.boardDate === boardDate)),
      ...manualTasks,
    ];
  }

  return { boardDate, manualTasks };
}

export async function listOpsProjects() {
  return (await readState()).projects;
}

export async function getOpsProject(projectId: string) {
  return (await readState()).projects.find((project) => project.id === projectId) ?? null;
}

export async function getDailyBoard(projectId: string) {
  const tasks = (await readState()).dailyBoards.filter((task) => task.projectId === projectId);
  if (!tasks.length) return [];
  const latestDate = tasks.reduce((max, t) => (t.boardDate > max ? t.boardDate : max), tasks[0].boardDate);
  return tasks.filter((t) => t.boardDate === latestDate);
}

export async function listDailyBoardPhotos(projectId: string) {
  return (await readState()).dailyBoardPhotos
    .filter((photo) => photo.projectId === projectId)
    .sort((a, b) => b.boardDate.localeCompare(a.boardDate));
}

export async function listProjectScheduleRevisions(projectId: string): Promise<ScheduleRevision[]> {
  return (await readState()).scheduleRevisions
    .filter((r) => r.projectId === projectId)
    .sort((a, b) => b.revisionNo - a.revisionNo);
}

export async function listProjectScheduleTasks(projectId: string, revisionId?: string): Promise<ScheduleTask[]> {
  const state = await readState();
  if (revisionId) {
    return state.scheduleTasks.filter((t) => t.revisionId === revisionId);
  }
  const active = state.scheduleRevisions.find((r) => r.projectId === projectId && r.isActive);
  if (active) {
    return state.scheduleTasks.filter((t) => t.revisionId === active.id);
  }
  return state.scheduleTasks.filter((t) => t.projectId === projectId);
}

export async function getBaselineScheduleTasks(projectId: string): Promise<ScheduleTask[]> {
  const state = await readState();
  const baseline = state.scheduleRevisions.find((r) => r.projectId === projectId && r.isBaseline);
  if (!baseline) return [];
  return state.scheduleTasks.filter((t) => t.revisionId === baseline.id);
}

export async function listProjectReports(projectId: string) {
  return (await readState()).fieldReports
    .filter((report) => report.projectId === projectId)
    .sort((a, b) => b.reportDate.localeCompare(a.reportDate));
}

export async function getFieldReport(projectId: string, reportId: string) {
  return (await readState()).fieldReports.find((report) => report.projectId === projectId && report.id === reportId) ?? null;
}

export async function listProjectChangeOrders(projectId: string) {
  return (await readState()).changeOrderDrafts.filter((draft) => draft.projectId === projectId);
}

export async function getChangeOrder(projectId: string, changeOrderId: string) {
  return (await readState()).changeOrderDrafts.find((draft) => draft.projectId === projectId && draft.id === changeOrderId) ?? null;
}

export async function listProjectAlerts(projectId: string): Promise<Alert[]> {
  return (await readState()).alerts
    .filter((a) => a.projectId === projectId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listOpenAlerts(): Promise<Alert[]> {
  return (await readState()).alerts
    .filter((a) => a.status === "OPEN")
    .sort((a, b) => {
      const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      return (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4);
    });
}

export async function acknowledgeAlertAction(alertId: string) {
  "use server";
  const state = await readState();
  state.alerts = state.alerts.map((a) =>
    a.id === alertId && a.status === "OPEN" ? { ...a, status: "ACKNOWLEDGED" as AlertStatus } : a,
  );
  await writeState(state);
  revalidatePath("/");
  revalidatePath("/projects");
}

export async function resolveAlertAction(alertId: string) {
  "use server";
  const state = await readState();
  state.alerts = state.alerts.map((a) =>
    a.id === alertId && a.status !== "RESOLVED"
      ? { ...a, status: "RESOLVED" as AlertStatus, resolvedAt: new Date().toISOString() }
      : a,
  );
  await writeState(state);
  revalidatePath("/");
  revalidatePath("/projects");
}

function summarizeVariance(variance: Variance) {
  return [
    variance.description,
    `Affected area: ${variance.affectedArea}.`,
    `Estimated impact: ${variance.estimatedLaborImpactHours} labor hours, $${variance.estimatedMaterialImpactDollars} materials, ${variance.estimatedScheduleImpactDays} schedule days.`,
    "PM review is required before any client-facing change order is sent.",
  ].join(" ");
}

export async function createFieldReportAction(projectId: string, formData: FormData) {
  "use server";
  const state = await readState();
  const project = state.projects.find((candidate) => candidate.id === projectId);
  if (!project) throw new Error("Project not found.");

  const timestamp = Date.now();
  const reportDate = String(formData.get("reportDate") || new Date().toISOString().slice(0, 10));
  const reportId = `report-${projectId}-${reportDate}-${timestamp}`;
  const laborEmployees = formData.getAll("laborEmployee").map(String);
  const laborEntries: LaborEntry[] = laborEmployees.length
    ? laborEmployees
        .map((employeeName, index) => ({
          id: `labor-${timestamp}-${index}`,
          employeeName: employeeName.trim(),
          hours: numberFrom(formData.getAll("laborHours")[index] ?? null),
          phaseCode: String(formData.getAll("laborPhase")[index] || "GEN"),
          notes: String(formData.getAll("laborNotes")[index] || ""),
        }))
        .filter((entry) => entry.employeeName && entry.hours > 0)
    : splitLines(formData.get("laborEntries")).map((line, index) => {
    const [employeeName = "Unknown", hours = "0", phaseCode = "GEN", notes = ""] = line.split(",").map((part) => part.trim());
    return { id: `labor-${timestamp}-${index}`, employeeName, hours: Number(hours) || 0, phaseCode, notes };
  });

  const boardTaskById = new Map(state.dailyBoards.filter((task) => task.projectId === projectId).map((task) => [task.id, task]));
  const completedIds = formData.getAll("completedTaskIds").map(String);
  const incompleteIds = formData.getAll("incompleteTaskIds").map(String);
  const tasksFromIds = (ids: string[], status: TaskStatus, prefix: string) =>
    ids.map((id, index) => {
      const boardTask = boardTaskById.get(id);
      return {
        id: `${prefix}-${timestamp}-${index}`,
        boardTaskId: id,
        phaseCode: boardTask?.phaseCode || "GEN",
        area: boardTask?.area || "",
        taskName: boardTask?.taskName || id,
        status,
      };
    });
  const tasks: FieldTask[] = completedIds.length || incompleteIds.length
    ? [...tasksFromIds(completedIds, "completed", "completed"), ...tasksFromIds(incompleteIds, "incomplete", "incomplete")]
    : [
        ...splitLines(formData.get("completedTasks")).map((taskName, index) => ({
          id: `completed-${timestamp}-${index}`,
          phaseCode: String(formData.get("defaultPhase") || "GEN"),
          area: String(formData.get("defaultArea") || ""),
          taskName,
          status: "completed" as TaskStatus,
        })),
        ...splitLines(formData.get("incompleteTasks")).map((taskName, index) => ({
          id: `incomplete-${timestamp}-${index}`,
          phaseCode: String(formData.get("defaultPhase") || "GEN"),
          area: String(formData.get("defaultArea") || ""),
          taskName,
          status: "incomplete" as TaskStatus,
        })),
      ];

  const variance: Variance | null = String(formData.get("varianceDescription") || "").trim()
    ? {
        id: `variance-${timestamp}`,
        type: String(formData.get("varianceType") || "schedule") as VarianceType,
        description: String(formData.get("varianceDescription") || ""),
        discoveredBy: String(formData.get("discoveredBy") || formData.get("submittedBy") || ""),
        discoveredAt: String(formData.get("discoveredAt") || new Date().toISOString()),
        affectedArea: String(formData.get("affectedArea") || ""),
        relatedPhotoIds: [],
        estimatedLaborImpactHours: numberFrom(formData.get("laborImpactHours") || formData.get("laborImpact")),
        estimatedMaterialImpactDollars: numberFrom(formData.get("materialImpact")),
        estimatedScheduleImpactDays: numberFrom(formData.get("scheduleImpactDays") || formData.get("scheduleImpact")),
        requiresChangeOrder: String(formData.get("requiresChangeOrder") || "unknown") as ChangeOrderRequirement,
        clientNotified: formData.get("clientNotified") === "on",
        internalNotes: String(formData.get("internalNotes") || ""),
      }
    : null;

  const photos: PhotoRecord[] = [];
  const uploaded = formData.getAll("photos").filter((entry): entry is File => entry instanceof File && entry.size > 0);
  const captions = splitLines(formData.get("photoCaptions"));
  for (const [index, file] of uploaded.entries()) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const storageKey = `${reportId}-${index}-${safeName}`;
    await fs.writeFile(path.join(photoDir, storageKey), Buffer.from(await file.arrayBuffer()));
    const photoId = `photo-${timestamp}-${index}`;
    photos.push({ id: photoId, fileName: file.name, storageKey, caption: captions[index] || String(formData.get("photoCaption") || ""), relatedVarianceId: variance?.id });
    variance?.relatedPhotoIds.push(photoId);
  }

  const report: FieldReport = {
    id: reportId,
    projectId,
    reportDate,
    crewMembers: String(formData.get("crewMembers") || "").split(",").map((member) => member.trim()).filter(Boolean),
    submittedBy: String(formData.get("submittedBy") || ""),
    laborEntries,
    plannedTaskIds: formData.getAll("plannedTaskIds").map(String),
    tasks,
    blockers: splitLines(formData.get("blockers")),
    variances: variance ? [variance] : [],
    photos,
    tomorrowRecommendations: String(formData.get("tomorrowRecommendations") || ""),
    createdAt: new Date().toISOString(),
  };

  state.fieldReports.unshift(report);

  const recentReports = state.fieldReports
    .filter((r) => r.projectId === projectId && r.id !== reportId)
    .slice(0, 10);
  const activeRevision = state.scheduleRevisions.find((r) => r.projectId === projectId && r.isActive);
  const scheduleTasks = state.scheduleTasks.filter((t) =>
    activeRevision ? t.revisionId === activeRevision.id : t.projectId === projectId,
  );
  const { created: newAlerts, cleared } = evaluateAlerts({ project, scheduleTasks, recentReports, report });

  // Resolve auto-clearing alert types whose condition no longer fires.
  state.alerts = state.alerts.map((a) => {
    if (a.projectId === projectId && a.status === "OPEN" && cleared.includes(a.alertType)) {
      return { ...a, status: "RESOLVED" as AlertStatus, resolvedAt: new Date().toISOString() };
    }
    return a;
  });
  state.alerts.push(...newAlerts);

  if (variance?.requiresChangeOrder === "yes") {
    const draft: ChangeOrderDraft = {
      id: `co-${timestamp}`,
      projectId,
      fieldReportId: reportId,
      varianceId: variance.id,
      title: `${project.name}: ${variance.affectedArea || variance.type} variance`,
      aiSummary: summarizeVariance(variance),
      estimatedLaborHours: variance.estimatedLaborImpactHours,
      estimatedMaterialDollars: variance.estimatedMaterialImpactDollars,
      estimatedScheduleDays: variance.estimatedScheduleImpactDays,
      reviewStatus: "pm_review_required",
      createdAt: new Date().toISOString(),
    };
    state.changeOrderDrafts.unshift(draft);
  }

  await writeState(state);
  revalidatePath("/");
  revalidatePath(`/projects/${projectId}/board`);
  redirect(`/projects/${projectId}/reports/${reportId}`);
}

export async function createProjectAction(formData: FormData) {
  "use server";
  const state = await readState();
  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("Project name is required.");

  const baseId = idFrom(name);
  let id = baseId;
  let suffix = 2;
  while (state.projects.some((project) => project.id === id)) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }

  const project: OpsProject = {
    id,
    name,
    clientName: String(formData.get("clientName") || ""),
    address: String(formData.get("address") || ""),
    status: "active",
    currentPhase: String(formData.get("currentPhase") || ""),
    plannedStartDate: String(formData.get("plannedStartDate") || ""),
    plannedEndDate: String(formData.get("plannedEndDate") || ""),
    projectManager: String(formData.get("projectManager") || ""),
    fieldLead: String(formData.get("fieldLead") || ""),
    scheduleSource: "manual",
  };
  state.projects.push(project);
  await writeState(state);
  revalidatePath("/");
  revalidatePath("/projects");
  redirect(`/projects/${id}/schedule`);
}

export async function saveProjectScheduleAction(projectId: string, formData: FormData) {
  "use server";
  const state = await readState();
  const projectIndex = state.projects.findIndex((project) => project.id === projectId);

  if (projectIndex === -1) {
    throw new Error("Project not found.");
  }

  const scheduleFile = formData.get("scheduleFile");
  const fileName = scheduleFile instanceof File && scheduleFile.size > 0 ? scheduleFile.name : "";
  const uploadedScheduleText =
    scheduleFile instanceof File && scheduleFile.size > 0 && fileName.toLowerCase().endsWith(".csv")
      ? await scheduleFile.text()
      : "";
  const pastedSchedule = String(formData.get("scheduleImportText") || "").trim();
  const importedTasks = parseScheduleCsv(projectId, pastedSchedule || uploadedScheduleText);
  const boardCapture = await applyBoardCapture(state, projectId, formData);

  if (importedTasks.length > 0) {
    const existingRevisions = state.scheduleRevisions.filter((r) => r.projectId === projectId);
    const revisionNo = existingRevisions.length + 1;
    const isBaseline = revisionNo === 1;
    const revId = `rev-${projectId}-${revisionNo}-${Date.now()}`;
    const reason = String(formData.get("revisionReason") || "").trim() || (isBaseline ? "Baseline schedule" : `Revision ${revisionNo}`);
    const importedFrom: ScheduleRevision["importedFrom"] = fileName ? (fileName.toLowerCase().endsWith(".csv") ? "csv" : "pdf_reference") : "manual";

    // Mark all existing revisions as inactive
    state.scheduleRevisions = state.scheduleRevisions.map((r) =>
      r.projectId === projectId ? { ...r, isActive: false } : r,
    );

    state.scheduleRevisions.push({
      id: revId,
      projectId,
      revisionNo,
      isBaseline,
      isActive: true,
      importedAt: new Date().toISOString(),
      importedFrom,
      fileName: fileName || undefined,
      reason,
      taskCount: importedTasks.length,
    });

    // Tag new tasks with this revision, keep tasks from older revisions
    const taggedTasks = importedTasks.map((t) => ({ ...t, revisionId: revId }));
    state.scheduleTasks = [
      ...state.scheduleTasks.filter((t) => t.projectId !== projectId || t.revisionId !== revId),
      ...taggedTasks,
    ];
  }

  state.projects[projectIndex] = {
    ...state.projects[projectIndex],
    scheduleSource: importedTasks.length > 0 ? "spreadsheet" : fileName ? "pdf_reference" : "manual",
    scheduleFileName: fileName || state.projects[projectIndex].scheduleFileName,
    scheduleImportedAt: new Date().toISOString(),
  };

  const existingBoard = state.dailyBoards.some((task) => task.projectId === projectId);

  if (!existingBoard && boardCapture.manualTasks.length === 0 && importedTasks.length > 0) {
    state.dailyBoards.push(
      ...importedTasks.slice(0, 5).map((task, index) => ({
        id: `board-${projectId}-${Date.now()}-${index}`,
        projectId,
        boardDate: boardCapture.boardDate,
        phaseCode: task.phaseCode,
        area: task.area,
        taskName: task.taskName,
        owner: task.owner,
        plannedHours: 0,
        readinessDependency: task.dependency,
      })),
    );
  }

  await writeState(state);
  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}/schedule`);
  revalidatePath(`/projects/${projectId}/board`);
  redirect(`/projects/${projectId}/schedule`);
}

export async function setActiveRevisionAction(projectId: string, revisionId: string) {
  "use server";
  const state = await readState();
  const target = state.scheduleRevisions.find((r) => r.id === revisionId && r.projectId === projectId);
  if (!target) throw new Error("Revision not found.");

  state.scheduleRevisions = state.scheduleRevisions.map((r) =>
    r.projectId === projectId ? { ...r, isActive: r.id === revisionId } : r,
  );

  await writeState(state);
  revalidatePath(`/projects/${projectId}/schedule`);
  revalidatePath(`/projects/${projectId}/board`);
  revalidatePath("/");
}

export async function updateProjectScheduleTasksAction(projectId: string, formData: FormData) {
  "use server";
  const state = await readState();

  if (!state.projects.some((project) => project.id === projectId)) {
    throw new Error("Project not found.");
  }

  const taskIds = formData.getAll("taskId").map(String);
  const phaseCodes = formData.getAll("phaseCode").map(String);
  const areas = formData.getAll("area").map(String);
  const owners = formData.getAll("owner").map(String);
  const dependencies = formData.getAll("dependency").map(String);
  const readinessNotes = formData.getAll("readinessNote").map(String);
  const milestoneIds = new Set(formData.getAll("milestoneTaskId").map(String));
  const needsPmFillIds = new Set(formData.getAll("needsPmFillTaskId").map(String));

  const updates = new Map(
    taskIds.map((taskId, index) => [
      taskId,
      {
        phaseCode: phaseCodes[index]?.trim() || "GEN",
        area: areas[index]?.trim() || "",
        owner: owners[index]?.trim() || "Unassigned",
        dependency: dependencies[index]?.trim() || "",
        readinessNote: readinessNotes[index]?.trim() || "",
        milestone: milestoneIds.has(taskId),
        needsPmFill: needsPmFillIds.has(taskId),
      },
    ]),
  );

  state.scheduleTasks = state.scheduleTasks.map((task) => {
    if (task.projectId !== projectId) {
      return task;
    }

    const update = updates.get(task.id);
    return update ? { ...task, ...update } : task;
  });

  await writeState(state);
  revalidatePath(`/projects/${projectId}/schedule`);
  revalidatePath(`/projects/${projectId}/board`);
  redirect(`/projects/${projectId}/schedule`);
}

export async function saveTodayBoardAction(projectId: string, formData: FormData) {
  "use server";
  const state = await readState();

  if (!state.projects.some((project) => project.id === projectId)) {
    throw new Error("Project not found.");
  }

  await applyBoardCapture(state, projectId, formData);
  await writeState(state);
  revalidatePath(`/projects/${projectId}/board`);
  revalidatePath(`/projects/${projectId}/field-report/new`);
  redirect(`/projects/${projectId}/board`);
}
