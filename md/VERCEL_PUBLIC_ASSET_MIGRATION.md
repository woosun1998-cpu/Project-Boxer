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

## 5) 배포 전 체크리스트
- `public/video`에 실제 mp4 파일 업로드
- `public/assets/videos`에 training/tutorial/sparring 영상 업로드
- `public/assets/images`에 mp4 참조되는 이미지/결과 리소스 포함 여부 확인
- Vercel 배포 후 브라우저에서 직접 URL 확인
  - `/video/스파링초보.mp4`
  - `/assets/videos/tutorials/tutorial_guide.mp4`

