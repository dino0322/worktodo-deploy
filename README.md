# Work To Do

팀원이 각자 다른 계정으로 로그인하고, 개인 업무와 팀 업무를 함께 관리하는 웹 앱입니다.

## 포함된 기능

- 이메일/비밀번호 로그인 및 회원가입
- Supabase Auth + Postgres 연결
- Supabase 키가 없을 때 동작하는 데모 모드
- 내 업무, 팀 업무, 상태별 보드
- 업무 생성, 상태 변경, 댓글
- 관리자/매니저용 대시보드
- 팀 공지 작성 및 조회
- Netlify 배포 설정

## 로컬 미리보기

정적 파일만으로 데모 모드를 볼 수 있습니다.

```bash
python3 -m http.server 4173 -d public
```

브라우저에서 `http://127.0.0.1:4173`을 엽니다.

데모 계정:

```text
admin@worktodo.local / admin123
minji@worktodo.local / member123
hyun@worktodo.local / member123
```

## Supabase 연결

1. Supabase 프로젝트를 만듭니다.
2. Supabase SQL Editor에서 `db/schema.sql` 전체를 실행합니다.
3. Authentication > Providers에서 Email provider를 켭니다.
4. Netlify 환경변수에 아래 값을 추가합니다.

```text
SUPABASE_URL
SUPABASE_ANON_KEY
```

5. Netlify 빌드 설정은 `netlify.toml`을 사용합니다.

```text
Build command: node scripts/build.mjs
Publish directory: dist
```

## GitHub Pages 배포

GitHub Pages는 환경변수로 정적 파일을 빌드하는 흐름이 제한적입니다. GitHub Pages를 사용할 경우 GitHub Actions에서 `SUPABASE_URL`, `SUPABASE_ANON_KEY`를 주입해 `node scripts/build.mjs`를 실행한 뒤 `dist/`를 Pages에 배포하세요.

## 보안 메모

- `SUPABASE_ANON_KEY`는 브라우저에 노출 가능한 공개 키입니다.
- Supabase service role key는 절대 프론트엔드나 Git 저장소에 넣지 마세요.
- 실제 접근 제어는 `db/schema.sql`의 Row Level Security 정책이 담당합니다.
