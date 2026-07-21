-- Super admin(admins 테이블) / 일반 admin(승격된 학생) 권한 체계
-- 일반 admin은 별도 로그인 없이 기존 학생 phone+password 로그인을 그대로 사용하고,
-- 세션 토큰에 role: 'general_admin' 플래그만 추가로 실린다.

alter table admins add column role text not null default 'super_admin';
alter table users add column is_admin boolean not null default false;
