# CBCK Bible Study 프로젝트 인수인계 문서

> 이 문서는 다른 AI 에이전트(Claude Code, Codex 등)가 이 대화 맥락 없이 바로 이어받아
> 작업할 수 있도록 작성되었습니다. 작업 시작 전 **`cbck_bank_plan.md`(기준 기획서)를
> 반드시 먼저 읽으세요.** 이 문서는 "지금까지 뭘 했고, 뭐가 남았는지"만 다룹니다.

## 1. 프로젝트 위치 / 저장소

```text
로컬 경로: D:\workspace\claude\CK
GitHub:    https://github.com/YeansooJeong/CBCK_Bible-Study.git (origin, main 브랜치)
배포 URL:  https://YeansooJeong.github.io/CBCK_Bible-Study/  (GitHub Pages, 확인 필요 — 8-1 참조)
```

## 2. Supabase 프로젝트

```text
Project ref: noadlxvwiaxumzensjyw
Project URL: https://noadlxvwiaxumzensjyw.supabase.co
Region:      ap-northeast-2 (Seoul)
```

- Project URL / anon key는 로컬 `.env`에 있음 (`.gitignore`로 제외됨, 커밋 안 됨). `.env.example`에 키 이름만 있음.
- **CLI 연결 필요**: `npx supabase link --project-ref noadlxvwiaxumzensjyw` 실행 전 `npx supabase login`으로
  **이 Supabase 프로젝트를 만든 계정**으로 로그인돼 있어야 함. 이 PC에는 다른 프로젝트(SELVAS Treasury 등)로 로그인된
  세션이 남아있을 수 있으니 `npx supabase projects list`로 이 프로젝트가 보이는지 먼저 확인할 것.
- Edge Function 배포: `npx supabase functions deploy <name> --no-verify-jwt` (Docker 없이도 원격 빌드로 배포됨,
  "WARNING: Docker is not running"은 무시해도 됨).
- Secrets(HMAC/암호화/세션서명 키)는 이미 설정되어 있음 (`PHONE_HMAC_SECRET`, `PHONE_ENC_KEY`, `SESSION_JWT_SECRET`).
  **`npx supabase secrets list`는 절대 실행하지 말 것** — 이 커맨드가 실제 시크릿 값을 그대로 출력한다 (이번 세션에서
  실수로 노출시켜 즉시 재발급한 전례 있음). 값 확인이 꼭 필요하면 Edge Function 코드 안에서 `Deno.env.get()`으로만 참조.

## 3. 사용자 확정 결정사항

- 인증: **Supabase 기본 Auth 미사용.** 전화번호+비밀번호 커스텀 인증 (Edge Function + 자체 세션 토큰)
- 관리자: 최초 1명 수동 생성 완료 (로그인 ID는 사용자에게 확인. 비밀번호는 bcrypt 해시로만 DB에 저장되어 있어 아무도 모름 — 분실 시 재발급 로직 없음, 필요시 admins 테이블에 새 행 추가하는 방식으로만 대응 가능)
- Supabase: 개발용 프로젝트 (무료 플랜 — Free 플랜은 계정당 활성 프로젝트 2개 제한, 참고만)
- 프론트엔드: React 19 + Vite + TypeScript + Tailwind CSS v4 (`@tailwindcss/vite`)
- 라우팅: `react-router-dom`의 **HashRouter** (GitHub Pages는 서버사이드 라우팅이 없어 BrowserRouter는 새로고침 시 404가 남 — 반드시 HashRouter 유지할 것)
- 배포: GitHub Pages (GitHub Actions 워크플로우로 자동 배포), Vercel은 미도입

## 4. 완료된 로드맵 (cbck_bank_plan.md 9장 기준)

| # | 항목 | 상태 |
|---|---|---|
| 1 | Supabase 프로젝트 생성 + 3장 데이터 모델 SQL 마이그레이션 | ✅ |
| 2 | 인증 방식 설계 (전화번호+비밀번호 커스텀) | ✅ |
| 3 | GitHub 저장소 + React 뼈대 + GitHub Pages 배포 | ✅ (배포 상태 재확인 필요, 8-1 참조) |
| 4-로그인/등록 | 학생 인증 Edge Function 3개 + 화면 | ✅ |
| 7 | 관리자 기능 (기수/학생 등록) | ✅ |
| 8 | 프로젝트·문제 CRUD | ✅ (백엔드+프론트엔드, 브라우저 실제 테스트 완료) |
| 9 | CSV 업로드 | ❌ 미착수 |
| 10 | 퀴즈 세션 및 자동채점 | ❌ 미착수 |

### 4-1. DB 스키마 / 마이그레이션

`supabase/migrations/`에 2개 파일:

- `20260720000000_init_schema.sql`: `cohorts`, `users`, `admins`, `projects`, `problems`, `project_shares`,
  `problem_shares`, `quiz_sessions`, `session_answers`, `access_audit_log` 전체 테이블 + RLS 활성화 + 정책
- `20260720010000_phone_crypto_functions.sql`: `hash_phone` / `encrypt_phone` / `decrypt_phone` (pgcrypto 래퍼,
  `service_role`만 실행 가능)

**⚠️ 중요한 설계 사실**: `init_schema.sql`의 `projects`/`problems`/`users` 등에 걸린 RLS 정책은
`auth.uid()`를 기준으로 하지만, 이 프로젝트는 Supabase Auth를 쓰지 않으므로 **anon key로 직접 요청하면
`auth.uid()`가 항상 null이라 그 정책들은 사실상 절대 통과되지 않는다.** 즉 anon key 단독으로는 이 테이블들에
절대 접근 불가 (의도된 안전장치). **모든 실제 읽기/쓰기는 Edge Function이 `service_role`로 수행하면서
소유권·공유 로직을 코드로 직접 구현**하는 구조다. 새 기능을 추가할 때도 이 패턴을 그대로 따를 것 — RLS를
고치려 하지 말 것.

### 4-2. Edge Functions (`supabase/functions/`)

전부 `--no-verify-jwt`로 배포됨 (Supabase Auth JWT가 아닌 자체 토큰을 쓰므로).

| 함수 | 인증 | 설명 |
|---|---|---|
| `check-phone` | 없음(공개) | 전화번호 등록 여부 확인 |
| `activate-account` | 없음(공개) | 이름+인증질문 검증 → 비밀번호 설정 → 계정 활성화 |
| `login` | 없음(공개) | 학생 로그인, bcrypt 검증, 5회 실패 시 15분 잠금, 세션 토큰 발급 |
| `admin-login` | 없음(공개) | 관리자 로그인, `role:"admin"` 포함 세션 토큰 발급 |
| `admin-create-cohort` | `x-admin-token` | 기수 등록 |
| `admin-create-student` | `x-admin-token` | 학생 사전 등록 (전화번호 중복 체크 포함) |
| `admin-list-cohorts` | `x-admin-token` | 기수 목록 |
| `admin-list-students` | `x-admin-token` | 학생 목록 (`?cohortId=`로 필터) |
| `list-projects` | `x-user-token` | 본인 소유 + 공유받은 프로젝트 목록 |
| `create-project` / `update-project` / `delete-project` | `x-user-token` | 소유자만 수정/삭제 가능 |
| `list-problems` | `x-user-token` | 소유자는 전체, 비소유자는 공유 규칙 적용된 문제만 |
| `create-problem` / `update-problem` / `delete-problem` | `x-user-token` | 소유자만, 프로젝트당 100개 제한 |

공유 규칙(6장 정책)은 `list-problems`에 그대로 구현되어 있음: 문제의 `share_scope`가 `inherit`이면
프로젝트 설정을 따르고, `private`/`all`/`selected`로 개별 지정하면 프로젝트 설정보다 우선한다.

**`_shared/` 헬퍼**:
- `cors.ts`: 커스텀 헤더(`x-admin-token`, `x-user-token`)를 `Access-Control-Allow-Headers`에 반드시 포함해야 함.
  **새 Edge Function에 새 커스텀 헤더를 추가할 때마다 여기에도 추가하고 관련 함수를 재배포할 것** — 이번
  세션에서 이 헤더 누락으로 브라우저 요청이 전부 "Failed to fetch"로 조용히 막히는 버그를 두 번 겪었음
  (admin-token, user-token 각각). 안 고치면 curl 테스트는 통과하는데 실제 브라우저에서만 실패하니 주의.
- `session.ts`: HMAC-SHA256 서명 커스텀 세션 토큰 (payload: `{sub, exp, role?}`). `verifySessionToken`은
  파싱 실패 시 반드시 `null`을 반환하도록 try/catch로 감싸져 있음 (안 그러면 깨진 토큰이 500 에러를 냄).
- `adminAuth.ts` / `userAuth.ts`: 각각 `x-admin-token` / `x-user-token` 헤더에서 세션을 검증.
  `requireUser`는 `role==='admin'`인 토큰을 거부함 (관리자 토큰으로 학생 API를 못 쓰게).

### 4-3. 프론트엔드 (`src/`)

라우트 (`src/App.tsx`, HashRouter):

| 경로 | 페이지 | 설명 |
|---|---|---|
| `/` | `HomePage` | 랜딩 (학생 로그인 / 관리자 링크) |
| `/login` | `StudentAuthPage` | 전화번호 확인 → 로그인 또는 최초인증 분기 |
| `/home` | `StudentHomePage` | 로그인 후 홈 (문제풀이는 아직 placeholder) |
| `/projects` | `ProjectsPage` | 프로젝트 목록/생성 |
| `/projects/:projectId` | `ProjectDetailPage` | 문제 등록(유형별 폼)/목록/공유설정/삭제 |
| `/admin/login` | `AdminLoginPage` | 관리자 로그인 |
| `/admin` | `AdminDashboardPage` | 기수/학생 등록·목록 |

- `src/lib/api.ts`: 모든 Edge Function 호출을 감싼 얇은 클라이언트 (`api.xxx()`). 새 Edge Function을 추가하면
  여기에도 타입과 함수를 추가할 것.
- `src/lib/session.ts`: `localStorage` 기반 토큰 저장 (`adminSession`, `studentSession`). Supabase Auth
  세션이 아니라 완전히 별도 구현이므로 `supabase.auth.*`는 이 프로젝트에서 쓸 일이 없음.
- `src/lib/supabaseClient.ts`: 존재하지만 현재 실제로 쓰이는 곳은 없음 (모든 데이터 접근이 Edge Function
  경유). 나중에 필요 없으면 정리 대상.

## 5. 로컬 개발 환경 메모

- `npm run dev` / `npm run build` 정상 동작 확인됨.
- `vite.config.ts`의 `base: '/CBCK_Bible-Study/'` 때문에 dev 서버도 `http://localhost:PORT/CBCK_Bible-Study/`
  경로로 열어야 화면이 뜸 (루트 `/`는 404).
- 이 저장소 상위 폴더(`D:\workspace\claude\.claude\launch.json`)에 dev 서버 프리뷰 설정이 있음
  (`npm run dev --prefix CK`, autoPort). 브라우저 프리뷰 도구로 열 때 포트 충돌 시 자동으로 다른 포트를 씀 —
  이때 `vite.config.ts`에 `server.port = process.env.PORT` 설정을 임시로 넣어야 프리뷰 도구가 잡아준 포트와
  실제 vite 서버 포트가 일치함 (안 넣으면 vite가 자체적으로 다른 포트를 골라 프리뷰가 빈 화면을 보여줌).
  **테스트 끝나면 이 임시 설정은 반드시 되돌릴 것** (커밋하지 않는 게 맞음, 실사용자 배포와 무관한 개발 편의 설정).
- Windows Git Bash에서 curl로 한글 JSON을 테스트할 때 heredoc 방식은 인코딩이 깨질 수 있음 — 파일로 JSON을
  작성한 뒤 `curl --data-binary @file.json`을 쓸 것 (이번 세션에서 겪은 이슈, activate-account 테스트 참조).

## 6. 보안 관련 확정 사항

- `.gitignore`에 `.env`, `.env.*`(예외 `.env.example`), `supabase/.temp/` 포함됨. 프론트엔드에는 Project URL /
  anon key만 노출되고, service_role key와 3개 커스텀 시크릿은 Edge Function 환경변수에만 존재.
- 전화번호는 `phone_hash`(HMAC, 조회용) + `phone_encrypted`(pgp_sym, admin 열람용) 이중 저장, 평문 저장 없음.
- 비밀번호는 bcrypt(`bcryptjs`, cost 10) 해시.
- 로그인 5회 실패 시 15분 계정 잠금 (`users.failed_attempts`, `locked_until`), Edge Function `login`에 구현됨.
- **`access_audit_log`(개인정보 열람 이력) 테이블은 만들어져 있지만 아직 아무 Edge Function도 여기에 기록하지
  않음** — admin이 전화번호를 복호화(`decrypt_phone`)해서 열람하는 기능 자체가 아직 없음 (필요해지면 구현 시
  반드시 이 로그도 같이 남길 것, 10-4장 정책).

## 7. 알려진 미해결 이슈 / 기술 부채

1. **공개 엔드포인트에 rate limiting 없음**: `check-phone`, `login`, `activate-account`, `admin-login`은 인증 없이
   누구나 호출 가능. 현재는 실패 횟수 잠금(로그인만) 외에 무차별 대입 방어가 없음. 실사용 배포 전에 고려 필요.
2. **공유 대상 "특정 사용자 선택"(selected) UI 없음**: 백엔드(API, `sharedUserIds` 파라미터)는 이미 지원하지만,
   프론트엔드에는 이 사람 저 사람 골라서 공유하는 화면이 없음. 지금 UI는 `private`/`all`만 선택 가능.
3. **`src/lib/supabaseClient.ts` 미사용**: 정리하거나, 나중에 실시간 기능(퀴즈 세션 등) 붙일 때 활용.
4. **GitHub Pages 실제 배포 상태 미확인**: 워크플로우 파일은 push됐고 여러 커밋이 그 뒤로 push됐지만, 이
   세션에서 Actions 실행 로그나 실제 배포 URL 응답을 직접 확인하지 못함 (`gh` CLI 미설치 환경이었음).
   **다음 작업자가 가장 먼저 할 일**: `https://github.com/YeansooJeong/CBCK_Bible-Study/actions`에서 워크플로우
   성공 여부 확인, 안 됐으면 Settings → Pages → Source가 "GitHub Actions"로 되어 있는지 확인.
5. **비밀번호/관리자 계정 찾기(recovery) 플로우 없음**: 학생이 비밀번호를 잊으면 admin이 DB를 직접 고치는
   수밖에 없음 (수동 대응). 필요성 판단 후 결정할 것 — 기획서에 명시된 요구사항은 아님.

## 8. 다음 작업 (우선순위 순)

### 8-1. GitHub Pages 배포 상태 확인 (제일 먼저)
Actions 탭에서 최신 워크플로우 실행 결과 확인 → 실패 시 원인 파악 후 수정.

### 8-2. CSV 업로드 (로드맵 9번)
- 기획서 5장 CSV 서식 그대로 따를 것 (`type,question,option1~4,answer,keywords,ref_course,ref_session,ref_location`)
- Edge Function `bulk-create-problems` 같은 이름으로 새로 만들어, 파싱된 행 배열을 받아 `create-problem`과
  동일한 검증(타입/공백/100개 제한)을 반복 적용하는 방식을 권장. 클라이언트에서 CSV를 파싱(예: 브라우저에서
  간단한 split 또는 가벼운 CSV 파서 라이브러리)해서 JSON 배열로 변환 후 이 함수로 전송.
- 프론트엔드: `ProjectDetailPage`에 "CSV 업로드" 버튼 + 파일 인풋 추가.

### 8-3. 퀴즈 세션 및 자동채점 (로드맵 10번)
- 데이터 모델은 이미 있음: `quiz_sessions`, `session_answers`.
- 새 Edge Function 예상: `start-quiz-session`(레퍼런스 범위+문제 개수 선택 → 조건에 맞는 문제 추출 →
  세션 생성), `submit-answer`(문제별 채점: mcq는 정답 번호 비교, short/bible은 4장에 명시된 "키워드/유사도
  매칭" 채점 로직 — `gradeShortAnswer()` 같은 함수로 분리해서 나중에 LLM 채점으로 교체 가능하게 설계할 것),
  `finish-quiz-session`(결과 집계: 총 문제 수/정답 수/레퍼런스별 취약 구간).
- 프론트엔드: 카드 1장 = 문제 1개 UI, 풀이 진행률 표시, 결과 화면.

## 9. 변경 이력 (이 문서)

| 날짜 | 내용 |
|---|---|
| 2026-07-20 (오전) | 최초 인수인계 문서 작성 (GitHub Pages 설정 중단 시점) |
| 2026-07-20 (오후) | 전체 재작성: Pages 배포, Tailwind, Supabase 연결, 인증 Edge Function, 관리자 기능, 프로젝트·문제 CRUD(백엔드+프론트엔드) 완료 반영. CORS 커스텀 헤더 이슈 2건, 시크릿 노출 사고 및 재발급 이력 기록 |
