#!/usr/bin/env node
import childProcess from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HOST = '127.0.0.1';
const PORT = 18666;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SNAPSHOT_PATH = path.join(ROOT, 'private-console', 'snapshots', 'private_snapshot.json');
const OPENCLAW_ROOT = 'E:\\Dev\\.openclaw';
const POWERSHELL = process.env.SystemRoot
  ? path.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
  : 'powershell.exe';
const PRIVATE_LANGUAGES = ['zh-CN', 'en'];
const DEFAULT_PRIVATE_LANGUAGE = 'zh-CN';

const PRIVATE_COPY = {
  'zh-CN': {
    title: 'Adgai 私有资源后台',
    subtitle: '仅本地访问的运行视图。公开站只能消费脱敏导出。',
    updated: '更新于',
    health: '健康状态',
    gatewayProcesses: 'Gateway 进程',
    todaySessions: '今日会话',
    privateMode: '私有模式',
    collectors: '采集器',
    collector: '采集器',
    status: '状态',
    details: '详情',
    releaseBoundary: '发布边界',
    failedCollectors: '失败采集器',
    noFailedCollectors: '无',
    boundaryNote: '仅在审阅私有快照后运行导出器。公开导出基于字段白名单。',
    languageChinese: '中',
    languageEnglish: 'EN',
    statuses: {
      ok: '正常',
      failed: '失败',
      degraded: '降级',
      unknown: '未知',
    },
    resources: {
      disk: '磁盘',
      gateway: 'Gateway',
      sessions: '会话',
      diaries: '日记',
      models: '模型',
      backups: '备份',
      wechat: '微信数据',
      todaytask: '负一屏',
      webchat: 'WebChat',
    },
    detailLabels: {
      free_gb: '空闲',
      total_gb: '总量',
      process_count: '进程数',
      today_count: '今日数量',
      count: '数量',
      staged_count: '待激活',
      public_label: '公开标签',
      latest: '最新',
      error: '错误',
      total: '会话数',
      groups: '群聊数',
      today_msgs: '今日消息',
      active: '已配置',
    },
  },
  en: {
    title: 'Adgai Private Resource Console',
    subtitle: 'Local-only operational view. Public site must consume only sanitized exports.',
    updated: 'Updated',
    health: 'Health',
    gatewayProcesses: 'Gateway processes',
    todaySessions: 'Today sessions',
    privateMode: 'Private mode',
    collectors: 'Collectors',
    collector: 'Collector',
    status: 'Status',
    details: 'Details',
    releaseBoundary: 'Release Boundary',
    failedCollectors: 'Failed collectors',
    noFailedCollectors: 'none',
    boundaryNote: 'Run exporter only after reviewing this private snapshot. Public exports are allowlist based.',
    languageChinese: '中',
    languageEnglish: 'EN',
    statuses: {
      ok: 'ok',
      failed: 'failed',
      degraded: 'degraded',
      unknown: 'unknown',
    },
    resources: {
      disk: 'Disk',
      gateway: 'Gateway',
      sessions: 'Sessions',
      diaries: 'Diaries',
      models: 'Models',
      backups: 'Backups',
      wechat: 'WeChat',
      todaytask: 'TodayTask',
      webchat: 'WebChat',
    },
    detailLabels: {
      free_gb: 'free',
      total_gb: 'total',
      process_count: 'processes',
      today_count: 'today',
      count: 'count',
      staged_count: 'staged',
      public_label: 'public label',
      latest: 'latest',
      error: 'error',
      total: 'total',
      groups: 'groups',
      today_msgs: 'today msgs',
      active: 'active',
    },
  },
};

function commandOutput(command, args, timeout = 8000) {
  try {
    const result = childProcess.spawnSync(command, args, {
      encoding: 'utf8',
      timeout,
      windowsHide: true,
    });
    if (result.error) return { stdout: '', error: result.error.message };
    if (result.status !== 0) return { stdout: result.stdout.trim(), error: result.stderr.trim() || `exit ${result.status}` };
    return { stdout: result.stdout.trim(), error: null };
  } catch (error) {
    return { stdout: '', error: error.message };
  }
}

function safeStat(filePath) {
  try {
    return fs.statSync(filePath);
  } catch {
    return null;
  }
}

function collectDisk() {
  try {
    const drive = fs.statfsSync('E:\\');
    const total = drive.blocks * drive.bsize;
    const free = drive.bavail * drive.bsize;
    return {
      status: 'ok',
      free_gb: Math.round((free / 1024 ** 3) * 10) / 10,
      total_gb: Math.round((total / 1024 ** 3) * 10) / 10,
      source: 'fs.statfsSync',
    };
  } catch (error) {
    return { status: 'failed', error: error.message };
  }
}

function collectGateway() {
  const output = commandOutput(POWERSHELL, [
    '-NoProfile',
    '-Command',
    'Get-Process node -ErrorAction SilentlyContinue | Measure-Object | Select-Object -ExpandProperty Count',
  ]);
  if (output.error) return { status: 'failed', process_count: 'unknown', error: output.error };
  return { status: 'ok', process_count: output.stdout || '0' };
}

function collectSessions() {
  const sessionDir = path.join(OPENCLAW_ROOT, 'agents', 'main', 'sessions');
  if (!fs.existsSync(sessionDir)) return { status: 'failed', today_count: 0, error: 'session directory not found' };

  const today = new Date().toDateString();
  let count = 0;
  for (const name of fs.readdirSync(sessionDir)) {
    if (!name.endsWith('.jsonl')) continue;
    if (name.includes('deleted') || name.includes('checkpoint')) continue;
    const stat = safeStat(path.join(sessionDir, name));
    if (stat && stat.mtime.toDateString() === today) count += 1;
  }
  return { status: 'ok', today_count: count };
}

function collectDiaries() {
  const memoryDir = path.join(OPENCLAW_ROOT, 'workspace', 'memory');
  if (!fs.existsSync(memoryDir)) return { status: 'failed', count: 0, error: 'memory directory not found' };
  const count = fs.readdirSync(memoryDir).filter((name) => /^2026-.*\.md$/i.test(name)).length;
  return { status: 'ok', count };
}

function collectModels() {
  const configPath = path.join(OPENCLAW_ROOT, 'openclaw.json');
  if (!fs.existsSync(configPath)) return { status: 'failed', count: 0, error: 'openclaw.json not found' };
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const models = Object.keys(config.agents?.defaults?.models ?? {});
    const staged = models.filter((model) => model.toLowerCase().includes('openai') || model.toLowerCase().includes('volcengine'));
    return {
      status: 'ok',
      count: models.length,
      staged_count: staged.length,
      public_label: `${staged.length} staged provider models`,
    };
  } catch (error) {
    return { status: 'failed', count: 0, error: error.message };
  }
}

function collectBackups() {
  const backupDir = path.join(OPENCLAW_ROOT, 'data', '06-backup');
  if (!fs.existsSync(backupDir)) return { status: 'failed', latest: 'none', error: 'backup directory not found' };
  const backups = fs.readdirSync(backupDir).filter((name) => /^2026/.test(name)).sort().reverse();
  return { status: 'ok', latest: backups[0] ?? 'none' };
}

function collectWechat() {
  try {
    const result = childProcess.spawnSync('python', ['-m', 'wechat_cli.main', 'sessions', '--limit', '100'], {
      encoding: 'utf8', timeout: 10000, windowsHide: true,
    });
    if (result.error || result.status !== 0) return { status: 'degraded', total: 0, groups: 0, error: 'wechat-cli failed' };
    const data = JSON.parse(result.stdout);
    const groups = data.filter((s) => s.is_group).length;
    return { status: 'ok', total: data.length, groups };
  } catch (error) {
    return { status: 'failed', total: 0, groups: 0, error: error.message };
  }
}

function collectTodayTask() {
  const configPath = path.join(OPENCLAW_ROOT, 'openclaw.json');
  if (!fs.existsSync(configPath)) return { status: 'failed', active: false, error: 'config not found' };
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const hasAuth = !!config.skills?.entries?.['today-task']?.config?.authCode;
    return { status: hasAuth ? 'ok' : 'degraded', active: hasAuth };
  } catch (error) {
    return { status: 'failed', active: false, error: error.message };
  }
}

function collectWebChat() {
  const sessionFile = path.join(OPENCLAW_ROOT, 'agents', 'main', 'sessions', '393caa38-89d4-4fe4-a3f9-fe7e76a32bfe.jsonl');
  if (!fs.existsSync(sessionFile)) return { status: 'degraded', today_msgs: 0, error: 'session file not found' };
  try {
    const today = new Date().toISOString().split('T')[0];
    const content = fs.readFileSync(sessionFile, 'utf8');
    let count = 0;
    for (const line of content.split('\n')) {
      try {
        const obj = JSON.parse(line);
        if (obj.type === 'message' && obj.message?.role === 'user') {
          const ts = new Date(obj.timestamp);
          const tsLocal = new Date(ts.getTime() + 8 * 3600000);
          if (tsLocal.toISOString().split('T')[0] === today) count++;
        }
      } catch {}
    }
    return { status: 'ok', today_msgs: count };
  } catch (error) {
    return { status: 'failed', today_msgs: 0, error: error.message };
  }
}

function buildSnapshot() {
  const resources = {
    disk: collectDisk(),
    gateway: collectGateway(),
    sessions: collectSessions(),
    diaries: collectDiaries(),
    models: collectModels(),
    backups: collectBackups(),
    wechat: collectWechat(),
    todaytask: collectTodayTask(),
    webchat: collectWebChat(),
  };
  const failedCollectors = Object.entries(resources)
    .filter(([, value]) => value.status !== 'ok')
    .map(([name]) => name);

  return {
    schema_version: 1,
    collected_at: new Date().toISOString(),
    platform: {
      host: os.hostname(),
      node: process.version,
    },
    site: {
      owner: 'Adgai',
      tagline: 'Personal AI systems, resource orchestration, and knowledge automation.',
      current_focus: [
        'AI resource orchestration',
        'local-first personal knowledge systems',
        'automation that turns private work into public artifacts',
      ],
    },
    health: {
      status: failedCollectors.length ? 'degraded' : 'ok',
      failed_collectors: failedCollectors,
    },
    resources,
    public_metrics: {
      project_count: 3,
      public_note_count: 0,
      resource_console_status: 'local-only',
    },
    featured_projects: [
      {
        slug: 'openclaw-resource-console',
        name: 'OpenClaw Resource Console',
        summary: 'A local-first operations surface for AI models, tools, tasks, and knowledge output.',
        status: 'private alpha',
        public_url: '/projects/resource-console.html',
      },
      {
        slug: 'intelhub',
        name: 'IntelHub',
        summary: 'A structured intelligence collection workflow for recurring sources and briefings.',
        status: 'active',
        public_url: '/projects/intelhub.html',
      },
      {
        slug: 'knowledge-automation',
        name: 'Knowledge Automation',
        summary: 'A publishing pipeline that promotes reviewed private notes into public artifacts.',
        status: 'building',
        public_url: '/projects/knowledge-automation.html',
      },
    ],
    public_notes: [],
  };
}

function writeSnapshot(snapshot) {
  fs.mkdirSync(path.dirname(SNAPSHOT_PATH), { recursive: true });
  fs.writeFileSync(SNAPSHOT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  return SNAPSHOT_PATH;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function getPrivateLanguage(request) {
  const url = new URL(request.url || '/', `http://${HOST}:${PORT}`);
  const requested = url.searchParams.get('lang');
  return PRIVATE_LANGUAGES.includes(requested) ? requested : DEFAULT_PRIVATE_LANGUAGE;
}

function statusText(status, language) {
  return PRIVATE_COPY[language].statuses[status] || PRIVATE_COPY[language].statuses.unknown;
}

function statusChip(status, language) {
  const cls = status === 'ok' ? 'ok' : 'warn';
  return `<span class="chip ${cls}">${escapeHtml(statusText(status, language))}</span>`;
}

function formatDetailValue(key, value) {
  if (key.endsWith('_gb') && typeof value === 'number') return `${value} GB`;
  return value;
}

function renderResourceDetails(value, language) {
  const labels = PRIVATE_COPY[language].detailLabels;
  return Object.entries(value)
    .filter(([key]) => key !== 'status' && key !== 'source')
    .map(([key, val]) => `${escapeHtml(labels[key] || key)}: ${escapeHtml(formatDetailValue(key, val))}`)
    .join(', ');
}

function renderCollectorCard(name, value, language) {
  const copy = PRIVATE_COPY[language];
  const label = copy.resources[name] || name;
  const entries = Object.entries(value).filter(([k]) => k !== 'status' && k !== 'source');
  const mainMetric = entries[0]
    ? `<b>${escapeHtml(formatDetailValue(entries[0][0], entries[0][1]))}</b>`
    : '<b>-</b>';
  const mainLabel = entries[0]
    ? escapeHtml(copy.detailLabels[entries[0][0]] || entries[0][0])
    : '';
  const subDetails = entries.slice(1).map(([k, v]) =>
    `<span>${escapeHtml(copy.detailLabels[k] || k)}: ${escapeHtml(formatDetailValue(k, v))}</span>`
  ).join(' ');
  return `<div class="card">
    <div class="card-head"><span>${escapeHtml(label)}</span>${statusChip(value.status ?? 'unknown', language)}</div>
    <div class="card-metric">${mainMetric}</div>
    <div class="card-label">${mainLabel}</div>
    <div class="card-details">${subDetails || 'no detail'}</div>
  </div>`;
}

function languageSwitch(language) {
  const zhClass = language === 'zh-CN' ? 'active' : '';
  const enClass = language === 'en' ? 'active' : '';
  return `<div class="language-switch" aria-label="Language">
    <a class="${zhClass}" href="/?lang=zh-CN">${escapeHtml(PRIVATE_COPY[language].languageChinese)}</a>
    <a class="${enClass}" href="/?lang=en">${escapeHtml(PRIVATE_COPY[language].languageEnglish)}</a>
  </div>`;
}

function renderConsole(snapshot, language = DEFAULT_PRIVATE_LANGUAGE) {
  const copy = PRIVATE_COPY[language];
  const cards = Object.entries(snapshot.resources)
    .map(([name, value]) => renderCollectorCard(name, value, language))
    .join('');

  const gatewayCount = snapshot.resources.gateway.process_count ?? 'unknown';
  const sessionCount = snapshot.resources.sessions.today_count ?? 0;
  const failed = snapshot.health.failed_collectors.length
    ? snapshot.health.failed_collectors.map((name) => copy.resources[name] || name).join(', ')
    : copy.noFailedCollectors;
  const activeModel = snapshot.resources.models.public_label ?? 'unknown';

  return `<!doctype html>
<html lang="${escapeHtml(language)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="60">
  <title>${escapeHtml(copy.title)}</title>
  <style>
    :root { color-scheme: dark; --bg: #101114; --panel: #181b20; --line: #2b3038; --text: #e7e9ed; --muted: #9299a6; --accent: #69b7a6; --warn: #d6a94f; }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--text); font: 14px/1.5 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background-image: linear-gradient(rgba(43,48,56,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(43,48,56,0.08) 1px, transparent 1px); background-size: 48px 48px; }
    main { max-width: 1200px; margin: 0 auto; padding: 20px 24px; }
    header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; border-bottom: 1px solid var(--line); padding-bottom: 14px; margin-bottom: 16px; }
    h1 { margin: 0; font-size: 22px; }
    .subtitle, .muted { color: var(--muted); font-size: 12px; }
    .header-meta { display: flex; align-items: flex-start; gap: 14px; }
    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px; }
    .stat { border: 1px solid var(--line); border-radius: 6px; padding: 10px 12px; }
    .stat span { font-size: 11px; color: var(--muted); }
    .stat b { display: block; font-size: 18px; margin-top: 2px; }
    .actions { display: flex; gap: 10px; align-items: center; margin-bottom: 14px; flex-wrap: wrap; }
    .btn-kill { background: #c0392b; color: #fff; border: none; border-radius: 6px; padding: 8px 16px; font-size: 13px; font-weight: 700; cursor: pointer; }
    .btn-kill:hover { background: #e74c3c; }
    .btn-switch { background: var(--panel); color: var(--accent); border: 1px solid var(--accent); border-radius: 6px; padding: 6px 12px; font-size: 12px; font-weight: 600; cursor: pointer; }
    .btn-switch:hover { background: var(--accent); color: #0b1210; }
    .model-tag { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 6px 12px; font-size: 12px; color: var(--accent); }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; margin-bottom: 12px; }
    .card { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 14px; }
    .card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 12px; color: var(--muted); }
    .card-metric { font-family: 'Cascadia Code','Fira Code','JetBrains Mono','Consolas',monospace; font-size: 28px; font-weight: 700; }
    .card-label { font-size: 11px; color: var(--muted); margin-bottom: 6px; }
    .card-details { font-size: 11px; color: var(--muted); }
    .card-details span { display: inline-block; margin-right: 10px; }
    .chip { display: inline-block; border-radius: 999px; padding: 1px 6px; font-size: 11px; }
    .chip.ok { background: #173b31; color: #7ee0c8; box-shadow: 0 0 8px rgba(126,224,200,0.15); }
    .chip.warn { background: #453716; color: #f0ca70; box-shadow: 0 0 8px rgba(240,202,112,0.15); }
    .panel { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 14px; margin-bottom: 12px; }
    .panel p { margin: 4px 0; font-size: 12px; }
    .local { color: var(--accent); font-weight: 600; }
    .language-switch { display: inline-flex; gap: 2px; border: 1px solid var(--line); border-radius: 8px; padding: 2px; }
    .language-switch a { min-width: 34px; min-height: 28px; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px; color: var(--muted); text-decoration: none; font-weight: 700; font-size: 13px; }
    .language-switch a.active { background: var(--accent); color: #0b1210; }
    @media (max-width: 720px) { .stats { grid-template-columns: repeat(2, 1fr); } .grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); } }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>${escapeHtml(copy.title)}</h1>
        <div class="subtitle">${escapeHtml(copy.updated)} ${escapeHtml(snapshot.collected_at)}</div>
      </div>
      <div class="header-meta">${languageSwitch(language)}</div>
    </header>
    <section class="actions">
      <button class="btn-kill" onclick="confirm('确定停止所有服务？')&&fetch('/kill',{method:'POST'}).then(r=>r.json()).then(d=>{document.body.innerHTML='<main style=text-align:center;padding:80px><h2>已停止</h2><p>关闭标签页</p></main>'})">⏹ 紧急停止</button>
      <span class="model-tag">🧠 ${escapeHtml(activeModel)}</span>
      <button class="btn-switch" title="切换 Flash" onclick="switchModel('deepseek/deepseek-v4-flash')">⇄ Flash</button>
      <button class="btn-switch" title="切换 Pro" onclick="switchModel('deepseek/deepseek-v4-pro')">⇄ Pro</button>
      <span style="color:var(--accent);font-size:12px;margin-left:8px">🔒 本地私有</span>
    </section>
    <section class="stats">
      <div class="stat"><span>${escapeHtml(copy.health)}</span><b>${statusChip(snapshot.health.status, language)}</b></div>
      <div class="stat"><span>${escapeHtml(copy.gatewayProcesses)}</span><b>${escapeHtml(gatewayCount)}</b></div>
      <div class="stat"><span>${escapeHtml(copy.todaySessions)}</span><b>${escapeHtml(sessionCount)}</b></div>
      <div class="stat"><span>${escapeHtml(copy.privateMode)}</span><b class="local">127.0.0.1</b></div>
    </section>
    <section class="grid">${cards}</section>
    <section class="panel">
      <p>${escapeHtml(copy.failedCollectors)}: ${escapeHtml(failed)}</p>
    </section>
    <script>function switchModel(m){if(confirm('切换模型为 '+m+'？')){fetch('/switch-model?target='+encodeURIComponent(m),{method:'POST'}).then(r=>r.json()).then(d=>{alert(d.ok?'已切换为 '+d.model:'失败: '+(d.error||''));if(d.ok)location.reload()})}}</script>
  </main>
  </main>
</body>
</html>`;
}

function sendResponse(response, status, body, contentType = 'text/html; charset=utf-8') {
  response.writeHead(status, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
    'Content-Security-Policy':
      "default-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'unsafe-inline'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(body);
}

function runOnce() {
  const snapshot = buildSnapshot();
  const output = writeSnapshot(snapshot);
  console.log(`Private snapshot written: ${output}`);
}

if (process.argv.includes('--once')) {
  runOnce();
} else {
  runOnce();
  const server = http.createServer((request, response) => {
    // Kill Switch endpoint
    if (request.method === 'POST' && request.url === '/kill') {
      try {
        childProcess.execSync(
          `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter 'Name=''node.exe''' | Where-Object { $_.CommandLine -like '*adgai-site*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"`,
          { timeout: 8000, windowsHide: true }
        );
        sendResponse(response, 200, JSON.stringify({ ok: true, message: 'stopped' }), 'application/json');
      } catch (error) {
        sendResponse(response, 500, JSON.stringify({ ok: false, error: error.message }), 'application/json');
      }
      return;
    }
    // /switch-model?target=model_name
    if (request.method === 'POST' && request.url?.startsWith('/switch-model')) {
      try {
        const url = new URL(request.url, `http://${HOST}:${PORT}`);
        const target = url.searchParams.get('target');
        if (!target) { sendResponse(response, 400, JSON.stringify({ ok: false, error: 'missing target' }), 'application/json'); return; }
        childProcess.execSync(`openclaw config set agents.defaults.model.primary "${target}"`, { timeout: 10000, windowsHide: true });
        sendResponse(response, 200, JSON.stringify({ ok: true, model: target }), 'application/json');
      } catch (error) {
        sendResponse(response, 500, JSON.stringify({ ok: false, error: error.message }), 'application/json');
      }
      return;
    }
    // Default: render dashboard
    const snapshot = buildSnapshot();
    writeSnapshot(snapshot);
    sendResponse(response, 200, renderConsole(snapshot, getPrivateLanguage(request)));
  });
  server.listen(PORT, HOST, () => {
    console.log(`Private console: http://${HOST}:${PORT}`);
    console.log(`Private snapshot: ${SNAPSHOT_PATH}`);
  });
}
