# Boxer API Examples

This file shows simple request bodies you can copy into Swagger UI.

## 1. Sign up

`POST /api/auth/signup`

```json
{
  "username": "testuser",
  "email": "test@example.com",
  "password": "test12345"
}
```

## 2. Login

`POST /api/auth/login`

```json
{
  "email": "test@example.com",
  "password": "test12345"
}
```

After login, copy the `token` and use it in Swagger `Authorize`:

```text
Bearer YOUR_TOKEN_HERE
```

## 3. Update current user

`PUT /api/users/me`

```json
{
  "injury_type": "left shoulder",
  "skill_level": "beginner",
  "profile_image": "/assets/images/profile-default.jpg"
}
```

## 4. Complete tutorial

`POST /api/tutorials/1/complete`

```json
{
  "accuracy": 87.5,
  "attempts": 3
}
```

## 5. Start session

`POST /api/sessions`

```json
{
  "session_type": "sparring"
}
```

## 6. Save round result

`POST /api/sessions/rounds`

```json
{
  "session_id": 1,
  "video_id": 1,
  "result": "dodge",
  "reaction_ms": 342,
  "score_earned": 120,
  "combo_at_time": 2,
  "nose_x": 0.48,
  "nose_y": 0.31
}
```

## 7. Save pose correction

`POST /api/sessions/pose-corrections`

```json
{
  "session_id": 1,
  "pose_type": "guard",
  "accuracy": 78.5,
  "issue_type": "hands_too_low",
  "feedback_message": "Raise your lead hand closer to your cheek.",
  "severity": "medium"
}
```

## 8. End session

`PUT /api/sessions/1/end`

```json
{
  "total_score": 1200,
  "max_combo": 5,
  "total_rounds": 8,
  "exp_earned": 150
}
```

## 9. Update leaderboard

`PUT /api/leaderboard/me`

```json
{
  "total_score": 1200,
  "max_combo": 5,
  "total_dodges": 6,
  "win_rate": 0.75
}
```

## 10. Purchase item

`POST /api/shop/purchase`

```json
{
  "item_id": 1,
  "payment_type": "coin"
}
```
