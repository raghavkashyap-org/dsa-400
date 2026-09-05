import { useEffect, useMemo, useState } from 'react';
import { parseGithubUrl, fetchGithub } from '../../lib/github';
import { parseReadme } from '../../lib/readme-parse';
import { renderMarkdown } from '../../lib/note-mdx';
import CodeBlock from './CodeBlock';

/* Loads the problem's README + solution code from a GitHub folder link and
   renders it as a structured problem view: title/meta, statement, examples
   (input / output / explanation with images left inline), constraints, then
   the solution code.
   autoExpand: show inline when the article has no code of its own. */
export default function GitHubSection({ url, autoExpand = false }) {
  const parsed = parseGithubUrl(url);
  const [state, setState] = useState(null); // null=loading
  const [tab, setTab] = useState(0);
  const [open, setOpen] = useState(!!autoExpand);

  useEffect(() => {
    let alive = true;
    setState(null); setOpen(!!autoExpand);
    if (parsed) {
      fetchGithub(parsed).then(r => { if (alive) setState(r); });
    } else {
      setState({ error: 'Not a valid GitHub link.' });
    }
    return () => { alive = false; };
  }, [url, autoExpand]); // eslint-disable-line react-hooks/exhaustive-deps

  const problem = useMemo(() => (state && state.readme ? parseReadme(state.readme) : null), [state]);

  if (!url) return null;
  if (!parsed) {
    return <div className="n-block n-block-mistake"><div className="n-block-h">📦 GitHub source</div><p className="n-block-body">{url} — not a recognised GitHub link.</p></div>;
  }

  const loading = state === null;
  const files = state ? state.files || [] : [];
  const meta = problem ? problem.meta : null;
  const diff = meta ? (meta.Difficulty || '').toLowerCase() : '';
  const diffCls = diff.includes('easy') ? 'ok' : diff.includes('hard') ? 'err' : diff.includes('medium') ? 'warn' : '';
  const topics = meta && meta.Topics ? String(meta.Topics).split(',').map(s => s.trim()).filter(Boolean) : [];

  return (
    <details className="n-block n-gh" open={open} onToggle={e => setOpen(e.currentTarget.open)}>
      <summary className="n-gh-sum">
        📦 GitHub source <span className="n-gh-path">{parsed.owner}/{parsed.repo} · {parsed.path}</span>
        <a className="n-gh-open" href={url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>open ↗</a>
      </summary>

      <div className="n-gh-body">
        {loading && <p className="n-empty">Loading from GitHub…</p>}
        {state && state.error && (
          <p className="n-empty">
            {state.error} <a href={url} target="_blank" rel="noopener noreferrer">Open the repo</a>.
          </p>
        )}

        {problem && problem.title && (
          <div className="n-prob">
            <div className="n-prob-head">
              <div className="n-prob-title">{problem.title}</div>
              <div className="n-prob-chips">
                {meta && meta.Difficulty && <span className={`n-diff ${diffCls}`}>{meta.Difficulty}</span>}
                {topics.map(t => <span key={t} className="n-diff">{t}</span>)}
                {meta && meta.Link && /^https?:/i.test(meta.Link) && (
                  <a className="n-diff n-diff-link" href={meta.Link} target="_blank" rel="noopener noreferrer">LeetCode ↗</a>
                )}
              </div>
            </div>

            {problem.statement && (
              <div className="n-prob-stmt">{renderMarkdown(problem.statement, { readOnly: true })}</div>
            )}

            {problem.examples.map((ex, idx) => (
              <div className="n-prob-ex" key={idx}>
                <div className="n-prob-ex-h">📌 {ex.heading}</div>
                {ex.body && <div className="n-prob-ex-body">{renderMarkdown(ex.body, { readOnly: true })}</div>}
                <div className="n-io-grid">
                  {ex.input != null && (
                    <div className="n-io"><span className="n-io-tag">Input</span><pre className="n-io-pre">{ex.input}</pre></div>
                  )}
                  {ex.output != null && (
                    <div className="n-io"><span className="n-io-tag out">Output</span><pre className="n-io-pre">{ex.output}</pre></div>
                  )}
                </div>
                {ex.explanation && <p className="n-ex-expl">{ex.explanation}</p>}
              </div>
            ))}

            {problem.constraints.length > 0 && (
              <div className="n-prob-cons">
                <div className="n-prob-ex-h">⛓ Constraints</div>
                <ul className="n-cons-list">
                  {problem.constraints.map((c, idx) => (
                    <li key={idx}><code>{String(c).replace(/`/g, '').trim()}</code></li>
                  ))}
                </ul>
              </div>
            )}

            {problem.extra.map((s, idx) => (
              <div className="n-prob-extra" key={idx}>
                <div className="n-prob-ex-h">{s.heading}</div>
                {renderMarkdown(s.body, { readOnly: true })}
              </div>
            ))}
          </div>
        )}

        {/* fallback: render the README raw when no structured parse happened */}
        {state && state.readme && !(problem && problem.title) && (
          <details className="n-gh-readme" open>
            <summary>📄 {state.readmeName || 'README.md'} <span className="n-pane-sub">· raw</span></summary>
            <div className="n-gh-readme-body">
              {renderMarkdown(state.readme, { readOnly: true })}
            </div>
          </details>
        )}

        {/* every image referenced in the README, collected */}
        {state && state.images && state.images.length > 0 && (
          <div className="n-gh-assets">
            <span className="n-pane-sub">🖼 {state.images.length} image{state.images.length > 1 ? 's' : ''} from the repo:</span>
            <div className="n-gh-thumbs">
              {state.images.map((u, i) => (
                <a key={u + i} className="n-gh-thumb" href={u} target="_blank" rel="noopener noreferrer" title={`img_${i + 1}`}>
                  <img src={u} alt={`repo image ${i + 1}`} loading="lazy" />
                  <span>img_{i + 1}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* solution code */}
        {files.length > 0 && (
          <>
            {files.length > 1 && (
              <div className="n-gh-tabs">
                {files.map((f, i) => (
                  <button key={f.name} className={tab === i ? 'on' : ''} onClick={() => setTab(i)}>{f.name}</button>
                ))}
              </div>
            )}
            <CodeBlock lang={files[tab].lang} code={files[tab].content} readOnly />
          </>
        )}
        {!loading && state && !state.readme && files.length === 0 && !state.error && (
          <p className="n-empty">Nothing fetchable found in that folder.</p>
        )}
      </div>
    </details>
  );
}
