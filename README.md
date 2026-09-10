# SWAT Planner

Resource timeline planner for SWAT teams. Assign people to projects and see calendar duration scale with FTE capacity.

**Complexity is a label only** - it does not affect duration. Duration comes from **effort x assignee FTEs** only.

## Working-day constants

| Unit | Working days |
|------|----------------|
| 1 day | 1 |
| 1 week | **5** |
| 1 month | **20** |

Weekends (Saturday / Sunday) are skipped when mapping calendar working days onto dates.

## Duration formula

1. Convert effort to working days:
   - `days` -> amount as-is
   - `weeks` -> amount x 5
   - `months` -> amount x 20

2. Multi-assign is **parallel**. Sum assignee FTEs:

   ```
   calendar_working_days = effort_working_days / (f1 + f2 + ...)
   ```

   Example: 10 days effort, Alice 1.0 FTE + Bob 0.5 FTE -> `10 / 1.5 ~ 6.67` calendar working days. The same calendar span is shown on each assignee's row.

3. End date = start date + `calendar_working_days` working days (skip Sat/Sun).

**Complexity** (`Low` / `Medium` / `High` / `Critical`) is display-only metadata.

## Stack

- **server/** - Express + better-sqlite3 (SQLite file under `server/data/swat.db`)
- **client/** - Vite + React + TypeScript + @dnd-kit
- REST: `/api/people`, `/api/projects`, `/api/assignments`
- Seeds ~6 people and sample projects/assignments on first boot if empty
- No auth in v1

## Install

```bash
npm install
```

## Development

Runs API on port **3010** and Vite on **5173** (proxies `/api` to the server):

```bash
npm run dev
```

Open http://localhost:5173

## Production

```bash
npm run build
npm start
```

Serves the built client from Express on port **3010** (or `PORT`).

## API overview

| Method | Path | Notes |
|--------|------|--------|
| GET/POST | `/api/people` | CRUD people (`name`, optional `role`, `fte` 0-1, default 1) |
| GET/PUT/DELETE | `/api/people/:id` | |
| GET/POST | `/api/projects` | `title`, `complexity`, `effort_amount`, `effort_unit`, optional `notes`/`colour` |
| GET/PUT/DELETE | `/api/projects/:id` | |
| GET/POST | `/api/assignments` | Assign project -> people with `start_date` |
| PUT/DELETE | `/api/assignments/:id` | Reassign / move start |
| GET | `/api/timeline` | People + computed bars (calendar duration) |

## Timeline UX

- Rows = people; X axis = time
- Bar length = FTE-scaled calendar duration
- Drag bar horizontally to change start date
- Drag bar to another person's row to reassign (updates that assignment's person; multi-assign bars share the project's calendar span)

## License

Private - miksmitty/swat-planner
