import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getDailyBoard,
  getOpsProject,
  listDailyBoardPhotos,
  listProjectChangeOrders,
  listProjectReports,
  saveTodayBoardAction,
} from "@/lib/ops-store";
import { boardPhotoAccept } from "@/lib/upload-accept";

type BoardPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function BoardPage({ params }: BoardPageProps) {
  const { slug } = await params;
  const project = await getOpsProject(slug);

  if (!project) {
    notFound();
  }

  const [boardTasks, boardPhotos, reports, changeOrders] = await Promise.all([
    getDailyBoard(slug),
    listDailyBoardPhotos(slug),
    listProjectReports(slug),
    listProjectChangeOrders(slug),
  ]);
  const latestReport = reports[0];
  const latestBoardPhoto = boardPhotos[0];
  const openVariances = reports.flatMap((report) => report.variances);
  const materialImpactLabel = (variance: { estimatedMaterialImpactDollars?: number; estimatedMaterialImpact?: string }) =>
    variance.estimatedMaterialImpactDollars !== undefined
      ? `$${variance.estimatedMaterialImpactDollars}`
      : variance.estimatedMaterialImpact || "material TBD";

  const saveBoard = saveTodayBoardAction.bind(null, slug);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="grid">
      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Project Board</p>
            <h1>{project.name}</h1>
          </div>
          <div className="button-row">
            <Link className="button" href={`/projects/${project.id}/field-report/new`}>End-of-day report</Link>
            <Link className="button secondary desktop-only" href={`/projects/${project.id}/schedule`}>Schedule import</Link>
            <Link className="button secondary" href="/projects">All projects</Link>
          </div>
        </div>
        <div className="ops-stats">
          <div className="stat"><div className="stat-label">Current phase</div><div className="stat-value">{project.currentPhase || "Unset"}</div></div>
          <div className="stat"><div className="stat-label">Planned end</div><div className="stat-value">{project.plannedEndDate || "Unset"}</div></div>
          <div className="stat"><div className="stat-label">Variances</div><div className="stat-value">{openVariances.length}</div></div>
          <div className="stat"><div className="stat-label">Change order drafts</div><div className="stat-value">{changeOrders.length}</div></div>
        </div>
      </section>

      <section className="columns">
        <div className="card">
          <p className="eyebrow">Morning Whiteboard</p>
          <h2>Plan</h2>
          {latestBoardPhoto ? (
            <div className="list-item">
              <div className="list-row">
                <strong>{latestBoardPhoto.fileName}</strong>
                <span className="badge ready">{latestBoardPhoto.boardDate}</span>
              </div>
              <p className="muted">{latestBoardPhoto.notes || "Board photo saved as today's plan evidence."}</p>
            </div>
          ) : (
            <p className="muted">No board photo uploaded yet.</p>
          )}
          <div className="list">
            {boardTasks.map((task) => (
              <div key={task.id} className="list-item">
                <div className="list-row"><strong>{task.taskName}</strong><span className="badge">{task.phaseCode}</span></div>
                <p className="muted">{task.area} · {task.owner} · {task.plannedHours} planned hours</p>
                {task.readinessDependency ? <p className="muted">Dependency: {task.readinessDependency}</p> : null}
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <p className="eyebrow">Capture Board</p>
          <h2>Upload today's plan</h2>
          <form action={saveBoard} className="form-grid">
            <label>
              <span className="eyebrow">Board date</span>
              <input className="input" type="date" name="boardDate" defaultValue={today} />
            </label>
            <label>
              <span className="eyebrow">Whiteboard photo</span>
              <input className="input" type="file" name="boardPhoto" accept={boardPhotoAccept} />
            </label>
            <label>
              <span className="eyebrow">Board tasks</span>
              <textarea
                className="textarea code-input"
                name="boardTaskText"
                placeholder={`One per line: task, phase code, area, owner, planned hours, dependency`}
              />
            </label>
            <label>
              <span className="eyebrow">Board notes</span>
              <textarea className="textarea" name="boardNotes" />
            </label>
            <button className="button" type="submit">Save board</button>
          </form>
        </div>
      </section>

      <section className="columns">
        <div className="card">
          <p className="eyebrow">Yesterday Informs Tomorrow</p>
          <h2>Latest field reality</h2>
          {latestReport ? (
            <div className="list">
              <div className="list-item">
                <div className="list-row">
                  <strong>{latestReport.reportDate}</strong>
                  <Link className="badge" href={`/projects/${project.id}/reports/${latestReport.id}`}>Open report</Link>
                </div>
                <p className="muted">{latestReport.tomorrowRecommendations}</p>
              </div>
              {latestReport.blockers.map((blocker) => <div className="list-item" key={blocker}>{blocker}</div>)}
            </div>
          ) : <p className="muted">No report submitted yet.</p>}
        </div>

        <div className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Variance Enforcement</p>
              <h2>Open operational exceptions</h2>
            </div>
          </div>
          <div className="list">
            {openVariances.length ? openVariances.map((variance) => (
              <div key={variance.id} className="list-item">
                <div className="list-row">
                  <strong>{variance.description}</strong>
                  <span className="badge high">{variance.requiresChangeOrder === "yes" ? "CO ready" : "review"}</span>
                </div>
                <p className="muted">
                  {variance.affectedArea} · {variance.estimatedLaborImpactHours}h · {materialImpactLabel(variance)}
                  · {variance.estimatedScheduleImpactDays} day(s)
                </p>
              </div>
            )) : <p className="muted">No variances recorded yet.</p>}
          </div>
        </div>
      </section>
    </div>
  );
}
