export type UserRole = "owner" | "pm" | "field_lead" | "office";

export type ProjectStatus = "precon" | "active" | "paused" | "closed";

export type TaskStatus = "planned" | "in_progress" | "complete" | "incomplete" | "blocked";

export type VarianceType =
  | "scope"
  | "schedule"
  | "labor"
  | "cost"
  | "quality"
  | "legal"
  | "hidden_condition"
  | "client_request"
  | "client_decision";

export type ChangeOrderRequirement = "yes" | "no" | "unknown";

export type PhaseCode =
  | "DEMO"
  | "FRAMING"
  | "ROUGH_MEP"
  | "INSULATION"
  | "DRYWALL"
  | "TILE"
  | "CABINETRY"
  | "FINISH"
  | "PUNCH";

export type CrewMember = {
  id: string;
  name: string;
  role: string;
};

export type LaborEntry = {
  id: string;
  employeeName: string;
  hours: number;
  phaseCode: PhaseCode;
  notes?: string;
};

export type BoardTask = {
  id: string;
  projectId: string;
  title: string;
  area: string;
  phaseCode: PhaseCode;
  plannedDate: string;
  status: TaskStatus;
  owner: string;
  whiteboardColumn: "today" | "tomorrow" | "blocked" | "ready";
  downstreamTrade?: string;
};

export type PhotoRecord = {
  id: string;
  caption: string;
  storagePath: string;
  relatedVarianceId?: string;
};

export type Variance = {
  id: string;
  type: VarianceType;
  description: string;
  discoveredBy: string;
  discoveredAt: string;
  affectedArea: string;
  relatedPhotoIds: string[];
  estimatedLaborImpactHours: number;
  estimatedMaterialImpact: string;
  estimatedScheduleImpactDays: number;
  requiresChangeOrder: ChangeOrderRequirement;
  clientNotified: boolean;
  internalNotes: string;
  status: "open" | "pm_review" | "co_drafted" | "resolved";
};

export type FieldReport = {
  id: string;
  projectId: string;
  reportDate: string;
  submittedBy: string;
  crewMembers: CrewMember[];
  laborEntries: LaborEntry[];
  plannedTaskIds: string[];
  completedTaskIds: string[];
  incompleteTaskIds: string[];
  blockers: string[];
  variances: Variance[];
  photos: PhotoRecord[];
  tomorrowRecommendations: string;
  createdAt: string;
};

export type ChangeOrderDraft = {
  id: string;
  projectId: string;
  reportId: string;
  varianceIds: string[];
  title: string;
  aiSummary: string;
  scopeNarrative: string;
  laborImpactHours: number;
  materialImpact: string;
  scheduleImpactDays: number;
  status: "draft" | "pm_review_required" | "approved_to_send" | "sent_manually";
  createdAt: string;
};

export type Project = {
  id: string;
  name: string;
  clientName: string;
  address: string;
  status: ProjectStatus;
  currentPhase: string;
  plannedStart: string;
  plannedEnd: string;
  actualEnd?: string;
  scheduleDriftDays: number;
  openVarianceCount: number;
  changeOrderReadyCount: number;
  downstreamReadiness: string;
};
