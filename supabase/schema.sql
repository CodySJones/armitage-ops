create extension if not exists "pgcrypto";

create type public.user_role as enum ('owner', 'pm', 'field_lead', 'office');
create type public.project_status as enum ('precon', 'active', 'paused', 'closed');
create type public.task_status as enum ('planned', 'in_progress', 'complete', 'incomplete', 'blocked');
create type public.variance_type as enum (
  'scope',
  'schedule',
  'labor',
  'cost',
  'quality',
  'legal',
  'hidden_condition',
  'client_request',
  'client_decision'
);
create type public.change_order_requirement as enum ('yes', 'no', 'unknown');
create type public.change_order_status as enum ('draft', 'pm_review_required', 'approved_to_send', 'sent_manually');

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  role public.user_role not null default 'field_lead',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  client_name text not null,
  address text,
  status public.project_status not null default 'active',
  current_phase text,
  planned_start date,
  planned_end date,
  actual_end date,
  materio_project_id text,
  fieldwire_project_id text,
  qbo_customer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.daily_boards (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  board_date date not null,
  whiteboard_photo_path text,
  plan_notes text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (project_id, board_date)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  daily_board_id uuid references public.daily_boards(id) on delete set null,
  title text not null,
  area text,
  phase_code text not null,
  planned_date date,
  status public.task_status not null default 'planned',
  owner_name text,
  downstream_trade text,
  fieldwire_task_id text,
  created_at timestamptz not null default now()
);

create table public.field_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  daily_board_id uuid references public.daily_boards(id) on delete set null,
  report_date date not null,
  submitted_by uuid references public.users(id) on delete set null,
  submitted_by_name text,
  crew_members jsonb not null default '[]'::jsonb,
  completed_task_ids uuid[] not null default '{}',
  incomplete_task_ids uuid[] not null default '{}',
  blockers text[] not null default '{}',
  tomorrow_recommendations text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.labor_entries (
  id uuid primary key default gen_random_uuid(),
  field_report_id uuid not null references public.field_reports(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  employee_name text not null,
  hours numeric(5,2) not null check (hours > 0),
  phase_code text not null,
  notes text,
  created_at timestamptz not null default now()
);

create table public.variances (
  id uuid primary key default gen_random_uuid(),
  field_report_id uuid not null references public.field_reports(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  variance_type public.variance_type not null,
  description text not null,
  discovered_by text not null,
  discovered_at timestamptz not null default now(),
  affected_area text,
  estimated_labor_impact_hours numeric(6,2) not null default 0,
  estimated_material_impact text,
  estimated_schedule_impact_days integer not null default 0,
  requires_change_order public.change_order_requirement not null default 'unknown',
  client_notified boolean not null default false,
  internal_notes text,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  field_report_id uuid references public.field_reports(id) on delete cascade,
  variance_id uuid references public.variances(id) on delete set null,
  storage_bucket text not null default 'field-report-photos',
  storage_path text not null,
  caption text,
  uploaded_by uuid references public.users(id) on delete set null,
  uploaded_at timestamptz not null default now()
);

create table public.change_order_drafts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  field_report_id uuid not null references public.field_reports(id) on delete cascade,
  variance_ids uuid[] not null default '{}',
  title text not null,
  ai_summary text,
  scope_narrative text,
  labor_impact_hours numeric(6,2) not null default 0,
  material_impact text,
  schedule_impact_days integer not null default 0,
  status public.change_order_status not null default 'pm_review_required',
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index field_reports_project_date_idx on public.field_reports(project_id, report_date desc);
create index variances_project_status_idx on public.variances(project_id, status, requires_change_order);
create index photos_report_idx on public.photos(field_report_id);
create index change_order_drafts_project_status_idx on public.change_order_drafts(project_id, status);

alter table public.users enable row level security;
alter table public.projects enable row level security;
alter table public.daily_boards enable row level security;
alter table public.tasks enable row level security;
alter table public.field_reports enable row level security;
alter table public.labor_entries enable row level security;
alter table public.variances enable row level security;
alter table public.photos enable row level security;
alter table public.change_order_drafts enable row level security;

create policy "internal users read users" on public.users for select using (auth.uid() is not null);
create policy "internal users read projects" on public.projects for select using (auth.uid() is not null);
create policy "internal users manage boards" on public.daily_boards for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "internal users manage tasks" on public.tasks for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "internal users manage reports" on public.field_reports for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "internal users manage labor" on public.labor_entries for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "internal users manage variances" on public.variances for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "internal users manage photos" on public.photos for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "internal users manage change order drafts" on public.change_order_drafts for all using (auth.uid() is not null) with check (auth.uid() is not null);

insert into storage.buckets (id, name, public)
values ('field-report-photos', 'field-report-photos', false)
on conflict (id) do nothing;
