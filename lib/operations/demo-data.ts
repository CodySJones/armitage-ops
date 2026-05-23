import type { BoardTask, ChangeOrderDraft, FieldReport, Project } from "@/lib/operations/types";

export const phaseCodes = [
  "DEMO",
  "FRAMING",
  "ROUGH_MEP",
  "INSULATION",
  "DRYWALL",
  "TILE",
  "CABINETRY",
  "FINISH",
  "PUNCH",
] as const;

export const varianceTypes = [
  "scope",
  "schedule",
  "labor",
  "cost",
  "quality",
  "legal",
  "hidden_condition",
  "client_request",
  "client_decision",
] as const;

export const projects: Project[] = [
  {
    id: "yarnall-kitchen",
    name: "Yarnall Kitchen",
    clientName: "Yarnall",
    address: "25 Mystic View",
    status: "active",
    currentPhase: "Cabinet install and trim prep",
    plannedStart: "2026-04-13",
    plannedEnd: "2026-06-12",
    scheduleDriftDays: 3,
    openVarianceCount: 4,
    changeOrderReadyCount: 2,
    downstreamReadiness: "Countertop template blocked by sink-base correction.",
  },
  {
    id: "riegel-bath",
    name: "Riegel Bath + Powder Room",
    clientName: "Riegel",
    address: "Powder room and primary bath",
    status: "active",
    currentPhase: "Tile prep and waterproofing",
    plannedStart: "2026-04-20",
    plannedEnd: "2026-06-05",
    scheduleDriftDays: 6,
    openVarianceCount: 6,
    changeOrderReadyCount: 3,
    downstreamReadiness: "Tile cannot start until pan correction, photo set, and inspection close.",
  },
  {
    id: "swanson-first-floor",
    name: "Swanson First Floor",
    clientName: "Swanson",
    address: "First floor renovation",
    status: "active",
    currentPhase: "Rough MEP",
    plannedStart: "2026-05-04",
    plannedEnd: "2026-07-10",
    scheduleDriftDays: 1,
    openVarianceCount: 2,
    changeOrderReadyCount: 0,
    downstreamReadiness: "Framing corrections are ready for electrician handoff.",
  },
];

export const boardTasks: BoardTask[] = [
  {
    id: "task-pan-correction",
    projectId: "riegel-bath",
    title: "Correct shower pan corner and retest",
    area: "Primary bath",
    phaseCode: "TILE",
    plannedDate: "2026-05-22",
    status: "blocked",
    owner: "Field lead",
    whiteboardColumn: "today",
    downstreamTrade: "Tile setter",
  },
  {
    id: "task-waterproof-photos",
    projectId: "riegel-bath",
    title: "Capture waterproofing detail proof set",
    area: "Primary bath",
    phaseCode: "TILE",
    plannedDate: "2026-05-22",
    status: "planned",
    owner: "Crew",
    whiteboardColumn: "today",
    downstreamTrade: "Inspection",
  },
  {
    id: "task-hall-niche",
    projectId: "riegel-bath",
    title: "Finish hall bath niche prep",
    area: "Hall bath",
    phaseCode: "TILE",
    plannedDate: "2026-05-22",
    status: "in_progress",
    owner: "Matt",
    whiteboardColumn: "today",
  },
  {
    id: "task-sink-base",
    projectId: "yarnall-kitchen",
    title: "Correct sink base shim before template",
    area: "Kitchen",
    phaseCode: "CABINETRY",
    plannedDate: "2026-05-22",
    status: "incomplete",
    owner: "Luis",
    whiteboardColumn: "blocked",
    downstreamTrade: "Countertop",
  },
  {
    id: "task-panel-check",
    projectId: "yarnall-kitchen",
    title: "Confirm appliance panel clearances",
    area: "Kitchen",
    phaseCode: "CABINETRY",
    plannedDate: "2026-05-22",
    status: "planned",
    owner: "Cody",
    whiteboardColumn: "today",
    downstreamTrade: "Appliance install",
  },
  {
    id: "task-electric-handoff",
    projectId: "swanson-first-floor",
    title: "Complete electrician framing handoff",
    area: "Kitchen wall",
    phaseCode: "ROUGH_MEP",
    plannedDate: "2026-05-22",
    status: "planned",
    owner: "PM",
    whiteboardColumn: "ready",
    downstreamTrade: "Electrical",
  },
];

export const reports: FieldReport[] = [
  {
    id: "report-riegel-2026-05-21",
    projectId: "riegel-bath",
    reportDate: "2026-05-21",
    submittedBy: "Cody Jones",
    crewMembers: [
      { id: "crew-cody", name: "Cody", role: "Field lead" },
      { id: "crew-matt", name: "Matt", role: "Carpenter" },
    ],
    laborEntries: [
      { id: "labor-1", employeeName: "Cody", hours: 4.5, phaseCode: "TILE", notes: "Waterproofing and inspection correction" },
      { id: "labor-2", employeeName: "Matt", hours: 6, phaseCode: "TILE", notes: "Niche prep and cleanup" },
    ],
    plannedTaskIds: ["task-pan-correction", "task-waterproof-photos", "task-hall-niche"],
    completedTaskIds: ["task-hall-niche"],
    incompleteTaskIds: ["task-pan-correction", "task-waterproof-photos"],
    blockers: ["Inspection correction needs PM signoff before tile can start."],
    variances: [
      {
        id: "variance-pan-hidden",
        type: "hidden_condition",
        description: "Existing pan corner detail failed flood check after curb exposure.",
        discoveredBy: "Cody Jones",
        discoveredAt: "2026-05-21T15:20:00-04:00",
        affectedArea: "Primary bath shower",
        relatedPhotoIds: ["photo-pan-corner"],
        estimatedLaborImpactHours: 5,
        estimatedMaterialImpact: "Additional waterproofing membrane and sealant.",
        estimatedScheduleImpactDays: 2,
        requiresChangeOrder: "yes",
        clientNotified: false,
        internalNotes: "Document before and after. Do not start tile until PM review.",
        status: "pm_review",
      },
      {
        id: "variance-client-decision",
        type: "client_decision",
        description: "Client has not selected final niche trim profile.",
        discoveredBy: "Matt",
        discoveredAt: "2026-05-21T10:00:00-04:00",
        affectedArea: "Hall bath niche",
        relatedPhotoIds: [],
        estimatedLaborImpactHours: 1,
        estimatedMaterialImpact: "Unknown until profile is selected.",
        estimatedScheduleImpactDays: 1,
        requiresChangeOrder: "unknown",
        clientNotified: true,
        internalNotes: "PM should request decision before tomorrow afternoon.",
        status: "open",
      },
    ],
    photos: [
      {
        id: "photo-pan-corner",
        caption: "Primary shower pan corner after curb exposure.",
        storagePath: "/storage/report-photos/pan-corner.jpg",
        relatedVarianceId: "variance-pan-hidden",
      },
    ],
    tomorrowRecommendations: "Recover pan correction first. Hold tile start until waterproofing proof photos and PM review are complete.",
    createdAt: "2026-05-21T17:16:00-04:00",
  },
];

export const changeOrderDrafts: ChangeOrderDraft[] = [
  {
    id: "co-riegel-pan-correction",
    projectId: "riegel-bath",
    reportId: "report-riegel-2026-05-21",
    varianceIds: ["variance-pan-hidden"],
    title: "Primary shower pan hidden-condition correction",
    aiSummary:
      "Field report documents a hidden condition at the primary shower pan corner discovered after curb exposure. The condition affects waterproofing readiness and blocks tile start until correction and PM review are complete.",
    scopeNarrative:
      "Perform additional waterproofing preparation at the exposed pan corner, retest the affected area, document the correction with photos, and update the working schedule before downstream tile work proceeds.",
    laborImpactHours: 5,
    materialImpact: "Waterproofing membrane, sealant, and related prep materials.",
    scheduleImpactDays: 2,
    status: "pm_review_required",
    createdAt: "2026-05-21T17:30:00-04:00",
  },
];

export function getProject(id: string) {
  return projects.find((project) => project.id === id);
}

export function getBoardTasks(projectId: string) {
  return boardTasks.filter((task) => task.projectId === projectId);
}

export function getReports(projectId: string) {
  return reports.filter((report) => report.projectId === projectId);
}

export function getReport(projectId: string, reportId: string) {
  return reports.find((report) => report.projectId === projectId && report.id === reportId);
}

export function getChangeOrder(projectId: string, id: string) {
  return changeOrderDrafts.find((draft) => draft.projectId === projectId && draft.id === id);
}
