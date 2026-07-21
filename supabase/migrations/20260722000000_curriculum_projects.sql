-- 프로젝트를 "개인 문제함"에서 "커리큘럼 과목(어드민 관리)"으로 전환.
-- 과목은 소유자가 없는 구조적 엔티티(cohorts와 동일한 패턴)이며, 여러 학생이 문제를 만들어 채운다.
-- 문제별 실제 작성자를 알아야 하므로 problems.author_id를 신설한다.

alter table projects alter column owner_id drop not null;
alter table projects add column session_count integer not null default 32 check (session_count > 0);

alter table problems add column author_id uuid references users(id) on delete cascade;
alter table problems add column ref_kind text check (ref_kind in ('강의요약본', '강의영상'));
alter table problems add column ref_detail text;
alter table problems drop column ref_location;
