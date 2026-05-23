import Link from "next/link";
import { listOpsProjects, listProjectChangeOrders, listProjectReports } from "@/lib/ops-store";

export default async function ProjectsPage() {
  const projects = await listOpsProjects();
  const rollups = await Promise.all(
    projects.map(async (project) => {
      const [reports, drafts] = await Promise.all([listProjectReports(project.id), listProjectChangeOrders(project.id)]);
      return { project, reports, drafts, variances: reports.flatMap((report) => report.variances) };
    }),
  );

  return (
    <div className="grid">
      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Projects</p>
            <h1>Residential remodeling operations</h1>
          </div>
        </div>
        <p className="subtitle">
          Each project centers on the daily board, end-of-day report, variance log, and PM-reviewed change-order draft queue.
        </p>
      </section>

      <section className="columns">
        <div className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Active</p>
              <h2>Jobs</h2>
            </div>
          </div>
          <div className="list">
            {rollups.length > 0 ? rollups.map(({ project, reports, drafts, variances }) => (
              <div key={project.id} className="list-item">
                <div className="list-row">
                  <Link href={`/projects/${project.id}`}><strong>{project.name}</strong></Link>
                  <span className="badge ready">
                    {project.status}
                  </span>
                </div>
                <p className="muted">{project.address || project.clientName}</p>
                <p className="muted">
                  {reports.length} report(s) · {variances.length} variance(s) · {drafts.length} change order draft(s)
                </p>
                <div className="button-row compact-actions">
                  <Link className="button secondary" href={`/projects/${project.id}/board`}>Board</Link>
                  <Link className="button secondary" href={`/projects/${project.id}/field-report/new`}>Field report</Link>
                </div>
              </div>
            )) : (
              <div className="list-item">
                <strong>No projects yet</strong>
                <p className="muted">Start onboarding to create the first real Armitage operations record.</p>
                <Link className="button desktop-only" href="/projects/new">Start onboarding</Link>
              </div>
            )}
          </div>
        </div>
        <div className="card desktop-only">
          <div className="section-heading">
            <div>
              <p className="eyebrow">New Project</p>
              <h2>Add job</h2>
            </div>
          </div>
          <p className="muted">
            Use the onboarding flow so each job starts with project identity, team, spreadsheet schedule import,
            and a first daily board.
          </p>
          <Link className="button" href="/projects/new">Start onboarding</Link>
        </div>
      </section>
    </div>
  );
}
