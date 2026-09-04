import { useMemo, useState } from 'react';
import { TRACKER_DATA } from '../lib/tracker-data';
import { effectiveItems } from '../hooks/useTrackerData';
import { extraLabel } from '../lib/utils';

const UNITS = TRACKER_DATA.units;
const DAYS = TRACKER_DATA.days;
const byDay = id => DAYS[id - 1];

export default function PlanPanel({ s, onOpenDay }) {
  const [f, setF] = useState({ q: '', judge: 'all', status: 'all', mine: false });

  const match = (d, items) => {
    if (f.mine && !items.some(i => i.kind === 'extra')) return false;
    if (f.judge !== 'all' && !items.some(i => (i.kind === 'extra' ? 'USER' : i.j) === f.judge)) return false;
    if (f.status === 'open' && (s.sealed[d.id] || s.excluded[d.id])) return false;
    if (f.status === 'done' && !s.sealed[d.id]) return false;
    if (f.q) {
      const hay = (d.concept + ' ' + d.unit + ' day ' + d.id + ' ' + items.map(i => i.n).join(' ')).toLowerCase();
      if (!hay.includes(f.q)) return false;
    }
    return true;
  };

  const flip = (d, it, on) => {
    if (it.kind === 'extra') s.setExtraDone(it.extraId, on);
    else s.toggleProb(d.id, it.idx, on, { title: it.n });
  };

  return (
    <div>
      <div className="card plan-tools">
        <input className="search-in" placeholder="Search days — topic or question name…" value={f.q}
          onChange={e => setF({ ...f, q: e.target.value.trim().toLowerCase() })} />
        <div className="row" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {[['all', 'All'], ['LC', 'LeetCode'], ['GFG', 'GFG'], ['CSES', 'CSES'], ['CF', 'Codeforces'], ['USER', '＋ mine']].map(([k, label]) => (
            <button key={k} className={`chip ${f.judge === k ? 'on' : ''}`} onClick={() => setF({ ...f, judge: k, mine: k === 'USER' })}>{label}</button>
          ))}
        </div>
        <div className="row" style={{ display: 'flex', gap: 4 }}>
          {[['all', 'All'], ['open', 'Open'], ['done', 'Sealed']].map(([k, label]) => (
            <button key={k} className={`chip ${f.status === k ? 'on' : ''}`} onClick={() => setF({ ...f, status: k })}>{label}</button>
          ))}
        </div>
      </div>

      {UNITS.map((u, ui) => {
        const days = u.days.map(byDay);
        const rows = days.map(d => ({ d, items: effectiveItems(d, s, s.extras.filter(e => e.target_day === d.id)) }));
        const shown = rows.filter(r => match(r.d, r.items));
        if (shown.length === 0) return null;
        const doneN = days.filter(d => s.sealed[d.id]).length;
        const excludedAll = days.every(d => s.excluded[d.id]);
        const incN = days.filter(d => !s.excluded[d.id]).length;
        return (
          <details className="unit" key={ui} id={`unit-${ui}`} open={days.some(d => d.id === s.pointer)}>
            <summary className="unit-sum">
              <span className="u-caret">▶</span>
              <span>
                <span className="u-title">{u.title}</span><br />
                <span className="u-range">Days {u.days[0]}–{u.days[u.days.length - 1]}</span>
              </span>
              <span className="u-meta">
                <span className="u-bar"><i style={{ width: (100 * doneN / days.length) + '%' }} /></span>
                <span className="u-count">{doneN}/{days.length}</span>
                <span className="chip chip-ok" title="included days count toward your plan">✓ {incN} in</span>
                <span className="chip chip-neutral" title="optional days are skipped but stay logged">{days.length - incN} opt</span>
                <button className="chip" title={excludedAll ? 'Include this topic' : 'Make this topic optional'}
                  onClick={e => { e.preventDefault(); s.setUnitIncluded(ui, excludedAll); }}>
                  {excludedAll ? '＋ include' : 'optional'}
                </button>
              </span>
            </summary>
            <div className="u-days">
              {shown.map(({ d, items }) => (
                <article key={d.id} className={`day ${d.sun ? 'sun' : ''} ${s.sealed[d.id] ? 'is-sealed' : ''} ${s.excluded[d.id] ? 'off' : ''}`}>
                  <div className="day-top">
                    <span className="day-no">Day {d.id}</span>
                    {d.sun && <span className="chip chip-warn">Sun</span>}
                    <button className="open-chip" onClick={() => onOpenDay(d.id)}>OPEN →</button>
                  </div>
                  <button className="rm" title={s.excluded[d.id] ? 'Include this day' : 'Make this day optional'}
                    onClick={() => s.setDayIncluded(d.id, !!s.excluded[d.id])}>
                    {s.excluded[d.id] ? '＋' : '−'}
                  </button>
                  <div className="day-concept">{d.concept}</div>
                  {items.length ? (
                    <ul className="day-items">
                      {items.map(it => (
                        <li key={it.kind === 'extra' ? `x${it.extraId}` : it.idx} className={`pi ${it.done ? 'done' : ''}`}>
                          <button className="pi-ck" onClick={() => flip(d, it, !it.done)}>✓</button>
                          {it.u
                            ? <a className="pi-name" href={it.u} target="_blank" rel="noopener noreferrer">{it.kind === 'extra' ? extraLabel(it) : it.n}</a>
                            : <span className="pi-name">{it.kind === 'extra' ? extraLabel(it) : it.n}</span>}
                          {it.lc && <span className="lc-num">#{it.lc}</span>}
                          {it.kind === 'extra'
                            ? <span className="judge j-user">＋</span>
                            : <span className={`judge ${JC[it.j] || 'j-drill'}`}>{it.j || 'drill'}</span>}
                          {it.kind === 'original' && (
                            <button className="rm" title="Remove (logged — can re-add later)"
                              style={{ position: 'static', opacity: 1, marginLeft: 'auto' }}
                              onClick={() => s.removeItem(d.id, it.idx, { title: it.n, u: it.u })}>✕</button>
                          )}
                          {it.kind === 'extra' && (
                            <button className="rm" title="Delete this question"
                              style={{ position: 'static', opacity: 1 }}
                              onClick={() => s.removeExtra(it.extraId)}>✕</button>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : <div className="card-d" style={{ fontSize: 11.8 }}>Consolidation / review — seal when done.</div>}
                </article>
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}

const JC = { LC: 'j-lc', GFG: 'j-gfg', CSES: 'j-cses', CF: 'j-cf', SPOJ: 'j-spoj' };
