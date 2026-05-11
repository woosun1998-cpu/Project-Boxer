-- ============================================================
-- migrate_sparring_beginner_entry.sql
-- 목적: 'Beginner Jab Flow'(파일 없음)를 실제 영상 파일과 맞게
--       'Entry Jab' 으로 정정하고, 타임스탬프 2개를 추가한다.
-- ============================================================

-- 1) 영상 레코드 정정
UPDATE attack_videos
SET
  title        = 'Entry Jab',
  file_path    = '/assets/videos/sparring/sparring_beginner_jab_01.mp4',
  attack_type  = 'jab',
  difficulty   = 'beginner',
  duration_sec = 6.00,
  thumbnail_url = '/assets/images/player/beginner.png',
  is_premium   = FALSE
WHERE title = 'Beginner Jab Flow';

-- 2) 이미 'Entry Jab' 으로 존재하면 파일 경로만 보정
UPDATE attack_videos
SET
  file_path    = '/assets/videos/sparring/sparring_beginner_jab_01.mp4',
  thumbnail_url = '/assets/images/player/beginner.png'
WHERE title = 'Entry Jab'
  AND file_path != '/assets/videos/sparring/sparring_beginner_jab_01.mp4';

-- 3) 'Entry Jab' 이 아직 없을 경우만 INSERT
INSERT INTO attack_videos (
  title, file_path, attack_type, difficulty, duration_sec, thumbnail_url, is_premium
)
SELECT
  'Entry Jab',
  '/assets/videos/sparring/sparring_beginner_jab_01.mp4',
  'jab',
  'beginner',
  6.00,
  '/assets/images/player/beginner.png',
  FALSE
WHERE NOT EXISTS (
  SELECT 1 FROM attack_videos WHERE title = 'Entry Jab'
);

-- 4) 타임스탬프 추가 (1타 · 2타)
-- 초급: 허용 창 넓게(680ms), 히트박스 크게(0.22), 동작 slip_side
INSERT INTO attack_timestamps (
  video_id, impact_time, dodge_window_ms, hitbox_radius,
  attack_type, judge_shape, target_zone, required_move, min_displacement
)
SELECT id, 1.150, 680, 0.22, 'jab', 'circle', 'head', 'slip_side', 0.09
FROM attack_videos
WHERE title = 'Entry Jab'
AND NOT EXISTS (
  SELECT 1 FROM attack_timestamps WHERE video_id = attack_videos.id AND impact_time = 1.150
);

INSERT INTO attack_timestamps (
  video_id, impact_time, dodge_window_ms, hitbox_radius,
  attack_type, judge_shape, target_zone, required_move, min_displacement
)
SELECT id, 3.400, 650, 0.22, 'jab', 'circle', 'head', 'slip_side', 0.09
FROM attack_videos
WHERE title = 'Entry Jab'
AND NOT EXISTS (
  SELECT 1 FROM attack_timestamps WHERE video_id = attack_videos.id AND impact_time = 3.400
);
