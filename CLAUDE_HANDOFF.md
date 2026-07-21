# CBCK Bible Study 프로젝트 인수인계 문서

> 이 문서는 다른 AI 에이전트(Claude Code, Codex 등)가 이 대화 맥락 없이 바로 이어받아
> 작업할 수 있도록 작성되었습니다. 작업 시작 전 **`cbck_bank_plan.md`(기준 기획서)를
> 반드시 먼저 읽으세요.** 이 문서는 "지금까지 뭘 했고, 뭐가 남았는지"만 다룹니다.

## 1. 프로젝트 위치 / 저장소

```text
로컬 경로(Windows): D:\workspace\claude\CK
GitHub:    https://github.com/YeansooJeong/CBCK_Bible-Study.git (origin, main 브랜치)
배포 URL:  https://YeansooJeong.github.io/CBCK_Bible-Study/  (GitHub Pages, GitHub Actions 자동 배포)
```

2026-07-21 현재 `main` 최신 구현 커밋:

```text
a797518 feat: add super/general admin role system, remove initial-admin setup
72e3601 feat: add cohort edit/delete and bulk student CSV registration
efdf052 fix: address 7 UI polish issues from user screenshot review
2e19194 feat: redesign login/admin/home screens from LOGIN_UX_Benchmark
b238855 feat: add rate limiting and real access_audit_log recording
14b98ad feat: track quiz session completion status and add real resume
ff9b4ee feat: implement selected-user sharing UI and quiz visibility
44b505a feat: add quiz reference-scope selection and weak-area feedback
```

- 로컬/원격(`origin/main`) 커밋 일치 확인됨(`a797518`까지 push 완료).
- `LOGIN_UX_Benchmark/` 폴더는 로그인 화면 리디자인 시 참고한 벤치마크 HTML 원본이며 의도적으로
  git에 커밋하지 않은 상태(작업 참고용, 빌드에 포함되지 않음). 필요 없어지면 삭제해도 무방.

## 2. Supabase 프로젝트

```text
Project ref: noadlxvwiaxumzensjyw
Project URL: https://noadlxvwiaxumzensjyw.supabase.co
Region:      ap-northeast-2 (Seoul)
```

- Project URL / anon key는 로컬 `.env`에 있음 (`.gitignore`로 제외됨, 커밋 안 됨). `.env.example`에 키 이름만 있음.
- **CLI 연결 필요**: `npx supabase link --project-ref noadlxvwiaxumzensjyw` 실행 전 `npx supabase login`으로
  이 Supabase 프로젝트를 만든 계정으로 로그인돼 있어야 함. `npx supabase projects list`로 이 프로젝트가
  보이는지 먼저 확인할 것.
- Edge Function 배포: `npx supabase functions deploy <name> --no-verify-jwt` (Docker 없이도 원격 빌드로 배포됨,
  "WARNING: Docker is not running"은 무시해도 됨). 여러 함수를 한 번에 배포하는 반복문은 CLI가 함수당 시간이
  걸려 2분 타임아웃에 걸릴 수 있으니, 다수 배포 시 하나씩 순차 실행 권장.
- 마이그레이션 적용: `npx supabase db push` (프롬프트에 `Y` 응답).
- Secrets(HMAC/암호화/세션서명 키)는 이미 설정되어 있음 (`PHONE_HMAC_SECRET`, `PHONE_ENC_KEY`, `SESSION_JWT_SECRET`).
  **`npx supabase secrets list`는 절대 실행하지 말 것** — 이 커맨드가 실제 시크릿 값을 그대로 출력한다 (과거 세션에서
  실수로 노출시켜 즉시 재발급한 전례 있음). 값 확인이 꼭 필요하면 Edge Function 코드 안에서 `Deno.env.get()`으로만 참조.
- `npx supabase functions logs <name>` 서브커맨드는 이 CLI 버전에 없음 (`UnknownSubcommand`). 함수 디버깅은
  curl로 직접 호출해 응답을 확인하거나, 브라우저에서 `javascript_tool`로 fetch 결과를 찍어보는 방식으로 대체할 것.

## 3. 사용자 확정 결정사항

- 인증: **Supabase 기본 Auth 미사용.** 전화번호+비밀번호 커스텀 인증 (Edge Function + 자체 세션 토큰).
- 관리자 권한 체계 (2026-07-21 신규): **Super Admin**(로그인 ID `36141897`, `admins` 테이블, 로그인 화면은
  `/admin/login`)과 **일반 Admin**(학생 계정 중 승격된 사람, 로그인은 평소와 동일하게 `/login`으로)의 2단계
  구조. 자세한 내용은 4-5절 참조. **"초기 관리자 생성"(`setup-admin`) 기능은 완전히 제거됨** — 실 서비스
  운영 중인 관리자 계정이 이미 있고, 앞으로 관리자를 늘릴 때도 기존 관리자가 학생을 일반 Admin으로
  승격시키는 방식만 쓰므로 별도 관리자 계정 생성 플로우가 필요 없다는 판단.
- Supabase: 개발용 프로젝트 (무료 플랜 — Free 플랜은 계정당 활성 프로젝트 2개 제한, 참고만).
- 프론트엔드: React 19 + Vite + TypeScript. **디자인 시스템은 Tailwind 유틸리티가 아니라 `src/index.css`
  한 파일에 정의된 커스텀 "세이지 & 골드" 토큰**(`--ink`, `--forest`, `--sage`, `--sage-soft`, `--gold`,
  `--paper`, `--line`, `--muted` 등, 폰트는 Pretendard/Noto Sans KR/SUIT)이다. 단, `AdminDashboardPage.tsx`와
  그 안에서 쓰는 `ProblemModerationPanel.tsx`만 예외적으로 아직 순수 Tailwind 유틸리티 클래스로 되어 있음
  (관리자 대시보드는 UI 리디자인 대상에서 제외됐던 화면이라 스타일이 다름 — 의도된 상태이며 버그 아님,
  나중에 통일하고 싶다면 8장 참고).
- 라우팅: `react-router-dom`의 **HashRouter** (GitHub Pages는 서버사이드 라우팅이 없어 BrowserRouter는
  새로고침 시 404가 남 — 반드시 HashRouter 유지할 것, URL에 항상 `#` 포함).
- 배포: GitHub Pages (`.github/workflows/deploy-pages.yml`, GitHub Actions 자동 배포). 빌드 스텝에
  `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`를 `secrets.*`로 주입하는 `env:` 블록이 반드시 있어야 함
  (없으면 배포된 사이트에서만 로그인 등 모든 Edge Function 호출이 조용히 실패함 — 과거 이 버그를 겪고 수정함).

## 4. 완료된 기능 전체 정리

기획서(`cbck_bank_plan.md`) 9장 로드맵은 전부 완료되었고, 이후 사용자가 실제 사용하며 요청한 punch-list와
UI 리디자인, 권한 체계까지 추가로 완료된 상태다. 아래는 기능 단위 요약이다.

### 4-1. 인증 / 로그인

- 학생: 전화번호 확인(`check-phone`) → 미등록이면 안내, 최초 로그인(`pending` 상태)이면 이름+간사 이름+
  반장 이름+킹제임스 성경(영어) 출판연도로 본인 확인 후 비밀번호 설정(`activate-account`), 이미 활성화됐으면
  비밀번호 로그인(`login`).
- 인증질문은 **키워드 매칭**으로 관대하게 처리한다: 기수명은 숫자만 일치해도 통과("14기"/"14" 모두 인정),
  킹제임스 출판연도는 연도 숫자만 포함되면 통과("1611"/"1611년"/"1611년도" 모두 인정) — 사용자가 응답 형식이
  제각각일 것을 고려해 명시적으로 요청한 사양.
- 로그인 5회 실패 시 15분 계정 잠금(`users.failed_attempts`/`locked_until`).
- 로그인/관리자 로그인/전화번호 확인/계정 활성화 등 공개 엔드포인트에 IP 기준 rate limiting 적용됨(4-6절).
- 로그인 UX는 `LOGIN_UX_Benchmark/login-ux.html` 벤치마크를 참고해 전면 리디자인됨: 2단 레이아웃(브랜드 소개
  + 인증 카드), 3점 스텝 인디케이터, 단계별 안내 문구. "처음 방문하셨나요?" 같은 안내 없는 죽은 텍스트는
  삭제하고 관리자 로그인 링크만 남김.

### 4-2. 관리자 기능 (기수/학생 관리)

- 기수: 등록(`admin-create-cohort`) + **수정(`admin-update-cohort`) + 삭제(`admin-delete-cohort`)**.
  삭제는 해당 기수에 학생이 남아있으면 `has_students` 에러로 막힘(강제 FK 에러 대신 명확한 안내).
- 학생: 개별 등록/수정/삭제/비밀번호 초기화(대기중 상태로 되돌림)는 기존 기능. **CSV 일괄 등록
  (`bulk-create-students`)** 추가됨 — `name,phone` 2컬럼 CSV, 1행 헤더+2행부터 데이터, 행 단위로 실패를
  수집해서(전화번호 중복 등) 나머지 행은 계속 처리하고 성공/실패 건수와 실패 행 번호를 보여준다. 샘플 CSV
  다운로드 + 시인성 있는 "CSV 파일 선택" 버튼(네이티브 input을 숨기고 라벨을 버튼처럼 스타일링) 제공.
- 관리자가 학생 전화번호를 열람하면 `access_audit_log`에 실제로 기록됨(4-6절).

### 4-3. Super Admin / 일반 Admin 권한 체계 (2026-07-21 신규)

- DB: `admins.role`(기존 계정은 `super_admin`으로 backfill), `users.is_admin boolean`.
- 세션 토큰: 학생 로그인(`login`) 시 `users.is_admin`이 true면 토큰에 `role: 'general_admin'`이 실려서
  발급된다. 별도 로그인 절차 없이 **평소와 똑같이 `/login`으로 로그인**하면 자동으로 승격된 권한을 가진
  세션이 된다.
- `_shared/adminAuth.ts`의 `requireSuperOrGeneralAdmin()`이 `x-admin-token`(Super Admin, `admins` 테이블
  로그인)과 `x-user-token`(일반 Admin, `role==='general_admin'`인 학생 토큰) 둘 다 받아준다. 아래 함수들이
  이 헬퍼로 전환됨: `admin-list-cohorts`, `admin-list-students`, `admin-create-student`,
  `admin-update-student`, `admin-delete-student`, `bulk-create-students`, `admin-list-problems`,
  `admin-update-problem`, `admin-delete-problem`.
- 권한 범위: **Super Admin** = 일반 Admin의 모든 권한 + 기수 CRUD(생성/수정/삭제, 일반 Admin에게는 없음)
  + 학생에게 일반 Admin 권한 부여/해제(`admin-set-student-role`, Super Admin 전용).
  **일반 Admin** = 학생 정보 추가/수정/삭제/비밀번호 초기화 + 등록된 문제 수정/삭제(소유자 무관, 시스템
  전체 문제 대상 — "모더레이션" 개념. 문제 등록 자체는 일반 Admin 전용 기능이 아니라 모든 학생이 원래
  할 수 있는 것과 동일).
- 프론트엔드: Super Admin은 `/admin`(`AdminDashboardPage`)에서 학생 목록에 "Admin 지정/해제" 버튼과
  "일반 Admin" 배지가 보인다. 일반 Admin으로 승격된 학생은 학생 화면 상단 내비게이션에 **"관리"** 링크가
  자동으로 나타나고 `/manage`(`ManagePage.tsx`)에서 기수 선택 후 학생 CRUD + 문제 모더레이션을 할 수 있다.
  `/manage`는 `studentSession`의 `isAdmin`이 false면 `/home`으로 리다이렉트한다(직접 URL 접근 방어 확인됨).
  두 화면 모두 문제 모더레이션 UI는 공용 컴포넌트 `src/components/ProblemModerationPanel.tsx`를 쓴다(질문
  텍스트/정답/객관식 보기 인라인 수정 + 삭제, 프로젝트명·출제자·유형 표시).
- **알아둘 제약**: 세션 토큰은 발급 시점의 `is_admin` 값을 그대로 담고 최대 7일(TTL) 유지되므로, Super
  Admin이 권한을 부여/해제해도 **이미 로그인해 있던 세션에는 즉시 반영되지 않는다** — 해당 학생이 다시
  로그인해야 새 권한이 적용된다. 실시간 반영이 필요해지면 토큰 무효화 메커니즘을 추가로 설계해야 한다.

### 4-4. 프로젝트 / 문제 관리

- 프로젝트: 생성/수정/삭제, 공유 범위 `private`/`all`/`selected` 3단계, `selected`는 대상 학생을
  체크박스로 선택하는 UI 있음(`list-shareable-users`로 대상 목록 조회).
- 문제: 4지선다/단답형/성경문제 3가지 유형, 프로젝트당 100개 제한. 공유 범위는 `inherit`(프로젝트 설정
  따름)/`private`/`all`/`selected` 4단계이며 프로젝트 레벨보다 문제 레벨 설정이 우선한다.
- CSV 일괄 등록(`bulk-create-problems`): 1행 헤더 + 2~4행 유형별 작성 예시(건너뜀) + 5행부터 실제 데이터.
  `parseCsvLine`이 따옴표로 감싼 값 안의 쉼표/이스케이프까지 제대로 처리하는 정식 CSV 파서다(단순
  `split(',')` 아님). 샘플 양식 다운로드 버튼 있음. 컬럼 목록을 화면에 텍스트로 나열하던 부분은 샘플
  다운로드가 있으므로 중복이라 삭제함. 파일 선택은 네이티브 input을 숨기고 스타일링된 라벨/버튼으로 대체해
  눈에 잘 띄게 함(문제 CSV·학생 CSV 모두 동일 패턴, `src/lib/csv.ts`에 `parseCsvLine`/`downloadCsv` 공용
  헬퍼로 추출됨).
- "프로젝트 삭제" 버튼이 좁은 화면에서 텍스트 줄바꿈으로 찌그러지던 버그, 상단 메뉴에서 서로 다른 라우트인데
  같은 경로/state만 다른 링크 2개가 동시에 활성 표시되던 버그(`NavLink` 기본 매칭이 쿼리스트링을 무시해서
  발생) 모두 수정됨.

### 4-5. 퀴즈 세션

- 출제 시 프로젝트 선택뿐 아니라 **레퍼런스 범위(`ref_course`/`ref_session`) 필터**를 걸 수 있다
  (`start-quiz-session`의 `refCourse`/`refSession` 파라미터).
- 채점(`submit-answer`): mcq/bible은 완전일치, short는 키워드 전부 포함 여부.
- 완료(`finish-quiz-session`): 총문제/정답/점수(%) + **레퍼런스별 정답률(취약 구간) breakdown**을
  정답률 오름차순으로 반환해서 어느 강의/회차가 약한지 보여준다.
- `quiz_sessions`에 `status`(`in_progress`/`completed`), `finished_at`, `problem_ids`(출제된 문제 순서
  그대로 저장) 컬럼 추가됨. **중단된 세션은 실제로 이어할 수 있다** — `get-active-quiz-session`이 사용자의
  미완료(`in_progress`) 세션을 찾아 문제 목록과 "어디까지 풀었는지"(`resumeIndex`, 아직 답 안 한 첫 문제
  인덱스)를 반환하고, 홈 화면이 이걸로 이어하기 버튼/문구를 보여준다. 이 마이그레이션 이전에 생성된 세션은
  전부 `completed`로 소급 처리해서 기록/통계에서 빠지지 않게 함.

### 4-6. 보안 / 감사 로그

- **Rate limiting**: `rate_limits` 테이블(IP+엔드포인트 키, 슬라이딩 윈도우 카운터) 추가, `check-phone`,
  `login`, `activate-account`, `admin-login`, (과거엔 `setup-admin`도 포함했으나 함수 자체가 삭제됨) 등
  공개 엔드포인트에 적용됨. 초과 시 `429 rate_limited` 응답, 프론트엔드는 "요청이 너무 많습니다" 안내.
- **`access_audit_log`**: 관리자가 학생 전화번호를 열람(`admin-view-student-phone`)할 때마다 실제로 기록되고,
  관리자 대시보드 "개인정보 접근 이력" 섹션(`admin-list-audit-log`)에서 조회 가능.

## 5. DB 스키마 / 마이그레이션

`supabase/migrations/`에 5개 파일, 시간순:

1. `20260720000000_init_schema.sql` — `cohorts`, `users`, `admins`, `projects`, `problems`, `project_shares`,
   `problem_shares`, `quiz_sessions`, `session_answers`, `access_audit_log` 전체 테이블 + RLS 활성화 + 정책.
2. `20260720010000_phone_crypto_functions.sql` — `hash_phone`/`encrypt_phone`/`decrypt_phone`(pgcrypto 래퍼,
   `service_role`만 실행 가능).
3. `20260721000000_quiz_session_status.sql` — `quiz_sessions`에 `status`/`finished_at`/`problem_ids` 추가
   (4-5절 참조).
4. `20260721010000_rate_limits.sql` — `rate_limits` 테이블(4-6절 참조).
5. `20260721020000_admin_roles.sql` — `admins.role`, `users.is_admin`(4-3절 참조).

**⚠️ 중요한 설계 사실 (변하지 않음)**: 모든 테이블의 RLS 정책은 `auth.uid()`를 기준으로 하지만, 이 프로젝트는
Supabase Auth를 쓰지 않으므로 anon key로 직접 요청하면 `auth.uid()`가 항상 null이라 그 정책들은 사실상 절대
통과되지 않는다. 즉 anon key 단독으로는 테이블에 절대 접근 불가(의도된 안전장치). **모든 실제 읽기/쓰기는
Edge Function이 `service_role`로 수행하면서 소유권·공유·권한 로직을 코드로 직접 구현**하는 구조다. 새 기능을
추가할 때도 이 패턴을 그대로 따를 것 — RLS를 고치려 하지 말 것.

## 6. Edge Functions (`supabase/functions/`)

전부 `--no-verify-jwt`로 배포됨(Supabase Auth JWT가 아닌 자체 토큰을 쓰므로).

| 함수 | 인증 | 설명 |
|---|---|---|
| `check-phone` | 없음(공개, rate limit) | 전화번호 등록 여부 확인 |
| `activate-account` | 없음(공개, rate limit) | 인증질문 검증(키워드 매칭) → 비밀번호 설정 → 계정 활성화 |
| `login` | 없음(공개, rate limit) | 학생 로그인, 5회 실패 시 15분 잠금, `is_admin`이면 `general_admin` 역할 토큰 발급 |
| `admin-login` | 없음(공개, rate limit) | Super Admin 로그인, `role:"admin"` 토큰 발급 |
| `admin-create-cohort` / `admin-update-cohort` / `admin-delete-cohort` | `x-admin-token`(Super Admin 전용) | 기수 CRUD, 삭제는 학생 존재 시 차단 |
| `admin-create-student` / `admin-update-student` / `admin-delete-student` | `x-admin-token` 또는 `x-user-token`(general_admin) | 학생 CRUD, 비밀번호 초기화 겸용 |
| `bulk-create-students` | `x-admin-token` 또는 `x-user-token`(general_admin) | CSV 학생 일괄 등록, 행 단위 성공/실패 집계 |
| `admin-list-cohorts` / `admin-list-students` | `x-admin-token` 또는 `x-user-token`(general_admin) | 목록 조회 |
| `admin-set-student-role` | `x-admin-token`(Super Admin 전용) | 학생의 `is_admin` 부여/해제 |
| `admin-view-student-phone` | `x-admin-token`(Super Admin 전용) | 전화번호 복호화 열람, `access_audit_log` 기록 |
| `admin-list-audit-log` | `x-admin-token`(Super Admin 전용) | 개인정보 열람 이력 조회 |
| `admin-list-problems` / `admin-update-problem` / `admin-delete-problem` | `x-admin-token` 또는 `x-user-token`(general_admin) | 시스템 전체 문제 모더레이션(소유권 무관) |
| `list-projects` / `create-project` / `update-project` / `delete-project` | `x-user-token` | 소유자만 수정/삭제, 공유 범위(private/all/selected) 관리 |
| `list-shareable-users` | `x-user-token` | `selected` 공유 시 대상 학생 목록 |
| `list-problems` / `create-problem` / `update-problem` / `delete-problem` | `x-user-token` | 소유자만, 프로젝트당 100개 제한 |
| `bulk-create-problems` | `x-user-token` | CSV 파싱 결과(JSON 배열) 일괄 등록 |
| `list-quiz-scopes` | `x-user-token` | 퀴즈 출제 범위 선택용 프로젝트/레퍼런스 옵션 목록 |
| `start-quiz-session` | `x-user-token` | 레퍼런스 필터 + `count`(기본10,최대50)개 무작위 출제 |
| `get-active-quiz-session` | `x-user-token` | 미완료 세션 조회(이어하기용, `resumeIndex` 포함) |
| `submit-answer` | `x-user-token` | 문제별 채점 후 upsert |
| `finish-quiz-session` | `x-user-token` | 총점 + 레퍼런스별 취약 구간 반환, 세션을 `completed`로 마감 |
| `quiz-history` | `x-user-token` | 본인의 최근 퀴즈 세션 20개 요약 |

**삭제된 함수**: `setup-admin`(초기 관리자 생성용, 4-3절 정책 변경으로 완전히 제거됨. 다시 필요해질 일 없음).

**`_shared/` 헬퍼**:
- `cors.ts`: 커스텀 헤더(`x-admin-token`, `x-user-token`)를 `Access-Control-Allow-Headers`에 반드시 포함해야
  함. **새 커스텀 헤더를 추가할 때마다 여기에도 추가하고 관련 함수를 재배포할 것** — 헤더 누락 시 브라우저
  요청만 "Failed to fetch"로 조용히 막히고 curl 테스트는 통과하니 주의(과거 두 번 겪은 버그).
- `session.ts`: HMAC-SHA256 서명 커스텀 세션 토큰(payload: `{sub, exp, role?}`, `role`은 `'admin'` 또는
  `'general_admin'`). `verifySessionToken`은 파싱 실패 시 반드시 `null` 반환(try/catch로 감쌈).
- `adminAuth.ts`: `requireAdmin`(Super Admin 전용, `role==='admin'`만 통과) / `requireSuperOrGeneralAdmin`
  (Super Admin 또는 일반 Admin 둘 다 통과, 4-3절 참조).
- `userAuth.ts`: `requireUser`, `role==='admin'`인 토큰만 거부(즉 `general_admin` 토큰은 일반 학생 API도
  그대로 사용 가능 — 승격돼도 학생 기능을 잃지 않음).
- `rateLimit.ts`: `checkRateLimit(supabase, key, limit, windowSeconds)`.
- `visibleProblems.ts`: 소유자 본인 것 + 공유 규칙(`all`/`selected`) 적용된 문제 목록을 반환하는 공용 로직,
  `list-problems`와 `start-quiz-session`이 함께 사용.

## 7. 프론트엔드 (`src/`)

라우트(`src/App.tsx`, HashRouter):

| 경로 | 페이지 | 설명 |
|---|---|---|
| `/` | `HomePage` | 랜딩 |
| `/login` | `StudentAuthPage` | 전화번호 확인 → 로그인 또는 최초인증 분기, 리디자인된 2단 레이아웃 |
| `/home` | `StudentHomePage` | 퀴즈 시작/이어하기/풀이/결과(취약구간 포함)/최근 기록, 프로젝트 이동 |
| `/projects` | `ProjectsPage` | 내 프로젝트 목록/생성 (`?scope=shared`면 공유받은 프로젝트) |
| `/projects/:projectId` | `ProjectDetailPage` | 문제 등록/CSV 업로드/목록/공유설정(선택 학생 포함)/삭제 |
| `/problems/new` | `NewProblemPage` | 새 문제 작성, 실시간 미리보기, 임시저장 |
| `/manage` | `ManagePage` | **일반 Admin 전용**(비승격 학생은 `/home`으로 리다이렉트), 기수 선택+학생 CRUD+문제 모더레이션 |
| `/admin/login` | `AdminLoginPage` | Super Admin 로그인(초기 관리자 생성 기능 없음) |
| `/admin` | `AdminDashboardPage` | 기수/학생 CRUD, 일반 Admin 지정/해제, 문제 모더레이션, 개인정보 열람 이력 |

주요 파일:
- `src/lib/api.ts`: 모든 Edge Function 호출을 감싼 얇은 클라이언트. Super/일반 Admin이 공용으로 쓰는
  API(`adminListCohorts`, `adminListStudents`, `adminCreateStudent`, `adminUpdateStudent`,
  `adminDeleteStudent`, `bulkCreateStudents`, `adminListProblems`, `adminUpdateProblem`,
  `adminDeleteProblem`)는 첫 인자로 `{ adminToken?, userToken? }` 액터 객체를 받는 형태로 통일돼 있다.
  새 Edge Function을 추가하면 여기에도 타입과 함수를 추가할 것.
- `src/lib/session.ts`: `localStorage` 기반 토큰 저장. `adminSession`(Super Admin), `studentSession`
  (학생/일반 Admin 공용, `StudentUser`에 `isAdmin?: boolean` 포함).
- `src/lib/csv.ts`: `parseCsvLine`(따옴표 CSV 파서), `downloadCsv`(BOM 포함 UTF-8 다운로드) — 문제 CSV와
  학생 CSV 양쪽에서 공용으로 씀.
- `src/lib/supabaseClient.ts`: 존재하지만 실제로 쓰이는 곳 없음(모든 데이터 접근이 Edge Function 경유).
  정리 대상.
- `src/components/StudentShell.tsx`: 학생 화면 공통 레이아웃(상단 내비게이션, 프로필/로그아웃). 모바일에서
  아바타를 누르면 이름+로그아웃이 담긴 드롭다운이 뜬다(데스크톱 로그아웃 버튼과 별개). `isAdmin`이면
  "관리" 링크가 추가로 보인다.
- `src/components/ProblemModerationPanel.tsx`: Super/일반 Admin 화면 공용 문제 모더레이션 리스트(수정/삭제).
- `src/index.css`: 디자인 토큰 + 전체 화면 스타일이 한 파일에 있음(관리자 대시보드 제외, 3장 참조). 파일이
  커서 후속 단계에서 `styles/` 단위 분리를 고려할 것(8장 참조).

## 8. 알려진 미해결 이슈 / 기술 부채

1. **`src/lib/supabaseClient.ts` 미사용**: 정리하거나, 나중에 실시간 기능 붙일 때 활용.
2. **비밀번호 찾기(recovery) 플로우 없음**: 학생이 비밀번호를 잊으면 admin이 "비밀번호 초기화"로 대기중
   상태로 되돌리는 수밖에 없음(수동 대응). 기획서에 명시된 필수 요구사항은 아님.
3. **홈 통계 정의가 임시 규칙임**: 주간 진행률은 서버 목표값이 아니라 클라이언트에서
   `학습한 고유 일수 × 20%`(주 5일 목표)로 계산한다. 정식 목표 설정 기능이 필요하면 사용자별 목표
   컬럼/설정 API를 추가해야 한다.
4. **대시보드 조회 효율**: 홈은 `quizHistory`와 `listProjects`를 병렬 호출하지만 프로젝트별 문제 수·숙달률·
   최근 학습 시각은 제공하지 않는다. 추후 `dashboard-summary` 전용 Edge Function을 두는 편이 좋다.
5. **`src/index.css` 비대화 + 관리자 화면 스타일 이원화**: Tailwind 테마(관리자 대시보드)와 커스텀 디자인
   토큰(나머지 전체)이 공존한다. 기능 안정화 후 스타일 시스템을 하나로 통일하거나 최소한 CSS 파일을
   `student-shell.css`, `dashboard.css` 등으로 분리 권장.
6. **새 문제 임시저장 범위**: `localStorage` 초안 키(`cbck-problem-draft`)가 사용자 ID를 포함하지 않아 같은
   브라우저에서 다른 사용자가 로그인하면 이전 사용자의 초안이 보일 수 있다.
   `cbck-problem-draft:${userId}` 형태로 변경하거나 서버 초안 테이블을 구현해야 한다.
7. **정답 피드백 제한**: `submit-answer`는 `isCorrect`와 `matchScore`만 반환한다. 오답 시 작성자가 입력한
   대표 정답 자체를 보여주려면 소유권/노출 정책을 검토한 뒤 API 응답을 확장해야 한다(9-4절 "복습/오답노트"
   기능과 함께 다룰 것을 권장).
8. **일반 Admin 권한 변경이 기존 세션에 즉시 반영되지 않음**: 4-3절 마지막 문단 참조. 실시간 반영이
   필요해지면 토큰에 짧은 TTL을 주거나 서버 측 토큰 무효화(revocation list) 설계가 필요하다.

## 9. 다음 개발 예정 (사용자 요청, 우선순위 미정 — 필요 시 순서 조정)

아래 4가지는 2026-07-21 사용자가 다음 작업으로 지정한 항목이다. 각 항목에 대해 확인된 현재 구조와, 구현
시작점으로 삼을 수 있는 방향을 함께 적어둔다.

### 9-1. Super/일반 Admin 문제 목록 접기/펼치기

- 대상: `src/components/ProblemModerationPanel.tsx` (Super Admin 대시보드 `/admin`과 일반 Admin
  `/manage` 양쪽에서 공용으로 쓰는 컴포넌트). 현재는 시스템에 등록된 모든 문제를 처음부터 전부 펼쳐서
  나열한다(최근 테스트 기준 실사용 문제만 11개였지만, 실사용자가 늘면 목록이 매우 길어질 것).
  - 구현 방향: 문제 리스트 아이템(`<li>`)에 펼침 상태를 토글하는 로컬 state 추가. 기본은 접힌 상태로
    질문 한 줄 요약만 보여주고, 클릭 시 정답/보기/레퍼런스 등 상세를 펼치는 아코디언 패턴을 고려.
    9-2(검색)과 함께 구현하면 "검색해서 찾은 문제만 펼쳐서 확인" 흐름이 자연스러워진다.

### 9-2. 문제 목록 검색 기능

- 사용자가 명시한 검색 기준: **문제 출제자**(`ownerName`, 이미 `ModeratedProblem` 타입에 존재), **출제원천**
  (레퍼런스 — `refCourse`/`refSession`/`refLocation`, 역시 이미 응답에 포함됨). 즉 백엔드
  `admin-list-problems`는 이미 필요한 필드를 다 내려주고 있어서, **1차로는 프론트엔드에서 클라이언트 사이드
  필터링만 추가해도 충분**하다(문제 수가 수백~수천 단위로 커지면 그때 서버사이드 검색/페이지네이션을
  고려).
  - 구현 방향: `ProblemModerationPanel`에 검색어 입력(질문 텍스트 부분일치), 출제자 선택(드롭다운, 목록에
    나온 `ownerName` 유니크 값), 출제원천 선택(course/session 드롭다운) 등을 추가하고 로컬에서
    `problems.filter(...)`.
  - 문제 수가 많아지면 `admin-list-problems`의 `.limit(500)` 하드코딩(현재 코드)도 함께 재검토해야 함 —
    페이지네이션 또는 서버사이드 검색 파라미터(`?ownerId=`, `?refCourse=` 등) 추가 필요.

### 9-3. 문제별 학생 코멘트(쓰레드, CRUD)

- 완전히 새로운 기능. 학생이 개별 문제에 댓글을 달고(입력), 본인 댓글을 수정/삭제할 수 있어야 한다.
  "쓰레드 형태"라고 했으므로 답글(대댓글) 구조까지 고려할지 먼저 사용자와 범위를 확정할 것(단순 플랫
  댓글 목록 vs 1단계 답글까지).
  - DB: 새 테이블 `problem_comments` 필요. 최소 컬럼: `id`, `problem_id`(FK → `problems.id`),
    `author_id`(FK → `users.id`), `content text`, `created_at`, `updated_at`, 답글을 지원한다면
    `parent_comment_id`(자기참조 FK, nullable).
  - 권한: RLS는 이 프로젝트 전체 패턴상 쓰지 않으므로(4장 "설계 사실" 참조), Edge Function에서 직접
    "본인 댓글만 수정/삭제 가능" 로직을 구현해야 한다. 문제를 볼 수 있는 학생이면 누구나 댓글을 볼 수
    있어야 하므로, 댓글 조회 자체는 `visibleProblems.ts`의 가시성 규칙(소유자/공유 대상)을 재사용해서
    "이 문제를 볼 수 있는 사람만 댓글도 볼 수 있음"으로 제한할지 결정 필요.
  - 신규 Edge Function 후보: `list-problem-comments`, `create-problem-comment`, `update-problem-comment`,
    `delete-problem-comment` (모두 `x-user-token`).
  - 프론트엔드: 문제 상세/퀴즈 풀이 화면(어디에 노출할지 확정 필요 — `ProjectDetailPage`의 문제 목록인지,
    퀴즈 풀이 중 화면인지, 둘 다인지)에 댓글 쓰레드 UI 추가.
  - Super/일반 Admin의 문제 모더레이션(9-1, 9-2, `admin-update-problem`/`admin-delete-problem`) 권한과
    학생 댓글 삭제 권한이 겹치는지도 사용자와 확인 필요(예: 일반 Admin이 부적절한 댓글을 삭제할 수 있어야
    하는지).

### 9-4. 학습 이력(정오답) 조회 + 북마크(복습) 기능

- 사용자가 "추가 기획 환영"이라고 언급했으므로, 구현 전에 아래 세부사항을 먼저 확인/제안할 것을 권장:
  - 정오답 조회 범위: 세션 단위 요약(현재 `quiz-history`가 이미 세션별 총점만 제공)인지, 문제 단위로
    "이 문제를 맞았는지 틀렸는지"를 별도로 볼 수 있어야 하는지. 후자라면 `session_answers` 테이블
    (이미 존재, `is_correct` 컬럼 있음)을 문제 기준으로 재집계하는 조회 API가 필요함
    (예: `list-my-answer-history` — 문제별 최근 시도 결과, 누적 정답률 등).
  - 북마크: 완전히 새로운 개념. 신규 테이블 `problem_bookmarks`(`user_id`, `problem_id`, `created_at`,
    복합 유니크 제약) 필요. 북마크한 문제만 모아서 복습용 퀴즈를 출제하는 기능
    (`start-quiz-session`에 `bookmarkedOnly` 같은 파라미터 추가하거나 완전히 별도 시작점)까지 포함할지
    확인 필요.
  - "복습" 관점에서는 **오답만 다시 풀기**(취약 문제 반복 학습)도 자연스러운 추가 제안: 문제 목록의
    "정답: X" 노출 정책(8장 이슈 7 "정답 피드백 제한"과 연동)과 함께 설계하면 좋다.
  - 프론트엔드: `StudentHomePage`(홈)나 `ProjectsPage`류에 "복습" 진입점, 문제 카드에 북마크 토글 버튼
    (별 아이콘 등), 정오답 히스토리를 보여주는 화면(신규 페이지 또는 홈 확장) 추가.
  - 신규 Edge Function 후보: `toggle-problem-bookmark`, `list-bookmarked-problems`,
    `list-my-answer-history` (모두 `x-user-token`).

## 11. 최종 운영 상태 및 인수인계 (2026-07-21)

### 실제 배포된 함수 목록

문서 및 현재 배포 상태 기준으로 기존 함수들은 ACTIVE로 확인되었다. 최근 추가/변경 함수는 아래 목록을 배포 확인 대상으로 관리한다.

- 댓글: `list-problem-comments`, `create-problem-comment`, `update-problem-comment`, `delete-problem-comment`
- 북마크: `toggle-problem-bookmark`, `list-bookmarked-problems`
- 퀴즈: `start-quiz-session` (북마크 전용 출제 변경 포함)
- 기존 인증/관리자/프로젝트/문제/퀴즈 함수 전체

주의: 최근 댓글·북마크 관련 함수는 로컬 코드 반영과 실제 Supabase 배포 여부를 Dashboard `Edge Functions`에서 최종 확인해야 한다.

### 적용된 마이그레이션

- `20260720000000_init_schema.sql`
- `20260720010000_phone_crypto_functions.sql`
- `20260721000000_quiz_session_status.sql`
- `20260721010000_rate_limits.sql`
- `20260721020000_admin_roles.sql`
- `20260721030000_problem_comments.sql`
- `20260721040000_problem_bookmarks.sql`

`problem_comments`, `problem_bookmarks`는 Supabase SQL Editor에서 직접 실행하여 성공 확인했다. `db push`는 PostgreSQL 5432 연결 제한으로 실패할 수 있으므로, SQL Editor 적용 방식을 기준으로 기록한다.

### 최종 커밋

- HEAD/origin: `6952302 chore: finalize production readiness`
- 주요 후속 커밋: `35d329a` 댓글 기능, `d142df3` 댓글 권한, `43e7999` 북마크 백엔드, `934b7f8` 북마크 복습, `04089de` 퀴즈 북마크 UI
- 현재 `main`과 `origin/main`은 동기화 상태로 확인됨.

### 테스트 완료 여부

- `npm.cmd run build`: 성공
- TypeScript/Vite 프로덕션 빌드: 성공
- GitHub Pages 배포 구조 및 GitHub Actions 워크플로 확인
- Supabase 마이그레이션 7개 적용 확인
- Super Admin / 일반 Admin 권한 분리 확인
- 모바일 Admin 학생 목록 레이아웃 수정 및 빌드 확인
- 실제 운영 환경의 댓글·북마크 전체 흐름은 함수 재배포 후 최종 테스트 필요

### 남은 알려진 이슈

- 최근 댓글/북마크 Edge Function의 실제 ACTIVE 상태 최종 확인 필요
- 문제별 댓글은 현재 작성자 본인 수정/삭제 중심이며, 관리자 댓글 관리 정책은 추가 검토 필요
- 북마크 문제 복습은 연결되었으나, 북마크 해제 후 목록 갱신과 운영 환경 통합 테스트 필요
- 미추적 `LOGIN_UX_Benchmark/` 폴더는 저장소 커밋 대상에서 제외
- 운영 환경에서 실제 학생/관리자 계정으로 권한·모바일·댓글·북마크 E2E 테스트 필요

### 관리자 운영 방법

- Super Admin은 `/admin`에서 기수·학생·문제 관리와 일반 Admin 권한 관리를 수행한다.
- 일반 Admin은 학생 및 허용된 문제 관리 기능을 사용한다.
- 학생 일반 로그인은 `/login`을 사용하며, 일반 Admin 학생도 동일한 로그인 경로에서 권한이 활성화된다.
- 전화번호 원문 조회는 감사 로그에 기록되므로 업무상 필요한 경우에만 실행한다.
- 관리자 권한 변경 후 기존 세션에는 TTL이 남을 수 있으므로, 즉시 반영이 필요하면 재로그인한다.

### 배포/복구 방법

GitHub Pages:

```powershell
git push origin main
```

Supabase 함수:

```powershell
npx supabase functions deploy <function-name> --no-verify-jwt
```

DB 마이그레이션:

- PostgreSQL 5432 연결이 가능하면 `npx supabase db push`
- 연결이 차단되면 Supabase Dashboard → SQL Editor에서 마이그레이션 SQL을 순서대로 실행

복구 시에는 먼저 GitHub의 이전 안정 커밋을 확인하고, DB는 이미 적용된 마이그레이션을 다시 실행하지 않는다. 함수 장애는 Dashboard Logs 확인 후 해당 함수만 재배포한다.

## 10. 변경 이력 (이 문서)

| 날짜 | 내용 |
|---|---|
| 2026-07-20 | 최초 인수인계 문서 작성 → 전체 재작성(Pages 배포, Supabase 연결, 인증, 관리자 기능, 프로젝트·문제 CRUD, CSV 업로드, 퀴즈 세션·자동채점 완료 반영) |
| 2026-07-20 | UI Phase 1(학습 대시보드) · Phase 2(새 문제 작성) 구현 상태 반영 |
| 2026-07-21 | Mac/Codex UI 리디자인 병합, 퀴즈 레퍼런스 범위 선택+취약구간 피드백, 선택 사용자 공유 UI, 세션 완료 상태+실제 이어하기, rate limiting+감사 로그, 로그인 화면 벤치마크 리디자인, 사용자 스크린샷 기반 UI 버그 7건 수정, 기수 수정/삭제, 학생 CSV 일괄등록, Super/일반 Admin 권한 체계 도입 및 초기 관리자 생성 기능 제거까지 반영해 문서 전면 재작성. 다음 개발 예정으로 문제 목록 접기/펼치기, 검색, 문제별 댓글 쓰레드, 학습 이력/북마크 기능 추가 |
