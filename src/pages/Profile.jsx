import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, displayName } from '../context/AuthContext';
import { useTrackerData, effectiveItems } from '../hooks/useTrackerData';
import { TRACKER_DATA } from '../lib/tracker-data';
import Nav from '../components/Nav';
import CommitmentCard from '../components/CommitmentCard';
import { pretty, todayIso, dayDiff, extraLabel } from '../lib/utils';
import { resolveImportToken, JCLS } from '../lib/import';
import { pickQuote } from '../lib/quotes';
import { toast } from '../lib/toast';

const UNITS = TRACKER_DATA.units;
const DAYS = TRACKER_DATA.days;

export default function Profile() {
  const { user, configured } = useAuth();
  const s = useTrackerData();
  const nav = useNavigate();
  const [imp, setImp] = useState('');
  const [impDay, setImpDay] = useState('');
  const [busy, setBusy] = useState(false);
  const [quote] = useState(() => pickQuote());

  const username = displayName(user) || 'you';
  const email = user?.email || '';

  const stats = useMemo(() => {
    const start = s.commitment?.start_date;
    const activeDays = DAYS.filter(d => !s.excluded[d.id]).length || 1;
    const sealed = DAYS.filter(d => !s.excluded[d.id] && s.sealed[d.id]).length;
    const pct = Math.round(100 * sealed / activeDays);
    const daysElapsed = start ? Math.max(1, Math.min(400, dayDiff(todayIso(), start) + 1)) : 1;
    const expected = Math.round(activeDays * daysElapsed / 400);
    const ahead = sealed - expected;
    const remaining = activeDays - sealed;
    const perDay = sealed / daysElapsed;
    const etaDays = perDay > 0 ? Math.ceil(remaining / perDay) : null;
    return { activeDays, sealed, pct, daysElapsed, ahead, remaining, etaDays };
  }, [s]);

  if (!s.ready) return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: 'var(--text-mute)' }}>LOADING…</div>;

  const progress = { sealed: stats.sealed, activeDays: stats.activeDays, streak: s.streak, best: s.best, solved: s.solvedCount };
  const later = s.extras.filter(e => e.status === 'later');
  const scheduled = s.extras.filter(e => e.status === 'scheduled');
  const doneExtras = s.extras.filter(e => e.status === 'done');

  /* import → live preview of what each line resolves to */
  const preview = imp.split(/[\n,;]+/).map(t => t.trim()).filter(Boolean).map(resolveImportToken).filter(Boolean);

  const doImport = async () => {
    const tokens = imp.split(/[\n,;]+/).map(t => t.trim()).filter(Boolean);
    if (!tokens.length) return;
    setBusy(true);
    let added = 0;
    for (const tok of tokens) {
      const r = resolveImportToken(tok);
      if (!r) continue;
      try {
        await s.addExtra({ lc: r.lc, title: r.title, url: r.url, platform: r.platform, targetDay: impDay ? +impDay : null });
        added++;
      } catch {}
    }
    setBusy(false);
    setImp('');
    toast(`<b>${added} question${added === 1 ? '' : 's'} added</b>${impDay ? ` to Day ${impDay}` : ' to your queue'} — now part of your plan.`);
  };

  const removed = [];
  for (const day of DAYS) {
    if (s.removed[day.id]) day.items.forEach((it, i) => { if (s.removed[day.id][i]) removed.push({ day: day.id, idx: i, title: it.n }); });
  }

  const jumpToTracker = () => {
    toast(`Plan saved — tracker is on <b>Day ${s.pointer}</b>.`);
    nav(`/?day=${s.pointer}`);
  };

  return (
    <>
      <Nav />
      <div id="bg" aria-hidden="true"><div className="orb orb-1" /><div className="orb orb-2" /><div id="bg-grid" /><div id="bg-vig" /></div>

      <div className="wrap sec">
        {/* ── identity hero ── */}
        <div className="card profile-hero">
          <div className="profile-id">
            <div className="avatar">{(username[0] || 'D').toUpperCase()}</div>
            <div>
              <div className="profile-name">{username}</div>
              <div className="profile-sub">{email || '—'}</div>
              <div className="profile-cid">{s.commitment?.commit_id || 'no commitment yet'}</div>
            </div>
          </div>
          <div className="profile-meta">
            <div className="pm-date"><span className="cert-l">Start</span><span className="pm-v">{s.commitment ? pretty(s.commitment.start_date) : '—'}</span></div>
            <div className="pm-date"><span className="cert-l">End</span><span className="pm-v">{s.commitment ? pretty(s.commitment.end_date) : '—'}</span></div>
            <div className="pm-date"><span className="cert-l">Days left</span><span className="pm-v">{stats.remaining}</span></div>
            <div className="pm-date"><span className="cert-l">Current day</span><span className="pm-v">Day {s.pointer}</span></div>
          </div>
        </div>

        {/* ── certificate ── */}
        {s.commitment
          ? <div style={{ marginTop: 16 }}><CommitmentCard commitment={s.commitment} username={username} progress={progress} /></div>
          : <div className="card" style={{ marginTop: 16, textAlign: 'center', padding: 26 }}>
              <p className="card-d">No commitment yet — finish onboarding first.</p>
              <Link className="btn btn-primary" to="/onboarding">Start onboarding →</Link>
            </div>}

        {/* ── stats + analysis ── */}
        <div className="prog-grid" style={{ marginTop: 20 }}>
          <div className="card metric"><div className="ml">Journey</div><div className="mv">{stats.pct}<small>%</small></div></div>
          <div className="card metric"><div className="ml">Days sealed</div><div className="mv">{stats.sealed}<small>/{stats.activeDays}</small></div></div>
          <div className="card metric"><div className="ml">Questions solved</div><div className="mv">{s.solvedCount}</div></div>
          <div className="card metric"><div className="ml">Streak</div><div className="mv">{s.streak}<small> d</small></div></div>
          <div className="card metric"><div className="ml">Best</div><div className="mv">{s.best}<small> d</small></div></div>
        </div>

        <div className="card analysis">
          <div className="card-t">Your trajectory</div>
          <p className="card-d">
            You are <b style={{ color: stats.ahead >= 0 ? 'var(--ok)' : 'var(--warn)' }}>
            {stats.ahead >= 0 ? `${stats.ahead} day${stats.ahead === 1 ? '' : 's'} ahead` : `${-stats.ahead} day${stats.ahead === -1 ? '' : 's'} behind`}</b> of your
            plan. {stats.etaDays != null
              ? <>At your current pace you finish in <b>{stats.etaDays} days</b>.</>
              : <>Seal your first day and I'll project your finish date.</>}
          </p>
          <div className="quote-line">“{quote}”</div>
        </div>

        {/* ── import & schedule ── */}
        <div className="card" style={{ marginTop: 14 }}>
          <div className="card-t">＋ Import questions into your plan</div>
          <p className="card-d" style={{ marginBottom: 10 }}>
            Paste LeetCode numbers (e.g. <code>460</code>), links from any platform, or <code>{'{link:Name:Question-no}'}</code>.
            Every number resolves to its real title &amp; link — <code>460</code> becomes <b>LFU Cache : 460</b>.
          </p>
          <textarea className="note-ta" style={{ minHeight: 70 }} placeholder={'e.g.\n460\n76\nhttps://codeforces.com/problemset/problem/4/A\nTwo Sum IV (BST)'} value={imp} onChange={e => setImp(e.target.value)} />
          {preview.length > 0 && (
            <div className="res-preview">
              {preview.map((r, i) => (
                <span key={i} className="res-chip">
                  {r.lc ? <span className="lc-id">#{r.lc}</span> : null}
                  {extraLabel(r)} <em>{r.platform}</em>
                </span>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <label className="cert-l">Schedule on day (blank = later)</label>
            <input type="number" min="1" max="400" className="jump-in" value={impDay} onChange={e => setImpDay(e.target.value)} placeholder="day" />
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={doImport}>Import &amp; schedule</button>
          </div>
        </div>

        {/* ── extras manager ── */}
        <div className="card" style={{ marginTop: 14 }}>
          <div className="card-t">Your imported questions ({s.extras.length})</div>
          {s.extras.length === 0 && <p className="card-d">None yet — import some above.</p>}
          <div className="tbl-wrap" style={{ border: 'none', marginTop: 8 }}>
            {s.extras.length > 0 && (
              <table>
                <thead><tr><th>Question</th><th>Platform</th><th>Schedule</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {[...scheduled, ...later, ...doneExtras].map(e => (
                    <tr key={e.id}>
                      <td>
                        {e.url ? <a href={e.url} target="_blank" rel="noopener noreferrer">{extraLabel(e)}</a> : extraLabel(e)}
                      </td>
                      <td><span className={`judge ${JCLS[e.platform] || 'j-user'}`}>{e.platform || 'OTHER'}</span></td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <input type="number" min="1" max="400" className="jump-in" style={{ width: 64 }}
                          defaultValue={e.target_day || ''} placeholder="—"
                          onBlur={ev => { const v = ev.target.value; if (v) s.scheduleExtra(e.id, +v); }} />
                      </td>
                      <td>
                        <span className={`chip ${e.status === 'done' ? 'chip-ok' : e.status === 'scheduled' ? '' : 'chip-neutral'}`}>
                          {e.status === 'done' ? 'done' : e.status === 'scheduled' ? `Day ${e.target_day}` : 'later'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button className="btn btn-soft btn-sm" onClick={() => s.setExtraDone(e.id, e.status !== 'done')}>{e.status === 'done' ? 'undo' : 'done'}</button>{' '}
                        <button className="btn btn-ghost btn-sm" onClick={() => { s.scheduleExtra(e.id, null); toast('Moved to “save for later”.'); }}>later</button>{' '}
                        <button className="btn btn-ghost btn-sm" onClick={() => s.removeExtra(e.id)}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ── plan editor: week → day → question ── */}
        <div className="card" style={{ marginTop: 14 }}>
          <div className="card-t">✎ Manage your plan — week by week, question by question</div>
          <p className="card-d" style={{ marginBottom: 8 }}>
            Expand a week, then make any day <b>optional</b> or <b>included</b>, remove or add individual questions.
            Changes apply instantly to the tracker dashboard. <b>Included</b> days count toward your 400;
            <b> optional</b> days are skipped (but stay logged, so you can bring them back anytime).
            If you drop a whole day, the tracker moves forward to your new current day.
          </p>
          {UNITS.map((u, ui) => {
            const days = u.days.map(d => DAYS[d - 1]);
            const incN = days.filter(d => !s.excluded[d.id]).length;
            const allExcluded = incN === 0;
            return (
              <details className="unit" key={ui} open={days.some(d => d.id === s.pointer)}>
                <summary className="unit-sum">
                  <span className="u-caret">▶</span>
                  <span>
                    <span className="u-title">{u.title}</span><br />
                    <span className="u-range">Days {u.days[0]}–{u.days[u.days.length - 1]}</span>
                  </span>
                  <span className="u-meta">
                    <span className="chip chip-ok" title="included days count toward your plan">✓ {incN} in</span>{' '}
                    <span className="chip chip-neutral" title="optional days are skipped but stay logged">{days.length - incN} opt</span>
                    <button className="chip" onClick={e => { e.preventDefault(); s.setUnitIncluded(ui, allExcluded); }}>
                      {allExcluded ? '＋ include all' : 'make all optional'}
                    </button>
                  </span>
                </summary>
                <div className="u-days">
                  {days.map(d => {
                    const items = effectiveItems(d, s, s.extras.filter(e => e.target_day === d.id));
                    return (
                      <div key={d.id} className={`day-edit ${s.excluded[d.id] ? 'off' : ''}`}>
                        <div className="day-edit-top">
                          <span className="day-no">Day {d.id}</span>
                          <span className="day-concept">{d.concept}</span>
                          <button className="chip" onClick={() => s.setDayIncluded(d.id, !!s.excluded[d.id])}>
                            {s.excluded[d.id] ? '＋ include' : 'optional'}
                          </button>
                        </div>
                        {items.length ? (
                          <ul className="day-items">
                            {items.map(it => (
                              <li key={it.kind === 'extra' ? `x${it.extraId}` : it.idx} className={`pi ${it.done ? 'done' : ''}`}>
                                {it.lc && it.u
                                  ? <a className="pi-name" href={it.u} target="_blank" rel="noopener noreferrer">{it.n}</a>
                                  : <span className="pi-name">{it.n}</span>}
                                {it.lc && (it.u
                                  ? <a className="lc-num" href={it.u} target="_blank" rel="noopener noreferrer">#{it.lc}</a>
                                  : <span className="lc-num">#{it.lc}</span>)}
                                {it.kind === 'extra'
                                  ? <span className="judge j-user">＋</span>
                                  : <span className={`judge ${JCLS[it.j] || 'j-drill'}`}>{it.j || 'drill'}</span>}
                                <button className="rm" style={{ position: 'static', opacity: 1, marginLeft: 'auto' }} title={it.kind === 'extra' ? 'Delete this question' : 'Remove (logged — can re-add later)'}
                                  onClick={() => it.kind === 'extra' ? s.removeExtra(it.extraId) : s.removeItem(d.id, it.idx, { title: it.n, u: it.u })}>✕</button>
                              </li>
                            ))}
                          </ul>
                        ) : <div className="card-d" style={{ fontSize: 11.8 }}>Consolidation / review — seal when done.</div>}
                        <DayAdder s={s} dayId={d.id} />
                      </div>
                    );
                  })}
                </div>
              </details>
            );
          })}

          {/* save & jump */}
          <div className="save-bar">
            <span>Current day in your plan: <b>Day {s.pointer}</b> — changes are already applied.</span>
            <button className="btn btn-primary" onClick={jumpToTracker}>✓ Save &amp; jump to Day {s.pointer} in the tracker →</button>
          </div>
        </div>

        {/* ── removed log ── */}
        <div className="card" style={{ marginTop: 14 }}>
          <div className="card-t">🗑 Removed questions (logged)</div>
          {removed.length === 0 && <p className="card-d">Nothing removed.</p>}
          {removed.length > 0 && (
            <div className="tbl-wrap" style={{ border: 'none', marginTop: 8 }}>
              <table>
                <thead><tr><th>Question</th><th>Day</th><th></th></tr></thead>
                <tbody>
                  {removed.map((r, i) => (
                    <tr key={i}><td>{r.title}</td><td className="cx">Day {r.day}</td>
                      <td style={{ textAlign: 'right' }}><button className="btn btn-soft btn-sm" onClick={() => s.restoreItem(r.day, r.idx)}>＋ restore</button></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ── inline "add a question to this day" row ── */
function DayAdder({ s, dayId }) {
  const [val, setVal] = useState('');
  const [busy, setBusy] = useState(false);
  const resolved = val.trim() ? resolveImportToken(val.trim()) : null;

  const add = async () => {
    if (!resolved) return;
    setBusy(true);
    try {
      await s.addExtra({ lc: resolved.lc, title: resolved.title, url: resolved.url, platform: resolved.platform, targetDay: dayId });
      toast(`Added <b>${extraLabel(resolved)}</b> to <b>Day ${dayId}</b>.`);
      setVal('');
    } catch (e) { toast('Could not add: ' + (e.message || 'error')); }
    setBusy(false);
  };

  return (
    <div className="day-adder">
      <input className="jump-in" style={{ flex: 1, minWidth: 160 }} placeholder={`Add to Day ${dayId} — 460, a link, or {link:Name:no}`} value={val} onChange={e => setVal(e.target.value)} />
      {resolved && <span className="res-chip">{resolved.lc ? <span className="lc-id">#{resolved.lc}</span> : null}{extraLabel(resolved)}</span>}
      <button className="btn btn-soft btn-sm" disabled={busy || !resolved} onClick={add}>＋ Add</button>
    </div>
  );
}
