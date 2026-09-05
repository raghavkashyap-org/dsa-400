import React, { useMemo, useState } from 'react';
import { engine, opsLogAt, fmtN, fmtOps, fmtDur, opsGrade } from '../../lib/complexity';

/* Renders the optional structured blocks of an article:
   example (input/output/explanation) · complexity (interactive growth chart
   with an n-slider and editor-only axis controls) · pattern · mistakes.

   The complexity axes are AUTHOR-CONTROLLED at edit time:
     - Horizontal  n   : range 0 → 10⁹  + a list of n values   (e.g. 2, 12, 18, 24)
     - Vertical  ops   : range 0 → 10¹² + a list of ops values (e.g. 3, 15, 30, 45)
   Each list draws reference lines on the chart and a readout of the
   operations at every listed n, so the behaviour at specific points is
   always visible. Values accept 10^k / 1e6 / plain numbers.             */

const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
const sup = n => String(n).split('').map(d => SUP[d] ?? d).join('');
const fmtLog = v => v <= 0 ? '1' : (Number.isInteger(v) ? `10${sup(v)}` : `10^${v.toFixed(1)}`);

const DEFAULT_AXIS = { nMax: 1e6, opsMax: 1e12, nMarksRaw: '', opsMarksRaw: '' };

/* parse "2, 12, 10^6, 1e6, 10^6.5" → [2, 12, 1e6, 1e6, 3162277…] */
function parseNumList(str) {
  if (!str) return [];
  const out = [];
  for (const part of String(str).split(/[,;\s]+/)) {
    if (!part) continue;
    const t = part.trim();
    let m = t.match(/^10\s*\^\s*(-?[\d.]+)$/i);
    if (m) { out.push(Math.pow(10, parseFloat(m[1]))); continue; }
    m = t.match(/^([\d.]+)\s*[eE]\s*([+-]?\d+)$/);
    if (m) { out.push(parseFloat(m[1]) * Math.pow(10, parseInt(m[2], 10))); continue; }
    const v = parseFloat(t);
    if (Number.isFinite(v) && v >= 0) out.push(v);
  }
  return out;
}

/* integer log-grid ticks within [0, maxLog], at most ~6 */
function logTicks(maxLog) {
  const ticks = [];
  const step = Math.max(1, Math.ceil(maxLog / 5));
  for (let v = 0; v < maxLog - 1e-9; v += step) ticks.push(v);
  if (ticks.length === 0 || ticks[ticks.length - 1] < maxLog - 1e-9) ticks.push(maxLog);
  return ticks;
}

function ComplexityChart({ notation, color, label, n, axis, nMarks, opsMarks }) {
  const { f, ok } = useMemo(() => engine(notation), [notation]);
  const nMax = Math.max(10, axis.nMax || DEFAULT_AXIS.nMax);
  const opsMax = Math.max(10, axis.opsMax || DEFAULT_AXIS.opsMax);
  const XMAX = Math.log10(nMax);
  const YMAX = Math.log10(opsMax);

  const W = 300, H = 168, L = 36, R = 12, T = 14, B = 26;
  const pw = W - L - R, ph = H - T - B;
  const X = lv => L + (Math.min(lv, XMAX) / XMAX) * pw;
  const Y = lv => T + ph - (Math.max(0, Math.min(YMAX, lv)) / YMAX) * ph;

  let path = '', area = '', marker = null;
  if (ok) {
    let d = '', dArea = '';
    const K = 96;
    for (let k = 0; k <= K; k++) {
      const lv = (XMAX * k) / K;
      const y = opsLogAt(f, Math.pow(10, lv)) ?? 0;
      const yc = Y(y);
      d += (k ? 'L' : 'M') + X(lv).toFixed(1) + ' ' + yc.toFixed(1) + ' ';
      dArea += (k ? 'L' : 'M') + X(lv).toFixed(1) + ' ' + yc.toFixed(1) + ' ';
    }
    path = d;
    area = dArea + 'L' + X(XMAX).toFixed(1) + ' ' + Y(0).toFixed(1) + ' L' + X(0).toFixed(1) + ' ' + Y(0).toFixed(1) + ' Z';
    if (n >= 1) {
      const y = opsLogAt(f, Math.min(n, nMax)) ?? 0;
      marker = { x: X(Math.log10(Math.min(n, nMax))), y: Y(y) };
    }
  }

  const refY = 7 <= YMAX ? Y(7) : null; // 10^7 ops ≈ 1 s (only when in range)
  const yTicks = logTicks(YMAX);
  const xTicks = logTicks(XMAX);
  const gid = 'cxg' + (label === 'Time' ? 't' : 's') + color.replace('#', '');
  const cur = ok ? (opsLogAt(f, Math.min(n, nMax)) ?? null) : null;
  const grade = opsGrade(cur);

  const nMarkLines = (nMarks || []).filter(v => v >= 1 && v <= nMax);
  const opsMarkLines = (opsMarks || []).filter(v => v >= 1 && v <= opsMax);
  const short = v => (v >= 1e6 ? fmtLog(Math.log10(v)) : String(Math.round(v * 10) / 10));

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
        {yTicks.map(y => (
          <g key={'gy' + y}>
            <line x1={L} y1={Y(y)} x2={W - R} y2={Y(y)} stroke="rgba(255,255,255,.09)" strokeDasharray="3 5" />
            <text x={L - 5} y={Y(y) + 3} textAnchor="end" fontSize="8" fill="rgba(255,255,255,.45)">{fmtLog(y)}</text>
          </g>
        ))}
        {xTicks.map(x => (
          <text key={'gx' + x} x={X(x)} y={H - 9} textAnchor="middle" fontSize="8" fill="rgba(255,255,255,.45)">{fmtLog(x)}</text>
        ))}
        <line x1={X(0)} y1={Y(0)} x2={X(XMAX)} y2={Y(0)} stroke="rgba(255,255,255,.28)" />
        <line x1={X(0)} y1={T} x2={X(0)} y2={Y(0)} stroke="rgba(255,255,255,.18)" />
        {refY != null && (
          <>
            <line x1={L} y1={refY} x2={W - R} y2={refY} stroke="rgba(255,255,255,.5)" strokeDasharray="5 4" />
            <text x={W - R} y={refY - 3} textAnchor="end" fontSize="8" fill="rgba(255,255,255,.55)">10⁷ ops ≈ 1 s</text>
          </>
        )}
        <text x={W - R} y={T + 8} textAnchor="end" fontSize="8" fill="rgba(255,255,255,.4)">ops</text>

        {/* user-set horizontal reference lines (n values) */}
        {nMarkLines.map((v, i) => (
          <g key={'nm' + i}>
            <line x1={X(Math.log10(v))} y1={T} x2={X(Math.log10(v))} y2={Y(0)} stroke={color} strokeOpacity=".4" strokeDasharray="2 3" />
            <text x={X(Math.log10(v))} y={T + 7} textAnchor="middle" fontSize="7" fill={color}>{short(v)}</text>
          </g>
        ))}
        {/* user-set horizontal reference lines (ops values) */}
        {opsMarkLines.map((v, i) => (
          <g key={'om' + i}>
            <line x1={L} y1={Y(Math.log10(v))} x2={W - R} y2={Y(Math.log10(v))} stroke="rgba(255,255,255,.4)" strokeDasharray="2 3" />
            <text x={L + 2} y={Y(Math.log10(v)) - 2} fontSize="7" fill="rgba(255,255,255,.55)">{short(v)}</text>
          </g>
        ))}

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
        <span>n = <b>{fmtN(n)}</b></span>
        <span>ops <b>{fmtOps(cur)}</b></span>
        <span>@10⁷/s <b>{fmtDur(ok && cur != null ? Math.pow(10, cur) : null)}</b></span>
      </div>

      {/* ops at each user-set n value — the "see the behaviour" readout */}
      {nMarks && nMarks.length > 0 && (
        <div className="n-cx-marks">
          {nMarks.map((v, i) => {
            const op = ok ? opsLogAt(f, v) : null;
            return (
              <span key={i}>n = {fmtN(v)} → <b>{fmtOps(op)}</b> ops</span>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ComplexityBlock({ time, space, axis = {}, editable = false, onAxisChange }) {
  const nMax = Math.max(10, axis.nMax || DEFAULT_AXIS.nMax);
  const opsMax = Math.max(10, axis.opsMax || DEFAULT_AXIS.opsMax);
  const nMarks = useMemo(() => parseNumList(axis.nMarksRaw), [axis.nMarksRaw]);
  const opsMarks = useMemo(() => parseNumList(axis.opsMarksRaw), [axis.opsMarksRaw]);
  const [nRaw, setN] = useState(() => Math.min(100000, nMax));
  const n = Math.min(nRaw, nMax);

  const nToV = nn => (nn <= 1 ? 0 : Math.log10(Math.min(nn, nMax)));
  const vToN = v => (v <= 0 ? 1 : Math.round(Math.pow(10, v)));

  const setAxis = patch => onAxisChange && onAxisChange({ ...axis, ...patch });

  return (
    <details className="n-block n-block-cx" open>
      <summary>📈 Time &amp; Space complexity</summary>

      {editable && (
        <div className="n-cx-axis">
          <label className="n-cx-axis-row">
            <span>Horizontal — n up to <b>{fmtLog(Math.log10(nMax))}</b></span>
            <input type="range" min="0" max="9" step="0.1"
              value={Math.log10(nMax)}
              onChange={e => setAxis({ nMax: Math.pow(10, +e.target.value) })} />
            <em>1 → 10⁹ elements</em>
          </label>
          <label className="n-cx-axis-row">
            <span>n values to mark</span>
            <input className="n-in n-cx-mark-in"
              value={axis.nMarksRaw || ''}
              onChange={e => setAxis({ nMarksRaw: e.target.value })}
              placeholder="e.g. 2, 12, 18, 24   (or 10^2, 10^3, 10^6)" />
            <em>comma-separated</em>
          </label>
          <label className="n-cx-axis-row">
            <span>Vertical — ops up to <b>{fmtLog(Math.log10(opsMax))}</b></span>
            <input type="range" min="0" max="12" step="0.1"
              value={Math.log10(opsMax)}
              onChange={e => setAxis({ opsMax: Math.pow(10, +e.target.value) })} />
            <em>1 → 10¹² operations</em>
          </label>
          <label className="n-cx-axis-row">
            <span>ops values to mark</span>
            <input className="n-in n-cx-mark-in"
              value={axis.opsMarksRaw || ''}
              onChange={e => setAxis({ opsMarksRaw: e.target.value })}
              placeholder="e.g. 3, 15, 30, 45   (or 10^3, 10^6, 10^9)" />
            <em>comma-separated</em>
          </label>
        </div>
      )}

      <div className="n-cx-slider">
        <div className="n-cx-slider-h">
          <span>input size <b>n = {fmtN(n)}</b> elements</span>
          <span className="n-cx-slider-sub">drag to see how ops grow (log scale, 1 → {fmtLog(Math.log10(nMax))})</span>
        </div>
        <input
          type="range" className="n-range" min="0" max={Math.log10(nMax)} step={Math.log10(nMax) / 600}
          value={nToV(n)}
          onChange={e => setN(vToN(parseFloat(e.target.value)))}
          aria-label="input size"
        />
        <div className="n-range-ticks">
          {xTicksFor(nMax).map(t => <span key={t}>{fmtLog(t)}</span>)}
        </div>
        <div className="n-cx-zero">n = 0 → nothing to process (0 ops)</div>
      </div>

      <div className="n-cx-grid">
        {time && <ComplexityChart notation={time} color="#fb923c" label="Time" n={n} axis={{ nMax, opsMax }} nMarks={nMarks} opsMarks={opsMarks} />}
        {space && <ComplexityChart notation={space} color="#38bdf8" label="Space" n={n} axis={{ nMax, opsMax }} nMarks={nMarks} opsMarks={opsMarks} />}
      </div>

      <div className="n-cx-badges">
        {time && <span className="n-badge">⏱ Time <b>{time}</b></span>}
        {space && <span className="n-badge">💾 Space <b>{space}</b></span>}
      </div>
    </details>
  );
}

/* log ticks for the n slider (spread across the whole range) */
function xTicksFor(nMax) {
  const XMAX = Math.log10(Math.max(10, nMax));
  const ticks = [];
  const step = Math.max(1, Math.ceil(XMAX / 6));
  for (let v = 0; v < XMAX - 1e-9; v += step) ticks.push(v);
  if (ticks.length === 0 || ticks[ticks.length - 1] < XMAX - 1e-9) ticks.push(XMAX);
  return ticks;
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

export default function ArticleBlocks({ blocks, editable = false, onComplexityAxis }) {
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
      {hasCx && (
        <ComplexityBlock
          time={cx.time} space={cx.space} axis={cx.axis || {}}
          editable={editable} onAxisChange={onComplexityAxis}
        />
      )}
      {hasPat && <PatternBlock text={blocks.pattern} />}
      {hasMist && <MistakesBlock text={blocks.mistakes} />}
    </div>
  );
}
