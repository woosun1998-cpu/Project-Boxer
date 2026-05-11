# FRONTEND_HANDOFF.md

## Purpose

This document is a handoff guide for Claude Code so frontend work can continue smoothly using the backend that has already been implemented in this project.

Read this together with:

- `CLAUDE.md`
- `FRONTEND.md`
- `backend/API_EXAMPLES.md`

---

## Current backend status

The FastAPI backend is running and Swagger has already been confirmed.

Verified:

- API server starts successfully
- Swagger UI opens at `http://localhost:8000/docs`
- Database health check works
- `GET /api/health/db` returns:

```json
{
  "status": "ok",
  "database": "connected"
}
```

This means frontend work can begin now.

---

## Backend base URL

Use this backend base URL during local frontend development:

```text
http://localhost:8000
```

Important:

- Protected endpoints require JWT
- Send JWT using `Authorization: Bearer <token>`
- CORS is already configured for common local origins including `localhost:5500`

---

## Main backend files created

### App entry and config

- `backend/main.py`
- `backend/app/config.py`
- `backend/app/database.py`

### Auth and user

- `backend/app/routers/auth.py`
- `backend/app/routers/users.py`
- `backend/app/services/auth_service.py`
- `backend/app/services/user_service.py`
- `backend/app/schemas/auth.py`
- `backend/app/utils/jwt.py`
- `backend/app/utils/security.py`
- `backend/app/utils/dependencies.py`

### Tutorials

- `backend/app/routers/tutorials.py`
- `backend/app/services/tutorial_service.py`
- `backend/app/models/tutorial.py`
- `backend/app/schemas/tutorial.py`

### Videos and sessions

- `backend/app/routers/videos.py`
- `backend/app/routers/sessions.py`
- `backend/app/services/session_service.py`
- `backend/app/models/video.py`
- `backend/app/models/session.py`
- `backend/app/schemas/video.py`

### Stats and leaderboard

- `backend/app/routers/stats.py`
- `backend/app/routers/leaderboard.py`
- `backend/app/services/stats_service.py`
- `backend/app/services/leaderboard_service.py`
- `backend/app/models/leaderboard.py`
- `backend/app/schemas/stats.py`
- `backend/app/schemas/leaderboard.py`

### Coaching and shop

- `backend/app/routers/coaching.py`
- `backend/app/routers/shop.py`
- `backend/app/services/coaching_service.py`
- `backend/app/services/gemini_service.py`
- `backend/app/services/shop_service.py`
- `backend/app/models/shop.py`
- `backend/app/schemas/coaching.py`
- `backend/app/schemas/shop.py`

### Health and test helpers

- `backend/app/routers/health.py`
- `backend/API_EXAMPLES.md`
- `backend/app/db/schema.sql`
- `backend/app/db/seed.sql`

---

## Recommended frontend implementation order

Claude Code should build the frontend in this order:

1. Auth pages
2. JWT storage and API helper
3. Dashboard bootstrap with current user data
4. Tutorial list/detail/completion flow
5. Sparring session flow
6. Stats and leaderboard screens
7. Shop and coaching screens

This order reduces confusion because auth and token handling unlock most of the app.

---

## Minimum frontend features ready to connect

### 1. Signup

`POST /api/auth/signup`

Body:

```json
{
  "username": "testuser",
  "email": "test@example.com",
  "password": "test12345"
}
```

Expected result:

- user is created
- JWT token is returned

### 2. Login

`POST /api/auth/login`

Body:

```json
{
  "email": "test@example.com",
  "password": "test12345"
}
```

Expected result:

- JWT token returned
- frontend should store token in localStorage

Recommended token key:

```text
boxer_token
```

### 3. Current user

`GET /api/users/me`

Use after login to restore session and fill dashboard/profile UI.

### 4. Update user

`PUT /api/users/me`

Example:

```json
{
  "injury_type": "left shoulder",
  "skill_level": "beginner",
  "profile_image": "/assets/images/profile-default.jpg"
}
```

### 5. Tutorial list

`GET /api/tutorials`

Use this for tutorial cards or list UI.

### 6. Tutorial detail

`GET /api/tutorials/{tutorial_id}`

Use this for a tutorial detail page or modal.

### 7. Tutorial completion

`POST /api/tutorials/{tutorial_id}/complete`

Example:

```json
{
  "accuracy": 87.5,
  "attempts": 3
}
```

### 8. User progress

`GET /api/users/me/progress`

Use this to show completed tutorials or progress bars.

### 9. Videos

`GET /api/videos`
`GET /api/videos/{video_id}`

Use these for sparring drill selection and playback metadata.

### 10. Sessions

`POST /api/sessions`
`POST /api/sessions/rounds`
`POST /api/sessions/pose-corrections`
`PUT /api/sessions/{session_id}/end`

These are the core game-tracking endpoints.

### 11. Stats and leaderboard

`GET /api/stats/me`
`GET /api/leaderboard`
`PUT /api/leaderboard/me`

Use these for dashboard and ranking UI.

### 12. Coaching and shop

`POST /api/coaching`
`GET /api/shop/items`
`POST /api/shop/purchase`

Use these after core gameplay UI is stable.

---

## Health endpoints

These are useful during frontend development:

- `GET /api/health`
- `GET /api/health/db`

If frontend calls fail, test these first.

---

## Suggested frontend API helper behavior

Claude Code should create a centralized API helper.

Recommended behavior:

- store base URL as `http://localhost:8000`
- automatically attach JWT from localStorage
- parse JSON responses
- handle `401` by redirecting to login or clearing token
- show user-friendly messages for `403`, `404`, `409`

Recommended localStorage key:

```text
boxer_token
```

---

## Recommended first real frontend screens

### Login page

Needs:

- email input
- password input
- submit to `/api/auth/login`
- save token
- redirect to dashboard

### Signup page

Needs:

- username
- email
- password
- submit to `/api/auth/signup`
- optionally auto-login using returned token

### Dashboard

Needs:

- fetch `/api/users/me`
- fetch `/api/stats/me`
- fetch `/api/users/me/progress`
- show quick links to tutorials, sparring, leaderboard, shop

### Tutorial list page

Needs:

- fetch `/api/tutorials`
- show title, difficulty, premium badge, rewards
- link to tutorial detail/start action

---

## Sample test sequence for Claude Code

When Claude Code begins frontend work, this is the easiest order for connection testing:

1. Login form -> `/api/auth/login`
2. Save JWT
3. Call `/api/users/me`
4. Call `/api/tutorials`
5. Call `/api/users/me/progress`
6. Build dashboard from those three requests

After that:

7. Create session with `/api/sessions`
8. Save round result
9. End session
10. Load `/api/stats/me`

---

## Important notes for Claude Code

- Backend is local and already working
- DB health has already been confirmed
- Swagger is available and usable
- Request examples are already prepared in `backend/API_EXAMPLES.md`
- Protected endpoints need Bearer token
- Frontend work can proceed now without waiting for more backend scaffolding

---

## Handoff summary

Claude Code can now move to frontend implementation safely.

Best next move:

- read `FRONTEND.md`
- use this handoff file
- connect login first
- then dashboard
- then tutorials

