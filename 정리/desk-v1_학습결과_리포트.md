# desk-v1 학습 결과 리포트

작성일: 2026-05-01  
대상 런: `Boxing_Test/runs/detect/runs/obstacle/desk-v1`

## 요약

- 전체 성능은 `mAP@0.5 = 0.829`로 확인됨.
- F1 기준 최적 confidence는 약 `0.42` (`all classes 0.78 at 0.420`).
- 클래스별로 `keyboard`, `person`은 강하고, `chair`, `laptop`, `desk`는 상대적으로 개선 여지 있음.
- 혼동행렬에서 background와의 혼동(오탐/미탐)이 일부 보여 운영 임계값 튜닝이 필요함.

## 1) F1-Confidence Curve

![BoxF1 curve](../runs/detect/runs/obstacle/desk-v1/BoxF1_curve.png)

- confidence를 바꿨을 때 F1(정밀도-재현율 균형)의 변화를 보여줌.
- 운영 임계값 후보는 `0.42` 전후가 1차 권장.

## 2) Precision-Confidence Curve

![BoxP curve](../runs/detect/runs/obstacle/desk-v1/BoxP_curve.png)

- confidence를 높일수록 precision은 상승하는 경향.
- 오탐을 줄이고 싶을 때 임계값 상향을 검토.

## 3) Recall-Confidence Curve

![BoxR curve](../runs/detect/runs/obstacle/desk-v1/BoxR_curve.png)

- confidence를 높일수록 recall은 감소.
- 미검출을 줄이려면 임계값을 지나치게 높이지 않도록 주의.

## 4) Precision-Recall Curve

![BoxPR curve](../runs/detect/runs/obstacle/desk-v1/BoxPR_curve.png)

- 전체 `mAP@0.5 = 0.829`.
- 범례 기준 클래스별 AP는 대략 `keyboard > person > mouse/tv > desk/chair/laptop` 순으로 해석 가능.

## 5) Confusion Matrix (Normalized)

![Confusion matrix normalized](../runs/detect/runs/obstacle/desk-v1/confusion_matrix_normalized.png)

- 클래스별 정분류 비율을 비율(0~1)로 확인 가능.
- `keyboard`, `person`은 높은 정분류율, `chair`/`laptop`은 낮은 편.

## 6) Confusion Matrix (Count)

![Confusion matrix](../runs/detect/runs/obstacle/desk-v1/confusion_matrix.png)

- 실제 count 기준 오분류 위치 확인용.
- background 관련 count를 함께 보면서 오탐/미탐 성향 파악 가능.

## 7) Labels Distribution

![Labels distribution](../runs/detect/runs/obstacle/desk-v1/labels.jpg)

- 클래스 개수 불균형 존재(`person` 다수, `mouse` 소수).
- 박스 중심/크기 분포 편향이 있어 일반화 성능에 영향 가능.

## 다음 실험 제안

1. `chair`, `desk`, `laptop` 중심으로 데이터 보강(특히 어려운 배경/각도 샘플).
2. confidence를 `0.35~0.50` 구간에서 운영 목적(오탐 최소/미탐 최소)에 맞춰 재검증.
3. 클래스 균형 개선 후 동일 설정으로 재학습해 `mAP@0.5`와 confusion 변화 비교.
