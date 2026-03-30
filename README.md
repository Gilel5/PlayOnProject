# DataChat

Upload financial CSVs or PDFs and ask questions about your data in plain English. No SQL required.

---

## Features

- **Natural language queries** — ask questions directly against your uploaded financial data
- **Chat session management** — create, rename, pin, archive, and delete chat sessions
- **Full-text search** — search across all past and current chat sessions
- **File uploads** — CSV support, parsed directly into Supabase
- **Summary reports** — export multi-sheet `.xlsx` reports generated via pandas
- **Export chats** — download conversations as `.txt` or `.pdf`
- **Light & dark mode** — full Tailwind-based theme support throughout

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, Tailwind CSS, Lucide React |
| Backend | Python, FastAPI, Uvicorn, Pandas |
| Database | Supabase (PostgreSQL) |
| AI | OpenAI API |

---

## Project Structure

```
datachat-app/
├── frontend/
│   ├── src/
│   │   ├── api/                   # API service wrappers
│   │   ├── components/
│   │   │   ├── messages/          # User and bot message bubbles
│   │   │   ├── ChatArea.jsx       # Main chat interface
│   │   │   ├── Sidebar.jsx        # Session list and navigation
│   │   │   ├── SummaryReport.jsx  # Data visualization
│   │   │   ├── RightPanel.jsx     # Side analytics reporting panel
│   │   │   └── SettingsModal.jsx  # Settings layout and renaming
│   │   ├── pages/
│   │   │   ├── AppHome.jsx        # Central UI router shell
│   │   │   ├── Login.jsx          # Auth layouts
│   │   │   └── Register.jsx
│   │   └── App.jsx
│   ├── package.json
│   └── vite.config.js
└── backend/
    └── app/
        ├── api/
        │   ├── chat_sessions.py   # Historical DB routing
        │   └── routes/
        │       ├── chat.py        # LLM completion endpoint
        │       ├── auth.py        # API authentication keys
        │       └── upload.py      # File upload handling
        ├── core/
        │   └── config.py
        ├── models/                # Database ORM classes
        ├── schemas/               # Pydantic validation schemas
        ├── services/
        │   ├── openai_services.py # NLP integrations
        │   └── summary_report_services.py 
        └── main.py
```

---

## Setup

### Prerequisites

- Python 3.12+
- Node.js 18+
- [Supabase](https://supabase.com) project
- OpenAI API key

### Backend

```bash
cd backend
pip install -r requirements.txt
pip install "psycopg[binary]" "openai>=1.52.0" "httpx>=0.27.0"
cp .env.example .env
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## Environment Variables

Add a `.env` file to the `backend/` directory

See `.env.example` for reference

---

## Usage

1. Start the backend: `uvicorn app.main:app --reload` from `backend/`
2. Start the frontend: `npm run dev` from `frontend/`
3. Open `http://localhost:5173`
4. Upload a CSV or PDF using the paperclip in the chat input
5. Ask questions about your data
6. Use **Generate Report** to export an Excel summary
7. Use the right panel menu to export a chat as PDF