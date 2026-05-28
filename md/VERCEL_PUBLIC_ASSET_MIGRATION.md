# Vercel 정적 자산(public) 마이그레이션 가이드

## 1) 왜 404가 발생했나
- Vercel 배포에서는 정적 파일이 **public 루트**를 기준으로 서빙됩니다.
- 기존 코드에 상대경로(`./video/...`, `../video/...`, `./assets/videos/...`)가 섞여 있으면
  페이지 위치(예: `/imboxer/...`)에 따라 잘못된 URL로 계산되어 404가 납니다.

## 2) 권장 폴더 구조
- 아래처럼 영상/이미지를 `public/` 아래에 배치합니다.

```text
public/
  video/
    스파링초보.mp4
    스파링보통.mp4
    스파링어려움.mp4
    복싱프로.mp4
    ...
  assets/
    videos/
      training/
      tutorials/
      sparring/
      boarding/
    images/
      tutorials/
      result/
```

## 3) 경로 작성 규칙(중요)
- 상대경로 금지: `./video/...`, `../video/...`, `./assets/videos/...`
- 절대경로 사용: `/video/...`, `/assets/videos/...`, `/assets/images/...`

## 4) 코드 예시
- 변경 전:
```js
return "./video/" + encodeURIComponent(fileName);
```
- 변경 후:
```js
return "/video/" + encodeURIComponent(fileName);
```

- 변경 전:
```html
<source src="./assets/videos/tutorials/tutorial_guide.mp4" type="video/mp4">
```
- 변경 후:
```html
<source src="/assets/videos/tutorials/tutorial_guide.mp4" type="video/mp4">
```

## 5) Vercel 프로젝트 설정 (루트 `vercel.json` + `package.json`)

| 항목 | 값 |
|------|-----|
| Framework Preset | Other (또는 자동 감지 무시) |
| Build Command | `npm run build` (`vercel.json`에도 동일) |
| Output Directory | `frontend` |
| Install Command | (비워 두거나 `vercel.json` 기본값 사용) |

`npm run build` → `npm run prepare:static` → `scripts/vercel-prepare-static.cjs`

| public (Git에 올리는 원본) | 빌드 후 (Vercel이 서빙) | 브라우저 URL |
|---------------------------|-------------------------|--------------|
| `public/video/*.mp4` | `frontend/video/` | `/video/스파링초보.mp4` |
| `public/assets/videos/**` | `frontend/imboxer/assets/videos/**` | `/assets/videos/training/tutorial-jab.mp4` |
| `public/assets/images/**` | `frontend/imboxer/assets/images/**` | `/assets/images/...` |

`/assets/...` 요청은 `vercel.json` rewrite로 `frontend/imboxer/assets/...` 파일을 찾습니다.

로컬 확인: `npm run build` 후 `npm run start:frontend` → http://localhost:5500

## 6) 배포 전 체크리스트
- `public/video`에 실제 mp4 파일 업로드 (스파링 4종 등)
- `public/assets/videos`에 training/tutorial/sparring 영상 업로드
- `public/assets/images`에 mp4 참조되는 이미지/결과 리소스 포함 여부 확인
- Git push 후 Vercel 재배포
- 배포 후 브라우저에서 직접 URL 확인
  - `/` (홈: `frontend/index.html`)
  - `/video/스파링초보.mp4`
  - `/assets/videos/tutorials/tutorial_guide.mp4`

