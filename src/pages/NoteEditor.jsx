import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTrackerData } from '../hooks/useTrackerData';
import { renderMarkdown, slugify, extractYouTubeId } from '../lib/note-mdx';
import { VideoEmbed } from '../components/editor/VideoEmbed';
import GitHubSection from '../components/editor/GitHubSection';
import ArticleBlocks from '../components/editor/ArticleBlocks';
import { PATTERNS, getPattern, patternToMarkdown } from '../lib/pattern-md';
import { publishArticle, loadArticle } from '../lib/articles';
import { todayIso, formatIST } from '../lib/utils';
import { toast } from '../lib/toast';

const DRAFT_KEY = 'dsa400-note-draft-v1';

const STARTER = `# Today I learned…

Two-pointer insight: when the window condition is **monotonic**, shrink the left
edge in a ` + '`while`' + ` loop instead of restarting.

Video walkthrough — [Binary Search Explained](://youtube.com/watch?v=ID)

Key moments: [1:23] intuition · [4:05] edge cases · [9:12] code

\`\`\`cpp
#include <bits/stdc++.h>
using namespace std;

int lowerBound(vector<int>& a, int target) {
    int lo = 0, hi = a.size();
    while (lo < hi) {
        int mid = lo + (hi - lo) / 2;
        if (a[mid] < target) lo = mid + 1;
        else hi = mid;
    }
    return lo;
}
\`\`\`

## Checklist
- [x] brute force first
- [x] binary-search on the answer
- [ ] re-solve tomorrow without notes
`;

export default function NoteEditor() {
  const { user } = useAuth();
  const tracker = useTrackerData();
  const [params] = useSearchParams();
  const editSlug = params.get('edit');
  const patternId = params.get('pattern');

  const [title, setTitle] = useState('');
  const [date, setDate] = useState(todayIso());
  const [dayStreak, setDayStreak] = useState(0);
  const [slug, setSlug] = useState('');
  const [tags, setTags] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [blocks, setBlocks] = useState({});
  const [markdown, setMarkdown] = useState('');
  const [view, setView] = useState('split'); // split | write | preview
  const [loaded, setLoaded] = useState(false);

  const [lastSaved, setLastSaved] = useState(null);
  const [published, setPublished] = useState(null);
  const [showPublish, setShowPublish] = useState(false);
  const [seekMsg, setSeekMsg] = useState(null);

  const taRef = useRef(null);

  /* ── defaults from the tracker (streak / current day) ── */
  useEffect(() => {
    if (tracker.ready) {
      setDayStreak(d => (d || tracker.streak || 0));
      setTitle(t => (t || `Day ${tracker.pointer} — what I learned`));
    }
  }, [tracker.ready, tracker.streak, tracker.pointer]); // eslint-disable-line

  /* ── load draft once (or an existing article via ?edit=slug, or ?pattern=ID) ── */
  useEffect(() => {
    (async () => {
      if (editSlug) {
        const a = await loadArticle(editSlug);
        if (a) {
          setTitle(a.title); setDate(a.date); setDayStreak(a.dayStreak);
          setSlug(a.slug); setTags((a.tags || []).join(', ')); setVideoUrl(a.videoUrl || '');
          setGithubUrl(a.githubUrl || ''); setBlocks(a.blocks || {});
          setMarkdown(a.contentMarkdown || '');
          setLoaded(true);
          toast(`Editing <b>${a.title}</b> — republish to save changes.`);
          return;
        }
      }
      let draftMd = null;
      try {
        const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
        if (d) {
          setTitle(d.title || ''); setDate(d.date || todayIso()); setDayStreak(d.dayStreak || 0);
          setSlug(d.slug || ''); setTags(d.tags || ''); setVideoUrl(d.videoUrl || '');
          setGithubUrl(d.githubUrl || ''); setBlocks(d.blocks || {});
          draftMd = d.markdown || '';
        } else {
          draftMd = STARTER;
        }
      } catch {}
      // paste a whole pattern block from /patterns
      if (patternId) {
        const pat = getPattern(patternId);
        if (pat) {
          const pmd = patternToMarkdown(pat);
          draftMd = (draftMd ? draftMd.replace(/\n*$/, '') + '\n\n' : '') + pmd;
          setTitle(t => (t || `Pattern — ${pat.name}`));
          toast(`Pasted the full <b>${pat.name}</b> pattern block.`);
        }
      }
      setMarkdown(draftMd || '');
      setLoaded(true);
    })();
  }, [editSlug, patternId]);

  /* ── auto-save (debounced) — single draft only, no version copies ── */
  useEffect(() => {
    if (!loaded) return;
    const id = setTimeout(() => {
      const draft = { title, date, dayStreak, slug, tags, videoUrl, githubUrl, blocks, markdown };
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch {}
      setLastSaved(new Date());
    }, 900);
    return () => clearTimeout(id);
  }, [loaded, title, date, dayStreak, slug, tags, videoUrl, githubUrl, blocks, markdown]);

  /* ── window seek event indicator ── */
  useEffect(() => {
    const fn = e => {
      const s = e.detail?.seconds;
      if (typeof s === 'number') {
        const m = Math.floor(s / 60), ss = String(s % 60).padStart(2, '0');
        setSeekMsg(`⏩ seeked to ${m}:${ss}`);
        setTimeout(() => setSeekMsg(null), 1500);
      }
    };
    window.addEventListener('dsa400:seek', fn);
    return () => window.removeEventListener('dsa400:seek', fn);
  }, []);

  /* ── editing helpers ── */
  const wrap = (before, after = '') => {
    const ta = taRef.current;
    const start = ta ? ta.selectionStart : markdown.length;
    const end = ta ? ta.selectionEnd : markdown.length;
    const sel = markdown.slice(start, end);
    const next = markdown.slice(0, start) + before + sel + after + markdown.slice(end);
    setMarkdown(next);
    requestAnimationFrame(() => {
      if (ta) { ta.focus(); ta.setSelectionRange(start + before.length, start + before.length + sel.length); }
    });
  };
  const insert = text => wrap(text);

  /* fence editing sync: a code block edited in the preview updates the source */
  const handleFenceChange = (token, newCode) => {
    if (!token.map) return;
    setMarkdown(prev => {
      const lines = prev.split('\n');
      const [start, end] = token.map;
      const before = lines.slice(0, start + 1);   // opening ```lang line
      const after = lines.slice(end - 1);         // closing ``` line onward
      return [...before, ...newCode.replace(/\n$/, '').split('\n'), ...after].join('\n');
    });
  };

  /* ── insert popover ── */
  const [insOpen, setInsOpen] = useState(false);
  const [insTab, setInsTab] = useState('link');
  const [linkText, setLinkText] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [vidTitle, setVidTitle] = useState('');
  const [vidUrl, setVidUrl] = useState('');
  const [tsVal, setTsVal] = useState('12:34');
  const [codeLang, setCodeLang] = useState('cpp');
  const [patId, setPatId] = useState('p01');

  const closeIns = () => setInsOpen(false);
  const openIns = tab => { setInsTab(tab); setInsOpen(true); };

  const doInsert = () => {
    if (insTab === 'link') {
      const txt = linkText || (taRef.current ? markdown.slice(taRef.current.selectionStart, taRef.current.selectionEnd) : '') || 'link text';
      wrap(`[${txt}](`, ')');
      // put URL into the middle — simpler: build directly
      const ta = taRef.current;
      const start = ta ? ta.selectionStart : markdown.length;
      const end = ta ? ta.selectionEnd : markdown.length;
      const sel = markdown.slice(start, end);
      setMarkdown(markdown.slice(0, start) + `[${txt}](${linkUrl || 'https://'})` + sel + markdown.slice(end));
    } else if (insTab === 'video') {
      insert(`\n\n[${vidTitle || 'Video Title'}](${vidUrl || '://youtube.com/watch?v='})\n\n`);
    } else if (insTab === 'time') {
      insert(`[${tsVal}]`);
    } else if (insTab === 'code') {
      wrap(`\n\`\`\`${codeLang}\n`, '\n```\n');
    } else if (insTab === 'pattern') {
      const pat = getPattern(patId);
      if (pat) { insert('\n' + patternToMarkdown(pat) + '\n'); toast(`Pasted <b>${pat.name}</b> pattern block.`); }
    }
    closeIns();
  };

  /* ── publish ── */
  const finalSlug = slug.trim() || slugify(title) || `day-${dayStreak || 0}-note`;
  const doPublish = async () => {
    const payload = await publishArticle({
      slug: finalSlug,
      title,
      date,
      dayStreak,
      tags: tags.split(',').map(x => x.trim()).filter(Boolean),
      videoUrl: videoUrl.trim() || null,
      githubUrl: githubUrl.trim() || null,
      contentMarkdown: markdown,
      blocks,
    }, user?.id);
    setPublished(payload);
    setShowPublish(true);
    toast(`<b>Published</b> — live at /note/${payload.slug}`);
  };
  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(published, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${published.slug}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const mainVideoId = useMemo(() => (videoUrl ? extractYouTubeId(videoUrl) : null), [videoUrl]);

  const onTab = e => { if (e.key === 'Tab') { e.preventDefault(); insert('  '); } };

  return (
    <div className="n-page" data-theme="orange">
      <header className="n-topbar">
        <div className="n-brand"><span className="n-logo">◈</span> DSA·400 <em>· Daily Coding Article</em></div>
        <div className="n-toplinks">
          <Link className="n-link" to="/">← Tracker</Link>
          <Link className="n-link" to="/questions">Questions</Link>
          <Link className="n-link" to="/notes">📚 My articles</Link>
          <span className="n-save">{lastSaved ? `auto-saved ${formatIST(lastSaved)} (IST)` : 'auto-saves'}</span>
          <button className="n-btn n-btn-primary" onClick={doPublish}>🚀 Publish Article</button>
        </div>
      </header>

      <main className="n-shell">
        {/* ── meta ── */}
        <section className="n-meta">
          <input className="n-title" placeholder="Article title…" value={title} onChange={e => setTitle(e.target.value)} />
          <div className="n-meta-row">
            <label className="n-field"><span>Date</span><input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
            <label className="n-field"><span>Day streak</span><input type="number" min="0" value={dayStreak} onChange={e => setDayStreak(+e.target.value)} /></label>
            <label className="n-field n-field-slug"><span>Slug</span><input value={slug} onChange={e => setSlug(e.target.value)} placeholder={slugify(title) || 'auto'} /></label>
            <label className="n-field"><span>Tags (comma)</span><input value={tags} onChange={e => setTags(e.target.value)} placeholder="DSA, Binary Search, C++" /></label>
            <label className="n-field"><span>Main video URL</span><input value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="https://youtube.com/watch?v=…" /></label>
            <label className="n-field n-field-slug"><span>GitHub problem link</span><input value={githubUrl} onChange={e => setGithubUrl(e.target.value)} placeholder="https://github.com/…/835-image-overlap" /></label>
          </div>
          <div className="n-meta-hint">public route → <b>/note/{finalSlug}</b> · published articles are read by anyone with the link</div>
        </section>

        {/* ── toolbar ── */}
        <section className="n-toolbar">
          <button className="n-tb" onClick={() => wrap('**', '**')} title="Bold"><b>B</b></button>
          <button className="n-tb" onClick={() => wrap('_', '_')} title="Italic"><i>I</i></button>
          <button className="n-tb" onClick={() => wrap('`', '`')} title="Inline code">&lt;/&gt;</button>
          <button className="n-tb" onClick={() => insert('\n## ')} title="Heading">H2</button>
          <button className="n-tb" onClick={() => insert('\n> ')} title="Quote">❝</button>
          <button className="n-tb" onClick={() => openIns('link')} title="Insert link">🔗 Link</button>
          <button className="n-tb" onClick={() => openIns('video')} title="Insert YouTube video">▶ Video</button>
          <button className="n-tb" onClick={() => openIns('time')} title="Insert timestamp">⏱ [12:34]</button>
          <button className="n-tb" onClick={() => openIns('code')} title="Insert code block">{'{}'} Code</button>
          <button className="n-tb" onClick={() => openIns('pattern')} title="Paste a whole Pattern Master block">🧩 Pattern</button>
          <button className="n-tb" onClick={() => insert('\n---\n')} title="Divider">—</button>
          <span className="spacer" />
          <div className="n-viewtoggle">
            <button className={view === 'write' ? 'on' : ''} onClick={() => setView('write')}>Write</button>
            <button className={view === 'split' ? 'on' : ''} onClick={() => setView('split')}>Split</button>
            <button className={view === 'preview' ? 'on' : ''} onClick={() => setView('preview')}>Preview</button>
          </div>
        </section>

        {insOpen && (
          <div className="n-popover">
            <div className="n-pop-tabs">
              {[['link', 'Link'], ['video', 'Video'], ['time', 'Timestamp'], ['code', 'Code block'], ['pattern', 'Pattern']].map(([k, l]) => (
                <button key={k} className={insTab === k ? 'on' : ''} onClick={() => setInsTab(k)}>{l}</button>
              ))}
            </div>
            {insTab === 'link' && (<>
              <input className="n-in" placeholder="Link text" value={linkText} onChange={e => setLinkText(e.target.value)} />
              <input className="n-in" placeholder="https://…" value={linkUrl} onChange={e => setLinkUrl(e.target.value)} />
            </>)}
            {insTab === 'video' && (<>
              <input className="n-in" placeholder="Video title" value={vidTitle} onChange={e => setVidTitle(e.target.value)} />
              <input className="n-in" placeholder="://youtube.com/watch?v=ID  (or any youtube link)" value={vidUrl} onChange={e => setVidUrl(e.target.value)} />
            </>)}
            {insTab === 'time' && (
              <input className="n-in" placeholder="12:34" value={tsVal} onChange={e => setTsVal(e.target.value)} />
            )}
            {insTab === 'code' && (
              <select className="n-in" value={codeLang} onChange={e => setCodeLang(e.target.value)}>
                {['cpp', 'java', 'python', 'javascript', 'c'].map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            )}
            {insTab === 'pattern' && (
              <select className="n-in" value={patId} onChange={e => setPatId(e.target.value)}>
                {PATTERNS.map(p => <option key={p.id} value={p.id}>{p.n}. {p.name}{p.core ? ' ★' : ''}</option>)}
              </select>
            )}
            <div className="n-pop-actions">
              <button className="n-btn n-btn-ghost" onClick={closeIns}>Cancel</button>
              <button className="n-btn n-btn-primary" onClick={doInsert}>Insert</button>
            </div>
          </div>
        )}

        {/* ── split editor / preview ── */}
        <section className={`n-split n-${view}`}>
          {view !== 'preview' && (
            <div className="n-pane">
              <header className="n-pane-h">Markdown <span className="n-pane-sub">tab = indent · markdown supported</span></header>
              <textarea ref={taRef} className="n-ta" value={markdown} onChange={e => setMarkdown(e.target.value)} onKeyDown={onTab} spellCheck={false} />
            </div>
          )}
          {view !== 'write' && (
            <div className="n-pane">
              <header className="n-pane-h">Live preview {seekMsg && <span className="n-seek">{seekMsg}</span>}</header>
              <div className="n-preview">
                {mainVideoId && <VideoEmbed videoId={mainVideoId} title="Main video" />}
                {renderMarkdown(markdown, { onFenceChange: handleFenceChange }) || <p className="n-empty">Start writing…</p>}
                <ArticleBlocks blocks={blocks} />
              </div>
            </div>
          )}
        </section>

        {/* ── GitHub source (README + solutions, fetched on view — not stored) ── */}
        {githubUrl.trim() && (
          <section style={{ marginTop: 14 }}>
            <GitHubSection url={githubUrl.trim()} autoExpand={!/```/.test(markdown)} />
          </section>
        )}

        {/* ── structured blocks editor ── */}
        <section className="n-blocks-ed">
          <header className="n-tl-h">🧱 Article blocks <span className="n-pane-sub">example · complexity · pattern · mistakes — optional, shown in the published article</span></header>
          <details className="n-block n-block-ed">
            <summary>📌 Example (input / output / explanation)</summary>
            <div className="n-ed-grid">
              <label className="n-field"><span>Input</span><textarea className="n-ta-sm" value={blocks.example?.input || ''} onChange={e => setBlocks({ ...blocks, example: { ...blocks.example, input: e.target.value } })} placeholder="nums = [2,7,11,15], target = 9" /></label>
              <label className="n-field"><span>Output</span><textarea className="n-ta-sm" value={blocks.example?.output || ''} onChange={e => setBlocks({ ...blocks, example: { ...blocks.example, output: e.target.value } })} placeholder="[0,1]" /></label>
              <label className="n-field" style={{ flexBasis: '100%' }}><span>Explanation</span><textarea className="n-ta-sm" value={blocks.example?.explanation || ''} onChange={e => setBlocks({ ...blocks, example: { ...blocks.example, explanation: e.target.value } })} placeholder="Why this example matters…" /></label>
            </div>
          </details>
          <details className="n-block n-block-ed">
            <summary>📈 Time &amp; Space complexity</summary>
            <div className="n-ed-grid">
              <label className="n-field"><span>Time complexity</span><input value={blocks.complexity?.time || ''} onChange={e => setBlocks({ ...blocks, complexity: { ...blocks.complexity, time: e.target.value } })} placeholder="O(n log n)" /></label>
              <label className="n-field"><span>Space complexity</span><input value={blocks.complexity?.space || ''} onChange={e => setBlocks({ ...blocks, complexity: { ...blocks.complexity, space: e.target.value } })} placeholder="O(n)" /></label>
            </div>
            {((blocks.complexity?.time) || (blocks.complexity?.space)) && (
              <div style={{ marginTop: 8 }}><ArticleBlocks blocks={{ complexity: blocks.complexity }} /></div>
            )}
          </details>
          <details className="n-block n-block-ed">
            <summary>🧩 Pattern recognition</summary>
            <label className="n-field"><span>Which pattern(s) and why</span><textarea className="n-ta-sm" value={blocks.pattern || ''} onChange={e => setBlocks({ ...blocks, pattern: e.target.value })} placeholder="e.g. Two Pointers — sorted array + pair condition, shrink from both ends." /></label>
          </details>
          <details className="n-block n-block-ed">
            <summary>⚠️ Mistakes I made <span className="n-pane-sub">(optional)</span></summary>
            <label className="n-field"><span>Mistakes / gotchas</span><textarea className="n-ta-sm" value={blocks.mistakes || ''} onChange={e => setBlocks({ ...blocks, mistakes: e.target.value })} placeholder="e.g. Forgot to handle the empty array; off-by-one in the partition index." /></label>
          </details>
        </section>

        {/* ── publish result ── */}
        {showPublish && published && (
          <section className="n-publish">
            <div className="n-pub-head">
              <div>
                <b>✅ Published — “{published.title}”</b>
                <div className="n-pane-sub">
                  <a className="n-link" href={`/note/${published.slug}`} target="_blank" rel="noopener noreferrer">open /note/{published.slug} →</a>
                  {' '}· <Link className="n-link" to="/notes">manage my articles</Link>
                </div>
              </div>
              <button className="n-btn n-btn-ghost" onClick={downloadJson}>⬇ Download JSON</button>
            </div>
            <pre className="n-json">{JSON.stringify(published, null, 2)}</pre>
          </section>
        )}
      </main>
    </div>
  );
}
