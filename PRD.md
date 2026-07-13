# 팀 공유 Work To Do PRD

## 1. 제품 개요

팀원이 각자 다른 ID/PW로 로그인하고, 본인에게 배정된 업무와 팀 공용 업무를 함께 관리할 수 있는 웹 기반 To-do/업무 관리 앱을 만든다. 제공된 `toeic_static_site-2`는 정적 데모이지만, 로그인, 역할별 권한, 개인 페이지, 관리자 대시보드, 공지, 질문/메시지 흐름을 담고 있으므로 이를 업무 관리 제품의 정보 구조와 권한 모델로 재해석한다.

이 제품은 실제 팀 운영에 쓰일 수 있어야 하므로 `localStorage`가 아니라 데이터베이스와 인증을 사용한다. Netlify 배포를 1순위로 보고, GitHub Pages는 정적 프론트 배포 옵션으로만 고려한다. GitHub Pages는 HTML/CSS/JS 정적 파일 호스팅 서비스이므로 서버 API가 필요한 경우 Supabase 같은 외부 DB/Auth가 필요하다. Netlify는 Functions를 통해 서버 측 API를 함께 배포할 수 있어 MVP에 더 적합하다.

## 2. 목표

- 사용자별 계정, 비밀번호, 세션을 제공한다.
- 사용자는 본인에게 배정된 업무만 빠르게 확인하고 처리할 수 있다.
- 팀장은 팀 전체 업무 현황, 미완료 업무, 지연 업무, 담당자별 부하를 확인할 수 있다.
- 업무에는 담당자, 상태, 마감일, 우선순위, 설명, 댓글, 첨부 또는 링크를 둘 수 있다.
- 공지/메시지/질문처럼 팀 커뮤니케이션에 필요한 최소한의 협업 기능을 포함한다.
- Netlify 또는 GitHub 기반 배포 파이프라인으로 팀원이 URL만 접속해서 사용할 수 있게 한다.

## 3. 비목표

- Jira/Asana 수준의 복잡한 프로젝트 관리 기능은 MVP 범위에서 제외한다.
- 실시간 동시 편집, 간트차트, 복잡한 자동화 룰, 외부 캘린더 연동은 후순위로 둔다.
- 사내 SSO, 조직도 연동, 세부 감사 로그 다운로드는 초기 버전 필수 사항이 아니다.

## 4. 사용자 유형과 권한

### 4.1 일반 팀원

- 본인 계정으로 로그인한다.
- 본인에게 배정된 업무를 조회, 상태 변경, 댓글 작성할 수 있다.
- 본인이 생성한 개인 업무를 만들고 수정/삭제할 수 있다.
- 팀 공용 업무는 권한이 있는 범위에서 조회하고 댓글을 남길 수 있다.
- 다른 사람의 개인 업무는 볼 수 없다.

### 4.2 팀 리더/관리자

- 팀원 계정을 초대하거나 비활성화할 수 있다.
- 모든 팀 업무를 생성, 수정, 삭제할 수 있다.
- 업무 담당자, 마감일, 우선순위, 상태를 변경할 수 있다.
- 팀원별 업무 현황을 대시보드에서 확인한다.
- 공지 작성과 팀 설정 변경 권한을 가진다.

### 4.3 게스트 또는 읽기 전용 사용자

- 초대받은 특정 프로젝트나 업무만 조회할 수 있다.
- 댓글 작성 여부는 초대 설정에 따른다.
- 계정 관리, 팀 설정, 전체 대시보드 접근은 불가하다.

## 5. 핵심 사용자 시나리오

1. 팀원이 이메일/비밀번호로 로그인한다.
2. 홈 화면에서 오늘 할 일, 지연 업무, 이번 주 마감 업무를 본다.
3. 업무 카드에서 상태를 `할 일`, `진행 중`, `검토`, `완료` 중 하나로 바꾼다.
4. 업무 상세에서 댓글을 남기거나 관련 링크를 추가한다.
5. 팀 리더는 대시보드에서 담당자별 미완료 수와 지연 업무를 확인한다.
6. 팀 리더가 새 업무를 만들고 담당자를 지정하면 해당 팀원의 내 업무 목록에 나타난다.
7. 관리자는 공지를 작성해 팀 홈 상단에 노출한다.

## 6. 기능 요구사항

### 6.1 인증 및 계정

- 이메일/비밀번호 기반 회원가입 및 로그인.
- 비밀번호는 직접 저장하지 않고 인증 서비스 또는 안전한 해시를 사용한다.
- 로그인 세션 유지, 로그아웃, 비밀번호 재설정 기능.
- 사용자 프로필: 이름, 이메일, 역할, 소속 팀, 상태, 연락처 선택 입력.
- 관리자 초대 방식: 이메일 초대 링크 또는 임시 계정 생성.

### 6.2 워크스페이스/팀

- 하나의 앱 안에 여러 팀 또는 워크스페이스를 둘 수 있게 설계한다.
- 사용자는 하나 이상의 팀에 속할 수 있다.
- 팀 단위로 업무, 공지, 멤버, 역할을 분리한다.
- 팀 설정: 팀명, 멤버 목록, 역할 변경, 멤버 비활성화.

### 6.3 업무 관리

- 업무 생성 필드:
  - 제목
  - 설명
  - 담당자
  - 상태
  - 우선순위
  - 마감일
  - 프로젝트/카테고리
  - 공개 범위: 개인, 팀, 특정 담당자
  - 링크 또는 첨부 메타데이터
- 업무 목록 화면:
  - 내 업무
  - 팀 업무
  - 지연 업무
  - 완료 업무
  - 검색 및 필터: 담당자, 상태, 우선순위, 마감일, 프로젝트
- 업무 상세 화면:
  - 상태 변경
  - 담당자 변경
  - 설명 수정
  - 댓글 작성
  - 변경 이력 일부 표시
- 업무 상태:
  - `todo`
  - `in_progress`
  - `review`
  - `done`
  - `archived`

### 6.4 개인 업무

- 각 사용자는 본인만 볼 수 있는 개인 To-do를 만들 수 있다.
- 개인 업무는 관리자도 기본적으로 볼 수 없도록 한다.
- 개인 업무를 팀 업무로 전환할 수 있다. 전환 시 공개 범위와 담당자를 지정한다.

### 6.5 팀 대시보드

- 팀 리더/관리자 전용 화면.
- 주요 카드:
  - 전체 미완료 업무 수
  - 오늘 마감 업무 수
  - 지연 업무 수
  - 검토 대기 업무 수
  - 담당자별 업무 수
- 테이블:
  - 최근 생성 업무
  - 최근 댓글
  - 지연 업무 목록
- 담당자 클릭 시 해당 사용자의 업무 현황 모달 표시.

### 6.6 공지

- 관리자가 팀 공지를 작성한다.
- 공지는 홈 화면 상단과 공지 목록에서 확인 가능하다.
- 검색, 고정 공지, 중요 표시를 지원한다.
- 일반 팀원은 공지를 읽을 수 있고, 댓글 허용 여부는 관리자 설정에 따른다.

### 6.7 메시지/질문

- 팀원이 관리자에게 비공개 메시지를 보낼 수 있다.
- 팀 내 공개 질문 게시판을 둘 수 있다.
- 질문에는 답변 상태를 둔다.
  - 답변 대기
  - 답변 완료
- 공개 질문은 팀원이 모두 볼 수 있고, 비공개 메시지는 작성자와 관리자만 볼 수 있다.

### 6.8 알림

- MVP에서는 인앱 알림 중심으로 구현한다.
- 알림 발생 조건:
  - 내게 업무가 배정됨
  - 내 업무의 마감일이 임박함
  - 내 업무에 댓글이 달림
  - 공지가 등록됨
- 이메일 알림은 후순위로 둘 수 있다.

## 7. 화면 구성

### 7.1 로그인

- 이메일
- 비밀번호
- 로그인 버튼
- 비밀번호 재설정 링크
- 초대받은 사용자용 가입 플로우

### 7.2 홈 / 내 업무

- 상단 요약: 오늘 할 일, 지연, 이번 주 마감, 완료율
- 내 업무 리스트
- 빠른 업무 추가
- 상태별 탭 또는 칸반 뷰

### 7.3 팀 업무

- 팀 전체 업무 목록
- 필터/검색
- 담당자별 그룹 보기
- 프로젝트별 보기

### 7.4 업무 상세

- 제목, 설명, 담당자, 상태, 마감일, 우선순위
- 댓글
- 관련 링크
- 변경 이력
- 삭제/보관 버튼은 권한자에게만 노출

### 7.5 대시보드

- 관리자/팀 리더만 접근
- 업무 통계 카드
- 팀원별 업무 현황
- 지연 업무와 검토 대기 업무 테이블

### 7.6 팀원 관리

- 팀원 목록
- 역할 변경
- 초대
- 비활성화
- 사용자별 업무 보기

### 7.7 공지/질문/메시지

- 공지 목록 및 상세
- 질문 목록 및 답변
- 비공개 메시지 작성/답변

## 8. 데이터 모델 초안

### users

- id
- email
- password_hash 또는 auth_provider_user_id
- name
- created_at
- updated_at

### workspaces

- id
- name
- owner_id
- created_at
- updated_at

### workspace_members

- id
- workspace_id
- user_id
- role: `member`, `manager`, `admin`, `guest`
- status: `active`, `invited`, `disabled`
- created_at

### tasks

- id
- workspace_id
- title
- description
- status
- priority: `low`, `normal`, `high`, `urgent`
- visibility: `private`, `team`, `assignees`
- creator_id
- assignee_id
- due_date
- project_id
- archived_at
- created_at
- updated_at

### task_comments

- id
- task_id
- author_id
- body
- visibility: `team`, `private_to_admin`
- created_at
- updated_at

### projects

- id
- workspace_id
- name
- color
- created_at
- updated_at

### notices

- id
- workspace_id
- author_id
- title
- body
- pinned
- importance: `normal`, `important`
- created_at
- updated_at

### messages

- id
- workspace_id
- sender_id
- recipient_id
- body
- is_private
- status: `open`, `answered`, `closed`
- created_at
- updated_at

### notifications

- id
- user_id
- workspace_id
- type
- payload_json
- read_at
- created_at

## 9. 권한 규칙

- 사용자는 본인이 속한 워크스페이스 데이터만 접근할 수 있다.
- 개인 업무는 `creator_id = 현재 사용자`인 경우에만 조회 가능하다.
- 팀 업무는 같은 워크스페이스 멤버가 조회 가능하다.
- 업무 수정은 관리자, 매니저, 생성자, 담당자에게 허용한다. 단, 삭제는 관리자/매니저 또는 생성자만 허용한다.
- 비공개 메시지는 작성자와 관리자/매니저만 조회 가능하다.
- 공지 작성/수정/삭제는 관리자/매니저만 가능하다.
- DB에서 Row Level Security 또는 서버 API 권한 검사를 반드시 적용한다.

## 10. 기술 방향

### 권장 MVP 스택

- Frontend: React 또는 Next.js
- Styling: Tailwind CSS 또는 기존 CSS 기반 커스텀 UI
- Auth/DB: Supabase Auth + Supabase Postgres
- Hosting: Netlify
- API: Supabase client 직접 호출 + 필요한 경우 Netlify Functions

### 배포 판단

- Netlify:
  - 정적 프론트와 서버리스 Functions를 함께 배포할 수 있어 MVP에 적합하다.
  - 환경변수, 배포 미리보기, 롤백을 활용한다.
- GitHub Pages:
  - 정적 HTML/CSS/JS 배포에는 적합하다.
  - 자체 서버 API나 DB를 제공하지 않으므로 Supabase 같은 외부 서비스를 연결해야 한다.

## 11. 보안 요구사항

- 비밀번호를 클라이언트나 DB에 평문 저장하지 않는다.
- 모든 DB 접근에는 사용자 인증 토큰을 사용한다.
- 공개 가능한 anon key와 숨겨야 하는 service role key를 구분한다.
- service role key는 절대 프론트엔드 번들에 포함하지 않는다.
- RLS 또는 서버 API에서 권한을 강제한다.
- 사용자 입력 HTML은 저장 전/렌더링 전 sanitization이 필요하다.
- 삭제는 soft delete 또는 archived 상태를 우선 사용한다.

## 12. MVP 범위

### Must Have

- 로그인/로그아웃
- 사용자별 내 업무
- 팀 업무 생성/수정/상태 변경
- 담당자 지정
- 마감일/우선순위
- 댓글
- 팀 대시보드
- 팀원 관리
- 공지
- DB 저장
- Netlify 배포

### Should Have

- 질문/비공개 메시지
- 검색/필터
- 인앱 알림
- 프로젝트/카테고리
- 업무 보관

### Could Have

- 이메일 알림
- 첨부 파일 업로드
- 캘린더 뷰
- 반복 업무
- 활동 로그 고도화

## 13. 성공 기준

- 사용자는 로그인 후 본인 업무만 정확히 볼 수 있다.
- 관리자는 팀 전체 업무와 담당자별 현황을 볼 수 있다.
- 같은 DB를 사용해 다른 기기/브라우저에서도 데이터가 유지된다.
- 비공개 데이터는 권한 없는 사용자에게 노출되지 않는다.
- Netlify 배포 URL에서 핵심 플로우가 정상 작동한다.

## 14. 참고한 레퍼런스의 반영 포인트

- `login.html`: 데모 등급 전환을 실제 사용자 인증과 역할 관리로 대체.
- `mypage.html`: 개인 프로필과 사용자별 업무 화면으로 확장.
- `dashboard.html`: 조교/선생님 대시보드를 팀 리더/관리자 대시보드로 재해석.
- `notices.html`: 수업/숙제 공지를 팀 공지/업무 공지로 재구성.
- `questions.html`: 질문 게시판을 팀 Q&A 또는 업무 문의 게시판으로 전환.
- `messages.html`: 학생/선생님 비공개 메시지 구조를 팀원/관리자 비공개 메시지로 전환.
- `assets/app.js`: localStorage 기반 데이터 저장은 실제 DB 저장과 권한 검사로 대체.

## 15. 공식 문서 참고

- GitHub Pages는 HTML/CSS/JS 파일을 저장소에서 받아 정적 사이트로 게시하는 서비스다: https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
- Netlify Functions는 서버를 직접 관리하지 않고 서버 측 코드를 배포해 웹 요청을 처리할 수 있다: https://docs.netlify.com/build/functions/overview/
- Supabase Auth는 이메일/비밀번호, OTP, 소셜 로그인 등 인증과 JWT 기반 권한 흐름을 제공한다: https://supabase.com/docs/guides/auth
- Supabase Row Level Security는 브라우저에서 DB에 접근할 때 행 단위 권한을 강제하는 데 적합하다: https://supabase.com/docs/guides/database/postgres/row-level-security
