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

## 참고

GitHub Pages의 project site는 repo 이름이 경로에 붙습니다. 그래서 현재 repo의 기본 주소는 `https://dino0322.github.io/worktodo-deploy/`입니다. `https://dino0322.github.io/` 루트 주소를 쓰려면 GitHub repo 이름을 `dino0322.github.io`로 만들어야 합니다.
