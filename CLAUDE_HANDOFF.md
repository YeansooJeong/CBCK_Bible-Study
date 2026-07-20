# CBCK Bible Study 프로젝트 인수인계 문서

## 1. 프로젝트 위치

```text
D:\workspace\claude\CK
```

## 2. GitHub Repository

```text
https://github.com/YeansooJeong/CBCK_Bible-Study.git
```

원격 저장소:

```text
origin https://github.com/YeansooJeong/CBCK_Bible-Study.git
```

현재 브랜치:

```text
main
```

## 3. 사용자 결정사항

- 인증: 전화번호 자체 인증 + Supabase Edge Function
- 관리자: 최초 관리자 1명 수동 생성
- Supabase: 개발용 프로젝트 생성
- GitHub: 새 Repository 사용
- 프론트엔드: React + Vite + TypeScript
- 스타일링: Tailwind CSS 예정
- 배포: 우선 GitHub Pages 사용
- Vercel: 추후 필요 시 도입

## 4. 완료된 작업

1. 기존 폴더에 Git 초기화
2. GitHub 원격 Repository 연결
3. `.gitignore` 생성
4. React + Vite + TypeScript 프로젝트 생성
5. npm 의존성 설치
6. `npm run build` 성공 확인
7. 초기 프로젝트 커밋 및 push

초기 커밋:

```text
4f68ef8 chore: initialize React project
```

주요 파일:

```text
.gitignore
cbck_bank_plan.md
package.json
package-lock.json
src/
public/
vite.config.ts
tsconfig.json
eslint.config.js
```

## 5. 현재 상태

초기 React 프로젝트는 GitHub의 `main` 브랜치에 push되어 있습니다.

현재 화면은 Vite 기본 샘플 화면이며, 기획 문서에 따른 실제 기능은 아직 개발하지 않았습니다.

`cbck_bank_plan.md`는 프로젝트의 기준 기획 문서이므로 계속 유지해야 합니다.

## 6. 미완료 작업

### 6.1 Vite GitHub Pages 경로 설정

`vite.config.ts`의 `defineConfig`에 다음 설정을 추가해야 합니다.

```ts
export default defineConfig({
  base: "/CBCK_Bible-Study/",
  plugins: [react()],
})
```

### 6.2 GitHub Actions workflow 추가

다음 파일을 생성해야 합니다.

```text
.github/workflows/deploy-pages.yml
```

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - name: Install dependencies
        run: npm ci
      - name: Build
        run: npm run build
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy
        id: deployment
        uses: actions/deploy-pages@v4
```

### 6.3 GitHub Pages 설정

workflow를 push한 뒤 Repository에서 다음 설정을 확인해야 합니다.

```text
Settings → Pages → Build and deployment → Source → GitHub Actions
```

### 6.4 이후 작업

1. GitHub Pages 배포 확인
2. Tailwind CSS 설치 및 기본 디자인 구성
3. Supabase 개발 프로젝트 연결
4. 데이터베이스 migration 작성
5. RLS 정책 작성
6. 전화번호 기반 인증과 Edge Function 구현
7. 관리자 기능 구현
8. 프로젝트·문제 CRUD 구현
9. CSV 업로드 구현
10. 퀴즈 세션 및 자동채점 구현

## 7. 보안 주의사항

- GitHub Pages는 정적 프론트엔드만 호스팅합니다.
- 전화번호 원문, 비밀번호, HMAC 키, 암호화 키를 프론트엔드에 포함하면 안 됩니다.
- `service_role` 키는 Edge Function 등 서버 측에서만 사용합니다.
- 프론트엔드에는 공개 가능한 Supabase URL과 anon key만 사용합니다.
- 전화번호 인증 및 개인정보 처리는 Supabase Edge Function에서 수행합니다.

## 8. 직전 중단 사유

`vite.config.ts`와 GitHub Actions workflow를 추가하려 했으나 Windows 환경의 `apply_patch` 실행기가 다음 오류를 반복하여 설정 추가가 중단되었습니다.

```text
CreateProcessWithLogonW failed: 1385
```

따라서 다음 작업부터 이어서 진행하면 됩니다.

1. `vite.config.ts` 수정
2. GitHub Pages workflow 생성
3. `npm run build`
4. Git commit
5. `git push origin main`
6. GitHub Pages Source를 GitHub Actions로 설정
7. 배포 URL 확인

## 9. 다음 목표

GitHub Pages에서 React 기본 화면이 정상 표시되는 것을 확인한 후, `cbck_bank_plan.md`를 기준으로 Supabase 연결과 로그인 기능 개발을 시작합니다.

