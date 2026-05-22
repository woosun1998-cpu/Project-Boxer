# Boxer Backend

This folder contains the FastAPI backend scaffold for the Boxer project.

## Quick start

1. Create a virtual environment.
2. Install dependencies from `requirements.txt`.
3. Fill in `backend/.env` with your MySQL connection info.
4. Run `python scripts/init_db.py`.
5. Start the API with `uvicorn main:app --reload`.

## Python version note

This project is most stable on Python 3.11 or 3.12.
If you use Python 3.14, use the newer Pydantic versions already pinned in `requirements.txt`.

## Database bootstrap

You can initialize the database structure with:

`python scripts/init_db.py`

The script creates the configured MySQL database when it does not exist yet,
then creates all SQLAlchemy tables required by signup and the rest of the API.

## Useful checks

- `GET /api/health`
- `GET /api/health/db`

## Swagger testing help

Sample Swagger request bodies are in `API_EXAMPLES.md`.

## Auth endpoints

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/users/me`
- `PUT /api/users/me`
- `GET /api/users/me/progress`
- `GET /api/tutorials`
- `GET /api/tutorials/{tutorial_id}`
- `POST /api/tutorials/{tutorial_id}/complete`
- `GET /api/videos`
- `GET /api/videos/{video_id}`
- `POST /api/sessions`
- `PUT /api/sessions/{session_id}/end`
- `POST /api/sessions/rounds`
- `POST /api/sessions/pose-corrections`
- `GET /api/stats/me`
- `GET /api/leaderboard`
- `PUT /api/leaderboard/me`
- `POST /api/coaching`
- `GET /api/shop/items`
- `POST /api/shop/purchase`

## Docker

From the `backend/docker` folder:

`docker compose up --build`

## Typical flow

1. Sign up with username, email, and password.
2. Receive a JWT token in the response.
3. Send that token in the `Authorization: Bearer <token>` header.
4. Call `GET /api/users/me` to confirm the logged-in user.
5. Load tutorials, complete them, and read progress history for the current user.

## Notes

- On API startup, the backend also runs automatic table creation, so a fresh database is prepared before the first signup request.
- If MySQL itself is not running, start your local MySQL server first and keep the credentials in `backend/.env` in sync.
