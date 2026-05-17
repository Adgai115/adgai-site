#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_ROOT = path.resolve(ROOT, '..', 'adgai-site-public');
const RULES_PATH = path.join(ROOT, 'exporter', 'redaction_rules.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function walk(dir) {
  const entries = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const current = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      entries.push(...walk(current));
    } else if (entry.isFile()) {
      entries.push(current);
    }
  }
  return entries;
}

function scan() {
  const rules = readJson(RULES_PATH);
  const blockedPatterns = rules.blocked_patterns.map((pattern) => pattern.toLowerCase());
  const blockedRegexes = (Array.isArray(rules.blocked_regex_patterns) ? rules.blocked_regex_patterns : []).map(
    (src) => new RegExp(src, 'i'),
  );
  const blockedExtensions = new Set(rules.blocked_extensions.map((ext) => ext.toLowerCase()));
  // SVG is intentionally not in binary list — SVG can carry <script> and event handlers.
  const binaryExtensions = new Set([
    '.mp4', '.webm', '.mov', '.avi', '.png', '.jpg', '.jpeg', '.gif', '.webp',
    '.ico', '.woff', '.woff2', '.ttf', '.eot', '.pdf', '.zip', '.gz', '.tar',
    '.exe', '.dll', '.mp3', '.wav', '.ogg',
  ]);
  const svgDangerous = [/<script\b/i, /\son[a-z]+\s*=/i, /javascript:/i, /<foreignObject\b/i];
  const findings = [];

  for (const filePath of walk(PUBLIC_ROOT)) {
    const rel = path.relative(ROOT, filePath);
    const ext = path.extname(filePath).toLowerCase();
    const base = path.basename(filePath).toLowerCase();

    if (blockedExtensions.has(ext)) {
      findings.push(`blocked extension: ${rel}`);
      continue;
    }

    if (binaryExtensions.has(ext)) {
      continue;
    }

    if (base === '.env' || base === '.git' || base.startsWith('.env.')) {
      findings.push(`blocked file name: ${rel}`);
      continue;
    }

    let content;
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch {
      continue;
    }
    const lowered = content.toLowerCase();

    for (const pattern of blockedPatterns) {
      if (lowered.includes(pattern)) {
        findings.push(`blocked pattern '${pattern}' in ${rel}`);
      }
    }
    for (const regex of blockedRegexes) {
      if (regex.test(content)) {
        findings.push(`blocked regex /${regex.source}/ in ${rel}`);
      }
    }
    if (ext === '.svg') {
      for (const sd of svgDangerous) {
        if (sd.test(content)) {
          findings.push(`unsafe SVG construct /${sd.source}/ in ${rel}`);
        }
      }
    }
  }

  return findings;
}

const findings = scan();
if (findings.length) {
  console.error('Public release scan failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log('Public release scan passed.');
