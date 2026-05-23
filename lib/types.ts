export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type AlertSummary = {
  project: string;
  title: string;
  detail: string;
  severity: RiskLevel;
  action: string;
};

export type ProjectSummary = {
  slug: string;
  name: string;
  currentPhase: string;
  nextMilestone: string;
  riskLevel: RiskLevel;
  baselineVariance: string;
  workingVariance: string;
  summary: string;
  actions: string[];
  alerts: {
    title: string;
    detail: string;
    severity: RiskLevel;
  }[];
  scheduleRevisions: {
    label: string;
    date: string;
    reason: string;
  }[];
  latestReport: {
    label: string;
    value: string;
  }[];
};

export type Metric = {
  label: string;
  value: string;
  note: string;
};
