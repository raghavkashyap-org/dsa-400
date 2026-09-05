/* ═══════════════════════════════════════════════════════════════════════
   Dynamic big-O engine (log-space).
   Parses ARBITRARY complexity notation — O(n^4), O(n log n), O(n² + m),
   O(2^n), O(n!), O(√n), O(log n), O(n·m), O(1), … — into a function
   L ↦ log10(operations), where L = log10(n). Evaluating in log-space means
   n up to 10^6 and expressions like 2^n / n! never overflow, and curves can
   be plotted on shared log–log axes so different complexities look genuinely
   different (O(n^4) is visibly steeper than O(n²), etc.).                       */

const NEG = -307; // log10(≈0)
const POS = 307;  // clamp ceiling
const LOG2_10 = 3.3219280948873626;
const LOG10_LOG2_10 = Math.log10(LOG2_10);
const LOG10_E = Math.log10(Math.E);
const LOG10_2PI = Math.log10(2 * Math.PI);

export function normalizeNotation(notation) {
  let s = String(notation || '').toLowerCase().replace(/\s+/g, '');
  s = s.replace(/^(?:bigo|big-o|o|theta|θ|omega|ω|t)\(/, '').replace(/\)$/, '');
  s = s.replace(/√/g, 'sqrt')
       .replace(/²/g, '^2').replace(/³/g, '^3')
       .replace(/[×·]/g, '*').replace(/[÷]/g, '/')
       .replace(/\*\*/g, '^');
  s = s.replace(/n([0-9]+)/g, 'n^$1'); // n2 → n^2, n4 → n^4
  return s;
}

/* split a glued identifier around function names: nlog2n → n · log2 · n,
   nlogn → n · log · n, nsqrtn → n · sqrt · n, logn → log · n … */
function splitId(v) {
  const out = [];
  let rest = v, buf = '';
  const flush = () => { if (buf) { out.push(buf); buf = ''; } };
  while (rest) {
    let m = null;
    if (rest.startsWith('log2')) m = 'log2';
    else if (rest.startsWith('log')) m = 'log';
    else if (rest.startsWith('sqrt')) m = 'sqrt';
    else if (rest.startsWith('ln')) m = 'ln';
    if (m) { flush(); out.push(m); rest = rest.slice(m.length); }
    else { buf += rest[0]; rest = rest.slice(1); }
  }
  flush();
  return out;
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
      for (const part of splitId(s.slice(i, j))) toks.push({ t: 'id', v: part });
      i = j;
    } else if ('+-*/^!()'.includes(c)) {
      toks.push({ t: c });
      i++;
    } else i++;
  }
  return toks;
}

function insertImplicitMul(toks) {
  const out = [];
  const FN_IDS = { log: 1, log2: 1, ln: 1, sqrt: 1 };
  for (const t of toks) {
    if (out.length) {
      const p = out[out.length - 1];
      const operand = t.t === 'id' || t.t === 'num' || t.t === '(';
      const prevOp = p.t === 'num' || p.t === 'id' || p.t === ')';
      const isCall = p.t === 'id' && t.t === '(';
      // `log n` / `sqrt n` are function applications, not multiplications
      const prevIsFn = p.t === 'id' && FN_IDS[p.v];
      if (prevOp && operand && !isCall && !prevIsFn) out.push({ t: '*' });
    }
    out.push(t);
  }
  return out;
}

/* compile a notation string into  L ↦ log10(ops).  null = unparseable. */
export function compileLog(src) {
  const toks = insertImplicitMul(tokenize(src));
  if (!toks.length) return null;
  let i = 0;
  const clamp = v => (Number.isFinite(v) ? Math.max(NEG, Math.min(POS, v)) : (v < 0 ? NEG : POS));
  const logAdd = (x, y) => {
    if (x <= NEG) return y;
    if (y <= NEG) return x;
    const m = Math.max(x, y), d = Math.min(x, y) - m;
    return d < -15 ? m : m + Math.log10(1 + Math.pow(10, d));
  };
  const logSub = (x, y) => {
    if (x <= y + 1e-12) return NEG;
    if (x - y > 15) return x;
    const v = Math.pow(10, x) - Math.pow(10, y);
    return v > 0 ? Math.log10(v) : NEG;
  };
  const logFact = aL => {
    if (aL <= 0.30103) return 0; // 0! = 1! = 1
    if (aL < 2) {                // exact for a < 100
      const a = Math.round(Math.pow(10, aL));
      let r = 0;
      for (let k = 2; k <= a; k++) r += Math.log10(k);
      return r;
    }
    const a = Math.pow(10, aL);  // Stirling
    return a * aL - a * LOG10_E + 0.5 * (LOG10_2PI + aL);
  };
  const idValue = id => {
    switch (id) {
      case 'n': case 'm': case 'v': return L => L;
      case 'c': case 'const': case 'one': case 'k': return () => 0;
      default: return L => L;
    }
  };
  const FN = { log: 1, log2: 1, ln: 1, sqrt: 1 };
  const applyFn = (name, arg) => L => {
    if (name === 'log' || name === 'log2' || name === 'ln') {
      const aL = clamp(arg(L));
      if (aL <= NEG) return NEG;
      return Math.log10(aL) + LOG10_LOG2_10;
    }
    if (name === 'sqrt') return clamp(arg(L)) / 2;
    return clamp(arg(L));
  };

  const parseExpr = () => {
    let v = parseTerm();
    while (i < toks.length && (toks[i].t === '+' || toks[i].t === '-')) {
      const op = toks[i++].t;
      const r = parseTerm();
      const lv = v;
      v = L => (op === '+' ? logAdd(lv(L), r(L)) : logSub(lv(L), r(L)));
    }
    return v;
  };
  const parseTerm = () => {
    let v = parseFactor();
    while (i < toks.length && (toks[i].t === '*' || toks[i].t === '/')) {
      const op = toks[i++].t;
      const r = parseFactor();
      const lv = v;
      v = L => (op === '*' ? lv(L) + r(L) : lv(L) - r(L));
    }
    return v;
  };
  const parseFactor = () => {
    let base = parsePow();
    while (i < toks.length && toks[i].t === '!') {
      i++;
      const b = base;
      base = L => logFact(clamp(b(L)));
    }
    return base;
  };
  const parsePow = () => {
    const base = parsePrimary();
    if (i < toks.length && toks[i].t === '^') {
      i++;
      const exp = parsePow();
      return L => {
        const bL = clamp(base(L));
        let eL = clamp(exp(L));
        if (eL <= NEG) eL = NEG;
        const E = eL >= 308 ? 308 : Math.pow(10, eL);
        return clamp(bL * E);
      };
    }
    return base;
  };
  const parsePrimary = () => {
    const tk = toks[i];
    if (!tk) return () => NEG;
    if (tk.t === 'num') {
      i++;
      const v = tk.v;
      return () => (v <= 0 ? NEG : Math.log10(v));
    }
    if (tk.t === 'id') {
      i++;
      const name = tk.v;
      if (i < toks.length && toks[i].t === '(') {
        i++;
        const arg = parseExpr();
        if (i < toks.length && toks[i].t === ')') i++;
        return applyFn(name, arg);
      }
      if (FN[name]) {
        const arg = parsePrimary(); // bare `log n` / `sqrt n`
        return applyFn(name, arg);
      }
      return idValue(name);
    }
    if (tk.t === '(') {
      i++;
      const v = parseExpr();
      if (i < toks.length && toks[i].t === ')') i++;
      return v;
    }
    i++;
    return () => NEG;
  };

  const root = parseExpr();
  if (i !== toks.length) return null;
  return root;
}

const engineCache = new Map();
export function engine(notation) {
  const key = String(notation || '');
  if (engineCache.has(key)) return engineCache.get(key);
  let f = null;
  try { f = compileLog(normalizeNotation(key)); } catch { f = null; }
  const e = { f, ok: !!f };
  engineCache.set(key, e);
  return e;
}

/* log10(ops) at n (n ≥ 1); null if unknown */
export function opsLogAt(f, n) {
  if (!f || n < 1) return null;
  const v = f(Math.log10(n));
  if (!Number.isFinite(v)) return null;
  return v <= NEG ? 0 : v;
}

/* ── display helpers ── */
export function fmtN(n) {
  if (n <= 0) return '0';
  if (n < 1000) return String(n);
  if (n < 1e6) return (n % 1000 === 0 ? (n / 1000) + 'k' : (n / 1000).toFixed(n < 1e4 ? 1 : 0) + 'k');
  return '1,000,000';
}
export function fmtOps(logv) {
  if (logv == null) return '—';
  if (logv <= NEG) return '0';
  if (logv >= 308) return '> 10³⁰⁸';
  if (logv < 5) return String(Math.round(Math.pow(10, logv)));
  if (logv < 100) return `≈ 10^${logv.toFixed(1)}`;
  return `≈ 10^${logv.toExponential(1)}`;
}
export function fmtDur(ops) {
  if (ops == null) return '—';
  if (!isFinite(ops)) return 'forever';
  const sec = ops / 1e7;
  if (sec < 1e-3) return '< 1 ms';
  if (sec < 1) return (sec * 1000).toFixed(1) + ' ms';
  if (sec < 60) return sec.toFixed(1) + ' s';
  if (sec < 3600) return (sec / 60).toFixed(1) + ' min';
  if (sec < 86400) return (sec / 3600).toFixed(1) + ' hr';
  if (sec < 3.154e7) return (sec / 86400).toFixed(1) + ' days';
  return (sec / 3.154e7).toFixed(1) + ' years';
}
export function opsGrade(logv) {
  if (logv == null) return null;
  if (logv <= 7) return { cls: 'ok', txt: '✔ well within 1 s' };
  if (logv <= 9) return { cls: 'warn', txt: '⚠ seconds' };
  return { cls: 'err', txt: '✖ too slow' };
}
