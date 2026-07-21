-- 공개 엔드포인트(전화번호 확인, 계정 활성화, 관리자 로그인 등) 무차별 대입 방지용
-- IP 기준 슬라이딩 윈도우 카운터. service_role(Edge Function)에서만 접근.

create table rate_limits (
  key text primary key,
  count int not null default 1,
  window_start timestamptz not null default now()
);

alter table rate_limits enable row level security;
-- 정책을 만들지 않아 anon/authenticated는 기본적으로 접근 불가, service_role만 가능
