# Accounting App

Backend-first foundation for an accounting system built with `FastAPI`, `SQLAlchemy`, and MariaDB/MySQL.

## Requirements

- `Python 3.11+`
- MariaDB/MySQL database
- `Node.js` with `npm`
- `PowerShell` if you want to run the commands exactly as shown below

## Local Run

The project is split into:

- `backend/` - FastAPI API, business logic, SQLAlchemy models, and DB setup
- `frontend/` - React + Vite client
- `docs/` - architecture and domain notes

### 1. Backend setup

Open the first terminal in the repository root and run:

```powershell
cd ./backend
python -m venv .\.venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -e .
```

### 2. Database setup (`MariaDB/MySQL`)

The backend reads settings from `backend/.env`. `DATABASE_URL` is required and must point to MariaDB/MySQL:

```env
DATABASE_URL=mysql+aiomysql://user:password@host:3306/database_name
```

A plain `mysql://...` URL is also accepted by the app and converted to the async `mysql+aiomysql://...` dialect internally. Other database dialects are not supported.

Create or update the schema before starting the API:

```powershell
alembic upgrade head
```

Notes:

- `backend/.env` is not committed and should contain the real MariaDB credentials for the environment.
- Use `alembic upgrade head` for new databases and future schema changes.
- If you already have an existing MariaDB schema that predates Alembic revisions, use `alembic stamp head` once to mark the existing schema as current.

### 3. Start the backend

In the same terminal:

```powershell
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Useful URLs:

- API root: `http://127.0.0.1:8000`
- Healthcheck: `http://127.0.0.1:8000/health`
- Swagger UI: `http://127.0.0.1:8000/docs`

### 4. Start the frontend

Open a second terminal in the repository root and run:

```powershell
cd ./frontend
npm install
npm run dev
```

Open the app at `http://127.0.0.1:5173`.

The frontend uses `http://127.0.0.1:8000` as the default API base URL. If the backend is running elsewhere, create `frontend/.env.local` with:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

## Backend Layout

- `app/controllers` - HTTP entry points and route composition
- `app/models` - SQLAlchemy ORM models and domain enums
- `app/schemas` - Pydantic request/response schemas
- `app/services` - business workflows and orchestration
- `app/db` - database base class and session setup
- `app/core` - settings and shared infrastructure helpers

## Current Focus

- Company, client, counterparty, and banking reference models
- Normalized payments and settlement snapshots
- Client balance ledger and double-entry accounting layer
- MariaDB/MySQL-backed accounting workflows
