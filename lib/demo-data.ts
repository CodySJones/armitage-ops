import type { AlertSummary, Metric, ProjectSummary } from "@/lib/types";

export const dashboardMetrics: Metric[] = [
  { label: "Active jobs", value: "7", note: "3 need management intervention today" },
  { label: "Open blockers", value: "9", note: "4 are still unowned or overdue" },
  { label: "Payment risks", value: "3", note: "2 next draws likely to slip" },
  { label: "Sequence issues", value: "5", note: "Finish work reported before prerequisites" },
];

export const projectSummaries: ProjectSummary[] = [
  {
    slug: "laquer-residence",
    name: "Laquer Residence",
    currentPhase: "Tile prep and waterproofing",
    nextMilestone: "Waterproofing draw",
    riskLevel: "CRITICAL",
    baselineVariance: "+6 days",
    workingVariance: "+2 days",
    summary:
      "Crew stayed busy, but reported work did not close the remaining prerequisites for the next payment milestone.",
    actions: [
      "Assign cabinet delivery blocker to purchasing today with a due date.",
      "Confirm shower pan inspection correction before allowing tile setting tomorrow.",
      "Decide whether to revise the working schedule or recover the current handoff.",
    ],
    alerts: [
      {
        title: "False progress on waterproofing draw",
        detail:
          "Two reports logged labor, but the same milestone prerequisites remain open and the planned billing date is now threatened.",
        severity: "CRITICAL",
      },
      {
        title: "Tomorrow plan is unrealistic",
        detail: "Tile setting is planned while inspection correction and detail photo proof are still missing.",
        severity: "HIGH",
      },
    ],
    scheduleRevisions: [
      { label: "Revision 1 - Baseline", date: "2026-02-12", reason: "Original contract schedule" },
      { label: "Revision 2 - Working", date: "2026-03-27", reason: "Adjusted after plumbing rough-in delay" },
    ],
    latestReport: [
      { label: "Completed today", value: "Second coat waterproofing, niche prep, cleanup, material staging" },
      { label: "Blockers", value: "Inspection correction still open, cabinet hardware delivery date not confirmed" },
      { label: "Need next", value: "Inspection clearance, seam detail photos, cabinet delivery confirmation" },
    ],
  },
  {
    slug: "worthington-barn",
    name: "Worthington Barn",
    currentPhase: "Finish carpentry",
    nextMilestone: "Trim and punch draw",
    riskLevel: "HIGH",
    baselineVariance: "+4 days",
    workingVariance: "+1 day",
    summary: "Finish work is being reported while punch carpentry and paint touch-up prerequisites remain open.",
    actions: [
      "Hold final trim signoff until touch-up list is closed.",
      "Assign paint touch-up to field lead with due date.",
    ],
    alerts: [
      {
        title: "Sequence violation in finish work",
        detail: "Finish install proceeded while required upstream corrections were still open.",
        severity: "HIGH",
      },
    ],
    scheduleRevisions: [
      { label: "Revision 1 - Baseline", date: "2026-01-16", reason: "Original field plan" },
      { label: "Revision 2 - Working", date: "2026-03-21", reason: "Weather and site access adjustments" },
    ],
    latestReport: [
      { label: "Completed today", value: "Window stool install and main room trim set" },
      { label: "Blockers", value: "Paint corrections still pending on west wall" },
      { label: "Need next", value: "Touch-up closeout before trim handoff approval" },
    ],
  },
  {
    slug: "corrigan-road-kitchen",
    name: "Corrigan Road Kitchen",
    currentPhase: "Cabinet install",
    nextMilestone: "Cabinets and layout draw",
    riskLevel: "MEDIUM",
    baselineVariance: "+1 day",
    workingVariance: "On plan",
    summary: "Schedule is still mostly credible, but one material dependency needs owner attention.",
    actions: ["Verify countertop template date after sink base correction is complete."],
    alerts: [
      {
        title: "Unowned material blocker",
        detail: "Countertop template depends on sink base correction, but no owner is assigned to close it.",
        severity: "MEDIUM",
      },
    ],
    scheduleRevisions: [
      { label: "Revision 1 - Baseline", date: "2026-02-01", reason: "Original contract schedule" },
    ],
    latestReport: [
      { label: "Completed today", value: "Tall cabinet set and laser layout complete" },
      { label: "Blockers", value: "Sink base shim correction needed before template" },
      { label: "Need next", value: "Correction, countertop template confirmation" },
    ],
  },
];

export const openAlerts: AlertSummary[] = [
  {
    project: "Laquer Residence",
    title: "Payment risk on waterproofing draw",
    detail: "Milestone conditions are still incomplete with three planned days remaining.",
    severity: "CRITICAL",
    action: "Review prerequisites today and either recover the path or approve a revision.",
  },
  {
    project: "Laquer Residence",
    title: "Unrealistic tomorrow plan",
    detail: "Tile setting is planned while inspection correction and photo proof remain open.",
    severity: "HIGH",
    action: "Reset tomorrow's plan or clear prerequisites before end of day.",
  },
  {
    project: "Worthington Barn",
    title: "Sequence violation in finish work",
    detail: "Finish work started ahead of required paint corrections.",
    severity: "HIGH",
    action: "Stop downstream signoff until required upstream items are closed.",
  },
  {
    project: "Corrigan Road Kitchen",
    title: "Unowned blocker",
    detail: "Sink base correction is preventing countertop template scheduling, but no owner is assigned.",
    severity: "MEDIUM",
    action: "Assign ownership and due date today.",
  },
];

export const fieldChecklist = [
  {
    label: "Areas worked in",
    example: "Primary bath, hall bath, staging area",
  },
  {
    label: "Tasks completed today",
    example: "Applied second waterproofing coat in primary shower and wrapped curb seams.",
  },
  {
    label: "Tasks started but not finished",
    example: "Hall bath niche prep started, missing one detail check before closeout.",
  },
  {
    label: "Blockers",
    example: "Inspection correction still open at shower pan corner. Cabinet hardware delivery not confirmed.",
  },
  {
    label: "Planned work for tomorrow",
    example: "Set tile in primary shower if inspection correction is cleared and detail photos are complete.",
  },
  {
    label: "Needed next",
    example: "Inspection signoff, seam detail photos, hardware delivery confirmation.",
  },
];

export const samplePhotoRequirements = [
  {
    category: "Room overview",
    count: "1 required",
    note: "Show the full shower and adjacent work area before handoff.",
  },
  {
    category: "Hidden work details",
    count: "3 required",
    note: "Capture seams, penetrations, curb build-up, and any waterproofing transitions.",
  },
  {
    category: "Blocker evidence",
    count: "1 required when blocked",
    note: "If the crew marks a blocker, add at least one photo proving the issue.",
  },
];

export function getProjectBySlug(slug: string) {
  return projectSummaries.find((project) => project.slug === slug);
}
