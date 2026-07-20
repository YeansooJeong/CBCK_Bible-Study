-- CBCK 문제은행 초기 스키마 (cbck_bank_plan.md 3장, 10장 기준)

create extension if not exists pgcrypto;

-- 3장: 기수 (인증질문 정답 저장소)
create table cohorts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  staff_name text not null,
  leader_name text not null,
  kjv_year text not null,
  created_at timestamptz default now()
);

-- 10장: 학생 계정 (전화번호 해시+암호화 이중 저장)
create table users (
  id uuid primary key default gen_random_uuid(),
  phone_hash text unique not null,
  phone_encrypted bytea not null,
  name text not null,
  display_name text,
  cohort_id uuid references cohorts(id),
  password_hash text not null,
  failed_attempts int default 0,
  locked_until timestamptz,
  status text default 'pending',
  created_at timestamptz default now()
);

create table admins (
  id uuid primary key default gen_random_uuid(),
  login_id text unique not null,
  password_hash text not null,
  created_at timestamptz default now()
);

-- 3장: 문제 묶음
create table projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users(id) on delete cascade,
  title text not null,
  share_scope text not null default 'private' check (share_scope in ('private', 'all', 'selected')),
  created_at timestamptz default now()
);

-- 3장: 문제 본체
create table problems (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  type text not null check (type in ('mcq', 'short', 'bible')),
  question text not null,
  options jsonb,
  answer text not null,
  keywords text,
  ref_course text,
  ref_session text,
  ref_location text,
  share_scope text not null default 'inherit' check (share_scope in ('inherit', 'private', 'all', 'selected')),
  created_at timestamptz default now()
);

create table project_shares (
  project_id uuid not null references projects(id) on delete cascade,
  target_user_id uuid not null references users(id) on delete cascade,
  primary key (project_id, target_user_id)
);

create table problem_shares (
  problem_id uuid not null references problems(id) on delete cascade,
  target_user_id uuid not null references users(id) on delete cascade,
  primary key (problem_id, target_user_id)
);

-- 7장: 풀이 세션
create table quiz_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  started_at timestamptz default now(),
  total int default 0,
  correct int default 0
);

create table session_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references quiz_sessions(id) on delete cascade,
  problem_id uuid not null references problems(id),
  user_answer text,
  is_correct boolean,
  match_score numeric
);

-- 10장: 개인정보 접근 감사 로그
create table access_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  target_user_id uuid,
  action text,
  created_at timestamptz default now()
);

-- 10-3장: RLS 활성화
alter table cohorts enable row level security;
alter table users enable row level security;
alter table admins enable row level security;
alter table projects enable row level security;
alter table problems enable row level security;
alter table project_shares enable row level security;
alter table problem_shares enable row level security;
alter table quiz_sessions enable row level security;
alter table session_answers enable row level security;
alter table access_audit_log enable row level security;

-- users: 본인 행만 조회/수정 가능, admin은 전체 조회 가능
create policy "users_select_own_or_admin" on users
  for select using (
    auth.uid()::text = id::text
    or exists (select 1 from admins where admins.id = auth.uid())
  );

create policy "users_update_own" on users
  for update using (auth.uid()::text = id::text);

-- projects: 소유자만 조회/수정/삭제, 공유 대상은 조회만 가능
create policy "projects_select_owner_or_shared" on projects
  for select using (
    owner_id = auth.uid()
    or share_scope = 'all'
    or exists (
      select 1 from project_shares
      where project_shares.project_id = projects.id
        and project_shares.target_user_id = auth.uid()
    )
  );

create policy "projects_modify_owner" on projects
  for all using (owner_id = auth.uid());

-- problems: 문제 share_scope가 inherit이면 상위 project 규칙을 따르고,
-- 개별 지정 시 문제 설정이 우선 (6장 공유 우선순위 정책)
create policy "problems_select_owner_or_shared" on problems
  for select using (
    exists (
      select 1 from projects
      where projects.id = problems.project_id and projects.owner_id = auth.uid()
    )
    or (problems.share_scope = 'all')
    or (
      problems.share_scope = 'inherit'
      and exists (
        select 1 from projects
        where projects.id = problems.project_id
          and (
            projects.share_scope = 'all'
            or exists (
              select 1 from project_shares
              where project_shares.project_id = projects.id
                and project_shares.target_user_id = auth.uid()
            )
          )
      )
    )
    or exists (
      select 1 from problem_shares
      where problem_shares.problem_id = problems.id
        and problem_shares.target_user_id = auth.uid()
    )
  );

create policy "problems_modify_owner" on problems
  for all using (
    exists (
      select 1 from projects
      where projects.id = problems.project_id and projects.owner_id = auth.uid()
    )
  );

-- quiz_sessions / session_answers: 본인 것만 조회/수정
create policy "quiz_sessions_own" on quiz_sessions
  for all using (user_id = auth.uid());

create policy "session_answers_own" on session_answers
  for all using (
    exists (
      select 1 from quiz_sessions
      where quiz_sessions.id = session_answers.session_id
        and quiz_sessions.user_id = auth.uid()
    )
  );

-- access_audit_log: admin만 조회 가능, 삽입은 서버(Edge Function)만 수행
create policy "audit_log_admin_only" on access_audit_log
  for select using (exists (select 1 from admins where admins.id = auth.uid()));

-- cohorts: 인증질문 정답이 포함되므로 일반 조회 금지, 서버(Edge Function)에서만 접근
-- (RLS 활성화만 하고 select policy를 만들지 않아 기본적으로 모든 접근 차단)
