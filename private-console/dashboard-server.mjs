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
const SERVER_FILE = fileURLToPath(import.meta.url);
const SNAPSHOT_PATH = path.join(ROOT, 'private-console', 'snapshots', 'private_snapshot.json');
const SNAPSHOT_REFRESH_INTERVAL_MS = 15_000;
const OPENCLAW_ROOT = 'E:\\Dev\\.openclaw';
const OPENCLAW_GATEWAY_PORT = 18789;
const OPENCLAW_TASK_NAME = 'OpenClaw Gateway';
const OPENCLAW_WORKSPACE = path.join(OPENCLAW_ROOT, 'workspace');
const CHAT_COLLECT_DATA_ROOT = path.join(OPENCLAW_WORKSPACE, 'data', '03-knowledge', 'chat-collect');
const POWERSHELL = process.env.SystemRoot
  ? path.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
  : 'powershell.exe';
const PRIVATE_LANGUAGES = ['zh-CN', 'en'];
const DEFAULT_PRIVATE_LANGUAGE = 'zh-CN';
const PRIVATE_VIEWS = ['overview', 'knowledge', 'collector', 'reports', 'models', 'services', 'assets'];
const DEFAULT_PRIVATE_VIEW = 'overview';
const FORCE_REFRESH_RATE_LIMIT_MS = 10_000;
const ALLOWED_HOSTS = new Set([`127.0.0.1:${PORT}`, `localhost:${PORT}`, `[::1]:${PORT}`]);
let lastForceRefreshAt = 0;

let snapshotCache = null;
const snapshotRefresh = {
  running: false,
  started_at: null,
  ended_at: null,
  last_duration_ms: null,
  error: '',
};

const PRIVATE_COPY = {
  'zh-CN': {
    title: 'Adgai 私有资源后台',
    subtitle: '仅本地访问的运行视图。公开站只能消费脱敏导出。',
    updated: '更新于',
    health: '健康状态',
    gatewayProcesses: 'Gateway 进程',
    todaySessions: '今日会话',
    privateMode: '私有模式',
    collectors: '知识产物',
    collector: '知识产物',
    status: '状态',
    details: '详情',
    releaseBoundary: '发布边界',
    boundaryNote: '仅在审阅私有快照后运行导出器。公开导出基于字段白名单。',
    currentModel: '默认模型',
    drilldown: '查看明细',
    processDetails: '进程明细',
    pid: 'PID',
    processName: '进程',
    command: '命令',
    started: '启动时间',
    memory: '内存',
    time: '时间',
    unread: '未读',
    diskUsed: '已用',
    trend7d: '近 7 日',
    tokenBreakdown: '模型拆解',
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
      webchat: 'WebChat',
      costs: 'Token',
      agent: 'Agent',
    },
    detailLabels: {
      free_gb: '空闲',
      total_gb: '总量',
      process_count: '进程数',
      today_count: '今日数量',
      count: '数量',
      available_count: '可用模型',
      default_model: '默认模型',
      fallbacks_count: '备用模型',
      staged_count: '待激活',
      public_label: '公开标签',
      latest: '最新',
      error: '错误',
      total: '会话数',
      groups: '群聊数',
      today_msgs: '今日消息',
      active: '已配置',
      total_tokens: '消耗',
      cost_today: '费用',
      cache_rate: '缓存',
      top_model: '主力',
      by_model: '模型',
      tool_calls: '工具调用',
      tasks: '任务',
      active: '活跃',
      last_action: '最后活动',
      cost_usd: '费用',
      unread: '未读',
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
    collectors: 'Knowledge artifacts',
    collector: 'Knowledge artifacts',
    status: 'Status',
    details: 'Details',
    releaseBoundary: 'Release Boundary',
    boundaryNote: 'Run exporter only after reviewing this private snapshot. Public exports are allowlist based.',
    currentModel: 'Default model',
    drilldown: 'Details',
    processDetails: 'Process details',
    pid: 'PID',
    processName: 'Process',
    command: 'Command',
    started: 'Started',
    memory: 'Memory',
    time: 'Time',
    unread: 'Unread',
    diskUsed: 'used',
    trend7d: '7 days',
    tokenBreakdown: 'Model split',
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
      webchat: 'WebChat',
      costs: 'Tokens',
      agent: 'Agent',
    },
    detailLabels: {
      free_gb: 'free',
      total_gb: 'total',
      process_count: 'processes',
      today_count: 'today',
      count: 'count',
      available_count: 'available',
      default_model: 'default',
      fallbacks_count: 'fallbacks',
      staged_count: 'staged',
      public_label: 'public label',
      latest: 'latest',
      error: 'error',
      total: 'total',
      groups: 'groups',
      today_msgs: 'today msgs',
      active: 'active',
      total_tokens: 'tokens',
      cost_today: 'cost',
      cache_rate: 'cache%',
      top_model: 'top',
      by_model: 'by model',
      total_tokens: 'tokens',
      cost_today: 'cost',
      cache_rate: 'cache%',
      top_model: 'top',
      tool_calls: 'calls',
      tasks: 'tasks',
      active: 'active',
      last_action: 'last',
      cost_usd: 'cost',
      unread: 'unread',
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

function parseJsonArrayOutput(stdout) {
  if (!stdout) return [];
  const parsed = JSON.parse(stdout);
  return normalizeJsonArray(parsed).filter(Boolean);
}

function safeStat(filePath) {
  try {
    return fs.statSync(filePath);
  } catch {
    return null;
  }
}

function normalizeJsonArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function formatLocalDateTime(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '-';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function truncateText(value, maxLength = 120) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

function sanitizeCommandLine(command) {
  return truncateText(String(command ?? 'unknown')
    .replace(/((?:api[_-]?key|secret|password|token)\s*[=:]\s*)("[^"]+"|'[^']+'|\S+)/gi, '$1***'), 180);
}

function psSingleQuoted(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < String(line).length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

function parseMemoryKb(value) {
  const digits = String(value || '').replace(/[^\d]/g, '');
  return digits ? Number(digits) : null;
}

function getListenerPidFromNetstat(port) {
  const output = commandOutput('netstat.exe', ['-ano', '-p', 'tcp'], 3000);
  if (output.error) return { pid: null, error: output.error };
  const lines = String(output.stdout || '').split(/\r?\n/);
  for (const line of lines) {
    if (!line.includes(`:${port}`) || !/\bLISTENING\b/i.test(line)) continue;
    const parts = line.trim().split(/\s+/);
    const pid = Number(parts.at(-1));
    if (Number.isFinite(pid)) return { pid, error: null };
  }
  return { pid: null, error: null };
}

function getTasklistProcess(pid) {
  if (!pid) return null;
  const output = commandOutput('tasklist.exe', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], 3000);
  if (output.error) return null;
  const line = String(output.stdout || '').split(/\r?\n/).find((row) => row.trim().startsWith('"'));
  if (!line) return null;
  const [name, processId, , , memory] = parseCsvLine(line);
  return {
    pid: Number(processId) || pid,
    name: name || 'process',
    memory_mb: parseMemoryKb(memory) !== null ? Math.round((parseMemoryKb(memory) / 1024) * 10) / 10 : null,
  };
}

function getWmicProcess(pid) {
  if (!pid) return {};
  const output = commandOutput(
    'wmic.exe',
    ['process', 'where', `processid=${pid}`, 'get', 'CommandLine,ParentProcessId', '/format:list'],
    3000,
  );
  if (output.error) return {};
  const result = {};
  for (const line of String(output.stdout || '').split(/\r?\n/)) {
    const [key, ...rest] = line.split('=');
    if (!key || !rest.length) continue;
    const value = rest.join('=').trim();
    if (/^CommandLine$/i.test(key)) result.command = value;
    if (/^ParentProcessId$/i.test(key)) result.parent_pid = Number(value) || null;
  }
  return result;
}

function verifiedProcessDetail(pid, fallback = {}) {
  const task = getTasklistProcess(pid) ?? {};
  const wmic = getWmicProcess(pid);
  return {
    pid,
    name: task.name || fallback.name || 'process',
    started: fallback.started || '-',
    cpu: '-',
    memory_mb: task.memory_mb ?? fallback.memory_mb ?? '-',
    command: sanitizeCommandLine(wmic.command || fallback.command || `OpenClaw Gateway listener :${OPENCLAW_GATEWAY_PORT}`),
    parent_pid: wmic.parent_pid ?? fallback.parent_pid ?? null,
  };
}

function getGatewayRuntimeState() {
  const listener = getListenerPidFromNetstat(OPENCLAW_GATEWAY_PORT);
  if (listener.error) return { listening: false, port: OPENCLAW_GATEWAY_PORT, error: listener.error };
  if (!listener.pid) {
    return {
      listening: false,
      port: OPENCLAW_GATEWAY_PORT,
      pid: null,
      name: null,
      started: null,
      memory_mb: null,
    };
  }
  const task = getTasklistProcess(listener.pid);
  return {
    listening: true,
    port: OPENCLAW_GATEWAY_PORT,
    pid: listener.pid,
    name: task?.name || null,
    started: null,
    memory_mb: task?.memory_mb ?? null,
  };
}

function getGatewayHealthSnapshot() {
  const output = commandOutput(
    'curl.exe',
    ['-sS', '-m', '2', '-w', '\n%{http_code}', `http://127.0.0.1:${OPENCLAW_GATEWAY_PORT}/health`],
    3000,
  );
  const text = String(output.stdout || '').trim();
  const lines = text.split(/\r?\n/);
  const statusLine = lines.pop();
  const httpStatus = Number(statusLine) || 0;
  const body = lines.join('\n');
  if (output.error) return { ok: false, http_status: httpStatus, body, error: output.error };
  return {
    ok: httpStatus >= 200 && httpStatus < 300,
    http_status: httpStatus,
    body: truncateText(body, 300),
    error: httpStatus >= 200 && httpStatus < 300 ? '' : body || `HTTP ${httpStatus || 0}`,
  };
}

function getOpenClawTaskState() {
  const script = `
$output = schtasks /query /tn ${psSingleQuoted(OPENCLAW_TASK_NAME)} /fo list /v 2>&1
$exit = $LASTEXITCODE
$text = ($output -join [Environment]::NewLine)
$status = $null
$lastResult = $null
$taskToRun = $null
foreach ($line in ($text -split "\\r?\\n")) {
  if ($line -match '^Status:\\s*(.+)$') { $status = $Matches[1].Trim() }
  if ($line -match '^Last Result:\\s*(.+)$') { $lastResult = $Matches[1].Trim() }
  if ($line -match '^Task To Run:\\s*(.+)$') { $taskToRun = $Matches[1].Trim() }
}
[pscustomobject]@{
  ok = ($exit -eq 0)
  exit = $exit
  status = $status
  last_result = $lastResult
  task_to_run = $taskToRun
  raw = $text
} | ConvertTo-Json -Compress
`;
  const output = commandOutput(POWERSHELL, ['-NoProfile', '-Command', script], 8000);
  if (output.error) return { ok: false, error: output.error, status: 'unknown' };
  try {
    return JSON.parse(output.stdout);
  } catch (error) {
    return { ok: false, error: error.message, status: 'unknown' };
  }
}

function isTaskRunning(taskState) {
  const status = String(taskState?.status || '').toLowerCase();
  return /running|正在运行/.test(status);
}

function deriveOpenClawState(runtimeState, healthState) {
  if (runtimeState.error) return 'unknown';
  if (!runtimeState.listening) return 'stopped';
  const processName = String(runtimeState.name || '').toLowerCase();
  if (processName && !/node|openclaw/.test(processName)) return 'port_occupied';
  if (healthState.ok) return 'running';
  const error = `${healthState.error || ''} ${healthState.body || ''}`.toLowerCase();
  if (/timed out|timeout|operation has timed out|超时/.test(error)) return 'stalled';
  if (healthState.http_status > 0) return 'unhealthy';
  return 'stalled';
}

function dayKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function createDayBuckets(days = 7) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));

  const buckets = [];
  const index = new Map();
  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + offset);
    const bucket = {
      key: dayKey(date),
      label: `${date.getMonth() + 1}/${date.getDate()}`,
      value: 0,
    };
    buckets.push(bucket);
    index.set(bucket.key, bucket);
  }
  return { start, buckets, index };
}

function addBucketValue(index, date, value = 1) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return;
  const bucket = index.get(dayKey(date));
  if (bucket) bucket.value += value;
}

function trendValues(buckets) {
  return buckets.map((bucket) => ({
    label: bucket.label,
    value: Math.round(bucket.value * 10) / 10,
  }));
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
  const runtimeState = getGatewayRuntimeState();
  const taskState = getOpenClawTaskState();
  const healthState = runtimeState.listening
    ? getGatewayHealthSnapshot()
    : { ok: false, http_status: 0, body: '', error: 'gateway port is not listening' };
  const runtime = deriveOpenClawState(runtimeState, healthState);
  const processes = runtimeState.listening && runtimeState.pid
    ? [verifiedProcessDetail(runtimeState.pid, {
      name: runtimeState.name || 'node',
      started: runtimeState.started || '-',
      memory_mb: runtimeState.memory_mb ?? '-',
      command: `OpenClaw Gateway listener :${OPENCLAW_GATEWAY_PORT}`,
    })]
    : [];
  return {
    status: runtime === 'running' ? 'ok' : 'degraded',
    runtime_state: runtime,
    process_count: processes.length,
    port: OPENCLAW_GATEWAY_PORT,
    listener_pid: runtimeState.pid,
    listener: runtimeState.listening ? 'listening' : 'stopped',
    health_ok: Boolean(healthState.ok),
    health_status: runtime,
    health_http_status: healthState.http_status ?? 0,
    health_error: healthState.error || runtimeState.error || '',
    task_status: taskState.status || 'unknown',
    task_last_result: taskState.last_result || '-',
    task_managed: isTaskRunning(taskState) || (!runtimeState.listening && taskState.ok),
    processes,
  };
}

function collectSessions() {
  const sessionDir = path.join(OPENCLAW_ROOT, 'agents', 'main', 'sessions');
  if (!fs.existsSync(sessionDir)) return { status: 'failed', today_count: 0, error: 'session directory not found' };

  const today = new Date().toDateString();
  const { start, buckets, index } = createDayBuckets(7);
  let count = 0;
  for (const name of fs.readdirSync(sessionDir)) {
    if (!name.endsWith('.jsonl')) continue;
    if (name.includes('deleted') || name.includes('checkpoint')) continue;
    const stat = safeStat(path.join(sessionDir, name));
    if (!stat) continue;
    if (stat.mtime.toDateString() === today) count += 1;
    if (stat.mtime >= start) addBucketValue(index, stat.mtime, 1);
  }
  return { status: 'ok', today_count: count, trend_7d: trendValues(buckets) };
}

function collectDiaries() {
  const memoryDir = path.join(OPENCLAW_ROOT, 'workspace', 'memory');
  if (!fs.existsSync(memoryDir)) return { status: 'failed', count: 0, error: 'memory directory not found' };
  const files = fs.readdirSync(memoryDir)
    .filter((name) => /^2026-.*\.md$/i.test(name))
    .map((name) => {
      const filePath = path.join(memoryDir, name);
      const stat = safeStat(filePath);
      return {
        name,
        updated: stat ? formatLocalDateTime(stat.mtime) : '-',
        size_kb: stat ? Math.round((stat.size / 1024) * 10) / 10 : 0,
        mtime: stat?.mtime?.getTime() ?? 0,
      };
    })
    .sort((a, b) => b.mtime - a.mtime);
  const items = files.slice(0, 8).map(({ mtime, ...item }) => item);
  return { status: 'ok', count: files.length, latest: items[0]?.name ?? '-', items };
}

function collectModels(costsDetail) {
  const configPath = path.join(OPENCLAW_ROOT, 'openclaw.json');
  if (!fs.existsSync(configPath)) return { status: 'failed', count: 0, error: 'openclaw.json not found' };
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const providerModels = config.models?.providers ?? {};
    const allModels = [];
    for (const [providerKey, provider] of Object.entries(providerModels)) {
      for (const m of (provider.models || [])) {
        allModels.push(`${providerKey}/${m.id}`);
      }
    }
    const defaultModel = config.agents?.defaults?.model?.primary ?? '-';
    const fallbacks = config.agents?.defaults?.model?.fallbacks ?? [];
    const fallbackSet = new Set(fallbacks);
    const costMap = {};
    if (Array.isArray(costsDetail)) {
      for (const d of costsDetail) {
        costMap[d.model] = d;
        if (d.short_name) costMap[d.short_name] = d;
      }
    }
    // 收集所有出现过的模型（config + 实际使用），去重
    const allModelSet = new Set(allModels);
    if (Array.isArray(costsDetail)) {
      for (const d of costsDetail) {
        // 尝试匹配：全名、短名
        const shortName = d.short_name || d.model.split('/').pop();
        const alreadyExists = allModelSet.has(d.model) || allModelSet.has(shortName);
        if (!alreadyExists) {
          allModels.push(d.model);
          allModelSet.add(d.model);
        }
      }
    }
    const seenShort = new Set();
    const modelRows = allModels.map((model) => {
      const cost = costMap[model] || costMap[model.split('/').pop()] || {};
      const shortName = model.split('/').pop();
      if (seenShort.has(shortName)) return null;
      seenShort.add(shortName);
      let role = '';
      if (model === defaultModel) role = 'default';
      else if (fallbackSet.has(model)) role = 'fallback';
      return {
        model, short_name: shortName, role,
        is_default: model === defaultModel,
        tokens: cost.tokens || 0, cost: cost.cost || 0,
        cache_rate: cost.cache_rate ?? null, requests: cost.requests || 0,
      };
    }).filter(Boolean).sort((a, b) => {
      if (a.is_default !== b.is_default) return a.is_default ? -1 : 1;
      return b.tokens - a.tokens;
    });
    // 找出最大 token 用于进度条
    const maxTokens = Math.max(...modelRows.map(r => r.tokens), 1);
    return {
      status: 'ok', default_model: defaultModel,
      available_count: modelRows.length, fallbacks_count: fallbacks.length,
      models: allModels.sort(), fallbacks, model_rows: modelRows,
    };
  } catch (error) {
    return { status: 'failed', count: 0, error: error.message };
  }
}

function collectBackups() {
  const backupDir = path.join(OPENCLAW_ROOT, 'data', '06-backup');
  if (!fs.existsSync(backupDir)) return { status: 'failed', latest: 'none', error: 'backup directory not found' };
  const backups = fs.readdirSync(backupDir)
    .filter((name) => /^2026/.test(name))
    .map((name) => {
      const entryPath = path.join(backupDir, name);
      const stat = safeStat(entryPath);
      return {
        name,
        updated: stat ? formatLocalDateTime(stat.mtime) : '-',
        type: stat?.isDirectory() ? 'dir' : 'file',
        mtime: stat?.mtime?.getTime() ?? 0,
      };
    })
    .sort((a, b) => b.name.localeCompare(a.name));
  const items = backups.slice(0, 8).map(({ mtime, ...item }) => item);
  return { status: 'ok', latest: items[0]?.name ?? 'none', count: backups.length, items };
}

function collectWebChat() {
  const sessionFile = path.join(OPENCLAW_ROOT, 'agents', 'main', 'sessions', '393caa38-89d4-4fe4-a3f9-fe7e76a32bfe.jsonl');
  const { buckets, index } = createDayBuckets(7);
  if (!fs.existsSync(sessionFile)) return { status: 'degraded', today_msgs: 0, trend_7d: trendValues(buckets), error: 'session file not found' };
  try {
    const today = dayKey(new Date());
    const content = fs.readFileSync(sessionFile, 'utf8');
    let count = 0;
    for (const line of content.split('\n')) {
      try {
        const obj = JSON.parse(line);
        if (obj.type === 'message' && obj.message?.role === 'user') {
          const ts = new Date(obj.timestamp);
          addBucketValue(index, ts, 1);
          if (dayKey(ts) === today) count++;
        }
      } catch {}
    }
    return { status: 'ok', today_msgs: count, trend_7d: trendValues(buckets) };
  } catch (error) {
    return { status: 'failed', today_msgs: 0, trend_7d: trendValues(buckets), error: error.message };
  }
}

// MiMo Token Plan 单价（元/百万 tokens）
// 基于 Lite 套餐 ¥39/6000万 Credits 换算
const MIMO_PRICING = {
  'mimo-v2.5-pro':  1.30,   // 2 Credits/token
  'mimo-v2.5':      0.65,   // 1 Credit/token
  'mimo-v2-pro':    1.30,   // 2 Credits/token (256k)
  'mimo-v2-flash':  0.70,   // 按量 ¥0.7/M
  'mimo-v2-omni':   0.65,   // 1 Credit/token
};

function estimateModelCost(model, tokens) {
  const shortName = model.split('/').pop();
  const rate = MIMO_PRICING[shortName];
  if (!rate) return null; // 非 MiMo 模型，无法估算
  return Math.round(tokens * rate) / 1000; // tokens/k * rate/M * 1000 = 元
}

function collectCosts() {
  const sessionDir = path.join(OPENCLAW_ROOT, 'agents', 'main', 'sessions');
  const { start, buckets, index } = createDayBuckets(7);
  if (!fs.existsSync(sessionDir)) return { status: 'degraded', total_tokens: 0, cost_today: 0, cache_rate: 0, trend_7d: trendValues(buckets), error: 'no sessions' };
  try {
    const today = dayKey(new Date());
    let totalTokens = 0, totalCost = 0, cacheHits = 0, cacheTotal = 0, byModel = {};
    for (const name of fs.readdirSync(sessionDir)) {
      if (!name.endsWith('.jsonl') || name.includes('deleted') || name.includes('checkpoint')) continue;
      const fp = path.join(sessionDir, name);
      const stat = safeStat(fp);
      if (!stat) continue;
      const isTodaySession = dayKey(stat.mtime) === today;
      if (!isTodaySession && stat.mtime < start) continue;
      const content = fs.readFileSync(fp, 'utf8');
      for (const line of content.split('\n')) {
        try {
          const obj = JSON.parse(line);
          const usage = obj.message?.usage;
          if (!usage) continue;
          const usageTokens = usage.totalTokens || 0;
          const eventTime = obj.timestamp ? new Date(obj.timestamp) : stat.mtime;
          if (eventTime >= start) addBucketValue(index, eventTime, usageTokens / 1000);
          if (!isTodaySession) continue;
          totalTokens += usageTokens;
          // 优先用 API 返回的费用，没有则按 MiMo 单价估算
          const apiCost = usage.cost?.total || 0;
          totalCost += apiCost;
          if (usage.cacheRead) { cacheHits++; cacheTotal += usage.cacheRead; }
          const model = obj.message?.model || obj.message?.api || 'unknown';
          if (!byModel[model]) byModel[model] = { tokens: 0, cost: 0, estimatedCost: 0, cacheRead: 0, requests: 0 };
          byModel[model].tokens += usageTokens;
          byModel[model].cost += apiCost;
          byModel[model].cacheRead += usage.cacheRead || 0;
          byModel[model].requests += 1;
        } catch {}
      }
    }
    const topModel = Object.entries(byModel).sort((a,b) => b[1].tokens - a[1].tokens)[0];
    const byModelStr = Object.entries(byModel).slice(0, 3).map(([m,d]) => `${m.split('/').pop()}:${Math.round(d.tokens/1000)}k`).join(' ');
    // 按模型拆分详细数据（MiMo 模型费用按单价估算）
    const byModelDetail = Object.entries(byModel)
      .sort((a, b) => b[1].tokens - a[1].tokens)
      .map(([model, d]) => {
        const tokensK = Math.round(d.tokens / 1000);
        const apiCost = Math.round(d.cost * 1000) / 1000;
        const estimated = estimateModelCost(model, tokensK);
        return {
          model,
          short_name: model.split('/').pop(),
          tokens: tokensK,
          cost: apiCost > 0 ? apiCost : (estimated || 0),
          cost_estimated: apiCost === 0 && estimated !== null,
          cache_rate: d.tokens ? Math.round(d.cacheRead / d.tokens * 100) : 0,
          requests: d.requests || 0,
        };
      });
    // 重新计算总费用（含估算）
    const adjustedTotalCost = byModelDetail.reduce((sum, d) => sum + d.cost, 0);
    return {
      status: 'ok',
      total_tokens: Math.round(totalTokens / 1000),
      cost_today: Math.round(adjustedTotalCost * 1000) / 1000,
      cache_rate: totalTokens ? Math.round(cacheTotal / totalTokens * 100) : 0,
      top_model: topModel?.[0]?.split('/').pop() ?? '-',
      by_model: byModelStr || '-',
      by_model_detail: byModelDetail,
      trend_7d: trendValues(buckets),
    };
  } catch (error) {
    return { status: 'failed', total_tokens: 0, cost_today: 0, trend_7d: trendValues(buckets), error: error.message };
  }
}

function collectAgentActivity() {
  const sessionDir = path.join(OPENCLAW_ROOT, 'agents', 'main', 'sessions');
  if (!fs.existsSync(sessionDir)) return { status: 'degraded', tool_calls: 0, tasks: 0, active: false, error: 'no sessions' };
  try {
    const today = dayKey(new Date());
    let toolCalls = 0, tasks = 0, lastAction = null;
    for (const name of fs.readdirSync(sessionDir)) {
      if (!name.endsWith('.jsonl') || name.includes('deleted') || name.includes('checkpoint')) continue;
      const fp = path.join(sessionDir, name);
      const stat = safeStat(fp);
      if (!stat || dayKey(stat.mtime) !== today) continue;
      const content = fs.readFileSync(fp, 'utf8');
      for (const line of content.split('\n')) {
        try {
          const obj = JSON.parse(line);
          if (obj.type === 'message' && obj.message?.role === 'assistant') {
            const ts = new Date(obj.timestamp);
            if (dayKey(ts) !== today) continue;
            const cnt = obj.message.content || [];
            const tc = cnt.filter((c) => c.type === 'toolCall' || c.type === 'toolResult').length;
            toolCalls += tc;
            if (cnt.some((c) => c.type === 'toolCall')) {
              tasks++;
              if (!lastAction || ts > lastAction) lastAction = ts;
            }
          }
        } catch {}
      }
    }
    const minsAgo = lastAction ? Math.round((Date.now() - lastAction.getTime()) / 60000) : null;
    return {
      status: 'ok',
      tool_calls: toolCalls,
      tasks,
      active: minsAgo !== null && minsAgo < 5,
      last_action: minsAgo !== null ? `${minsAgo}m` : '-',
    };
  } catch (error) {
    return { status: 'failed', tool_calls: 0, tasks: 0, active: false, error: error.message };
  }
}

function parseKnowledgeMarkdown(body, platform) {
  if (!body) return [];
  const entries = [];
  const sections = body.split(/\n(?=### \d+\. )/);
  for (const section of sections) {
    const titleMatch = section.match(/^### \d+\. (.+)$/m);
    if (!titleMatch) continue;
    const summary = titleMatch[1].trim();
    const extract = (label) => {
      const re = new RegExp(`- \\*\\*${label}\\*\\*: (.+)`, 'm');
      const m = section.match(re);
      return m ? m[1].trim() : '';
    };
    const type = extract('类型');
    entries.push({
      summary,
      detail: extract('详情') || summary,
      type: type || extract('Type') || '知识条目',
      platform: platform || extract('Platform') || '',
      source_group: extract('来源群') || extract('Source group') || '',
      contributor: extract('参与者') || extract('Participants') || '',
      time: extract('时间') || extract('Time') || '',
      tags: type ? [type] : [],
      signals: [],
    });
  }
  return entries;
}

function readKnowledgeEntries() {
  const knowledgeDir = path.join(CHAT_COLLECT_DATA_ROOT, 'knowledge');
  try {
    if (!fs.existsSync(knowledgeDir)) return { status: 'ok', entries: [], date: null, files: 0, file: null };
    const platforms = fs.readdirSync(knowledgeDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
    const allEntries = [];
    let latestDate = null;
    let totalFiles = 0;
    let latestFile = null;
    for (const platform of platforms) {
      const platformDir = path.join(knowledgeDir, platform);
      const mdFiles = fs.readdirSync(platformDir)
        .map((name) => {
          const match = name.match(/^(\d{4}-\d{2}-\d{2})\.md$/);
          return match ? { name, date: match[1], file: path.join(platformDir, name) } : null;
        })
        .filter(Boolean)
        .sort((a, b) => b.date.localeCompare(a.date));
      totalFiles += mdFiles.length;
      const latestPlatform = mdFiles[0];
      if (latestPlatform) {
        if (!latestDate || latestPlatform.date > latestDate || (latestPlatform.date === latestDate && latestFile === null)) {
          latestDate = latestPlatform.date;
          latestFile = latestPlatform.file;
        }
        const body = fs.readFileSync(latestPlatform.file, 'utf8');
        const entries = parseKnowledgeMarkdown(body, platform);
        allEntries.push(...entries);
      }
    }
    return { status: 'ok', entries: allEntries, date: latestDate, files: totalFiles, file: latestFile };
  } catch (error) {
    return { status: 'degraded', entries: [], date: null, files: 0, file: null, error: error.message };
  }
}

function readJsonFile(filePath) {
  try {
    const stat = safeStat(filePath);
    if (!stat) return { status: 'degraded', data: null, file: filePath, error: 'file not found' };
    return {
      status: 'ok',
      data: JSON.parse(fs.readFileSync(filePath, 'utf8')),
      file: filePath,
      updated: formatLocalDateTime(stat.mtime),
      size_kb: Math.round((stat.size / 1024) * 10) / 10,
    };
  } catch (error) {
    return { status: 'degraded', data: null, file: filePath, error: error.message };
  }
}

function readLatestJson(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) return { status: 'ok', data: null, file: null, date: null, error: null };
    const files = fs.readdirSync(dirPath)
      .map((name) => {
        const match = name.match(/^(\d{4}-\d{2}-\d{2})(?:-(.+))?\.json$/);
        if (!match) return null;
        const filePath = path.join(dirPath, name);
        const stat = safeStat(filePath);
        return { name, date: match[1], file: filePath, mtime: stat?.mtime?.getTime() ?? 0 };
      })
      .filter(Boolean)
      .sort((a, b) => b.date.localeCompare(a.date) || b.mtime - a.mtime);
    const latest = files[0];
    if (!latest) return { status: 'ok', data: null, file: null, date: null, error: null };
    const parsed = readJsonFile(latest.file);
    return { ...parsed, file: latest.file, date: latest.date, files: files.length };
  } catch (error) {
    return { status: 'degraded', data: null, file: null, date: null, error: error.message };
  }
}

function readLatestReport() {
  const reportDir = path.join(CHAT_COLLECT_DATA_ROOT, 'reports');
  try {
    if (!fs.existsSync(reportDir)) return { status: 'ok', body: '', file: null, date: null, error: null };
    const files = fs.readdirSync(reportDir)
      .map((name) => {
        const match = name.match(/^daily-(\d{4}-\d{2}-\d{2})(?:-(.+))?\.md$/);
        if (!match) return null;
        const filePath = path.join(reportDir, name);
        const stat = safeStat(filePath);
        return { name, date: match[1], file: filePath, mtime: stat?.mtime?.getTime() ?? 0 };
      })
      .filter(Boolean)
      .sort((a, b) => b.date.localeCompare(a.date) || b.mtime - a.mtime);
    const latest = files[0];
    if (!latest) return { status: 'ok', body: '', file: null, date: null, error: null };
    const stat = safeStat(latest.file);
    return {
      status: 'ok',
      body: fs.readFileSync(latest.file, 'utf8'),
      file: latest.file,
      date: latest.date,
      files: files.length,
      updated: stat ? formatLocalDateTime(stat.mtime) : '-',
      size_kb: stat ? Math.round((stat.size / 1024) * 10) / 10 : 0,
    };
  } catch (error) {
    return { status: 'degraded', body: '', file: null, date: null, error: error.message };
  }
}

function collectionCount(value) {
  if (Array.isArray(value)) return value.length;
  if (!value || typeof value !== 'object') return 0;
  for (const key of ['entries', 'messages', 'items', 'records', 'data']) {
    if (Array.isArray(value[key])) return value[key].length;
  }
  if (typeof value.count === 'number') return value.count;
  return 0;
}

function readLastCollect() {
  const filePath = path.join(CHAT_COLLECT_DATA_ROOT, '.last-collect');
  try {
    const stat = safeStat(filePath);
    if (!stat) return { status: 'ok', value: '-', file: filePath, updated: '-' };
    return {
      status: 'ok',
      value: fs.readFileSync(filePath, 'utf8').trim() || '-',
      file: filePath,
      updated: formatLocalDateTime(stat.mtime),
    };
  } catch (error) {
    return { status: 'degraded', value: '-', file: filePath, error: error.message };
  }
}

function collectChatCollector() {
  const errors = [];
  const knowledgeResult = readKnowledgeEntries();
  if (knowledgeResult.status !== 'ok' && knowledgeResult.error) errors.push(`knowledge: ${knowledgeResult.error}`);

  const statsJson = readLatestJson(path.join(CHAT_COLLECT_DATA_ROOT, 'stats'));
  if (statsJson.status !== 'ok' && statsJson.error) errors.push(`stats: ${statsJson.error}`);

  const report = readLatestReport();
  if (report.status !== 'ok' && report.error) errors.push(`report: ${report.error}`);

  const lastCollect = readLastCollect();
  if (lastCollect.status !== 'ok' && lastCollect.error) errors.push(`last-collect: ${lastCollect.error}`);

  return {
    status: errors.length ? 'degraded' : 'ok',
    errors,
    root: CHAT_COLLECT_DATA_ROOT,
    last_collect: lastCollect,
    knowledge: {
      status: knowledgeResult.status,
      date: knowledgeResult.date,
      file: knowledgeResult.file,
      files: knowledgeResult.files ?? 0,
      count: knowledgeResult.entries.length,
      entries: knowledgeResult.entries,
      error: knowledgeResult.error,
    },
    stats: {
      status: statsJson.status,
      date: statsJson.date,
      file: statsJson.file,
      files: statsJson.files ?? 0,
      data: statsJson.data,
      error: statsJson.error,
    },
    report,
  };
}

function buildSnapshot() {
  const costs = collectCosts();
  const resources = {
    disk: collectDisk(),
    gateway: collectGateway(),
    sessions: collectSessions(),
    diaries: collectDiaries(),
    models: collectModels(costs.by_model_detail),
    backups: collectBackups(),
    webchat: collectWebChat(),
    costs,
    agent: collectAgentActivity(),
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
    chatCollector: collectChatCollector(),
  };
}

function writeSnapshot(snapshot) {
  fs.mkdirSync(path.dirname(SNAPSHOT_PATH), { recursive: true });
  const tmp = `${SNAPSHOT_PATH}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, SNAPSHOT_PATH);
  return SNAPSHOT_PATH;
}

function readSnapshotFromDisk() {
  try {
    if (!fs.existsSync(SNAPSHOT_PATH)) return null;
    return JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function refreshSnapshotSync(reason = 'sync') {
  const started = Date.now();
  const snapshot = buildSnapshot();
  snapshot.snapshot_meta = {
    refresh_reason: reason,
    refresh_duration_ms: Date.now() - started,
    refresh_running: false,
    refresh_error: '',
  };
  writeSnapshot(snapshot);
  snapshotCache = snapshot;
  snapshotRefresh.running = false;
  snapshotRefresh.started_at = new Date(started).toISOString();
  snapshotRefresh.ended_at = new Date().toISOString();
  snapshotRefresh.last_duration_ms = snapshot.snapshot_meta.refresh_duration_ms;
  snapshotRefresh.error = '';
  return snapshot;
}

function maybeRefreshSnapshotAsync(force = false) {
  const collectedAt = snapshotCache?.collected_at ? Date.parse(snapshotCache.collected_at) : 0;
  const stale = !collectedAt || Date.now() - collectedAt > SNAPSHOT_REFRESH_INTERVAL_MS;
  if (snapshotRefresh.running || (!force && !stale)) return;

  snapshotRefresh.running = true;
  snapshotRefresh.started_at = new Date().toISOString();
  snapshotRefresh.ended_at = null;
  snapshotRefresh.error = '';
  const started = Date.now();
  const child = childProcess.spawn(process.execPath, [SERVER_FILE, '--once'], {
    cwd: ROOT,
    windowsHide: true,
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
    stderr = stderr.slice(-2000);
  });
  child.on('error', (error) => {
    snapshotRefresh.running = false;
    snapshotRefresh.ended_at = new Date().toISOString();
    snapshotRefresh.last_duration_ms = Date.now() - started;
    snapshotRefresh.error = error.message;
  });
  child.on('close', (code) => {
    snapshotRefresh.running = false;
    snapshotRefresh.ended_at = new Date().toISOString();
    snapshotRefresh.last_duration_ms = Date.now() - started;
    if (code === 0) {
      const fresh = readSnapshotFromDisk();
      if (fresh) {
        fresh.snapshot_meta = {
          ...(fresh.snapshot_meta ?? {}),
          refresh_reason: 'background',
          refresh_duration_ms: snapshotRefresh.last_duration_ms,
          refresh_running: false,
          refresh_error: '',
        };
        snapshotCache = fresh;
      }
      snapshotRefresh.error = '';
    } else {
      snapshotRefresh.error = stderr.trim() || `snapshot refresh exited ${code}`;
    }
  });
}

function getSnapshotForRequest(force = false) {
  if (!snapshotCache) {
    snapshotCache = readSnapshotFromDisk();
  }
  if (!snapshotCache || force) {
    return refreshSnapshotSync(force ? 'manual' : 'request');
  }
  maybeRefreshSnapshotAsync(false);
  return {
    ...snapshotCache,
    snapshot_meta: {
      ...(snapshotCache.snapshot_meta ?? {}),
      refresh_running: snapshotRefresh.running,
      refresh_error: snapshotRefresh.error,
      last_refresh_duration_ms: snapshotRefresh.last_duration_ms,
    },
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function jsString(value) {
  return JSON.stringify(String(value)).replaceAll('<', '\\u003C');
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
  const cls = status === 'ok' ? 'ok' : status === 'failed' ? 'fail' : 'warn';
  return `<span class="chip ${cls}"><span class="chip-dot"></span><span>${escapeHtml(statusText(status, language))}</span></span>`;
}

const RESOURCE_ORDER = [
  'costs',
  'gateway',
  'agent',
  'disk',
  'sessions',
  'webchat',
  'models',
  'diaries',
  'backups',
];

const WIDE_RESOURCES = new Set(['costs', 'gateway', 'agent', 'disk', 'models']);
const HIDDEN_DETAIL_KEYS = new Set(['status', 'source', 'trend_7d', 'items', 'processes', 'models', 'fallbacks']);
const PRIMARY_DETAIL_KEYS = {
  disk: 'free_gb',
  gateway: 'process_count',
  sessions: 'today_count',
  diaries: 'count',
  models: 'default_model',
  backups: 'latest',
  webchat: 'today_msgs',
  costs: 'total_tokens',
  agent: 'tool_calls',
};

function localeForLanguage(language) {
  return language === 'zh-CN' ? 'zh-CN' : 'en-US';
}

function formatNumber(value, language, options = {}) {
  return new Intl.NumberFormat(localeForLanguage(language), options).format(value);
}

function formatCompactNumber(value, language) {
  return new Intl.NumberFormat(localeForLanguage(language), {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDetailValue(key, value, language = DEFAULT_PRIVATE_LANGUAGE) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'boolean') return language === 'zh-CN' ? (value ? '是' : '否') : (value ? 'yes' : 'no');
  if (Array.isArray(value)) return value.map((item) => item?.value ?? item).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  if (key.endsWith('_gb') && typeof value === 'number') return `${formatNumber(value, language, { maximumFractionDigits: 1 })} GB`;
  if ((key === 'cost_today' || key === 'cost_usd') && typeof value === 'number') return `$${formatNumber(value, language, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`;
  if (key === 'cache_rate' && typeof value === 'number') return `${formatNumber(value, language, { maximumFractionDigits: 0 })}%`;
  if (key === 'total_tokens' && typeof value === 'number') return `${formatNumber(value, language)}k`;
  if (typeof value === 'number') return formatNumber(value, language, { maximumFractionDigits: 1 });
  return value;
}

function formatMetricValue(key, value, language) {
  if (key === 'total_tokens' && typeof value === 'number') return formatCompactNumber(value * 1000, language);
  return formatDetailValue(key, value, language);
}

function displayEntries(value) {
  return Object.entries(value).filter(([key]) => !HIDDEN_DETAIL_KEYS.has(key));
}

function primaryEntryFor(name, entries) {
  const preferredKey = PRIMARY_DETAIL_KEYS[name];
  return entries.find(([key]) => key === preferredKey) ?? entries[0] ?? null;
}

function renderResourceDetails(value, language) {
  const labels = PRIVATE_COPY[language].detailLabels;
  return displayEntries(value)
    .map(([key, val]) => `${escapeHtml(labels[key] || key)}: ${escapeHtml(formatDetailValue(key, val, language))}`)
    .join(', ');
}

function renderModelBreakdown(value, language) {
  const copy = PRIVATE_COPY[language];
  const raw = String(value ?? '').trim();
  if (!raw || raw === '-') return '';
  const rows = raw.split(/\s+/).map((item) => {
    const separator = item.lastIndexOf(':');
    if (separator === -1) return null;
    return {
      model: item.slice(0, separator),
      amount: item.slice(separator + 1),
    };
  }).filter(Boolean);
  if (!rows.length) return '';
  return `<div class="model-breakdown" title="${escapeHtml(raw)}">
      <div class="breakdown-title">${escapeHtml(copy.tokenBreakdown)}</div>
      ${rows.map((row) => `<div class="model-row"><span>${escapeHtml(row.model)}</span><b>${escapeHtml(row.amount)}</b></div>`).join('')}
    </div>`;
}

function renderDetailItems(entries, language) {
  const labels = PRIVATE_COPY[language].detailLabels;
  const normalItems = entries
    .filter(([key]) => key !== 'by_model')
    .map(([key, value]) => `<span class="detail-item"><span>${escapeHtml(labels[key] || key)}</span><b>${escapeHtml(formatDetailValue(key, value, language))}</b></span>`);
  const modelEntry = entries.find(([key]) => key === 'by_model');
  const modelBreakdown = modelEntry ? renderModelBreakdown(modelEntry[1], language) : '';
  if (!normalItems.length && !modelBreakdown) return '';
  return `<div class="card-details">${normalItems.join('')}${modelBreakdown}</div>`;
}

function renderMiniTable(headers, rows) {
  if (!rows.length) return '';
  return `<div class="mini-table">
      <div class="mini-row mini-head">${headers.map((header) => `<span>${escapeHtml(header)}</span>`).join('')}</div>
      ${rows.join('')}
    </div>`;
}

function renderGatewayDrilldown(value, language) {
  const copy = PRIVATE_COPY[language];
  const processes = Array.isArray(value.processes) ? value.processes : [];
  if (!processes.length) return '';
  const rows = processes.map((process) => `<div class="mini-row process-row">
      <span>${escapeHtml(process.pid)}</span>
      <span>${escapeHtml(process.name)}</span>
      <span>${escapeHtml(process.memory_mb)} MB</span>
      <span>${escapeHtml(process.started)}</span>
      <span title="${escapeHtml(process.command)}">${escapeHtml(process.command)}</span>
    </div>`);
  return renderMiniTable([copy.pid, copy.processName, copy.memory, copy.started, copy.command], rows);
}

function renderModelsDrilldown(value, language) {
  const copy = PRIVATE_COPY[language];
  const models = Array.isArray(value.models) ? value.models : [];
  if (!models.length) return '';
  const fallbackSet = new Set(Array.isArray(value.fallbacks) ? value.fallbacks : []);
  return `<div class="model-list">
      ${models.map((model) => {
        const tags = [
          model === value.default_model ? `<em>${escapeHtml(copy.currentModel)}</em>` : '',
          fallbackSet.has(model) ? `<em>${escapeHtml(copy.detailLabels.fallbacks_count)}</em>` : '',
        ].filter(Boolean).join('');
        return `<div class="model-pill ${model === value.default_model ? 'active' : ''}"><span>${escapeHtml(model)}</span>${tags}</div>`;
      }).join('')}
    </div>`;
}

function renderFileDrilldown(value, language, name) {
  const copy = PRIVATE_COPY[language];
  const items = Array.isArray(value.items) ? value.items : [];
  if (!items.length) return '';
  const rows = items.map((item) => `<div class="mini-row file-row">
      <span title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
      <span>${escapeHtml(item.updated)}</span>
      <span>${escapeHtml(item.size_kb ? `${item.size_kb} KB` : item.type || '-')}</span>
    </div>`);
  return renderMiniTable([copy.resources[name] || name, copy.updated, copy.details], rows);
}

function renderDrilldown(name, value, language) {
  const copy = PRIVATE_COPY[language];
  let body = '';
  if (name === 'gateway') body = renderGatewayDrilldown(value, language);
  if (name === 'models') body = renderModelsDrilldown(value, language);
  if (name === 'diaries') body = renderFileDrilldown(value, language, name);
  if (name === 'backups') body = renderFileDrilldown(value, language, name);
  if (!body) return '';
  const open = name === 'gateway' || name === 'models' ? ' open' : '';
  return `<details class="drilldown drill-${name}"${open}>
      <summary>${escapeHtml(name === 'gateway' ? copy.processDetails : copy.drilldown)}</summary>
      ${body}
    </details>`;
}

function diskUsage(value) {
  const free = Number(value.free_gb);
  const total = Number(value.total_gb);
  if (!Number.isFinite(free) || !Number.isFinite(total) || total <= 0) return null;
  const used = Math.max(total - free, 0);
  const percent = Math.max(0, Math.min(100, Math.round((used / total) * 100)));
  return { used, percent };
}

function renderDiskRing(value, language) {
  const usage = diskUsage(value);
  if (!usage) return '';
  const tone = usage.percent >= 90 ? 'danger' : usage.percent >= 80 ? 'caution' : 'healthy';
  return `<div class="disk-ring ${tone}" style="--ring:${usage.percent * 3.6}deg" aria-label="${escapeHtml(`${PRIVATE_COPY[language].diskUsed} ${usage.percent}%`)}">
      <strong>${escapeHtml(usage.percent)}</strong>
      <span>%</span>
      <small>${escapeHtml(PRIVATE_COPY[language].diskUsed)}</small>
    </div>`;
}

function renderSparkline(trend, language) {
  if (!Array.isArray(trend) || trend.length < 2) return '';
  const values = trend.map((point) => Number(point.value) || 0);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = Math.max(max - min, 1);
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * 100;
    const y = max === min ? 18 : 32 - ((value - min) / range) * 26;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const last = values[values.length - 1] ?? 0;
  const areaPoints = `0,36 ${points} 100,36`;
  return `<div class="spark-wrap" aria-label="${escapeHtml(PRIVATE_COPY[language].trend7d)}">
      <svg viewBox="0 0 100 36" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <polygon points="${areaPoints}" class="spark-area"></polygon>
        <polyline points="${points}" class="spark-line"></polyline>
      </svg>
      <div class="spark-meta"><span>${escapeHtml(PRIVATE_COPY[language].trend7d)}</span><b>${escapeHtml(formatCompactNumber(last, language))}</b></div>
    </div>`;
}

function renderProcessVisual(value) {
  const count = Math.max(0, Number(value.process_count) || 0);
  const visible = Math.max(1, Math.min(count, 6));
  const pips = Array.from({ length: visible }, (_, index) => `<span style="--delay:${index * 90}ms"></span>`).join('');
  return `<div class="process-visual" aria-label="node ${escapeHtml(count)}">
      <div class="process-pips">${pips}</div>
      <strong>node</strong>
    </div>`;
}

function renderCardVisual(name, value, language) {
  if (name === 'disk') return renderDiskRing(value, language);
  if (name === 'gateway') return renderProcessVisual(value);
  if (name === 'sessions' || name === 'webchat' || name === 'costs') return renderSparkline(value.trend_7d, language);
  return '';
}

function renderCollectorCard(name, value, language) {
  const copy = PRIVATE_COPY[language];
  const label = copy.resources[name] || name;
  const entries = displayEntries(value);
  const primary = primaryEntryFor(name, entries);
  const mainMetric = primary
    ? `<b>${escapeHtml(formatMetricValue(primary[0], primary[1], language))}</b>`
    : '<b>-</b>';
  const mainLabel = primary
    ? escapeHtml(copy.detailLabels[primary[0]] || primary[0])
    : '';
  const detailEntries = primary ? entries.filter(([key]) => key !== primary[0]) : entries;
  const visual = renderCardVisual(name, value, language);
  const classes = [
    'card',
    `card-${name}`,
    WIDE_RESOURCES.has(name) ? 'card-wide' : '',
    visual ? 'has-visual' : '',
  ].filter(Boolean).join(' ');
  return `<article class="${classes}">
    <div class="card-head"><span>${escapeHtml(label)}</span>${statusChip(value.status ?? 'unknown', language)}</div>
    <div class="card-body">
      <div class="metric-block">
        <div class="card-metric">${mainMetric}</div>
        <div class="card-label">${mainLabel}</div>
      </div>
      ${visual}
    </div>
    ${renderDetailItems(detailEntries, language)}
    ${renderDrilldown(name, value, language)}
  </article>`;
}

function getPrivateView(request) {
  const url = new URL(request.url || '/', `http://${HOST}:${PORT}`);
  const requested = url.searchParams.get('view');
  return PRIVATE_VIEWS.includes(requested) ? requested : DEFAULT_PRIVATE_VIEW;
}

function viewLabels(language) {
  if (language === 'en') {
    return {
      overview: 'Overview',
      knowledge: 'Knowledge',
      collector: 'Artifacts',
      reports: 'Reports',
      models: 'Models',
      services: 'Services',
      assets: 'Assets',
    };
  }
  return {
    overview: '总览',
    knowledge: '知识库',
    collector: '知识产物',
    reports: '统计与报告',
    models: '模型队列',
    services: '服务进程',
    assets: '资产数据',
  };
}

function viewHref(view, language, extra = {}) {
  const params = new URLSearchParams();
  params.set('view', view);
  params.set('lang', language);
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  return `/?${params.toString()}`;
}

function languageSwitchForView(language, view, request) {
  const currentUrl = new URL(request.url || '/', `http://${HOST}:${PORT}`);
  currentUrl.searchParams.delete('partial');
  currentUrl.searchParams.delete('refresh');
  currentUrl.searchParams.set('view', view);
  const zhParams = new URLSearchParams(currentUrl.searchParams);
  const enParams = new URLSearchParams(currentUrl.searchParams);
  zhParams.set('lang', 'zh-CN');
  enParams.set('lang', 'en');
  return `<div class="language-switch" aria-label="Language">
    <a class="${language === 'zh-CN' ? 'active' : ''}" href="/?${zhParams.toString()}">${escapeHtml(PRIVATE_COPY[language].languageChinese)}</a>
    <a class="${language === 'en' ? 'active' : ''}" href="/?${enParams.toString()}">${escapeHtml(PRIVATE_COPY[language].languageEnglish)}</a>
  </div>`;
}

function uniqueSorted(values) {
  return [...new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
}

function selectedParam(url, name) {
  return String(url.searchParams.get(name) || '').trim();
}

function renderOptionList(values, selected, allLabel) {
  return `<option value="">${escapeHtml(allLabel)}</option>${values
    .map((value) => `<option value="${escapeHtml(value)}"${value === selected ? ' selected' : ''}>${escapeHtml(value)}</option>`)
    .join('')}`;
}

function renderTable(headers, rows, emptyText = '暂无数据') {
  if (!rows.length) return `<div class="empty-state">${escapeHtml(emptyText)}</div>`;
  return `<div class="table-scroll"><table>
    <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead>
    <tbody>${rows.join('')}</tbody>
  </table></div>`;
}

function renderTagList(tags) {
  if (!Array.isArray(tags) || !tags.length) return '<span class="muted">-</span>';
  return `<span class="tags">${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}</span>`;
}

function compactPath(filePath) {
  if (!filePath) return '-';
  return String(filePath).replace(OPENCLAW_WORKSPACE, '%OPENCLAW_WORKSPACE%').replace(ROOT, '%ADGAI_SITE%');
}

function formatIsoTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return formatLocalDateTime(date);
}

function renderMarkdownSafe(markdown) {
  const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n');
  let html = '';
  let paragraph = [];
  let table = [];
  let code = [];
  let inCode = false;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    html += `<p>${paragraph.map((line) => escapeHtml(line)).join('<br>')}</p>`;
    paragraph = [];
  };
  const flushTable = () => {
    if (!table.length) return;
    const rows = table
      .filter((line) => !/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line))
      .map((line) => line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((cell) => cell.trim()));
    if (rows.length) {
      const [head, ...body] = rows;
      html += `<div class="table-scroll markdown-table"><table><thead><tr>${head.map((cell) => `<th>${escapeHtml(cell)}</th>`).join('')}</tr></thead><tbody>${body.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    }
    table = [];
  };
  const flushCode = () => {
    html += `<pre class="code-block"><code>${escapeHtml(code.join('\n'))}</code></pre>`;
    code = [];
  };

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      if (inCode) {
        flushCode();
        inCode = false;
      } else {
        flushParagraph();
        flushTable();
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      code.push(line);
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line)) {
      flushParagraph();
      table.push(line);
      continue;
    }
    flushTable();
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      const level = Math.min(heading[1].length + 1, 5);
      html += `<h${level}>${escapeHtml(heading[2])}</h${level}>`;
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      continue;
    }
    paragraph.push(line.trim());
  }
  if (inCode) flushCode();
  flushParagraph();
  flushTable();
  return `<div class="markdown-preview">${html || '<p class="muted">暂无报告内容</p>'}</div>`;
}

function renderMetricCard(label, value, note = '', tone = '') {
  return `<article class="metric-card ${tone}">
    <span>${escapeHtml(label)}</span>
    <b>${escapeHtml(value)}</b>
    ${note ? `<small>${escapeHtml(note)}</small>` : ''}
  </article>`;
}

function openClawRuntimeSummary(gateway, language) {
  const state = gateway.runtime_state || gateway.health_status || 'unknown';
  const labels = {
    running: language === 'en' ? 'Running' : '运行中',
    stopped: language === 'en' ? 'Stopped' : '未运行',
    stalled: language === 'en' ? 'Stalled' : '卡死/无响应',
    unhealthy: language === 'en' ? 'Unhealthy' : '异常',
    port_occupied: language === 'en' ? 'Port occupied' : '端口占用',
    unknown: language === 'en' ? 'Unknown' : '未知',
  };
  return {
    label: labels[state] || labels.unknown,
    tone: state === 'running' ? 'good' : 'warn',
  };
}

function renderOpenClawMetric(gateway, language) {
  const summary = openClawRuntimeSummary(gateway, language);
  const pid = gateway.listener_pid ? `PID ${gateway.listener_pid}` : 'no PID';
  const health = gateway.health_http_status ? `/health ${gateway.health_http_status}` : '/health -';
  const task = gateway.task_status || 'unknown';
  return renderMetricCard(
    language === 'en' ? 'OpenClaw Health' : 'OpenClaw 健康',
    summary.label,
    `:${gateway.port || OPENCLAW_GATEWAY_PORT} · ${pid} · ${health} · task ${task}`,
    summary.tone,
  );
}

function renderKnowledgeSummaryCard(chatCollector, language) {
  const knowledge = chatCollector?.knowledge ?? {};
  const stats = chatCollector?.stats ?? {};
  const report = chatCollector?.report ?? {};
  const status = chatCollector?.status ?? 'unknown';
  return `<article class="card card-wide knowledge-summary">
    <div class="card-head"><span>${language === 'en' ? 'Analyzed knowledge' : '已分析知识'}</span>${statusChip(status, language)}</div>
    <div class="card-body">
      <div class="metric-block">
        <div class="card-metric"><b>${escapeHtml(formatNumber(Number(knowledge.count) || 0, language))}</b></div>
        <div class="card-label">${escapeHtml(knowledge.date || '暂无知识文件')}</div>
      </div>
      <div class="pipeline-mini" aria-label="knowledge artifacts">
        <span class="${knowledge.file ? 'done' : ''}">knowledge</span>
        <span class="${stats.file ? 'done' : ''}">stats</span>
        <span class="${report.file ? 'done' : ''}">report</span>
      </div>
    </div>
    <div class="card-details">
      <span class="detail-item"><span>knowledge</span><b>${escapeHtml(compactPath(knowledge.file || '-'))}</b></span>
      <span class="detail-item"><span>stats</span><b>${escapeHtml(stats.date || '-')}</b></span>
      <span class="detail-item"><span>report</span><b>${escapeHtml(report.date || '-')}</b></span>
    </div>
  </article>`;
}

function renderOverviewPage(snapshot, language) {
  const copy = PRIVATE_COPY[language];
  const chatCollector = snapshot.chatCollector ?? {};
  const resources = snapshot.resources;
  const metricCards = [
    renderOpenClawMetric(resources.gateway ?? {}, language),
    renderMetricCard(copy.gatewayProcesses, formatDetailValue('process_count', resources.gateway.process_count, language), 'OpenClaw Gateway'),
    renderMetricCard(copy.resources.costs, formatMetricValue('total_tokens', resources.costs.total_tokens ?? 0, language), `${copy.detailLabels.cost_today}: ${formatDetailValue('cost_today', resources.costs.cost_today ?? 0, language)}`, 'accent'),
    renderMetricCard(language === 'en' ? 'Knowledge' : '知识条目', formatNumber(chatCollector.knowledge?.count ?? 0, language), chatCollector.knowledge?.date || 'no data'),
  ].join('');
  const cards = ['costs', 'gateway', 'agent', 'disk', 'sessions']
    .filter((name) => resources[name])
    .map((name) => renderCollectorCard(name, resources[name], language))
    .join('');
  return `<section class="metric-grid">${metricCards}</section>
    <section class="resource-grid">${renderKnowledgeSummaryCard(chatCollector, language)}${cards}</section>`;
}

function entryTitle(entry) {
  const summary = String(entry?.summary || entry?.detail || '').trim();
  return truncateText(summary.split('\n').find(Boolean) || entry?.type || '知识条目', 86);
}

function entryMatches(entry, filters) {
  const text = `${entry.summary || ''} ${entry.detail || ''} ${entry.source_group || ''} ${entry.contributor || ''} ${(entry.tags || []).join(' ')}`.toLowerCase();
  if (filters.platform && entry.platform !== filters.platform) return false;
  if (filters.group && entry.source_group !== filters.group) return false;
  if (filters.contributor && entry.contributor !== filters.contributor) return false;
  if (filters.tag && !(entry.tags || []).includes(filters.tag)) return false;
  if (filters.q && !text.includes(filters.q.toLowerCase())) return false;
  return true;
}

function renderKnowledgePage(snapshot, request, language) {
  const url = new URL(request.url || '/', `http://${HOST}:${PORT}`);
  const chatCollector = snapshot.chatCollector ?? {};
  const entries = Array.isArray(chatCollector.knowledge?.entries) ? chatCollector.knowledge.entries : [];
  const filters = {
    platform: selectedParam(url, 'platform'),
    group: selectedParam(url, 'group'),
    contributor: selectedParam(url, 'contributor'),
    tag: selectedParam(url, 'tag'),
    q: selectedParam(url, 'q'),
  };
  const filtered = entries.filter((entry) => entryMatches(entry, filters));
  const selectedIndex = Math.max(0, Math.min(Number(url.searchParams.get('selected')) || 0, Math.max(filtered.length - 1, 0)));
  const selected = filtered[selectedIndex] || filtered[0] || null;
  const groups = uniqueSorted(entries.map((entry) => entry.source_group));
  const contributors = uniqueSorted(entries.map((entry) => entry.contributor));
  const tags = uniqueSorted(entries.flatMap((entry) => Array.isArray(entry.tags) ? entry.tags : []));
  const list = filtered.map((entry, index) => {
    const href = viewHref('knowledge', language, { ...filters, selected: index });
    return `<a class="knowledge-item ${index === selectedIndex ? 'active' : ''}" href="${escapeHtml(href)}">
      <span class="item-top"><b>${escapeHtml(entryTitle(entry))}</b><em>${escapeHtml(entry.platform || '-')}</em></span>
      <span class="item-meta">${escapeHtml(entry.source_group || '-')} · ${escapeHtml(entry.contributor || '-')} · ${escapeHtml(formatIsoTime(entry.time))}</span>
      ${renderTagList(entry.tags)}
    </a>`;
  }).join('');

  const detail = renderKnowledgeDetail(selected, chatCollector, language);

  return `<section class="page-panel">
    <form class="filter-bar" method="get">
      <input type="hidden" name="view" value="knowledge">
      <input type="hidden" name="lang" value="${escapeHtml(language)}">
      <select name="platform">${renderOptionList(['wechat', 'feishu'], filters.platform, '全部平台')}</select>
      <select name="group">${renderOptionList(groups, filters.group, '全部群组')}</select>
      <select name="contributor">${renderOptionList(contributors, filters.contributor, '全部贡献者')}</select>
      <select name="tag">${renderOptionList(tags, filters.tag, '全部标签')}</select>
      <input name="q" value="${escapeHtml(filters.q)}" placeholder="关键词">
      <button class="btn-secondary" type="submit">筛选</button>
      <a class="btn-link" href="${escapeHtml(viewHref('knowledge', language))}">重置</a>
    </form>
    <div class="split-view">
      <div class="knowledge-list">
        <div class="list-head"><span>最新知识文件</span><b>${escapeHtml(chatCollector.knowledge?.date || '无')}</b><em>${escapeHtml(`${filtered.length}/${entries.length}`)}</em></div>
        ${list || '<div class="empty-state">暂无知识条目。请等待 OpenClaw 完成分析并生成 knowledge 文件。</div>'}
      </div>
      ${detail}
    </div>
  </section>`;
}

function renderKnowledgeDetail(selected, chatCollector, language) {
  if (!selected) {
    return '<article class="detail-panel empty-state">暂无知识条目。请等待 OpenClaw 完成分析并生成 knowledge 文件。</article>';
  }
  return `<article class="detail-panel">
    <div class="panel-title">
      <span>${escapeHtml(selected.type || '知识条目')}</span>
      <strong>${escapeHtml(selected.platform || '-')}</strong>
    </div>
    <h2>${escapeHtml(entryTitle(selected))}</h2>
    <div class="kv-grid">
      <span><b>来源</b><em>${escapeHtml(selected.source_group || '-')}</em></span>
      <span><b>贡献者</b><em>${escapeHtml(selected.contributor || '-')}</em></span>
      <span><b>时间</b><em>${escapeHtml(formatIsoTime(selected.time))}</em></span>
      <span><b>日报</b><em>${chatCollector?.report?.date ? '已生成' : '待生成'}</em></span>
    </div>
    <h3>原文摘要</h3>
    <div class="detail-copy">${renderMarkdownSafe(selected.detail || selected.summary || '')}</div>
    <h3>信号与标签</h3>
    <div class="signal-block">${renderTagList(selected.signals)}${renderTagList(selected.tags)}</div>
  </article>`;
}

function pipelineStep(label, done, meta) {
  return `<div class="pipeline-step ${done ? 'done' : ''}">
    <span></span>
    <b>${escapeHtml(label)}</b>
    <small>${escapeHtml(meta || (done ? 'ready' : 'waiting'))}</small>
  </div>`;
}

function renderCollectorPage(snapshot, language) {
  const chatCollector = snapshot.chatCollector ?? {};
  const stats = chatCollector.stats?.data?.stats ?? {};
  const artifactRows = [
    ['knowledge', chatCollector.knowledge?.status, chatCollector.knowledge?.date, chatCollector.knowledge?.count ?? 0, chatCollector.knowledge?.file],
    ['stats', chatCollector.stats?.status, chatCollector.stats?.date, stats.knowledge ?? '-', chatCollector.stats?.file],
    ['report', chatCollector.report?.status, chatCollector.report?.date, chatCollector.report?.size_kb ? `${chatCollector.report.size_kb} KB` : '-', chatCollector.report?.file],
  ].map(([name, status, date, amount, file]) => `<tr>
    <td>${escapeHtml(name)}</td>
    <td>${statusChip(status || 'unknown', language)}</td>
    <td>${escapeHtml(date || '-')}</td>
    <td>${escapeHtml(formatDetailValue('count', amount, language))}</td>
    <td title="${escapeHtml(file || '-')}">${escapeHtml(compactPath(file || '-'))}</td>
  </tr>`);
  const errorRows = (chatCollector.errors || []).map((error) => `<li>${escapeHtml(error)}</li>`).join('');
  return `<section class="metric-grid">
      ${renderMetricCard('最近产出', chatCollector.last_collect?.value || '-', chatCollector.last_collect?.updated || '-')}
      ${renderMetricCard('知识条目', formatNumber(chatCollector.knowledge?.count ?? 0, language), chatCollector.knowledge?.date || 'no knowledge', 'accent')}
      ${renderMetricCard('统计文件', chatCollector.stats?.date || '未生成', compactPath(chatCollector.stats?.file || '-'))}
      ${renderMetricCard('日报', chatCollector.report?.date || '未生成', compactPath(chatCollector.report?.file || '-'), chatCollector.report?.date ? 'good' : '')}
    </section>
    <section class="page-grid two">
      <article class="page-panel">
        <div class="panel-title"><span>分析产物链路</span><strong>${escapeHtml(chatCollector.status || 'unknown')}</strong></div>
        <div class="pipeline">
          ${pipelineStep('knowledge', chatCollector.knowledge?.count > 0, `${chatCollector.knowledge?.count ?? 0} entries`)}
          ${pipelineStep('stats', Boolean(chatCollector.stats?.date), chatCollector.stats?.date || '')}
          ${pipelineStep('report', Boolean(chatCollector.report?.date), chatCollector.report?.date || '')}
        </div>
      </article>
      <article class="page-panel">
        <div class="panel-title"><span>OpenClaw 分析边界</span><strong>read-only</strong></div>
        <div class="kv-grid">
          <span><b>数据根目录</b><em title="${escapeHtml(chatCollector.root || '-')}">${escapeHtml(compactPath(chatCollector.root || '-'))}</em></span>
          <span><b>统计样本</b><em>${escapeHtml(formatNumber(stats.total || 0, language))}</em></span>
          <span><b>清洗后</b><em>${escapeHtml(formatNumber(stats.cleaned || 0, language))}</em></span>
          <span><b>过滤</b><em>${escapeHtml(formatNumber(stats.filtered || 0, language))}</em></span>
        </div>
      </article>
    </section>
    <section class="page-grid two">
      <article class="page-panel">
        <div class="panel-title"><span>产物文件</span><strong>${escapeHtml(chatCollector.last_collect?.updated || '-')}</strong></div>
        ${renderTable(['产物', '状态', '日期', '数量/大小', '路径'], artifactRows, '暂无分析产物')}
      </article>
      <article class="page-panel">
        <div class="panel-title"><span>读取状态</span><strong>${escapeHtml(String((chatCollector.errors || []).length))}</strong></div>
        <ul class="issue-list">${errorRows || '<li>所有分析产物读取正常</li>'}</ul>
      </article>
    </section>`;
}

function flattenContributors(statsData) {
  return (statsData?.contributors || []).flatMap((group) => (group.topContributors || []).map((item) => ({
    platform: group.platform,
    group: group.name,
    name: item.name,
    count: item.knowledgeCount,
  }))).sort((a, b) => b.count - a.count);
}

function renderReportsPage(snapshot, language) {
  const chatCollector = snapshot.chatCollector ?? {};
  const statsData = chatCollector.stats?.data ?? {};
  const stats = statsData.stats ?? {};
  const byPlatform = stats.byPlatform ?? {};
  const contributorRows = flattenContributors(statsData).slice(0, 12).map((item) => `<tr>
    <td>${escapeHtml(item.name)}</td>
    <td>${escapeHtml(item.group)}</td>
    <td>${escapeHtml(item.platform)}</td>
    <td>${escapeHtml(formatNumber(item.count || 0, language))}</td>
  </tr>`);
  const activityRows = (statsData.activity || []).slice(0, 12).map((item) => `<tr>
    <td>${escapeHtml(item.name)}</td>
    <td>${escapeHtml(item.platform)}</td>
    <td>${escapeHtml(formatNumber(item.total || 0, language))}</td>
    <td>${escapeHtml((item.topSenders || []).slice(0, 3).map((sender) => `${sender.name}:${sender.count}`).join(' / ') || '-')}</td>
  </tr>`);
  const platformRows = Object.entries(byPlatform).map(([platform, value]) => `<tr>
    <td>${escapeHtml(platform)}</td>
    <td>${escapeHtml(formatNumber(value.total || 0, language))}</td>
    <td>${escapeHtml(formatNumber(value.knowledge || 0, language))}</td>
  </tr>`);
  return `<section class="metric-grid">
      ${renderMetricCard('分析样本', formatNumber(stats.total || 0, language), `filtered ${stats.filtered ?? 0}`)}
      ${renderMetricCard('清洗后', formatNumber(stats.cleaned || 0, language), chatCollector.stats?.date || 'no stats')}
      ${renderMetricCard('知识条目', formatNumber(stats.knowledge || 0, language), chatCollector.knowledge?.date || 'no knowledge', 'accent')}
      ${renderMetricCard('日报', chatCollector.report?.date || '未生成', compactPath(chatCollector.report?.file || ''), chatCollector.report?.date ? 'good' : '')}
    </section>
    <section class="page-grid two">
      <article class="page-panel">
        <div class="panel-title"><span>知识贡献者排行</span><strong>Top 12</strong></div>
        ${renderTable(['贡献者', '群组', '平台', '知识数'], contributorRows, '暂无贡献者统计')}
      </article>
      <article class="page-panel">
        <div class="panel-title"><span>群活跃度</span><strong>Top 12</strong></div>
        ${renderTable(['群组', '平台', '分析样本', '活跃成员'], activityRows, '暂无活跃度统计')}
      </article>
    </section>
    <section class="page-grid two">
      <article class="page-panel">
        <div class="panel-title"><span>平台知识量</span><strong>${escapeHtml(chatCollector.stats?.date || '-')}</strong></div>
        ${renderTable(['平台', '分析样本', '知识'], platformRows, '暂无平台统计')}
      </article>
      <article class="page-panel report-panel">
        <div class="panel-title"><span>日报预览</span><strong>${escapeHtml(compactPath(chatCollector.report?.file || '-'))}</strong></div>
        ${renderMarkdownSafe(chatCollector.report?.body || '')}
      </article>
    </section>`;
}

function renderModelsPage(snapshot, language) {
  const models = snapshot.resources.models ?? {};
  const costs = snapshot.resources.costs ?? {};
  const rows = (models.model_rows || []);
  const maxTokens = Math.max(...rows.map(r => r.tokens), 1);
  const isZh = language !== 'en';

  const tableRows = rows.map((m) => {
    const isActive = m.requests > 0;
    const pct = Math.round(m.tokens / maxTokens * 100);
    const cacheStr = m.cache_rate !== null && m.cache_rate > 0 ? `${m.cache_rate}%` : '-';
    const costStr = m.cost > 0 ? (isZh ? '\u00a5' : '$') + m.cost.toFixed(3) : '-';
    const roleHtml = m.role === 'default'
      ? '<span class="role-tag role-default">' + (isZh ? '默认' : 'Default') + '</span>'
      : m.role === 'fallback'
      ? '<span class="role-tag role-fallback">' + (isZh ? '备用' : 'Fallback') + '</span>'
      : '';
    return `<tr class="${m.is_default ? 'active-row' : isActive ? '' : 'dim-row'}">
      <td class="model-name">${escapeHtml(m.short_name)}</td>
      <td>${roleHtml}</td>
      <td class="num">${isActive ? formatNumber(m.tokens, language) + 'k' : '-'}</td>
      <td class="num">${costStr}</td>
      <td class="num">${cacheStr}</td>
      <td class="num">${isActive ? formatNumber(m.requests, language) : '-'}</td>
      <td class="bar-cell"><div class="token-bar" style="width:${pct}%"></div></td>
    </tr>`;
  }).join('');

  const activeCount = rows.filter(r => r.requests > 0).length;
  return `<section class="metric-grid">
    ${renderMetricCard(isZh ? '总 Token' : 'Total Tokens', formatNumber(costs.total_tokens ?? 0, language) + 'k', costs.top_model ? `Top: ${costs.top_model}` : '-', 'accent')}
    ${renderMetricCard(isZh ? '总费用' : 'Total Cost', (isZh ? '\u00a5' : '$') + (costs.cost_today ?? 0).toFixed(3), isZh ? '今日' : 'today')}
    ${renderMetricCard(isZh ? '缓存命中率' : 'Cache Rate', (costs.cache_rate ?? 0) + '%', isZh ? '缓存命中' : 'cache hit', costs.cache_rate > 50 ? 'good' : costs.cache_rate > 0 ? 'warn' : '')}
    ${renderMetricCard(isZh ? '活跃模型' : 'Active Models', String(activeCount), `${rows.length} ${isZh ? '已配置' : 'configured'}`)}
  </section>
  <section class="page-panel">
    <div class="panel-title"><span>OpenClaw ${isZh ? '模型队列' : 'Model Queue'}</span><strong>${escapeHtml(models.status || 'unknown')}</strong></div>
    <table class="data-table model-table">
      <thead><tr>
        <th>${isZh ? '模型' : 'Model'}</th>
        <th>${isZh ? '角色' : 'Role'}</th>
        <th class="num">Token</th>
        <th class="num">${isZh ? '费用' : 'Cost'}</th>
        <th class="num">${isZh ? '缓存' : 'Cache'}</th>
        <th class="num">${isZh ? '调用' : 'Calls'}</th>
        <th class="bar-col"></th>
      </tr></thead>
      <tbody>${tableRows || `<tr><td colspan="7" class="empty">${isZh ? '暂无模型配置' : 'No models configured'}</td></tr>`}</tbody>
    </table>
  </section>`;
}

function renderServicesPage(snapshot, language) {
  const gateway = snapshot.resources.gateway ?? {};
  const rows = (gateway.processes || []).map((process) => `<tr>
    <td>${escapeHtml(process.pid)}</td>
    <td>${escapeHtml(process.name)}</td>
    <td>${escapeHtml(process.memory_mb)} MB</td>
    <td>${escapeHtml(process.started)}</td>
    <td title="${escapeHtml(process.command)}">${escapeHtml(process.command)}</td>
  </tr>`);
  return `<section class="metric-grid">
    ${renderMetricCard('Gateway 进程', formatNumber(gateway.process_count ?? 0, language), 'OpenClaw Gateway', gateway.status === 'ok' ? 'good' : 'warn')}
    ${renderMetricCard('Agent 工具调用', formatNumber(snapshot.resources.agent?.tool_calls ?? 0, language), `tasks ${snapshot.resources.agent?.tasks ?? 0}`)}
    ${renderMetricCard('最近活动', snapshot.resources.agent?.last_action || '-', snapshot.resources.agent?.active ? 'active' : 'idle')}
  </section>
  <section class="page-panel">
    <div class="panel-title"><span>进程明细</span><strong>${escapeHtml(gateway.status || 'unknown')}</strong></div>
    ${renderTable(['PID', '进程', '内存', '启动时间', '命令'], rows, '暂无 Gateway 进程')}
  </section>`;
}

function renderAssetsPage(snapshot, language) {
  const backups = snapshot.resources.backups ?? {};
  const diaries = snapshot.resources.diaries ?? {};
  const knowledge = snapshot.chatCollector?.knowledge ?? {};
  const backupRows = (backups.items || []).map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.updated)}</td><td>${escapeHtml(item.type || '-')}</td></tr>`);
  const diaryRows = (diaries.items || []).map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.updated)}</td><td>${escapeHtml(item.size_kb)} KB</td></tr>`);
  const knowledgeRows = (knowledge.entries || []).slice(0, 8).map((entry) => `<tr><td>${escapeHtml(entryTitle(entry))}</td><td>${escapeHtml(entry.platform || '-')}</td><td>${escapeHtml(entry.source_group || '-')}</td><td>${escapeHtml(formatIsoTime(entry.time))}</td></tr>`);
  return `<section class="metric-grid">
    ${renderMetricCard('最新备份', backups.latest || '-', `${backups.count ?? 0} items`, backups.status === 'ok' ? 'good' : 'warn')}
    ${renderMetricCard('日记', formatNumber(diaries.count ?? 0, language), diaries.latest || '-')}
    ${renderMetricCard('知识条目', formatNumber(knowledge.count ?? 0, language), knowledge.date || 'no knowledge', 'accent')}
  </section>
  <section class="page-grid two">
    <article class="page-panel"><div class="panel-title"><span>最新备份</span><strong>${escapeHtml(backups.status || 'unknown')}</strong></div>${renderTable(['名称', '更新时间', '类型'], backupRows, '暂无备份')}</article>
    <article class="page-panel"><div class="panel-title"><span>日记</span><strong>${escapeHtml(diaries.status || 'unknown')}</strong></div>${renderTable(['名称', '更新时间', '大小'], diaryRows, '暂无日记')}</article>
  </section>
  <section class="page-panel"><div class="panel-title"><span>最新知识</span><strong>${escapeHtml(knowledge.date || '-')}</strong></div>${renderTable(['标题', '平台', '来源', '时间'], knowledgeRows, '暂无知识条目')}</section>`;
}

function renderPageContent(view, snapshot, request, language) {
  if (view === 'knowledge') return renderKnowledgePage(snapshot, request, language);
  if (view === 'collector') return renderCollectorPage(snapshot, language);
  if (view === 'reports') return renderReportsPage(snapshot, language);
  if (view === 'models') return renderModelsPage(snapshot, language);
  if (view === 'services') return renderServicesPage(snapshot, language);
  if (view === 'assets') return renderAssetsPage(snapshot, language);
  return renderOverviewPage(snapshot, language);
}

function navShortLabel(label) {
  const text = String(label || '').trim();
  if (!text) return '-';
  if (/^[A-Za-z]/.test(text)) return text.slice(0, 1).toUpperCase();
  return Array.from(text)[0];
}

function renderWorkspaceParts(snapshot, request) {
  const language = getPrivateLanguage(request);
  const view = getPrivateView(request);
  const labels = viewLabels(language);
  const copy = PRIVATE_COPY[language];
  const nav = PRIVATE_VIEWS.map((item) => {
    const label = labels[item];
    return `<a class="${item === view ? 'active' : ''}" href="${escapeHtml(viewHref(item, language))}" title="${escapeHtml(label)}"><span class="nav-short">${escapeHtml(navShortLabel(label))}</span><span class="nav-label">${escapeHtml(label)}</span></a>`;
  }).join('');
  const content = renderPageContent(view, snapshot, request, language);
  const result = {
    language,
    view,
    title: `${copy.title} · ${labels[view]}`,
    updated: `${copy.updated} ${snapshot.collected_at}`,
    heading: labels[view],
    nav,
    topActions: languageSwitchForView(language, view, request),
    content,
  };
  if (view === 'knowledge') {
    const url = new URL(request.url || '/', `http://${HOST}:${PORT}`);
    if (url.searchParams.has('selected')) {
      const chatCollector = snapshot.chatCollector ?? {};
      const entries = Array.isArray(chatCollector.knowledge?.entries) ? chatCollector.knowledge.entries : [];
      const filters = {
        platform: selectedParam(url, 'platform'),
        group: selectedParam(url, 'group'),
        contributor: selectedParam(url, 'contributor'),
        tag: selectedParam(url, 'tag'),
        q: selectedParam(url, 'q'),
      };
      const filtered = entries.filter((entry) => entryMatches(entry, filters));
      const selectedIndex = Math.max(0, Math.min(Number(url.searchParams.get('selected')) || 0, Math.max(filtered.length - 1, 0)));
      const selected = filtered[selectedIndex] || null;
      result.detailPanel = renderKnowledgeDetail(selected, chatCollector, language);
    }
  }
  return result;
}

function renderWorkspace(snapshot, request) {
  const parts = renderWorkspaceParts(snapshot, request);
  return `<!doctype html>
<html lang="${escapeHtml(parts.language)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(parts.title)}</title>
  <script>try{if(localStorage.getItem('adgai.sidebar.collapsed')==='1')document.documentElement.classList.add('sidebar-collapsed')}catch{}</script>
  <style>
    :root { color-scheme: dark; --bg:#020914; --rail:#07111d; --surface:rgba(12,22,32,.84); --surface-2:rgba(22,36,49,.88); --line:rgba(115,255,226,.17); --line-soft:rgba(115,255,226,.09); --text:#edf7f7; --muted:#a7bbc2; --faint:#72878e; --accent:#75d0bd; --accent-strong:#94ead7; --orange:#f2a64a; --blue:#86b8ff; --danger:#ef6b5b; --warn:#e0b45c; --shadow:0 18px 52px rgba(0,0,0,.26); }
    * { box-sizing:border-box; }
    html, body { min-width:0; overflow-x:hidden; }
    body { margin:0; background:var(--bg); color:var(--text); font:14px/1.5 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    .agent-bg { position:fixed; inset:0; overflow:hidden; pointer-events:none; z-index:0; background:radial-gradient(circle at 4% 86%, rgba(25,255,220,.23), transparent 16%),radial-gradient(circle at 97% 94%, rgba(23,255,220,.22), transparent 18%),radial-gradient(circle at 50% 110%, rgba(20,255,219,.08), transparent 40%),radial-gradient(circle at 64% 10%, rgba(42,112,175,.18), transparent 31%),linear-gradient(180deg,#071827 0%,#03111d 42%,#01060c 100%); }
    .bg-grid { position:absolute; inset:0; z-index:1; background-image:linear-gradient(rgba(83,255,232,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(83,255,232,.035) 1px,transparent 1px); background-size:82px 82px; mask-image:linear-gradient(to bottom,transparent 0%,black 10%,black 92%,transparent 100%); animation:bgGridMove 28s linear infinite; }
    .bg-grid::after { content:""; position:absolute; left:-18%; right:-18%; bottom:-18%; height:54%; background-image:linear-gradient(rgba(56,255,224,.09) 1px,transparent 1px),linear-gradient(90deg,rgba(56,255,224,.06) 1px,transparent 1px); background-size:66px 34px; transform:perspective(680px) rotateX(61deg) translateY(10%); transform-origin:center bottom; opacity:.42; }
    #agentCanvas { position:absolute; inset:0; width:100%; height:100%; z-index:3; opacity:.44; }
    .bg-dots { position:absolute; inset:0; z-index:4; background-image:radial-gradient(circle, rgba(42,255,221,.44) 1px, transparent 1.8px); background-size:34px 34px; mask-image:radial-gradient(circle at 7% 67%, black 0%, transparent 19%),radial-gradient(circle at 87% 77%, black 0%, transparent 19%),radial-gradient(circle at 31% 8%, black 0%, transparent 15%),radial-gradient(circle at 55% 58%, black 0%, transparent 18%); opacity:.28; animation:bgDotsFloat 11s ease-in-out infinite alternate; }
    .bg-glow { position:absolute; inset:0; z-index:5; background:radial-gradient(circle at 3% 86%, rgba(18,255,213,.28), transparent 9%),radial-gradient(circle at 96% 93%, rgba(15,255,214,.26), transparent 10%),linear-gradient(100deg, transparent 0%, transparent 38%, rgba(34,255,221,.07) 50%, transparent 64%); filter:blur(1.2px); opacity:.55; animation:bgGlowPulse 5.8s ease-in-out infinite alternate; }
    .bg-flow-lines { position:absolute; inset:0; z-index:6; opacity:.28; background:linear-gradient(164deg,transparent 0%,transparent 34.6%,rgba(62,255,230,.12) 35.1%,transparent 35.8%),linear-gradient(168deg,transparent 0%,transparent 43.7%,rgba(62,255,230,.09) 44.2%,transparent 45%),linear-gradient(172deg,transparent 0%,transparent 52%,rgba(62,255,230,.07) 52.4%,transparent 53.1%),linear-gradient(7deg,transparent 0%,transparent 68%,rgba(62,255,230,.06) 68.4%,transparent 69.2%); animation:bgLineDrift 15s ease-in-out infinite alternate; }
    .bg-noise { position:absolute; inset:0; z-index:8; background:radial-gradient(circle at center,transparent 0%,rgba(0,0,0,.48) 100%),repeating-linear-gradient(0deg,rgba(255,255,255,.011) 0px,rgba(255,255,255,.011) 1px,transparent 1px,transparent 4px); opacity:.76; }
    @keyframes bgGridMove { from { background-position:0 0,0 0; } to { background-position:82px 82px,82px 82px; } }
    @keyframes bgDotsFloat { from { transform:translate3d(0,0,0); opacity:.22; } to { transform:translate3d(18px,-22px,0); opacity:.36; } }
    @keyframes bgGlowPulse { from { opacity:.45; filter:blur(1px); } to { opacity:.66; filter:blur(2.4px); } }
    @keyframes bgLineDrift { from { transform:translate3d(-10px,0,0); } to { transform:translate3d(18px,-10px,0); } }
    a { color:inherit; }
    .app-shell { position:relative; z-index:1; width:100%; max-width:100vw; min-height:100vh; display:grid; grid-template-columns:220px minmax(0,1fr); overflow-x:hidden; transition:grid-template-columns .2s ease; }
    .sidebar { min-width:0; max-width:100vw; position:sticky; top:0; height:100vh; padding:18px 14px; border-right:1px solid var(--line); background:rgba(7,17,29,.78); backdrop-filter:blur(12px); display:flex; flex-direction:column; gap:14px; }
    .brand { padding:4px 8px 12px; border-bottom:1px solid var(--line-soft); display:grid; grid-template-columns:minmax(0,1fr) auto; gap:8px; align-items:start; }
    .brand b { display:block; font-size:17px; letter-spacing:0; }
    .brand span { display:block; margin-top:4px; color:var(--muted); font-size:12px; }
    .brand-copy { min-width:0; overflow:hidden; }
    .sidebar-toggle { width:30px; min-height:30px; border-radius:7px; border:1px solid var(--line); background:rgba(24,42,52,.68); color:var(--accent-strong); padding:0; font-weight:800; }
    .nav { min-width:0; max-width:100%; display:grid; gap:5px; }
    .nav a { min-height:36px; padding:8px 10px; border-radius:8px; color:var(--muted); text-decoration:none; display:flex; align-items:center; gap:10px; border:1px solid transparent; }
    .nav-short { display:none; width:24px; height:24px; border-radius:7px; align-items:center; justify-content:center; border:1px solid var(--line-soft); color:var(--accent-strong); font-weight:800; font-size:12px; flex:0 0 auto; }
    .nav-label { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .nav a.active { color:#0b1210; background:var(--accent); font-weight:760; }
    .nav a.active .nav-short { color:#0b1210; border-color:rgba(0,0,0,.12); }
    .nav a:not(.active):hover { background:rgba(255,255,255,.045); color:var(--text); border-color:var(--line-soft); }
    .sidebar-collapsed .app-shell { grid-template-columns:76px minmax(0,1fr); }
    .sidebar-collapsed .sidebar { padding:18px 10px; }
    .sidebar-collapsed .brand { grid-template-columns:1fr; justify-items:center; padding-left:0; padding-right:0; }
    .sidebar-collapsed .brand-copy { display:none; }
    .sidebar-collapsed .sidebar-toggle { transform:rotate(180deg); }
    .sidebar-collapsed .nav a { justify-content:center; padding-left:6px; padding-right:6px; }
    .sidebar-collapsed .nav-short { display:inline-flex; }
    .sidebar-collapsed .nav-label { display:none; }
    .workspace { min-width:0; padding:20px; }
    .topbar { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:14px; align-items:center; margin-bottom:14px; padding-bottom:14px; border-bottom:1px solid var(--line); }
    .breadcrumb { display:grid; gap:4px; min-width:0; }
    .breadcrumb span { color:var(--faint); font-size:12px; }
    h1 { margin:0; font-size:22px; line-height:1.18; letter-spacing:0; }
    h2 { margin:0 0 12px; font-size:18px; letter-spacing:0; }
    h3 { margin:16px 0 8px; font-size:13px; letter-spacing:0; color:#dce3ea; }
    .top-actions, .run-actions, .run-options { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
    button, .btn-link, .status-note, select, input { min-height:34px; border-radius:7px; font:inherit; font-size:12px; }
    button { cursor:pointer; }
    button, .btn-link, .nav a, .knowledge-item, .language-switch a, select, input { transition:background-color .16s ease,border-color .16s ease,color .16s ease,box-shadow .16s ease,transform .16s ease,opacity .16s ease; }
    button:hover, .btn-link:hover, .language-switch a:hover { transform:translateY(-1px); box-shadow:0 8px 22px rgba(0,0,0,.16); }
    button:active, .btn-link:active, .nav a:active, .knowledge-item:active { transform:translateY(0) scale(.985); }
    button:disabled { cursor:wait; opacity:.62; transform:none; }
    select, input { min-width:0; color:var(--text); background:var(--surface-2); border:1px solid var(--line); padding:7px 9px; }
    .btn-start { background:rgba(117,208,189,.12); color:var(--accent-strong); border:1px solid rgba(117,208,189,.52); padding:7px 12px; font-weight:730; }
    .btn-kill { background:rgba(239,107,91,.14); color:#ffd7d2; border:1px solid rgba(239,107,91,.55); padding:7px 12px; font-weight:730; }
    .btn-secondary, .btn-link { background:var(--surface-2); color:var(--text); border:1px solid var(--line); padding:7px 11px; text-decoration:none; display:inline-flex; align-items:center; justify-content:center; font-weight:700; }
    .status-note { display:inline-flex; align-items:center; border:1px solid var(--line); background:rgba(24,29,36,.85); color:var(--muted); padding:6px 10px; }
    .status-note:empty { display:none; }
    .status-note.ok { color:var(--accent-strong); }
    .status-note.fail { color:#ffaaa0; }
    .language-switch { display:inline-flex; gap:2px; border:1px solid var(--line); border-radius:8px; padding:2px; background:rgba(24,29,36,.85); }
    .language-switch a { min-width:34px; min-height:28px; display:inline-flex; align-items:center; justify-content:center; border-radius:6px; color:var(--muted); text-decoration:none; font-weight:740; font-size:13px; }
    .language-switch a.active { background:var(--accent); color:#0b1210; }
    .route-progress { position:fixed; left:0; right:0; top:0; z-index:20; height:2px; transform:scaleX(0); transform-origin:left; opacity:0; background:linear-gradient(90deg,var(--accent),var(--orange)); box-shadow:0 0 18px rgba(117,208,189,.5); transition:transform .28s ease,opacity .18s ease; }
    body.route-busy .route-progress { transform:scaleX(.72); opacity:1; }
    body.route-done .route-progress { transform:scaleX(1); opacity:0; }
    .page-content { min-width:0; view-transition-name:page-content; transition:opacity .16s ease,transform .16s ease,filter .16s ease; }
    .page-content.is-leaving { opacity:.42; transform:translateY(4px); filter:blur(.8px); }
    .page-content.is-entering { opacity:0; transform:translateY(6px); filter:blur(.8px); }
    .metric-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin-bottom:12px; }
    .metric-card, .page-panel, .card { border:1px solid var(--line); border-radius:8px; background:rgba(24,29,36,.94); box-shadow:0 1px 0 rgba(255,255,255,.03) inset; }
    .metric-card { min-height:84px; padding:13px 14px; display:grid; gap:6px; align-content:start; }
    .metric-card span, .muted { color:var(--muted); font-size:12px; }
    .metric-card b { font:780 24px/1.1 "Cascadia Code","Consolas",monospace; overflow-wrap:anywhere; }
    .metric-card small { color:var(--faint); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .metric-card.good b { color:var(--accent-strong); }
    .metric-card.warn b { color:#f1cc77; }
    .metric-card.accent b { color:var(--orange); }
    .resource-grid { display:grid; grid-template-columns:repeat(12,minmax(0,1fr)); gap:12px; }
    .card { grid-column:span 4; min-height:168px; padding:15px; min-width:0; }
    .card-wide { grid-column:span 6; }
    .card-head, .panel-title, .list-head, .item-top { display:flex; justify-content:space-between; align-items:center; gap:10px; min-width:0; }
    .card-head { margin-bottom:14px; color:var(--muted); font-size:12px; }
    .card-head > span:first-child, .panel-title span, .list-head span { color:#d4dbe3; font-weight:740; }
    .card-body { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:14px; align-items:end; }
    .card-metric { font:780 30px/1.08 "Cascadia Code","Consolas",monospace; overflow-wrap:anywhere; }
    .card-metric b { font:inherit; }
    .card-label { color:var(--muted); font-size:12px; margin-top:7px; }
    .card-details { display:flex; flex-wrap:wrap; gap:8px; margin-top:14px; color:var(--muted); font-size:11px; }
    .detail-item { display:inline-grid; gap:2px; min-width:82px; max-width:100%; padding:6px 8px; border:1px solid var(--line-soft); border-radius:6px; background:rgba(255,255,255,.025); }
    .detail-item span { color:var(--faint); font-size:10px; }
    .detail-item b { color:#d8dde3; font-size:12px; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .chip { display:inline-flex; align-items:center; gap:6px; color:var(--muted); font-size:11px; white-space:nowrap; }
    .chip-dot, .state-dot { width:7px; height:7px; border-radius:999px; background:var(--faint); display:inline-block; margin-right:6px; }
    .chip.ok { color:#9ae7d6; } .chip.ok .chip-dot, .state-dot.ok { background:var(--accent); box-shadow:0 0 0 3px rgba(117,208,189,.13),0 0 14px rgba(117,208,189,.5); }
    .chip.warn { color:#f1cc77; } .chip.warn .chip-dot { background:var(--warn); }
    .chip.fail { color:#ffaaa0; } .chip.fail .chip-dot { background:var(--danger); }
    .spark-wrap { width:150px; max-width:100%; display:grid; align-content:end; gap:7px; }
    .spark-wrap svg { width:100%; height:48px; } .spark-line { fill:none; stroke:var(--blue); stroke-width:2.2; stroke-linecap:round; stroke-linejoin:round; vector-effect:non-scaling-stroke; } .spark-area { fill:rgba(134,184,255,.16); }
    .spark-meta { display:flex; justify-content:space-between; gap:8px; color:var(--faint); font-size:10px; }
    .disk-ring { --ring-color:var(--accent); width:104px; height:104px; border-radius:50%; display:grid; place-items:center; position:relative; background:conic-gradient(var(--ring-color) var(--ring),rgba(255,255,255,.07) 0deg); }
    .disk-ring::after { content:""; position:absolute; inset:12px; border-radius:inherit; background:var(--surface); }
    .disk-ring strong,.disk-ring span,.disk-ring small { position:relative; z-index:1; }
    .disk-ring strong { align-self:end; font:780 26px/1 "Cascadia Code","Consolas",monospace; } .disk-ring span { align-self:end; margin-left:30px; margin-top:-25px; color:var(--muted); } .disk-ring small { align-self:start; color:var(--faint); font-size:10px; }
    .disk-ring.caution { --ring-color:var(--warn); } .disk-ring.danger { --ring-color:var(--danger); }
    .process-visual { width:132px; display:grid; gap:10px; justify-items:end; color:var(--faint); } .process-pips { display:flex; gap:6px; align-items:end; height:44px; } .process-pips span { width:9px; min-height:18px; border-radius:999px; background:linear-gradient(180deg,var(--accent),rgba(117,208,189,.2)); } .process-pips span:nth-child(2n){min-height:28px}.process-pips span:nth-child(3n){min-height:38px}
    .model-breakdown { flex:1 1 100%; display:grid; gap:6px; min-width:0; } .breakdown-title { color:var(--faint); font-size:10px; } .model-row { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:10px; padding:5px 7px; border-radius:6px; background:rgba(255,255,255,.024); } .model-row span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .drilldown { margin-top:14px; border-top:1px solid var(--line-soft); padding-top:10px; } .drilldown summary { color:var(--accent-strong); cursor:pointer; font-size:12px; font-weight:760; }
    .mini-table { display:grid; gap:5px; margin-top:10px; } .mini-row { display:grid; grid-template-columns:46px 72px 68px 116px minmax(0,1fr); gap:8px; padding:6px 7px; border-radius:6px; background:rgba(255,255,255,.024); color:#cbd2da; font-size:11px; } .mini-row span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .model-list { display:grid; gap:6px; margin-top:10px; } .model-pill { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:8px; padding:7px 8px; border:1px solid var(--line-soft); border-radius:6px; background:rgba(255,255,255,.024); } .model-pill span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; } .model-pill em { border-radius:999px; padding:2px 6px; font-style:normal; font-size:10px; color:var(--muted); background:rgba(255,255,255,.05); } .model-pill.active { border-color:rgba(117,208,189,.42); background:rgba(117,208,189,.07); }
    .page-panel { padding:14px; min-width:0; }
    .page-grid { display:grid; gap:12px; margin-bottom:12px; } .page-grid.two { grid-template-columns:repeat(2,minmax(0,1fr)); }
    .panel-title { margin-bottom:12px; } .panel-title strong, .list-head b, .list-head em { color:var(--muted); font-size:12px; font-style:normal; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .filter-bar { display:grid; grid-template-columns:130px minmax(120px,1fr) minmax(120px,1fr) 120px minmax(120px,1fr) auto auto; gap:8px; margin-bottom:12px; }
    .split-view { display:grid; grid-template-columns:minmax(280px,.9fr) minmax(0,1.45fr); gap:12px; align-items:start; }
    .knowledge-list, .detail-panel { border:1px solid var(--line); border-radius:8px; background:rgba(24,29,36,.94); padding:12px; min-width:0; }
    .knowledge-list { display:grid; gap:8px; max-height:calc(100vh - 190px); overflow:auto; }
    .knowledge-item { display:grid; gap:7px; padding:10px; border:1px solid var(--line-soft); border-radius:8px; text-decoration:none; background:rgba(255,255,255,.025); }
    .knowledge-item.active { border-color:rgba(117,208,189,.55); background:rgba(117,208,189,.08); }
    .knowledge-item b { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .knowledge-item em { flex:0 0 auto; border-radius:999px; padding:2px 7px; color:#0b1210; background:var(--accent); font-style:normal; font-size:11px; }
    .item-meta { color:var(--muted); font-size:12px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .tags { display:flex; flex-wrap:wrap; gap:5px; } .tags span { border:1px solid var(--line-soft); border-radius:999px; padding:2px 7px; color:#cbd2da; background:rgba(255,255,255,.035); font-size:11px; }
    .kv-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; margin:10px 0; } .kv-grid.compact { grid-template-columns:repeat(4,minmax(0,1fr)); }
    .kv-grid span { display:grid; gap:3px; padding:8px; border:1px solid var(--line-soft); border-radius:7px; background:rgba(255,255,255,.025); min-width:0; }
    .kv-grid b { color:var(--faint); font-size:11px; } .kv-grid em { color:#dce3ea; font-style:normal; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .detail-copy { max-height:48vh; overflow:auto; border:1px solid var(--line-soft); border-radius:8px; padding:10px; background:rgba(255,255,255,.018); }
    .signal-block { display:grid; gap:8px; }
    .empty-state { border:1px dashed var(--line); border-radius:8px; padding:16px; color:var(--muted); background:rgba(255,255,255,.018); }
    .pipeline { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:8px; }
    .pipeline-step { min-width:0; display:grid; gap:6px; padding:10px; border:1px solid var(--line-soft); border-radius:8px; background:rgba(255,255,255,.024); } .pipeline-step span { width:9px; height:9px; border-radius:999px; background:var(--faint); } .pipeline-step.done span { background:var(--accent); box-shadow:0 0 14px rgba(117,208,189,.52); } .pipeline-step b { font-size:13px; } .pipeline-step small { color:var(--muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .pipeline-mini { display:grid; gap:6px; min-width:136px; } .pipeline-mini span { border:1px solid var(--line-soft); border-radius:999px; padding:4px 8px; color:var(--muted); font-size:11px; } .pipeline-mini span.done { color:var(--accent-strong); border-color:rgba(117,208,189,.42); }
    .run-options { margin-bottom:10px; } .run-options label { color:var(--muted); display:flex; align-items:center; gap:6px; }
    .issue-list { margin:0; padding-left:18px; color:var(--muted); display:grid; gap:8px; }
    .table-scroll { width:100%; max-width:100%; overflow:auto; } table { width:100%; border-collapse:collapse; min-width:560px; } th,td { text-align:left; padding:8px 9px; border-bottom:1px solid var(--line-soft); font-size:12px; vertical-align:top; overflow-wrap:anywhere; } th { color:var(--faint); font-weight:720; } td { color:#d5dbe2; } tr.active-row td { color:var(--accent-strong); }
    .code-block { max-height:280px; overflow:auto; margin:10px 0 0; padding:10px; border:1px solid var(--line-soft); border-radius:8px; background:#0b0e12; color:#cbd8ec; font:12px/1.55 "Cascadia Code","Consolas",monospace; white-space:pre-wrap; }
    .markdown-preview { display:grid; gap:10px; color:#d8dde3; } .markdown-preview h2,.markdown-preview h3,.markdown-preview h4,.markdown-preview h5 { margin:4px 0; } .markdown-preview p { margin:0; color:#cbd2da; } .markdown-table table { min-width:420px; }
    .confirm-dialog { width:min(420px,calc(100% - 32px)); border:1px solid var(--line); border-radius:8px; padding:0; background:var(--surface); color:var(--text); box-shadow:var(--shadow); } .confirm-dialog::backdrop { background:rgba(3,6,10,.66); } .dialog-inner { padding:18px; } .dialog-inner p { margin:0; color:var(--muted); font-size:13px; } .dialog-actions { display:flex; justify-content:flex-end; gap:8px; margin-top:18px; }
    ::view-transition-old(page-content), ::view-transition-new(page-content) { animation-duration:.18s; animation-timing-function:ease; }
    @media (max-width:1180px) { .metric-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } .card,.card-wide { grid-column:span 6; } .filter-bar { grid-template-columns:repeat(3,minmax(0,1fr)); } .page-grid.two,.split-view { grid-template-columns:1fr; } .knowledge-list { max-height:none; } }
    .data-table { width:100%; border-collapse:collapse; font-size:13px; } .data-table th,.data-table td { padding:9px 12px; text-align:left; border-bottom:1px solid var(--line-soft); } .data-table th { color:var(--muted); font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:.4px; background:rgba(255,255,255,.02); } .data-table td.num,.data-table th.num { text-align:right; font-variant-numeric:tabular-nums; } .data-table .empty { text-align:center; color:var(--faint); padding:28px 12px; } .data-table tbody tr:hover { background:rgba(117,208,189,.04); } .data-table .active-row { background:rgba(117,208,189,.06); } .data-table .active-row .model-name { color:var(--accent-strong); font-weight:700; } .data-table .dim-row { opacity:.45; } .data-table .dim-row:hover { opacity:.7; } .model-table td,.model-table th { padding:8px 10px; } .model-table .bar-col { width:120px; padding:0; } .model-table .bar-cell { padding:8px 4px 8px 0; } .token-bar { height:6px; border-radius:3px; background:linear-gradient(90deg,var(--accent),var(--orange)); min-width:2px; transition:width .3s ease; } .dim-row .token-bar { background:var(--line); } .role-tag { display:inline-block; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:600; } .role-default { background:rgba(117,208,189,.15); color:var(--accent-strong); } .role-fallback { background:rgba(241,204,119,.12); color:#f1cc77; }
    @media (prefers-reduced-motion: reduce) { .bg-grid,.bg-dots,.bg-glow,.bg-flow-lines { animation:none; } #agentCanvas { display:none; } button, .btn-link, .nav a, .knowledge-item, .language-switch a, select, input, .page-content, .route-progress { transition:none; } }
    @media (max-width:760px) { .app-shell,.sidebar-collapsed .app-shell { grid-template-columns:minmax(0,1fr); } .sidebar,.sidebar-collapsed .sidebar { position:relative; width:100%; max-width:100vw; height:auto; padding:12px; border-right:0; border-bottom:1px solid var(--line); overflow:hidden; } .brand { display:none; } .sidebar-toggle { display:none; } .nav { display:flex; overflow:auto; gap:6px; } .nav a,.sidebar-collapsed .nav a { flex:0 0 auto; justify-content:flex-start; padding:8px 10px; } .nav-short,.sidebar-collapsed .nav-short { display:none; } .nav-label,.sidebar-collapsed .nav-label { display:inline; } .workspace { width:100%; max-width:100vw; padding:14px; } .topbar { grid-template-columns:1fr; } .top-actions { justify-content:flex-start; } .metric-grid,.resource-grid,.page-grid.two,.pipeline,.kv-grid,.kv-grid.compact,.filter-bar { grid-template-columns:minmax(0,1fr); } .card,.card-wide { grid-column:1 / -1; } .card-body { grid-template-columns:1fr; } .spark-wrap,.disk-ring,.process-visual { justify-self:start; } table { min-width:100%; table-layout:fixed; } }
  </style>
</head>
<body>
  <div id="routeProgress" class="route-progress" aria-hidden="true"></div>
  <div class="agent-bg" aria-hidden="true">
    <div class="bg-grid"></div>
    <canvas id="agentCanvas"></canvas>
    <div class="bg-dots"></div>
    <div class="bg-glow"></div>
    <div class="bg-flow-lines"></div>
    <div class="bg-noise"></div>
  </div>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-copy"><b>Adgai</b><span>Private Ops Console</span></div>
        <button type="button" id="sidebarToggle" class="sidebar-toggle" aria-label="折叠侧边栏" title="折叠侧边栏">‹</button>
      </div>
      <nav class="nav" aria-label="primary">${parts.nav}</nav>
    </aside>
    <main class="workspace">
      <header class="topbar">
        <div class="breadcrumb">
          <span>${escapeHtml(parts.updated)}</span>
          <h1>${escapeHtml(parts.heading)}</h1>
        </div>
        <div class="top-actions">
          ${parts.topActions}
        </div>
      </header>
      <div id="pageContent" class="page-content">${parts.content}</div>
    </main>
  </div>
  <script>
    function initSidebar(){
      const root=document.documentElement;
      const button=document.getElementById('sidebarToggle');
      if(!button)return;
      function sync(){
        const collapsed=root.classList.contains('sidebar-collapsed');
        const title=collapsed?'展开侧边栏':'折叠侧边栏';
        button.setAttribute('aria-pressed',collapsed?'true':'false');
        button.setAttribute('aria-label',title);
        button.title=title;
      }
      button.addEventListener('click',function(){
        const collapsed=!root.classList.contains('sidebar-collapsed');
        root.classList.toggle('sidebar-collapsed',collapsed);
        try{localStorage.setItem('adgai.sidebar.collapsed',collapsed?'1':'0')}catch{}
        sync();
      });
      sync();
    }
    function initAgentBackground(){
      const canvas=document.getElementById('agentCanvas');
      const reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if(!canvas||reduce)return;
      const ctx=canvas.getContext('2d');
      if(!ctx)return;
      let width=0;
      let height=0;
      let points=[];
      let streams=[];
      let raf=0;
      function resize(){
        const dpr=Math.min(window.devicePixelRatio||1,2);
        width=window.innerWidth;
        height=window.innerHeight;
        canvas.width=Math.floor(width*dpr);
        canvas.height=Math.floor(height*dpr);
        canvas.style.width=width+'px';
        canvas.style.height=height+'px';
        ctx.setTransform(dpr,0,0,dpr,0,0);
        createPoints();
        createStreams();
      }
      function createPoints(){
        const count=Math.max(28,Math.min(96,Math.floor((width*height)/18000)));
        points=Array.from({length:count},function(){
          const zone=Math.random();
          let x=0;
          let y=0;
          if(zone<0.3){x=Math.random()*width*.42;y=height*.5+Math.random()*height*.42;}
          else if(zone<0.58){x=width*.6+Math.random()*width*.36;y=height*.5+Math.random()*height*.4;}
          else if(zone<0.8){x=width*.2+Math.random()*width*.6;y=height*.22+Math.random()*height*.5;}
          else{x=Math.random()*width;y=Math.random()*height*.38;}
          return {x:x,y:y,ox:x,oy:y,r:.6+Math.random()*1.2,vx:-.06+Math.random()*.12,vy:-.04+Math.random()*.08,phase:Math.random()*Math.PI*2,pulse:.35+Math.random()*.65};
        });
      }
      function createStreams(){
        const count=Math.max(8,Math.min(18,Math.floor(width/90)));
        streams=Array.from({length:count},function(){
          return {y:height*(.18+Math.random()*.68),x:Math.random()*width,speed:.28+Math.random()*.72,len:90+Math.random()*220,alpha:.035+Math.random()*.075,angle:-.16+Math.random()*.32,delay:Math.random()*1000};
        });
      }
      function drawHorizon(t){
        ctx.save();
        ctx.lineWidth=1;
        for(let i=0;i<24;i++){
          const y=height*(.77+i*.009);
          const alpha=Math.max(0,.09-i*.0036);
          ctx.strokeStyle='rgba(66,255,225,'+alpha+')';
          ctx.beginPath();
          ctx.moveTo(-120,y+Math.sin(t*.0005+i)*4);
          for(let x=-120;x<=width+120;x+=64){
            const wave=Math.sin(x*.004+t*.0008+i*.33)*12;
            const curve=-Math.pow((x-width*.5)/width,2)*64;
            ctx.lineTo(x,y+wave+curve);
          }
          ctx.stroke();
        }
        ctx.restore();
      }
      function drawStreams(t){
        ctx.save();
        ctx.globalCompositeOperation='screen';
        for(const s of streams){
          s.x+=s.speed;
          if(s.x>width+s.len+80)s.x=-s.len-Math.random()*width*.5;
          const x1=s.x;
          const y1=s.y+Math.sin(t*.001+s.delay)*13;
          const x2=x1+s.len;
          const y2=y1+Math.tan(s.angle)*s.len;
          const g=ctx.createLinearGradient(x1,y1,x2,y2);
          g.addColorStop(0,'rgba(66,255,225,0)');
          g.addColorStop(.45,'rgba(66,255,225,'+s.alpha+')');
          g.addColorStop(1,'rgba(66,255,225,0)');
          ctx.strokeStyle=g;
          ctx.lineWidth=1+s.alpha*5;
          ctx.beginPath();
          ctx.moveTo(x1,y1);
          ctx.lineTo(x2,y2);
          ctx.stroke();
        }
        ctx.restore();
      }
      function drawNetwork(t){
        for(const p of points){
          p.x+=p.vx;
          p.y+=p.vy;
          if(p.x<-50||p.x>width+50||p.y<-50||p.y>height+50){p.x=p.ox;p.y=p.oy;}
        }
        ctx.save();
        for(let i=0;i<points.length;i++){
          const a=points[i];
          for(let j=i+1;j<points.length;j++){
            const b=points[j];
            const dx=a.x-b.x;
            const dy=a.y-b.y;
            const dist=Math.sqrt(dx*dx+dy*dy);
            if(dist<118){
              const alpha=(1-dist/118)*.075;
              ctx.strokeStyle='rgba(64,255,225,'+alpha+')';
              ctx.lineWidth=.7;
              ctx.beginPath();
              ctx.moveTo(a.x,a.y);
              ctx.lineTo(b.x,b.y);
              ctx.stroke();
            }
          }
        }
        for(const p of points){
          const alpha=.18+Math.sin(t*.002+p.phase)*.08;
          ctx.fillStyle='rgba(80,255,230,'+alpha+')';
          ctx.shadowColor='rgba(80,255,230,.45)';
          ctx.shadowBlur=7*p.pulse;
          ctx.beginPath();
          ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
          ctx.fill();
        }
        ctx.restore();
      }
      function drawBeams(t){
        ctx.save();
        ctx.globalCompositeOperation='screen';
        const beams=[
          [width*.03,height*.86,width*.7,height*.84,.055],
          [width*.03,height*.86,width*.42,height*.64,.045],
          [width*.96,height*.92,width*.38,height*.84,.05],
          [width*.96,height*.92,width*.72,height*.62,.04]
        ];
        for(const beam of beams){
          const g=ctx.createLinearGradient(beam[0],beam[1],beam[2],beam[3]);
          g.addColorStop(0,'rgba(36,255,222,'+beam[4]+')');
          g.addColorStop(1,'rgba(36,255,222,0)');
          ctx.strokeStyle=g;
          ctx.lineWidth=1.1;
          ctx.beginPath();
          ctx.moveTo(beam[0],beam[1]);
          ctx.quadraticCurveTo((beam[0]+beam[2])/2+Math.sin(t*.0007)*18,(beam[1]+beam[3])/2-36,beam[2],beam[3]);
          ctx.stroke();
        }
        ctx.restore();
      }
      function animate(t){
        ctx.clearRect(0,0,width,height);
        drawHorizon(t);
        drawStreams(t);
        drawBeams(t);
        drawNetwork(t);
        raf=requestAnimationFrame(animate);
      }
      window.addEventListener('resize',resize,{passive:true});
      document.addEventListener('visibilitychange',function(){
        if(document.hidden){cancelAnimationFrame(raf);}
        else{raf=requestAnimationFrame(animate);}
      });
      resize();
      raf=requestAnimationFrame(animate);
    }
    function initSoftNavigation(){
      const reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      let controller=null;
      let routing=false;
      let routeId=0;
      let lastInteraction=Date.now();
      function isLocalRoute(href){
        try{
          const url=new URL(href,location.href);
          return url.origin===location.origin&&url.pathname==='/';
        }catch{return false;}
      }
      function cleanUrl(url){
        const next=new URL(url,location.href);
        next.searchParams.delete('partial');
        next.searchParams.delete('refresh');
        return next;
      }
      function fetchUrlFor(url,forceRefresh){
        const next=new URL(url,location.href);
        next.searchParams.set('partial','1');
        if(forceRefresh)next.searchParams.set('refresh','1');
        else next.searchParams.delete('refresh');
        return next;
      }
      function setBusy(active){
        document.body.classList.toggle('route-busy',active);
        if(!active){
          document.body.classList.add('route-done');
          window.setTimeout(function(){document.body.classList.remove('route-done');},180);
        }
      }
      function updateShell(payload){
        const nav=document.querySelector('.nav');
        const updated=document.querySelector('.breadcrumb span');
        const heading=document.querySelector('.breadcrumb h1');
        const topActions=document.querySelector('.top-actions');
        const page=document.getElementById('pageContent');
        if(!page)throw new Error('page content not found');
        if(payload.language)document.documentElement.lang=payload.language;
        if(payload.title)document.title=payload.title;
        if(nav&&payload.nav!==undefined)nav.innerHTML=payload.nav;
        if(updated)updated.textContent=payload.updated||'';
        if(heading)heading.textContent=payload.heading||'';
        if(topActions&&payload.topActions!==undefined)topActions.innerHTML=payload.topActions;
        if(payload.detailPanel){
          const panel=document.querySelector('.detail-panel');
          if(panel)panel.outerHTML=payload.detailPanel;
          const sel=String(new URL(location.href).searchParams.get('selected')||'');
          document.querySelectorAll('.knowledge-item').forEach(function(item,i){item.classList.toggle('active',String(i)===sel);});
        }else{
          page.innerHTML=payload.content||'';
        }
      }
      function swapPayload(payload,options){
        const page=document.getElementById('pageContent');
        if(!page||options.quiet||reduce){
          updateShell(payload);
          return Promise.resolve();
        }
        if(document.startViewTransition){
          return document.startViewTransition(function(){updateShell(payload);}).finished.catch(function(){});
        }
        page.classList.add('is-leaving');
        return new Promise(function(resolve){window.setTimeout(resolve,90);}).then(function(){
          updateShell(payload);
          const next=document.getElementById('pageContent');
          if(next){
            next.classList.add('is-entering');
            requestAnimationFrame(function(){next.classList.remove('is-entering');});
          }
        });
      }
      async function navigateTo(href,options){
        options=options||{};
        if(!isLocalRoute(href)){
          location.href=href;
          return;
        }
        if(controller)controller.abort();
        controller=new AbortController();
        const currentRoute=++routeId;
        const visible=cleanUrl(href);
        const fetchUrl=fetchUrlFor(visible.href,Boolean(options.refresh));
        const scrollY=window.scrollY;
        routing=true;
        if(!options.quiet)setBusy(true);
        try{
          const response=await fetch(fetchUrl.href,{headers:{Accept:'application/json','X-Adgai-Partial':'1'},signal:controller.signal});
          if(!response.ok)throw new Error('HTTP '+response.status);
          const payload=await response.json();
          const state={url:visible.href};
          if(options.replace)history.replaceState(state,'',visible.href);
          else if(visible.href!==location.href)history.pushState(state,'',visible.href);
          await swapPayload(payload,options);
          if(options.preserveScroll)window.scrollTo(0,scrollY);
          else window.scrollTo({top:0,behavior:reduce?'auto':'smooth'});
        }catch(error){
          if(error.name==='AbortError')return;
          location.href=visible.href;
        }finally{
          if(currentRoute===routeId){
            routing=false;
            if(!options.quiet)setBusy(false);
          }
        }
      }
      document.addEventListener('pointerdown',function(){lastInteraction=Date.now();},{passive:true});
      document.addEventListener('keydown',function(){lastInteraction=Date.now();},{passive:true});
      document.addEventListener('click',function(event){
        const link=event.target.closest&&event.target.closest('a[href]');
        if(!link||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
        if(link.target||link.hasAttribute('download')||link.dataset.noSoftNav!==undefined)return;
        if(!isLocalRoute(link.href))return;
        event.preventDefault();
        navigateTo(link.href,{replace:false});
      });
      document.addEventListener('submit',function(event){
        const form=event.target;
        if(!(form instanceof HTMLFormElement))return;
        const method=String(form.method||'get').toLowerCase();
        if(method!=='get')return;
        const action=new URL(form.getAttribute('action')||location.href,location.href);
        if(!isLocalRoute(action.href))return;
        event.preventDefault();
        const params=new URLSearchParams(new FormData(form));
        action.search=params.toString();
        navigateTo(action.href,{replace:false});
      });
      window.addEventListener('popstate',function(){navigateTo(location.href,{replace:true});});
      history.replaceState({url:location.href},'',location.href);
      window.setInterval(function(){
        const active=document.activeElement;
        if(document.hidden||routing||Date.now()-lastInteraction<5000)return;
        if(active&&/^(INPUT|SELECT|TEXTAREA)$/.test(active.tagName))return;
        navigateTo(location.href,{replace:true,quiet:true,preserveScroll:true,refresh:true});
      },60000);
    }
    initSidebar();
    initAgentBackground();
    initSoftNavigation();
  </script>
</body>
</html>`;
}

function sendResponse(response, status, body, contentType = 'text/html; charset=utf-8') {
  response.writeHead(status, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
    'Content-Security-Policy':
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(body);
}

function runOnce() {
  refreshSnapshotSync('once');
  console.log(`Private snapshot written: ${SNAPSHOT_PATH}`);
}

if (process.argv.includes('--once')) {
  runOnce();
} else {
  refreshSnapshotSync('startup');
  const server = http.createServer(async (request, response) => {
    // DNS rebinding / cross-origin protection: only accept loopback Host headers.
    const hostHeader = request.headers.host;
    if (!hostHeader || !ALLOWED_HOSTS.has(hostHeader)) {
      sendResponse(response, 403, 'Forbidden host', 'text/plain; charset=utf-8');
      return;
    }

    const url = new URL(request.url || '/', `http://${HOST}:${PORT}`);
    // OpenClaw is monitored here but managed by an external terminal, system task, or service.
    if (request.method === 'POST' && url.pathname === '/start-openclaw') {
      sendResponse(
        response,
        410,
        JSON.stringify({
          ok: false,
          error: 'OpenClaw Gateway control is disabled. It is managed outside the private console; this page only monitors health.',
        }),
        'application/json',
      );
      return;
    }

    if (request.method === 'POST' && url.pathname === '/kill') {
      sendResponse(
        response,
        410,
        JSON.stringify({
          ok: false,
          error: 'OpenClaw Gateway control is disabled. It is managed outside the private console; this page only monitors health.',
        }),
        'application/json',
      );
      return;
    }

    if (request.method === 'POST' && url.pathname === '/chat-collect/run') {
      sendResponse(
        response,
        410,
        JSON.stringify({
          ok: false,
          error: 'Knowledge collection and analysis are handled by OpenClaw. The private console only presents analyzed knowledge artifacts.',
        }),
        'application/json',
      );
      return;
    }
    // Default: render dashboard. Force refresh is rate-limited to prevent
    // sync-rebuild DoS: any extra ?refresh=1 within the window falls back to
    // cached snapshot + background async refresh.
    let force = url.searchParams.get('refresh') === '1';
    if (force) {
      const now = Date.now();
      if (now - lastForceRefreshAt < FORCE_REFRESH_RATE_LIMIT_MS) {
        force = false;
      } else {
        lastForceRefreshAt = now;
      }
    }
    const snapshot = getSnapshotForRequest(force);
    const wantsPartial = url.searchParams.get('partial') === '1' || request.headers['x-adgai-partial'] === '1';
    if (wantsPartial) {
      sendResponse(response, 200, JSON.stringify(renderWorkspaceParts(snapshot, request)), 'application/json');
      return;
    }
    sendResponse(response, 200, renderWorkspace(snapshot, request));
  });
  server.requestTimeout = 60000;
  server.headersTimeout = 10000;
  server.keepAliveTimeout = 5000;
  server.listen(PORT, HOST, () => {
    console.log(`Private console: http://${HOST}:${PORT}`);
    console.log(`Private snapshot: ${SNAPSHOT_PATH}`);
  });
}
