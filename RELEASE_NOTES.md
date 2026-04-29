# Release Notes

## Version 1.0 (Initial Release)

DataChat v1.0 marks the primary initial release of the platform. This release introduces a fully functional natural language data analytics tool built with React, FastAPI, and OpenAI.

### New Software Features
- **Natural Language Data Analytics Pipeline**: Automatically translates plain English questions into optimized SQL queries to run against your financial datasets.
- **Dynamic Interactive Charting**: Real-time generation of Recharts-powered Bar, Line, Area, and Pie charts based on the queried data.
- **CSV Data Ingestion**: Seamless drag-and-drop or click-to-upload CSV parsing directly into the Supabase PostgreSQL backend, complete with progress tracking.
- **Excel Report Generation**: One-click generation of professional, multi-sheet `.xlsx` summary reports via Pandas.
- **Chat Session Management**: Complete control over chat histories with the ability to create, rename, pin, archive, and delete sessions.
- **Full-Text Search**: Instantly search across all historical chat sessions for past queries or data points.
- **Export Capabilities**: Export entire chat histories to standard `.txt` files or visually accurate `.pdf` documents.
- **Theming**: Comprehensive Light and Dark mode UI support using Tailwind CSS.

### Known Bugs and Defects
- **Large Dataset Upload Latency**: Uploading CSV files exceeding 5MB may take several seconds to chunk and insert into the database depending on network and Supabase connection speeds. There is currently no chunk-resume capability if the connection drops.
- **PDF Theme Inconsistencies**: PDF exports rely on a standard light-mode CSS structure for printability. Users operating in Dark Mode will see their charts exported with light backgrounds to ensure ink-friendly printing.
- **Token Limits on Massive Tables**: If a user asks a highly generic question that returns thousands of rows without natural limits, the LLM may exceed its context window when attempting to generate a conversational summary.
- **PDF Export Blank Charts**: Recharts SVG animation transitions prevent charts from fully rendering in the DOM before the PDF blob snapshot was taken, resulting in empty frames.
- **Pie Chart Rendering Bug**: Recharts `<Pie>` component disables animations, causing the chart to ignore `<Cell>` children and render as a single color.
