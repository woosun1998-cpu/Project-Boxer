# Git 사용 가이드

이 문서는 Boxer 프로젝트를 여러 명이 함께 작업할 때, GitHub에 안전하게 저장하고 공유하는 방법을 정리한 안내서입니다.

## 1. Git이 하는 일

- Git은 파일 변경 이력을 저장하는 도구입니다.
- GitHub는 그 이력을 원격 저장소에 올려서 팀원들과 공유하는 공간입니다.
- 로컬 저장소는 내 컴퓨터의 프로젝트 폴더이고, 원격 저장소는 GitHub에 있는 저장소입니다.

## 2. 기본 작업 흐름

보통 아래 순서로 작업합니다.

1. 파일 수정
2. 변경 사항 확인
3. 필요한 파일만 선택해서 `stage`
4. `commit`으로 저장
5. `push`로 GitHub에 업로드

## 3. 자주 쓰는 명령어

### 현재 상태 확인

```powershell
git status
```

### 변경된 파일 목록 보기

```powershell
git diff
```

### 특정 파일만 추가하기

```powershell
git add frontend/sparring.html
git add md/TOMORROW_HANDOFF.md
```

### 변경된 파일 전체 추가하기

```powershell
git add -A
```

### 커밋 만들기

```powershell
git commit -m "Update sparring UI"
```

### GitHub로 올리기

```powershell
git push origin main
```

## 4. 변경 파일만 따로 저장하는 법

모든 파일을 한꺼번에 올리지 않고, 원하는 파일만 따로 저장할 수 있습니다.

예시:

```powershell
git add frontend/sparring.html
git commit -m "Refine sparring start screen"
git push origin main
```

이렇게 하면 `sparring.html`만 GitHub에 반영됩니다.

## 5. 여러 파일 중 일부만 선택하기

예를 들어 아래 파일이 바뀌었다고 가정합니다.

- `frontend/sparring.html`
- `frontend/admin.html`
- `md/TOMORROW_HANDOFF.md`

그중 `sparring.html`과 `TOMORROW_HANDOFF.md`만 저장하려면 이렇게 합니다.

```powershell
git add frontend/sparring.html
git add md/TOMORROW_HANDOFF.md
git commit -m "Save sparring and handoff updates"
git push origin main
```

## 6. 조원들과 공유하는 방법

팀 작업에서는 GitHub를 통해 서로의 변경을 공유합니다.

### 방법 1. 같은 브랜치에서 함께 작업

- 브랜치를 하나 정해서 모두가 같은 방향으로 수정합니다.
- 자주 `push`하고 `pull`해서 서로의 변경을 반영합니다.
- 가장 단순하지만 충돌이 생길 수 있습니다.

### 방법 2. 브랜치 나눠서 작업

- 각자 기능별 브랜치를 따로 만듭니다.
- 예시:
  - `main`: 최종 안정 버전
  - `feature/sparring-ui`: 스파링 화면 작업
  - `feature/admin-ui`: 관리자 화면 작업
- 작업이 끝나면 `pull request`로 합칩니다.

### 방법 3. 작업 전후로 동기화

작업 시작 전에:

```powershell
git pull origin main
```

작업 후에:

```powershell
git add -A
git commit -m "Your message"
git push origin main
```

이렇게 하면 충돌을 줄일 수 있습니다.

## 7. 팀 작업할 때 주의할 점

- 같은 파일을 동시에 수정하면 충돌이 생길 수 있습니다.
- 누가 어떤 파일을 맡는지 먼저 정하는 것이 좋습니다.
- 커밋 메시지는 짧고 명확하게 적습니다.
- 의미 없는 대량 수정은 피합니다.
- 브라우저에서 확인한 뒤 커밋하는 습관이 좋습니다.

## 8. 파일 관리 팁

- 화면 관련 파일은 `frontend/`에서 관리합니다.
- 백엔드 로직은 `backend/`에서 관리합니다.
- 문서나 작업 기록은 `md/`에 정리합니다.
- 이미지와 영상은 `frontend/assets/` 아래에 둡니다.

권장 예시:

- `frontend/sparring.html` - 스파링 화면
- `frontend/admin.html` - 관리자 화면
- `frontend/tutorial2.html` - 튜토리얼 2
- `backend/app/services/session_service.py` - 세션 저장
- `backend/app/models/session.py` - 세션 DB 모델
- `md/TOMORROW_HANDOFF.md` - 내일 작업용 요약

## 9. 내 작업만 따로 저장하는 습관

내가 수정한 파일만 저장하려면, 먼저 상태를 보고 필요한 것만 고릅니다.

```powershell
git status
```

예를 들어 아래처럼 선택합니다.

```powershell
git add frontend/sparring.html
git add md/TOMORROW_HANDOFF.md
git commit -m "Save today's sparring work"
git push origin main
```

이 방식이 가장 안전합니다.

## 10. 팀원에게 공유할 때 추천 순서

1. 작업한 파일을 설명한다.
2. 어떤 기능이 바뀌었는지 짧게 말한다.
3. 커밋 메시지를 함께 남긴다.
4. GitHub 링크를 공유한다.
5. 상대가 `git pull`로 받아가게 한다.

## 11. 자주 쓰는 한 줄 요약

- `git status`로 확인
- `git add`로 선택
- `git commit`으로 저장
- `git push`로 공유

## 12. Boxer 프로젝트에서 자주 사용하는 흐름

```powershell
cd "c:\Users\User\Desktop\PROJECT\2차 작업파일 (PROJECT)\운동앱\boxer"
git status
git add frontend/sparring.html
git add md/TOMORROW_HANDOFF.md
git commit -m "Update sparring UI and handoff notes"
git push origin main
```

## 13. 마지막 체크

커밋 전에 아래를 확인하면 좋습니다.

- 브라우저에서 화면이 깨지지 않는지
- 백엔드가 정상 동작하는지
- 테스트 파일이나 임시 파일이 함께 올라가지 않는지
- 커밋 메시지가 나중에 봐도 이해되는지

---

이 문서는 팀원이 Git을 처음 써도 따라할 수 있게 만드는 것을 목표로 합니다. 필요하면 다음 버전에서 "브랜치 만들기", "충돌 해결하기", "Pull Request 보내기"까지 이어서 정리할 수 있습니다.
