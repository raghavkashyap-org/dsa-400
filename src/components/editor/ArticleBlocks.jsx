import React from 'react';

/* Renders the optional structured blocks of an article:
   example (input/output/explanation) · complexity (badges + growth charts) ·
   pattern recognition (free text) · mistakes (free text). */

/* ── growth-curve parsing for complexity notation ── */
function curveFor(notation) {
  const s = String(notation || '').toLowerCase().replace(/[\s*·]/g, '');
  if (s.includes('n!')) return 'nf';
  if (s.includes('2^n') || s.includes('2n')) return 'exp';
  if (s.includes('n^3') || s.includes('n³')) return 'n3';
  if (s.includes('n^2') || s.includes('n²') || s.includes('nm') || s.includes('n*m')) return 'n2';
  if (s.includes('nlogn') || s.includes('nlog')) return 'nlogn';
  if (s.includes('log')) return 'logn';
  if (s.includes('sqrt') || s.includes('√')) return 'sqrt';
  if (s.includes('n')) return 'n';
  return 'c1';
}

const N_MAX = 24;
function series(key) {
  const vals = [];
  for (let n = 1; n <= N_MAX; n++) {
    let v;
    switch (key) {
      case 'c1': v = 1; break;
      case 'logn': v = Math.log2(n); break;
      case 'sqrt': v = Math.sqrt(n); break;
      case 'n': v = n; break;
      case 'nlogn': v = n * Math.log2(n + 0.01); break;
      case 'n2': v = n * n; break;
      case 'n3': v = n * n * n; break;
      case 'exp': v = Math.pow(2, n); break;
      case 'nf': v = Math.pow(n, n); break;
      default: v = n;
    }
    vals.push(v);
  }
  const max = Math.max(...vals, 1e-9);
  return vals.map(v => v / max);
}

function Sparkline({ notation, color, label }) {
  const pts = series(curveFor(notation));
  const W = 210, H = 64, pad = 6;
  const step = (W - pad * 2) / (pts.length - 1);
  const coords = pts.map((v, i) => [pad + i * step, H - pad - v * (H - pad * 2)]);
  const path = coords.map(([x, y], i) => (i === 0 ? `M${x.toFixed(1)},${y.toFixed(1)}` : `L${x.toFixed(1)},${y.toFixed(1)}`)).join(' ');
  const area = `${path} L${(pad + (pts.length - 1) * step).toFixed(1)},${H - pad} L${pad},${H - pad} Z`;
  const gid = 'g' + (notation || 'x').replace(/[^a-z0-9]/gi, '') + color.replace('#', '');
  return (
    <div className="n-spark">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label} growth chart`}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.5" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="rgba(255,255,255,.12)" />
        <path d={area} fill={`url(#${gid})`} />
        <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="n-spark-cap"><b style={{ color }}>{label}</b><span>{notation}</span></div>
    </div>
  );
}

export function ComplexityBlock({ time, space }) {
  if (!time && !space) return null;
  return (
    <details className="n-block n-block-cx" open>
      <summary>📈 Time &amp; Space complexity</summary>
      <div className="n-cx-grid">
        {time ? <Sparkline notation={time} color="#fb923c" label="Time" /> : <div className="n-spark" />}
        {space ? <Sparkline notation={space} color="#38bdf8" label="Space" /> : <div className="n-spark" />}
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
