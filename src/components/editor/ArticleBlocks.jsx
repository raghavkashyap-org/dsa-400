import React, { useId } from 'react';

/* Renders the optional structured blocks of an article:
   example (input/output/explanation) · complexity (badges + growth charts) ·
   pattern recognition (free text) · mistakes (free text). */

/* ═══════════════════════════════════════════════════════════════════════
   Dynamic big-O growth evaluator.
   Parses ARBITRARY complexity notation — O(n^4), O(n log n), O(n² + m),
   O(2^n), O(n!), O(√n), O(log n), O(n·m), O(1), … — into a normalized
   growth curve. No fixed lookup table: any expression gets a chart, and
   unparseable strings degrade to a flat guide instead of breaking.        */

const N_MAX = 24;

function factorial(n) {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

/* strip the O(…) / Θ(…) / Ω(…) wrapper and expand common shorthand */
function normalizeNotation(notation) {
  let s = String(notation || '').toLowerCase().replace(/\s+/g, '');
  s = s.replace(/^(?:bigo|big-o|o|theta|θ|omega|ω|t)\(/, '').replace(/\)$/, '');
  s = s.replace(/√/g, 'sqrt')
       .replace(/²/g, '^2').replace(/³/g, '^3')
       .replace(/[×·]/g, '*').replace(/[÷]/g, '/')
       .replace(/\*\*/g, '^');
  s = s.replace(/log2n/g, 'log2(n)')
       .replace(/log2/g, 'log2')
       .replace(/logn/g, 'log(n)')
       .replace(/logm/g, 'log')
       .replace(/sqrtn/g, 'sqrt(n)')
       .replace(/lnn/g, 'log(n)')
       .replace(/\bln\b/g, 'log');
  s = s.replace(/n([0-9]+)/g, 'n^$1'); // n2 → n^2, n4 → n^4 …
  return s;
}

function tokenize(s) {
  const toks = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c >= '0' && c <= '9') {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      toks.push({ t: 'num', v: parseFloat(s.slice(i, j)) });
      i = j;
    } else if (/[a-z]/.test(c)) {
      let j = i;
      while (j < s.length && /[a-z0-9]/.test(s[j])) j++;
      toks.push({ t: 'id', v: s.slice(i, j) });
      i = j;
    } else if ('+-*/^!()'.includes(c)) {
      toks.push({ t: c });
      i++;
    } else i++;
  }
  return toks;
}

/* insert * between adjacent operands (n log(n) → n * log(n)), but keep id( as a call */
function insertImplicitMul(toks) {
  const out = [];
  for (const t of toks) {
    if (out.length) {
      const p = out[out.length - 1].t;
      const operand = t.t === 'id' || t.t === 'num' || t.t === '(';
      const prevOp = p === 'num' || p === 'id' || p === ')';
      const isCall = p === 'id' && t.t === '(';
      if (prevOp && operand && !isCall) out.push({ t: '*' });
    }
    out.push(t);
  }
  return out;
}

function compileExpr(src) {
  const toks = insertImplicitMul(tokenize(src));
  if (!toks.length) return null;
  let i = 0;

  const idValue = id => {
    switch (id) {
      case 'log': case 'log2': case 'ln': return n => Math.log2(Math.max(n, 1));
      case 'sqrt': return n => Math.sqrt(Math.max(n, 0));
      case 'c': case 'const': case 'one': case 'k': return () => 1;
      default: return n => n; // unknown identifier → assume it scales with n
    }
  };

  const parseExpr = () => {
    let v = parseTerm();
    while (i < toks.length && (toks[i].t === '+' || toks[i].t === '-')) {
      const op = toks[i++].t;
      const r = parseTerm();
      const lv = v;
      v = n => (op === '+' ? lv(n) + r(n) : lv(n) - r(n));
    }
    return v;
  };
  const parseTerm = () => {
    let v = parseFactor();
    while (i < toks.length && (toks[i].t === '*' || toks[i].t === '/')) {
      const op = toks[i++].t;
      const r = parseFactor();
      const lv = v;
      v = n => (op === '*' ? lv(n) * r(n) : lv(n) / Math.max(r(n), 1e-9));
    }
    return v;
  };
  const parseFactor = () => {
    let base = parsePow();
    while (i < toks.length && toks[i].t === '!') {
      i++;
      const b = base;
      base = n => factorial(Math.max(0, Math.min(Math.round(Math.abs(b(n))), 170)));
    }
    return base;
  };
  const parsePow = () => {
    const base = parsePrimary();
    if (i < toks.length && toks[i].t === '^') {
      i++;
      const exp = parsePow();
      return n => Math.pow(base(n), exp(n));
    }
    return base;
  };
  const parsePrimary = () => {
    if (i >= toks.length) return () => 1;
    const tk = toks[i];
    if (tk.t === 'num') { i++; return () => tk.v; }
    if (tk.t === 'id') {
      i++;
      if (i < toks.length && toks[i].t === '(') {
        i++;
        const arg = parseExpr();
        if (i < toks.length && toks[i].t === ')') i++;
        const name = tk.v;
        return n => {
          if (name === 'log' || name === 'log2' || name === 'ln') return Math.log2(Math.max(arg(n), 1e-9));
          if (name === 'sqrt') return Math.sqrt(Math.max(arg(n), 0));
          return arg(n);
        };
      }
      return idValue(tk.v);
    }
    if (tk.t === '(') {
      i++;
      const v = parseExpr();
      if (i < toks.length && toks[i].t === ')') i++;
      return v;
    }
    i++;
    return () => 1;
  };

  const root = parseExpr();
  if (i !== toks.length) return null; // couldn't consume everything → unknown form
  return root;
}

/* notation → normalized curve (0..1) on a LOG y-axis, so fast-growing forms
   (n^4, 2^n, n!…) stay visible instead of hugging the baseline.
   null = unparseable (caller falls back). */
export function growthCurve(notation) {
  const f = compileExpr(normalizeNotation(notation));
  if (!f) return null;
  const vals = [];
  for (let n = 1; n <= N_MAX; n++) {
    let v;
    try { v = f(n); } catch { v = 0; }
    if (!isFinite(v) || v < 0) v = 0;
    vals.push(Math.log1p(v));
  }
  const max = Math.max(...vals, 1e-9);
  return vals.map(v => Math.min(v / max, 1));
}

function Sparkline({ notation, color, label }) {
  const pts = growthCurve(notation) || Array(N_MAX).fill(0.5);
  const gid = 'g' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const W = 210, H = 64, pad = 6;
  const step = (W - pad * 2) / (pts.length - 1);
  const coords = pts.map((v, i) => [pad + i * step, H - pad - v * (H - pad * 2)]);
  const path = coords.map(([x, y], i) => (i === 0 ? `M${x.toFixed(1)},${y.toFixed(1)}` : `L${x.toFixed(1)},${y.toFixed(1)}`)).join(' ');
  const area = `${path} L${(pad + (pts.length - 1) * step).toFixed(1)},${H - pad} L${pad},${H - pad} Z`;
  return (
    <div className="n-spark" title={`${label}: ${notation}`}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label} growth chart for ${notation}`}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.5" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="rgba(255,255,255,.14)" />
        <path d={area} fill={`url(#${gid})`} />
        <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <text x={W - pad} y={H - 1} textAnchor="end" fontSize="7" fill="rgba(255,255,255,.4)">n →</text>
        <text x={pad + 1} y={9} fontSize="7" fill="rgba(255,255,255,.4)">growth (log) ↑</text>
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
