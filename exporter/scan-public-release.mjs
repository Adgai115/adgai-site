#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_ROOT = path.join(ROOT, 'public-site');
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
    } else {
      entries.push(current);
    }
  }
  return entries;
}

function scan() {
  const rules = readJson(RULES_PATH);
  const blockedPatterns = rules.blocked_patterns.map((pattern) => pattern.toLowerCase());
  const blockedExtensions = new Set(rules.blocked_extensions.map((ext) => ext.toLowerCase()));
  const binaryExtensions = new Set(['.mp4','.webm','.mov','.avi','.png','.jpg','.jpeg','.gif','.webp','.svg','.ico','.woff','.woff2','.ttf','.eot','.pdf','.zip','.gz','.tar','.exe','.dll','.mp3','.wav','.ogg']);
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

    if (base === '.env' || base === '.git') {
      findings.push(`blocked file name: ${rel}`);
      continue;
    }

    let content;
    try {
      content = fs.readFileSync(filePath, 'utf8').toLowerCase();
    } catch {
      continue;
    }

    for (const pattern of blockedPatterns) {
      if (content.includes(pattern)) {
        findings.push(`blocked pattern '${pattern}' in ${rel}`);
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

