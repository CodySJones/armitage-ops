import type { Alert, AlertType, FieldReport, OpsProject, ScheduleTask } from "@/lib/ops-types";

// Residential remodeling phase sequence — order is the source of truth for sequence rules.
const PHASE_SEQUENCE = ["DEMO", "FRAMING", "ROUGH_MEP", "INSULATION", "DRYWALL", "TILE", "CABINETRY", "FINISH", "PUNCH"];

// What each phase requires to have been completed before work can begin.
const PHASE_PREREQUISITES: Partial<Record<string, string[]>> = {
  INSULATION: ["ROUGH_MEP"],
  DRYWALL: ["INSULATION"],
  TILE: ["DRYWALL"],
  CABINETRY: ["TILE"],
  FINISH: ["CABINETRY"],
  PUNCH: ["FINISH"],
};

// Alert types whose conditions are re-evaluated each report and auto-resolved when the condition clears.
// SEQUENCE_VIOLATION is intentionally excluded — it stays open until manually acknowledged.
export const AUTO_CLEARING_ALERT_TYPES: AlertType[] = [
  "UNOWNED_BLOCKER",
  "MISSING_PHOTOS",
  "UNREALISTIC_TOMORROW",
  "PAYMENT_RISK",
  "PREREQUISITE_FAILURE",
  "FALSE_PROGRESS",
];

export type RulesContext = {
  project: OpsProject;
  scheduleTasks: ScheduleTask[];
  recentReports: FieldReport[]; // prior reports for this project, newest first, excluding current
  report: FieldReport;
};

export type EvaluationResult = {
  created: Alert[];
  cleared: AlertType[]; // auto-clearing types that did NOT fire — existing open alerts of these types should be resolved
};

function makeId(type: AlertType, projectId: string): string {
  return `alert-${type.toLowerCase().replace(/_/g, "-")}-${projectId}-${Date.now()}`;
}

function alert(
  type: AlertType,
  project: OpsProject,
  reportId: string,
  severity: Alert["severity"],
  title: string,
  detail: string,
  actionRequired: string,
): Alert {
  return {
    id: makeId(type, project.id),
    projectId: project.id,
    fieldReportId: reportId,
    alertType: type,
    severity,
    status: "OPEN",
    title,
    detail,
    actionRequired,
    createdAt: new Date().toISOString(),
  };
}

// 1. UNOWNED_BLOCKER
// Blockers are stored as free-text strings. Any blocker that doesn't contain "owner:" or "@" is unowned.
function evaluateUnownedBlockers(ctx: RulesContext): Alert | null {
  const { project, report } = ctx;
  if (!report.blockers.length) return null;

  const unowned = report.blockers.filter((b) => {
    const lower = b.toLowerCase();
    return !lower.includes("owner:") && !lower.includes("assigned:") && !lower.includes("@");
  });

  if (!unowned.length) return null;

  return alert(
    "UNOWNED_BLOCKER",
    project,
    report.id,
    "HIGH",
    `${unowned.length} unowned blocker${unowned.length > 1 ? "s" : ""} — ${project.name}`,
    `${unowned.length} blocker${unowned.length > 1 ? "s" : ""} logged without a documented owner or due date:\n${unowned.map((b) => `• ${b}`).join("\n")}`,
    "Assign an owner and due date to each open blocker before the next day starts.",
  );
}

// 2. MISSING_PHOTOS
// Tasks marked complete with no photos uploaded.
function evaluateMissingPhotos(ctx: RulesContext): Alert | null {
  const { project, report } = ctx;
  const completed = report.tasks.filter((t) => t.status === "completed");
  if (!completed.length || report.photos.length > 0) return null;

  return alert(
    "MISSING_PHOTOS",
    project,
    report.id,
    "MEDIUM",
    `No photos submitted for ${completed.length} completed task${completed.length > 1 ? "s" : ""} — ${project.name}`,
    `Tasks marked complete but no photos uploaded as evidence:\n${completed.map((t) => `• ${t.taskName} (${t.phaseCode})`).join("\n")}`,
    "Upload at minimum one photo per completed task. Hidden work (rough MEP, blocking, waterproofing) requires a photo before close-in.",
  );
}

// 3. SEQUENCE_VIOLATION
// Reported work conflicts with the company phase-order rules.
function evaluateSequenceViolations(ctx: RulesContext): Alert | null {
  const { project, report, recentReports } = ctx;

  const historicallyCompletedPhases = new Set(
    recentReports.flatMap((r) => r.tasks.filter((t) => t.status === "completed").map((t) => t.phaseCode)),
  );

  const violations: string[] = [];

  for (const task of report.tasks) {
    if (task.status !== "completed" && task.status !== "incomplete") continue;
    const prereqs = PHASE_PREREQUISITES[task.phaseCode];
    if (!prereqs) continue;

    for (const required of prereqs) {
      if (!historicallyCompletedPhases.has(required)) {
        violations.push(
          `"${task.taskName}" (${task.phaseCode}) — requires ${required} complete first`,
        );
        break;
      }
    }
  }

  if (!violations.length) return null;

  return alert(
    "SEQUENCE_VIOLATION",
    project,
    report.id,
    "HIGH",
    `${violations.length} sequence violation${violations.length > 1 ? "s" : ""} — ${project.name}`,
    `Work reported out of company order-of-operations:\n${violations.map((v) => `• ${v}`).join("\n")}`,
    "Confirm the prerequisite phase is truly complete and log it, or document PM authorization for the sequence exception.",
  );
}

// 4. UNREALISTIC_TOMORROW
// Tomorrow's plan references a phase whose prerequisites are not met, or open blockers exist.
function evaluateUnrealisticTomorrow(ctx: RulesContext): Alert | null {
  const { project, report, recentReports } = ctx;
  if (!report.tomorrowRecommendations) return null;

  const tomorrow = report.tomorrowRecommendations.toLowerCase();
  const completedPhases = new Set(
    [report, ...recentReports]
      .flatMap((r) => r.tasks.filter((t) => t.status === "completed").map((t) => t.phaseCode)),
  );

  const blockedPhases: string[] = [];
  for (const phase of PHASE_SEQUENCE) {
    if (!tomorrow.includes(phase.toLowerCase())) continue;
    const prereqs = PHASE_PREREQUISITES[phase];
    if (!prereqs) continue;

    for (const required of prereqs) {
      if (!completedPhases.has(required)) {
        blockedPhases.push(`${phase} requires ${required} complete first`);
        break;
      }
    }
  }

  const openBlockers = report.blockers.filter((b) => {
    const lower = b.toLowerCase();
    return !lower.includes("resolved") && !lower.includes("cleared");
  });

  const reasons: string[] = [...blockedPhases];
  if (openBlockers.length && blockedPhases.length === 0) {
    // Only flag blocker-related risk if no stronger sequence issue already found
    reasons.push(`${openBlockers.length} open blocker${openBlockers.length > 1 ? "s" : ""} may prevent planned work`);
  }

  if (!reasons.length) return null;

  return alert(
    "UNREALISTIC_TOMORROW",
    project,
    report.id,
    blockedPhases.length ? "HIGH" : "MEDIUM",
    `Tomorrow's plan has unmet prerequisites — ${project.name}`,
    `Tomorrow's planned work cannot proceed without resolving:\n${reasons.map((r) => `• ${r}`).join("\n")}`,
    "Re-plan tomorrow's work or clear prerequisites before start of day. Update the board to reflect what can actually be done.",
  );
}

// 5. FALSE_PROGRESS
// Labor logged across multiple recent reports but no tasks marked complete.
function evaluateFalseProgress(ctx: RulesContext): Alert | null {
  const { project, report, recentReports } = ctx;
  if (recentReports.length < 2) return null;

  const windowReports = [report, ...recentReports.slice(0, 2)];
  const totalLabor = windowReports.reduce(
    (sum, r) => sum + r.laborEntries.reduce((s, e) => s + e.hours, 0),
    0,
  );

  if (totalLabor === 0) return null;

  const anyTaskComplete = windowReports.some((r) => r.tasks.some((t) => t.status === "completed"));
  if (anyTaskComplete) return null;

  return alert(
    "FALSE_PROGRESS",
    project,
    report.id,
    "MEDIUM",
    `Labor logged but no task completions across last 3 reports — ${project.name}`,
    `${totalLabor.toFixed(1)} labor hours recorded across the last 3 reports, but no tasks have been marked complete. This may indicate rework, scope drift, or unlogged obstacles.`,
    "Review with field lead: identify what is preventing task sign-off and whether a schedule revision or corrective action is needed.",
  );
}

// 6. PAYMENT_RISK
// End date approaching with open blockers or incomplete tasks.
function evaluatePaymentRisk(ctx: RulesContext): Alert | null {
  const { project, report } = ctx;
  if (!project.plannedEndDate) return null;

  const today = new Date();
  const end = new Date(project.plannedEndDate);
  const daysRemaining = Math.ceil((end.getTime() - today.getTime()) / 86_400_000);

  if (daysRemaining > 21) return null;

  const openBlockers = report.blockers.length;
  const incompleteTasks = report.tasks.filter((t) => t.status === "incomplete" || t.status === "blocked").length;
  if (openBlockers === 0 && incompleteTasks === 0) return null;

  const severity: Alert["severity"] = daysRemaining <= 7 ? "CRITICAL" : daysRemaining <= 14 ? "HIGH" : "MEDIUM";
  const parts: string[] = [`Project target end date is ${project.plannedEndDate} (${daysRemaining} day${daysRemaining === 1 ? "" : "s"} remaining).`];
  if (openBlockers) parts.push(`${openBlockers} open blocker${openBlockers > 1 ? "s" : ""} unresolved.`);
  if (incompleteTasks) parts.push(`${incompleteTasks} task${incompleteTasks > 1 ? "s" : ""} started but not finished.`);

  return alert(
    "PAYMENT_RISK",
    project,
    report.id,
    severity,
    `Payment timeline at risk — ${daysRemaining} day${daysRemaining === 1 ? "" : "s"} remaining on ${project.name}`,
    parts.join(" "),
    "Review milestone conditions with PM. Determine whether schedule revision is needed or blockers can clear in time to protect payment timing.",
  );
}

// 7. PREREQUISITE_FAILURE
// Tasks explicitly marked blocked in the report.
function evaluatePrerequisiteFailures(ctx: RulesContext): Alert | null {
  const { project, report } = ctx;
  const blocked = report.tasks.filter((t) => t.status === "blocked");
  if (!blocked.length) return null;

  const blockerContext = report.blockers.length
    ? `Active blockers: ${report.blockers.slice(0, 3).join("; ")}.`
    : "No specific blocker documented.";

  return alert(
    "PREREQUISITE_FAILURE",
    project,
    report.id,
    "HIGH",
    `${blocked.length} blocked task${blocked.length > 1 ? "s" : ""} — ${project.name}`,
    `Task${blocked.length > 1 ? "s" : ""} that cannot proceed:\n${blocked.map((t) => `• ${t.taskName} (${t.phaseCode}${t.area ? `, ${t.area}` : ""})`).join("\n")}\n\n${blockerContext}`,
    "Document the specific prerequisite blocking each task and assign a resolution owner and due date.",
  );
}

export function evaluateAlerts(ctx: RulesContext): EvaluationResult {
  const evaluators: [AlertType, () => Alert | null][] = [
    ["UNOWNED_BLOCKER", () => evaluateUnownedBlockers(ctx)],
    ["MISSING_PHOTOS", () => evaluateMissingPhotos(ctx)],
    ["SEQUENCE_VIOLATION", () => evaluateSequenceViolations(ctx)],
    ["UNREALISTIC_TOMORROW", () => evaluateUnrealisticTomorrow(ctx)],
    ["FALSE_PROGRESS", () => evaluateFalseProgress(ctx)],
    ["PAYMENT_RISK", () => evaluatePaymentRisk(ctx)],
    ["PREREQUISITE_FAILURE", () => evaluatePrerequisiteFailures(ctx)],
  ];

  const created: Alert[] = [];
  const fired = new Set<AlertType>();

  for (const [type, evaluate] of evaluators) {
    const result = evaluate();
    if (result) {
      created.push(result);
      fired.add(type);
    }
  }

  // Auto-clearing types that did NOT fire should have their existing open alerts resolved.
  const cleared = AUTO_CLEARING_ALERT_TYPES.filter((type) => !fired.has(type));

  return { created, cleared };
}
