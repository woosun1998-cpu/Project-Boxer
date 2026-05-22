# Sparring Next Checklist

## 목표

- `sparring.html` 시작 화면과 `Fight!` 모달이 DB 영상과 정상 연결되는지 확인한다.
- 초급 1 / 2 / 3에서 각각 어떤 회피 동작을 해야 하는지 한눈에 확인한다.
- `DODGE`일 때만 점수가 오르고, `HIT`일 때는 HP가 줄어드는지 확인한다.

## 초급 동작

- 초급 1 `Beginner Jab Flow`: 왼쪽으로 살짝 피한다. `slip_left`
- 초급 2 `Beginner Jab Rhythm`: 좌우로 한쪽으로 빠지듯 피한다. `slip_side`
- 초급 3 `Beginner Jab Reset`: 다시 한쪽으로 빠지며 리셋한다. `slip_side`

## 지금 확인할 것

- `DODGE`가 떠야 점수가 오른다.
- `combo`는 `DODGE` 연속 성공 시 올라간다.
- `HIT`가 떠야 HP가 줄어든다.
- 현재 모델은 `hook`, `uppercut`만 감지한다. `jab` 판정은 포즈 회피 로직이 담당한다.

## 왜 `HIT`가 나오는가

- 얼굴과 어깨가 카메라에 제대로 잡히지 않으면 `HIT`가 된다.
- 움직임 방향이 `required_move`와 맞지 않으면 `HIT`가 된다.
- 이동량이 `min_displacement`보다 작으면 `HIT`가 된다.
- 타이밍이 맞아도 자세가 안 맞으면 `HIT`가 된다.

## 디버그 포인트

1. `pendingJudge`에 들어간 값 확인
- `attack_type`
- `required_move`
- `judge_shape`
- `hitbox_radius`
- `dodge_window_ms`
- `min_displacement`

2. `HitboxJudge.judge()` 결과 확인
- `shapeEscaped`
- `moveSatisfied`
- 둘 다 참이어야 `DODGE`

3. `buildJudgeMeta()` 결과 확인
- `directionMatched`
- `displacementSatisfied`
- `guardOk`

4. `GameEngine.onJudge()` 결과 확인
- `result === 'DODGE'`면 점수 증가
- `result !== 'DODGE'`면 HP 감소

## 빠른 실행 순서

1. `sparring` 화면 진입
2. 초급 선택
3. `Fight!` 클릭
4. `1 / 2 / 3` 중 하나 선택
5. 영상의 타임스탬프가 뜰 때 안내 문구 확인
6. 그 순간 초급 1은 왼쪽, 초급 2와 3은 한쪽으로 빠지는 동작 시도
7. 결과가 `DODGE`인지 `HIT`인지 확인
8. 점수와 HP가 기대대로 바뀌는지 확인

## 추가하면 좋은 것

- 초급별로 화면에 `왼쪽으로 피하기`, `옆으로 빠지기` 같은 짧은 가이드를 표시한다.
- `DODGE/HIT` 결과를 디버그 패널에 더 크게 노출한다.
- `jab`도 모델로 직접 감지하려면 별도 학습 모델이 필요하다.
