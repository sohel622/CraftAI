# CraftAI — AI Full-Stack App Builder (Backend)

Lovable-এর মতো একটা AI অ্যাপ বিল্ডারের ব্যাকএন্ড। তুমি প্রম্পট লেখো, **Google Gemini** পুরো প্রজেক্টের ফাইল বানায় বা আপডেট করে, সব কিছু **Supabase**-এ সেভ হয়, আর এক ক্লিকে **GitHub**-এ পুশ হয়।

The backend for a Lovable-style AI app builder: prompt → Gemini plans and writes files as structured JSON → changes are applied safely → saved in Supabase → synced with GitHub.

---

## Folder structure

```
CraftAI/
├── .env.example              # all environment variables (copy to .env)
├── package.json
├── supabase/
│   └── schema.sql            # tables, RLS policies, realtime - run once
├── src/
│   ├── server.js             # entry point (npm start)
│   ├── app.js                # Express app + routes
│   ├── config/env.js         # reads .env in ONE place
│   ├── ai/
│   │   ├── gemini.js         # Gemini API call + JSON validation
│   │   ├── prompts.js        # system instruction for the AI
│   │   ├── schema.js         # JSON shape the AI must return
│   │   └── stacks.js         # all 20 supported languages/frameworks
│   ├── services/
│   │   ├── fileOps.js        # safe create/update/delete of files
│   │   └── projectService.js # Supabase reads/writes
│   ├── lib/
│   │   ├── supabase.js       # Supabase client
│   │   ├── github.js         # push / pull with GitHub
│   │   └── errors.js         # one error type
│   ├── middleware/           # auth, validation, error handler
│   └── routes/               # generate, projects, github, meta
└── tests/                    # npm test (no real keys needed)
```

Every file is small so it is easy to edit on a phone.

## Supported stacks

| Group | Stack ids |
|---|---|
| Web frontend | `html`, `typescript`, `react`, `vue`, `nextjs`, `tailwind` |
| Backend | `node`, `python`, `php` |
| Database | `supabase_sql` |
| Mobile / systems / games | `java`, `kotlin`, `flutter`, `c`, `cpp`, `csharp`, `go`, `rust`, `swift`, `gdscript` |

To add a new one, add a single entry in `src/ai/stacks.js`.

---

## Setup (সেটআপ)

### 1. Supabase
1. Supabase Dashboard → **SQL Editor** → New query.
2. Paste everything from `supabase/schema.sql` → **Run**. (Running it again is safe.)
3. Project Settings → **API** → copy `Project URL`, `anon` key and `service_role` key.

### 2. Keys
- Gemini key: <https://aistudio.google.com/apikey>
- GitHub token: GitHub → Settings → Developer settings → **Fine-grained tokens** → only the repos you need → *Contents: Read and write*.

### 3. Environment
Copy `.env.example` to `.env` and fill the values. **Never push `.env`** — it is in `.gitignore`.
On hosting (Render / Railway / Vercel) put the same variables in the dashboard's *Environment* section instead.

### 4. Run
```bash
npm install
npm start          # http://localhost:3000
npm test           # 9 tests, no real keys needed
```
Check `GET /api/health` — it shows which services are ready (never the keys).

### Deploy from mobile (Render example)
1. Push this repo to GitHub.
2. render.com → New → **Web Service** → pick the repo.
3. Build command `npm install`, start command `npm start`.
4. Add the environment variables → Deploy.

---

## Authentication

The app signs the user in with Supabase Auth and sends
`Authorization: Bearer <supabase access_token>` on every request.
In `NODE_ENV=development` **without** Supabase configured, a local dev user is used so you can test quickly.

## API

All bodies are JSON. Errors always look like `{ "error": { "code", "message", "details" } }`.

| Method | Route | What it does |
|---|---|---|
| GET | `/api/health` | Which services are configured |
| GET | `/api/stacks` | List of supported stacks |
| POST | `/api/generate` | Prompt → Gemini → file changes |
| GET / POST | `/api/projects` | List / create projects |
| GET / PATCH / DELETE | `/api/projects/:id` | Read / update / delete a project |
| GET / PUT | `/api/projects/:id/files` | Read all files / replace all files |
| GET | `/api/projects/:id/history` | Chat / prompt history |
| GET | `/api/projects/:id/generations` | Past AI generations |
| GET | `/api/projects/:id/export` | Download project + files as JSON |
| POST | `/api/projects/:id/github/push` | Push all files to GitHub as one commit |
| POST | `/api/projects/:id/github/pull` | Import a repo's text files into the project |

### Generate example
```json
POST /api/generate
{
  "projectId": "uuid-of-project",
  "prompt": "একটা লগইন পেজ বানাও, Supabase auth দিয়ে",
  "stacks": ["react", "tailwind", "supabase_sql"],
  "dryRun": false
}
```
Response:
```json
{
  "plan": "...",
  "explanation": "LoginPage যোগ করা হয়েছে ...",
  "applied": [{ "path": "src/LoginPage.jsx", "action": "create" }],
  "skipped": [],
  "changedFiles": [{ "path": "src/LoginPage.jsx", "content": "..." }],
  "deletedPaths": [],
  "saved": true
}
```
- Without `projectId` it works stateless: send `files`, get changed files back, nothing saved.
- `dryRun: true` = preview only, nothing saved.

### How code stays safe
- Gemini must return JSON (`responseSchema`), and the server re-checks it with zod.
- Only the files Gemini lists are touched; all other files stay exactly as they were.
- Paths like `../`, absolute paths, `.git/` and `.env` files are rejected.
- Size and file-count limits come from `.env`.

### GitHub push body
```json
{ "message": "Add login page", "target": { "owner": "sohel622", "repo": "my-app", "branch": "main" } }
```
`target` is optional — the project's saved repo or the `.env` defaults are used.

## Security
- All keys come only from environment variables. Nothing is hardcoded.
- The Gemini key is sent in a header, never in the URL.
- `service_role` key stays on the server; every query is filtered by the signed-in user's id, and RLS is on for all tables.
