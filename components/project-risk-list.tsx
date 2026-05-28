import Link from "next/link";

type ProjectSummary = {
  slug: string;
  name: string;
  riskLevel: string;
  summary: string;
  nextMilestone: string;
  baselineVariance: string;
  workingVariance: string;
};

export function ProjectRiskList({ projects }: { projects: ProjectSummary[] }) {
  return (
    <div className="list">
      {projects.map((project) => (
        <div key={project.slug} className="list-item">
          <div className="list-row">
            <Link href={`/projects/${project.slug}`}>
              <strong>{project.name}</strong>
            </Link>
            <span className={`badge ${project.riskLevel.toLowerCase()}`}>{project.riskLevel} risk</span>
          </div>
          <p className="muted">{project.summary}</p>
          <div className="list-row">
            <span>Next milestone: {project.nextMilestone}</span>
            <span className="muted">
              {project.baselineVariance} vs baseline / {project.workingVariance} vs working
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
