-- Temporary test unlock for sparring advanced/pro clips.
-- Revert with the matching restore SQL after testing if needed.

UPDATE attack_videos
SET is_premium = FALSE
WHERE difficulty IN ('advanced', 'pro');
