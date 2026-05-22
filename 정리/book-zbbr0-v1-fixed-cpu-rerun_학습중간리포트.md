# book-zbbr0-v1-fixed-cpu-rerun 학습 중간 리포트

작성일: 2026-05-01  
대상 런: `Boxing_Test/runs/detect/runs/obstacle/book-zbbr0-v1-fixed-cpu-rerun`

## 현재 상태 요약

- 학습 방식: `last.pt` 재개 학습 (`resume=True`)
- 데이터셋: `dataset/book_zbbr0_v1_fixed.yaml`
- 디바이스: `cpu`
- 목표 epoch: `80`
- 현재 로그 기준 진행: 약 `63/80`까지 진행 흔적 확인 (`results.csv` tail 기준)

## 최근 지표 스냅샷 (results.csv tail)

- `metrics/precision(B)`: 약 `0.888 ~ 0.900`
- `metrics/recall(B)`: 약 `0.956 ~ 0.960`
- `metrics/mAP50(B)`: 약 `0.712 ~ 0.727`
- `metrics/mAP50-95(B)`: 약 `0.583 ~ 0.593`

> 참고: 학습 중간값이라 마지막 epoch 종료 후 값과 달라질 수 있습니다.

## 체크포인트 파일

- `weights/best.pt` (현재까지 최고 성능 가중치)
- `weights/last.pt` (재개용 체크포인트)

## 학습 곡선/행렬 이미지 (완료 후 확인)

학습이 끝나면 아래 파일들이 생성됩니다. 생성되면 이 문서에서 바로 확인 가능합니다.

![F1 curve](../runs/detect/runs/obstacle/book-zbbr0-v1-fixed-cpu-rerun/BoxF1_curve.png)
![Precision curve](../runs/detect/runs/obstacle/book-zbbr0-v1-fixed-cpu-rerun/BoxP_curve.png)
![PR curve](../runs/detect/runs/obstacle/book-zbbr0-v1-fixed-cpu-rerun/BoxPR_curve.png)
![Recall curve](../runs/detect/runs/obstacle/book-zbbr0-v1-fixed-cpu-rerun/BoxR_curve.png)
![Confusion matrix normalized](../runs/detect/runs/obstacle/book-zbbr0-v1-fixed-cpu-rerun/confusion_matrix_normalized.png)
![Confusion matrix](../runs/detect/runs/obstacle/book-zbbr0-v1-fixed-cpu-rerun/confusion_matrix.png)
![Labels distribution](../runs/detect/runs/obstacle/book-zbbr0-v1-fixed-cpu-rerun/labels.jpg)

## 완료 후 최종 점검 체크리스트

- [ ] `results.csv` 마지막 epoch가 `79` 또는 `80`까지 기록되었는지 확인
- [ ] 위 7개 이미지 파일 생성 여부 확인
- [ ] `best.pt` 생성 시각이 최신인지 확인
- [ ] F1 최적 confidence와 mAP@0.5를 최종 문서에 확정 기록
