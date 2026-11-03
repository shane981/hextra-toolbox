#!/usr/bin/env node
// Zero-dependency validator for Hextra toolbox talk JSON.
// Mirrors schema/talk.schema.json (see SCHEMA.md). Usage: node scripts/validate.mjs talk.json [more.json]
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const REQUIRED = ['id', 'title', 'date', 'week_label', 'sources_reviewed', 'key_risk',
  'drivers_need_to_know', 'supervisors_must_check', 'discussion_questions',
  'practical_checklist', 'required_records', 'follow_up_actions'];
const OPTIONAL = ['schema_version', 'summary', 'prepared_by'];
const SOURCE_KEYS = ['name', 'title', 'url', 'date', 'type', 'accessed', 'note'];
const SOURCE_TYPES = ['regulator', 'government', 'industry', 'other'];
const ACTION_KEYS = ['action', 'owner', 'due'];

const isStr = (v) => typeof v === 'string';
function realDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function validateTalk(t) {
  const e = [];
  const text = (v, path, min = 3, max = 1200) => {
    if (!isStr(v)) return e.push(`${path} must be a string`);
    const n = v.trim().length;
    if (n < min) e.push(`${path} must be at least ${min} characters`);
    if (v.length > max) e.push(`${path} must be at most ${max} characters`);
  };
  const list = (v, path) => {
    if (!Array.isArray(v)) return e.push(`${path} must be an array of strings`);
    if (v.length < 1) e.push(`${path} must have at least 1 item`);
    v.forEach((x, i) => text(x, `${path}[${i}]`));
  };
  if (t === null || typeof t !== 'object' || Array.isArray(t)) return ['talk must be a JSON object'];
  for (const k of REQUIRED) if (!(k in t)) e.push(`missing required field: ${k}`);
  for (const k of Object.keys(t)) if (!REQUIRED.includes(k) && !OPTIONAL.includes(k)) e.push(`unknown field: ${k}`);
  if ('schema_version' in t && t.schema_version !== 1) e.push('schema_version must be 1');
  if ('id' in t) {
    if (!isStr(t.id) || !/^\d{4}-\d{2}-\d{2}(-[a-z0-9]+(-[a-z0-9]+)*)?$/.test(t.id)) e.push('id must look like YYYY-MM-DD or YYYY-MM-DD-suffix (lowercase)');
    else if (isStr(t.date) && !t.id.startsWith(t.date)) e.push('id must start with the talk date');
  }
  if ('title' in t) text(t.title, 'title', 5, 140);
  if ('date' in t && !(isStr(t.date) && realDate(t.date))) e.push('date must be a real date in YYYY-MM-DD format');
  if ('week_label' in t) text(t.week_label, 'week_label', 3, 80);
  if ('summary' in t) text(t.summary, 'summary', 0, 800);
  if ('prepared_by' in t) text(t.prepared_by, 'prepared_by', 0, 120);
  if ('key_risk' in t) text(t.key_risk, 'key_risk', 20, 1200);
  if ('sources_reviewed' in t) {
    const s = t.sources_reviewed;
    if (!Array.isArray(s) || s.length < 1) e.push('sources_reviewed must be a non-empty array');
    else s.forEach((src, i) => {
      const p = `sources_reviewed[${i}]`;
      if (!src || typeof src !== 'object' || Array.isArray(src)) return e.push(`${p} must be an object`);
      for (const k of ['name', 'title', 'url', 'date']) if (!(k in src)) e.push(`${p} missing ${k}`);
      for (const k of Object.keys(src)) if (!SOURCE_KEYS.includes(k)) e.push(`${p} unknown field: ${k}`);
      if ('name' in src) text(src.name, `${p}.name`, 2, 120);
      if ('title' in src) text(src.title, `${p}.title`, 3, 300);
      if ('url' in src) {
        let ok = false;
        try { const u = new URL(src.url); ok = u.protocol === 'https:' || u.protocol === 'http:'; } catch {}
        if (!ok) e.push(`${p}.url must be an absolute http(s) URL`);
      }
      if ('date' in src && !(isStr(src.date) && (/^(\d{4}(-\d{2})?|undated)$/.test(src.date) || realDate(src.date)))) e.push(`${p}.date must be YYYY-MM-DD, YYYY-MM, YYYY or "undated"`);
      if ('type' in src && !SOURCE_TYPES.includes(src.type)) e.push(`${p}.type must be one of ${SOURCE_TYPES.join(', ')}`);
      if ('accessed' in src && !(isStr(src.accessed) && realDate(src.accessed))) e.push(`${p}.accessed must be YYYY-MM-DD`);
      if ('note' in src) text(src.note, `${p}.note`, 0, 400);
    });
  }
  for (const k of ['drivers_need_to_know', 'supervisors_must_check', 'practical_checklist']) if (k in t) list(t[k], k);
  if ('discussion_questions' in t) {
    if (!Array.isArray(t.discussion_questions) || t.discussion_questions.length !== 5) e.push('discussion_questions must contain exactly 5 questions');
    if (Array.isArray(t.discussion_questions)) t.discussion_questions.forEach((x, i) => text(x, `discussion_questions[${i}]`));
  }
  if ('required_records' in t) {
    if (isStr(t.required_records)) text(t.required_records, 'required_records');
    else list(t.required_records, 'required_records');
  }
  if ('follow_up_actions' in t) {
    const f = t.follow_up_actions;
    if (!Array.isArray(f) || f.length < 1) e.push('follow_up_actions must be a non-empty array');
    else f.forEach((a, i) => {
      const p = `follow_up_actions[${i}]`;
      if (isStr(a)) return text(a, p);
      if (!a || typeof a !== 'object' || Array.isArray(a)) return e.push(`${p} must be a string or {action, owner?, due?}`);
      if (!('action' in a)) e.push(`${p} missing action`);
      for (const k of Object.keys(a)) if (!ACTION_KEYS.includes(k)) e.push(`${p} unknown field: ${k}`);
      if ('action' in a) text(a.action, `${p}.action`);
      if ('owner' in a) text(a.owner, `${p}.owner`, 0, 80);
      if ('due' in a) text(a.due, `${p}.due`, 0, 40);
    });
  }
  return e;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const files = process.argv.slice(2);
  if (!files.length) { console.error('Usage: node scripts/validate.mjs talk.json [...]'); process.exit(2); }
  let bad = 0;
  for (const f of files) {
    let t;
    try { t = JSON.parse(readFileSync(f, 'utf8')); } catch (err) { console.error(`✗ ${f}: invalid JSON – ${err.message}`); bad++; continue; }
    const errs = validateTalk(t);
    if (errs.length) { bad++; console.error(`✗ ${f}:\n  - ${errs.join('\n  - ')}`); } else console.log(`✓ ${f} is valid (${t.id}: ${t.title})`);
  }
  process.exit(bad ? 1 : 0);
}
