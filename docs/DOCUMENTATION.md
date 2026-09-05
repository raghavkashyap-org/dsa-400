# DSA·400 — Complete Website Documentation

> One **React (Vite) + Supabase** product merging two projects:
> **DSA·400 Tracker** (emerald/dark) + **Pattern Master** (cyan/dark) + the
> **Daily Coding Articles** system (orange/dark). Deployed at
> **https://dsa-400.vercel.app**.

This document is the single source of truth for how every part of the site works.
The **Article system** (draft → publish → GitHub → blocks → public view) gets a
full deep-dive in [§5](#5-the-article-system-deep-dive).

---

## 1. The three surfaces

| Surface | Route | Theme | Notes |
|---|---|---|---|
| **DSA·400 Tracker** | `/`, `/questions`, `/profile`, `/onboarding`, `/file` | Emerald + dark only | 400-day plan, chain, calendar, certificate |
| **Pattern Master** | `/patterns` | Cyan + dark only | 40-pattern playbook, preserved from `dsa_Patterns_new.html` |
| **Daily Coding Articles** | `/note`, `/note/:username/:slug`, `/notes` | Orange + dark only | Markdown authoring, GitHub sources, versioned JSON |

All three are **dark-mode only**, with **no theme switcher** (by design).
Theming is hand-rolled CSS custom properties (`styles.css`) — **no Tailwind**.

---

## 2. Routes

| Route | Access | What |
|---|---|---|
| `/login`, `/register` | public | Email/password + GitHub OAuth |
| `/onboarding` | signed-in, not committed | Start date → statement → topic selection → certificate |
| `/` | signed-in | Tracker: hero, chain, today, calendar, plan, progress |
| `/questions` | public | Browse every week/question before committing |
| `/profile` | signed-in | Identity, certificate, stats, import, full plan editor |
| `/patterns` | signed-in | Pattern Master |
| `/hash/:hash` | see §6 | Commitment verification (owner vs public) |
| `/note` | signed-in | **Article editor** (single draft) |
| `/note/:username/:slug` | public | Published article (read-only, username-scoped) |
| `/notes` | signed-in | **Article management** (list / edit / delete / download) |
| `/file` | signed-in | Raw append-only event ledger (JSON export) |

---

## 3. Tech stack

- **React 18 + Vite 5**, `react-router-dom` (client routing, SPA rewrites via `vercel.json`).
- **Supabase** (Postgres + Auth + RLS) — the backend, replacing the old `server.js`.
- **qrcode** (client QR) + **Web Crypto API** (SHA-512).
- **CodeMirror 6** (embedded code editors in articles) + **markdown-it** (article Markdown).
- **Piston** public API (optional "▶ Run" for code snippets in articles).
- Plain CSS custom properties. Fonts: Inter / Poppins / JetBrains Mono (Google Fonts, non-blocking).

---

## 4. Supabase data model

All tables are RLS-locked to the signed-in user (see `supabase/schema.sql`, idempotent).

| Table | Purpose |
|---|---|
| `profiles` | username (auto-created on signup for email + OAuth users) |
| `commitment` | one row/user: statement, `hash`, `start_date`, `end_date`, `commit_id` — **immutable** |
| `excluded_days` | days/topics made optional |
| `removed_items` | removed questions (restorable) |
| `extra_items` | user-added questions |
| `day_progress` | sealed days |
| `item_progress` | solved items |
| `notes` / `note_history` | pattern notes + edit timeline |
| `events` | append-only ledger |
| `streak_log` | server-recorded streak snapshots |
| `articles` | **published Daily Coding Articles** — public read, owner write |

### `articles` table (the article system)

| Column | Type | Maps from payload |
|---|---|---|
| `user_id` | uuid | (owner) |
| `slug` | text (unique) | `slug` |
| `title` | text | `title` |
| `date` | text | `date` (ISO date string) |
| `day_streak` | int | `dayStreak` |
| `tags` | text[] | `tags` |
| `video_url` | text | `videoUrl` |
| `github_url` | text | `githubUrl` |
| `content_markdown` | text | `contentMarkdown` |
| `blocks` | jsonb | `blocks` (nullable, v2) |
| `is_published` | bool | `isPublished` |
| `schema_version` | int | `schemaVersion` |
| `created_at` / `updated_at` | timestamptz | auto |

Security: `articles` has **public SELECT** (anyone can read a published article by
slug) and **owner-only INSERT/UPDATE/DELETE**. `schema_version` lets future renderers
detect old payload shapes.

---

## 5. The article system — deep dive

### 5.1 The editor — `/note`

- **Single draft.** One draft per browser, key `dsa400-note-draft-v1` in `localStorage`.
  There is **no version history / timeline / restore** (removed deliberately to avoid
  storage waste). Auto-save is debounced (~900 ms) and writes the whole draft on every
  change; the nav shows the last auto-save time in **IST**.
- **Editor modes**: *Write* (textarea only), *Split* (editor + live preview side by side),
  *Preview* (preview only).
- **Markdown** is rendered live by `note-mdx.jsx` (markdown-it + custom rules), with:
  - **fenced code blocks** → embedded **CodeMirror 6** editors (autocomplete for C++ STL /
    headers / `std::`, Java, Python, JS; bracket matching with orange highlight; multi-cursor;
    optional Piston "▶ Run"). Editing code inside the preview **syncs back to the Markdown
    source** (`handleFenceChange`, using token source maps).
  - **YouTube**: `[Title](://youtube.com/watch?v=ID)` → embedded player. The author
    controls playback via **🎛 Video settings** (autoplay, loop, start-at, mute) stored
    in the payload's `video` object; the embed always keeps the user's **controls
    visible** (`controls=1`).
  - **Timestamps**: `[12:34]` / `[1:02:03]` → clickable chips that seek the video
    (window event `dsa400:seek` + `postMessage`).
  - Standard Markdown: headings (styled with an orange bar), bold/italic, quotes,
    inline code, lists, task checklists, tables, images, hr.
- **Toolbar** for bold / italic / inline-code / H2 / quote / link / video / timestamp /
  code block / divider / **🧩 Pattern** insert.
- **Status rail** shows live word count, estimated read time (220 wpm), char count,
  and "✓ auto-saves".
- **Draft content** (all persisted): `title, date, dayStreak, slug, tags, videoUrl,
  githubUrl, blocks, markdown`.
- **Tracker-aware defaults**: a new draft defaults to **slug `day-X`** (X = the user's
  current day in the tracker — the first included, unsealed day) and a **title
  `Day X — {topic}`** taken from that day's concept / week unit. Existing drafts and
  `?edit=` loads are never overwritten.

### 5.2 Opening an existing article for editing

`/note?edit={slug}` loads the published article into the draft (from local first, then
Supabase). Republishing overwrites it (same slug).

### 5.3 Publish — payload shape & Supabase mapping

`publishArticle()` in `src/lib/articles.js` compiles the canonical payload:

```json
{
  "slug": "day-7",
  "username": "raghav",
  "authorName": "raghav",
  "title": "Two Pointers — Day 7",
  "date": "2026-09-04",
  "dayStreak": 7,
  "tags": ["DSA", "Two Pointers"],
  "videoUrl": "https://youtube.com/watch?v=…",
  "video": { "autoplay": false, "loop": false, "start": 0, "mute": false },
  "githubUrl": "https://github.com/…/835-image-overlap",
  "contentMarkdown": "# …",
  "blocks": { "example": {…}, "complexity": {…}, "pattern": "…", "mistakes": "…" },
  "isPublished": true,
  "schemaVersion": 2
}
```

- Saved **always** locally (key `dsa400-articles-v1`) — works in demo mode.
- **Upserted** into Supabase `articles` when configured (owner row, `onConflict:
  username,slug`). Supabase column mapping is the table in §4.
- **`username` scoping**: the public route is `/note/{username}/{slug}`, and the
  table is unique on `(username, slug)` — so two users can both publish a
  `day-7` without colliding. `username` is the URL-safe form of the author's
  display name (`userSlug()`), `authorName` is the human-readable form.
- `blocks`/`video` are omitted (`null`) when empty, so **v1 articles stay
  byte-compatible**.
- **`schemaVersion` is mandatory** and pinned to `ARTICLE_SCHEMA_VERSION = 2`.

### 5.4 Schema versioning

- v1: `contentMarkdown` only (no `blocks`, no `githubUrl`).
- v2 (current): optional `blocks` JSON + `github_url`. A future v3 renderer can branch on
  `schemaVersion` and still render v1/v2 rows. The renderer normalizes missing fields to
  safe defaults (see `normalize()` in `articles.js`).

### 5.5 Article blocks (v2, optional structured content)

`ArticleBlocks.jsx` renders `blocks` in the preview and the published page:

| Key | Shape | Render |
|---|---|---|
| `example` | `{ input, output, explanation }` | two code boxes (green "OUTPUT" tag) + explanation |
| `complexity` | `{ time, space }` | big-O badges **+ an interactive growth panel**. A **log-scale slider** sweeps the input size `n` from 1 → 10⁶ and each of Time (orange `#fb923c`) and Space (sky `#38bdf8`) is plotted on **shared log–log axes** (x = log₁₀ n, y = log₁₀ ops, 10⁰–10¹⁸) with a `10⁷ ops ≈ 1 s` reference line — so `O(n)`, `O(n²)`, `O(n⁴)`, `O(2ⁿ)`, `O(n!)` are all visibly different slopes. A live readout shows **operations** and **time @ 10⁷ ops/s** at the current `n`, with a green/yellow/red grade. Any notation is parsed dynamically (`O(n^4)`, `O(n log n)`, `O(n²+m)`, `O(n·m)`, …); unparseable strings degrade gracefully. |
| `pattern` | string | "Pattern recognition" freetext block |
| `mistakes` | string (optional) | warning-styled block |

The editor provides `<details>` forms for each block; the complexity form shows a **live
`ArticleBlocks` preview** as you type. The blocks render *after* the Markdown body.

### 5.6 GitHub problem source — fetch & rewrite behavior

`src/lib/github.js` — GitHub is the **single source of truth** for the question, its
assets and solution. **Nothing is copied into Supabase.**

`parseGithubUrl()` accepts folder links like
`https://github.com/raghavkashyap-org/leetcode/tree/main/835-image-overlap`
and extracts `{owner, repo, branch, path}`.

`fetchGithub()`:
1. Fetches the **README** (`README.md`, case variants) from
   `raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}/`.
2. **Rewrites every relative reference** in the README to absolute
   `raw.githubusercontent.com` URLs — markdown links `[text](href)`, markdown images
   `![alt](href)`, and `<img src="…">`. Resolution is relative to the README's folder;
   `..` pops folder segments; already-absolute URLs (https, mailto, data, `#`, `//`) pass
   through untouched.
3. **Collects every image** referenced in the README into `images` (e.g. `assets/img_1.jpg`,
   `img_2`, `img_3`, …) — rendered by `GitHubSection` as a thumbnail gallery labelled
   `img_1`, `img_2`, ….
4. Fetches **solution code files** (`.cpp/.java/.py/.js/.ts`) from the same folder via the
   GitHub contents API (fallback: any code files linked from the README).
5. Caches per `owner/repo/branch/path` in memory.

`GitHubSection.jsx` renders the README as a **structured problem view** (via
`readme-parse.js`) instead of a raw Markdown dump:

1. **Title + meta** — difficulty chip (green/amber/red), topic chips, LeetCode link.
2. **Question statement** — the problem text rendered as Markdown.
3. **Examples** — each `**Example N:**` becomes a card with its **input / output /
   explanation** pulled out of the code fence into labelled boxes, and its **images left
   inline exactly where they appear** (already rewritten to raw.githubusercontent.com).
4. **Constraints** — rendered as a styled `code` list.
5. **Extra sections** (e.g. `## Submission`) — rendered as Markdown.
6. **Solution code** — read-only tabs for the fetched source files.
7. **Image gallery** — every image collected from the README (`img_1`, `img_2`, …).

It **never overrides user-written code** — if the article's Markdown already contains a
fenced code block, the section stays collapsed behind a "📦 GitHub source" toggle; if
there is no user code, it auto-expands. If the README doesn't match the expected
structure, it falls back to rendering the raw Markdown.

### 5.7 Pattern reference import

`src/lib/pattern-md.js` exports `patternToMarkdown(p)`, which turns a whole Pattern
Master block (what / model / formula / when-to-use / complexity ladder / C++ & Java
templates / sample walkthrough / practice set) into **plain editable Markdown**.

- From `/patterns`, each pattern has **"＋ Add to article"** → opens `/note?pattern={id}`.
- In the editor, the **🧩 Pattern** toolbar tab pastes the same block.
- In both cases the pasted Markdown is **fully editable** afterwards — it is normal
  document text, not a frozen widget (the editor says so explicitly).

### 5.8 Management — `/notes`

`NotesManager.jsx` lists **all published articles** (Supabase + local, **merged** — on a
slug collision the Supabase row wins, local-only drafts are kept). Each row shows title,
tags, day streak, IST timestamps, and actions:

- **Open** → `/note/:username/:slug` (public view)
- **Edit** → `/note?edit=:slug`
- **Download JSON** → the raw payload
- **Delete** → removes from local + Supabase

### 5.9 Public rendering — `/note/:username/:slug`

`NoteView.jsx` loads by `(username, slug)` (local → Supabase, username-filtered) and
renders, read-only:

1. Kicker + **🔥 Day N** streak badge + author `@username` + date.
2. Title + tag chips.
3. Embedded video (if `videoUrl`), honouring the author's `video` settings.
4. **GitHub source** section (if `githubUrl`) — structured problem view, auto-expanded
   when the article has no user code.
5. The Markdown body (read-only CodeMirror for code blocks).
6. The `blocks` (example / interactive complexity panel / pattern / mistakes).
7. Footer with username/slug + "IST (Asia/Kolkata)".

### 5.10 Timezone

All article timestamps are rendered in **IST (Asia/Kolkata, +05:30)** via `formatIST()`
in `src/lib/utils.js`.

---

## 6. Commitment & verification

1. Onboarding stores the statement, computes
   `hash = SHA-512(statement + "::" + user_id)`, generates a `DSA400xxxxxxx` commit-id.
2. Certificate QR → `https://dsa-400.vercel.app/hash/{hash}`.
3. `/hash/:hash`:
   - not signed in → redirected to `/login?return=/hash/{hash}`;
   - owner → full statement + analysis;
   - other users → **consistency-only** (sealed/solved/streak/%), statement never shown;
   - unknown/denied → 403.
4. Certificate image shows **only**: start date (above), end date (below, vertically
   stacked, no overlap), SHA-512 hash, QR, username, commitment-id. Never the statement,
   never the hash URL as text. First download includes a motivational quote; later
   downloads show a live progress band.

Streaks, completions, and future-date locks are enforced **server-side** (trigger on
`day_progress` + append-only `events`/`streak_log`). The start date is permanent
(`commitment` has no UPDATE policy).

---

## 7. Tracker customization model

- **Included** days count toward the 400; **optional** days are skipped but stay logged.
- The **pointer** is the first included, unsealed day — removing today/a week moves it
  forward automatically.
- **Profile → plan editor** allows full week/day/question customization (make optional,
  remove, add), with **Save & jump** to the new current day. Removed items stay restorable.
- **Import**: `460` auto-resolves to **LFU Cache : 460** with the real LeetCode link
  (full 4,042-problem index in `lc-titles.js`). Any platform link / `{link:Name:No}` format.
- **Search** is site-wide by LeetCode number (e.g. `56` → `56. Merge Intervals`); if
  present in the plan it shows where, otherwise offers adding it to a scheduled date.
- Onboarding states the plan can be fully customized from Profile.
- User-added/scheduled questions are distinguishable from the original set.

---

## 8. Theming & design system

- `styles.css` defines global tokens + per-surface scopes: emerald (tracker), cyan
  (Pattern Master), orange (articles).
- The orange/ember scope (`[data-theme="orange"]`) follows the frontend design-system:
  - palette `#fb923c` (400) / `#f97316` (500) / `#ea580c` (600) on `#050507` dark;
  - background layers: two animated **orbs** + a faint **grid** + a **vignette** + noise;
  - floating **pill navbar**, glass cards, orange-glow buttons, chips, callouts, steps,
    tabs, demo-style code frames, reveal animations;
  - **full-width** workspace (max 1560px) — not a narrow note editor.
- Fonts: Inter (sans), Poppins (display), JetBrains Mono (code).

---

## 9. Development

```bash
npm install          # deps
npm run dev          # http://localhost:5173
npm run build        # → dist/
npm run preview      # preview the production build
npm run update:lc    # regenerate lc-titles.js + lc-plan.js from the live LC index
```

- Run **Supabase** `supabase/schema.sql` (idempotent) to create tables/RLS/triggers.
- Without `.env`, the app runs in **demo mode** (localStorage persistence).
- Deploy: see `DEPLOY.md`.

### Schema migration for articles

```sql
alter table public.articles add column if not exists schema_version int not null default 1;
alter table public.articles add column if not exists github_url text;
alter table public.articles add column if not exists blocks jsonb;
```

---

*Patterns over problems — always.*
