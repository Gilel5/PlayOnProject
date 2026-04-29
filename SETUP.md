# Setup & Installation Guide

This guide will help you set up DataChat for local development. DataChat consists of a Vite/React frontend and a FastAPI/Python backend.

## Prerequisites

Before you begin, ensure you have the following installed:
- **Python 3.12+**
- **Node.js 18+**
- A **[Supabase](https://supabase.com)** project (for PostgreSQL and Authentication)
- An **OpenAI API key** (for natural language processing)

---

## Backend Setup

The backend handles API requests, database interactions, CSV parsing, and OpenAI integrations.

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **Create a virtual environment (optional but recommended):**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   pip install "psycopg[binary]" "openai>=1.52.0" "httpx>=0.27.0"
   ```

4. **Set up Environment Variables:**
   Copy the example environment file and fill in your credentials.
   ```bash
   cp .env.example .env
   ```
   *Make sure your `.env` includes your `SUPABASE_URL`, `SUPABASE_KEY`, and `OPENAI_API_KEY`.*

5. **Start the FastAPI server:**
   ```bash
   uvicorn app.main:app --reload
   ```
   The backend will now be running at `http://localhost:8000`.

---

## Frontend Setup

The frontend is a single-page React application powered by Vite.

1. **Navigate to the frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```
   The frontend will now be running at `http://localhost:5173`.

---

## Usage Workflow

1. Open `http://localhost:5173` in your browser.
2. Sign up or log in.
3. Click the **paperclip icon** in the chat input to upload a CSV file. Wait for the upload status bar to complete.
4. Begin asking natural language questions about your data (e.g., *"What is the monthly revenue trend?"*).
5. The bot will automatically generate markdown tables and interactive charts.
6. Use the **Generate Report** button to download a multi-sheet `.xlsx` summary.
7. Click the **More (⋯)** icon in the top right to export the current chat as a `.pdf` or `.txt`.
