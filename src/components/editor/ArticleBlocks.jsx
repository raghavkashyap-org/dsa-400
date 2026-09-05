import React, { useMemo, useState } from 'react';
import { engine, opsLogAt, fmtN, fmtOps, fmtDur, opsGrade } from '../../lib/complexity';

/* Renders the optional structured blocks of an article:
   example (input/output/explanation) · complexity (interactive growth chart
   with an n-slider) · pattern recognition (free text) · mistakes (free text). */

/* ── fixed log–log chart: x = log10(n) 0..6, y = log10(ops) 0..18 ── */
const YMAX = 18, XMAX = 6, K = 96;

function ComplexityChart({ notation, color, label, n }) {
  const { f, ok } = useMemo(() => engine(notation), [notation]);

  const W = 300, H = 168, L = 34, R = 12, T = 14, B = 26;
  const pw = W - L - R, ph = H - T - B;
  const X = lv => L + (lv / XMAX) * pw;
  const Y = lv => T + ph - (Math.max(0, Math.min(YMAX, lv)) / YMAX) * ph;

  let path = '', area = '', marker = null;
  if (ok) {
    let d = '', dArea = '';
    for (let k = 0; k <= K; k++) {
      const lv = (XMAX * k) / K;                 // log10 n from 0..6
      const y = opsLogAt(f, Math.pow(10, lv)) ?? 0;
      const yc = Y(y);
      d += (k ? 'L' : 'M') + X(lv).toFixed(1) + ' ' + yc.toFixed(1) + ' ';
      dArea += (k ? 'L' : 'M') + X(lv).toFixed(1) + ' ' + yc.toFixed(1) + ' ';
    }
    path = d;
    area = dArea + 'L' + X(XMAX).toFixed(1) + ' ' + Y(0).toFixed(1) + ' L' + X(0).toFixed(1) + ' ' + Y(0).toFixed(1) + ' Z';
    if (n >= 1) {
      const y = opsLogAt(f, n) ?? 0;
      marker = { x: X(Math.log10(Math.min(n, 1e6))), y: Y(y) };
    }
  }

  const refY = Y(7); // 10^7 ops ≈ 1 second
  const gridYs = [0, 6, 12, 18];
  const gridXs = [0, 3, 6];
  const gid = 'cxg' + (label === 'Time' ? 't' : 's') + color.replace('#', '');
  const cur = ok ? (opsLogAt(f, n) ?? null) : null;
  const grade = opsGrade(cur);

  return (
    <div className="n-cx-panel">
      <div className="n-cx-title">
        <span className="n-cx-dot" style={{ background: color }} />
        <b>{label}</b>
        <code className="n-cx-notation">{notation}</code>
        <span className={`n-cx-grade ${grade ? grade.cls : ''}`}>{grade ? grade.txt : ''}</span>
      </div>

      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label} growth chart for ${notation}`}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.45" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {gridYs.map(y => (
          <g key={'gy' + y}>
            <line x1={L} y1={Y(y)} x2={W - R} y2={Y(y)} stroke="rgba(255,255,255,.09)" strokeDasharray="3 5" />
            <text x={L - 5} y={Y(y) + 3} textAnchor="end" fontSize="8" fill="rgba(255,255,255,.45)">10{y === 0 ? '⁰' : '^' + y}</text>
          </g>
        ))}
        {gridXs.map(x => (
          <text key={'gx' + x} x={X(x)} y={H - 9} textAnchor="middle" fontSize="8" fill="rgba(255,255,255,.45)">
            {x === 0 ? '1' : x === 3 ? '10³' : '10⁶'}
          </text>
        ))}
        <line x1={X(0)} y1={Y(0)} x2={X(XMAX)} y2={Y(0)} stroke="rgba(255,255,255,.28)" />
        <line x1={X(0)} y1={T} x2={X(0)} y2={Y(0)} stroke="rgba(255,255,255,.18)" />
        <line x1={L} y1={refY} x2={W - R} y2={refY} stroke="rgba(255,255,255,.5)" strokeDasharray="5 4" />
        <text x={W - R} y={refY - 3} textAnchor="end" fontSize="8" fill="rgba(255,255,255,.55)">10⁷ ops ≈ 1 s</text>

        {area && <path d={area} fill={`url(#${gid})`} />}
        {path && <path d={path} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />}
        {marker && (
          <g>
            <line x1={marker.x} y1={Y(0)} x2={marker.x} y2={T} stroke={color} strokeOpacity=".35" strokeDasharray="2 3" />
            <circle cx={marker.x} cy={marker.y} r="3.4" fill={color} stroke="#0b0b0f" strokeWidth="1.5" />
          </g>
        )}
        {!ok && <text x={L + pw / 2} y={T + ph / 2} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,.4)">couldn't parse — showing guide</text>}
      </svg>

      <div className="n-cx-readout">
        <span>ops <b>{fmtOps(cur)}</b></span>
        <span>@10⁷/s <b>{fmtDur(ok && cur != null ? Math.pow(10, cur) : null)}</b></span>
      </div>
    </div>
  );
}

export function ComplexityBlock({ time, space }) {
  const [n, setN] = useState(100000); // 10^5 default
  const nToV = nn => (nn <= 1 ? 0 : Math.log10(Math.min(nn, 1e6)));
  const vToN = v => (v <= 0 ? 1 : Math.round(Math.pow(10, v)));

  return (
    <details className="n-block n-block-cx" open>
      <summary>📈 Time &amp; Space complexity</summary>

      <div className="n-cx-slider">
        <div className="n-cx-slider-h">
          <span>input size <b>n = {fmtN(n)}</b> elements</span>
          <span className="n-cx-slider-sub">drag to see how ops grow (log scale, 1 → 10⁶)</span>
        </div>
        <input
          type="range" className="n-range" min="0" max="6" step="0.01"
          value={nToV(n)}
          onChange={e => setN(vToN(parseFloat(e.target.value)))}
          aria-label="input size"
        />
        <div className="n-range-ticks">
          <span>1</span><span>10</span><span>10²</span><span>10³</span><span>10⁴</span><span>10⁵</span><span>10⁶</span>
        </div>
        <div className="n-cx-zero">n = 0 → nothing to process (0 ops)</div>
      </div>

      <div className="n-cx-grid">
        {time && <ComplexityChart notation={time} color="#fb923c" label="Time" n={n} />}
        {space && <ComplexityChart notation={space} color="#38bdf8" label="Space" n={n} />}
      </div>

      <div className="n-cx-badges">
        {time && <span className="n-badge">⏱ Time <b>{time}</b></span>}
        {space && <span className="n-badge">💾 Space <b>{space}</b></span>}
      </div>
    </details>
  );
}

function ExampleBlock({ ex }) {
  const has = ex && (ex.input || ex.output || ex.explanation);
  if (!has) return null;
  return (
    <div className="n-block n-block-ex">
      <div className="n-block-h">📌 Example</div>
      {ex.input != null && ex.input !== '' && (
        <div className="n-ex-row"><span className="n-ex-tag">input</span><pre className="n-ex-pre">{ex.input}</pre></div>
      )}
      {ex.output != null && ex.output !== '' && (
        <div className="n-ex-row"><span className="n-ex-tag out">output</span><pre className="n-ex-pre">{ex.output}</pre></div>
      )}
      {ex.explanation && <p className="n-ex-expl">{ex.explanation}</p>}
    </div>
  );
}

function PatternBlock({ text }) {
  if (!text) return null;
  return (
    <div className="n-block n-block-pat">
      <div className="n-block-h">🧩 Pattern recognition</div>
      <p className="n-block-body">{text}</p>
    </div>
  );
}

function MistakesBlock({ text }) {
  if (!text) return null;
  return (
    <div className="n-block n-block-mistake">
      <div className="n-block-h">⚠️ Mistakes I made</div>
      <p className="n-block-body">{text}</p>
    </div>
  );
}

export default function ArticleBlocks({ blocks }) {
  if (!blocks) return null;
  const ex = blocks.example;
  const cx = blocks.complexity;
  const hasEx = ex && (ex.input || ex.output || ex.explanation);
  const hasCx = cx && (cx.time || cx.space);
  const hasPat = !!(blocks.pattern && String(blocks.pattern).trim());
  const hasMist = !!(blocks.mistakes && String(blocks.mistakes).trim());
  if (!hasEx && !hasCx && !hasPat && !hasMist) return null;
  return (
    <div className="n-blocks">
      {hasEx && <ExampleBlock ex={ex} />}
      {hasCx && <ComplexityBlock time={cx.time} space={cx.space} />}
      {hasPat && <PatternBlock text={blocks.pattern} />}
      {hasMist && <MistakesBlock text={blocks.mistakes} />}
    </div>
  );
}
