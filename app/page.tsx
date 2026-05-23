import Link from "next/link";
import { listOpsProjects, listProjectChangeOrders, listProjectReports } from "@/lib/ops-store";

export default async function HomePage() {
  const projects = await listOpsProjects();
  const reportGroups = await Promise.all(projects.map((project) => listProjectReports(project.id)));
  const changeOrderGroups = await Promise.all(projects.map((project) => listProjectChangeOrders(project.id)));
  const reports = reportGroups.flat();
  const variances = reports.flatMap((report) => report.variances);
  const changeOrders = changeOrderGroups.flat();
  const openBlockers = reports.flatMap((report) => report.blockers);
  const materialImpactLabel = (variance: { estimatedMaterialImpactDollars?: number; estimatedMaterialImpact?: string }) =>
    variance.estimatedMaterialImpactDollars !== undefined
      ? `$${variance.estimatedMaterialImpactDollars}`
      : variance.estimatedMaterialImpact || "material TBD";

  return (
    <div className="grid">
      <section className="card hero ops-hero">
        <div>
          <p className="eyebrow">ops.armitageinteriors.com</p>
          <h1 className="title">Daily field reality, variance enforcement, and change-order readiness.</h1>
        </div>
        <p className="subtitle">
          This is not a generic project manager. The morning whiteboard remains the plan. The end-of-day
          report records whether that plan worked, where it failed, and what must be enforced tomorrow.
        </p>
        <div className="button-row">
          <Link className="button" href="/projects">Open projects</Link>
          <Link className="button secondary desktop-only" href="/projects/new">Start new project</Link>
          {projects[0] ? (
            <Link className="button secondary" href={`/projects/${projects[0].id}/field-report/new`}>
              Submit field report
            </Link>
          ) : null}
        </div>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Daily Enforcement</p>
            <h2>Exception dashboard</h2>
          </div>
          <span className="kicker">Preview data</span>
        </div>
        <div className="ops-stats">
          <div className="stat"><div className="stat-label">Active projects</div><div className="stat-value">{projects.length}</div></div>
          <div className="stat"><div className="stat-label">Field reports</div><div className="stat-value">{reports.length}</div></div>
          <div className="stat"><div className="stat-label">Open variances</div><div className="stat-value">{variances.length}</div></div>
          <div className="stat"><div className="stat-label">Change order drafts</div><div className="stat-value">{changeOrders.length}</div></div>
        </div>
      </section>

      <section className="columns">
        <div className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Highest Priority</p>
              <h2>Variance log</h2>
            </div>
          </div>
          <div className="list">
            {variances.length ? variances.map((variance) => (
              <div key={variance.id} className="list-item">
                <div className="list-row">
                  <strong>{variance.affectedArea || variance.type}</strong>
                  <span className="badge high">{variance.type.replace("_", " ")}</span>
                </div>
                <p className="muted">{variance.description}</p>
                <p className="muted">
                  Impact: {variance.estimatedLaborImpactHours}h labor, {materialImpactLabel(variance)},
                  {` ${variance.estimatedScheduleImpactDays}`} day(s)
                </p>
              </div>
            )) : <p className="muted">No variances recorded yet.</p>}
          </div>
        </div>
        <div className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Operational Drag</p>
              <h2>Current blockers</h2>
            </div>
          </div>
          <div className="list">
            {openBlockers.length ? openBlockers.map((blocker, index) => (
              <div key={`${blocker}-${index}`} className="list-item">{blocker}</div>
            )) : <p className="muted">No blockers recorded yet.</p>}
          </div>
        </div>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Active Jobs</p>
            <h2>Project control entry points</h2>
          </div>
        </div>
        <div className="project-grid">
          {projects.map((project) => (
            <Link className="project-card" key={project.id} href={`/projects/${project.id}`}>
              <span className="eyebrow">{project.status}</span>
              <strong>{project.name}</strong>
              <span className="muted">{project.currentPhase}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
