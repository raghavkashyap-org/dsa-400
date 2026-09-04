import { P } from './patterns-data';

/* Turn a full Pattern Master block into a Markdown article section, so a
   pattern can be pasted into a Daily Note with everything it had on /patterns. */

export const PATTERNS = P;

export const getPattern = id =>
  P.find(p => p.id === id) || P.find(p => String(p.n) === String(id)) || null;

const lcURL = (id, title) =>
  'https://leetcode.com/problems/' + String(title).toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, '-') + '/';

export function patternToMarkdown(p) {
  if (!p) return '';
  const L = [];
  L.push('---');
  L.push('');
  L.push('## 🧩 Pattern Reference — ' + p.name);
  L.push('');
  L.push('**What the pattern is**');
  L.push('');
  L.push(stripTags(p.what));
  L.push('');
  L.push('**The mental model**');
  L.push('');
  L.push(stripTags(p.model));
  if (p.formula) {
    L.push('');
    L.push('**Core identity**');
    L.push('');
    L.push('```text');
    L.push(p.formula);
    L.push('```');
  }
  if (p.use && p.use.length) {
    L.push('');
    L.push('**When to reach for it**');
    L.push('');
    p.use.forEach(u => L.push('- ' + stripTags(u)));
  }
  if (p.cx && p.cx.length) {
    L.push('');
    L.push('**Complexity ladder**');
    L.push('');
    L.push('| Approach | Time | Space |');
    L.push('|---|---|---|');
    p.cx.forEach(r => L.push('| ' + stripTags(r.a) + ' | `' + r.t + '` | `' + r.s + '` |'));
  }
  if (p.how && p.how.length) {
    L.push('');
    L.push('**How the template works — piece by piece**');
    L.push('');
    p.how.forEach(s => L.push('- ' + stripTags(s)));
  }
  if (p.tmpl && p.tmpl.cpp) {
    L.push('');
    L.push('**Reusable template — C++**');
    L.push('');
    L.push('```cpp');
    L.push(p.tmpl.cpp.trim());
    L.push('```');
  }
  if (p.tmpl && p.tmpl.java) {
    L.push('');
    L.push('**Reusable template — Java**');
    L.push('');
    L.push('```java');
    L.push(p.tmpl.java.trim());
    L.push('```');
  }
  if (p.sample) {
    L.push('');
    L.push('**Sample problem — ' + stripTags(p.sample.t) + '**');
    L.push('');
    L.push('> **in** · `' + p.sample.in + '`  ·  **out** · `' + p.sample.out + '`');
    if (p.sample.trace) {
      L.push('');
      L.push('```text');
      L.push(p.sample.trace.trim());
      L.push('```');
    }
  }
  if (p.practice && p.practice.length) {
    L.push('');
    L.push('**Practice set**');
    L.push('');
    p.practice.forEach(q => {
      L.push('- [' + q[0] + ' · ' + q[1] + '](' + lcURL(q[0], q[1]) + ')' + (q[2] ? ' ★ pick' : ''));
    });
  }
  L.push('');
  return L.join('\n');
}

/* markdown is fine with inline <b>/<code>, but convert to plain markdown for
   portability and to avoid raw HTML in the article */
function stripTags(s) {
  return String(s == null ? '' : s)
    .replace(/<b>/gi, '**').replace(/<\/b>/gi, '**')
    .replace(/<strong>/gi, '**').replace(/<\/strong>/gi, '**')
    .replace(/<i>/gi, '_').replace(/<\/i>/gi, '_')
    .replace(/<em>/gi, '_').replace(/<\/em>/gi, '_')
    .replace(/<code>/gi, '`').replace(/<\/code>/gi, '`')
    .replace(/<br\s*\/?>/gi, '  \n')
    .replace(/<[^>]+>/g, '');
}
