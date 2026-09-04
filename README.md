# prj-DSA — DSA·400 Consistency Engine + Pattern Master

One **React (Vite) + Supabase** website that merges two projects into a single product:

1. **DSA·400 Tracker** — a 400-day, 3-phase plan for Data Structures & Algorithms, gamified
   around a GitHub-style "don't break the chain" commitment. Emerald theme, dark mode only.
2. **Pattern Master** — a faithful port of `dsa_Patterns_new.html`, the 40-pattern
   DSA playbook (cyan theme). Every question is cross-referenced into the 400-day plan.

> Deployed at **https://dsa-400.vercel.app**

---

## Table of contents

- [What it does](#what-it-does)
- [Routes](#routes)
- [Feature list](#feature-list)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Data model (Supabase)](#data-model-supabase)
- [Security model](#security-model)
- [The commitment & verification flow](#the-commitment--verification-flow)
- [Included vs optional (how customization works)](#included-vs-optional-how-customization-works)
- [Getting started (local)](#getting-started-local)
- [Deploying (Supabase + Vercel)](#deploying-supabase--vercel)
- [Demo mode](#demo-mode)
- [Scripts](#scripts)

---

## What it does

- You **commit** to 400 days of DSA. Onboarding asks for a **permanent start date** and a
  **statement of commitment**.
- The app lays out all 400 days onto a real calendar, anchored to that start date.
- Every day has a concept and a question set. Tick every question and **seal** the day —
  only sealed days count toward your streak and progress.
- A **chain** (GitHub contribution style) visualises your consistency.
- You can fully **customize** the plan: make whole weeks/days optional, remove questions,
  and import your own LeetCode / Codeforces / GFG / CSES / SPOJ / AtCoder questions.
- Your commitment is sealed into a **SHA-512 hash** and a downloadable **certificate image**
  with a QR code. Anyone who scans it can verify your *consistency* (not your private statement).
- A **Pattern Master** reference is built in, linked bidirectionally to the plan.

---

## Routes

| Route | Access | What |
|---|---|---|
| `/login`, `/register` | public | Email/password + **GitHub OAuth** sign-in |
| `/onboarding` | signed-in, not committed | Start date → statement → topic selection → commitment card |
| `/` | signed-in | The **DSA·400 tracker** (hero/chain, today, calendar, plan, progress) |
| `/questions` | public | Browse **every week and every question** before committing |
| `/profile` | signed-in | Identity, certificate, stats, import, **full plan editor**, extras manager, removed log |
| `/patterns` | signed-in | **Pattern Master** (40 patterns, cyan theme) |
| `/hash/:hash` | see below | Commitment verification (owner vs public) |
| `/note` | signed-in | **Daily Coding Article & Note Page** (orange/ember theme) |
| `/note/:slug` | public | Published article (read-only, rendered from Markdown + JSON) |
| `/file` | signed-in | Raw append-only event ledger (JSON export) |

---

## Feature list

### Tracker dashboard (`/`)
- Hero with live stats: days sealed `/400`, questions solved, current & best streak.
- Slim horizontal **chain** — click any cell to open that day.
- **Today's radar** — the day's question set, one-tap solve ticks, notes with a full edit
  **timeline**, and the **Seal day** button.
- **Calendar** — the 400-day plan projected onto real dates; sealed glow, missed fade, future locked.
- **The plan** — searchable/filterable week list with per-day, per-question controls.
- **Progress** — analytics, extra questions, and the removed-items log.

### Customization & the pointer
- Every week shows `X included · Y optional` (see [Included vs optional](#included-vs-optional-how-customization-works)).
- Make a week or a single day **optional**, remove any question (it stays logged so you can
  restore it), and add your own questions to any day.
- The **pointer** (your "current day") is always the first *included, unsealed* day — so if you
  remove today or a whole week, the tracker **moves forward automatically**. You can also jump
  to any day from the day-nav or from **Profile → Save & jump**.

### Profile (`/profile`)
- Identity hero (avatar, username, email, `DSA400xxxxxxx` commitment-id, dates, current day).
- Live **certificate** with download (progress updates daily).
- Stats + pace analysis (ahead/behind, projected finish date).
- **Import questions** — paste LeetCode numbers, links from any platform, or `{link:Name:Question-no}`.
  - `460` → resolves to **LFU Cache : 460** with the real LeetCode link (full 4,042-problem index).
  - Live preview shows what each line resolves to before you import.
- **Extras manager** — reschedule, mark done, save-for-later, delete.
- **Plan editor** — week → day → question. Toggle days, remove/add questions per day, with a
  **Save & jump** button that takes you to your new current day in the tracker.
- Removed-questions log with restore.

### Search (`⌕`, opens from the nav)
- Search by question name **or LeetCode number**.
- `452` instantly shows **452 · Minimum Number of Arrows to Burst Balloons** wherever it lives
  in your 400 days (which day, or "covered in Pattern Master", or "your extra").
- Backed by a **complete LeetCode index** (every problem: number → title + link) plus a
  **complete plan cross-reference** (every LeetCode-linked question in the 400-day plan → its
  day). No redundancy: a problem already in the plan is shown as *found*, never offered as an import.
- If a brand-new number isn't in the bundled index, it falls back to the live
  `https://leetcode.com/api/problems/all/` API (fetched once, cached in memory).
- If it's genuinely not in your plan, you get a one-tap **Add** with an optional **schedule day**.

### Commitment certificate (image)
Contains **only**: start date, end date (stacked vertically), SHA-512 hash, QR code,
username, and the `DSA400xxxxxxx` commitment-id.
- **Never** shows the commitment statement, and never shows the hash URL as text.
- First download (no progress yet) shows a **motivational quote**.
- Later downloads show a **live progress band** (days sealed, %, streak, solved).

### Verification (`/hash/:hash`)
- Not signed in → redirected to **login**, then returned to the hash page.
- Signed in as the **owner** → full statement, dates, analysis, weekly map, solved list, certificate.
- Signed in as **anyone else** → **consistency only** (days sealed, solved, streak, %) — the
  statement is never revealed.
- Unknown hash / no permission → **403**.

### Motivational quotes
The login page and the verification page show a **fresh quote on every visit**
(consistency / goals / discipline).

### Daily Coding Article & Note Page (`/note`, `/note/:slug`)
An "Orange / Ember" themed (`data-theme="orange"`, amber `#fb923c / #f97316 / #ea580c`
on zinc/slate dark) article authoring system:

- **Split Markdown editor + live preview** (Write / Split / Preview modes).
- **Embedded code editors** (CodeMirror 6) inside the Markdown — with **context-aware
  autocomplete** (C++ STL / `#include` headers / `std::`, plus Java, Python, JS keywords &
  builtins), **bracket & parentheses matching** with auto-close and orange highlight, and
  **multi-cursor editing** (Ctrl/Cmd+Click, Alt+Click, Ctrl/Cmd+D to select next occurrence).
- **▶ Run** code snippets via the public Piston execution API.
- **YouTube integration** — `[Video Title](://youtube.com/…)` renders an embedded player.
- **Clickable timestamps** — `[12:34]` / `[1:02:03]` seek the video (window event
  `dsa400:seek` + direct postMessage seek).
- **Hyperlink insertion** toolbar, plus bold/italic/headings/quotes/code/hr.
- **Note timeline** — every auto-save is logged; restore any version. Draft auto-saves
  locally (edits are logged).
- **Publish Article** — compiles the exact JSON payload
  (`slug, title, date, dayStreak, tags, videoUrl, contentMarkdown, isPublished`), stores it
  locally and (when Supabase is connected) to the `articles` table, and exposes it at
  `/note/{slug}` for anyone with the link.

### Pattern Master (`/patterns`)
- The complete original `dsa_Patterns_new.html` content, preserved verbatim behind `/patterns`.
- Cyan theme (the only non-emerald page), dark mode, no theme switcher.
- Cross-links `📌 Day N` into the DSA-400 plan and back.

---

## Tech stack

- **React 18** + **Vite 5** (SPA, hash-free client routing via `react-router-dom`).
- **Supabase** (Postgres + Auth + RLS) — the backend, replacing the old `server.js`.
- **qrcode** (client-side QR generation) and the **Web Crypto API** (SHA-512 hashing).
- Plain CSS (custom properties) — emerald/dark for the tracker, cyan/dark for Pattern Master.

---

## Project structure

```
prj-dsa/
├── index.html                 # SPA entry
├── vercel.json                # SPA rewrites + build config for Vercel
├── package.json
├── .env.example               # VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY template
├── DEPLOY.md                  # step-by-step Supabase + Vercel + GitHub OAuth guide
├── supabase/schema.sql        # tables, RLS, triggers, verification RPC (idempotent)
├── tools/
│   ├── extract.mjs            # one-time generator (parses the originals into data)
│   └── build-lc-index.mjs     # regenerates lc-titles.js + lc-plan.js from the live LC index
└── src/
    ├── main.jsx               # entry, mounts <App/>
    ├── App.jsx                # routes + protected-route wrapper
    ├── styles.css             # emerald/dark + cyan scopes
    ├── context/AuthContext.jsx# session, signUp/signIn/signInWithGitHub, displayName
    ├── hooks/useTrackerData.js# data layer: load, mutations, derived stats, effectiveItems
    ├── lib/
    │   ├── supabase.js        # client + configured flag
    │   ├── utils.js           # dates, SHA-512, commitmentHash, genCommitId, extraLabel
    │   ├── lc-titles.js       # full LeetCode index (number → title + slug), ALL problems
    │   ├── lc-plan.js         # plan cross-reference: number → days (every LC question in the plan)
    │   ├── lc-lookup.js       # live-API fallback lookup for brand-new problems
    │   ├── import.js          # resolveImportToken / judgeFromUrl / judge classes
    │   ├── articles.js        # article persistence (localStorage + Supabase `articles`)
    │   ├── note-mdx.jsx       # markdown-it + video/timestamp rules + React token renderer
    │   ├── note-video.js      # video registry + seekAllVideos (window event + postMessage)
    │   ├── quotes.js          # rotating motivational quotes
    │   ├── toast.js           # toast bus
    │   ├── tracker-data.js    # 400-day plan (phases, units, days, items) + LC cross-refs
    │   └── patterns-data.js   # the 40-pattern Pattern Master content
    ├── pages/                 # Login, Register, Onboarding, Tracker, Patterns,
    │                          # Commitment (/hash), Ledger (/file), Profile, Questions,
    │                          # NoteEditor (/note), NoteView (/note/:slug)
    └── components/            # Nav, Chain, SearchModal, TodayPanel, CalendarPanel,
                               # PlanPanel, ProgressPanel, CommitmentCard
                               # + editor/ (CodeBlock · CodeMirror, VideoEmbed, Timestamp)
```

---

## Data model (Supabase)

| Table | Purpose |
|---|---|
| `profiles` | username (auto-created on signup for email *and* OAuth users) |
| `commitment` | one row per user: statement, `hash`, `start_date`, `end_date`, `commit_id` — **immutable** |
| `excluded_days` | days/topics the user made optional |
| `removed_items` | questions the user removed (restorable) |
| `extra_items` | user-added questions (platform, target day, status) |
| `day_progress` | sealed days |
| `item_progress` | solved items |
| `notes` / `note_history` | pattern notes + edit timeline |
| `events` | append-only ledger of everything the user did |
| `streak_log` | streak snapshots recorded server-side |
| `articles` | published Daily Notes — public read / owner write; versioned (`schema_version`), with `github_url` + `blocks` |

The schema also defines a SECURITY DEFINER function
`get_commitment_verification(p_hash)` that returns exactly what a visitor is allowed to see
(the statement only for the owner).

---

## Security model

- Every table is RLS-locked to the signed-in user.
- `commitment` has **no UPDATE policy** → the start date and SHA-512 hash can never change.
- A **trigger** on `day_progress` rejects sealing any day whose calendar date is in the future
  (the calendar derives from the permanent `start_date`).
- `events` and `streak_log` are **append-only** — streaks/completions are server-recorded,
  the client cannot edit history.
- The commitment hash is `SHA-512(statement + "::" + user_id)`.

---

## The commitment & verification flow

1. Onboarding → `setCommitment` stores the statement, computes the hash, and generates a
   `DSA400xxxxxxx` commitment-id.
2. The certificate QR encodes `https://dsa-400.vercel.app/hash/{hash}`.
3. Scanning the QR lands on `/hash/{hash}`:
   - not signed in → redirected to `/login?return=/hash/{hash}`
   - owner → full commitment + analysis
   - other users → consistency-only verification
   - unknown/denied → 403.

---

## Included vs optional (how customization works)

- **Included** days count toward your 400-day plan: they appear in your chain, calendar and
  current-day pointer.
- **Optional** (excluded) days are skipped: they don't block your pointer and don't count in
  progress percentages — but they stay **logged**, so you can re-include them anytime without
  losing their history.
- The **current day (pointer)** is the first included, unsealed day. Remove a day or a whole
  week and the tracker automatically moves forward; use **Profile → Save & jump** to jump there.

---

## Getting started (local)

```bash
npm install
cp .env.example .env     # fill VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
npm run dev              # http://localhost:5173
```

Then open the Supabase SQL Editor and run the **entire** `supabase/schema.sql`
(it is idempotent — safe to re-run).

---

## Deploying (Supabase + Vercel)

Full step-by-step instructions live in [`DEPLOY.md`](DEPLOY.md). In short:

1. **Supabase** — create project, run `supabase/schema.sql`, copy the Project URL + anon key,
   configure Auth (Site URL + redirect URLs), optionally enable **GitHub OAuth**.
2. **Vercel** — import the repo, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`,
   build command `npm run build`, output dir `dist`. `vercel.json` handles the SPA rewrites
   (so `/hash/…`, `/profile`, etc. all serve `index.html`).

---

## Demo mode

Without a valid `.env`, the app runs in **demo mode**: everything persists to `localStorage`
so you can explore the whole UI (including onboarding and the certificate). Connect Supabase
to make it permanent and multi-device.

---

## Scripts

```bash
npm run dev       # start the Vite dev server
npm run build     # production build → dist/
npm run preview   # preview the production build
npm run update:lc # regenerate the LeetCode indexes (lc-titles.js + lc-plan.js)
                  # run weekly, or whenever LeetCode adds problems / the plan changes
```

---

*Patterns over problems — always.*
