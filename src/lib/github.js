/* Fetch a LeetCode problem's README + solution code from a GitHub repo folder.
   Example: https://github.com/raghavkashyap-org/leetcode/tree/main/835-image-overlap
   Nothing is stored in Supabase — GitHub stays the single source of truth. */

const cache = new Map();

export function parseGithubUrl(url) {
  const s = String(url || '').trim();
  const m = s.match(/github\.com\/([^/]+)\/([^/]+)\/(?:tree|blob)\/([^/]+)\/([^#?]+)/);
  if (!m) return null;
  return {
    owner: m[1],
    repo: m[2].replace(/\.git$/, ''),
    branch: m[3],
    path: m[4].replace(/\/+$/, ''),
  };
}

const EXT_LANG = {
  cpp: 'cpp', cc: 'cpp', cxx: 'cpp', c: 'cpp',
  java: 'java', py: 'python', js: 'javascript', ts: 'typescript',
};

export async function fetchGithub(parsed) {
  if (!parsed) return { error: 'Not a valid GitHub link.' };
  const key = `${parsed.owner}/${parsed.repo}/${parsed.branch}/${parsed.path}`;
  if (cache.has(key)) return cache.get(key);

  const rawBase = `https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/${parsed.branch}/${parsed.path}`;
  const out = { ...parsed, key, readme: null, files: [], error: null, rawBase };

  try {
    /* 1) README (case variants) */
    for (const name of ['README.md', 'readme.md', 'Readme.md', 'README.MD']) {
      try {
        const r = await fetch(`${rawBase}/${name}`);
        if (r.ok) { out.readme = await r.text(); out.readmeName = name; break; }
      } catch { /* try next */ }
    }

    /* 2) solution source files via the GitHub contents API */
    try {
      const api = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/contents/${encodeURIComponent(parsed.path)}?ref=${parsed.branch}`;
      const res = await fetch(api, { headers: { Accept: 'application/vnd.github+json' } });
      if (res.ok) {
        const items = await res.json();
        if (Array.isArray(items)) {
          const codeFiles = items.filter(i =>
            i.type === 'file' && EXT_LANG[(i.name.split('.').pop() || '').toLowerCase()]);
          for (const f of codeFiles) {
            const ext = f.name.split('.').pop().toLowerCase();
            try {
              const raw = await fetch(`${rawBase}/${encodeURIComponent(f.name)}`);
              if (raw.ok) {
                out.files.push({ name: f.name, lang: EXT_LANG[ext], content: await raw.text() });
              }
            } catch { /* skip unreadable file */ }
          }
        }
      }
    } catch { /* API blocked (e.g. offline preview) — fall through */ }

    if (!out.readme && out.files.length === 0) {
      out.error = 'Nothing found in that folder (no README or code files), or GitHub is unreachable from here.';
    }
  } catch (e) {
    out.error = 'Could not fetch GitHub: ' + (e && e.message ? e.message : 'network blocked');
  }

  cache.set(key, out);
  return out;
}
