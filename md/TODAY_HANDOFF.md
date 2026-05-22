# Today Handoff

## Summary

오늘 작업은 크게 4가지였습니다.

1. 백엔드 DB 초기화와 MySQL 연결 정리
2. 회원가입이 바로 동작하도록 인증 흐름 점검
3. 튜토리얼 페이지 고도화
4. 스파링 페이지 영상 UX 개선

---

## Backend

### Done

- MySQL 연결 및 DB 초기화 흐름 정리
- 서버 시작 시 필요한 테이블 자동 생성 연결
- 회원가입 API 저장 및 JWT 발급 확인
- 튜토리얼/스파링용 SQL 보조 파일 추가

### Main files

- [backend/main.py](c:/Users/User/Desktop/PROJECT/실버 운동앱/luma_pose_video_vscode/boxer/backend/main.py)
- [backend/app/database.py](c:/Users/User/Desktop/PROJECT/실버 운동앱/luma_pose_video_vscode/boxer/backend/app/database.py)
- [backend/app/config.py](c:/Users/User/Desktop/PROJECT/실버 운동앱/luma_pose_video_vscode/boxer/backend/app/config.py)
- [backend/scripts/init_db.py](c:/Users/User/Desktop/PROJECT/실버 운동앱/luma_pose_video_vscode/boxer/backend/scripts/init_db.py)
- [backend/app/utils/security.py](c:/Users/User/Desktop/PROJECT/실버 운동앱/luma_pose_video_vscode/boxer/backend/app/utils/security.py)

### Added helper docs/scripts

- [backend/API_VIDEO_SAMPLES.md](c:/Users/User/Desktop/PROJECT/실버 운동앱/luma_pose_video_vscode/boxer/backend/API_VIDEO_SAMPLES.md)
- [backend/app/db/seed_sparring_videos.sql](c:/Users/User/Desktop/PROJECT/실버 운동앱/luma_pose_video_vscode/boxer/backend/app/db/seed_sparring_videos.sql)
- [backend/app/db/update_tutorial_video_urls.sql](c:/Users/User/Desktop/PROJECT/실버 운동앱/luma_pose_video_vscode/boxer/backend/app/db/update_tutorial_video_urls.sql)
- [backend/scripts/refresh_tutorial_catalog.py](c:/Users/User/Desktop/PROJECT/실버 운동앱/luma_pose_video_vscode/boxer/backend/scripts/refresh_tutorial_catalog.py)

---

## Auth / Signup

### Checked

- `/api/auth/signup` 성공 확인
- 사용자 DB 저장 확인
- JWT 발급 확인
- 서버 실행 흐름 확인

### Run commands

프로젝트 루트에서:

```powershell
py -m http.server 5500
```

백엔드 폴더에서:

```powershell
py .\scripts\init_db.py
py -m uvicorn main:app --reload
```

---

## Tutorial

### Done

- 초급 2개, 중급 2개, 상급 2개 구조로 튜토리얼 가이드 확장
- 강좌별 판정 모드 분리
- `TutorialEngine.js` 를 강좌별 분석 구조로 재작성
- 상세 패널에 `발 위치 / 상체 및 가드 / 수행 팁` 섹션 추가
- 튜토리얼 영상 파일명/경로 안내 UI 추가
- 튜토리얼 영상 9:16 레이아웃 적용
- 웹캠 표시 확대

### Main files

- [frontend/tutorial.html](c:/Users/User/Desktop/PROJECT/실버 운동앱/luma_pose_video_vscode/boxer/frontend/tutorial.html)
- [frontend/js/tutorial/TutorialEngine.js](c:/Users/User/Desktop/PROJECT/실버 운동앱/luma_pose_video_vscode/boxer/frontend/js/tutorial/TutorialEngine.js)

### Tutorial video filenames

파일 위치:

```text
frontend/assets/videos/
```

파일명:

```text
tutorial-level1-stance.mp4
tutorial-level1-jab.mp4
tutorial-level2-straight.mp4
tutorial-level2-hook.mp4
tutorial-level3-ducking.mp4
tutorial-level3-combo.mp4
```

DB 경로:

```text
/assets/videos/tutorial-level1-stance.mp4
/assets/videos/tutorial-level1-jab.mp4
/assets/videos/tutorial-level2-straight.mp4
/assets/videos/tutorial-level2-hook.mp4
/assets/videos/tutorial-level3-ducking.mp4
/assets/videos/tutorial-level3-combo.mp4
```

### Known caveat

- DB 안에 예전 튜토리얼 중복 데이터가 일부 남아 있을 수 있음
- 프론트는 제목 기준으로 중복을 줄여 표시하도록 정리됨

---

## Sparring

### Done

- 시작 화면 배경 영상 자리 추가
- `Fight!` 직후 인트로 영상 자리 추가
- 전투 영상 자리 및 데모 영상 자리 정리
- 전투 영상 9:16 레이아웃 유지
- 시작 화면을 카드형/게임형 UI로 정리
- 불필요한 설명 문구 대부분 숨김 처리
- 데모 모드에서도 실제 demo mp4 재생 연결

### Main file

- [frontend/sparring.html](c:/Users/User/Desktop/PROJECT/2차 작업파일 (PROJECT)/운동앱/boxer/frontend/sparring.html)

### Sparring video files

파일 위치:

```text
frontend/assets/videos/
```

용도별 파일:

```text
sparring-lobby-bg.mp4
sparring-intro-board.mp4
sparring-demo-vertical.mp4
jab-round1.mp4
hook-round1.mp4
straight-round1.mp4
```

의미:

- `sparring-lobby-bg.mp4`: 스파링 첫 진입 배경
- `sparring-intro-board.mp4`: `Fight!` 직후 브리핑 인트로
- `sparring-demo-vertical.mp4`: 데모 모드 기본 전투 영상
- `jab-round1.mp4`, `hook-round1.mp4`, `straight-round1.mp4`: 실제 공격 영상 후보

### Important note

- `jab-round1`, `hook-round1`, `straight-round1` 이 드롭다운에 보이려면 DB `attack_videos` 등록이 필요함
- 인트로/로비/데모 기본 영상은 프론트 파일만 있어도 동작하도록 연결함

---

## Assets

### Added or organized

- 로고 및 배경 이미지 정리
- 튜토리얼 영상 업로드
- 스파링 영상 업로드
- 공통 사운드/UI JS 파일 추가

### Main paths

- [frontend/assets/images](c:/Users/User/Desktop/PROJECT/실버 운동앱/luma_pose_video_vscode/boxer/frontend/assets/images)
- [frontend/assets/videos](c:/Users/User/Desktop/PROJECT/실버 운동앱/luma_pose_video_vscode/boxer/frontend/assets/videos)
- [frontend/js/ui/sounds.js](c:/Users/User/Desktop/PROJECT/실버 운동앱/luma_pose_video_vscode/boxer/frontend/js/ui/sounds.js)

---

## Current Git Status

오늘 작업은 이미 GitHub에 푸시 완료됨.

- branch: `main`
- commit: `9786192`
- message: `Implement backend setup and upgraded sparring/tutorial experience`

---

## Next Recommended Tasks

우선순위 순서:

1. `attack_videos` 와 `attack_timestamps` 실제 DB 등록 상태 확인
2. 스파링 드롭다운에 `jab-round1 / hook-round1 / straight-round1` 표시 확인
3. `sparring-intro-board.mp4` 인트로 재생이 브라우저별로 안정적인지 재점검
4. `sparring.html` 안에 남은 예전 중복 마크업 정리
5. 튜토리얼 DB 중복 행 정리
6. 필요하면 `POST /api/videos` 생성 API 추가

---

## Quick Resume Checklist

다음에 시작할 때 바로 확인:

1. 백엔드 서버 실행
2. 프론트 정적 서버 실행
3. `tutorial.html` 확인
4. `sparring.html` 확인
5. DB에 스파링 영상 목록 존재 여부 확인

확인 쿼리:

```sql
SELECT id, title, file_path, attack_type, difficulty
FROM attack_videos;
```

튜토리얼 영상 경로 확인:

```sql
SELECT title, video_url
FROM boxing_tutorials
WHERE title LIKE 'LEVEL %';
```







4시30분 -- 4단계시작

## 4단계 프롬프트: 난이도/매치셋업 개편용
기존 easy/medium/hard 난이도를
beginner/intermediate/advanced/pro 4단계로 개편하라.

요구사항:
- 기존 easy/medium/hard fallback 제공
- Match Setup UI에 아래 항목 추가
  - Level
  - Attack Type
  - Round Length
  - Mode
  - Assist
- 기본값 연결
- 실제 게임 판정 로직과 연결

출력:
- difficulty config 코드
- sparring.html 수정 코드
- 선택값 전달 흐름

## 5단계 프롬프트: 관리자 화면 개편용
admin.html 및 관련 JS를 수정하여
영상과 공격 타임스탬프에 아래 필드를 입력할 수 있게 하라.

필드:
- attack_type
- impact_time
- dodge_window_ms
- hitbox_radius
- judge_shape
- target_zone
- required_move
- min_displacement

추가 요구:
- 난이도 프리셋 버튼
- validation
- placeholder / 설명 추가
- 기존 저장 API와 연결

출력:
- admin.html 수정안
- 관리자 JS 수정안
- 저장 payload 예시

## 6단계 프롬프트: 백엔드 모델/시드데이터용
백엔드 모델을 확장하라.

session 결과에 추가:
- attack_type
- dodge_direction
- accuracy_score
- judge_label
- earned_score_per_attack
- reaction_ms
- outcome

video / attack timestamp에 추가:
- judge_shape
- target_zone
- required_move
- min_displacement
- attack_type
- dodge_window_ms
- hitbox_radius

또한 단계별 추천 영상 seed 데이터도 추가하라.

출력:
- models 수정 코드
- schema/route 수정 포인트
- seed 데이터 예시

## 7단계 Codex에게 마지막 점검까지 시키는 프롬프트
지금까지 수정한 내용을 기준으로 최종 점검하라.

반드시 확인:
1. 기존 easy/medium/hard 데이터가 깨지지 않는가
2. beginner/intermediate/advanced/pro가 실제 UI와 판정에 연결되는가
3. jab/hook/uppercut별 판정 분기가 실제 동작하는가
4. accuracy_score와 judge_label이 저장되는가
5. 공격별 earned_score 추적이 가능한가
6. 관리자 입력값이 실제 게임 로직에 반영되는가
7. 프론트/백엔드 필드명이 일치하는가
8. null/default/fallback 처리에 빠진 부분이 없는가

출력:
- 문제점 목록
- 수정 필요 항목
- 최종 패치 제안
- 테스트 체크리스트

## 추가적으로 알아야하는 CODEX 지시법
Codex에게 시킬 때 실제로 어떤 식으로 말해야 하는가

가장 쉬운 방식은 매번 아래 구조를 유지하는 것입니다.

Codex 프롬프트 기본 구조
A. 작업 목표

무엇을 바꾸는지 한 문단으로 설명

예:

현재 권투 게임의 회피 판정은 nose 좌표 1점만 사용한다. 이를 머리/어깨/몸통 기반 다점 판정으로 개편하고, 난이도를 4단계로 확장하며, 정확도 점수와 관리자 설정 필드를 추가하라.
B. 현재 상태

지금 구조가 어떤지 설명

예:

현재는 nose가 중앙 원형 히트박스 밖이면 DODGE, 안이면 HIT다.
난이도는 easy/medium/hard 3단계다.
score_earned는 라운드 누적 중심이다.
admin은 impact_time, dodge_window_ms, hitbox_radius 정도만 관리한다.
C. 문제점

왜 바꾸는지 설명

예:

몸통을 움직였는데 nose만 기준이라 억울한 HIT가 발생한다.
hook, jab, uppercut이 사실상 같은 판정이다.
개별 공격당 정확도 분석이 어렵다.
D. 목표 기능

원하는 결과를 상세히 설명

예:

judge(nose)를 judge(landmarks, attackProfile, timingContext)로 바꿔라.
accuracy_score를 0~100으로 계산하라.
judge_label을 Perfect/Clean/Late/Unsafe/Miss로 저장하라.
beginner/intermediate/advanced/pro 4단계 난이도 구조를 도입하라.
E. 수정 대상 파일

Codex가 헤매지 않도록 경로를 준다

예:

frontend/js/engine/HitboxJudge.js
frontend/sparring.html
frontend/admin.html
backend/app/models/session.py
backend/app/models/video.py
F. 작업 순서

반드시 순서를 준다

예:

현재 구조 분석
영향 파일 목록 정리
설계안 제시
실제 코드 수정
하위호환 처리
테스트 체크리스트 작성
G. 출력 형식

결과를 어떤 방식으로 내놓을지 지정

예:

현재 구조 분석 결과
변경 파일 목록
각 파일별 수정 이유
실제 코드 패치
테스트 체크리스트
남은 TODO

이 구조를 매번 쓰면 Codex가 훨씬 덜 흔들립니다.