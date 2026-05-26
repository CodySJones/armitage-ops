export type ProjectStatus = "precon" | "active" | "paused" | "closed";
export type VarianceType = "scope" | "schedule" | "labor" | "cost" | "quality" | "legal" | "hidden_condition" | "client_request" | "client_decision";
export type ChangeOrderRequirement = "yes" | "no" | "unknown";
export type TaskStatus = "planned" | "completed" | "incomplete" | "blocked";

export type OpsProject = {
  id: string;
  name: string;
  clientName: string;
  address: string;
  status: ProjectStatus;
  currentPhase: string;
  plannedStartDate?: string;
  plannedEndDate: string;
  projectManager?: string;
  fieldLead?: string;
  scheduleSource?: "spreadsheet" | "pdf_reference" | "manual";
  scheduleFileName?: string;
  scheduleImportedAt?: string;
  actualEndDate?: string;
};

export type DailyBoardTask = {
  id: string;
  projectId: string;
  boardDate: string;
  phaseCode: string;
  area: string;
  taskName: string;
  owner: string;
  plannedHours: number;
  readinessDependency?: string;
};

export type DailyBoardPhoto = {
  id: string;
  projectId: string;
  boardDate: string;
  fileName: string;
  storageKey: string;
  notes?: string;
  uploadedAt: string;
};

export type ScheduleRevision = {
  id: string;
  projectId: string;
  revisionNo: number;
  isBaseline: boolean;
  isActive: boolean;
  importedAt: string;
  importedFrom: "csv" | "manual" | "pdf_reference";
  fileName?: string;
  reason?: string;
  taskCount: number;
};

export type ScheduleTask = {
  id: string;
  revisionId: string;
  projectId: string;
  taskName: string;
  phaseCode: string;
  area: string;
  plannedStart: string;
  plannedFinish: string;
  owner: string;
  dependency: string;
  milestone: boolean;
  sourceNotes?: string;
  readinessNote?: string;
  needsPmFill?: boolean;
};

export type LaborEntry = {
  id: string;
  employeeName: string;
  phaseCode: string;
  hours: number;
  notes?: string;
};

export type FieldTask = {
  id: string;
  boardTaskId?: string;
  phaseCode: string;
  area: string;
  taskName: string;
  status: TaskStatus;
  note?: string;
};

export type PhotoRecord = {
  id: string;
  fileName: string;
  storageKey: string;
  caption: string;
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
  estimatedMaterialImpactDollars: number;
  estimatedScheduleImpactDays: number;
  requiresChangeOrder: ChangeOrderRequirement;
  clientNotified: boolean;
  internalNotes: string;
};

export type FieldReport = {
  id: string;
  projectId: string;
  reportDate: string;
  crewMembers: string[];
  submittedBy: string;
  laborEntries: LaborEntry[];
  plannedTaskIds: string[];
  tasks: FieldTask[];
  blockers: string[];
  variances: Variance[];
  photos: PhotoRecord[];
  tomorrowRecommendations: string;
  createdAt: string;
};

export type ChangeOrderDraft = {
  id: string;
  projectId: string;
  fieldReportId: string;
  varianceId: string;
  title: string;
  aiSummary: string;
  estimatedLaborHours: number;
  estimatedMaterialDollars: number;
  estimatedScheduleDays: number;
  reviewStatus: "pm_review_required" | "approved" | "rejected";
  createdAt: string;
};

export type AlertType =
  | "PAYMENT_RISK"
  | "SEQUENCE_VIOLATION"
  | "PREREQUISITE_FAILURE"
  | "FALSE_PROGRESS"
  | "UNOWNED_BLOCKER"
  | "MISSING_PHOTOS"
  | "UNREALISTIC_TOMORROW";

export type AlertSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type AlertStatus = "OPEN" | "ACKNOWLEDGED" | "RESOLVED";

export type Alert = {
  id: string;
  projectId: string;
  fieldReportId?: string;
  alertType: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  detail: string;
  actionRequired: string;
  createdAt: string;
  resolvedAt?: string;
};

export type OpsState = {
  projects: OpsProject[];
  scheduleRevisions: ScheduleRevision[];
  scheduleTasks: ScheduleTask[];
  dailyBoards: DailyBoardTask[];
  dailyBoardPhotos: DailyBoardPhoto[];
  fieldReports: FieldReport[];
  changeOrderDrafts: ChangeOrderDraft[];
  alerts: Alert[];
};
