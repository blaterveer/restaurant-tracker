# SC Culinary — Restaurant Project Dashboard

A single-page dashboard for tracking culinary projects across SC restaurant properties. Built as a self-contained HTML app with persistent data via [Supabase](https://supabase.com) and deployed automatically to [Netlify](https://netlify.com) on every push.

## Features

- **Project tracking** — add, edit, delete projects per restaurant with priority, due dates, category, type, and owner
- **Notes** — timestamped notes per project with author attribution, editable and deletable
- **Gantt view** — visual timeline grouped by restaurant, priority, or category
- **Admin panel** — manage restaurants, categories, types, and team members
- **Filters** — search, filter by category/priority/owner/status, and due-date toggles
- **Supabase backend** — all data persisted in a real Postgres database

## Tech Stack

| Layer | Tool |
|-------|------|
| Frontend | Vanilla HTML/CSS/JS (single file) |
| Database | Supabase (Postgres) |
| Hosting | Netlify (auto-deploy from GitHub) |

## Environment Variables

Set these in Netlify (Site settings → Environment variables) before deploying:

```
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

These are injected at deploy time via `netlify.toml` into the HTML.

## Local Development

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Log in
netlify login

# Run locally (injects env vars from .env)
netlify dev
```

Create a `.env` file locally:
```
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

## Supabase Schema

See [SCHEMA.sql](./SCHEMA.sql) for the full table definitions.

Tables:
- `restaurants` — list of restaurant names
- `categories` — project category options
- `types` — project type options
- `owners` — team member names
- `projects` — core project records
- `notes` — project notes with `project_id` foreign key
