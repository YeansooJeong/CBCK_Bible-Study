-- 개인정보 보관기간 관리와 자동 파기
--
-- 보관기간: 활성 계정은 최종 접속 후 1년, 활성화하지 않은 계정은 등록 후 1년.
--
-- 계정 행 자체는 지우지 않는다. problems.author_id와 projects.owner_id가
-- on delete cascade라서 행을 지우면 그 사람이 만든 문제까지 함께 사라진다.
-- 대신 개인정보(전화번호·비밀번호·표시명·기수)만 지우고 행은 남긴다.
-- 이름(name)은 관리자가 문제 작성자를 확인할 수 있도록 보존한다.

alter table users alter column phone_hash drop not null;
alter table users alter column phone_encrypted drop not null;
alter table users alter column password_hash drop not null;

alter table users add column if not exists last_seen_at timestamptz;
alter table users add column if not exists purged_at timestamptz;
alter table users add column if not exists withdrawn_at timestamptz;
alter table users add column if not exists withdrawal_reason text;

create index if not exists users_retention_idx on users (purged_at, last_seen_at, created_at);

-- 파기 실행 이력. 고지한 대로 파기가 이뤄졌음을 확인할 수 있어야 한다.
create table if not exists privacy_purge_log (
  id bigint generated always as identity primary key,
  purged_count int not null,
  reason text not null,
  executed_at timestamptz not null default now()
);
alter table privacy_purge_log enable row level security;

-- 한 사람의 개인정보를 파기한다. 탈퇴(즉시)와 보관기간 만료(자동) 모두 이 함수를 쓴다.
create or replace function purge_user_personal_data(target_id uuid, reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 학습 활동 기록은 개인 기록이므로 함께 지운다.
  -- session_answers는 quiz_sessions에 on delete cascade로 묶여 있다.
  delete from quiz_sessions where user_id = target_id;
  delete from problem_bookmarks where user_id = target_id;
  delete from problem_shares where target_user_id = target_id;
  delete from project_shares where target_user_id = target_id;

  update users set
    phone_hash = null,
    phone_encrypted = null,
    password_hash = null,
    display_name = null,
    cohort_id = null,
    failed_attempts = 0,
    locked_until = null,
    status = 'purged',
    purged_at = now(),
    withdrawal_reason = coalesce(users.withdrawal_reason, reason)
  where id = target_id and purged_at is null;
end;
$$;

-- 보관기간이 지난 계정을 찾아 파기한다. 매일 1회 자동 실행된다.
create or replace function purge_expired_users()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid;
  purged int := 0;
begin
  for target in
    select id from users
    where purged_at is null
      and (
        -- 활성화하지 않은 계정: 등록 후 1년
        (status = 'pending' and created_at < now() - interval '1 year')
        -- 그 밖의 계정: 최종 접속 후 1년(접속 기록이 없으면 등록일 기준)
        or (status <> 'pending' and coalesce(last_seen_at, created_at) < now() - interval '1 year')
      )
  loop
    perform purge_user_personal_data(target, '보관기간 만료');
    purged := purged + 1;
  end loop;

  insert into privacy_purge_log (purged_count, reason) values (purged, '보관기간 만료 자동 파기');
  return purged;
end;
$$;

-- 매일 03:00(KST, = 18:00 UTC)에 실행. pg_cron을 쓸 수 없는 환경에서도
-- 스키마 적용 자체는 실패하지 않도록 감싼다.
do $$
begin
  create extension if not exists pg_cron with schema extensions;
  perform cron.unschedule('purge-expired-users');
exception when others then
  raise notice 'pg_cron 준비 건너뜀: %', sqlerrm;
end $$;

do $$
begin
  perform cron.schedule('purge-expired-users', '0 18 * * *', 'select public.purge_expired_users()');
exception when others then
  raise notice 'pg_cron 예약 실패(수동 예약 필요): %', sqlerrm;
end $$;
