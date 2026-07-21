-- 퀴즈 세션 완료 상태 추적 (중단된 세션이 학습 기록/통계에 섞이는 문제 해결)
-- 및 이어하기를 위한 출제 문제 순서 저장

alter table quiz_sessions
  add column status text not null default 'in_progress' check (status in ('in_progress', 'completed'));
alter table quiz_sessions add column finished_at timestamptz;
alter table quiz_sessions add column problem_ids uuid[] not null default '{}';

-- 이 마이그레이션 이전에 생성된 세션은 모두 기존 finish-quiz-session 흐름을 이미 거친
-- 완료된 기록이므로 completed로 소급 반영 (신규 컬럼 기본값인 in_progress로 남아
-- 학습 기록/통계에서 누락되는 것을 방지)
update quiz_sessions set status = 'completed', finished_at = started_at where status = 'in_progress';
