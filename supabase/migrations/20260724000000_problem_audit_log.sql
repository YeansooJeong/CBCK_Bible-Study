-- 문제 생성/수정/삭제 이력 로그 (Super Admin 전용 조회)
create table problem_audit_log (
  id bigint generated always as identity primary key,
  problem_id uuid,
  actor_id uuid,
  actor_role text not null check (actor_role in ('admin', 'general_admin', 'student')),
  action text not null check (action in ('create', 'update', 'delete')),
  question_snapshot text,
  ref_course text,
  ref_session text,
  created_at timestamptz default now()
);

alter table problem_audit_log enable row level security;

-- problem_audit_log: admin만 조회 가능, 삽입은 서버(Edge Function)만 수행
create policy "problem_audit_log_admin_only" on problem_audit_log
  for select using (exists (select 1 from admins where admins.id = auth.uid()));
