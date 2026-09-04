import { useEffect, useMemo, useRef, useState } from 'react';
import Nav from '../components/Nav';
import { P, D } from '../lib/patterns-data';
import { LC_TO_DAYS } from '../lib/lc-plan';
import { toast } from '../lib/toast';

/* ═══════════ syntax highlighter (ported from dsa_Patterns_new.html) ═══════════ */
const HL = (() => {
  const KW = {
    cpp: 'alignas alignof and asm auto bool break case catch char char8_t char16_t char32_t class concept const consteval constexpr constinit const_cast continue co_await co_return co_yield decltype default delete do double dynamic_cast else enum explicit export extern false float for friend goto if inline int long mutable namespace new noexcept nullptr operator or private protected public register reinterpret_cast requires return short signed sizeof static static_assert static_cast struct switch template this thread_local throw true try typedef typeid typename union unsigned using virtual void volatile wchar_t while',
    java: 'abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try var void volatile while true false null record sealed',
  };
  const TYPES = /\b(?:u?int(?:8|16|32|64|128)?(?:_t)?|size_t|ssize_t|ptrdiff_t|uint|int|float|double|bool|char|void|str|String|Vec|Box|List|Map|Set|Queue|Stack|PriorityQueue|HashMap|HashSet|unordered_map|unordered_set|pair|vector|TreeNode|ListNode|TrieNode|Trie|State|Choice|Choices|Results|Result|Element|Input|Self|byte)\b/g;
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const S = (c, t) => '\u0001' + c + '\u0002' + t + '\u0003';
  function outside(s, re, fn) {
    return s.split(/(\u0001[^\u0003]*\u0003)/).map(p => p.charAt(0) === '\u0001' ? p : p.replace(re, fn)).join('');
  }
  function generic(code, lang) {
    let s = code;
    s = outside(s, /\/\*[\s\S]*?\*\//g, m => S('t-com', m));
    s = outside(s, /\/\/.*$/gm, m => S('t-com', m));
    s = outside(s, /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g, m => S('t-str', m));
    if (lang === 'cpp') s = outside(s, /^[ \t]*#[a-z_]+/gm, m => S('t-bul', m));
    if (lang === 'java') s = outside(s, /@\w+/g, m => S('t-bul', m));
    s = outside(s, TYPES, m => S('t-typ', m));
    s = outside(s, /\b(?:0[xXbBoO][0-9a-fA-F_]+|\d[\d_]*\.?\d*(?:[eE][+-]?\d+)?)(?:[uUlLfF]|_\w+)?\b/g, m => S('t-num', m));
    const kw = KW[lang];
    if (kw) s = outside(s, new RegExp('\\b(' + kw.trim().split(/\s+/).join('|') + ')\\b', 'g'), m => S('t-key', m));
    s = outside(s, /\b([A-Za-z_]\w*)(\s*\()/g, (m, n, t) => S('t-fn', n) + t);
    s = outside(s, /[+\-*/%=<>!&|^~?:]+/g, m => S('t-op', m));
    return s;
  }
  function highlight(code, lang) {
    lang = (lang || 'text').toLowerCase();
    if (lang === 'cpp' || lang === 'java') return esc(generic(code, lang)).replace(/\u0001([\w-]+)\u0002/g, '<span class="$1">').replace(/\u0003/g, '</span>');
    return esc(code);
  }
  return { highlight, esc };
})();

const pad2 = n => (n < 10 ? '0' : '') + n;
const LCX = { 15: '3sum', 74: 'search-a-2d-matrix', 92: 'reverse-linked-list-ii', 167: 'two-sum-ii-input-array-is-sorted', 191: 'number-of-1-bits', 240: 'search-a-2d-matrix-ii', 518: 'coin-change-ii', 876: 'middle-of-the-linked-list', 643: 'maximum-average-subarray-i', 2266: 'count-number-of-texts', 130: 'surrounded-regions', 133: 'clone-graph' };
const lcSlug = title => LCX[title] || String(title).toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, '-');
const lcURL = (id, title) => 'https://leetcode.com/problems/' + lcSlug(title) + '/';

/* complexity + sparklines */
const FN = { lin: n => n, log: n => Math.max(1, Math.log2(n + 1)), nlog: n => n * Math.log2(n + 2), sq: n => n * n, cube: n => n * n * n, mul: n => n * n, nk: n => n * Math.log2(n + 2), ve: n => n * 1.6, elogv: n => n * Math.log2(n + 2), mn: n => n * n, exp: n => Math.pow(2, Math.min(n, 34)) };
const CLS_COLOR = { err: '#ef4444', warn: '#f59e0b', ok: '#10b981' };
const fmtOps = v => v >= 1e12 ? (v / 1e12).toFixed(1) + 'T' : v >= 1e9 ? (v / 1e9).toFixed(1) + 'B' : v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(1) + 'K' : String(Math.round(v));
const SPN = 128;
function sparkMini(fkey, color) {
  const f = FN[fkey] || FN.lin, w = 72, h = 22, K = 22;
  const m = f(SPN) || 1; let d = '';
  for (let i = 0; i < K; i++) {
    const n = 1 + (SPN - 1) * i / (K - 1);
    const x = (w - 2) * i / (K - 1) + 1, y = h - 2 - ((f(n) / m) * (h - 5));
    d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
  }
  return '<svg class="spark-cell" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" fill="none" aria-hidden="true">'
    + '<path d="' + d + 'L' + (w - 1) + ' ' + (h - 1) + ' L1 ' + (h - 1) + ' Z" fill="' + color + '" opacity=".12"/>'
    + '<path d="' + d + '" stroke="' + color + '" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}
function growthChart(p) {
  const nMax = p.gn || 512, W = 340, H = 190, pl = 10, pr = 10, pt = 12, pb = 26, K = 72;
  const ents = [[p.cx[0].a, p.cx[0].f, 'err'], [p.cx[p.cx.length - 1].a, p.cx[p.cx.length - 1].f, 'ok']];
  const ys = ents.map(e => (FN[e[1]] || FN.lin)(nMax));
  const maxY = Math.max.apply(null, ys.concat([1])) * 1.06;
  const gid = 'gg-' + p.id;
  let curves = '', area = '';
  ents.forEach((e, idx) => {
    const f = FN[e[1]] || FN.lin, col = CLS_COLOR[e[2]];
    let d = '';
    for (let i = 0; i < K; i++) {
      const n = 1 + (nMax - 1) * i / (K - 1);
      const x = pl + (W - pl - pr) * i / (K - 1);
      const y = H - pb - ((f(n) / maxY) * (H - pt - pb));
      d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
    }
    if (idx === ents.length - 1) area = '<path d="' + d + 'L' + (W - pr) + ' ' + (H - pb) + ' L' + pl + ' ' + (H - pb) + ' Z" fill="url(#' + gid + ')" opacity=".5"/>';
    curves += '<path d="' + d + '" stroke="' + col + '" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>';
  });
  let grid = '';
  [0.25, 0.5, 0.75].forEach(q => {
    const y = pt + (H - pt - pb) * q;
    grid += '<line x1="' + pl + '" y1="' + y.toFixed(1) + '" x2="' + (W - pr) + '" y2="' + y.toFixed(1) + '" stroke="rgba(128,128,128,.14)" stroke-width="1" stroke-dasharray="3 5"/>';
  });
  const svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Growth comparison: ' + HL.esc(p.name) + '">'
    + '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">'
    + '<stop offset="0%" stop-color="#10b981" stop-opacity=".30"/><stop offset="100%" stop-color="#10b981" stop-opacity="0"/>'
    + '</linearGradient></defs>' + grid
    + '<line x1="' + pl + '" y1="' + (H - pb) + '" x2="' + (W - pr) + '" y2="' + (H - pb) + '" stroke="rgba(128,128,128,.3)" stroke-width="1.4"/>'
    + area + curves
    + '<text x="' + pl + '" y="' + (H - 8) + '" font-family="JetBrains Mono,monospace" font-size="9" fill="rgba(128,128,128,.8)">n = 1</text>'
    + '<text x="' + (W - pr) + '" y="' + (H - 8) + '" text-anchor="end" font-family="JetBrains Mono,monospace" font-size="9" fill="rgba(128,128,128,.8)">n = ' + nMax + '</text>'
    + '<text x="' + (W - pr) + '" y="' + (pt + 2) + '" text-anchor="end" font-family="JetBrains Mono,monospace" font-size="9" fill="rgba(128,128,128,.8)">ops (normalised)</text>'
    + '</svg>';
  const legend = ents.map(e => {
    const ops = fmtOps((FN[e[1]] || FN.lin)(nMax));
    return '<span class="gl-it"><i style="background:' + CLS_COLOR[e[2]] + '"></i>' + HL.esc(e[0]) + ' <b>' + ops + ' ops @ n=' + nMax + '</b></span>';
  }).join('');
  return svg + '<div class="gl">' + legend + '</div>';
}

const IC = {
  info: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>',
  math: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 4h16v16H4z"/><path d="M8 8h8M8 12h5M8 16h8"/></svg>',
  spark: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l5-6 4 3 6-8 3 4"/></svg>',
  target: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/></svg>',
  play: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 5l12 7-12 7z"/></svg>',
  book: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4H6.5A2.5 2.5 0 0 0 4 6.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/></svg>',
  code: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6l-6 6 6 6M16 6l6 6-6 6"/></svg>',
  lc: '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M14.7 5.3a8.2 8.2 0 0 1 1.8 5.2c0 4.3-2.7 6.9-6.6 6.9-3.9 0-6.6-2.6-6.6-6.9s2.7-6.9 6.6-6.9c1.4 0 2.6.4 3.6 1L14 7.1l1.6-.9-.9-.9zM3 21h18v-2H3v2z"/></svg>',
  layers: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l9 5-9 5-9-5 9-5z"/><path d="M3 12l9 5 9-5"/><path d="M3 17l9 5 9-5"/></svg>',
};

function codeBlock(lang, label, file, code, extra) {
  return '<div class="code" ' + (extra || '') + ' data-lang="' + lang + '">'
    + '<div class="code-bar"><span class="code-lang">' + label + '</span>'
    + (file ? '<span class="code-file">' + HL.esc(file) + '</span>' : '')
    + '<button class="copy">Copy</button></div>'
    + '<pre><code class="sx">' + HL.highlight(code, lang) + '</code></pre></div>';
}

/* day reference link inside practice lists */
function dayLinks(id) {
  const hits = LC_TO_DAYS[String(id)];
  if (!hits || !hits.length) return '';
  return '<a class="lc-day" href="/?day=' + hits[0].day + '" title="Open Day ' + hits[0].day + ' in the tracker">📌 Day ' + hits[0].day + '</a>';
}

function patternSection(p) {
  let h = '<section class="sec pat" id="' + p.id + '"><div class="wrap">'
    + '<div class="sec-head"><span class="sec-num">' + pad2(p.n) + ' / 20 · '
    + (p.core ? '<span style="color:var(--warn)">★ core</span>' : 'pattern') + '</span>'
    + '<h2>' + p.name + '</h2>'
    + '<div class="row" style="margin-top:12px;flex-wrap:wrap;gap:8px">'
    + (p.core ? '<span class="star">★ interview core</span>' : '<span class="chip chip-neutral">supporting pattern</span>')
    + '<span class="core-chip">' + p.use.length + ' triggers</span>'
    + '<a class="pat-add" href="/note?pattern=' + p.id + '" title="Paste this whole pattern block into a Daily Note">＋ Add to article</a>'
    + '</div></div>';

  h += '<div class="wavy"><div class="wavy-in"><div class="pm-grid">'
    + '<div><div class="pm-h">' + IC.info + 'What the pattern is</div><div class="pm-body">' + p.what + '</div></div>'
    + '<div><div class="pm-h">' + IC.math + 'The mental model</div><div class="pm-body">' + p.model + '</div>'
    + '<div class="mathf"><span class="lbl">Core identity</span>' + p.formula + '</div></div>'
    + '</div></div></div>';

  h += '<div class="card spot" style="margin-top:20px"><div class="pm-h">' + IC.target + 'When to reach for it</div>'
    + '<ul class="use-list">' + p.use.map(u => '<li>' + u + '</li>').join('') + '</ul></div>';

  h += '<div class="grid g2" style="margin-top:20px">'
    + '<div class="card" style="padding:0;overflow:hidden">'
    + '<div style="padding:16px 18px 4px"><div class="pm-h">' + IC.spark + 'Complexity ladder</div></div>'
    + '<div class="tbl-wrap" style="border:none"><table class="cx-table"><thead><tr><th>Approach</th><th>Time</th><th>Space</th><th style="min-width:80px">Growth</th></tr></thead><tbody>'
    + p.cx.map((r, i) => {
      const tier = i === 0 ? 'err' : (i === p.cx.length - 1 ? 'ok' : 'warn');
      return '<tr><td><strong>' + r.a + '</strong><br><span style="font-size:12px;color:var(--text-mute)">' + r.d + '</span></td>'
        + '<td class="cx cx-' + tier + '">' + r.t + '</td><td class="cx">' + r.s + '</td>'
        + '<td>' + sparkMini(r.f, CLS_COLOR[tier]) + '</td></tr>';
    }).join('')
    + '</tbody></table></div>'
    + '<ul class="cx-list" style="padding:0 16px 16px">'
    + p.cx.map((r, i) => {
      const tier = i === 0 ? 'err' : (i === p.cx.length - 1 ? 'ok' : 'warn');
      return '<li><b>' + r.a + '</b><span class="cx cx-' + tier + '">' + r.t + '</span></li>';
    }).join('') + '</ul></div>'
    + '<div class="b-ring growth"><div class="pm-h">' + IC.spark + 'How the approaches grow</div>'
    + growthChart(p) + '</div></div>';

  h += '<h3 style="margin:30px 0 12px">' + IC.code + ' The reusable template</h3>'
    + '<div class="wavy"><div class="wavy-in">'
    + '<div class="code-files">'
    + codeBlock('cpp', 'C++', 'reusable template — identical to the Java version', p.tmpl.cpp)
    + codeBlock('java', 'Java', 'as written in the playbook', p.tmpl.java)
    + '</div>'
    + (p.how ? '<div class="how"><div class="pm-h">' + IC.layers + 'How the framework works — the template, piece by piece</div>'
      + '<ol class="how-steps">' + p.how.map(s => '<li><span>' + s + '</span></li>').join('') + '</ol></div>' : '')
    + '</div></div>';

  h += '<h3 style="margin:30px 0 12px">' + IC.play + ' Sample problem, walked through</h3>'
    + '<div class="b-ring"><div class="pm-h">' + p.sample.t + '</div>'
    + '<div style="margin:4px 0 10px;font-size:13px;color:var(--text-dim)">'
    + '<span class="sample-in">in · ' + p.sample.in + '</span> '
    + '<span class="sample-out">out · ' + p.sample.out + '</span></div>'
    + codeBlock('text', 'trace', 'step by step', p.sample.trace)
    + '</div>';

  if (p.note) h += '<div class="note-warn" style="margin-top:16px"><strong>Field note:</strong> ' + p.note + '</div>';

  h += '<h3 style="margin:30px 0 12px">' + IC.book + ' Practice set</h3>'
    + '<div class="grid g2"><div class="lc-list">'
    + p.practice.map(q => {
      const id = q[0], t = q[1], pick = q[2];
      return '<a class="lc" href="' + lcURL(id, t) + '" target="_blank" rel="noopener">'
        + '<span class="lc-id">' + id + '</span><span class="lc-t">' + t + '</span>'
        + (pick ? '<span class="lc-pick">★ pick</span>' : '')
        + dayLinks(id)
        + '<span class="lc-ext">↗</span></a>';
    }).join('')
    + '</div><div class="card spot" style="align-self:start"><div class="pm-h">' + IC.target + 'How to practice</div>'
    + '<div class="card-d" style="font-size:13px;line-height:1.75">Solve them in the listed order — they are sequenced easy → hard. Starred <span style="color:var(--warn)">★ pick</span> problems are on the personal shortlist: re-solve those from memory a week later, and add every failure to a revision list. <b>📌 Day links jump to where that question lives in your DSA-400 plan.</b></div></div></div>';

  h += '</div></section><div class="rule"></div>';
  return h;
}

function dpCard(d) {
  const picks = d.practice.filter(q => q[2]).length;
  const dayHits = d.practice.map(q => { const hit = LC_TO_DAYS[String(q[0])]; return hit ? hit[0].day : null; }).filter(Boolean);
  return '<div class="dp-card">'
    + '<div class="dp-no">DP ' + pad2(d.n) + '</div><h4>' + d.name + '</h4>'
    + '<p>' + d.what + '</p>'
    + '<div class="dp-mini">'
    + d.practice.map(q => '<a class="' + (q[2] ? 'pick' : '') + '" href="' + lcURL(q[0], q[1]) + '" target="_blank" rel="noopener" title="' + q[1] + '">' + q[0] + '</a>').join('')
    + '</div>'
    + (picks ? '<div style="margin-top:10px;font:500 11px var(--font-mono);color:var(--warn)">★ ' + picks + ' on the shortlist</div>' : '')
    + (dayHits.length ? '<div style="margin-top:8px;font:500 10.5px var(--font-mono);color:var(--ok)">📌 in your plan: ' + dayHits.slice(0, 4).map(x => 'Day ' + x).join(', ') + (dayHits.length > 4 ? '…' : '') + '</div>' : '')
    + '</div>';
}

/* ── hero canvas (5 demos, ported) ── */
function HeroCanvas() {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext('2d');
    const C = { a: '#22d3ee', a2: '#67e8f9', ink: '#f4f5f7', dim: '#a1a7b3', mute: '#6d7480', ok: '#10b981', warn: '#f59e0b' };
    const N = 56, DUR = 8000;
    const MODES = ['Two pointers', 'Sliding window', 'Binary search', 'Partitioning', "Kadane's"];
    let mode = 0, modeStart = performance.now(), W = 0, H = 0, dpr = 1;
    let vals = [], kad = null, bin = null, part = null;
    let mx = -1, my = -1, inView = true, hidden = false, raf = 0;
    const seeded = () => { let s = 20260904; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; };
    const rng = seeded();
    for (let i = 0; i < N; i++) vals.push(0.12 + rng() * 0.88);
    const kadaneAid = () => { if (kad) return kad; kad = []; let cur = 0, best = -1, bl = 0, br = 0, l = 0; for (let i = 0; i < N; i++) { cur += vals[i]; if (cur > best) { best = cur; bl = l; br = i; } if (cur < 0) { cur = 0; l = i + 1; } kad.push([bl, br]); } return kad; };
    const binAid = () => { if (bin) return bin; bin = []; let lo = 0, hi = N - 1; for (let s = 0; s < 7; s++) { const mid = (lo + hi >> 1); bin.push([lo, mid, hi]); if (vals[mid] < 0.55) lo = Math.min(N - 1, mid + 1); else hi = Math.max(0, mid - 1); if (lo >= hi) { bin.push([lo, lo, lo]); break; } } return bin; };
    const partAid = () => { if (part) return part; const cls = vals.map(v => v < 0.5 ? 0 : 1), arranged = cls.slice().sort((a, b) => a - b); part = { cls, arranged, cut: [] }; let z = 0; for (let i = 0; i < N; i++) { z += arranged[i] === 0 ? 1 : 0; part.cut.push(z); } return part; };
    const resize = () => { const r = cv.getBoundingClientRect(); dpr = Math.min(devicePixelRatio || 1, 2); W = Math.max(10, r.width); H = Math.max(10, r.height); cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    const geo = () => { const pad = Math.max(24, W * 0.06); return { x0: pad, x1: W - pad, bw: (W - 2 * pad) / N, yTop: H * 0.3, yBase: H * 0.78 }; };
    const ease = t => 1 - Math.pow(1 - t, 3);
    const bar = (i, lit, extra) => { const g = geo(), x = g.x0 + i * g.bw + g.bw * 0.14, bw = g.bw * 0.72; const h = 8 + (g.yBase - g.yTop - 8) * vals[i]; const y = g.yBase - h; const near = mx >= 0 && Math.abs(i * g.bw + g.x0 - mx) < g.bw * 2.2; let col = lit ? C.a : 'rgba(161,167,179,.20)'; if (near) col = lit ? C.a2 : 'rgba(244,245,247,.55)'; ctx.fillStyle = col; ctx.globalAlpha = near ? (0.85 + (extra || 0)) : ((lit ? 0.95 : 0.6) + (extra || 0)); ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, bw, h, 3); else ctx.rect(x, y, bw, h); ctx.fill(); ctx.globalAlpha = 1; };
    const drawBase = () => { const g = geo(); ctx.strokeStyle = 'rgba(128,128,128,.25)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(g.x0 - 6, g.yBase + 1); ctx.lineTo(g.x1 + 6, g.yBase + 1); ctx.stroke(); };
    const pointerLabel = (i, t) => { const g = geo(); ctx.fillStyle = C.ink; ctx.font = '700 10px "JetBrains Mono",monospace'; ctx.textAlign = 'center'; ctx.fillText(t, g.x0 + i * g.bw + g.bw / 2, g.yBase + 16); };
    const bracket = (l, r, t) => { const g = geo(); const x1 = g.x0 + l * g.bw + g.bw / 2, x2 = g.x0 + r * g.bw + g.bw / 2, y = g.yBase + 30; ctx.strokeStyle = 'rgba(34,211,238,.75)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x1, y - 4); ctx.lineTo(x1, y); ctx.lineTo(x2, y); ctx.lineTo(x2, y - 4); ctx.stroke(); ctx.fillStyle = C.a2; ctx.font = '600 9.5px "JetBrains Mono",monospace'; ctx.textAlign = 'center'; ctx.fillText(t, (x1 + x2) / 2, y + 11); };
    const tokens = () => { ctx.fillStyle = 'rgba(109,116,128,.9)'; ctx.font = '500 9px "JetBrains Mono",monospace'; ctx.textAlign = 'left'; ctx.fillText('a[' + N + '] · live', 24, H * 0.3 - 18); };
    const draw = t => {
      ctx.clearRect(0, 0, W, H); tokens();
      const ph = Math.max(0, (t % DUR)) / DUR;
      if (mode === 0) { const k = Math.floor(ease(Math.min(1, ph * 1.6)) * (N - 1) / 2); const l = k, r = N - 1 - k; for (let i = 0; i < N; i++) bar(i, (i === l || i === r), 0); pointerLabel(l, 'l'); pointerLabel(r, 'r'); bracket(l, r, 'search interval [l, r]'); }
      else if (mode === 1) { const k = Math.max(6, Math.floor(N / 6)); const f = ph * (N - k); for (let i = 0; i < N; i++) bar(i, (i >= Math.floor(f) && i < Math.floor(f) + k), 0); const l = Math.floor(f), r = l + k - 1; pointerLabel(l, 'l'); pointerLabel(r, 'r'); bracket(l, r, 'window size k = ' + k); }
      else if (mode === 2) { const a = binAid(); const step = Math.min(a.length - 1, Math.floor(ph * 1.15 * a.length)); const row = a[step] || a[a.length - 1]; const lo = row[0], mid = row[1], hi = row[2]; for (let i = 0; i < N; i++) { const inR = (i >= lo && i <= hi); if (!inR) bar(i, false, 0); else bar(i, i === mid, 0); } pointerLabel(lo, 'lo'); pointerLabel(hi, 'hi'); pointerLabel(mid, 'mid'); bracket(lo, hi, 'halving — pass ' + (step + 1)); }
      else if (mode === 3) { const a = partAid(); const s = Math.min(N - 1, Math.floor(ease(Math.min(1, ph * 1.1)) * N)); for (let i = 0; i < N; i++) bar(i, i === s || i < s, i < s ? 0.05 : 0); pointerLabel(s, 'sweep'); ctx.fillStyle = C.ink; ctx.font = '700 10px "JetBrains Mono",monospace'; ctx.textAlign = 'left'; ctx.fillText('settled region', geo().x0, geo().yTop - 32); }
      else { const a = kadaneAid(); const i = Math.min(N - 1, Math.floor(ph * 1.08 * N)); const row = a[i] || a[a.length - 1]; const bl = row[0], br = row[1]; for (let j = 0; j < N; j++) bar(j, (j >= bl && j <= br) || j === i, 0); pointerLabel(i, 'i'); bracket(bl, br, 'best subarray so far'); }
      drawBase();
    };
    const setMode = m => { mode = m; modeStart = performance.now(); const nm = document.getElementById('modeName'); if (nm) nm.textContent = MODES[m]; document.querySelectorAll('#modeDots i').forEach((d, i) => d.classList.toggle('on', i === m)); };
    const loop = ts => { raf = requestAnimationFrame(loop); if (hidden || !inView) return; if (ts - modeStart > DUR) setMode((mode + 1) % MODES.length); draw(ts - modeStart); };
    const dots = document.getElementById('modeDots'); if (dots) dots.innerHTML = MODES.map(() => '<i></i>').join('');
    setMode(0); resize();
    addEventListener('resize', () => { resize(); draw(performance.now() - modeStart); });
    cv.addEventListener('mousemove', e => { const r = cv.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; });
    cv.addEventListener('mouseleave', () => { mx = -1; my = -1; });
    cv.addEventListener('click', () => setMode((mode + 1) % MODES.length));
    const chip = document.getElementById('modeChip'); if (chip) chip.addEventListener('click', () => setMode((mode + 1) % MODES.length));
    let io;
    if ('IntersectionObserver' in window) io = new IntersectionObserver(es => es.forEach(e => inView = e.isIntersecting), { threshold: 0.05 }), io.observe(cv.closest('header'));
    document.addEventListener('visibilitychange', () => hidden = document.hidden);
    const RM = matchMedia('(prefers-reduced-motion: reduce)');
    if (RM && RM.matches) draw(DUR * 0.35); else raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); if (io) io.disconnect(); };
  }, []);
  return <canvas id="heroCanvas" ref={ref} aria-label="Interactive array-algorithm visual: two pointers, sliding window, binary search, partitioning and Kadane's algorithm" />;
}

export default function Patterns() {
  const [lang, setLang] = useState(() => { try { return localStorage.getItem('ds-codelang') === 'java' ? 'java' : 'cpp'; } catch { return 'cpp'; } });
  const [ready, setReady] = useState(false);
  const pageRef = useRef(null);

  useEffect(() => { document.documentElement.dataset.codelang = lang; }, [lang]);
  useEffect(() => { setReady(true); }, []);

  const html = useMemo(() => {
    const rail = '<div class="rail-i" data-go="roadmap"><b>MAP</b>Roadmap</div>'
      + P.map(p => '<div class="rail-i" data-go="' + p.id + '"><b>' + pad2(p.n) + '</b>' + p.name + '</div>').join('')
      + '<div class="rail-i" data-go="dp"><b>DP</b>20 DP patterns</div>'
      + '<div class="rail-i" data-go="cheatsheet"><b>CS</b>Cheatsheet</div>'
      + '<div class="rail-i" data-go="resources"><b>EXT</b>Resources</div>';
    const cheat = P.map(p => '<tr><td class="cx">' + pad2(p.n) + '</td>'
      + '<td><strong><button class="foot-l" style="display:inline;padding:0;background:none;border:0;cursor:pointer;color:var(--a-300)" data-go="' + p.id + '">' + p.name + '</button></strong>'
      + '<br><span style="font-size:11px;color:var(--text-mute)">DSA pattern' + (p.core ? ' · ★ core' : '') + '</span></td>'
      + '<td style="font-size:12.5px;color:var(--text-dim)">' + p.use[0] + '</td>'
      + '<td class="cx cx-ok">' + p.cx[p.cx.length - 1].t + '</td>'
      + '<td>' + sparkMini(p.cx[p.cx.length - 1].f, CLS_COLOR.ok) + '</td></tr>').join('')
      + D.map(d => '<tr><td class="cx">D' + pad2(d.n) + '</td>'
        + '<td><strong><button class="foot-l" style="display:inline;padding:0;background:none;border:0;cursor:pointer;color:var(--a-300)" data-go="dp">' + d.name + '</button></strong>'
        + '<br><span style="font-size:11px;color:var(--text-mute)">DP pattern</span></td>'
        + '<td style="font-size:12.5px;color:var(--text-dim)">' + d.what.replace(/<[^>]+>/g, '').slice(0, 88) + '…</td>'
        + '<td class="cx cx-ok">state DP</td>'
        + '<td>' + sparkMini('nlog', CLS_COLOR.ok) + '</td></tr>').join('');
    return { rail, cheat };
  }, []);

  const patHtml = useMemo(() => P.map(patternSection).join(''), []);
  const dpHtml = useMemo(() => D.map(dpCard).join(''), []);
  const seen = useMemo(() => { const st = new Set(); P.forEach(p => p.practice.forEach(q => st.add(q[0]))); D.forEach(d => d.practice.forEach(q => st.add(q[0]))); return st.size; }, []);

  /* delegated interactions */
  const onClick = e => {
    const go = e.target.closest('[data-go]');
    if (go) { const el = document.getElementById(go.dataset.go); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    const copy = e.target.closest('.copy');
    if (copy) {
      const pre = copy.closest('.code').querySelector('pre');
      const done = () => { const o = copy.textContent; copy.textContent = 'Copied'; copy.classList.add('done'); setTimeout(() => { copy.textContent = o; copy.classList.remove('done'); }, 1500); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(pre.innerText).then(done).catch(() => { toast('Copy failed'); });
      else toast('Copy failed');
    }
  };

  const switchLang = l => {
    setLang(l);
    try { localStorage.setItem('ds-codelang', l); } catch {}
    toast(l === 'cpp' ? 'Templates switched to C++' : 'Templates switched to Java');
  };

  /* scroll-spy + progress + back-to-top */
  useEffect(() => {
    const prog = document.getElementById('prog');
    const top = document.getElementById('top');
    const absTop = el => { let t = 0; while (el && el !== document.body) { t += el.offsetTop; el = el.offsetParent; } return t; };
    const onS = () => {
      const y = scrollY;
      if (top) top.classList.toggle('on', y > 600);
      const h = document.documentElement.scrollHeight - innerHeight;
      if (prog) prog.style.width = (h > 0 ? y / h * 100 : 0) + '%';
      let cur = '';
      document.querySelectorAll('.sec').forEach(sec => { if (absTop(sec) - 150 <= y) cur = sec.id; });
      document.querySelectorAll('.rail-i').forEach(r => r.classList.toggle('on', r.dataset.go === cur));
    };
    addEventListener('scroll', onS, { passive: true });
    onS();
    if (top) top.onclick = () => scrollTo({ top: 0, behavior: 'smooth' });
  }, [ready]);

  return (
    <div className="cyan-scope" ref={pageRef} onClick={onClick}>
      <div id="bg" aria-hidden="true"><div className="orb orb-1" /><div className="orb orb-2" /><div id="bg-grid" /><div id="bg-vig" /></div>

      <nav id="nav">
        <div className="nav-in">
          <div className="brand" onClick={() => { window.location.href = '/'; }}>
            <span className="brand-mark">☰</span>
            <span className="brand-name">Pattern&nbsp;Master</span>
          </div>
          <div className="nav-links" style={{ display: 'flex' }}>
            <button className="nav-link" data-go="roadmap">Roadmap</button>
            <button className="nav-link" data-go="patterns">20 Patterns</button>
            <button className="nav-link" data-go="dp">20 DP Patterns</button>
            <button className="nav-link" data-go="cheatsheet">Cheatsheet</button>
            <button className="nav-link" data-go="resources">Resources</button>
            <button className="nav-link" onClick={() => { window.location.href = '/'; }}>← Tracker</button>
          </div>
          <div className="nav-right">
            <div className="langtog" role="group" aria-label="Template language">
              <button className={lang === 'cpp' ? 'on' : ''} onClick={() => switchLang('cpp')}>C++</button>
              <button className={lang === 'java' ? 'on' : ''} onClick={() => switchLang('java')}>Java</button>
            </div>
          </div>
        </div>
      </nav>

      <header id="hero" className="pat-hero">
        <HeroCanvas />
        <div className="hero-in">
          <span className="kicker">DSA Pattern Playbook · Master Edition</span>
          <h1>DSA was hard until<br /><span className="grad">I learned these 40 patterns</span></h1>
          <p className="hero-sub">The 20 core patterns and the 20 dynamic-programming patterns — each with a <b>reusable C++ / Java template</b>, a <b>step-by-step walkthrough</b>, <b>complexity ladders with sparklines</b> and the <b>learning roadmap</b> that ties it all together. 📌 tags link each problem to its day in your DSA-400 plan.</p>
          <div className="cta-row">
            <button className="btn btn-primary btn-lg" data-go="patterns">Start with the 20 patterns →</button>
            <button className="btn btn-ghost btn-lg" data-go="roadmap">How to actually master DSA</button>
          </div>
          <div className="stat-row">
            <div className="stat"><div className="v">40</div><div className="l">Patterns, templated</div></div>
            <div className="stat"><div className="v">2</div><div className="l">Languages per template</div></div>
            <div className="stat"><div className="v">{seen}</div><div className="l">Linked problems</div></div>
            <div className="stat"><div className="v">{P.length}</div><div className="l">Guided walkthroughs</div></div>
          </div>
          <button id="modeChip" className="mode-chip">◈ <span id="modeName">Two pointers</span></button>
          <div id="modeDots" aria-hidden="true" />
          <span className="mode-hint">click the canvas to switch modes</span>
        </div>
      </header>

      <main>
        {/* roadmap */}
        <section className="sec" id="roadmap">
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-num">01 · The roadmap</span>
              <h2>How to actually master DSA</h2>
              <p className="sub">The distilled version: what to learn, in what order, with what resources, and how to never forget it.</p>
            </div>
            <div className="grid g3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 14, marginBottom: 26 }}>
              <div className="card pillar"><div className="p-ico">⬛</div><div className="card-t">1 · Data structures</div><div className="card-d">How data is <b>organised</b> in memory.</div><ul><li>Array · String</li><li>Linked List · Stack · Queue</li><li>Hash Table</li><li>Heap · Tree · Trie · Graph</li></ul></div>
              <div className="card pillar"><div className="p-ico">➤</div><div className="card-t">2 · Algorithms</div><div className="card-d">The <b>procedures</b> that operate on them.</div><ul><li>Sorting · Searching · Binary Search</li><li>Recursion · Backtracking</li><li>BFS · DFS · Two Pointers</li><li>Sliding Window · D&amp;C · DP · Greedy</li></ul></div>
              <div className="card pillar"><div className="p-ico">✦</div><div className="card-t">3 · Problem-solving</div><div className="card-d">The <b>pattern-recognition</b> layer.</div><ul><li>Recognise → map to a pattern</li><li>Reason about complexity</li><li>Invariants · exchange arguments</li><li>Engineering judgement</li></ul></div>
            </div>
            <div className="note-warn"><strong>Scope rule:</strong> segment trees and Fenwick trees are rarely asked in coding interviews. Start breadth-first, depth later.</div>
            <h3 style={{ marginTop: 34 }}>Learn one topic at a time — in this order</h3>
            <p className="sub">Start with <b>linear</b> data structures and graduate to the recursive ones.</p>
            <div className="grid g2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 14, marginTop: 8 }}>
              <div className="card">
                <div className="tl">
                  <div className="tl-i"><span className="tl-tag">STAGE 1</span><div><b>Arrays &amp; strings</b> — traversal, in-place ops, prefix sums, hashing</div></div>
                  <div className="tl-i"><span className="tl-tag">STAGE 2</span><div><b>Linked lists</b> — pointers, fast &amp; slow, in-place reversal</div></div>
                  <div className="tl-i"><span className="tl-tag">STAGE 3</span><div><b>Stacks &amp; queues</b> — monotonic stacks, queues via lists</div></div>
                  <div className="tl-i"><span className="tl-tag">STAGE 4</span><div><b>Trees</b> — traversals, BSTs, recursion depth</div></div>
                  <div className="tl-i"><span className="tl-tag">STAGE 5</span><div><b>Heaps</b> — top-k, streaming extremes</div></div>
                  <div className="tl-i"><span className="tl-tag">STAGE 6</span><div><b>Graphs</b> — DFS, BFS, shortest paths, union-find</div></div>
                  <div className="tl-i"><span className="tl-tag">STAGE 7</span><div><b>DP &amp; backtracking</b> — once every earlier stage is fluent</div></div>
                </div>
              </div>
              <div className="card">
                <div className="card-t">How to start any new topic — six moves</div>
                <div className="steps">
                  <div className="step"><div className="step-n">1</div><div><div className="step-t">Start with the basics</div><div className="step-d">What it is, how it's represented, core operations and their complexities.</div></div></div>
                  <div className="step"><div className="step-n">2</div><div><div className="step-t">Real-world applications</div><div className="step-d">Graphs → GPS routing; heaps → schedulers; hashing → caches. Context makes it stick.</div></div></div>
                  <div className="step"><div className="step-n">3</div><div><div className="step-t">Use pen and paper</div><div className="step-d">Draw nodes and pointers, write pseudocode.</div></div></div>
                  <div className="step"><div className="step-n">4</div><div><div className="step-t">Implement it from scratch</div><div className="step-d">The mechanics stop being magic.</div></div></div>
                  <div className="step"><div className="step-n">5</div><div><div className="step-t">Learn the inbuilt library</div><div className="step-d"><code>unordered_map</code> / <code>priority_queue</code> in C++, <code>HashMap</code> / <code>PriorityQueue</code> in Java.</div></div></div>
                  <div className="step"><div className="step-n">6</div><div><div className="step-t">Solve 4–5 easy problems</div><div className="step-d">Reading is not learning.</div></div></div>
                </div>
              </div>
            </div>
            <h3 style={{ marginTop: 34 }}>How to scale up — and never forget</h3>
            <div className="grid g4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12, marginBottom: 18 }}>
              <div className="card"><div className="card-t">Solve &gt; theory</div><div className="card-d">More problems, more reinforcement.</div></div>
              <div className="card"><div className="card-t">Challenge yourself</div><div className="card-d">Easy → medium → hard.</div></div>
              <div className="card"><div className="card-t">Understand, don't memorise</div><div className="card-d">Principles transfer.</div></div>
              <div className="card"><div className="card-t">Think in patterns</div><div className="card-d">Group similar problems, note recurring techniques.</div></div>
            </div>
            <div className="grid g3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 12 }}>
              <div className="card"><div className="card-t">Repetition is key</div><div className="card-d">Revisit hard problems and re-solve without looking.</div></div>
              <div className="card"><div className="card-t">Create revision lists</div><div className="card-d">LeetCode lists for every problem you failed on first attempt.</div></div>
              <div className="card"><div className="card-t">Be consistent</div><div className="card-d">Stuck? Take a break, check hints, read the discussion — then try again.</div></div>
            </div>
          </div>
        </section>

        <section className="sec" id="patterns">
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-num">02 · The core twenty</span>
              <h2>20 patterns that make DSA tractable</h2>
              <p className="sub">For each pattern: when to reach for it, a reusable C++/Java template, a sample walkthrough, a complexity ladder with sparklines, and the practice set. <span className="star" style={{ padding: '2px 9px' }}>★ core</span> = interview shortlist.</p>
            </div>
            <div className="docs">
              <aside className="rail-wrap"><nav className="rail" id="rail" aria-label="Pattern index" dangerouslySetInnerHTML={{ __html: html.rail }} /></aside>
              <div id="patHost" dangerouslySetInnerHTML={{ __html: patHtml }} />
            </div>
          </div>
        </section>

        <section className="sec" id="dp">
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-num">03 · Dynamic programming</span>
              <h2>20 patterns to master DP</h2>
              <p className="sub">Listed from easy to hard; every entry links straight to its LeetCode practice set. Start with <b>Fibonacci</b>, end with <b>state machines</b>.</p>
            </div>
            <div className="dp-grid" id="dpGrid" dangerouslySetInnerHTML={{ __html: dpHtml }} />
          </div>
        </section>

        <section className="sec" id="cheatsheet">
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-num">04 · Cheatsheet</span>
              <h2>All 40 patterns, one table</h2>
              <p className="sub">The whole playbook at a glance. Every name jumps to its section.</p>
            </div>
            <div className="tbl-wrap"><table className="cx-table">
              <thead><tr><th style={{ minWidth: 56 }}>#</th><th>Pattern</th><th>Reach for it when</th><th className="cx">Best</th><th className="cx" style={{ minWidth: 86 }}>Growth</th></tr></thead>
              <tbody dangerouslySetInnerHTML={{ __html: html.cheat }} />
            </table></div>
          </div>
        </section>

        <section className="sec" id="resources">
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-num">05 · Resources</span>
              <h2>The resources worth your time</h2>
              <p className="sub">Free, foundational, battle-tested.</p>
            </div>
            <div className="grid g2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 12 }}>
              <a className="res-card" href="https://www.youtube.com/playlist?list=PLDN4rrl48XKpZkf03iYFl-O29szjTrs_O" target="_blank" rel="noopener"><div className="rc-ico">▶</div><div><div className="rc-t">Abdul Bari — Algorithms Playlist</div><div className="rc-d">Complexity, sorting, graphs, DP — from first principles.</div></div><span className="rc-ext">↗</span></a>
              <a className="res-card" href="https://www.youtube.com/playlist?list=PLDV1Zeh2NRsB6SWUrDFWC2PDqOgtkOOLI" target="_blank" rel="noopener"><div className="rc-ico">▦</div><div><div className="rc-t">William Fiset — Data Structures</div><div className="rc-d">Every structure, visualised and implemented.</div></div><span className="rc-ext">↗</span></a>
              <a className="res-card" href="https://www.youtube.com/playlist?list=PLDV1Zeh2NRsDGO4--qE8yH72HFL1Km93P" target="_blank" rel="noopener"><div className="rc-ico">🕸</div><div><div className="rc-t">William Fiset — Graph Theory</div><div className="rc-d">DFS, BFS, shortest paths, flows.</div></div><span className="rc-ext">↗</span></a>
              <a className="res-card" href="https://www.youtube.com/playlist?list=PLrmLmBdmIlpsHaNTPP_jHHDx_os9ItYXr" target="_blank" rel="noopener"><div className="rc-ico">◧</div><div><div className="rc-t">Tushar Roy — Dynamic Programming</div><div className="rc-d">Knapsack, LCS, LIS, and friends.</div></div><span className="rc-ext">↗</span></a>
              <a className="res-card" href="https://www.coursera.org/learn/algorithms-part1" target="_blank" rel="noopener"><div className="rc-ico">🎓</div><div><div className="rc-t">Coursera — Algorithms, Part I &amp; II</div><div className="rc-d">Sedgewick &amp; Wayne. Rigorous.</div></div><span className="rc-ext">↗</span></a>
              <a className="res-card" href="https://github.com/ashishps1/awesome-leetcode-resources" target="_blank" rel="noopener"><div className="rc-ico">★</div><div><div className="rc-t">awesome-leetcode-resources</div><div className="rc-d">Curated roadmap lists, pattern guides and solution sets.</div></div><span className="rc-ext">↗</span></a>
            </div>
            <div className="note-warn" style={{ marginTop: 22 }}><strong>Source material:</strong> this playbook is built on three essays by <b>Ashish Pratap Singh</b> (AlgoMaster) — <a href="https://blog.algomaster.io/p/20-dsa-patterns" target="_blank" rel="noopener">20 DSA Patterns</a>, <a href="https://blog.algomaster.io/p/20-patterns-to-master-dynamic-programming" target="_blank" rel="noopener">20 DP Patterns</a> and <a href="https://blog.algomaster.io/p/how-i-mastered-data-structures-and-algorithms" target="_blank" rel="noopener">How I Mastered DSA</a>.</div>
          </div>
        </section>
      </main>

      <footer>
        <div className="wrap">
          <span>Pattern Master · 40 patterns · cyan / dark</span>
          <span>Patterns over problems — <b style={{ color: 'var(--a-300)' }}>always</b></span>
        </div>
      </footer>
      <button id="top" aria-label="Back to top">↑</button>
      <div id="prog" />
    </div>
  );
}
