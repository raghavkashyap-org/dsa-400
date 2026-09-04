import { supabase, configured } from './supabase';

/* Article persistence.
   - always saved locally (works in demo mode too)
   - synced to Supabase `articles` when configured (public read, owner write)
   - `schema_version` guards the payload shape so future design changes never
     break articles published by older versions. */

export const ARTICLE_SCHEMA_VERSION = 2;

const KEY = 'dsa400-articles-v1';

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
    title: a.title || 'Untitled',
    date: a.date,
    dayStreak: Number(a.day_streak ?? a.dayStreak) || 0,
    tags: a.tags || [],
    videoUrl: a.video_url ?? a.videoUrl ?? null,
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
    title: p.title || 'Untitled',
    date: p.date,
    dayStreak: Number(p.dayStreak) || 0,
    tags: p.tags || [],
    videoUrl: p.videoUrl || null,
    githubUrl: p.githubUrl || null,
    contentMarkdown: p.contentMarkdown || '',
    blocks: p.blocks && Object.keys(p.blocks).length ? p.blocks : null,
    isPublished: true,
    schemaVersion: ARTICLE_SCHEMA_VERSION,
  };
  saveArticleLocal(payload);
  if (configured && supabase) {
    try {
      await supabase.from('articles').upsert({
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
    } catch { /* local publish still succeeded */ }
  }
  return payload;
}

export async function deleteArticle(slug) {
  const m = readAll();
  delete m[slug];
  writeAll(m);
  if (configured && supabase) {
    try { await supabase.from('articles').delete().eq('slug', slug); } catch {}
  }
}

export async function loadArticle(slug) {
  const local = loadArticleLocal(slug);
  if (local) return normalize(local);
  if (configured && supabase) {
    const { data } = await supabase.from('articles').select('*').eq('slug', slug).maybeSingle();
    if (data) return normalize(data);
  }
  return null;
}

/* merged list: Supabase rows (source of truth) + any local-only drafts */
export async function listArticles(userId) {
  const local = listArticlesLocal().map(normalize);
  const localSlugs = new Set(local.map(a => a.slug));
  let remote = [];
  if (configured && supabase) {
    const { data } = await supabase.from('articles')
      .select('*').order('date', { ascending: false }).order('created_at', { ascending: false });
    remote = (data || []).map(normalize);
  }
  // remote wins on collision; keep local-only ones too
  const merged = [...local.filter(a => !remote.some(r => r.slug === a.slug)), ...remote];
  return merged.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}
