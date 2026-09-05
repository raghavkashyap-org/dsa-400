import { supabase, configured } from './supabase';

/* Article persistence.
   - always saved locally (works in demo mode too)
   - synced to Supabase `articles` when configured (public read, owner write)
   - articles are scoped by (username, slug) so two users can use the same
     slug without colliding — the public route is /note/:username/:slug
   - v9 DB migration is OPTIONAL-but-recommended: if the `username` column /
     (username,slug) unique index are missing, publish/load/list/delete
     gracefully fall back to the pre-v9 slug-only schema so articles still
     become public.
   - `schema_version` guards the payload shape so future design changes never
     break articles published by older versions. */

export const ARTICLE_SCHEMA_VERSION = 2;

const KEY = 'dsa400-articles-v1';

export const userSlug = name => String(name || 'anon').toLowerCase().trim()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || 'anon';

function readAll() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
}
function writeAll(m) { try { localStorage.setItem(KEY, JSON.stringify(m)); } catch {} }

export function saveArticleLocal(p) {
  const m = readAll();
  m[p.slug] = p;
  writeAll(m);
}

export function loadArticleLocal(slug) {
  return readAll()[slug] || null;
}

export function listArticlesLocal() {
  return Object.values(readAll()).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}

/* normalize a row (local or Supabase) into the canonical article shape */
function normalize(a) {
  return {
    slug: a.slug,
    username: a.username ?? a.username_slug ?? null,
    authorName: a.author_name ?? a.authorName ?? null,
    title: a.title || 'Untitled',
    date: a.date,
    dayStreak: Number(a.day_streak ?? a.dayStreak) || 0,
    tags: a.tags || [],
    videoUrl: a.video_url ?? a.videoUrl ?? null,
    video: a.video ?? null,
    githubUrl: a.github_url ?? a.githubUrl ?? null,
    contentMarkdown: a.content_markdown ?? a.contentMarkdown ?? '',
    blocks: a.blocks ?? null,
    isPublished: a.is_published ?? a.isPublished ?? true,
    schemaVersion: a.schema_version ?? a.schemaVersion ?? ARTICLE_SCHEMA_VERSION,
    createdAt: a.created_at ?? a.createdAt ?? null,
    updatedAt: a.updated_at ?? a.updatedAt ?? null,
  };
}

/* compile + persist the JSON payload (schema from the spec) */
export async function publishArticle(p, userId) {
  const payload = {
    slug: p.slug,
    username: p.username || userSlug(p.authorName),
    authorName: p.authorName || null,
    title: p.title || 'Untitled',
    date: p.date,
    dayStreak: Number(p.dayStreak) || 0,
    tags: p.tags || [],
    videoUrl: p.videoUrl || null,
    video: p.video && Object.keys(p.video).length ? p.video : null,
    githubUrl: p.githubUrl || null,
    contentMarkdown: p.contentMarkdown || '',
    blocks: p.blocks && Object.keys(p.blocks).length ? p.blocks : null,
    isPublished: true,
    schemaVersion: ARTICLE_SCHEMA_VERSION,
  };
  saveArticleLocal(payload);

  let synced = !configured; // demo mode → local-only is the "sync"
  if (configured && supabase) {
    /* v9 schema: (username, slug) unique */
    try {
      const { error } = await supabase.from('articles').upsert({
        slug: payload.slug,
        username: payload.username,
        author_name: payload.authorName,
        user_id: userId || null,
        title: payload.title,
        date: payload.date,
        day_streak: payload.dayStreak,
        tags: payload.tags,
        video_url: payload.videoUrl,
        video: payload.video,
        github_url: payload.githubUrl,
        content_markdown: payload.contentMarkdown,
        blocks: payload.blocks,
        is_published: true,
        schema_version: payload.schemaVersion,
      }, { onConflict: 'username,slug' });
      if (!error) synced = true;
    } catch { /* v9 columns/index missing — fall through */ }

    /* pre-v9 fallback: slug primary key, no username/author/video columns */
    if (!synced) {
      try {
        const { error } = await supabase.from('articles').upsert({
          slug: payload.slug,
          user_id: userId || null,
          title: payload.title,
          date: payload.date,
          day_streak: payload.dayStreak,
          tags: payload.tags,
          video_url: payload.videoUrl,
          github_url: payload.githubUrl,
          content_markdown: payload.contentMarkdown,
          blocks: payload.blocks,
          is_published: true,
          schema_version: payload.schemaVersion,
        });
        if (!error) synced = true;
      } catch { /* ignore */ }
    }
  }
  return { ...payload, synced };
}

export async function deleteArticle(slug, username) {
  const m = readAll();
  const entry = m[slug];
  if (entry && (!username || username === '_' || !entry.username || entry.username === username)) delete m[slug];
  writeAll(m);
  if (configured && supabase) {
    try {
      let q = supabase.from('articles').delete().eq('slug', slug);
      if (username && username !== '_') q = q.eq('username', username);
      const { error } = await q;
      if (error) throw error;
    } catch {
      try { await supabase.from('articles').delete().eq('slug', slug); } catch { /* ignore */ }
    }
  }
}

export async function loadArticle(slug, username) {
  const local = listArticlesLocal().find(a =>
    a.slug === slug && (!username || username === '_' || !a.username || a.username === username));
  if (local) return normalize(local);
  if (configured && supabase) {
    /* v9: username-scoped lookup */
    if (username && username !== '_') {
      try {
        const { data, error } = await supabase.from('articles')
          .select('*').eq('slug', slug).eq('username', username).maybeSingle();
        if (!error) {
          if (data) return normalize(data);
          return null; // schema present but no such article for this user
        }
      } catch { /* username column missing — fall through */ }
    }
    /* pre-v9 fallback: slug-only */
    try {
      const { data } = await supabase.from('articles').select('*').eq('slug', slug).maybeSingle();
      if (data) return normalize(data);
    } catch { /* ignore */ }
  }
  return null;
}

/* merged list for the current user: Supabase rows (source of truth) + local-only */
export async function listArticles(userId, username) {
  const local = listArticlesLocal()
    .map(normalize)
    .filter(a => !username || !a.username || a.username === username);
  let remote = [];
  if (configured && supabase) {
    try {
      let q = supabase.from('articles')
        .select('*').order('date', { ascending: false }).order('created_at', { ascending: false });
      if (username) q = q.eq('username', username);
      const { data, error } = await q;
      if (!error) {
        remote = (data || []).map(normalize);
      } else {
        /* username column missing → list everything by slug */
        const { data: d2 } = await supabase.from('articles')
          .select('*').order('date', { ascending: false }).order('created_at', { ascending: false });
        remote = (d2 || []).map(normalize);
      }
    } catch { /* ignore */ }
  }
  const merged = [...local.filter(a => !remote.some(r => r.slug === a.slug)), ...remote];
  return merged.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}
