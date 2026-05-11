UPDATE boxing_tutorials
SET video_url = '/assets/videos/tutorial-level1-stance.mp4'
WHERE title LIKE 'LEVEL 1-1:%'
   OR title LIKE '%Boxing Stance%';

UPDATE boxing_tutorials
SET video_url = '/assets/videos/tutorial-level1-jab.mp4'
WHERE title LIKE 'LEVEL 1-2:%'
   OR title LIKE '%Jab%';

UPDATE boxing_tutorials
SET video_url = '/assets/videos/tutorial-level2-straight.mp4'
WHERE title LIKE 'LEVEL 2-1:%'
   OR title LIKE '%Straight%'
   OR title LIKE '%Cross%';

UPDATE boxing_tutorials
SET video_url = '/assets/videos/tutorial-level2-hook.mp4'
WHERE title LIKE 'LEVEL 2-2:%'
   OR title LIKE '%Hook%';

UPDATE boxing_tutorials
SET video_url = '/assets/videos/tutorial-level3-ducking.mp4'
WHERE title LIKE 'LEVEL 3-1:%'
   OR title LIKE '%Duck%'
   OR title LIKE '%Weav%';

UPDATE boxing_tutorials
SET video_url = '/assets/videos/tutorial-level3-combo.mp4'
WHERE title LIKE 'LEVEL 3-2:%'
   OR title LIKE '%Combo%'
   OR title LIKE '%Counter%';
