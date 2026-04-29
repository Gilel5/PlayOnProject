# Architecture Notes

DataChat is a decoupled full-stack application. The frontend and backend communicate via RESTful JSON APIs.

## Directory Structure

The repository is divided into two main environments: `frontend/` and `backend/`.

### Frontend Structure
The frontend is built with React and Vite. It is organized by feature and component type.

```
frontend/src/
├── api/                   # Axios instances and API service wrappers
├── components/
│   ├── chat/              # Core chat area, file upload UI, and PDF attachments
│   ├── layout/            # Application shell, Sidebar, and RightPanel analytics
│   ├── messages/          # User and Bot message bubbles, Interactive Chart components
│   └── modals/            # Report generation and Settings modals
├── pages/                 # Route-level components (AppHome, Login, Register)
├── utils/                 # Shared formatting and utility functions
└── App.jsx                # Root component and Context Providers
```

**Key Frontend Concepts:**
- **State Management:** Handled primarily via React Context (`DarkModeContext`) and local state hooks.
- **Data Visualization:** Built using `recharts`. The `ChartBlock` component dynamically renders Bar, Line, Area, or Pie charts based on JSON payloads returned by the backend.
- **PDF Export:** The chat history is exported to PDF by cloning the live DOM, replacing SVGs with solid colors to ensure compatibility, and printing to a Blob URL.

### Backend Structure
The backend is built with FastAPI and is structured using a domain-driven approach.

```
backend/app/
├── api/
│   ├── chat_sessions.py   # Historical DB routing
│   └── routes/
│       ├── auth.py        # API authentication keys and JWT logic
│       ├── chat.py        # LLM completion endpoints
│       └── upload.py      # CSV parsing, chunking, and database insertion
├── core/                  # Configuration and environment variables
├── models/                # Database ORM classes (SQLAlchemy/SQLModel)
├── schemas/               # Pydantic validation schemas
├── services/
│   ├── auth_services.py   # Authentication business logic
│   ├── chat_summary_services.py
│   ├── openai_services.py # Core NLP pipeline (Tree-of-Thoughts SQL generation)
│   └── summary_report_services.py # Pandas-based Excel report generation
└── main.py                # FastAPI application entry point
```

**Key Backend Concepts:**
- **NLP Pipeline:** When a user asks a question, `openai_services.py` uses a multi-step pipeline:
  1. Generate multiple candidate SQL queries (Tree-of-Thoughts approach).
  2. Evaluate and select the best query.
  3. Execute the query against a read-only Supabase connection.
  4. Pass the results to the LLM to generate a natural language summary.
  5. Pass the results to the LLM to generate a structured JSON chart specification.
- **File Uploads:** CSVs are parsed, chunked, and inserted into Supabase efficiently using batched inserts in `upload.py`.
- **Excel Reports:** `summary_report_services.py` uses Pandas to aggregate data and format it into multi-sheet `.xlsx` files with professional styling.

---

## Database Schema (Supabase)

The application relies on PostgreSQL (hosted by Supabase) with the following primary entities:

- **Users:** Managed by Supabase Auth.
- **Chat Sessions:** Groups of messages. Sessions can be pinned or archived.
- **Messages:** Individual chat bubbles. Stores text, sender role, and JSON-encoded `chart_data`.
- **Uploaded Data Tables:** Dynamically created or populated tables that store the user's uploaded CSV data for querying.
