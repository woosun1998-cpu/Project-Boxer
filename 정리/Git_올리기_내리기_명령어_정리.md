# Git 올리기 / 내리기 명령어 정리

## 1) 파일 올리기 (브랜치에 push)

### A. 현재 브랜치 확인
```bash
cd C:\Users\EZ\Boxer
git branch --show-current
```

### B. 특정 파일 1개만 올리기
```bash
cd C:\Users\EZ\Boxer
git checkout boxer/donghyeon
git add "정리/GitHub_협업_브랜치_정리.md"
git commit -m "docs: 협업 브랜치 정리 문서 업데이트"
git push origin boxer/donghyeon
```

### C. 처음 push 하는 브랜치라면
```bash
cd C:\Users\EZ\Boxer
git checkout boxer/donghyeon
git push -u origin boxer/donghyeon
```

---

## 2) 올린 파일 내리기 (되돌리기)

### 방법 1. 파일만 삭제해서 다시 올리기 (권장)
히스토리는 남고, 최신 커밋에서 파일만 제거됩니다.

```bash
cd C:\Users\EZ\Boxer
git checkout boxer/donghyeon
git rm "정리/GitHub_협업_브랜치_정리.md"
git commit -m "docs: 잘못 올린 파일 제거"
git push origin boxer/donghyeon
```

---

### 방법 2. 커밋 자체를 되돌리기 (강한 방법)
원격 히스토리를 바꾸므로 협업 중이면 주의하세요.

```bash
cd C:\Users\EZ\Boxer
git checkout boxer/donghyeon
git log --oneline -n 5
git reset --hard 되돌릴커밋해시입력
git push --force-with-lease origin boxer/donghyeon
```

---

## 3) 자주 쓰는 확인 명령어

```bash
git status -sb
git branch
git branch -r
git log --oneline -n 10
```

---

## 4) 실수 방지 체크
- push 전 `git branch --show-current`로 브랜치 확인
- 파일 경로에 한글/공백 있으면 큰따옴표 사용
- 협업 브랜치에서 `reset --hard`/강제 push 전 팀원과 먼저 공유

---

## 5) Git에서 다운받는 방법 (clone / pull / 브랜치 받기)

### A. 처음 프로젝트를 내 PC로 받기 (clone)
```bash
cd C:\Users\EZ
git clone 저장소주소입력
cd Boxer
```

예시:
```bash
git clone https://github.com/soypark7777-creator/boxer.git
cd Boxer
git checkout boxer/donghyeon
```

### B. 이미 받은 프로젝트 최신 내용만 받기 (pull)
```bash
cd C:\Users\EZ\Boxer
git checkout boxer/donghyeon
git pull origin boxer/donghyeon
```

### C. 원격 브랜치를 처음 내 로컬로 받을 때
```bash
cd C:\Users\EZ\Boxer
git fetch origin
git checkout -b boxer/donghyeon origin/boxer/donghyeon
```

### D. 모든 원격 브랜치 목록 먼저 확인하기
```bash
cd C:\Users\EZ\Boxer
git fetch origin
git branch -r
```

### E. 충돌 위험 줄이는 안전 pull (추천)
```bash
cd C:\Users\EZ\Boxer
git checkout boxer/donghyeon
git pull --rebase origin boxer/donghyeon
```
