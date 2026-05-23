# Baseline Technical Build Spec

## Product Definition

Baseline is an internal project-control web app for a residential remodeling company. It is not client-facing and it is not a general project management system. Its purpose is to compare:

- the original contract payment schedule
- the current working project schedule
- the company's required order of operations
- the daily field report

Baseline then warns ownership when field reality is drifting in a way that threatens payment timing, required sequence, handoffs, or schedule credibility.

## Product Boundaries

### In Scope for MVP

- Project records
- Contract payment milestones
- Baseline schedule import or manual entry
- Schedule revision history
- Order-of-operations rules
- Structured daily field reports
- Photo requirement enforcement by phase/work type
- Rules engine that creates operational alerts
- Owner exceptions dashboard
- Carpenter-first daily report UI

### Explicitly Out of Scope for MVP

- OCR or AI interpretation of documents/photos
- Accounting integrations
- Client portal
- Calendar sync
- Full project management replacement
- Crew time tracking
- Change-order pricing workflows
- Invoicing or payment collection

## Core Users

### Owner / Operations Lead

Needs an exceptions board showing which jobs need intervention and why.

### Project Manager / Office Admin

Needs to load baseline contract and schedule data, maintain schedule revisions, and resolve alerts.

### Carpenter / Field Lead

Needs to submit a very fast, structured daily report that feels like a digital whiteboard, not office paperwork.

## Core Entities

1. Project
2. Contract payment milestone
3. Schedule revision
4. Schedule task
5. Phase rule / prerequisite rule
6. Daily field report
7. Daily report task item
8. Blocker
9. Photo requirement
10. Uploaded photo
11. Alert
12. Action owner / assignment

## Recommended MVP Stack

### Application

- Next.js with App Router
- TypeScript
- Server Actions or route handlers for form workflows

### Database

- PostgreSQL
- Prisma ORM

### UI

- Simple responsive UI with a strong field-first workflow
- Avoid generic admin-table-first UX

### Storage

- Local or S3-compatible object storage for photos

### Auth

- Internal email/password or magic-link auth
- Role-based access: owner, office, field

## Data Model

The schema below is normalized enough for rules processing but still practical for an MVP.

### users

| column | type | notes |
| --- | --- | --- |
| id | uuid | pk |
| name | text | |
| email | text | unique |
| role | enum | `OWNER`, `OFFICE`, `FIELD` |
| active | boolean | default true |
| created_at | timestamptz | |

### projects

| column | type | notes |
| --- | --- | --- |
| id | uuid | pk |
| code | text | internal job number |
| name | text | |
| client_name | text | optional for internal reference |
| address | text | |
| status | enum | `PRECON`, `ACTIVE`, `PAUSED`, `CLOSED` |
| current_phase | text | cached convenience field |
| start_date | date | optional |
| target_end_date | date | optional |
| created_at | timestamptz | |

### payment_milestones

| column | type | notes |
| --- | --- | --- |
| id | uuid | pk |
| project_id | uuid | fk projects |
| sequence_no | integer | order in contract |
| name | text | |
| trigger_description | text | human contract language |
| amount_cents | integer | |
| planned_bill_date | date | optional imported target |
| active | boolean | |

### milestone_conditions

Stores structured milestone logic so the rules engine does not rely only on prose.

| column | type | notes |
| --- | --- | --- |
| id | uuid | pk |
| milestone_id | uuid | fk payment_milestones |
| condition_type | enum | `TASK_COMPLETE`, `PHASE_COMPLETE`, `PHOTO_SET_PRESENT`, `NO_OPEN_BLOCKERS`, `CUSTOM_CHECKLIST` |
| reference_key | text | task id, phase code, or checklist key |
| required | boolean | |

### schedules

Each project keeps multiple schedule revisions. Revision 1 is the permanent baseline.

| column | type | notes |
| --- | --- | --- |
| id | uuid | pk |
| project_id | uuid | fk projects |
| revision_no | integer | baseline is 1 |
| is_baseline | boolean | true only for original |
| is_active | boolean | true for current approved working schedule |
| effective_date | date | |
| author_id | uuid | fk users |
| reason | text | why revision exists |
| imported_from | text | pdf/manual/csv |
| created_at | timestamptz | |

### schedule_tasks

| column | type | notes |
| --- | --- | --- |
| id | uuid | pk |
| schedule_id | uuid | fk schedules |
| external_ref | text | optional import key |
| phase_code | text | |
| area | text | kitchen, bath 1, exterior, etc |
| name | text | |
| start_date | date | planned |
| end_date | date | planned |
| duration_days | integer | |
| status | enum | `NOT_STARTED`, `IN_PROGRESS`, `COMPLETE`, `BLOCKED` |
| sort_order | integer | |

### task_dependencies

| column | type | notes |
| --- | --- | --- |
| id | uuid | pk |
| schedule_task_id | uuid | dependent task |
| depends_on_task_id | uuid | prerequisite task |
| dependency_type | enum | `FS`, `SS`, `CHECKLIST` |

### phase_rules

These model the company's order of operations.

| column | type | notes |
| --- | --- | --- |
| id | uuid | pk |
| project_id | uuid nullable | null means global company rule |
| phase_code | text | |
| rule_type | enum | `REQUIRES_PHASE`, `REQUIRES_TASK`, `BLOCKS_TASK`, `PHOTO_REQUIREMENT`, `HANDOFF_REQUIREMENT`, `PREREQUISITE` |
| subject_key | text | what is being reported |
| required_key | text | what must exist first |
| severity | enum | `INFO`, `WARN`, `CRITICAL` |
| message_template | text | owner-facing explanation |
| active | boolean | |

### photo_requirements

| column | type | notes |
| --- | --- | --- |
| id | uuid | pk |
| project_id | uuid nullable | null means global default |
| phase_code | text | |
| task_key | text nullable | optional narrower trigger |
| category | enum | `ROOM_OVERVIEW`, `DETAIL`, `HIDDEN_WORK`, `BLOCKER_EVIDENCE`, `HANDOFF_READY` |
| min_count | integer | default 1 |
| required_when_complete | boolean | |

### daily_reports

| column | type | notes |
| --- | --- | --- |
| id | uuid | pk |
| project_id | uuid | fk projects |
| report_date | date | |
| crew_name | text | |
| submitted_by_id | uuid | fk users |
| current_phase | text | |
| areas_worked | jsonb | array of strings |
| planned_tomorrow | text | short structured summary |
| needed_next | text | short structured summary |
| source_type | enum | `DIRECT_ENTRY`, `WHITEBOARD_PHOTO` |
| confirmation_status | enum | `PENDING_CONFIRMATION`, `CONFIRMED` |
| created_at | timestamptz | |

### daily_report_items

Stores actual structured work entries.

| column | type | notes |
| --- | --- | --- |
| id | uuid | pk |
| daily_report_id | uuid | fk daily_reports |
| item_type | enum | `COMPLETED`, `STARTED_NOT_FINISHED`, `PLANNED_TOMORROW`, `NEEDED_NEXT` |
| phase_code | text | |
| area | text | |
| task_name | text | |
| linked_schedule_task_id | uuid nullable | fk schedule_tasks |

### blockers

| column | type | notes |
| --- | --- | --- |
| id | uuid | pk |
| project_id | uuid | fk projects |
| daily_report_id | uuid nullable | source report |
| title | text | |
| description | text | |
| blocker_type | enum | `MATERIAL`, `SUBCONTRACTOR`, `INSPECTION`, `DECISION`, `SITE_CONDITION`, `OTHER` |
| owner_id | uuid nullable | required after creation |
| due_date | date nullable | required after creation |
| status | enum | `OPEN`, `IN_PROGRESS`, `RESOLVED` |
| created_at | timestamptz | |

### report_photos

| column | type | notes |
| --- | --- | --- |
| id | uuid | pk |
| daily_report_id | uuid | fk daily_reports |
| category | enum | same as photo requirement category |
| storage_key | text | |
| caption | text nullable | |
| uploaded_at | timestamptz | |

### alerts

| column | type | notes |
| --- | --- | --- |
| id | uuid | pk |
| project_id | uuid | fk projects |
| daily_report_id | uuid nullable | if triggered by report |
| alert_type | enum | `PAYMENT_RISK`, `SEQUENCE_VIOLATION`, `PREREQUISITE_FAILURE`, `FALSE_PROGRESS`, `UNOWNED_BLOCKER`, `MISSING_PHOTOS`, `UNREALISTIC_TOMORROW` |
| severity | enum | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| status | enum | `OPEN`, `ACKNOWLEDGED`, `RESOLVED` |
| title | text | |
| detail | text | |
| action_required | text | specific management action |
| owner_id | uuid nullable | who should resolve |
| created_at | timestamptz | |
| resolved_at | timestamptz nullable | |

### alert_evidence

Optional join table that records why an alert exists.

| column | type | notes |
| --- | --- | --- |
| id | uuid | pk |
| alert_id | uuid | fk alerts |
| evidence_type | enum | `MILESTONE`, `SCHEDULE_TASK`, `BLOCKER`, `RULE`, `PHOTO_REQUIREMENT`, `DAILY_REPORT_ITEM` |
| evidence_id | uuid | referenced row id |

## Key Derived Concepts

### Next Payment Milestone

The next active contract milestone not yet satisfied.

### Baseline Variance

Difference between actual progress and schedule revision 1.

### Working Variance

Difference between actual progress and the current approved active schedule.

### Handoff Readiness

Whether all prerequisites, open items, and photo requirements are complete for the next phase or responsible trade.

## Rules Engine Design

The rules engine should run:

- on daily report submission
- on blocker creation/update
- on schedule revision approval
- on manual re-evaluation from the owner dashboard

For MVP, the engine can be deterministic application code with SQL reads, not a separate rules platform.

### Evaluation Order

1. Load active project context
2. Load baseline schedule and active working schedule
3. Load next unpaid milestone and its conditions
4. Load project/company phase rules
5. Load current open blockers
6. Load latest confirmed field report
7. Evaluate alert conditions
8. Upsert open alerts and resolve stale alerts

## Core Alert Logic

### 1. Payment Risk

Trigger when the next milestone's required tasks or phases are unlikely to be complete by the milestone target date, or when recent reported work does not materially advance milestone conditions.

Example logic:

- Determine milestone conditions
- Check percent of required tasks complete
- Check whether remaining work can fit in remaining scheduled days
- If remaining prerequisites are unchanged across multiple daily reports, raise risk

Suggested alert text:

"Tile waterproofing draw is at risk. Required completion evidence is missing and two prerequisite tasks remain open with three days left to planned billing."

### 2. Sequence Violation

Trigger when reported completed or in-progress work conflicts with the order-of-operations rules.

Example:

- Finish flooring reported started
- Required_key says paint complete and punch carpentry complete first
- If those are still open, create sequence violation

### 3. Prerequisite Failure

Trigger when tomorrow's plan or active scheduled work depends on an unmet requirement.

Examples:

- Cabinet install planned but cabinets not delivered
- Flooring planned but acclimation not logged complete
- Inspection correction work needed before close-in can proceed

### 4. False Progress

Trigger when labor is reported but remaining prerequisites for the next payment milestone do not shrink.

Simple MVP heuristic:

- Compare unresolved milestone conditions before and after each report
- If crew logged meaningful work for 2 or more reports and unresolved milestone conditions remain unchanged, create alert

### 5. Unowned Blocker

Trigger whenever an open blocker lacks both an owner and a due date.

This should be immediate and very visible.

### 6. Missing Photos

Trigger when reported work marks a phase/task complete but required photo categories are not fully uploaded.

### 7. Unrealistic Tomorrow

Trigger when planned tomorrow work references a task whose prerequisite tasks, blockers, or required material state are not satisfied.

## Schedule Comparison Logic

Actual progress should be compared against two schedule anchors:

### Baseline Schedule

Never overwritten. Used to measure original drift.

### Active Working Schedule

Current approved plan. Used to measure current operational realism.

For each project, compute:

- days ahead/behind baseline for current phase
- days ahead/behind working schedule for current phase
- late tasks count
- blocked tasks count
- milestone risk level

## Owner Dashboard

The owner dashboard is an exceptions board, not a generic activity feed.

### Project Card Fields

- project name
- current phase
- next payment milestone
- milestone risk level
- next required handoff
- open blockers
- sequence violations
- unresolved prerequisites
- variance vs baseline
- variance vs working schedule
- required management action

### Default Sorting

- critical alerts first
- then projects with payment risk
- then projects with unresolved blockers

### Recommended Dashboard Views

1. All active projects
2. Payment risk
3. Sequence / prerequisite issues
4. Blockers needing owner action

## Carpenter / Field Interface

The field UI should feel like a digital whiteboard.

### Daily Report Form Fields

- project
- date
- crew
- current phase
- areas worked in
- tasks completed today
- tasks started but not finished
- blockers
- planned work for tomorrow
- needed next
- photos

### UX Rules

- mobile-first
- one short form flow
- minimal typing
- repeatable task chips or rows
- photo uploads embedded in the same flow
- blocker entry should immediately require owner and due date before final submission or route to office completion

## Core Pages

### 1. Login

Internal authentication only.

### 2. Owner Dashboard

Exceptions board across all active projects.

### 3. Projects List

Filterable list with risk summaries.

### 4. Project Detail

Tabs:

- overview
- payment milestones
- schedules
- daily reports
- blockers
- alerts
- rules

### 5. New / Edit Project

Create project and seed baseline data.

### 6. Payment Milestone Editor

Define milestone amounts and structured conditions.

### 7. Schedule Revision Manager

Upload or enter new schedule revisions without overwriting older ones.

### 8. Rules / Order-of-Operations Editor

Manage phase prerequisites and sequence rules.

### 9. Daily Report Entry

Fast carpenter workflow.

### 10. Alert Queue

Cross-project alert management and resolution.

## Suggested MVP Workflow

### Project Setup

1. Create project
2. Enter payment milestones
3. Import or enter baseline schedule
4. Define order-of-operations rules
5. Mark schedule revision 1 as baseline

### Schedule Revision

1. Add new revision
2. Provide author, date, reason
3. Mark as active
4. Preserve all previous revisions
5. Recompute variance and alerts

### Daily Field Reporting

1. Field lead opens today's report
2. Enters structured work and blockers
3. Uploads required photos
4. Submits
5. Rules engine evaluates immediately
6. Dashboard updates required actions

## API / Service Boundaries

For a clean implementation, organize server-side logic into modules:

- `projectService`
- `scheduleService`
- `milestoneService`
- `dailyReportService`
- `photoRequirementService`
- `rulesEngineService`
- `alertService`

## Example Rule Pseudocode

```ts
function evaluateUnrealisticTomorrow(context: ProjectContext): Alert[] {
  const alerts: Alert[] = [];

  for (const item of context.tomorrowItems) {
    const unmetTaskDeps = getUnmetDependencies(item, context.activeSchedule);
    const unmetPhaseRules = getUnmetPhaseRules(item, context.phaseRules);
    const blockingBlockers = getBlockingOpenBlockers(item, context.blockers);

    if (unmetTaskDeps.length || unmetPhaseRules.length || blockingBlockers.length) {
      alerts.push({
        type: "UNREALISTIC_TOMORROW",
        severity: "HIGH",
        title: `${item.taskName} is planned tomorrow without prerequisites`,
        detail: buildDetail(unmetTaskDeps, unmetPhaseRules, blockingBlockers),
        actionRequired: "Re-plan tomorrow's work or clear prerequisites before start of day.",
      });
    }
  }

  return alerts;
}
```

## Seed Data Recommendations

Build the app with one realistic demo project that includes:

- 4 to 6 payment milestones
- 12 to 20 schedule tasks across multiple phases
- at least 1 baseline schedule and 1 revised working schedule
- several order-of-operations rules
- a few daily reports with blockers and photos
- examples of each major alert category

That demo data will matter because the value of this app is in showing exceptions, not empty CRUD forms.

## Acceptance Criteria for MVP

### Data and History

- A project can store one baseline schedule and many revisions
- Schedule revisions never overwrite previous versions
- A project can store payment milestones with structured conditions
- A daily report can be submitted with structured work items and photos

### Rules and Alerts

- Submitting a daily report triggers rule evaluation
- The system can create alerts for payment risk, sequence violation, prerequisite failure, false progress, unowned blocker, missing photos, and unrealistic tomorrow
- Alerts include a specific action required
- Alerts can be acknowledged and resolved

### Dashboard

- The dashboard shows active project exceptions, not raw logs
- Each project shows both baseline variance and working variance
- Owner can identify the next intervention without opening every report

### Field UX

- A field lead can submit a report from a tablet or phone in a few minutes
- Required photo categories are enforced by rule
- Blockers cannot disappear without ownership

## Implementation Plan

### Phase 1

- Scaffold app
- Create auth and roles
- Build core schema
- Build project setup pages

### Phase 2

- Build schedule revisions and task dependency model
- Build daily report flow with photos
- Build blocker ownership workflow

### Phase 3

- Implement rules engine
- Implement alerts and dashboard exceptions board
- Add demo seed data

### Phase 4

- Polish mobile field UX
- Add CSV/PDF-assisted schedule import
- Add reporting and audit improvements

## Recommended First Build Order

If starting implementation immediately, build in this order:

1. Prisma schema and database migrations
2. Seed script with one demo project
3. Owner dashboard shell
4. Daily report form
5. Rules engine and alert generation
6. Schedule revision management
7. Photo requirement enforcement

## Open Decisions

These can be decided while building, but they should be explicit:

- Whether milestone conditions are fully structured, partially structured, or stored as checklist templates
- Whether blockers must be assigned by field at entry time or by office during same-day triage
- Whether schedule import starts as manual entry only, then PDF-assisted later
- Whether project-specific rules override company default rules or layer on top of them

## Summary

Baseline should be built as a narrow project-control system centered on one daily question:

"Did today's reported work make the job more billable, more sequence-correct, and more realistically on track?"

If not, the app should tell ownership exactly what is wrong and what action is required next.
