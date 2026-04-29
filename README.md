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
- **Light & dark mode** — full Tailwind-based theme support throughout

---

## Documentation

We have split the documentation into specific guides for easier reading:

- **[Setup & Installation Guide](SETUP.md)**: Step-by-step instructions for running DataChat locally, including environment variables and database setup.
- **[Architecture Notes](ARCHITECTURE.md)**: An overview of the project's structure, technology stack, and how the frontend and backend communicate.
- **[Detailed Design Document](Detailed%20Design%20Document.pdf)**: A detailed report into the design decisions and backend functionality.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React, Vite, Tailwind CSS, Recharts, Lucide React |
| **Backend** | Python, FastAPI, Uvicorn, Pandas |
| **Database** | Supabase (PostgreSQL) |
| **AI** | OpenAI API (GPT-4o) |
