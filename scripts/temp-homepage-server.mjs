import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const state = JSON.parse(fs.readFileSync(path.join(repoRoot, "storage/ops.json"), "utf8"));
const projects = state.projects ?? [];
const reports = state.fieldReports ?? [];
const variances = reports.flatMap((report) => report.variances ?? []);
const changeOrders = state.changeOrderDrafts ?? [];
const boardTasks = state.dailyBoards ?? [];
const scheduleTasks = state.scheduleTasks ?? [];

function layout(title, body) {
  return `<!doctype html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${title}</title>
        <style>
          body { margin: 0; font-family: Arial, Helvetica, sans-serif; background: #eef1f0; color: #17201d; }
          .shell { max-width: 1180px; margin: auto; padding: 24px; display: grid; gap: 18px; }
          .top, .card { background: rgba(255,255,252,.95); border: 1px solid rgba(29,45,39,.13); border-radius: 8px; padding: 22px; box-shadow: 0 14px 34px rgba(26,43,38,.08); }
          .top { display: flex; justify-content: space-between; gap: 16px; align-items: center; }
          .eyebrow, small { text-transform: uppercase; letter-spacing: .14em; color: #62706b; font-size: .72rem; }
          h1 { font-size: clamp(2rem, 4vw, 3.4rem); line-height: .98; margin: .2em 0; }
          .subtitle, .muted { color: #62706b; }
          .buttons, .button-row { display: flex; flex-wrap: wrap; gap: 12px; }
          .button { background: #173a34; color: white; padding: 13px 18px; border-radius: 8px; text-decoration: none; border: 0; }
          .secondary { background: #dce6e1; color: #17201d; }
          .stats, .projects, .columns { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
          .columns { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .stat, .project, .item, .list-item { background: white; border: 1px solid rgba(29,45,39,.13); border-radius: 8px; padding: 16px; display: grid; gap: 8px; text-decoration: none; color: inherit; }
          .value { font-size: 2rem; }
          input, textarea, select { width: 100%; border: 1px solid rgba(29,45,39,.13); border-radius: 8px; padding: 12px; font: inherit; background: white; }
          textarea { min-height: 86px; }
          label { display: grid; gap: 6px; }
          .form-grid { display: grid; gap: 14px; }
          .badge { display: inline-flex; width: fit-content; border-radius: 8px; padding: 7px 10px; background: #f3eadb; color: #17201d; }
          .high { color: #9a3328; background: rgba(154,51,40,.12); }
          @media (max-width: 700px) {
            .top, .stats, .projects, .columns { grid-template-columns: 1fr; display: grid; }
            .shell { padding: 14px; }
          }
        </style>
      </head>
      <body>
        <main class="shell">
          <header class="top">
            <div>
              <div class="eyebrow">Armitage Interiors</div>
              <b>Operations control system</b>
            </div>
            <nav class="buttons">
              <a class="button secondary" href="/">Dashboard</a>
              <a class="button secondary" href="/projects">Projects</a>
              <a class="button secondary" href="/login">Login</a>
            </nav>
          </header>
          ${body}
        </main>
      </body>
    </html>`;
}

function renderHome() {
  const projectCards = projects.length
    ? projects.map((project) => `
        <a class="project" href="/projects/${project.id}">
          <small>${project.status}</small>
          <b>${project.name}</b>
          <span>${project.currentPhase?.trim() || "Phase unset"}</span>
        </a>
      `).join("")
    : "<p>No projects yet.</p>";

  const fieldReportLink = projects[0]
    ? `<a class="button secondary" href="/projects/${projects[0].id}/field-report/new">Submit field report</a>`
    : "";

  return layout("Armitage Ops", `
          <section class="card">
            <div class="eyebrow">ops.armitageinteriors.com</div>
            <h1>Daily field reality, variance enforcement, and change-order readiness.</h1>
            <p class="subtitle">This is not a generic project manager. The morning whiteboard remains the plan. The end-of-day report records whether that plan worked, where it failed, and what must be enforced tomorrow.</p>
            <div class="buttons">
              <a class="button" href="/projects">Open projects</a>
              ${fieldReportLink}
            </div>
          </section>
          <section class="card">
            <div class="eyebrow">Daily Enforcement</div>
            <h2>Exception dashboard</h2>
            <div class="stats">
              <div class="stat"><small>Active projects</small><span class="value">${projects.length}</span></div>
              <div class="stat"><small>Field reports</small><span class="value">${reports.length}</span></div>
              <div class="stat"><small>Open variances</small><span class="value">${variances.length}</span></div>
              <div class="stat"><small>Change order drafts</small><span class="value">${changeOrders.length}</span></div>
            </div>
          </section>
          <section class="card">
            <div class="eyebrow">Active Jobs</div>
            <h2>Project control entry points</h2>
            <div class="projects">${projectCards}</div>
          </section>
      `);
}

function renderProject(project) {
  const projectReports = reports.filter((report) => report.projectId === project.id);
  const projectVariances = projectReports.flatMap((report) => report.variances ?? []);
  const projectChangeOrders = changeOrders.filter((draft) => draft.projectId === project.id);
  const scheduleTasks = state.scheduleTasks?.filter((task) => task.projectId === project.id) ?? [];
  const pmFillCount = scheduleTasks.filter((task) => task.needsPmFill).length;

  return layout(`${project.name} Details`, `
          <section class="card">
            <div class="eyebrow">${project.status}</div>
            <h1>${project.name}</h1>
            <p class="subtitle">${project.address || project.clientName || "Project details"}</p>
            <div class="buttons">
              <a class="button" href="/projects/${project.id}/board">Board</a>
              <a class="button secondary" href="/projects/${project.id}/field-report/new">Field report</a>
              <a class="button secondary" href="/">Homepage</a>
            </div>
          </section>
          <section class="stats">
            <div class="stat"><small>Current phase</small><span class="value">${project.currentPhase?.trim() || "Unset"}</span></div>
            <div class="stat"><small>Reports</small><span class="value">${projectReports.length}</span></div>
            <div class="stat"><small>Variances</small><span class="value">${projectVariances.length}</span></div>
            <div class="stat"><small>PM fill</small><span class="value">${pmFillCount}</span></div>
          </section>
          <section class="columns">
            <div class="card">
              <div class="eyebrow">Project Details</div>
              <div class="item"><b>Client</b><span class="muted">${project.clientName || "Not set"}</span></div>
              <div class="item"><b>Address / scope</b><span class="muted">${project.address || "Not set"}</span></div>
              <div class="item"><b>Project manager</b><span class="muted">${project.projectManager || "Not set"}</span></div>
              <div class="item"><b>Field lead</b><span class="muted">${project.fieldLead || "Not set"}</span></div>
            </div>
            <div class="card">
              <div class="eyebrow">Schedule</div>
              <div class="item"><b>Planned start</b><span class="muted">${project.plannedStartDate || "Not set"}</span></div>
              <div class="item"><b>Planned end</b><span class="muted">${project.plannedEndDate || "Not set"}</span></div>
              <div class="item"><b>Source</b><span class="muted">${project.scheduleSource || "manual"}</span></div>
              <div class="item"><b>Imported file</b><span class="muted">${project.scheduleFileName || "None"}</span></div>
            </div>
          </section>
      `);
}

function renderProjects() {
  const cards = projects.map((project) => {
    const projectReports = reports.filter((report) => report.projectId === project.id);
    const projectVariances = projectReports.flatMap((report) => report.variances ?? []);
    const projectDrafts = changeOrders.filter((draft) => draft.projectId === project.id);
    return `<div class="list-item">
      <div><a href="/projects/${project.id}"><b>${project.name}</b></a> <span class="badge">${project.status}</span></div>
      <p class="muted">${project.address || project.clientName || ""}</p>
      <p class="muted">${projectReports.length} report(s) · ${projectVariances.length} variance(s) · ${projectDrafts.length} change order draft(s)</p>
      <div class="button-row">
        <a class="button secondary" href="/projects/${project.id}/board">Board</a>
        <a class="button secondary" href="/projects/${project.id}/field-report/new">Field report</a>
      </div>
    </div>`;
  }).join("") || "<p>No projects yet.</p>";
  return layout("Projects", `<section class="card"><div class="eyebrow">Projects</div><h1>Residential remodeling operations</h1><p class="subtitle">Daily board, field report, variance log, and PM-reviewed change-order draft queue.</p></section><section class="card"><div class="projects">${cards}</div></section>`);
}

function renderBoard(project) {
  const tasks = boardTasks.filter((task) => task.projectId === project.id);
  const projectReports = reports.filter((report) => report.projectId === project.id);
  const projectVariances = projectReports.flatMap((report) => report.variances ?? []);
  const taskList = tasks.map((task) => `<div class="list-item"><b>${task.taskName}</b><span class="muted">${task.area || "Area unset"} · ${task.phaseCode} · ${task.owner}</span></div>`).join("") || "<p class='muted'>No board tasks yet.</p>";
  return layout(`${project.name} Board`, `
    <section class="card"><div class="eyebrow">Project Board</div><h1>${project.name}</h1><div class="button-row"><a class="button" href="/projects/${project.id}/field-report/new">End-of-day report</a><a class="button secondary" href="/projects/${project.id}">Project details</a><a class="button secondary" href="/projects/${project.id}/schedule">Schedule</a></div></section>
    <section class="stats"><div class="stat"><small>Current phase</small><span class="value">${project.currentPhase || "Unset"}</span></div><div class="stat"><small>Planned end</small><span class="value">${project.plannedEndDate || "Unset"}</span></div><div class="stat"><small>Variances</small><span class="value">${projectVariances.length}</span></div><div class="stat"><small>Reports</small><span class="value">${projectReports.length}</span></div></section>
    <section class="columns"><div class="card"><div class="eyebrow">Morning Whiteboard</div><h2>Plan</h2>${taskList}</div><div class="card"><div class="eyebrow">Capture Board</div><h2>Upload today's plan</h2><form class="form-grid"><label><span class="eyebrow">Board date</span><input type="date" /></label><label><span class="eyebrow">Whiteboard photo</span><input type="file" /></label><label><span class="eyebrow">Board tasks</span><textarea placeholder="One per line: task, phase code, area, owner, planned hours, dependency"></textarea></label><button class="button" type="button">Save board</button></form></div></section>
  `);
}

function renderFieldReport(project) {
  const tasks = boardTasks.filter((task) => task.projectId === project.id);
  const taskRows = tasks.map((task) => `<div class="list-item"><label><input type="checkbox" /> Planned</label><b>${task.taskName}</b><span class="muted">${task.area || "Area unset"} · ${task.phaseCode}</span><label><input type="checkbox" /> Complete</label><label><input type="checkbox" /> Incomplete</label></div>`).join("") || "<p class='muted'>No board tasks loaded yet.</p>";
  return layout(`${project.name} Field Report`, `
    <section class="card"><div class="eyebrow">End-of-day field report</div><h1>${project.name}</h1><p class="subtitle">This report is evidence. It records whether the whiteboard plan worked, what failed, and what must change tomorrow.</p></section>
    <form class="form-grid">
      <section class="card columns"><label><span class="eyebrow">Date</span><input type="date" /></label><label><span class="eyebrow">Submitted by</span><input placeholder="Field lead" /></label></section>
      <section class="card"><div class="eyebrow">Morning Board</div><h2>Planned tasks referenced by this report</h2>${taskRows}</section>
      <section class="card form-grid"><div class="eyebrow">Reality</div><label><span class="eyebrow">Labor entries</span><textarea placeholder="Employee, hours, phase, notes"></textarea></label><label><span class="eyebrow">Blockers</span><textarea></textarea></label><label><span class="eyebrow">Tomorrow recommendations</span><textarea></textarea></label></section>
      <section class="card form-grid"><div class="eyebrow">Variance Log</div><h2>Highest priority</h2><label><span class="eyebrow">Variance type</span><select><option>schedule</option><option>scope</option><option>labor</option><option>cost</option><option>quality</option><option>hidden condition</option><option>client request</option><option>client decision</option></select></label><label><span class="eyebrow">Description</span><textarea></textarea></label><label><span class="eyebrow">Requires change order</span><select><option>unknown</option><option>yes</option><option>no</option></select></label></section>
      <section class="card form-grid"><div class="eyebrow">Proof Photos</div><input type="file" multiple /><textarea placeholder="One caption per photo"></textarea></section>
      <button class="button" type="button">Submit field report</button>
    </form>
  `);
}

function renderSchedule(project) {
  const tasks = scheduleTasks.filter((task) => task.projectId === project.id);
  const rows = tasks.map((task) => `<div class="list-item"><b>${task.taskName}</b><span class="muted">${task.plannedStart || "No start"} to ${task.plannedFinish || "No finish"} · ${task.phaseCode} · ${task.owner}</span></div>`).join("") || "<p class='muted'>No imported schedule tasks.</p>";
  return layout(`${project.name} Schedule`, `<section class="card"><div class="eyebrow">Schedule Import</div><h1>${project.name}</h1><p class="subtitle">Materio provides task name, notes, start, and end. Ops fills phase, area, owner, dependency, and milestone.</p></section><section class="card"><h2>Imported / enriched tasks</h2>${rows}</section>`);
}

function renderReport(project, report) {
  const reportVariances = report.variances ?? [];
  const laborRows = (report.laborEntries ?? []).map((entry) => `<div class="list-item"><b>${entry.employeeName}</b><span class="muted">${entry.hours} hour(s) · ${entry.phaseCode}${entry.taskName ? ` · ${entry.taskName}` : ""}</span></div>`).join("") || "<p class='muted'>No labor entries recorded.</p>";
  const varianceRows = reportVariances.map((variance) => `<div class="list-item"><span class="badge high">${variance.type}</span><b>${variance.description}</b><span class="muted">${variance.affectedArea || "Area unset"} · CO: ${variance.requiresChangeOrder || "unknown"} · Client notified: ${variance.clientNotified ? "yes" : "no"}</span></div>`).join("") || "<p class='muted'>No variances on this report.</p>";

  return layout(`${project.name} Report`, `
    <section class="card">
      <div class="eyebrow">Field Report</div>
      <h1>${project.name}</h1>
      <p class="subtitle">${report.reportDate || "No date"} · submitted by ${report.submittedBy || "field team"}</p>
      <div class="button-row"><a class="button secondary" href="/projects/${project.id}">Project details</a><a class="button secondary" href="/projects/${project.id}/field-report/new">New report</a></div>
    </section>
    <section class="stats">
      <div class="stat"><small>Crew</small><span class="value">${(report.crewMembers ?? []).length}</span></div>
      <div class="stat"><small>Labor lines</small><span class="value">${(report.laborEntries ?? []).length}</span></div>
      <div class="stat"><small>Variances</small><span class="value">${reportVariances.length}</span></div>
      <div class="stat"><small>Proof photos</small><span class="value">${(report.photos ?? []).length}</span></div>
    </section>
    <section class="columns">
      <div class="card"><div class="eyebrow">Labor</div>${laborRows}</div>
      <div class="card"><div class="eyebrow">Variances</div>${varianceRows}</div>
    </section>
    <section class="card"><div class="eyebrow">Tomorrow</div><p>${report.tomorrowRecommendations || "No recommendation recorded."}</p></section>
  `);
}

function renderChangeOrder(project, draft) {
  return layout(`${project.name} Change Order Draft`, `
    <section class="card">
      <div class="eyebrow">Change Order Draft</div>
      <h1>${draft.title || project.name}</h1>
      <p class="subtitle">Draft only. PM review required. Do not auto-send to client.</p>
      <div class="button-row"><a class="button secondary" href="/projects/${project.id}">Project details</a><a class="button secondary" href="/projects/${project.id}/board">Board</a></div>
    </section>
    <section class="stats">
      <div class="stat"><small>Status</small><span class="value">${draft.status || "draft"}</span></div>
      <div class="stat"><small>Labor impact</small><span class="value">${draft.estimatedLaborImpact || "TBD"}</span></div>
      <div class="stat"><small>Material impact</small><span class="value">${draft.estimatedMaterialImpact || "TBD"}</span></div>
      <div class="stat"><small>Schedule impact</small><span class="value">${draft.estimatedScheduleImpact || "TBD"}</span></div>
    </section>
    <section class="card">
      <div class="eyebrow">AI Summary Placeholder</div>
      <p>${draft.summary || draft.scopeSummary || "Variance photos and field notes will be summarized here before PM review."}</p>
    </section>
    <section class="card">
      <div class="eyebrow">Manual Send Control</div>
      <p class="muted">This app prepares the operational record and draft language. Sending stays manual after review.</p>
    </section>
  `);
}

function renderLogin() {
  return layout("Login", `<section class="card"><div class="eyebrow">Internal Access</div><h1>Armitage Ops Login</h1><form class="form-grid"><input placeholder="Email" /><input placeholder="Password" type="password" /><button class="button" type="button">Sign in</button></form></section>`);
}

const server = http.createServer((request, response) => {
  const projectMatch = request.url?.match(/^\/projects\/([^/]+)\/?$/);
  const boardMatch = request.url?.match(/^\/projects\/([^/]+)\/board\/?$/);
  const reportMatch = request.url?.match(/^\/projects\/([^/]+)\/field-report\/new\/?$/);
  const scheduleMatch = request.url?.match(/^\/projects\/([^/]+)\/schedule\/?$/);
  const reportDetailMatch = request.url?.match(/^\/projects\/([^/]+)\/reports\/([^/]+)\/?$/);
  const changeOrderMatch = request.url?.match(/^\/projects\/([^/]+)\/change-orders\/([^/]+)\/?$/);
  const projectId = projectMatch?.[1] ?? boardMatch?.[1] ?? reportMatch?.[1] ?? scheduleMatch?.[1] ?? reportDetailMatch?.[1] ?? changeOrderMatch?.[1];
  const routeProject = projectId ? projects.find((candidate) => candidate.id === projectId) : null;
  const project = projectMatch ? projects.find((candidate) => candidate.id === projectMatch[1]) : null;
  const report = reportDetailMatch ? reports.find((candidate) => candidate.id === reportDetailMatch[2] && candidate.projectId === reportDetailMatch[1]) : null;
  const draft = changeOrderMatch ? changeOrders.find((candidate) => candidate.id === changeOrderMatch[2] && candidate.projectId === changeOrderMatch[1]) : null;

  response.setHeader("content-type", "text/html; charset=utf-8");
  if (request.url === "/projects") response.end(renderProjects());
  else if (request.url === "/login") response.end(renderLogin());
  else if (boardMatch && routeProject) response.end(renderBoard(routeProject));
  else if (reportMatch && routeProject) response.end(renderFieldReport(routeProject));
  else if (scheduleMatch && routeProject) response.end(renderSchedule(routeProject));
  else if (reportDetailMatch && routeProject && report) response.end(renderReport(routeProject, report));
  else if (changeOrderMatch && routeProject && draft) response.end(renderChangeOrder(routeProject, draft));
  else response.end(project ? renderProject(project) : renderHome());
});

server.listen(3000, "0.0.0.0", () => {
  console.log("Temporary Ops homepage: http://localhost:3000/");
});
