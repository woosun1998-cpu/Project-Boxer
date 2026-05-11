# Sparring Video Samples

`POST /api/videos` 생성 엔드포인트는 현재 없습니다.  
지금은 아래 두 방식으로 사용하는 것이 맞습니다.

1. DB에 SQL로 `attack_videos`, `attack_timestamps` 삽입
2. 프론트는 `GET /api/videos`, `GET /api/videos/{id}` 응답을 읽어서 재생

## 1. SQL 샘플

실행 파일:

```text
backend/app/db/seed_sparring_videos.sql
```

등록되는 추천 파일 경로:

```text
/assets/videos/sparring-demo-vertical.mp4
/assets/videos/jab-round1.mp4
/assets/videos/hook-round1.mp4
/assets/videos/straight-round1.mp4
```

실제 파일은 아래 폴더에 있어야 합니다.

```text
frontend/assets/videos/
```

## 2. 미래의 생성 API용 JSON 샘플

나중에 `POST /api/videos` 를 만들면 이런 형태로 받는 것이 자연스럽습니다.

```json
{
  "title": "Jab Round 1",
  "file_path": "/assets/videos/jab-round1.mp4",
  "attack_type": "jab",
  "difficulty": "easy",
  "duration_sec": 7.2,
  "thumbnail_url": "/assets/images/logo.png",
  "is_premium": false,
  "timestamps": [
    {
      "impact_time": 1.35,
      "dodge_window_ms": 300,
      "hitbox_radius": 0.15,
      "attack_type": "jab"
    }
  ]
}
```

```json
{
  "title": "Hook Round 1",
  "file_path": "/assets/videos/hook-round1.mp4",
  "attack_type": "hook",
  "difficulty": "medium",
  "duration_sec": 8.4,
  "thumbnail_url": "/assets/images/logo.png",
  "is_premium": false,
  "timestamps": [
    {
      "impact_time": 2.85,
      "dodge_window_ms": 340,
      "hitbox_radius": 0.18,
      "attack_type": "hook"
    }
  ]
}
```

```json
{
  "title": "Straight Round 1",
  "file_path": "/assets/videos/straight-round1.mp4",
  "attack_type": "straight",
  "difficulty": "hard",
  "duration_sec": 9.1,
  "thumbnail_url": "/assets/images/logo.png",
  "is_premium": true,
  "timestamps": [
    {
      "impact_time": 3.1,
      "dodge_window_ms": 280,
      "hitbox_radius": 0.2,
      "attack_type": "straight"
    }
  ]
}
```

## 3. 현재 API 응답 예시

`GET /api/videos`

```json
{
  "success": true,
  "message": "Video list loaded successfully.",
  "data": [
    {
      "id": 1,
      "title": "Jab Round 1",
      "file_path": "/assets/videos/jab-round1.mp4",
      "attack_type": "jab",
      "difficulty": "easy",
      "duration_sec": 7.2,
      "thumbnail_url": "/assets/images/logo.png",
      "is_premium": false
    }
  ]
}
```

`GET /api/videos/1`

```json
{
  "success": true,
  "message": "Video detail loaded successfully.",
  "data": {
    "id": 1,
    "title": "Jab Round 1",
    "file_path": "/assets/videos/jab-round1.mp4",
    "attack_type": "jab",
    "difficulty": "easy",
    "duration_sec": 7.2,
    "thumbnail_url": "/assets/images/logo.png",
    "is_premium": false,
    "timestamps": [
      {
        "id": 1,
        "impact_time": 1.35,
        "dodge_window_ms": 300,
        "hitbox_radius": 0.15,
        "attack_type": "jab"
      }
    ]
  }
}
```
