import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { loadArticle } from '../lib/articles';
import { renderMarkdown, extractYouTubeId } from '../lib/note-mdx';
import { VideoEmbed } from '../components/editor/VideoEmbed';
import GitHubSection from '../components/editor/GitHubSection';
import ArticleBlocks from '../components/editor/ArticleBlocks';
import { pretty } from '../lib/utils';

export default function NoteView() {
  const { slug } = useParams();
  const [art, setArt] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ok | notfound

  useEffect(() => {
    let alive = true;
    loadArticle(slug).then(a => { if (alive) { setArt(a); setStatus(a ? 'ok' : 'notfound'); } });
    return () => { alive = false; };
  }, [slug]);

  const videoId = useMemo(() => (art && art.videoUrl ? extractYouTubeId(art.videoUrl) : null), [art]);
  const hasUserCode = useMemo(() => art ? /```/.test(art.contentMarkdown || '') : false, [art]);

  if (status === 'loading') {
    return <div className="n-page" data-theme="orange" style={{ display: 'grid', placeItems: 'center' }}>LOADING ARTICLE…</div>;
  }
  if (status === 'notfound' || !art) {
    return (
      <div className="n-page" data-theme="orange">
        <main className="n-shell" style={{ textAlign: 'center', padding: '80px 20px' }}>
          <h1 style={{ color: 'var(--no-400)' }}>Article not found</h1>
          <p className="n-empty">No published note matches “{slug}”.</p>
          <Link className="n-btn n-btn-primary" to="/note" style={{ display: 'inline-flex' }}>Write your own →</Link>
        </main>
      </div>
    );
  }

  return (
    <div className="n-page" data-theme="orange">
      <header className="n-topbar">
        <div className="n-brand"><span className="n-logo">◈</span> DSA·400 <em>· Daily Coding Notes</em></div>
        <div className="n-toplinks">
          <Link className="n-link" to="/note">✍ Write a note</Link>
          <Link className="n-link" to="/">Tracker</Link>
        </div>
      </header>

      <main className="n-shell n-article">
        <div className="n-art-meta">
          <span className="n-streak">🔥 Day {art.dayStreak}</span>
          <span className="n-art-date">{pretty(art.date)}</span>
        </div>
        <h1 className="n-art-title">{art.title}</h1>
        {art.tags && art.tags.length > 0 && (
          <div className="n-tags">{art.tags.map((t, i) => <span key={i} className="n-chip">{t}</span>)}</div>
        )}

        {videoId && <VideoEmbed videoId={videoId} title={art.title} />}

        {art.githubUrl && (
          <div style={{ marginBottom: 14 }}>
            <GitHubSection url={art.githubUrl} autoExpand={!hasUserCode} />
          </div>
        )}

        <article className="n-art-body">
          {renderMarkdown(art.contentMarkdown, { readOnly: true })}
          <ArticleBlocks blocks={art.blocks} />
        </article>

        <footer className="n-art-foot">
          <span>published via DSA·400 Daily Notes · {art.slug}</span>
        </footer>
      </main>
    </div>
  );
}
