-- ============================================
-- 0. DB 생성
-- ============================================
CREATE DATABASE IF NOT EXISTS boxer_db
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE boxer_db;

-- ============================================
-- 1. 회원
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  tier ENUM('free', 'premium') DEFAULT 'free',
  coins INT DEFAULT 0,
  injury_type VARCHAR(100),
  skill_level ENUM('beginner', 'intermediate', 'advanced') DEFAULT 'beginner',
  profile_image VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 2. 기초 복싱 튜토리얼
-- ============================================
CREATE TABLE IF NOT EXISTS boxing_tutorials (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(100) NOT NULL,
  description TEXT,
  target_pose_json JSON,
  video_url VARCHAR(255),
  thumbnail_url VARCHAR(255),
  difficulty_level INT DEFAULT 1,
  is_premium BOOLEAN DEFAULT FALSE,
  reward_exp INT DEFAULT 100,
  reward_coins INT DEFAULT 10,
  order_sequence INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 3. 유저 튜토리얼 진행도
-- ============================================
CREATE TABLE IF NOT EXISTS user_progress (
  user_id INT,
  tutorial_id INT,
  is_completed BOOLEAN DEFAULT FALSE,
  best_accuracy FLOAT,
  attempts INT DEFAULT 0,
  completed_at TIMESTAMP NULL,
  PRIMARY KEY (user_id, tutorial_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (tutorial_id) REFERENCES boxing_tutorials(id)
);

-- ============================================
-- 4. 공격 영상 메타데이터
-- ============================================
CREATE TABLE IF NOT EXISTS attack_videos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(100) NOT NULL,
  file_path VARCHAR(255) NOT NULL,
  attack_type VARCHAR(50),
  difficulty ENUM('easy', 'medium', 'hard', 'beginner', 'intermediate', 'advanced', 'pro') DEFAULT 'beginner',
  duration_sec DECIMAL(5,2),
  thumbnail_url VARCHAR(255),
  is_premium BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 5. 타임스탬프 회피 판정 데이터
-- ============================================
CREATE TABLE IF NOT EXISTS attack_timestamps (
  id INT AUTO_INCREMENT PRIMARY KEY,
  video_id INT NOT NULL,
  impact_time DECIMAL(6,3) NOT NULL,
  dodge_window_ms INT DEFAULT 300,
  hitbox_radius FLOAT DEFAULT 0.15,
  attack_type VARCHAR(30),
  judge_shape VARCHAR(20),
  target_zone VARCHAR(20),
  required_move VARCHAR(20),
  min_displacement FLOAT,
  FOREIGN KEY (video_id) REFERENCES attack_videos(id)
);

-- ============================================
-- 6. 훈련 세션
-- ============================================
CREATE TABLE IF NOT EXISTS training_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  session_type ENUM('tutorial', 'sparring', 'rehab') NOT NULL,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP NULL,
  total_score INT DEFAULT 0,
  max_combo INT DEFAULT 0,
  total_rounds INT DEFAULT 0,
  exp_earned INT DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ============================================
-- 7. 라운드 결과
-- ============================================
CREATE TABLE IF NOT EXISTS round_results (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  video_id INT NOT NULL,
  result ENUM('dodge', 'hit') NOT NULL,
  reaction_ms INT,
  score_earned INT DEFAULT 0,
  earned_score_per_attack INT DEFAULT 0,
  combo_at_time INT DEFAULT 0,
  attack_type VARCHAR(30),
  dodge_direction VARCHAR(30),
  accuracy_score INT NOT NULL DEFAULT 0,
  judge_label VARCHAR(20),
  outcome VARCHAR(20),
  nose_x FLOAT,
  nose_y FLOAT,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES training_sessions(id),
  FOREIGN KEY (video_id) REFERENCES attack_videos(id)
);

-- ============================================
-- 8. 리더보드 / 랭킹
-- ============================================
CREATE TABLE IF NOT EXISTS leaderboard (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  total_score BIGINT DEFAULT 0,
  max_combo INT DEFAULT 0,
  total_dodges INT DEFAULT 0,
  win_rate FLOAT DEFAULT 0.0,
  rank_tier ENUM('Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond') DEFAULT 'Bronze',
  rank_points INT DEFAULT 0,
  season INT DEFAULT 1,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ============================================
-- 9. 자세 교정 기록
-- ============================================
CREATE TABLE IF NOT EXISTS pose_corrections (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  pose_type VARCHAR(50),
  accuracy FLOAT,
  issue_type VARCHAR(100),
  feedback_message VARCHAR(255),
  severity ENUM('low', 'medium', 'high'),
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES training_sessions(id)
);

-- ============================================
-- 10. 상점 아이템
-- ============================================
CREATE TABLE IF NOT EXISTS shop_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  item_type ENUM('skin', 'tutorial', 'report', 'premium') NOT NULL,
  price_coins INT DEFAULT 0,
  thumbnail VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE
);

-- ============================================
-- 11. 유저 구매 내역
-- ============================================
CREATE TABLE IF NOT EXISTS user_purchases (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  item_id INT NOT NULL,
  purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (item_id) REFERENCES shop_items(id)
);
