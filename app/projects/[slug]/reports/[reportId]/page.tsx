import Link from "next/link";
import { notFound } from "next/navigation";
import { getDailyBoard, getFieldReport, getOpsProject, getReportPhotoUrls, listProjectChangeOrders } from "@/lib/ops-store";

type ReportPageProps = {
  params: Promise<{ slug: string; reportId: string }>;
};

export default async function ReportPage({ params }: ReportPageProps) {
  const { slug, reportId } = await params;
  const [project, report, changeOrders] = await Promise.all([
    getOpsProject(slug),
    getFieldReport(slug, reportId),
    listProjectChangeOrders(slug),
  ]);

  const photoUrls = report ? await getReportPhotoUrls(report.photos) : {};

  if (!project || !report) {
    notFound();
  }

  const reportDrafts = changeOrders.filter((draft) => draft.fieldReportId === report.id);
  const boardTasks = await getDailyBoard(slug);
  const taskById = new Map(boardTasks.map((task) => [task.id, task]));

  return (
    <div className="grid">
      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Field Report</p>
            <h1>{project.name} · {report.reportDate}</h1>
          </div>
          <Link className="button secondary" href={`/projects/${project.id}/board`}>Back to board</Link>
        </div>
        <div className="ops-stats">
          <div className="stat"><div className="stat-label">Crew</div><div className="stat-value">{report.crewMembers.join(", ") || "None"}</div></div>
          <div className="stat"><div className="stat-label">Labor hours</div><div className="stat-value">{report.laborEntries.reduce((sum, entry) => sum + entry.hours, 0)}</div></div>
          <div className="stat"><div className="stat-label">Variances</div><div className="stat-value">{report.variances.length}</div></div>
          <div className="stat"><div className="stat-label">Photos</div><div className="stat-value">{report.photos.length}</div></div>
        </div>
      </section>

      <section className="columns">
        <div className="card">
          <p className="eyebrow">Task Reality</p>
          <h2>Completed and incomplete work</h2>
          <div className="list">
            {report.tasks.length ? report.tasks.map((item) => {
              const task = item.boardTaskId ? taskById.get(item.boardTaskId) : null;
              return (
                <div key={item.id} className="list-item">
                  <div className="list-row">
                    <strong>{task?.taskName || item.taskName}</strong>
                    <span className={`badge ${item.status === "completed" ? "ready" : "medium"}`}>{item.status}</span>
                  </div>
                  <p className="muted">{item.area || task?.area} · {item.phaseCode || task?.phaseCode}</p>
                </div>
              );
            }) : <p className="muted">No task completion status recorded.</p>}
          </div>
        </div>
        <div className="card">
          <p className="eyebrow">Labor</p>
          <h2>Phase-coded hours</h2>
          <div className="list">
            {report.laborEntries.map((entry) => (
              <div className="list-item" key={entry.id}>
                <div className="list-row"><strong>{entry.employeeName}</strong><span>{entry.hours}h</span></div>
                <p className="muted">{entry.phaseCode} {entry.notes ? `· ${entry.notes}` : ""}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="card variance-panel">
        <p className="eyebrow">Variance Enforcement</p>
        <h2>Logged variances</h2>
        <div className="list">
          {report.variances.length ? report.variances.map((variance) => (
            <div key={variance.id} className="list-item">
              <div className="list-row">
                <strong>{variance.affectedArea || variance.type}</strong>
                <span className="badge high">{variance.requiresChangeOrder === "yes" ? "change order required" : variance.requiresChangeOrder}</span>
              </div>
              <p>{variance.description}</p>
              <p className="muted">
                Discovered by {variance.discoveredBy || "unknown"} · Client notified: {variance.clientNotified ? "yes" : "no"}
              </p>
              <p className="muted">
                Impact: {variance.estimatedLaborImpactHours}h labor · ${variance.estimatedMaterialImpactDollars} materials · {variance.estimatedScheduleImpactDays} day(s)
              </p>
            </div>
          )) : <p className="muted">No variances logged.</p>}
        </div>
      </section>

      {report.photos.length > 0 && (
        <section className="card">
          <p className="eyebrow">Photos</p>
          <h2>Site documentation</h2>
          <div className="photo-grid">
            {report.photos.map((photo) => {
              const url = photoUrls[photo.storageKey];
              return (
                <div key={photo.id} className="photo-item">
                  {url ? (
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={photo.caption || photo.fileName} className="photo-thumb" />
                    </a>
                  ) : (
                    <div className="photo-placeholder">{photo.fileName}</div>
                  )}
                  {photo.caption && <p className="photo-caption">{photo.caption}</p>}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="columns">
        <div className="card">
          <p className="eyebrow">Blockers</p>
          <h2>Open items</h2>
          <div className="list">
            {report.blockers.length ? report.blockers.map((blocker) => <div className="list-item" key={blocker}>{blocker}</div>) : <p className="muted">None recorded.</p>}
          </div>
        </div>
        <div className="card">
          <p className="eyebrow">Tomorrow</p>
          <h2>Recommendations</h2>
          <p>{report.tomorrowRecommendations || "No recommendations entered."}</p>
          <div className="button-row">
            {reportDrafts.map((draft) => (
              <Link className="button secondary" key={draft.id} href={`/projects/${project.id}/change-orders/${draft.id}`}>
                Review change order draft
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
