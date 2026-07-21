# 로그인 화면 UI/UX 개선을 위한 기술 명세서

> 이 문서는 **다른 LLM/도구로 로그인 관련 화면의 UI/UX를 재설계**하기 위해 작성되었습니다.
> 현재 기능/로직/API 계약을 정확히 파악한 뒤, **시각적 레이어(레이아웃·스타일·컴포넌트 구조)만
> 자유롭게 재설계**하고, 아래 "반드시 유지해야 할 것" 항목은 그대로 보존해주세요.
> 프로젝트 전체 맥락은 `cbck_bank_plan.md`(기획서)와 `CLAUDE_HANDOFF.md`(개발 현황)를 참고하세요.

---

## 1. 로그인 관련 화면 3개 개요

| 라우트 | 파일 | 역할 |
|---|---|---|
| `/` (`#/`) | `src/pages/HomePage.tsx` | 랜딩 페이지. "학생 로그인" / "관리자" 두 개의 진입 버튼만 있음 |
| `/login` (`#/login`) | `src/pages/StudentAuthPage.tsx` | **학생용** — 전화번호 확인 → 로그인 또는 최초 인증(계정 활성화) 분기 |
| `/admin/login` (`#/admin/login`) | `src/pages/admin/AdminLoginPage.tsx` | **관리자용** — 로그인 또는 최초 관리자 생성 |

라우팅은 `react-router-dom`의 **`HashRouter`**를 사용합니다(`src/App.tsx`). GitHub Pages는
서버사이드 라우팅이 없어서 `BrowserRouter`를 쓰면 새로고침 시 404가 나기 때문입니다. 실제
URL은 `https://.../#/login` 형태로 `#`이 반드시 포함됩니다. 재설계 시에도 라우팅 방식은
그대로 유지해야 합니다.

배포 base 경로는 `/CBCK_Bible-Study/` (`vite.config.ts`)이며, 로컬 개발 시 dev 서버도
`http://localhost:PORT/CBCK_Bible-Study/#/login` 형태로 접속해야 화면이 뜹니다.

---

## 2. HomePage (`/`) — 진입점

현재 구조: 제목 + 부제 + 버튼 2개(`Link to="/login"`, `Link to="/admin/login"`). 별도의
상태나 API 호출 없음. 재설계 범위에 포함해도 되고, 그대로 둬도 무방합니다.

---

## 3. StudentAuthPage (`/login`) — 학생 로그인/최초 인증

### 3-1. 상태 머신 (핵심 로직 — 반드시 유지)

내부 상태 `step`은 4가지 값 중 하나입니다: `'phone' | 'login' | 'activate' | 'not-registered'`

```
[phone] --(전화번호 입력 → check-phone 호출)-->
  ├─ 등록 안 됨           → [not-registered]
  ├─ 등록됨 + status=pending → [activate]  (최초 접속, 인증질문 필요)
  └─ 등록됨 + status=active  → [login]     (이미 활성화된 계정)

[login] --(비밀번호 입력 → login 호출 성공)--> /home 으로 이동
[activate] --(인증질문+새 비밀번호 → activate-account 호출 성공)--> [login] 으로 되돌아감
[not-registered] --(돌아가기 버튼)--> [phone]
```

- 이 4단계 흐름과 분기 조건은 **기능적 계약**입니다. 화면을 하나로 합치든, 애니메이션
  전환을 넣든 자유지만 **각 단계에서 호출하는 API와 그 순서/조건은 그대로 유지**해야 합니다.
- 각 단계는 현재 별도 컴포넌트가 아니라 **한 컴포넌트 안에서 조건부 렌더링**되고 있습니다
  (`step === 'phone' && (...)` 형태). 여러 파일/컴포넌트로 쪼개도 무방합니다.

### 3-2. 단계별 입력 필드

**[phone] 단계**
- 입력: 전화번호 (`type="tel"`, placeholder: "전화번호 (- 없이)") — 하이픈 없이 숫자만 입력받는 관례
- 버튼: "다음" (제출 시 `api.checkPhone(phone)` 호출)

**[not-registered] 단계**
- 안내 문구만 표시: "등록되지 않은 전화번호입니다. 관리자에게 문의해주세요."
- 버튼: "돌아가기" (phone 단계로 복귀, 입력값 리셋 없음 — 전화번호는 유지됨)

**[login] 단계**
- 입력: 비밀번호 (`type="password"`)
- 버튼: "로그인" (제출 시 `api.login(phone, password)` 호출 → 성공하면 `studentSession.set(token, user)` 후 `navigate('/home')`)

**[activate] 단계** (최초 접속 = 계정 활성화)
- 안내 문구: "최초 로그인입니다. 본인 확인 후 비밀번호를 설정해주세요."
- 입력 필드 5개, 전부 필수:
  1. 이름 (placeholder: "이름")
  2. 간사 이름 (placeholder: "간사 이름")
  3. 반장 이름 (placeholder: "반장 이름")
  4. 킹제임스 성경(영어) 출판연도 (placeholder: "킹제임스 성경(영어) 출판연도 (예: 1611)")
  5. 새 비밀번호 (`type="password"`, placeholder: "새 비밀번호 (8자 이상)")
- 버튼: "계정 활성화" (제출 시 `api.activateAccount({phone, name, staffName, leaderName, kjvYear, password: newPassword})` 호출 → 성공하면 `step`을 `'login'`으로 전환)

### 3-3. 에러 메시지 매핑 (`errorMessage(code)` 함수)

백엔드가 반환하는 에러 코드를 한글 메시지로 변환합니다. **에러 코드 종류와 발생 상황은
그대로 유지**하되, 문구/톤/노출 방식(토스트, 인라인, 모달 등)은 자유롭게 바꿔도 됩니다.

| 에러 코드 | 현재 메시지 | 발생 상황 |
|---|---|---|
| `invalid_credentials` | 전화번호 또는 비밀번호가 올바르지 않습니다. | login 단계, 비밀번호 틀림 |
| `locked` | 5회 이상 로그인에 실패하여 계정이 잠겼습니다. 잠시 후 다시 시도해주세요. | login 단계, 5회 연속 실패로 15분 잠금 상태 |
| `name_mismatch` | 이름이 일치하지 않습니다. | activate 단계, 이름이 admin 등록값과 다름 |
| `auth_question_mismatch` | 간사 이름 / 반장 이름 / 킹제임스 성경(영어) 출판연도 중 일치하지 않는 항목이 있습니다. | activate 단계, 인증질문 중 하나라도 불일치 |
| `weak_password` | 비밀번호는 8자 이상이어야 합니다. | activate 단계, 비밀번호 8자 미만 |
| `already_active` | 이미 활성화된 계정입니다. 로그인해주세요. | activate 단계인데 이미 status=active인 계정 (이론상 거의 안 뜸 — check-phone이 먼저 걸러줌) |
| `rate_limited` (신규, 메시지 미매핑) | → default로 빠짐 | 동일 IP에서 짧은 시간에 너무 많이 요청 (아래 6장 참고). **재설계 시 이 코드도 명시적으로 매핑해서 "잠시 후 다시 시도해주세요" 같은 문구를 보여주는 걸 권장** |
| 기타 전부 | 오류가 발생했습니다. 잠시 후 다시 시도해주세요. | 네트워크 오류 등 |

---

## 4. AdminLoginPage (`/admin/login`) — 관리자 로그인/최초 생성

### 4-1. 두 가지 모드 (토글)

내부 상태 `setupMode: boolean`으로 전환되는 **로그인 모드**와 **최초 관리자 생성 모드**가
하나의 화면에 공존합니다. 하단의 "초기 관리자 생성" / "로그인으로 돌아가기" 링크 버튼으로 토글합니다.

**로그인 모드 (기본, `setupMode=false`)**
- 입력: 아이디(자유 입력, 특정 값으로 고정 아님), 비밀번호
- 버튼: "로그인" → `api.adminLogin(loginId, password)` → 성공 시 `adminSession.set(token)` 후 `navigate('/admin')`
- 실패 시 메시지: "아이디 또는 비밀번호가 올바르지 않습니다."

**최초 관리자 생성 모드 (`setupMode=true`)**
- 입력: 아이디는 **`admin`으로 고정된 disabled 필드** (수정 불가, 안내문구 "최초 생성 시 관리자 ID는 admin으로 고정됩니다." 표시), 비밀번호, 비밀번호 확인
- 클라이언트 유효성 검사: 비밀번호 8자 이상 + 비밀번호=비밀번호 확인 일치 (불일치 시 API 호출 전에 바로 에러 표시)
- 버튼: "관리자 생성" → `api.setupAdmin(password)` (내부적으로 `loginId:'admin'` 고정 전송) → 성공 시 setupMode를 false로 되돌리고 "초기 관리자 계정(admin)이 생성되었습니다. 로그인해 주세요." 안내
- **이 기능은 `admins` 테이블이 완전히 비어있을 때(즉 관리자가 한 명도 없을 때)만 성공합니다.**
  이미 관리자가 있으면 항상 `admin_already_exists` 에러가 나며, 이는 버그가 아니라 정상
  동작입니다 (현재 이 프로젝트는 이미 관리자 계정이 등록되어 있어 이 모드는 사실상 비활성 상태).

### 4-2. 과거 버그 이력 (재설계 시 반드시 회피)

이전 버전에서 "최초 관리자 생성" 기능을 추가하면서 **로그인 모드의 아이디 입력란까지
`admin`으로 고정(disabled)해버려서, 실제 등록된 관리자 ID(예: 커스텀 숫자 ID)로 로그인이
전혀 불가능해지는 버그**가 있었습니다. 지금은 고쳐져서 로그인 모드는 자유 입력, 생성
모드만 `admin` 고정입니다. **재설계 시 이 둘을 다시 섞지 않도록 주의하세요.**

---

## 5. 백엔드 API 계약 (`src/lib/api.ts` 래퍼 기준)

모든 호출은 Supabase Edge Function을 통하며, 요청 헤더에 `apikey`(anon key)가 항상 실려
나갑니다. 아래 5개는 전부 **인증 토큰 없이 호출 가능한 공개 엔드포인트**입니다
(로그인 전이라 당연히 토큰이 없음).

| API 함수 (`api.xxx`) | Edge Function | Method | 요청 바디 | 성공 응답 | 주요 실패 응답 |
|---|---|---|---|---|---|
| `checkPhone(phone)` | `check-phone` | POST | `{ phone }` | `{ registered: boolean, status?: 'pending'\|'active' }` | 400 `phone_required`, 429 `rate_limited` |
| `login(phone, password)` | `login` | POST | `{ phone, password }` | `{ success: true, token, user: { id, displayName } }` | 401 `invalid_credentials`, 423 `locked` (+ `lockedUntil`), 429 `rate_limited` |
| `activateAccount({...})` | `activate-account` | POST | `{ phone, name, staffName, leaderName, kjvYear, password }` | `{ success: true }` | 400 `missing_fields`/`weak_password`/`name_mismatch`/`auth_question_mismatch`, 404 `not_found`, 429 `rate_limited` |
| `adminLogin(loginId, password)` | `admin-login` | POST | `{ loginId, password }` | `{ success: true, token }` (payload에 `role:"admin"` 포함) | 401 `invalid_credentials`, 429 `rate_limited` |
| `setupAdmin(password)` | `setup-admin` | POST | `{ loginId: 'admin', password }` (loginId는 함수 내부에서 고정) | `{ success: true }` | 400 `invalid_setup`, 409 `admin_already_exists`, 429 `rate_limited` |

### 5-1. `activate-account`의 "유연 매칭" 로직 (중요 — UX 문구에 반영 권장)

인증질문 3개(간사 이름/반장 이름/킹제임스 출판연도)는 **완전 일치가 아니라 유연하게
매칭**됩니다:
- **이름류(간사/반장 이름)**: 공백을 제거한 뒤 서로 포함 관계면 통과. 예) 등록값이
  "홍길동"이면 학생이 "홍길동 간사님"이라고 입력해도 통과.
- **연도(킹제임스 출판연도)**: 숫자만 추출해서 비교. 예) 등록값이 "1611"이면 학생이
  "1611년", "1611년도"라고 입력해도 통과.
- 반면 **학생 본인 이름(name)**은 완전 일치만 허용합니다 (동명이인 등 신원 확인이라
  느슨하게 하면 안 되는 값).
- **UX 힌트**: 이런 유연 매칭이 있다는 걸 사용자가 알 필요는 없지만, placeholder에
  "(예: 1611)"처럼 예시를 보여줘서 정확한 형식을 유도하는 지금 방식은 유지하거나
  개선하면 좋습니다.

### 5-2. `login`의 계정 잠금 정책

5회 연속 비밀번호 실패 시 **해당 계정만** 15분간 잠금(`locked_until`). 성공하면
`failed_attempts`가 0으로 리셋됩니다. 잠금 중에는 올바른 비밀번호를 넣어도 423 `locked`가
반환됩니다. **재설계 시 "몇 번 더 틀리면 잠기는지" 같은 사전 경고 UI를 추가하는 것도 좋은
개선 포인트입니다** (현재는 잠긴 *후*에만 알려줌).

---

## 6. Rate Limiting (신규 추가됨 — UX에서 별도 처리 권장)

아래 5개 공개 엔드포인트 전부 **IP 기준 고정 윈도우 카운터**로 요청 횟수를 제한합니다
(`supabase/functions/_shared/rateLimit.ts`). 초과 시 HTTP 429 + `{ error: 'rate_limited' }`.

| 엔드포인트 | 제한 |
|---|---|
| `check-phone` | 10분당 30회 |
| `login` | 10분당 30회 (계정별 5회 잠금과 별개) |
| `activate-account` | 10분당 10회 |
| `admin-login` | 10분당 10회 |
| `setup-admin` | 10분당 5회 |

현재 프론트엔드는 `rate_limited` 코드를 별도로 매핑하지 않고 "오류가 발생했습니다"로
뭉뚱그려 보여줍니다. **재설계 시 이 코드에 맞는 전용 안내("요청이 너무 많습니다. 잠시 후
다시 시도해주세요" 등)를 추가하는 것을 권장**합니다.

---

## 7. 세션 저장 (`src/lib/session.ts`)

- Supabase Auth를 쓰지 않는 **완전 커스텀 세션**입니다 (`supabase.auth.*` 관련 API는 이
  프로젝트에서 전혀 사용되지 않음).
- `localStorage` 3개 키만 사용:
  - `cbck_admin_token`: 관리자 세션 토큰(문자열)
  - `cbck_student_token`: 학생 세션 토큰(문자열)
  - `cbck_student_user`: `{ id, displayName }` JSON 문자열
- 토큰 자체는 HMAC-SHA256으로 서명된 자체 포맷 (`{sub, exp, role?}`를 base64url로 담은
  2-segment 문자열). 프론트엔드는 이 토큰을 파싱하지 않고 그냥 저장했다가 이후 API
  호출 시 `x-user-token` / `x-admin-token` 헤더로 그대로 실어 보내기만 합니다.
- 로그인 성공 후 리다이렉트: 학생은 `/home`, 관리자는 `/admin`.

---

## 8. 현재 디자인 시스템 상황 (★ 재설계 시 가장 중요한 포인트)

**로그인 관련 3개 화면(HomePage, StudentAuthPage, AdminLoginPage)은 여전히 예전
Tailwind 유틸리티 클래스 방식**(`bg-white`, `rounded-lg`, `dark:bg-neutral-950` 등)으로
스타일링되어 있습니다.

반면 **로그인 이후 화면들(홈 대시보드 `/home`, 프로젝트 목록/상세, 새 문제 만들기)은
이미 완전히 다른 디자인 시스템으로 교체되었습니다**: Tailwind 유틸리티를 거의 쓰지 않고,
`src/index.css`에 정의된 **"세이지·골드(sage & gold)" 톤의 커스텀 CSS 클래스**
(`.student-shell`, `.primary-button`, `.secondary-button`, `.field`, `.notice` 등)와
공통 레이아웃 컴포넌트 `src/components/StudentShell.tsx`(상단 네비게이션 바 포함)를
사용합니다.

디자인 토큰 (`src/index.css` 최상단):
```css
:root {
  --ink:#1e2b25; --forest:#24483a; --sage:#6f8f7a; --sage-soft:#dde8de;
  --gold:#c9a65a; --paper:#fbfcf8; --line:#e2e9e3; --muted:#6e7a73;
}
```
폰트: `Pretendard, "Noto Sans KR", SUIT, system-ui, sans-serif`

**따라서 로그인 화면을 재설계할 때는 다음 중 하나를 선택해야 합니다:**
1. **(권장)** `/home` 이후 화면들과 톤을 맞춰 세이지·골드 디자인 시스템(`.field`,
   `.primary-button`, `.secondary-button`, `.notice` 등 기존 클래스)을 그대로 재사용하거나
   확장해서 로그인 화면도 통일된 느낌으로 만들기. `StudentShell` 컴포넌트는 로그인 전에는
   쓸 수 없으므로(사용자 정보가 없음), 로그인 전용 심플 레이아웃을 새로 만들되 색상/타이포/
   버튼 스타일만 통일.
2. 로그인 화면만의 별도 톤을 의도적으로 유지 (예: 온보딩 느낌을 다르게 주고 싶은 경우) —
   이 경우 그 의도를 명확히 밝혀주세요.

현재는 **위 둘 다 아닌 애매한 상태**(로그인만 예전 스타일)라서, 사용자가 로그인 화면 →
홈 화면으로 넘어갈 때 디자인 톤이 갑자기 바뀌는 문제가 있습니다. 이번 재설계의 핵심
목적 중 하나가 바로 이 불일치 해소로 보입니다.

다크모드 관련: `src/index.css`에 `@custom-variant dark (&:where(.dark, .dark *));`가
있어서 `.dark` 클래스를 아무 데도 추가하지 않는 한 Tailwind의 `dark:` 유틸리티는
항상 비활성 상태입니다 (OS가 다크모드여도 사이트는 항상 라이트 테마). 로그인 화면
코드에 남아있는 `dark:` 클래스들은 사실상 죽은 코드이니, 재설계 시 정리해도 됩니다.

---

## 9. 반드시 유지해야 할 것 (기능적 계약 요약)

- [ ] `StudentAuthPage`의 4단계 상태 흐름(`phone → not-registered / login / activate`)과
      각 단계에서 호출하는 API, 성공/실패 시 다음 상태로의 전이 로직
- [ ] `AdminLoginPage`의 로그인/최초생성 두 모드와, 최초생성 모드에서 아이디가 `admin`으로
      고정되는 것 (로그인 모드 아이디는 절대 고정하지 말 것 — 8-2 버그 재발 방지)
- [ ] 각 API 호출의 파라미터 이름/형태 (`src/lib/api.ts`의 시그니처 그대로)
- [ ] 로그인 성공 후 리다이렉트 경로 (`/home`, `/admin`)와 `studentSession`/`adminSession`
      저장 호출
- [ ] `HashRouter` 기반 라우팅 (URL에 `#` 유지)
- [ ] 에러 코드 목록(4장 표) — 문구는 자유, 코드-상황 매핑은 유지. `rate_limited` 코드는
      기존에 없던 케이스이니 신규로 잘 처리해주면 좋음

## 10. 자유롭게 바꿔도 되는 것

- 레이아웃, 색상, 타이포그래피, 애니메이션/전환 효과
- 하나의 폼으로 합칠지, 여러 단계 위저드로 보여줄지, 진행 표시(스텝 인디케이터)를
  추가할지 등 정보 구조
- placeholder 문구, 에러 메시지 문구, 버튼 라벨
- 입력 검증 UX (실시간 검증, 포맷팅 도우미 — 예: 전화번호 자동 하이픈 등)
- `HomePage`의 랜딩 디자인 전체
