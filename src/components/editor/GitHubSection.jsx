import { useEffect, useState } from 'react';
import { parseGithubUrl, fetchGithub } from '../../lib/github';
import { renderMarkdown } from '../../lib/note-mdx';
import CodeBlock from './CodeBlock';

/* Loads the problem's README + solution code from a GitHub folder link.
   autoExpand: show the solutions inline when the article has no code of its own;
   otherwise keep them tucked behind a "view GitHub solution" toggle. */
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

  if (!url) return null;
  if (!parsed) {
    return <div className="n-block n-block-mistake"><div className="n-block-h">📦 GitHub source</div><p className="n-block-body">{url} — not a recognised GitHub link.</p></div>;
  }

  const loading = state === null;
  const files = state ? state.files || [] : [];

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

        {/* README */}
        {state && state.readme && (
          <details className="n-gh-readme" open>
            <summary>📄 {state.readmeName || 'README.md'}</summary>
            <div className="n-gh-readme-body">
              {renderMarkdown(state.readme, { readOnly: true })}
            </div>
          </details>
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
