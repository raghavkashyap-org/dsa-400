/* Parse a LeetCode-style README.md (already absolutized: relative links and
   images rewritten to raw.githubusercontent.com) into structured pieces so the
   article can render it as a proper problem view:

     title · meta table · question statement · examples (input / output /
     explanation, with images left inline where they appear) · constraints ·
     any other bold sections (solution / approach).                         */

function parseIoFence(fence) {
  const io = { input: [], output: [], explanation: [] };
  let cur = null;
  for (const raw of fence.split('\n')) {
    const t = raw.replace(/\*/g, '').trim();
    let m = t.match(/^Input\s*:\s*(.*)$/i);
    if (m) { cur = 'input'; if (m[1]) io.input.push(m[1]); continue; }
    m = t.match(/^Output\s*:\s*(.*)$/i);
    if (m) { cur = 'output'; if (m[1]) io.output.push(m[1]); continue; }
    m = t.match(/^Explanation\s*:\s*(.*)$/i);
    if (m) { cur = 'explanation'; if (m[1]) io.explanation.push(m[1]); continue; }
    if (cur) io[cur].push(t);
  }
  const has = io.input.length || io.output.length || io.explanation.length;
  if (!has) return null;
  return {
    input: io.input.join('\n').trim() || undefined,
    output: io.output.join('\n').trim() || undefined,
    explanation: io.explanation.join('\n').trim() || undefined,
  };
}

export function parseReadme(md) {
  if (!md) return null;
  const lines = md.split(/\r?\n/);
  const out = { title: null, meta: null, statement: '', examples: [], constraints: [], extra: [], raw: md };

  let i = 0;
  /* ── title (first `# …`) ── */
  for (; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t.startsWith('# ')) { out.title = t.replace(/^#\s*/, '').trim(); i++; break; }
    if (t) break;
  }
  /* ── meta table (| key | value |) ── */
  const meta = {};
  let sawTable = false;
  for (; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t.startsWith('|') && t.includes('|')) {
      const cells = t.split('|').slice(1, -1).map(c => c.trim());
      if (cells.length >= 2 && !/^-+$/.test(cells[0])) {
        const k = cells[0], v = cells[1];
        if (!(k === 'Field' && v === 'Value') && k && v) { meta[k] = v; sawTable = true; }
      }
    } else if (t === '') {
      continue;
    } else {
      break;
    }
  }
  out.meta = sawTable ? meta : null;

  /* ── body state machine ── */
  let mode = 'statement';
  const stBuf = [];
  let ex = null;      // { heading, body:[], io:{} }
  let ext = null;     // { heading, body:[] }
  const IO_BOLD = /^(input|output|explanation)\b/i;

  const flushEx = () => { if (ex) out.examples.push({ heading: ex.heading, body: ex.body.join('\n').trim(), ...ex.io }); ex = null; };
  const flushExt = () => { if (ext) out.extra.push({ heading: ext.heading, body: ext.body.join('\n').trim() }); ext = null; };

  for (; i < lines.length; i++) {
    const raw = lines[i];
    const t = raw.trim();

    /* example heading: **Example N:**  or  ## Example N */
    let m = t.match(/^\*\*Example\s+(\d+)/i) || t.match(/^#{1,6}\s*Example\s+(\d+)/i);
    if (m) { flushExt(); flushEx(); ex = { heading: 'Example ' + m[1], body: [], io: {} }; mode = 'example'; continue; }

    /* constraints heading (colon may sit inside the bold: **Constraints:**) */
    if (/^\*\*Constraints?\b/i.test(t) || /^#{1,6}\s*Constraints?\b/i.test(t)) { flushExt(); flushEx(); mode = 'constraints'; continue; }

    /* horizontal-rule separators */
    if (/^-{3,}\s*$/.test(t)) continue;

    /* other bold / markdown heading */
    m = t.match(/^\*\*([^*]+)\*\*\s*:?\s*$/) || t.match(/^#{1,6}\s+(.*)$/);
    if (m) {
      const h = (m[1] || '').trim();
      if (mode === 'example' && IO_BOLD.test(h)) { ex.body.push(raw); continue; } // keep **Input:** inside example
      flushExt(); flushEx();
      if (h && !/^Example\s+\d/i.test(h)) { ext = { heading: h, body: [] }; mode = 'extra'; }
      else mode = 'extra';
      continue;
    }

    /* fenced code block inside an example → parse Input/Output/Explanation */
    if (mode === 'example' && t.startsWith('```')) {
      const fence = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) { fence.push(lines[i]); i++; }
      const io = parseIoFence(fence.join('\n'));
      if (io) { ex.io = { ...ex.io, ...io }; }
      else { ex.body.push(raw, ...fence, lines[i] || ''); }
      continue;
    }

    if (mode === 'statement') stBuf.push(raw);
    else if (mode === 'example') ex.body.push(raw);
    else if (mode === 'constraints') {
      const item = t.replace(/^[-*]\s+/, '');
      if (item && !/^Constraints?\*\*/.test(t)) out.constraints.push(item);
    }
    else if (mode === 'extra') ext.body.push(raw);
  }
  flushExt();
  flushEx();
  out.statement = stBuf.join('\n').trim();

  /* if nothing structured was found, the whole body is the statement */
  if (!out.examples.length && !out.constraints.length && !out.extra.length && !out.statement) {
    out.statement = md.trim();
  }
  return out;
}
