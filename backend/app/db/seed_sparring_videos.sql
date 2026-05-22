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
  'Lobby Demo Vertical',
  '/assets/videos/sparring-demo-vertical.mp4',
  'jab',
  'easy',
  8.50,
  '/assets/images/logo.png',
  FALSE
),
(
  'Jab Round 1',
  '/assets/videos/jab-round1.mp4',
  'jab',
  'easy',
  7.20,
  '/assets/images/logo.png',
  FALSE
),
(
  'Hook Round 1',
  '/assets/videos/hook-round1.mp4',
  'hook',
  'medium',
  8.40,
  '/assets/images/logo.png',
  FALSE
),
(
  'Straight Round 1',
  '/assets/videos/straight-round1.mp4',
  'straight',
  'hard',
  9.10,
  '/assets/images/logo.png',
  TRUE
);

INSERT INTO attack_timestamps (
  video_id,
  impact_time,
  dodge_window_ms,
  hitbox_radius,
  attack_type
)
SELECT id, 1.200, 320, 0.16, attack_type
FROM attack_videos
WHERE title = 'Lobby Demo Vertical'
AND NOT EXISTS (
  SELECT 1
  FROM attack_timestamps
  WHERE video_id = attack_videos.id
    AND impact_time = 1.200
);

INSERT INTO attack_timestamps (
  video_id,
  impact_time,
  dodge_window_ms,
  hitbox_radius,
  attack_type
)
SELECT id, 1.350, 300, 0.15, attack_type
FROM attack_videos
WHERE title = 'Jab Round 1'
AND NOT EXISTS (
  SELECT 1
  FROM attack_timestamps
  WHERE video_id = attack_videos.id
    AND impact_time = 1.350
);

INSERT INTO attack_timestamps (
  video_id,
  impact_time,
  dodge_window_ms,
  hitbox_radius,
  attack_type
)
SELECT id, 2.850, 340, 0.18, attack_type
FROM attack_videos
WHERE title = 'Hook Round 1'
AND NOT EXISTS (
  SELECT 1
  FROM attack_timestamps
  WHERE video_id = attack_videos.id
    AND impact_time = 2.850
);

INSERT INTO attack_timestamps (
  video_id,
  impact_time,
  dodge_window_ms,
  hitbox_radius,
  attack_type
)
SELECT id, 3.100, 280, 0.20, attack_type
FROM attack_videos
WHERE title = 'Straight Round 1'
AND NOT EXISTS (
  SELECT 1
  FROM attack_timestamps
  WHERE video_id = attack_videos.id
    AND impact_time = 3.100
);

-- ============================================
-- 4단계 난이도 추천 영상 예시
-- ============================================
INSERT INTO attack_videos (title, file_path, attack_type, difficulty, duration_sec, thumbnail_url, is_premium)
SELECT 'Beginner Jab Flow', '/assets/videos/beginner-jab-flow.mp4', 'jab', 'beginner', 6.00, '/assets/images/beginner-jab-flow.jpg', FALSE
WHERE NOT EXISTS (SELECT 1 FROM attack_videos WHERE title = 'Beginner Jab Flow');

INSERT INTO attack_videos (title, file_path, attack_type, difficulty, duration_sec, thumbnail_url, is_premium)
SELECT 'Intermediate Straight Counter', '/assets/videos/intermediate-straight-counter.mp4', 'straight', 'intermediate', 7.20, '/assets/images/intermediate-straight-counter.jpg', FALSE
WHERE NOT EXISTS (SELECT 1 FROM attack_videos WHERE title = 'Intermediate Straight Counter');

INSERT INTO attack_videos (title, file_path, attack_type, difficulty, duration_sec, thumbnail_url, is_premium)
SELECT 'Advanced Hook Pressure', '/assets/videos/advanced-hook-pressure.mp4', 'hook', 'advanced', 8.40, '/assets/images/advanced-hook-pressure.jpg', TRUE
WHERE NOT EXISTS (SELECT 1 FROM attack_videos WHERE title = 'Advanced Hook Pressure');

INSERT INTO attack_videos (title, file_path, attack_type, difficulty, duration_sec, thumbnail_url, is_premium)
SELECT 'Pro Mixed Storm', '/assets/videos/pro-mixed-storm.mp4', 'mixed', 'pro', 9.60, '/assets/images/pro-mixed-storm.jpg', TRUE
WHERE NOT EXISTS (SELECT 1 FROM attack_videos WHERE title = 'Pro Mixed Storm');

INSERT INTO attack_timestamps (
  video_id, impact_time, dodge_window_ms, hitbox_radius, attack_type, judge_shape, target_zone, required_move, min_displacement
)
SELECT id, 1.100, 650, 0.22, 'jab', 'circle', 'head', 'slip_left', 0.10
FROM attack_videos
WHERE title = 'Beginner Jab Flow'
AND NOT EXISTS (SELECT 1 FROM attack_timestamps WHERE video_id = attack_videos.id AND impact_time = 1.100);

INSERT INTO attack_videos (title, file_path, attack_type, difficulty, duration_sec, thumbnail_url, is_premium)
SELECT 'Beginner Jab Rhythm', '/assets/videos/sparring/sparring_beginner_jab_02.mp4', 'jab', 'beginner', 6.20, '/assets/images/beginner.png', FALSE
WHERE NOT EXISTS (SELECT 1 FROM attack_videos WHERE title = 'Beginner Jab Rhythm');

INSERT INTO attack_videos (title, file_path, attack_type, difficulty, duration_sec, thumbnail_url, is_premium)
SELECT 'Beginner Jab Reset', '/assets/videos/sparring/sparring_beginner_jab_03.mp4', 'jab', 'beginner', 6.40, '/assets/images/beginner.png', FALSE
WHERE NOT EXISTS (SELECT 1 FROM attack_videos WHERE title = 'Beginner Jab Reset');

INSERT INTO attack_timestamps (
  video_id, impact_time, dodge_window_ms, hitbox_radius, attack_type, judge_shape, target_zone, required_move, min_displacement
)
SELECT id, 1.250, 650, 0.22, 'jab', 'circle', 'head', 'slip_side', 0.10
FROM attack_videos
WHERE title = 'Beginner Jab Rhythm'
AND NOT EXISTS (SELECT 1 FROM attack_timestamps WHERE video_id = attack_videos.id AND impact_time = 1.250);

INSERT INTO attack_timestamps (
  video_id, impact_time, dodge_window_ms, hitbox_radius, attack_type, judge_shape, target_zone, required_move, min_displacement
)
SELECT id, 3.050, 600, 0.21, 'jab', 'circle', 'head', 'slip_side', 0.10
FROM attack_videos
WHERE title = 'Beginner Jab Rhythm'
AND NOT EXISTS (SELECT 1 FROM attack_timestamps WHERE video_id = attack_videos.id AND impact_time = 3.050);

INSERT INTO attack_timestamps (
  video_id, impact_time, dodge_window_ms, hitbox_radius, attack_type, judge_shape, target_zone, required_move, min_displacement
)
SELECT id, 1.300, 680, 0.22, 'jab', 'lane', 'head', 'slip_side', 0.10
FROM attack_videos
WHERE title = 'Beginner Jab Reset'
AND NOT EXISTS (SELECT 1 FROM attack_timestamps WHERE video_id = attack_videos.id AND impact_time = 1.300);

INSERT INTO attack_timestamps (
  video_id, impact_time, dodge_window_ms, hitbox_radius, attack_type, judge_shape, target_zone, required_move, min_displacement
)
SELECT id, 3.350, 620, 0.20, 'jab', 'lane', 'head', 'slip_side', 0.10
FROM attack_videos
WHERE title = 'Beginner Jab Reset'
AND NOT EXISTS (SELECT 1 FROM attack_timestamps WHERE video_id = attack_videos.id AND impact_time = 3.350);

INSERT INTO attack_timestamps (
  video_id, impact_time, dodge_window_ms, hitbox_radius, attack_type, judge_shape, target_zone, required_move, min_displacement
)
SELECT id, 1.800, 520, 0.16, 'straight', 'lane', 'head', 'lean_back', 0.12
FROM attack_videos
WHERE title = 'Intermediate Straight Counter'
AND NOT EXISTS (SELECT 1 FROM attack_timestamps WHERE video_id = attack_videos.id AND impact_time = 1.800);

INSERT INTO attack_timestamps (
  video_id, impact_time, dodge_window_ms, hitbox_radius, attack_type, judge_shape, target_zone, required_move, min_displacement
)
SELECT id, 2.600, 430, 0.12, 'hook', 'ellipse', 'left_head', 'slip_side', 0.14
FROM attack_videos
WHERE title = 'Advanced Hook Pressure'
AND NOT EXISTS (SELECT 1 FROM attack_timestamps WHERE video_id = attack_videos.id AND impact_time = 2.600);

INSERT INTO attack_timestamps (
  video_id, impact_time, dodge_window_ms, hitbox_radius, attack_type, judge_shape, target_zone, required_move, min_displacement
)
SELECT id, 3.200, 360, 0.10, 'mixed', 'ellipse', 'body', 'duck', 0.16
FROM attack_videos
WHERE title = 'Pro Mixed Storm'
AND NOT EXISTS (SELECT 1 FROM attack_timestamps WHERE video_id = attack_videos.id AND impact_time = 3.200);
