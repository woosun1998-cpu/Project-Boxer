# 모델 영구 보관 가이드

이 문서는 학습된 모델 가중치(`.pt`)가 병합/브랜치 이동/실수 삭제 상황에서도 최대한 안전하게 남도록 하는 실행 방법입니다.

## 1) 바로 백업하기 (권장)

프로젝트 루트에서 아래 명령을 실행합니다.

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\backup_latest_weight.ps1
```

이 명령은 다음을 자동으로 수행합니다.

- `runs/detect/runs/obstacle/**/weights/best.pt` 중 최신 파일 탐색
- `model_backups/<tag-시간>/` 폴더로 원본 복사
- SHA256 체크섬 파일 생성
- `metadata.json` 생성
- `models/weights/latest-best.pt` 고정 경로에도 복사

## 2) 특정 모델 직접 백업하기

```bat
backend\venv\Scripts\python.exe scripts\secure_model_backup.py ^
  --source "runs\detect\runs\obstacle\desk-v1\weights\best.pt" ^
  --backup-root "model_backups" ^
  --tag "desk-v1" ^
  --notes "멀티클래스 모델" ^
  --copy-to-models "models\weights\desk-v1-best.pt"
```

## 3) 복구 시 확인 순서

1. `model_backups`에서 원하는 버전 폴더 선택  
2. `.sha256.txt`와 실제 파일 해시 비교  
3. 필요한 경로(`models/weights` 또는 `runs/.../weights`)로 복사  
4. 서버 재시작 후 클래스 목록 확인

```bat
backend\venv\Scripts\python.exe -c "from ultralytics import YOLO; m=YOLO(r'models\weights\desk-v1-best.pt'); print(m.model.names)"
```

## 4) 안전 수칙 (중요)

- 새 학습 결과는 항상 **새 파일명**으로 저장합니다. (원본 덮어쓰기 금지)
- 병합 전에 `git status`로 모델 파일 추적 상태를 확인합니다.
- 최소 월 1회는 실제 복구 테스트를 진행합니다.
- 로컬 외에 외장/클라우드에도 한 번 더 복사해 3중 보관합니다.

## 5) 학습 스크립트 자동 백업 (이미 적용됨)

아래 스크립트는 학습이 끝나면 `best.pt`를 자동 백업합니다.

- `scripts/train_yolo_obstacle.py`
- `scripts/train_yolo_obstacle_roboflow.py`

자동 백업을 잠시 끄고 싶으면 학습 명령에 `--skip-backup`을 추가하세요.

```bat
python scripts/train_yolo_obstacle.py --name desk-v2 --skip-backup
```
