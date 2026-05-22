-- Sparring mid/advanced/pro data backfill
-- This aligns the DB with the frontend 3-clip intro sets.

UPDATE attack_videos
SET
  title = 'Line Control',
  file_path = '/assets/videos/sparring/sparring_intermediate_straight_01.mp4',
  attack_type = 'straight',
  difficulty = 'intermediate',
  duration_sec = 7.20,
  thumbnail_url = '/assets/images/player/intermediate.png',
  is_premium = FALSE
WHERE title = 'Intermediate Straight Counter';

UPDATE attack_videos
SET
  title = 'Inside Hook',
  file_path = '/assets/videos/sparring/sparring_advanced_hook_01.mp4',
  attack_type = 'hook',
  difficulty = 'advanced',
  duration_sec = 8.40,
  thumbnail_url = '/assets/images/player/advanced.png',
  is_premium = TRUE
WHERE title = 'Advanced Hook Pressure';

UPDATE attack_videos
SET
  title = 'Pressure Mix',
  file_path = '/assets/videos/sparring/sparring_pro_mixed_01.mp4',
  attack_type = 'mixed',
  difficulty = 'pro',
  duration_sec = 9.60,
  thumbnail_url = '/assets/images/player/pro.png',
  is_premium = TRUE
WHERE title = 'Pro Mixed Storm';

INSERT INTO attack_videos (
  title,
  file_path,
  attack_type,
  difficulty,
  duration_sec,
  thumbnail_url,
  is_premium
)
SELECT 'Counter Straight', '/assets/videos/sparring/sparring_intermediate_straight_02.mp4', 'straight', 'intermediate', 7.45, '/assets/images/player/intermediate.png', FALSE
WHERE NOT EXISTS (SELECT 1 FROM attack_videos WHERE title = 'Counter Straight');

INSERT INTO attack_videos (
  title,
  file_path,
  attack_type,
  difficulty,
  duration_sec,
  thumbnail_url,
  is_premium
)
SELECT 'Pressure Finish', '/assets/videos/sparring/sparring_intermediate_straight_03.mp4', 'straight', 'intermediate', 7.80, '/assets/images/player/intermediate.png', FALSE
WHERE NOT EXISTS (SELECT 1 FROM attack_videos WHERE title = 'Pressure Finish');

INSERT INTO attack_videos (
  title,
  file_path,
  attack_type,
  difficulty,
  duration_sec,
  thumbnail_url,
  is_premium
)
SELECT 'Duck and Hook', '/assets/videos/sparring/sparring_advanced_hook_02.mp4', 'hook', 'advanced', 8.70, '/assets/images/player/advanced.png', TRUE
WHERE NOT EXISTS (SELECT 1 FROM attack_videos WHERE title = 'Duck and Hook');

INSERT INTO attack_videos (
  title,
  file_path,
  attack_type,
  difficulty,
  duration_sec,
  thumbnail_url,
  is_premium
)
SELECT 'Angle Finish', '/assets/videos/sparring/sparring_advanced_hook_03.mp4', 'hook', 'advanced', 8.95, '/assets/images/player/advanced.png', TRUE
WHERE NOT EXISTS (SELECT 1 FROM attack_videos WHERE title = 'Angle Finish');

INSERT INTO attack_videos (
  title,
  file_path,
  attack_type,
  difficulty,
  duration_sec,
  thumbnail_url,
  is_premium
)
SELECT 'Combo Chain', '/assets/videos/sparring/sparring_pro_mixed_02.mp4', 'mixed', 'pro', 9.95, '/assets/images/player/pro.png', TRUE
WHERE NOT EXISTS (SELECT 1 FROM attack_videos WHERE title = 'Combo Chain');

INSERT INTO attack_videos (
  title,
  file_path,
  attack_type,
  difficulty,
  duration_sec,
  thumbnail_url,
  is_premium
)
SELECT 'Final Burst', '/assets/videos/sparring/sparring_pro_mixed_03.mp4', 'mixed', 'pro', 10.30, '/assets/images/player/pro.png', TRUE
WHERE NOT EXISTS (SELECT 1 FROM attack_videos WHERE title = 'Final Burst');

INSERT INTO attack_timestamps (
  video_id, impact_time, dodge_window_ms, hitbox_radius, attack_type, judge_shape, target_zone, required_move, min_displacement
)
SELECT id, 1.300, 540, 0.16, 'straight', 'lane', 'head', 'lean_back', 0.12
FROM attack_videos
WHERE title = 'Line Control'
AND NOT EXISTS (
  SELECT 1 FROM attack_timestamps WHERE video_id = attack_videos.id AND impact_time = 1.300
);

INSERT INTO attack_timestamps (
  video_id, impact_time, dodge_window_ms, hitbox_radius, attack_type, judge_shape, target_zone, required_move, min_displacement
)
SELECT id, 4.000, 500, 0.15, 'straight', 'lane', 'head', 'lean_back', 0.12
FROM attack_videos
WHERE title = 'Line Control'
AND NOT EXISTS (
  SELECT 1 FROM attack_timestamps WHERE video_id = attack_videos.id AND impact_time = 4.000
);

INSERT INTO attack_timestamps (
  video_id, impact_time, dodge_window_ms, hitbox_radius, attack_type, judge_shape, target_zone, required_move, min_displacement
)
SELECT id, 1.550, 520, 0.15, 'straight', 'lane', 'head', 'lean_back', 0.12
FROM attack_videos
WHERE title = 'Counter Straight'
AND NOT EXISTS (
  SELECT 1 FROM attack_timestamps WHERE video_id = attack_videos.id AND impact_time = 1.550
);

INSERT INTO attack_timestamps (
  video_id, impact_time, dodge_window_ms, hitbox_radius, attack_type, judge_shape, target_zone, required_move, min_displacement
)
SELECT id, 4.250, 480, 0.14, 'straight', 'lane', 'head', 'lean_back', 0.12
FROM attack_videos
WHERE title = 'Counter Straight'
AND NOT EXISTS (
  SELECT 1 FROM attack_timestamps WHERE video_id = attack_videos.id AND impact_time = 4.250
);

INSERT INTO attack_timestamps (
  video_id, impact_time, dodge_window_ms, hitbox_radius, attack_type, judge_shape, target_zone, required_move, min_displacement
)
SELECT id, 1.450, 560, 0.16, 'straight', 'lane', 'head', 'lean_back', 0.12
FROM attack_videos
WHERE title = 'Pressure Finish'
AND NOT EXISTS (
  SELECT 1 FROM attack_timestamps WHERE video_id = attack_videos.id AND impact_time = 1.450
);

INSERT INTO attack_timestamps (
  video_id, impact_time, dodge_window_ms, hitbox_radius, attack_type, judge_shape, target_zone, required_move, min_displacement
)
SELECT id, 4.450, 520, 0.15, 'straight', 'lane', 'head', 'lean_back', 0.12
FROM attack_videos
WHERE title = 'Pressure Finish'
AND NOT EXISTS (
  SELECT 1 FROM attack_timestamps WHERE video_id = attack_videos.id AND impact_time = 4.450
);

INSERT INTO attack_timestamps (
  video_id, impact_time, dodge_window_ms, hitbox_radius, attack_type, judge_shape, target_zone, required_move, min_displacement
)
SELECT id, 1.450, 480, 0.13, 'hook', 'ellipse', 'left_head', 'slip_side', 0.14
FROM attack_videos
WHERE title = 'Inside Hook'
AND NOT EXISTS (
  SELECT 1 FROM attack_timestamps WHERE video_id = attack_videos.id AND impact_time = 1.450
);

INSERT INTO attack_timestamps (
  video_id, impact_time, dodge_window_ms, hitbox_radius, attack_type, judge_shape, target_zone, required_move, min_displacement
)
SELECT id, 4.000, 450, 0.12, 'hook', 'ellipse', 'left_head', 'slip_side', 0.14
FROM attack_videos
WHERE title = 'Inside Hook'
AND NOT EXISTS (
  SELECT 1 FROM attack_timestamps WHERE video_id = attack_videos.id AND impact_time = 4.000
);

INSERT INTO attack_timestamps (
  video_id, impact_time, dodge_window_ms, hitbox_radius, attack_type, judge_shape, target_zone, required_move, min_displacement
)
SELECT id, 1.750, 460, 0.13, 'hook', 'ellipse', 'left_head', 'slip_side', 0.14
FROM attack_videos
WHERE title = 'Duck and Hook'
AND NOT EXISTS (
  SELECT 1 FROM attack_timestamps WHERE video_id = attack_videos.id AND impact_time = 1.750
);

INSERT INTO attack_timestamps (
  video_id, impact_time, dodge_window_ms, hitbox_radius, attack_type, judge_shape, target_zone, required_move, min_displacement
)
SELECT id, 4.350, 430, 0.12, 'hook', 'ellipse', 'left_head', 'slip_side', 0.14
FROM attack_videos
WHERE title = 'Duck and Hook'
AND NOT EXISTS (
  SELECT 1 FROM attack_timestamps WHERE video_id = attack_videos.id AND impact_time = 4.350
);

INSERT INTO attack_timestamps (
  video_id, impact_time, dodge_window_ms, hitbox_radius, attack_type, judge_shape, target_zone, required_move, min_displacement
)
SELECT id, 1.600, 450, 0.13, 'hook', 'ellipse', 'left_head', 'slip_side', 0.14
FROM attack_videos
WHERE title = 'Angle Finish'
AND NOT EXISTS (
  SELECT 1 FROM attack_timestamps WHERE video_id = attack_videos.id AND impact_time = 1.600
);

INSERT INTO attack_timestamps (
  video_id, impact_time, dodge_window_ms, hitbox_radius, attack_type, judge_shape, target_zone, required_move, min_displacement
)
SELECT id, 4.100, 420, 0.12, 'hook', 'ellipse', 'left_head', 'slip_side', 0.14
FROM attack_videos
WHERE title = 'Angle Finish'
AND NOT EXISTS (
  SELECT 1 FROM attack_timestamps WHERE video_id = attack_videos.id AND impact_time = 4.100
);

INSERT INTO attack_timestamps (
  video_id, impact_time, dodge_window_ms, hitbox_radius, attack_type, judge_shape, target_zone, required_move, min_displacement
)
SELECT id, 1.300, 430, 0.12, 'mixed', 'ellipse', 'body', 'duck', 0.16
FROM attack_videos
WHERE title = 'Pressure Mix'
AND NOT EXISTS (
  SELECT 1 FROM attack_timestamps WHERE video_id = attack_videos.id AND impact_time = 1.300
);

INSERT INTO attack_timestamps (
  video_id, impact_time, dodge_window_ms, hitbox_radius, attack_type, judge_shape, target_zone, required_move, min_displacement
)
SELECT id, 4.000, 380, 0.11, 'mixed', 'ellipse', 'body', 'duck', 0.16
FROM attack_videos
WHERE title = 'Pressure Mix'
AND NOT EXISTS (
  SELECT 1 FROM attack_timestamps WHERE video_id = attack_videos.id AND impact_time = 4.000
);

INSERT INTO attack_timestamps (
  video_id, impact_time, dodge_window_ms, hitbox_radius, attack_type, judge_shape, target_zone, required_move, min_displacement
)
SELECT id, 1.450, 410, 0.11, 'mixed', 'ellipse', 'body', 'duck', 0.16
FROM attack_videos
WHERE title = 'Combo Chain'
AND NOT EXISTS (
  SELECT 1 FROM attack_timestamps WHERE video_id = attack_videos.id AND impact_time = 1.450
);

INSERT INTO attack_timestamps (
  video_id, impact_time, dodge_window_ms, hitbox_radius, attack_type, judge_shape, target_zone, required_move, min_displacement
)
SELECT id, 4.100, 380, 0.10, 'mixed', 'ellipse', 'body', 'duck', 0.16
FROM attack_videos
WHERE title = 'Combo Chain'
AND NOT EXISTS (
  SELECT 1 FROM attack_timestamps WHERE video_id = attack_videos.id AND impact_time = 4.100
);

INSERT INTO attack_timestamps (
  video_id, impact_time, dodge_window_ms, hitbox_radius, attack_type, judge_shape, target_zone, required_move, min_displacement
)
SELECT id, 1.650, 400, 0.10, 'mixed', 'ellipse', 'body', 'duck', 0.16
FROM attack_videos
WHERE title = 'Final Burst'
AND NOT EXISTS (
  SELECT 1 FROM attack_timestamps WHERE video_id = attack_videos.id AND impact_time = 1.650
);

INSERT INTO attack_timestamps (
  video_id, impact_time, dodge_window_ms, hitbox_radius, attack_type, judge_shape, target_zone, required_move, min_displacement
)
SELECT id, 4.300, 360, 0.10, 'mixed', 'ellipse', 'body', 'duck', 0.16
FROM attack_videos
WHERE title = 'Final Burst'
AND NOT EXISTS (
  SELECT 1 FROM attack_timestamps WHERE video_id = attack_videos.id AND impact_time = 4.300
);
