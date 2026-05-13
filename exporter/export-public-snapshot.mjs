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

function pickAllowedList(items, allowedFields) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => Object.fromEntries(allowedFields.map((field) => [field, item?.[field] ?? ''])));
}

function containsBlockedValue(value, blockedPatterns) {
  if (Array.isArray(value)) {
    for (const child of value) {
      const hit = containsBlockedValue(child, blockedPatterns);
      if (hit) return hit;
    }
    return null;
  }

  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) {
      const hit = containsBlockedValue(child, blockedPatterns);
      if (hit) return hit;
    }
    return null;
  }

  if (typeof value === 'string') {
    const lowered = value.toLowerCase();
    return blockedPatterns.find((pattern) => lowered.includes(pattern.toLowerCase())) ?? null;
  }

  return null;
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
  const fields = allowlist.public_fields;
  const now = new Date();

  const publicSnapshot = {
    site: {
      owner: privateSnapshot.site?.owner ?? 'Adgai',
      tagline:
        privateSnapshot.site?.tagline ??
        'Personal AI systems, resource orchestration, and knowledge automation.',
      current_focus:
        privateSnapshot.site?.current_focus ?? ['AI resource orchestration', 'personal knowledge automation'],
      public_build_time: now.toISOString(),
    },
    public_metrics: {
      project_count: privateSnapshot.public_metrics?.project_count ?? 3,
      public_note_count: privateSnapshot.public_metrics?.public_note_count ?? 0,
      resource_console_status: privateSnapshot.public_metrics?.resource_console_status ?? 'local-only',
      last_public_update: now.toISOString().slice(0, 10),
    },
    featured_projects: pickAllowedList(privateSnapshot.featured_projects, fields.featured_projects),
    public_notes: pickAllowedList(privateSnapshot.public_notes, fields.public_notes),
  };

  const blocked = containsBlockedValue(publicSnapshot, rules.blocked_patterns);
  if (blocked) {
    throw new Error(`Blocked value detected in public snapshot: ${blocked}`);
  }

  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(publicSnapshot, null, 2)}\n`, 'utf8');
  return output;
}

try {
  const output = exportSnapshot();
  console.log(`Public snapshot written: ${output}`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

