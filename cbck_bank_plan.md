# 신학원 문제은행 사이트 — 기획서 (Living Document)

> 이 문서는 "살아있는 문서"입니다. 개발을 진행하면서 정책이 바뀌면 반드시
> **13. 변경 이력**에 날짜와 변경 내용을 추가하고, 해당 섹션 본문도 함께 수정하세요.
> 바이브코딩 진행 시 AI(Claude 등)에게 "이 문서를 기준으로 개발해줘"라고 하면,
> 이 문서 하나로 전체 맥락을 계속 유지할 수 있습니다.

---

## 0. 이 문서의 구조 (전체 지도)

```
1. 프로젝트 개요        → 무엇을, 왜 만드는가
2. 사용자/인증 정책      → 누가 어떻게 들어오는가
3. 데이터 모델           → 무엇을 어떤 표(table)에 저장하는가
4. 문제 유형 & 채점 정책 → 문제를 어떻게 내고 어떻게 채점하는가
5. CSV 업로드 서식       → 문제를 대량으로 넣는 표준 양식
6. 공유/배포 정책        → 누구에게 문제를 보여줄지 정하는 규칙
7. 풀이(학습) 플로우     → 학생이 문제를 푸는 화면 흐름
8. 원 요구사항 검증 결과 → 처음 요구사항 중 무엇을 왜 바꿨는지
9. 개발 로드맵           → GitHub + Supabase로 실제로 만드는 순서
   9-1. 프론트엔드 기술/디자인 방향
   9-2. Claude Code/Codex 실행 지침 (로컬 작업 → GitHub → Supabase)
10. 정보보안 지침        → 이름/전화번호를 어떻게 안전하게 저장·보호할지
11. 용어집
12. 확정된 정책 요약 (한눈에 보기)
13. 변경 이력
```

각 섹션은 서로 참조합니다. 예를 들어 "4. 채점 정책"을 개발할 때는 "3. 데이터 모델"의
`problems` 테이블 구조를 같이 봐야 합니다. 개발 착수 전에 반드시 3번과 9번을 먼저 읽으세요.

---

## 1. 프로젝트 개요

- **목적**: 교회 신학원 학생들의 개인 학습·복습을 돕는 문제은행 사이트. 시험 출제/채점
  용도가 아니라 **자율 학습 도구**입니다.
- **핵심 이용 흐름**: 학생이 문제를 만들어 저장 → (원하면) 다른 학생에게 공유 → 학생들이
  범위를 정해 문제를 풀고 즉시 피드백을 받음.
- **접근 방식**: 폐쇄형 서비스. Admin이 등록한 사람만 가입 가능 (불특정 다수 가입 불가).

---

## 2. 사용자 및 인증 정책 ✅확정

### 2-1. Admin 사전 등록
Admin은 **기수(cohort) 단위**로 아래 정보를 먼저 등록합니다.

| 등록 단위 | 항목 |
|---|---|
| 기수(1회) | 기수명, 담당 간사 이름, 반장 이름, 사용하는 킹제임스 성경 출판연도 |
| 학생(각 1건) | 이름, 전화번호, 소속 기수 |

> **왜 기수 단위로 나눴나요?** 간사이름/반장이름/출판연도는 같은 기수 학생이면 모두 동일한
> 값입니다. 학생 개개인마다 반복 입력하면 admin의 관리 부담이 커지고 오타로 인한 로그인
> 실패가 늘어나므로, 기수에 1번만 등록하고 학생은 이름/전화번호만 별도 관리합니다.

### 2-2. 학생 최초 접속 (본인 인증 + 계정 활성화)
1. 전화번호 입력 → admin이 등록한 번호인지 확인
2. 이름 확인 (전화번호-이름 매칭 확인)
3. 소속 기수의 인증질문 3개에 답변: 간사이름 / 반장이름 / 출판연도
4. 3개 모두 일치하면 → 비밀번호 설정 → 계정 활성화 완료

### 2-3. 이후 로그인
- **로그인 ID = 전화번호**, 비밀번호로 로그인 (이름 대신 전화번호를 ID로 써서 동명이인
  충돌을 원천 차단)

---

## 3. 데이터 모델 개요

실제 SQL DDL은 Supabase 세팅 단계(9장)에서 함께 작성합니다. 여기서는 "어떤 표가
왜 필요한지"만 정리합니다.

| 테이블 | 핵심 컬럼 | 역할 |
|---|---|---|
| `cohorts` (기수) | id, name, staff_name(간사), leader_name(반장), kjv_year | 인증질문 정답 저장소 |
| `users` (학생) | phone_hash(로그인조회용 해시), phone_encrypted(암호화된 원본), name, display_name(공개용), cohort_id, password_hash, failed_attempts, locked_until, status | 계정 정보 — 보안 구조는 **10장** 참조 |
| `admins` | id, login 정보 | 관리자 계정 |
| `projects` (문제 묶음) | id, owner_id, title, share_scope(private/all/selected) | 문제 최대 100개를 담는 상자 |
| `problems` (문제) | id, project_id, type(mcq/short/bible), question, options(json), answer, keywords(단답 채점용), ref_course, ref_session, ref_location, share_scope(inherit/private/all/selected) | 문제 본체 |
| `project_shares` / `problem_shares` | project_id or problem_id, target_user_id | "선택 사용자 공유" 대상 목록 |
| `quiz_sessions` (풀이 회차) | id, user_id, started_at, total, correct | 한 번의 풀이 세션 |
| `session_answers` | session_id, problem_id, user_answer, is_correct, match_score | 문제별 응답 기록 |
| `access_audit_log` | actor_id, target_user_id, action, created_at | 개인정보 열람/수정 이력 (10장 보안지침) |

> **레퍼런스를 3개 필드로 나눈 이유**: 원 요구사항 12번 예시("강의: 창세기 / 회차: 1강 /
> 위치: ~")는 한 줄 텍스트였는데, 요구사항 13·14번(범위를 지정해 문제를 추출)을 구현하려면
> "회차"나 "강의명"으로 검색·필터링이 가능해야 합니다. 한 줄 텍스트로는 필터링이 어려워
> `ref_course`(강의명) / `ref_session`(회차) / `ref_location`(위치)로 분리했습니다.

---

## 4. 문제 유형 & 채점 정책 ✅확정

| 유형 | 필수 입력 | 채점 방식 |
|---|---|---|
| 4지선다 객관식(mcq) | 문제, 보기 4개, 정답 번호 | **즉시 자동채점** (정답 번호 일치 여부) |
| 단답/짧은서술형(short) | 문제, 정답(키워드 여러 개 가능) | 1차: **키워드/유사도 매칭** 자동 채점 → 정답 여부 + 레퍼런스 노출 |
| 성경문제(bible) | 문제, 정답 성경책/장/절 | 1차: **키워드/유사도 매칭** (책/장/절 표기가 정확히 맞는지 매칭) |

- **정답 레퍼런스는 원칙적으로 필수 기재** (요구사항 11번 유지, 학습 효과를 위해 강제 권장)
- **1차 채점 로직**: 사용자 답변과 정답/키워드 목록을 비교해 핵심 단어 포함 여부·유사도
  점수(예: 문자열 유사도 or 형태소 겹침 비율)로 정답 여부 판정. 완전 자동 AI 해석이 아니므로
  경계 사례(애매한 표현)는 "정답과 레퍼런스를 보여주고 사용자가 최종 판단"하는 방식을 병행.
- **추후 확장 포인트**: 채점 정확도가 부족하면 Claude API 등 LLM 채점으로 교체 가능하도록
  채점 로직을 별도 함수/모듈로 분리해서 개발 (예: `gradeShortAnswer()` 함수 하나만 교체하면
  되도록 설계 — 나중에 API 연동 난이도를 낮추는 장치).

---

## 5. CSV 업로드 서식 (제안)

문제 유형이 섞여도 **한 개의 CSV 파일**로 업로드할 수 있도록 공통 컬럼 구조를 제안합니다.

| 컬럼명 | 설명 | mcq | short | bible |
|---|---|---|---|---|
| `type` | mcq / short / bible | 필수 | 필수 | 필수 |
| `question` | 문제 본문 | 필수 | 필수 | 필수 |
| `option1`~`option4` | 보기 4개 | 필수 | 비움 | 비움 |
| `answer` | mcq: 정답 번호(1~4) / short: 정답 텍스트 / bible: `책;장;절` | 필수 | 필수 | 필수 |
| `keywords` | 단답 채점용 추가 키워드 (`;`로 구분) | 비움 | 선택 | 선택 |
| `ref_course` | 강의명 (예: 창세기) | 권장 | 권장 | 권장 |
| `ref_session` | 회차 (예: 1강) | 권장 | 권장 | 권장 |
| `ref_location` | 위치 (예: 강의요약본 중반부) | 권장 | 권장 | 권장 |

예시 행:
```
type,question,option1,option2,option3,option4,answer,keywords,ref_course,ref_session,ref_location
mcq,"천지창조는 며칠 동안 이루어졌는가?",3일,6일,7일,40일,2,,창세기,1강,강의요약본 초반부
short,"믿음의 정의를 한 문장으로 쓰시오.",,,,,"바라는 것들의 실상","실상;증거;바라는것",히브리서,3강,강의 유튜브 5분경
bible,"믿음장으로 불리는 본문의 위치는?",,,,,"히브리서;11;1",,히브리서,3강,강의요약본 후반부
```

---

## 6. 공유/배포 정책 ✅확정

- **기본값**: 문제/프로젝트는 작성자만 조회·수정·삭제 가능 (private)
- **공유 단위**: 프로젝트 단위 공유 + 문제 단위 공유 둘 다 지원
- **우선순위 규칙**: 문제의 `share_scope`가 `inherit`(기본값)이면 소속 프로젝트의 공유 설정을
  따르고, 문제에 개별적으로 `share_scope`를 지정하면 **문제 설정이 프로젝트 설정보다 우선**합니다.
  (예: 프로젝트는 비공개여도 특정 문제만 전체 공개로 지정 가능)
- **공유 대상**: 전체 사용자 / 선택한 사용자 목록 중 선택

---

## 7. 풀이(학습) 플로우

1. 사용자가 풀이 화면 진입 → 배포된 문제 중 **레퍼런스(강의/회차) 범위** 선택 + **문제 개수** 선택
2. 시스템이 조건에 맞는 문제를 추출해 세션 생성
3. **카드 1장 = 문제 1개**로 제공
4. 문제 풀이 후 즉시: 정답 여부 + 레퍼런스 표시 (mcq는 즉시 정오, short/bible은 매칭 결과 + 정답 확인)
5. 전체 풀이 종료 후: 총 문제 수, 정답 수, **레퍼런스(강의/회차)별 취약 구간** 피드백 제공

---

## 8. 원 요구사항 검증 결과 (충돌/개선 사항)

| 원 요구사항 | 이슈 | 반영된 결정 |
|---|---|---|
| 8번: 이름+비밀번호 로그인 | 동명이인 충돌 가능 | 전화번호를 로그인 ID로 사용 |
| 8번: 인증질문(간사/반장/출판연도) | 관리 주체 불명확 | 기수 단위로 admin이 등록 |
| 4번: sLLM 채점 | 처음부터 AI 연동 시 개발난이도·비용 증가 | 1차 키워드/유사도 매칭 → 추후 AI 고도화 |
| 12번: 레퍼런스 한 줄 텍스트 | 13·14번 범위 필터링과 충돌 | 강의명/회차/위치 3개 필드로 분리 |
| 7번+10번: 문제 단위·프로젝트 단위 공유 동시 존재 | 우선순위 미정 | 문제 설정이 프로젝트 설정보다 우선하는 규칙 확정 |

---

## 9. 개발 로드맵 (GitHub + Supabase, 초보자 기준 — 개요)

> 실제 진행 시 이 순서대로 **한 단계씩** 같이 진행합니다. 지금은 "전체 그림"만 확인하세요.

1. **Supabase 프로젝트 생성** → 3장의 테이블들을 SQL로 생성 (직접 타이핑 없이 SQL문을 그대로
   복사/붙여넣기 하는 방식으로 안내 예정)
2. **인증 방식 설계**: Supabase 기본 인증은 이메일 기반이라, 전화번호+비밀번호 방식은
   `users` 테이블에 비밀번호 해시를 직접 저장하는 커스텀 로그인으로 구현 (단계별 안내)
3. **GitHub 저장소 생성** 및 프론트엔드 프로젝트 뼈대 세팅 (React 기반, 아래 9-1 방향에 맞춰 구성)
4. **기능 개발 순서**: 로그인/등록 → 문제 CRUD(등록/조회/수정/삭제) → CSV 업로드 →
   공유 설정 → 풀이 화면 → 채점 로직 → 결과 피드백 화면
5. **배포**: GitHub 연동 호스팅(예: Vercel)으로 실제 URL 생성

### 9-1. 프론트엔드 기술/디자인 방향 ✅확정

- **프레임워크**: **React** 기반으로 개발. 문제 카드, 반복되는 입력 폼, 로그인 화면 등을
  컴포넌트 단위로 재사용하기 좋아 초보자가 유지보수하기에도 유리함.
- **스타일링**: Tailwind CSS 등 유틸리티 기반 스타일링 활용 (직접 CSS 파일을 관리하지 않아도
  일관된 디자인을 빠르게 적용 가능).
- **디자인 방향성**: "템플릿 느낌"이 아닌, 이 사이트만의 톤을 갖도록 함. 흔히 나오는 AI 생성
  디자인 패턴(크림+세리프+테라코타 배경 / 다크+비비드 악센트 / 신문형 레이아웃)을 기본값으로
  따르지 않고, **"말씀·문제를 카드로 넘기며 학습한다"는 경험 자체**를 살리는 시그니처 요소
  (예: 카드 전환 애니메이션, 학습 진행률 표시 등) 하나를 중심으로 절제된 디자인을 적용.
- **접근성/반응형 기본기**: 모바일에서도 카드 학습이 가능하도록 반응형 레이아웃을 기본값으로,
  키보드 포커스 표시 등 기본적인 사용성도 함께 챙김.
- **실제 화면 설계·색상/폰트 확정은 개발 착수 단계에서 별도 진행**: 지금은 "React + 세련되고
  유연한 커스텀 디자인"이라는 방향만 정책으로 확정하고, 구체적인 컬러/타이포는 9장 로드맵의
  "프론트엔드 뼈대 세팅" 단계에서 함께 정합니다.

### 9-2. Claude Code / Codex 로 후속 진행 시 지침 ✅추가

> 이 문서(PLAN.md)를 로컬 프로젝트 폴더에 넣고, Claude Code나 Codex에게 "이 문서 기준으로
> 진행해줘"라고 지시하면 아래 절차를 그대로 따라가게 하면 됩니다.

**사전 준비 (사용자가 먼저 해둘 것 — 에이전트가 대신할 수 없는 부분)**
1. GitHub 계정 및 새 저장소 생성 (예: `seminary-quiz-bank`) → 저장소 URL 확보
2. Supabase 계정 및 새 프로젝트 생성 → Project URL, anon/public key, service_role key 확보
   (service_role key는 절대 GitHub에 올리지 않을 것)
3. 로컬 PC에 Node.js, git 설치 여부 확인 (설치 안 됐다면 에이전트에게 설치 여부 점검부터 요청)

**로컬 → GitHub 연동 절차 (에이전트에게 위임)**
1. 프로젝트 폴더에서 `git init`
2. `.gitignore`에 `.env`, `node_modules` 등 반드시 포함 (Supabase 키 노출 방지)
3. 이 기획서를 `PLAN.md`로 프로젝트 루트에 포함 → 에이전트가 항상 참조하도록 지시
4. React 프로젝트 스캐폴딩(Vite 등) 후 초기 커밋 (`git add . && git commit -m "chore: init project"`)
5. `git remote add origin <저장소 URL>` → `git push -u origin main`
6. 이후 기능 단위 커밋 권장 (예: `feat: 로그인 기능 구현`, `fix: 채점 로직 수정`)

**Supabase 구축 절차 (에이전트에게 위임)**
1. `supabase login` → `supabase link --project-ref <project-ref>` 로 로컬-프로젝트 연결
2. `supabase/migrations` 폴더에 3장 데이터 모델 기준 SQL 마이그레이션 파일 작성
3. `supabase db push` (또는 대시보드 SQL 에디터 직접 실행)로 테이블 반영
4. `.env`에 Supabase URL/anon key 저장 → 프론트엔드에서 클라이언트 초기화
5. RLS(Row Level Security) 정책을 6장 공유 정책 기준으로 작성 (기본 비공개, 공유 시 예외 허용)

**에이전트 지시 예시 문구**
> "이 PLAN.md 기준으로 프로젝트를 진행해줘. 9장 로드맵 순서대로 진행하고, 각 단계 완료 시마다
> git commit & push까지 해줘. Supabase는 CLI로 연결하고 migrations 폴더에 SQL을 작성해서 반영해줘."

**주의사항**
- ⚠️ **10장(정보보안 지침)의 비밀키 보관 경고를 반드시 다시 확인할 것** — 전화번호 해시/암호화
  키는 `.env`/git에 커밋 금지, Supabase Vault 또는 서버 전용 환경변수에만 저장
- service_role key, DB 비밀번호 등은 절대 커밋 금지 (`.env` + `.gitignore` 필수)
- 로그인 방식(전화번호+비밀번호 커스텀 인증, 2장)은 Supabase 기본 이메일 Auth와 다르므로,
  에이전트가 임의로 이메일 기반 Auth로 바꾸지 않도록 2장을 반드시 함께 참조시킬 것

---

## 10. 정보보안 지침 (이름/전화번호 보호) ✅추가

이름/전화번호는 신학원 학생들의 개인정보이므로, 일반적인 게시판 수준보다 **한 단계 높은
보안**을 기본값으로 적용합니다. 핵심 원칙은 "① 평문 저장 최소화, ② 접근 권한 최소화,
③ 열람 이력 기록" 세 가지입니다.

### 10-1. 전화번호 저장 방식

> ⚠️ **반드시 기억할 것 (에이전트에게 매번 확인시킬 것)**
> `phone_hash`/`phone_encrypted`에 사용하는 비밀키는 **절대 `.env`(프론트엔드에 번들되는
> 영역)나 GitHub 저장소에 커밋하지 말 것**. 반드시 **Supabase Vault** 또는 **서버 전용
> 환경변수(Edge Function 설정)**에만 저장해야 합니다. 이 한 줄을 놓치면 이중 저장 구조
> 자체가 무의미해집니다. Claude Code/Codex에게 이 작업을 시킬 때 아래 문구를 그대로
> 붙여넣어 지시하세요:
>
> > "전화번호 해시/암호화에 쓰는 비밀키는 절대 프론트엔드 `.env`나 git에 커밋하지 말고,
> > Supabase Vault 또는 서버 전용 환경변수에만 저장해줘. 이 키가 어디에 저장됐는지 마지막에
> > 다시 한 번 확인해서 알려줘."

전화번호를 그대로(평문) 저장하지 않고 **두 개의 컬럼으로 분리**합니다.

- `phone_hash`: 로그인 조회 전용. 서버 비밀키로 HMAC-SHA256 해시 처리한 값 (동일 입력이면
  항상 동일 해시가 나오므로 로그인 시 "일치 여부"만 확인 가능, 원본 복원 불가)
- `phone_encrypted`: pgcrypto로 암호화된 실제 전화번호. admin이 학생 문의 대응 등으로
  실제 번호 확인이 필요할 때만 서버 로직(Edge Function)에서 복호화

> **로그인 흐름**: 사용자가 전화번호 입력 → 서버에서 동일한 비밀키로 해시 → `phone_hash`와
> 비교 → 일치하면 인증 진행. 전화번호 원문은 프론트엔드나 DB 조회 결과 어디에도 평문으로
> 노출되지 않습니다.
>
> **비밀키 보관**: 해시/암호화에 쓰는 비밀키는 `.env`(프론트엔드에 번들될 수 있는 영역)가
> 아니라 **Supabase Vault** 또는 서버 전용 환경변수(Edge Function 설정)에만 저장하고,
> anon key가 쓰이는 프론트엔드 코드에서는 절대 접근할 수 없게 합니다.

### 10-2. 이름 노출 최소화
- 실명(`name`)은 본인과 admin만 조회 가능하도록 제한
- 다른 학생에게 공유되는 화면(공유된 문제 목록 등)에는 실명 대신 `display_name`(닉네임 또는
  이니셜)만 노출

### 10-3. RLS(Row Level Security) 기본 원칙
- 개인정보가 포함된 모든 테이블은 RLS를 활성화
- 기본 정책: "본인 행만 조회/수정 가능" + "admin 역할만 전체 조회 가능"
- **anon key**(프론트엔드에서 사용)는 RLS 정책을 반드시 통과해야만 데이터에 접근 가능
- **service_role key**(RLS를 우회하는 전체 권한 키)는 서버(Edge Function)에서만 사용하고
  프론트엔드에는 절대 노출하지 않음

### 10-4. 계정 보호
- 비밀번호는 애플리케이션 레벨에서 bcrypt/argon2로 해시 후 저장 (평문·역가역 암호화 저장 금지)
- 로그인 5회 연속 실패 시 일정 시간 계정 잠금 (`failed_attempts`, `locked_until`)
- admin이 학생 개인정보(전화번호 복호화 등)를 열람하면 `access_audit_log`에 자동 기록

### 10-5. 예시 SQL 구조

```sql
-- 암호화 확장 활성화 (Supabase Postgres 기본 제공)
create extension if not exists pgcrypto;

create table cohorts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  staff_name text not null,      -- 간사 이름
  leader_name text not null,     -- 반장 이름
  kjv_year text not null
);

create table users (
  id uuid primary key default gen_random_uuid(),
  phone_hash text unique not null,     -- HMAC-SHA256 해시, 로그인 조회용
  phone_encrypted bytea not null,      -- pgp_sym_encrypt로 암호화된 실제 번호 (admin 열람용)
  name text not null,                  -- 실명 (본인/admin만 조회)
  display_name text,                   -- 다른 학생에게 보일 표시용 이름/이니셜
  cohort_id uuid references cohorts(id),
  password_hash text not null,         -- 앱 레벨 bcrypt/argon2 해시
  failed_attempts int default 0,
  locked_until timestamptz,
  status text default 'pending',       -- pending / active
  created_at timestamptz default now()
);

create table admins (
  id uuid primary key default gen_random_uuid(),
  login_id text unique not null,
  password_hash text not null
);

create table access_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,           -- 열람/수정을 수행한 admin 등
  target_user_id uuid,     -- 대상 학생
  action text,             -- 'view_phone' / 'reset_password' 등
  created_at timestamptz default now()
);

alter table users enable row level security;
alter table access_audit_log enable row level security;

-- 본인 행만 조회 가능, admin은 전체 조회 가능
create policy "users_select_own_or_admin" on users
  for select using (
    auth.uid()::text = id::text
    or exists (select 1 from admins where admins.id = auth.uid())
  );

-- 본인만 자기 행 수정 가능 (비밀번호 변경 등)
create policy "users_update_own" on users
  for update using (auth.uid()::text = id::text);

-- 감사로그는 admin만 조회 가능, 삽입은 서버(Edge Function)만 수행
create policy "audit_log_admin_only" on access_audit_log
  for select using (exists (select 1 from admins where admins.id = auth.uid()));
```

> 위 SQL은 9-2장의 마이그레이션 절차(`supabase/migrations`)에 그대로 반영해서 진행하면 됩니다.
> RLS 정책은 6장(공유 정책)의 `problems`/`projects` 테이블에도 동일한 원칙(본인 또는 공유
> 대상만 조회 가능)으로 확장 적용해야 합니다.

---

## 11. 용어집

- **project(프로젝트)**: 문제 최대 100개를 담는 묶음 단위
- **share_scope**: 공개 범위 설정값 (private / all / selected / inherit)
- **레퍼런스**: 문제의 출처 정보 (강의명/회차/위치)
- **기수(cohort)**: 신학원 입학 기수 단위 그룹

---

## 12. 확정된 정책 요약 (한눈에 보기)

- 로그인 ID: **전화번호**
- 서술형/성경문제 채점: **1차 키워드/유사도 매칭, 추후 AI 고도화**
- 인증질문 정답 관리: **기수 단위로 admin이 등록**
- 레퍼런스: **강의명/회차/위치 3개 필드로 구조화**
- 공유 우선순위: **문제별 설정 > 프로젝트 설정**
- 프론트엔드: **React + Tailwind 기반, 절제된 시그니처 요소 중심의 커스텀 디자인** (템플릿 느낌 지양)
- 개인정보 보안: **전화번호는 해시(조회용)+암호화(원본) 이중 저장, 실명은 본인/admin만 조회, RLS 전면 적용, 계정 잠금·감사로그 운영**

---

## 13. 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-07-20 | 최초 기획서 작성 및 3가지 핵심 정책 확정 |
| 2026-07-20 | 프론트엔드 기술 스택(React+Tailwind)·디자인 방향 정책(9-1) 추가 |
| 2026-07-20 | Claude Code/Codex 실행 지침(9-2: 로컬 작업, GitHub 커밋&푸시, Supabase 구축 절차) 추가 |
| 2026-07-20 | 정보보안 지침(10장: 전화번호 해시+암호화 이중저장, RLS, 계정잠금, 감사로그) 및 관련 SQL 구조 추가 |
| 2026-07-20 | 비밀키 보관 경고(⚠️)를 10-1, 9-2 두 곳에 강조 표시로 추가 |
