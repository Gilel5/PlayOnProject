# Install Guide

This document details the exact procedures required to acquire, configure, build, and run the DataChat application.

## 1. Pre-requisites

Before you begin the installation process, you must ensure that your system has the following software installed:

- **Python 3.12+**: Required for the FastAPI backend. [Download Python here](https://www.python.org/downloads/).
- **Node.js 18+ (and npm)**: Required to build and run the React frontend. [Download Node.js here](https://nodejs.org/en/download/).
- **Git**: Required to clone the repository. [Download Git here](https://git-scm.com/downloads).
- **Supabase Account**: You must have an active Supabase project to host the PostgreSQL database and handle Authentication. [Create a Supabase account here](https://supabase.com).
- **OpenAI API Key**: Required for the Natural Language Processing pipeline. [Get an OpenAI API key here](https://platform.openai.com/).

## 2. Download Instructions

To get access to the project source code, clone the GitHub repository to your local machine using your terminal:

```bash
git clone https://github.com/Gilel5/PlayOnProject.git
cd PlayOnProject/datachat-app
```

## 3. Dependent Libraries

The application relies on specific Python and Node libraries to function.

### Backend Dependencies (Python)
The backend dependencies are listed in `backend/requirements.txt`. Key third-party software includes:
- `fastapi` and `uvicorn` for the web server.
- `openai` (>=1.52.0) for LLM integration.
- `psycopg[binary]` for PostgreSQL database connections.
- `pandas` for Excel report generation.

### Frontend Dependencies (Node)
The frontend dependencies are managed via `package.json`. Key software includes:
- `react` and `react-dom` for the UI.
- `recharts` for interactive data visualizations.
- `vite` for the build tooling.
- `tailwindcss` for styling.

## 4. Installation of Actual Application

The application is split into two directories: `frontend` and `backend`. You must configure both.

### Backend Installation
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment (highly recommended):
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows use: venv\Scripts\activate
   ```
3. Install all dependent libraries:
   ```bash
   pip install -r requirements.txt
   pip install "psycopg[binary]" "openai>=1.52.0" "httpx>=0.27.0"
   ```
4. Set up your environment variables by copying the example file:
   ```bash
   cp .env.example .env
   ```
   **Crucial Step:** Open the `.env` file in a text editor and fill in your `SUPABASE_URL`, `SUPABASE_KEY`, and `OPENAI_API_KEY`.

### Frontend Installation & Build Instructions
1. Open a new terminal window and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install all node modules and dependent libraries:
   ```bash
   npm install
   ```

## 5. Run Instructions

To get the software to execute, you must run both the backend API and the frontend web server concurrently.

**Terminal 1 (Backend):**
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm run dev
```

Once both servers are running, open your web browser and navigate to:
**http://localhost:5173**

## 6. Troubleshooting

**Error:** `psycopg2.OperationalError: FATAL: password authentication failed` or `Connection refused`
- **Corrective Action:** Your `.env` file contains an incorrect `SUPABASE_URL` or `SUPABASE_KEY`. Verify your database credentials in your Supabase project dashboard and ensure your IP is not blocked.

**Error:** `Error: Cannot find module 'react'` when running `npm run dev`
- **Corrective Action:** The Node dependencies were not installed. Ensure you are in the `frontend/` directory and run `npm install` again.

**Error:** The chat interface loads but the bot responds with a `500 Internal Server Error`.
- **Corrective Action:** This typically indicates an invalid or missing `OPENAI_API_KEY`. Check your backend terminal logs for "AuthenticationError". Ensure your `.env` file has a valid OpenAI key with available billing credits.

**Error:** `ModuleNotFoundError: No module named 'fastapi'`
- **Corrective Action:** Your Python virtual environment is not activated. Run `source venv/bin/activate` and try starting the backend again.
