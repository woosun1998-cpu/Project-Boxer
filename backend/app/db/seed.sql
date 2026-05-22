USE boxer_db;

INSERT INTO boxing_tutorials (
  title,
  description,
  target_pose_json,
  video_url,
  thumbnail_url,
  difficulty_level,
  is_premium,
  reward_exp,
  reward_coins,
  order_sequence
)
SELECT * FROM (
  SELECT
    'LEVEL 1-1: Boxing Stance (The Foundation)' AS title,
    '복싱의 80%는 올바른 자세에서 시작됩니다. 양발을 어깨너비로 벌리고 스프링 상태를 유지하며 턱과 가드를 함께 잡는 기본 스탠스를 익힙니다.' AS description,
    JSON_OBJECT(
      'level', 1,
      'category', 'foundation',
      'pose', 'stance',
      'ai_judgement', '발 간격과 가드 높이 체크',
      'checkpoints', JSON_ARRAY('feet_shoulder_width', 'rear_heel_up', 'chin_tucked', 'guard_up')
    ) AS target_pose_json,
    '/assets/videos/tutorial-stance.mp4' AS video_url,
    '/assets/images/tutorial-stance.jpg' AS thumbnail_url,
    1 AS difficulty_level,
    FALSE AS is_premium,
    100 AS reward_exp,
    10 AS reward_coins,
    1 AS order_sequence
  UNION ALL
  SELECT
    'LEVEL 1-2: Jab (The Foundation)',
    '가장 빠르고 간결한 주먹인 잽을 익힙니다. 앞손을 가볍게 뻗고 즉시 가드 위치로 복귀하는 리듬을 훈련합니다.',
    JSON_OBJECT(
      'level', 1,
      'category', 'foundation',
      'pose', 'jab',
      'ai_judgement', '타격 후 손의 가드 복귀 속도 측정',
      'checkpoints', JSON_ARRAY('lead_hand_extension', 'fast_guard_recovery', 'chin_down')
    ),
    '/assets/videos/tutorial-jab-defense.mp4',
    '/assets/images/tutorial-jab-defense.jpg',
    1,
    FALSE,
    110,
    10,
    2
  UNION ALL
  SELECT
    'LEVEL 2-1: Straight / Cross (The Rhythm)',
    '뒷발 회전과 체중 이동으로 스트레이트의 파워를 만드는 단계입니다. 어깨와 골반 회전을 함께 쓰는 감각을 익힙니다.',
    JSON_OBJECT(
      'level', 2,
      'category', 'rhythm',
      'pose', 'straight',
      'ai_judgement', '어깨 회전 각도와 골반 틀어짐 기반 파워 측정',
      'checkpoints', JSON_ARRAY('rear_foot_pivot', 'hip_rotation', 'shoulder_turn', 'weight_transfer')
    ),
    '/assets/videos/tutorial-straight.mp4',
    '/assets/images/tutorial-straight.jpg',
    2,
    FALSE,
    130,
    12,
    3
  UNION ALL
  SELECT
    'LEVEL 2-2: Hook (The Rhythm)',
    '팔을 ㄱ자로 유지한 채 짧고 강하게 회전하는 훅을 연습합니다. 팔꿈치와 어깨의 정렬이 핵심입니다.',
    JSON_OBJECT(
      'level', 2,
      'category', 'rhythm',
      'pose', 'hook',
      'ai_judgement', '팔꿈치와 어깨의 수평 정렬 평가',
      'checkpoints', JSON_ARRAY('elbow_horizontal', 'shoulder_alignment', 'torso_rotation')
    ),
    '/assets/videos/tutorial-hook.mp4',
    '/assets/images/tutorial-hook.jpg',
    2,
    FALSE,
    140,
    14,
    4
  UNION ALL
  SELECT
    'LEVEL 3-1: Ducking & Weaving (The Evasion)',
    '무릎을 굽혀 아래로 피하고 U자 형태로 머리를 굴려 피하는 회피 패턴을 익힙니다. 위험 영역에서 머리를 벗어나는 타이밍이 중요합니다.',
    JSON_OBJECT(
      'level', 3,
      'category', 'evasion',
      'pose', 'ducking_weaving',
      'ai_judgement', '코 좌표가 위험 영역을 벗어나는지 판정',
      'checkpoints', JSON_ARRAY('knee_bend', 'head_off_line', 'weave_path')
    ),
    '/assets/videos/tutorial-ducking.mp4',
    '/assets/images/tutorial-ducking.jpg',
    3,
    TRUE,
    170,
    18,
    5
  UNION ALL
  SELECT
    'LEVEL 3-2: Combo & Counter (The Evasion)',
    '잽-잽-스트레이트-위빙 같은 연속 동작을 수행하며 스파링 전용 리듬을 익힙니다. 동작 간 연결 속도가 콤보 점수로 이어집니다.',
    JSON_OBJECT(
      'level', 3,
      'category', 'evasion',
      'pose', 'combo_counter',
      'ai_judgement', '각 동작 사이 연결 속도와 지연 시간 측정',
      'checkpoints', JSON_ARRAY('jab_chain', 'straight_finish', 'weave_reset', 'combo_tempo')
    ),
    '/assets/videos/tutorial-combo-counter.mp4',
    '/assets/images/tutorial-combo-counter.jpg',
    3,
    TRUE,
    200,
    22,
    6
) AS new_tutorials
WHERE NOT EXISTS (
  SELECT 1
  FROM boxing_tutorials existing
  WHERE existing.title = new_tutorials.title
);

INSERT INTO attack_videos (
  title,
  file_path,
  attack_type,
  difficulty,
  duration_sec,
  thumbnail_url,
  is_premium
)
VALUES
(
  'Quick Jab Drill',
  '/assets/videos/quick-jab.mp4',
  'jab',
  'easy',
  6.50,
  '/assets/images/quick-jab.jpg',
  FALSE
),
(
  'Hook Reaction Drill',
  '/assets/videos/hook-reaction.mp4',
  'hook',
  'medium',
  8.20,
  '/assets/images/hook-reaction.jpg',
  FALSE
),
(
  'Uppercut Elite Drill',
  '/assets/videos/uppercut-elite.mp4',
  'uppercut',
  'hard',
  9.10,
  '/assets/images/uppercut-elite.jpg',
  TRUE
)
ON DUPLICATE KEY UPDATE
  file_path = VALUES(file_path),
  attack_type = VALUES(attack_type),
  difficulty = VALUES(difficulty),
  duration_sec = VALUES(duration_sec),
  thumbnail_url = VALUES(thumbnail_url),
  is_premium = VALUES(is_premium);

INSERT INTO attack_timestamps (
  video_id,
  impact_time,
  dodge_window_ms,
  hitbox_radius,
  attack_type
)
SELECT id, 1.250, 300, 0.15, attack_type
FROM attack_videos
WHERE title = 'Quick Jab Drill'
AND NOT EXISTS (
  SELECT 1 FROM attack_timestamps WHERE video_id = attack_videos.id AND impact_time = 1.250
);

INSERT INTO attack_timestamps (
  video_id,
  impact_time,
  dodge_window_ms,
  hitbox_radius,
  attack_type
)
SELECT id, 2.100, 350, 0.18, attack_type
FROM attack_videos
WHERE title = 'Hook Reaction Drill'
AND NOT EXISTS (
  SELECT 1 FROM attack_timestamps WHERE video_id = attack_videos.id AND impact_time = 2.100
);

INSERT INTO attack_timestamps (
  video_id,
  impact_time,
  dodge_window_ms,
  hitbox_radius,
  attack_type
)
SELECT id, 2.850, 280, 0.20, attack_type
FROM attack_videos
WHERE title = 'Uppercut Elite Drill'
AND NOT EXISTS (
  SELECT 1 FROM attack_timestamps WHERE video_id = attack_videos.id AND impact_time = 2.850
);

INSERT INTO shop_items (
  name,
  description,
  item_type,
  price_coins,
  thumbnail,
  is_active
)
VALUES
(
  'Red Gloves Skin',
  'Unlock a red glove cosmetic skin.',
  'skin',
  50,
  '/assets/images/shop-red-gloves.jpg',
  TRUE
),
(
  'Reaction Report',
  'One downloadable reaction analysis report.',
  'report',
  80,
  '/assets/images/shop-report.jpg',
  TRUE
),
(
  'Premium Upgrade',
  'Upgrade your account to premium features.',
  'premium',
  300,
  '/assets/images/shop-premium.jpg',
  TRUE
)
ON DUPLICATE KEY UPDATE
  description = VALUES(description),
  item_type = VALUES(item_type),
  price_coins = VALUES(price_coins),
  thumbnail = VALUES(thumbnail),
  is_active = VALUES(is_active);

-- ============================================
-- 12. Sparring 추천 영상 (4단계 난이도 예시)
-- ============================================
INSERT INTO attack_videos (
  title,
  file_path,
  attack_type,
  difficulty,
  duration_sec,
  thumbnail_url,
  is_premium
)
SELECT
  'Beginner Jab Flow',
  '/assets/videos/beginner-jab-flow.mp4',
  'jab',
  'beginner',
  6.00,
  '/assets/images/beginner-jab-flow.jpg',
  FALSE
WHERE NOT EXISTS (
  SELECT 1 FROM attack_videos WHERE title = 'Beginner Jab Flow'
);

INSERT INTO attack_videos (
  title,
  file_path,
  attack_type,
  difficulty,
  duration_sec,
  thumbnail_url,
  is_premium
)
SELECT
  'Intermediate Straight Counter',
  '/assets/videos/intermediate-straight-counter.mp4',
  'straight',
  'intermediate',
  7.20,
  '/assets/images/intermediate-straight-counter.jpg',
  FALSE
WHERE NOT EXISTS (
  SELECT 1 FROM attack_videos WHERE title = 'Intermediate Straight Counter'
);

INSERT INTO attack_videos (
  title,
  file_path,
  attack_type,
  difficulty,
  duration_sec,
  thumbnail_url,
  is_premium
)
SELECT
  'Advanced Hook Pressure',
  '/assets/videos/advanced-hook-pressure.mp4',
  'hook',
  'advanced',
  8.40,
  '/assets/images/advanced-hook-pressure.jpg',
  TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM attack_videos WHERE title = 'Advanced Hook Pressure'
);

INSERT INTO attack_videos (
  title,
  file_path,
  attack_type,
  difficulty,
  duration_sec,
  thumbnail_url,
  is_premium
)
SELECT
  'Pro Mixed Storm',
  '/assets/videos/pro-mixed-storm.mp4',
  'mixed',
  'pro',
  9.60,
  '/assets/images/pro-mixed-storm.jpg',
  TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM attack_videos WHERE title = 'Pro Mixed Storm'
);

INSERT INTO attack_timestamps (
  video_id,
  impact_time,
  dodge_window_ms,
  hitbox_radius,
  attack_type,
  judge_shape,
  target_zone,
  required_move,
  min_displacement
)
SELECT id, 1.100, 650, 0.22, 'jab', 'circle', 'head', 'slip_left', 0.10
FROM attack_videos
WHERE title = 'Beginner Jab Flow'
AND NOT EXISTS (
  SELECT 1 FROM attack_timestamps WHERE video_id = attack_videos.id AND impact_time = 1.100
);

INSERT INTO attack_timestamps (
  video_id,
  impact_time,
  dodge_window_ms,
  hitbox_radius,
  attack_type,
  judge_shape,
  target_zone,
  required_move,
  min_displacement
)
SELECT id, 1.800, 520, 0.16, 'straight', 'lane', 'head', 'lean_back', 0.12
FROM attack_videos
WHERE title = 'Intermediate Straight Counter'
AND NOT EXISTS (
  SELECT 1 FROM attack_timestamps WHERE video_id = attack_videos.id AND impact_time = 1.800
);

INSERT INTO attack_timestamps (
  video_id,
  impact_time,
  dodge_window_ms,
  hitbox_radius,
  attack_type,
  judge_shape,
  target_zone,
  required_move,
  min_displacement
)
SELECT id, 2.600, 430, 0.12, 'hook', 'ellipse', 'left_head', 'slip_side', 0.14
FROM attack_videos
WHERE title = 'Advanced Hook Pressure'
AND NOT EXISTS (
  SELECT 1 FROM attack_timestamps WHERE video_id = attack_videos.id AND impact_time = 2.600
);

INSERT INTO attack_timestamps (
  video_id,
  impact_time,
  dodge_window_ms,
  hitbox_radius,
  attack_type,
  judge_shape,
  target_zone,
  required_move,
  min_displacement
)
SELECT id, 3.200, 360, 0.10, 'mixed', 'ellipse', 'body', 'duck', 0.16
FROM attack_videos
WHERE title = 'Pro Mixed Storm'
AND NOT EXISTS (
  SELECT 1 FROM attack_timestamps WHERE video_id = attack_videos.id AND impact_time = 3.200
);
