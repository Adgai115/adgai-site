#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ALLOWLIST_PATH = path.join(ROOT, 'exporter', 'allowlist.json');
const RULES_PATH = path.join(ROOT, 'exporter', 'redaction_rules.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function isSafePublicUrl(value) {
  if (typeof value !== 'string' || value.length === 0) return false;
  if (value.startsWith('//')) return false;
  if (value.startsWith('/')) return true;
  return /^https?:\/\/[^\s<>"'`\\]+$/i.test(value);
}

function pickAllowedItem(item, allowedFields) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  const out = {};
  for (const field of allowedFields) {
    const v = item[field];
    if (v === undefined || v === null) continue;
    if (field === 'public_url') {
      if (!isSafePublicUrl(v)) return null;
      out[field] = v;
      continue;
    }
    out[field] = v;
  }
  return out;
}

function pickAllowedList(items, allowedFields, requiredFields) {
  if (!Array.isArray(items)) return [];
  const out = [];
  for (const item of items) {
    const picked = pickAllowedItem(item, allowedFields);
    if (!picked) continue;
    let ok = true;
    for (const r of requiredFields) {
      const v = picked[r];
      if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) { ok = false; break; }
    }
    if (ok) out.push(picked);
  }
  return out;
}

function containsBlockedValue(value, blockedPatterns, blockedRegexes) {
  if (Array.isArray(value)) {
    for (const child of value) {
      const hit = containsBlockedValue(child, blockedPatterns, blockedRegexes);
      if (hit) return hit;
    }
    return null;
  }

  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) {
      const hit = containsBlockedValue(child, blockedPatterns, blockedRegexes);
      if (hit) return hit;
    }
    return null;
  }

  if (typeof value === 'string') {
    const lowered = value.toLowerCase();
    for (const pattern of blockedPatterns) {
      if (lowered.includes(pattern.toLowerCase())) return pattern;
    }
    for (const regex of blockedRegexes) {
      if (regex.test(value)) return `/${regex.source}/`;
    }
  }

  return null;
}

function writeAtomic(filePath, content) {
  const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, filePath);
}

function exportSnapshot() {
  const allowlist = readJson(ALLOWLIST_PATH);
  const rules = readJson(RULES_PATH);
  const source = path.resolve(ROOT, 'exporter', allowlist.source_private_snapshot);
  const output = path.resolve(ROOT, 'exporter', allowlist.output_public_snapshot);

  if (!fs.existsSync(source)) {
    throw new Error(`Private snapshot not found: ${source}`);
  }

  const privateSnapshot = readJson(source);
  if (!privateSnapshot || typeof privateSnapshot !== 'object') {
    throw new Error('Private snapshot is not a valid object');
  }
  const site = privateSnapshot.site;
  if (!site || typeof site !== 'object') {
    throw new Error('Private snapshot missing required `site` object — refusing to fall back to defaults');
  }
  const metrics = privateSnapshot.public_metrics;
  if (!metrics || typeof metrics !== 'object') {
    throw new Error('Private snapshot missing required `public_metrics` object');
  }

  const fields = allowlist.public_fields;
  const now = new Date();

  const publicSnapshot = {
    site: {
      owner: typeof site.owner === 'string' && site.owner.length > 0 ? site.owner : 'Adgai',
      tagline: typeof site.tagline === 'string' ? site.tagline : '',
      current_focus: Array.isArray(site.current_focus) ? site.current_focus.filter((s) => typeof s === 'string') : [],
      public_build_time: now.toISOString(),
    },
    public_metrics: {
      project_count: Number.isFinite(metrics.project_count) ? metrics.project_count : 0,
      public_note_count: Number.isFinite(metrics.public_note_count) ? metrics.public_note_count : 0,
      resource_console_status:
        typeof metrics.resource_console_status === 'string' ? metrics.resource_console_status : 'local-only',
      last_public_update: now.toISOString().slice(0, 10),
    },
    featured_projects: pickAllowedList(privateSnapshot.featured_projects, fields.featured_projects, ['slug', 'name']),
    public_notes: pickAllowedList(privateSnapshot.public_notes, fields.public_notes, ['title']),
  };

  const blockedPatterns = Array.isArray(rules.blocked_patterns) ? rules.blocked_patterns : [];
  const blockedRegexes = (Array.isArray(rules.blocked_regex_patterns) ? rules.blocked_regex_patterns : []).map(
    (src) => new RegExp(src, 'i'),
  );
  const blocked = containsBlockedValue(publicSnapshot, blockedPatterns, blockedRegexes);
  if (blocked) {
    throw new Error(`Blocked value detected in public snapshot: ${blocked}`);
  }

  fs.mkdirSync(path.dirname(output), { recursive: true });
  writeAtomic(output, `${JSON.stringify(publicSnapshot, null, 2)}\n`);
  return output;
}

try {
  const output = exportSnapshot();
  console.log(`Public snapshot written: ${output}`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
