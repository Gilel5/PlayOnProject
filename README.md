# DataChat

Upload financial CSVs or PDFs and ask questions about your data in plain English. No SQL required.

---

## Overview

DataChat is a full-stack web application designed to help users instantly analyze and visualize their financial data through natural language. By combining the power of Large Language Models with structured database querying, DataChat allows users to upload datasets and immediately begin asking analytical questions, generating dynamic charts, and exporting professional reports.

## Features

- **Natural language queries** — ask questions directly against your uploaded financial data
- **Dynamic Charting** — automatic generation of interactive Bar, Line, Area, and Pie charts
- **Chat session management** — create, rename, pin, archive, and delete chat sessions
- **Full-text search** — search across all past and current chat sessions
- **File uploads** — CSV support, parsed directly into Supabase with upload progress tracking
- **Summary reports** — export multi-sheet `.xlsx` reports generated via pandas
- **Export chats** — download conversations as `.txt` or `.pdf`
- **Visualization** - each query provides a chart to supplement the insights
- **Light & dark mode** — full Tailwind-based theme support throughout

---

## Release Information (v1.0)

DataChat v1.0 is the initial release of the platform! We've introduced a complete natural language analytics pipeline, dynamic interactive charting, and full-text search capabilities for your financial data.

For a comprehensive list of features, bug fixes, and known defects in this version, please see our **[Release Notes](RELEASE_NOTES.md)**.

---

## Install Guide (Quickstart)

This is a brief overview to get you up and running quickly. **For the full, detailed prerequisites, dependency lists, and troubleshooting steps, please read the [Complete Install Guide](INSTALL_GUIDE.md).**

1. **Clone the repository:** `git clone https://github.com/Gilel5/PlayOnProject.git`
2. **Setup Backend:** 
   Navigate to `backend/`, install dependencies with `pip install -r requirements.txt`, configure your `.env` (Supabase/OpenAI keys), and run `uvicorn app.main:app --reload`.
3. **Setup Frontend:** 
   Navigate to `frontend/`, run `npm install`, and start the app with `npm run dev`.
4. Open your browser to `http://localhost:5173`.

---

## Documentation Links

- **[Install Guide](INSTALL_GUIDE.md)**: Detailed instructions for prerequisites, configuration, and troubleshooting.
- **[Release Notes](RELEASE_NOTES.md)**: Detailed version history, new features, and known bugs.
- **[Architecture Notes](ARCHITECTURE.md)**: An overview of the project's structure, technology stack, and backend flow.
- **[Detailed Design Document](Detailed%20Design%20Document.pdf)**: A detailed report into the design decisions and backend functionality.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React, Vite, Tailwind CSS, Recharts, Lucide React |
| **Backend** | Python, FastAPI, Uvicorn, Pandas |
| **Database** | Supabase (PostgreSQL) |
| **AI** | OpenAI API (GPT-4o) |
