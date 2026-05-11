-- Restore premium gating for sparring advanced/pro clips after testing.

UPDATE attack_videos
SET is_premium = TRUE
WHERE difficulty IN ('advanced', 'pro');
