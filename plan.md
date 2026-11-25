# TaskFlow implementation plan

## Architecture and structure

TaskFlow is a single-process Node.js application: Express serves the static vanilla frontend from `public/` and exposes JSON REST endpoints under `/api/tasks`. `src/task-store.js` owns validation, task normalization, and safe JSON-file persistence in `data/tasks.json`; `server.js` owns HTTP routes and middleware. The browser UI in `public/index.html`, `public/css/style.css`, and `public/js/app.js` loads current records through the API, renders dashboard metrics and task cards, and implements add/edit/delete, status toggles, search, filters, and sorting without a frontend framework. The README documents Windows/PowerShell setup, API behavior, folder structure, and screenshot contribution. `npm start` runs the app at port 3000 (or `PORT`).

```text
 taskflow/
 ├── public/                 Static browser app
 │   ├── index.html          Dashboard shell and accessible forms
 │   ├── css/style.css       Responsive visual design
 │   └── js/app.js           API client, UI state, interactions
 ├── data/tasks.json         Persistent JSON-file task collection
 ├── src/task-store.js       File I/O, validation, CRUD primitives
 ├── server.js               Express app and REST API
 ├── package.json            Minimal runtime scripts/dependencies
 ├── .gitignore              Generated/local exclusions
 ├── README.md               Setup, API and submission guide
 └── plan.md / TODO.md       Project plan and acceptance outcomes
```

## Design

Three visual directions considered: editorial productivity desk (0.06), restrained pastel SaaS (0.07), and monochrome terminal utility (0.05). Chosen: **editorial productivity desk**. It pairs warm paper neutrals and ink with an ownable deep teal accent, legible system typography, compact top-level navigation, a narrow left rail on wide screens, and a broad working canvas rather than a centered grid. Four crisp metric tiles, a calm progress track, compact task cards, and a high-contrast date/status chip provide signature motifs. The UI is quiet, purposeful, and generous with spacing; motion is limited to short hover/focus transitions and reduced-motion is respected. Wordmark concept: a custom rounded square containing a three-line checkmark/list mark beside “TaskFlow.” Brand essence: a dependable daily command center for students and individuals; clear, calm, capable. Voice: direct and encouraging (“Make room for what matters.”; “One task at a time.”). Every control has a clear label, visible keyboard focus, and immediate feedback.

## Implementation decisions

Tasks use UUIDs, ISO timestamps, title (required), description, optional ISO due date, priority (`high|medium|low`), and status (`pending|completed`). JSON persistence writes a complete updated file through a temporary file followed by rename. Invalid requests receive structured JSON errors and meaningful status codes; missing task IDs return 404. A lightweight seeded empty array keeps first-run behavior deterministic. No account system or external database is required. Search/filter/sort are client-side over the API-loaded records; all mutations are persisted server-side and refresh the dashboard from the returned/latest collection.
