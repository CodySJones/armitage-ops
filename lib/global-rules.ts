export const globalChangeOrderRules = [
  {
    trigger: "Hidden condition",
    enforcement: "Photos required, PM review required, change order likely.",
  },
  {
    trigger: "Client request or scope change",
    enforcement: "Variance required, client notification required, change order required.",
  },
  {
    trigger: "Client decision delay",
    enforcement: "Schedule variance required with discovered date/time and PM follow-up.",
  },
  {
    trigger: "Schedule impact above zero days",
    enforcement: "Schedule drift flag appears on the project board.",
  },
  {
    trigger: "Missing description, affected area, discovered-by, or proof photos",
    enforcement: "Variance is not change-order-ready.",
  },
  {
    trigger: "Quality or rework issue",
    enforcement: "Internal review required; client change order only if scope/client cause is documented.",
  },
  {
    trigger: "Legal or safety issue",
    enforcement: "Urgent escalation; never auto-send to client.",
  },
];
