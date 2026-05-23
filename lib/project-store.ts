import { promises as fs } from "fs";
import path from "path";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { ProjectSummary, RiskLevel } from "@/lib/types";
import { parseAndCalculateScheduleImport } from "@/lib/scheduling/schedule-import";
import type { ScheduleInputDependency, ScheduleInputTask, ScheduledTask } from "@/lib/scheduling/schedule-engine";

export type StoredProject = {
  slug: string;
  name: string;
  code: string;
  clientName: string;
  status: string;
  archived?: boolean;
  archivedAt?: string;
  address: string;
  currentPhase: string;
  targetEndDate: string;
  createdAt: string;
  control?: {
    nextPaymentDate?: string;
    projectLead?: string;
    crew?: string;
    phaseStartedAt?: string;
    projectedPhaseDays?: string;
    phasePercentComplete?: string;
    lastFieldReportAt?: string;
    overallScheduleVarianceDays?: string;
  };
  schedule?: {
    fileName: string;
    storedAt: string;
    revisionNumber: string;
    revisionDate: string;
    author: string;
    reason: string;
    importNotes: string;
    scheduleType: string;
    importFileName?: string;
    projectStart?: string;
    projectFinish?: string;
    importedTasks?: ScheduleInputTask[];
    importedDependencies?: ScheduleInputDependency[];
    calculatedTasks?: ScheduledTask[];
  };
  contract?: {
    fileName: string;
    storedAt: string;
    nextMilestone: string;
    amount: string;
    triggerSummary: string;
  };
};

const storageDir = path.join(process.cwd(), "storage");
const uploadsDir = path.join(storageDir, "uploads");
const projectsFile = path.join(storageDir, "projects.json");

async function ensureStorage() {
  await fs.mkdir(uploadsDir, { recursive: true });

  try {
    await fs.access(projectsFile);
  } catch {
    await fs.writeFile(projectsFile, "[]\n", "utf8");
  }
}

function slugifyProjectName(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function readStoredProjects(): Promise<StoredProject[]> {
  await ensureStorage();
  const raw = await fs.readFile(projectsFile, "utf8");
  return JSON.parse(raw) as StoredProject[];
}

async function writeStoredProjects(projects: StoredProject[]) {
  await ensureStorage();
  await fs.writeFile(projectsFile, `${JSON.stringify(projects, null, 2)}\n`, "utf8");
}

function uniqueSlug(desired: string, existingSlugs: string[]) {
  if (!existingSlugs.includes(desired)) {
    return desired;
  }

  let index = 2;
  while (existingSlugs.includes(`${desired}-${index}`)) {
    index += 1;
  }

  return `${desired}-${index}`;
}

function riskForStoredProject(project: StoredProject): RiskLevel {
  if (project.archived) {
    return "LOW";
  }

  if (!project.schedule || !project.contract) {
    return "MEDIUM";
  }

  if (project.schedule.calculatedTasks?.some((task) => task.critical && task.totalSlackDays < 1)) {
    return "MEDIUM";
  }

  return "LOW";
}

function summaryForStoredProject(project: StoredProject) {
  if (project.archived) {
    return `Project archived${project.archivedAt ? ` on ${project.archivedAt.slice(0, 10)}` : ""}.`;
  }

  if (!project.schedule && !project.contract) {
    return "Project created. Baseline schedule and contract still need to be loaded.";
  }

  if (project.schedule && !project.contract) {
    return "Baseline schedule saved. Contract and payment milestones still need to be loaded.";
  }

  return "Core setup has been started and this job now has its own saved Baseline record.";
}

function mapStoredToSummary(project: StoredProject): ProjectSummary {
  const riskLevel = riskForStoredProject(project);
  const variance = project.control?.overallScheduleVarianceDays?.trim();
  const varianceLabel = variance
    ? `${variance.startsWith("-") ? "" : variance === "0" ? "" : variance.startsWith("+") ? "" : ""}${variance} days`
    : "Not calculated";

  return {
    slug: project.slug,
    name: project.name,
    currentPhase: project.currentPhase || "Not set",
    nextMilestone: project.contract?.nextMilestone || "Not entered",
    riskLevel,
    baselineVariance: project.schedule?.projectFinish ? `Finish ${project.schedule.projectFinish}` : "Not calculated",
    workingVariance: varianceLabel,
    summary: summaryForStoredProject(project),
    actions: [
      !project.schedule ? "Upload and save the baseline schedule." : "Review the saved baseline schedule.",
      !project.contract ? "Upload the contract and define payment milestones." : "Review contract trigger conditions.",
      "Add order-of-operations rules and start field reporting.",
    ],
    alerts: [
      {
        title: !project.schedule ? "Baseline schedule missing" : project.schedule.calculatedTasks ? "Schedule calculated" : "Setup still in progress",
        detail: !project.schedule
          ? "This project cannot be evaluated until a schedule is saved."
          : project.schedule.calculatedTasks
            ? `${project.schedule.calculatedTasks.filter((task) => task.critical).length} critical-path tasks were calculated from the imported schedule.`
          : "Rules, milestones, and live project-control checks are not configured yet.",
        severity: !project.schedule ? "HIGH" : "MEDIUM",
      },
    ],
    scheduleRevisions: project.schedule
      ? [
          {
            label: `${project.schedule.scheduleType} - Revision ${project.schedule.revisionNumber}`,
            date: project.schedule.revisionDate || project.schedule.storedAt.slice(0, 10),
            reason: project.schedule.reason || "Imported schedule",
          },
        ]
      : [{ label: "No saved schedule yet", date: "", reason: "Upload a baseline schedule to begin." }],
    latestReport: [
      { label: "Client", value: project.clientName || "Not entered" },
      { label: "Address", value: project.address || "Not entered" },
      { label: "Contract file", value: project.contract?.fileName || "No contract uploaded yet" },
      {
        label: "Structured schedule",
        value: project.schedule?.calculatedTasks
          ? `${project.schedule.calculatedTasks.length} tasks imported; finish ${project.schedule.projectFinish}`
          : "No structured schedule imported yet",
      },
    ],
  };
}

export async function listStoredProjects() {
  return readStoredProjects();
}

export async function listAllProjects() {
  const stored = await listStoredProjects();
  return stored.filter((project) => !project.archived).map(mapStoredToSummary);
}

export async function listArchivedProjects() {
  const stored = await listStoredProjects();
  return stored.filter((project) => project.archived).map(mapStoredToSummary);
}

export async function getAnyProjectBySlug(slug: string) {
  const stored = await listStoredProjects();
  const storedProject = stored.find((project) => project.slug === slug);

  if (storedProject) {
    return mapStoredToSummary(storedProject);
  }

  return undefined;
}

export async function getStoredProject(slug: string) {
  const stored = await listStoredProjects();
  return stored.find((project) => project.slug === slug) ?? null;
}

export async function archiveProject(slug: string) {
  const projects = await readStoredProjects();
  const index = projects.findIndex((project) => project.slug === slug);

  if (index === -1) {
    throw new Error("Project not found.");
  }

  projects[index].archived = true;
  projects[index].archivedAt = new Date().toISOString();

  await writeStoredProjects(projects);
  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/projects");
  revalidatePath("/projects/archived");
  revalidatePath(`/projects/${slug}`);
  redirect("/projects");
}

export async function unarchiveProject(slug: string) {
  const projects = await readStoredProjects();
  const index = projects.findIndex((project) => project.slug === slug);

  if (index === -1) {
    throw new Error("Project not found.");
  }

  projects[index].archived = false;
  projects[index].archivedAt = "";

  await writeStoredProjects(projects);
  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/projects");
  revalidatePath("/projects/archived");
  revalidatePath(`/projects/${slug}`);
  redirect(`/projects/${slug}`);
}

export async function saveControlDataForProject(slug: string, formData: FormData) {
  const projects = await readStoredProjects();
  const index = projects.findIndex((project) => project.slug === slug);

  if (index === -1) {
    throw new Error("Project not found.");
  }

  projects[index].currentPhase = String(formData.get("currentPhase") || projects[index].currentPhase || "").trim();
  projects[index].control = {
    nextPaymentDate: String(formData.get("nextPaymentDate") || "").trim(),
    projectLead: String(formData.get("projectLead") || "").trim(),
    crew: String(formData.get("crew") || "").trim(),
    phaseStartedAt: String(formData.get("phaseStartedAt") || "").trim(),
    projectedPhaseDays: String(formData.get("projectedPhaseDays") || "").trim(),
    phasePercentComplete: String(formData.get("phasePercentComplete") || "").trim(),
    lastFieldReportAt: String(formData.get("lastFieldReportAt") || "").trim(),
    overallScheduleVarianceDays: String(formData.get("overallScheduleVarianceDays") || "").trim(),
  };

  await writeStoredProjects(projects);
  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/projects");
  revalidatePath(`/projects/${slug}`);
  revalidatePath(`/projects/${slug}/control`);
  redirect(`/projects/${slug}`);
}

async function saveUploadedFile(file: File, prefix: string) {
  await ensureStorage();

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
  const fileName = `${prefix}-${Date.now()}-${safeName}`;
  const fullPath = path.join(uploadsDir, fileName);
  const bytes = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(fullPath, bytes);
  return fileName;
}

async function readUploadedText(file: File) {
  const bytes = Buffer.from(await file.arrayBuffer());
  return bytes.toString("utf8");
}

export async function createProjectFromForm(formData: FormData) {
  const name = String(formData.get("projectName") || "").trim();
  const code = String(formData.get("projectCode") || "").trim();

  if (!name) {
    throw new Error("Project name is required.");
  }

  const projects = await readStoredProjects();
  const slugBase = slugifyProjectName(name) || "project";
  const slug = uniqueSlug(slugBase, projects.map((project) => project.slug));

  const project: StoredProject = {
    slug,
    name,
    code,
    clientName: String(formData.get("clientName") || "").trim(),
    status: String(formData.get("status") || "ACTIVE").trim(),
    address: String(formData.get("address") || "").trim(),
    currentPhase: String(formData.get("currentPhase") || "").trim(),
    targetEndDate: String(formData.get("targetEndDate") || "").trim(),
    createdAt: new Date().toISOString(),
  };

  projects.unshift(project);
  await writeStoredProjects(projects);
  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/projects");
  redirect(`/projects/${slug}/schedule`);
}

export async function createProjectWithContractFromForm(formData: FormData) {
  const name = String(formData.get("projectName") || "").trim();
  const code = String(formData.get("projectCode") || "").trim();

  if (!name) {
    throw new Error("Project name is required.");
  }

  const projects = await readStoredProjects();
  const slugBase = slugifyProjectName(name) || "project";
  const slug = uniqueSlug(slugBase, projects.map((project) => project.slug));

  const file = formData.get("contractFile");
  let savedName = "";

  if (file instanceof File && file.size > 0) {
    savedName = await saveUploadedFile(file, `${slug}-contract`);
  }

  const project: StoredProject = {
    slug,
    name,
    code,
    clientName: String(formData.get("clientName") || "").trim(),
    status: String(formData.get("status") || "ACTIVE").trim(),
    address: String(formData.get("address") || "").trim(),
    currentPhase: String(formData.get("currentPhase") || "").trim(),
    targetEndDate: String(formData.get("targetEndDate") || "").trim(),
    createdAt: new Date().toISOString(),
    contract: {
      fileName: savedName || "No file uploaded",
      storedAt: new Date().toISOString(),
      nextMilestone: String(formData.get("nextMilestone") || "").trim(),
      amount: String(formData.get("amount") || "").trim(),
      triggerSummary: String(formData.get("triggerSummary") || "").trim(),
    },
  };

  projects.unshift(project);
  await writeStoredProjects(projects);
  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/projects");
  redirect(`/projects/${slug}/schedule`);
}

export async function saveScheduleForProject(slug: string, formData: FormData) {
  const projects = await readStoredProjects();
  const index = projects.findIndex((project) => project.slug === slug);

  if (index === -1) {
    throw new Error("Project not found.");
  }

  const file = formData.get("scheduleFile");
  const importFile = formData.get("scheduleImportFile");
  const pastedImport = String(formData.get("scheduleImportText") || "").trim();
  let savedName = projects[index].schedule?.fileName || "";
  let importFileName = projects[index].schedule?.importFileName || "";
  let structuredSchedule:
    | Pick<
        NonNullable<StoredProject["schedule"]>,
        "projectStart" | "projectFinish" | "importedTasks" | "importedDependencies" | "calculatedTasks"
      >
    | undefined;

  if (file instanceof File && file.size > 0) {
    savedName = await saveUploadedFile(file, `${slug}-schedule`);
  }

  let importText = pastedImport;
  if (importFile instanceof File && importFile.size > 0) {
    importFileName = await saveUploadedFile(importFile, `${slug}-schedule-import`);
    importText = await readUploadedText(importFile);
  }

  if (importText) {
    const fallbackProjectStart =
      String(formData.get("projectStart") || "").trim() ||
      String(formData.get("revisionDate") || "").trim() ||
      new Date().toISOString().slice(0, 10);
    const calculated = parseAndCalculateScheduleImport(importText, fallbackProjectStart);
    structuredSchedule = {
      projectStart: calculated.projectStart,
      projectFinish: calculated.projectFinish,
      importedTasks: calculated.tasks,
      importedDependencies: calculated.dependencies,
      calculatedTasks: calculated.calculatedTasks,
    };
  }

  projects[index].schedule = {
    fileName: savedName || "No file uploaded",
    storedAt: new Date().toISOString(),
    revisionNumber: String(formData.get("revisionNumber") || "1"),
    revisionDate: String(formData.get("revisionDate") || ""),
    author: String(formData.get("author") || ""),
    reason: String(formData.get("reason") || ""),
    importNotes: String(formData.get("importNotes") || ""),
    scheduleType: String(formData.get("scheduleType") || "Baseline schedule"),
    importFileName,
    projectStart: structuredSchedule?.projectStart ?? projects[index].schedule?.projectStart,
    projectFinish: structuredSchedule?.projectFinish ?? projects[index].schedule?.projectFinish,
    importedTasks: structuredSchedule?.importedTasks ?? projects[index].schedule?.importedTasks,
    importedDependencies: structuredSchedule?.importedDependencies ?? projects[index].schedule?.importedDependencies,
    calculatedTasks: structuredSchedule?.calculatedTasks ?? projects[index].schedule?.calculatedTasks,
  };

  await writeStoredProjects(projects);
  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/projects");
  revalidatePath(`/projects/${slug}`);
  redirect(`/projects/${slug}`);
}

export async function saveContractForProject(slug: string, formData: FormData) {
  const projects = await readStoredProjects();
  const index = projects.findIndex((project) => project.slug === slug);

  if (index === -1) {
    throw new Error("Project not found.");
  }

  const file = formData.get("contractFile");
  let savedName = projects[index].contract?.fileName || "";

  if (file instanceof File && file.size > 0) {
    savedName = await saveUploadedFile(file, `${slug}-contract`);
  }

  projects[index].contract = {
    fileName: savedName || "No file uploaded",
    storedAt: new Date().toISOString(),
    nextMilestone: String(formData.get("nextMilestone") || "").trim(),
    amount: String(formData.get("amount") || "").trim(),
    triggerSummary: String(formData.get("triggerSummary") || "").trim(),
  };

  await writeStoredProjects(projects);
  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/projects");
  revalidatePath(`/projects/${slug}`);
  redirect(`/projects/${slug}`);
}
