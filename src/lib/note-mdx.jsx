import React from 'react';
import MarkdownIt from 'markdown-it';
import CodeBlock from '../components/editor/CodeBlock';
import { VideoEmbed, Timestamp } from '../components/editor/VideoEmbed';

/* ═══════════════════════════════════════════════════════════════════════
   Daily-note Markdown engine.
   - CommonMark (headings, bold/italic, lists, quotes, tables, links, images)
   - custom inline: [Video Title](://youtube.com/…)  → embedded player
   - custom inline: [12:34] / [1:02:03]               → seekable timestamp chip
   - ```lang fences render as live CodeMirror editor instances
   ═══════════════════════════════════════════════════════════════════════ */

const md = new MarkdownIt({ html: true, linkify: true, breaks: true });

/* ── [Title](://youtube… | youtu.be… | youtube.com/…) ── */
const VIDEO_RE = /^\[([^\]]+)\]\(((?::\/\/|https?:\/\/)(?:www\.|m\.)?(?:youtube\.com|youtu\.be)[^)\n]*)\)/;
md.inline.ruler.before('link', 'dsa400_video', (state, silent) => {
  const m = state.src.slice(state.pos).match(VIDEO_RE);
  if (!m) return false;
  const id = extractYouTubeId(m[2]);
  if (!id) return false;
  if (!silent) {
    const tok = state.push('video', '', 0);
    tok.title = m[1];
    tok.videoId = id;
    tok.url = m[2];
  }
  state.pos += m[0].length;
  return true;
});

/* ── [MM:SS] / [H:MM:SS] ── */
const TS_RE = /^\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]/;
md.inline.ruler.before('link', 'dsa400_ts', (state, silent) => {
  const m = state.src.slice(state.pos).match(TS_RE);
  if (!m) return false;
  const h = m[3] ? parseInt(m[1], 10) : 0;
  const mm = m[3] ? parseInt(m[2], 10) : parseInt(m[1], 10);
  const ss = m[3] ? parseInt(m[3], 10) : parseInt(m[2], 10);
  if (!silent) {
    const tok = state.push('timestamp', '', 0);
    tok.label = m[0].slice(1, -1);
    tok.seconds = h * 3600 + mm * 60 + ss;
  }
  state.pos += m[0].length;
  return true;
});

/* ── helpers ── */
export function extractYouTubeId(url) {
  const s = String(url || '').trim();
  let m = s.match(/(?:youtu\.be\/|youtube\.com\/(?:embed|shorts|live|v)\/)([A-Za-z0-9_-]{6,})/);
  if (m) return m[1];
  m = s.match(/[?&]v=([A-Za-z0-9_-]{6,})/);
  if (m) return m[1];
  return null;
}

export function timestampToSeconds(label) {
  const p = String(label || '').split(':').map(Number);
  if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
  if (p.length === 2) return p[0] * 60 + p[1];
  return 0;
}

export function slugify(s) {
  return String(s || '').toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64) || 'note';
}

/* ═══════════════════════ token → React renderer ═══════════════════════ */
let _k = 0;
const key = () => `k${++_k}`;

export function renderMarkdown(mdText, opts = {}) {
  if (!mdText) return null;
  let tokens;
  try { tokens = md.parse(mdText, {}); } catch {
    return <p className="n-md-err">Could not parse markdown.</p>;
  }
  const iRef = { i: 0 };
  return <div className="n-md">{renderBlocks(tokens, iRef, opts)}</div>;
}

/* block wrapper factory: fn(children) → element */
function blockWrapper(t) {
  switch (t.type) {
    case 'heading_open': return kids => React.createElement(t.tag, { key: key(), id: t.attrGet('id') || undefined }, kids);
    case 'paragraph_open': return kids => <p key={key()}>{kids}</p>;
    case 'blockquote_open': return kids => <blockquote key={key()}>{kids}</blockquote>;
    case 'bullet_list_open': return kids => <ul key={key()}>{kids}</ul>;
    case 'ordered_list_open': return kids => <ol key={key()} start={t.attrGet('start') ? Number(t.attrGet('start')) : undefined}>{kids}</ol>;
    case 'list_item_open': return kids => <li key={key()}>{kids}</li>;
    case 'table_open': return kids => <div className="n-table" key={key()}><table>{kids}</table></div>;
    case 'thead_open': return kids => <thead key={key()}>{kids}</thead>;
    case 'tbody_open': return kids => <tbody key={key()}>{kids}</tbody>;
    case 'tr_open': return kids => <tr key={key()}>{kids}</tr>;
    case 'th_open': return kids => <th key={key()} style={t.attrGet('style') ? { textAlign: t.attrGet('style').includes('right') ? 'right' : t.attrGet('style').includes('center') ? 'center' : 'left' } : undefined}>{kids}</th>;
    case 'td_open': return kids => <td key={key()} style={t.attrGet('style') ? { textAlign: t.attrGet('style').includes('right') ? 'right' : t.attrGet('style').includes('center') ? 'center' : 'left' } : undefined}>{kids}</td>;
    default: return kids => <div key={key()}>{kids}</div>;
  }
}

function renderBlocks(tokens, iRef, opts) {
  const out = [];
  while (iRef.i < tokens.length) {
    const t = tokens[iRef.i++];
    if (t.nesting === 1) {
      out.push(blockWrapper(t)(renderBlocks(tokens, iRef, opts)));
    } else if (t.nesting === -1) {
      break;
    } else if (t.type === 'inline') {
      const j = { i: 0 };
      out.push(renderInlines(t.children || [], j, opts));
    } else {
      const el = selfBlock(t, opts);
      if (el != null) out.push(el);
    }
  }
  return out;
}

function selfBlock(t, opts) {
  switch (t.type) {
    case 'fence':
      return (
        <CodeBlock
          key={key()}
          lang={(t.info || 'cpp').trim()}
          code={t.content}
          readOnly={!!opts.readOnly}
          onChange={opts.onFenceChange ? code => opts.onFenceChange(t, code) : undefined}
        />
      );
    case 'code_block':
      return <CodeBlock key={key()} lang="" code={t.content} readOnly={!!opts.readOnly} />;
    case 'hr': return <hr key={key()} className="n-hr" />;
    case 'html_block': return <div key={key()} dangerouslySetInnerHTML={{ __html: t.content }} />;
    default: return null;
  }
}

/* inline wrapper factory */
function inlineWrapper(t) {
  switch (t.type) {
    case 'em_open': return kids => <em key={key()}>{kids}</em>;
    case 'strong_open': return kids => <strong key={key()}>{kids}</strong>;
    case 's_open': return kids => <s key={key()}>{kids}</s>;
    case 'link_open': {
      const href = t.attrGet('href') || '#';
      return kids => <a key={key()} href={href} title={t.attrGet('title') || undefined} target="_blank" rel="noopener noreferrer">{kids}</a>;
    }
    default: return kids => <span key={key()}>{kids}</span>;
  }
}

function leafInline(t) {
  switch (t.type) {
    case 'text': return t.content;
    case 'code_inline': return <code key={key()}>{t.content}</code>;
    case 'softbreak': return ' ';
    case 'hardbreak': return <br key={key()} />;
    case 'image': {
      const src = t.attrGet('src') || '';
      const alt = t.children && t.children[0] ? t.children[0].content : '';
      return (
        <a key={key()} className="n-img-link" href={src} target="_blank" rel="noopener noreferrer" title={alt || 'Open image'}>
          <img src={src} alt={alt} title={t.attrGet('title') || undefined} loading="lazy" />
        </a>
      );
    }
    case 'html_inline': return <span key={key()} dangerouslySetInnerHTML={{ __html: t.content }} />;
    case 'video': return <VideoEmbed key={key()} videoId={t.videoId} title={t.title} />;
    case 'timestamp': return <Timestamp key={key()} seconds={t.seconds} label={t.label} />;
    default: return null;
  }
}

function renderInlines(tokens, iRef, opts) {
  const out = [];
  while (iRef.i < tokens.length) {
    const t = tokens[iRef.i++];
    if (t.nesting === 1) {
      out.push(inlineWrapper(t)(renderInlines(tokens, iRef, opts)));
    } else if (t.nesting === -1) {
      break;
    } else {
      const el = leafInline(t, opts);
      if (el != null) out.push(el);
    }
  }
  return out;
}
