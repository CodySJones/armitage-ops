import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getOpsProject,
  listProjectChangeOrders,
  listProjectReports,
  listProjectScheduleTasks,
} from "@/lib/ops-store";

type ProjectPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { slug } = await params;
  const [project, reports, changeOrders, scheduleTasks] = await Promise.all([
    getOpsProject(slug),
    listProjectReports(slug),
    listProjectChangeOrders(slug),
    listProjectScheduleTasks(slug),
  ]);

  if (!project) {
    notFound();
  }

  const variances = reports.flatMap((report) => report.variances);
  const pmFillCount = scheduleTasks.filter((task) => task.needsPmFill).length;

  return (
    <div className="grid">
      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{project.status}</p>
            <h1>{project.name}</h1>
          </div>
          <div className="button-row">
            <Link className="button" href={`/projects/${project.id}/board`}>Board</Link>
            <Link className="button secondary" href={`/projects/${project.id}/field-report/new`}>Field report</Link>
            <Link className="button secondary desktop-only" href={`/projects/${project.id}/schedule`}>Schedule</Link>
          </div>
        </div>
        <p className="subtitle">{project.address || project.clientName || "Project details"}</p>
      </section>

      <section className="ops-stats">
        <div className="stat"><div className="stat-label">Current phase</div><div className="stat-value">{project.currentPhase || "Unset"}</div></div>
        <div className="stat"><div className="stat-label">Reports</div><div className="stat-value">{reports.length}</div></div>
        <div className="stat"><div className="stat-label">Variances</div><div className="stat-value">{variances.length}</div></div>
        <div className="stat"><div className="stat-label">PM fill</div><div className="stat-value">{pmFillCount}</div></div>
      </section>

      <section className="columns">
        <div className="card">
          <p className="eyebrow">Project Details</p>
          <div className="list">
            <div className="list-item"><strong>Client</strong><p className="muted">{project.clientName || "Not set"}</p></div>
            <div className="list-item"><strong>Address / scope</strong><p className="muted">{project.address || "Not set"}</p></div>
            <div className="list-item"><strong>Project manager</strong><p className="muted">{project.projectManager || "Not set"}</p></div>
            <div className="list-item"><strong>Field lead</strong><p className="muted">{project.fieldLead || "Not set"}</p></div>
          </div>
        </div>
        <div className="card">
          <p className="eyebrow">Schedule</p>
          <div className="list">
            <div className="list-item"><strong>Planned start</strong><p className="muted">{project.plannedStartDate || "Not set"}</p></div>
            <div className="list-item"><strong>Planned end</strong><p className="muted">{project.plannedEndDate || "Not set"}</p></div>
            <div className="list-item"><strong>Source</strong><p className="muted">{project.scheduleSource || "manual"}</p></div>
            <div className="list-item"><strong>Imported file</strong><p className="muted">{project.scheduleFileName || "None"}</p></div>
          </div>
        </div>
      </section>

      <section className="card">
        <p className="eyebrow">Operational Records</p>
        <div className="button-row">
          <Link className="button secondary" href={`/projects/${project.id}/board`}>Open board</Link>
          <Link className="button secondary" href={`/projects/${project.id}/field-report/new`}>New field report</Link>
          {changeOrders.length ? (
            <Link className="button secondary" href={`/projects/${project.id}/change-orders/${changeOrders[0].id}`}>
              Latest change order draft
            </Link>
          ) : null}
        </div>
      </section>
    </div>
  );
}
