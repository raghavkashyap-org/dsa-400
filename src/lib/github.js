/* Fetch a LeetCode problem's README + solution code + assets from a GitHub
   folder link. Example:
     https://github.com/raghavkashyap-org/leetcode/tree/main/835-image-overlap
   Nothing is stored in Supabase — GitHub stays the single source of truth.

   Crucially, every RELATIVE reference inside the README (images in assets/,
   links to solution code, etc.) is rewritten to an absolute
   raw.githubusercontent.com URL, so the question renders correctly here. */

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
const IMG_EXT = /\.(png|jpe?g|gif|webp|svg|bmp)(\?.*)?$/i;

const isAbsolute = u => /^(https?:|mailto:|data:|#|\/\/)/i.test(u);

/* resolve a relative path against the README's folder → absolute raw URL.
   `rawBase` already points at the folder, so relative refs append to it and
   `..` pops folder segments (never above the repo root). */
function absolutize(href, rawBase) {
  if (isAbsolute(href)) return href;
  const cleaned = href.split(/[?#]/)[0];
  if (!cleaned) return href;
  const stack = rawBase.split('/');
  for (const part of cleaned.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') { if (stack.length > 3) stack.pop(); }
    else stack.push(part);
  }
  return stack.join('/');
}

/* rewrite every relative markdown link/image + <img> src inside the README */
function rewriteRelativeRefs(md, rawBase) {
  return md
    // ![alt](href)  and  [text](href)
    .replace(/(!?)\[([^\]]*)\]\(([^)\s]+)\)/g, (whole, img, label, href) =>
      `${img}[${label}](${absolutize(href, rawBase)})`)
    // <img src="…">
    .replace(/<img\s+([^>]*?)src=["']([^"']+)["']([^>]*)>/gi, (whole, pre, src, post) =>
      isAbsolute(src) ? whole : `<img ${pre}src="${absolutize(src, rawBase)}"${post}>`);
}

export async function fetchGithub(parsed) {
  if (!parsed) return { error: 'Not a valid GitHub link.' };
  const key = `${parsed.owner}/${parsed.repo}/${parsed.branch}/${parsed.path}`;
  if (cache.has(key)) return cache.get(key);

  const rawBase = `https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/${parsed.branch}/${parsed.path}`;
  const out = { ...parsed, key, readme: null, readmeName: null, files: [], images: [], error: null, rawBase };

  try {
    /* 1) README (case variants), with relative refs rewritten */
    for (const name of ['README.md', 'readme.md', 'Readme.md', 'README.MD', 'README']) {
      try {
        const r = await fetch(`${rawBase}/${name}`);
        if (r.ok) {
          const text = await r.text();
          out.readme = rewriteRelativeRefs(text, rawBase);
          out.readmeName = name;
          // collect every image referenced
          const imgs = new Set();
          let m;
          const re = /!\[[^\]]*\]\(([^)]+)\)|src=["']([^"']+)["']/gi;
          while ((m = re.exec(out.readme))) {
            const u = (m[1] || m[2] || '').trim();
            if (u && IMG_EXT.test(u.split(/[?#]/)[0]) && !imgs.has(u)) imgs.add(u);
          }
          out.images = [...imgs];
          break;
        }
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

    /* 3) fallback: any code files linked directly from the README */
    if (out.readme && out.files.length === 0) {
      const seen = new Set(out.files.map(f => f.name));
      let m;
      const re = /\[[^\]]*\]\(([^)]+)\)/g;
      while ((m = re.exec(out.readme))) {
        const href = m[1] || '';
        const name = decodeURIComponent(href.split('/').pop().split(/[?#]/)[0]);
        const ext = (name.split('.').pop() || '').toLowerCase();
        if (!EXT_LANG[ext] || seen.has(name)) continue;
        try {
          const raw = await fetch(`${rawBase}/${name}`);
          if (raw.ok) {
            out.files.push({ name, lang: EXT_LANG[ext], content: await raw.text() });
            seen.add(name);
          }
        } catch { /* skip */ }
      }
    }

    if (!out.readme && out.files.length === 0) {
      out.error = 'Nothing found in that folder (no README or code files), or GitHub is unreachable from here.';
    }
  } catch (e) {
    out.error = 'Could not fetch GitHub: ' + (e && e.message ? e.message : 'network blocked');
  }

  cache.set(key, out);
  return out;
}
