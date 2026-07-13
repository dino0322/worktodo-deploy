# Work To Do

팀원이 각자 다른 계정으로 로그인하고, 개인 업무와 팀 업무를 함께 관리하는 웹 앱입니다.

## 배포 주소

GitHub Pages 배포 주소:

```text
https://dino0322.github.io/worktodo-deploy/
```

이 저장소는 `docs/` 폴더를 GitHub Pages 소스로 사용합니다.

GitHub에서 한 번만 아래 설정을 확인하세요.

1. Repository `Settings`
2. `Pages`
3. `Build and deployment`
4. `Source`를 `Deploy from a branch`로 선택
5. Branch를 `main`, folder를 `/docs`로 선택
6. `Save`

## 포함된 기능

- 이메일/비밀번호 로그인 및 회원가입
- Supabase Auth + Postgres 연결
- Supabase 키가 없을 때 동작하는 데모 모드
- 내 업무, 팀 업무, 상태별 보드
- 업무 생성, 상태 변경, 댓글
- 관리자/매니저용 대시보드
- 팀 공지 작성 및 조회
- 질문 등록 및 매니저 답변
- 공개/비공개 메시지와 매니저 답장
- GitHub Pages 배포용 `docs/` 산출물

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
4. 앱에서 첫 전체 관리자 계정을 회원가입합니다.
5. `db/bootstrap_super_admin.sql`의 이메일을 첫 계정 이메일로 바꾸고 SQL Editor에서 실행합니다.
6. `SUPABASE_URL`, `SUPABASE_ANON_KEY` 값을 넣어 `node scripts/build.mjs`를 실행합니다.
7. 생성된 `dist/` 내용을 `docs/`에 복사한 뒤 push합니다.

```text
SUPABASE_URL
SUPABASE_ANON_KEY
```

값이 없으면 GitHub Pages에서도 데모 모드로 배포됩니다.

## 보안 메모

- `SUPABASE_ANON_KEY`는 브라우저에 노출 가능한 공개 키입니다.
- Supabase service role key는 절대 프론트엔드나 Git 저장소에 넣지 마세요.
- 실제 접근 제어는 `db/schema.sql`의 Row Level Security 정책이 담당합니다.

## 참고

GitHub Pages의 project site는 repo 이름이 경로에 붙습니다. 그래서 현재 repo의 기본 주소는 `https://dino0322.github.io/worktodo-deploy/`입니다. `https://dino0322.github.io/` 루트 주소를 쓰려면 GitHub repo 이름을 `dino0322.github.io`로 만들어야 합니다.
