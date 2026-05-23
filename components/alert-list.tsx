import type { AlertSummary } from "@/lib/types";

export function AlertList({ alerts }: { alerts: AlertSummary[] }) {
  return (
    <div className="list">
      {alerts.map((alert) => (
        <div key={`${alert.project}-${alert.title}`} className="list-item">
          <div className="list-row">
            <strong>{alert.title}</strong>
            <span className={`badge ${alert.severity.toLowerCase()}`}>{alert.severity}</span>
          </div>
          <p>{alert.project}</p>
          <p className="muted">{alert.detail}</p>
          <p>
            <strong>Required action:</strong> {alert.action}
          </p>
        </div>
      ))}
    </div>
  );
}
