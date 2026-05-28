# public/ 영상 — Git · LFS · Vercel 배포 규칙

## 1) .gitignore 확인 결과 (2026-05)

| 경로 | Git 추적 | 이유 |
|------|----------|------|
| `public/video/*.mp4` | **가능** (무시 안 함) | `.gitignore`에 `public/` 규칙 없음 |
| `public/assets/videos/**/*.mp4` | **가능** | 동일 |
| `frontend/video/**` | **불가** | `.gitignore` 21행 `frontend/video/**` |
| 저장소 루트 `/video/` | **불가** | `.gitignore` 24행 `/video/` (루트 전용, `public/video`와 무관) |
| `frontend/imboxer/assets/videos/*.mp4` | **이미 추적 중** | 소용량(~수 MB) 파일만 Git에 있음 |

**push 해도 GitHub에 영상이 없는 이유:**  
`public/`에는 `.gitkeep`만 있고 **mp4를 아직 넣지 않았거나**, 영상이 **`frontend/video/`(gitignore)** 에만 있기 때문입니다. 용량 문제가 아니라 **추적 대상 폴더에 파일이 없는 상태**입니다.

## 2) 용량 한도 (Git LFS가 필요한 경우)

로컬 `frontend/video/` 기준 일부 파일:

- 약 **2.7GB**, **800MB**, **750MB** 등 → GitHub 일반 push **파일당 100MB 제한** 초과
- 이런 파일을 `public/video/`에 넣어 올리려면 **Git LFS 필수**

`frontend/imboxer/assets/videos/` (약 30개, 합계 ~90MB)는 이미 Git에 있어 `/assets/videos/...` URL은 Vercel에서 동작할 수 있습니다.  
**`/video/스파링초보.mp4` 등**은 `public/video/` + LFS(또는 외부 CDN)가 필요합니다.

## 3) Git LFS 설정 (Windows PowerShell)

### 3-1. 설치

1. https://git-lfs.com 에서 Git LFS 설치
2. 프로젝트 루트에서 한 번만:

```powershell
git lfs install
```

### 3-2. LFS 추적 패턴 (이 저장소 `.gitattributes`)

```
public/video/** filter=lfs diff=lfs merge=lfs -text
public/assets/videos/** filter=lfs diff=lfs merge=lfs -text
```

`git lfs track` 은 위 패턴과 동일하게 등록됩니다:

```powershell
git lfs install
git add .gitattributes
git lfs track "public/video/**"
git lfs track "public/assets/videos/**"
```

### 3-2b. push 전 LFS 검증 명령어

```powershell
# 1) LFS 대상으로 잡히는지 (filter: lfs 가 나와야 함)
git check-attr filter -- public/video/스파링초보.mp4
git check-attr filter -- public/assets/videos/training/tutorial-jab.mp4

# 2) 스테이징 후 LFS에 올라갈 파일 목록
git add public/video/ public/assets/videos/ .gitattributes
git lfs ls-files

# 3) 일반 Git blob이 아닌지 (LFS 포인터면 앞부분이 version https://git-lfs.github.com/spec/v1)
git lfs status

# 4) 빌드 복사 검증 (public → frontend)
npm run build
# public에 mp4가 있으면 "복사 무결성: ... 전부 OK" / 누락 시 FATAL 로 빌드 실패
```

### 3-3. 영상을 public으로 옮긴 뒤 커밋

```powershell
# 예: 스파링 4종만 먼저 (frontend/video → public/video)
Copy-Item -Path "frontend\video\스파링초보.mp4" -Destination "public\video\" -Force
# (나머지 파일도 동일)

git add public/video/
git status   # LFS로 잡히는지 확인 (git lfs ls-files)
git commit -m "Add sparring videos under public/video via LFS"
git -c http.sslBackend=schannel push project-boxer woosunshin-frontend-v2
```

`git lfs ls-files`에 `public/video/...`가 보이면 LFS 적용된 것입니다.

### 3-4. GitHub LFS 할당량

- 무료: 저장·대역폭 한도 있음 (초과 시 유료 또는 외부 호스팅 검토)
- 팀 저장소: Organization LFS 플랜 확인

## 4) 파일 관리 규칙 (배포 서버에 확실히 넣기)

### 원칙

1. **Vercel에 올릴 스파링·다이어트 영상 (`/video/...`)**  
   → 반드시 **`public/video/`** 에만 둔다.  
   → `frontend/video/`는 `.gitignore`라 **push 되지 않음**.

2. **훈련·튜토리얼 UI 영상 (`/assets/videos/...`)**  
   - **방법 A:** `public/assets/videos/`에 넣고 빌드 시 `frontend/imboxer/assets/videos/`로 복사 (권장·일관성)  
   - **방법 B:** 이미 Git에 있는 `frontend/imboxer/assets/videos/`만 사용 (소용량, 현재 상태)

3. **로컬 전용 대용량**은 `frontend/video/`에 두지 말고, 처음부터 **`public/video/`** + LFS.

4. **push 전 체크**

```powershell
npm run build
# 로그에 public/ 영상 인벤토리, [복사] public\... → frontend\... 확인
git status
git lfs ls-files
```

5. **Vercel 빌드**  
   `npm run build` → `public/*` → `frontend/*` 복사 → `outputDirectory: frontend`로 배포.

### 폴더 대응표

| 넣을 위치 (Git) | 빌드 후 (Vercel) | 브라우저 URL |
|----------------|------------------|--------------|
| `public/video/스파링초보.mp4` | `frontend/video/스파링초보.mp4` | `/video/스파링초보.mp4` |
| `public/assets/videos/training/tutorial-jab.mp4` | `frontend/imboxer/assets/videos/training/...` | `/assets/videos/training/tutorial-jab.mp4` |

### 하지 말 것

- `frontend/video/`에만 두고 push 기대하기 (무시됨)
- 100MB 넘는 mp4를 LFS 없이 일반 Git에 추가하기 (push 거절)
- `public/` 비운 채 Vercel만 재배포하기 (404 유지)

## 5) LFS 대안 (용량·한도 부담 시)

- Cloudflare R2 / Backblaze B2 등에 mp4 업로드 후 `boxer-video-local.js` URL을 HTTPS CDN으로 변경
- Git에는 placeholder만 두고 배포는 외부 스토리지

---

요약: **`public/`은 gitignore 대상이 아님.** 영상을 **`public/video/`·`public/assets/videos/`로 옮긴 뒤**, 100MB 초과분은 **Git LFS**로 push하세요.
