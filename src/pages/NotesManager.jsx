import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, displayName } from '../context/AuthContext';
import { listArticles, deleteArticle, userSlug } from '../lib/articles';
import { formatIST, pretty } from '../lib/utils';
import { toast } from '../lib/toast';

/* Manage all published articles: open, edit, download JSON, delete. */
export default function NotesManager() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState(false);
  const username = userSlug(displayName(user));

  useEffect(() => {
    let alive = true;
    listArticles(user?.id, username).then(l => { if (alive) setItems(l); });
    return () => { alive = false; };
  }, [user?.id, username]);

  const artLink = a => `/note/${encodeURIComponent(a.username || username || '_')}/${encodeURIComponent(a.slug)}`;

  const doDelete = async a => {
    if (!window.confirm(`Delete “${a.title}”? This cannot be undone.`)) return;
    setBusy(true);
    await deleteArticle(a.slug, a.username || username);
    setItems(items.filter(x => x.slug !== a.slug));
    setBusy(false);
    toast(`<b>Deleted</b> ${a.title}.`);
  };

  const downloadJson = a => {
    const blob = new Blob([JSON.stringify(a, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${a.slug}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="n-page" data-theme="orange">
      <div className="n-bg" aria-hidden="true"><div className="n-orb n-orb-1" /><div className="n-orb n-orb-2" /><div className="n-grid" /><div className="n-vig" /></div>

      <header className="n-topbar">
        <div className="n-brand"><span className="n-logo">◈</span> DSA·400 <em>· My Published Articles</em></div>
        <div className="n-toplinks">
          <Link className="n-link" to="/note">✍ Write new</Link>
          <Link className="n-link" to="/">Tracker</Link>
        </div>
      </header>

      <main className="n-shell" style={{ maxWidth: 920 }}>
        <div className="n-art-meta" style={{ marginTop: 6 }}>
          <span className="n-streak">📚 {items ? items.length : '…'} published</span>
          <span className="n-art-date">times in IST (Asia/Kolkata)</span>
        </div>

        {items === null && <p className="n-empty">Loading articles…</p>}

        {items && items.length === 0 && (
          <div className="n-pane" style={{ textAlign: 'center', padding: 40 }}>
            <p className="n-empty">No articles published yet.</p>
            <Link className="n-btn n-btn-primary" to="/note" style={{ display: 'inline-flex', marginTop: 12 }}>✍ Write your first article</Link>
          </div>
        )}

        {items && items.length > 0 && (
          <div className="n-list">
            {items.map(a => (
              <article className="n-list-item" key={a.slug}>
                <div className="n-list-main">
                  <div className="n-list-title">
                    <Link to={artLink(a)}>{a.title}</Link>
                    {!a.isPublished && <span className="n-chip">draft</span>}
                  </div>
                  <div className="n-list-sub">
                    <span className="n-streak">🔥 Day {a.dayStreak}</span>
                    <span>📅 {pretty(a.date)}</span>
                    <span className="cx">/note/{a.username || '_'}/{a.slug}</span>
                    {a.tags && a.tags.length > 0 && <span>{a.tags.join(' · ')}</span>}
                  </div>
                  {a.updatedAt && <div className="n-list-upd">updated {formatIST(a.updatedAt)} (IST)</div>}
                </div>
                <div className="n-list-actions">
                  <a className="n-btn n-btn-ghost n-btn-sm" href={artLink(a)} target="_blank" rel="noopener noreferrer">open ↗</a>
                  <button className="n-btn n-btn-ghost n-btn-sm" onClick={() => nav(`/note?edit=${encodeURIComponent(a.slug)}`)}>edit</button>
                  <button className="n-btn n-btn-ghost n-btn-sm" onClick={() => downloadJson(a)}>json</button>
                  <button className="n-btn n-btn-danger n-btn-sm" disabled={busy} onClick={() => doDelete(a)}>delete</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
