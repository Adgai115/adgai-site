# Adgai Site 开发步骤与搭建方案

> 适用根目录：`E:\Dev\adgai-site`
> 当前实现方式：Node.js ESM + 标准库、静态公开站、本地私有后台、allowlist 脱敏导出、WinSW Windows Service
> 默认语言：中文，英文作为一等切换项

## 1. 目标边界

本项目不是把公开站和私有资源后台混在一个应用里，而是在同一个仓库中维护三条边界清晰的链路：

| 模块 | 目录 | 当前职责 | 可否公网部署 |
| --- | --- | --- | --- |
| 公开站 | `public-site/` | 展示个人站、项目页、公开摘要和脱敏快照 | 可以 |
| 私有后台 | `private-console/` | 本机查看 OpenClaw 资源、Gateway 状态、知识产物、模型和服务进程 | 不可以直接公网部署 |
| 脱敏导出 | `exporter/` | 从私有快照生成公开快照，并扫描公开目录 | 不作为服务部署 |
| 安全文档 | `security/` | 发布规则和发布前检查清单 | 不作为站点内容部署 |
| 运维文档 | `docs/` | 搭建、运维、排障和回滚说明 | 仓库内维护 |

当前数据流固定为：

```text
E:\Dev\.openclaw
  -> private-console/snapshots/private_snapshot.json
  -> exporter/allowlist.json
  -> public-site/data/public_snapshot.json
  -> public-site/
```

公开站不能直接读取 `E:\Dev\.openclaw`、私有快照、日志、会话、备份、token、cookie 或内部端口。

## 2. 技术选型

当前实现刻意保持轻量：

- 运行时：Node.js，ESM 模块。
- 依赖：无第三方 npm 依赖，主要使用 Node 标准库。
- 公开站：静态 HTML/CSS/JS，使用 `public-site/server.mjs` 做本地预览。
- 私有后台：`private-console/dashboard-server.mjs` 自带 HTTP 服务，只绑定 `127.0.0.1:18666`。
- 脱敏导出：`exporter/export-public-snapshot.mjs` 按 allowlist 生成公开快照。
- 发布扫描：`exporter/scan-public-release.mjs` 扫描敏感路径、敏感词和不应发布的文件类型。
- 服务化：`private-console/service/*.ps1` + WinSW，把私有后台注册为 `AdgaiPrivateConsole` Windows Service。

这个选择的直接结果是：首次搭建不需要安装依赖，核心验证靠 `npm run build` 和 `npm run scan`。

## 3. 目录结构

```text
adgai-site/
  package.json
  README.md
  docs/
    operations-manual.md
    development-setup-plan.md
  public-site/
    index.html
    server.mjs
    assets/
      site.js
      styles.css
      resource-workbench.png
    data/
      public_snapshot.json
    projects/
      resource-console.html
      intelhub.html
      knowledge-automation.html
  private-console/
    dashboard-server.mjs
    service/
      AdgaiPrivateConsole.xml
      install-service.ps1
      uninstall-service.ps1
    snapshots/
      private_snapshot.json
    logs/
  exporter/
    allowlist.json
    redaction_rules.json
    export-public-snapshot.mjs
    scan-public-release.mjs
  scripts/
    generate-assets.mjs
  security/
    content-policy.md
    release-checklist.md
```

本地生成物不提交：

```text
private-console/snapshots/private_snapshot.json
private-console/logs/
private-console/service/*.exe
output/
.playwright-cli/
```

## 4. 本机搭建步骤

### 4.1 准备环境

确认路径和运行时：

```powershell
Test-Path 'E:\Dev\adgai-site'
Test-Path 'E:\Dev\.openclaw'
node --version
npm --version
```

如果要安装私有后台服务，还要确认服务脚本里的 Node 路径存在：

```powershell
Test-Path 'E:\Dev\nodejs\node.exe'
```

### 4.2 进入项目

```powershell
Set-Location 'E:\Dev\adgai-site'
```

当前无第三方依赖，不需要 `npm install`。如果后续引入依赖，再把依赖安装步骤写入本文件和 `README.md`。

### 4.3 生成一次完整构建

```powershell
npm run build
```

该命令按顺序执行：

```text
scripts/generate-assets.mjs
private-console/dashboard-server.mjs --once
exporter/export-public-snapshot.mjs
exporter/scan-public-release.mjs
```

成功后应产生或刷新：

```text
public-site/assets/resource-workbench.png
private-console/snapshots/private_snapshot.json
public-site/data/public_snapshot.json
```

### 4.4 启动公开站预览

```powershell
npm run public:serve
```

访问：

```text
http://127.0.0.1:8080/
```

### 4.5 启动私有后台

开发时可前台运行：

```powershell
npm run private:serve
```

长期本机运行建议安装服务。用管理员 PowerShell：

```powershell
Set-Location 'E:\Dev\adgai-site'
.\private-console\service\install-service.ps1
```

重装服务：

```powershell
.\private-console\service\install-service.ps1 -Reinstall
```

查看服务：

```powershell
Get-Service -Name AdgaiPrivateConsole
```

访问：

```text
http://127.0.0.1:18666/
```

## 5. 开发实施步骤

### 5.1 建立公开站骨架

实现文件：

```text
public-site/index.html
public-site/assets/styles.css
public-site/assets/site.js
public-site/projects/*.html
public-site/server.mjs
```

当前做法：

1. 首页和项目详情页保持静态 HTML。
2. `site.js` 负责读取 `public-site/data/public_snapshot.json` 并渲染公开摘要。
3. 中英文文案集中在 `site.js`，默认中文。
4. `?lang=zh-CN`、`?lang=en` 和 `localStorage` 共同处理公开站语言切换。
5. 本地预览服务只服务 `public-site/`，不暴露私有目录。

开发验证：

```powershell
npm run export
npm run scan
npm run public:serve
```

### 5.2 建立私有后台采集器

实现文件：

```text
private-console/dashboard-server.mjs
```

当前采集范围：

| 采集器 | 数据来源 | 用途 |
| --- | --- | --- |
| `disk` | `fs.statfsSync('E:\\')` | 展示 E 盘空间 |
| `gateway` | `netstat`、`tasklist`、`wmic`、`/health`、计划任务 | 展示 OpenClaw Gateway 状态 |
| `sessions` | `E:\Dev\.openclaw\agents\main\sessions` | 今日会话和 7 日趋势 |
| `diaries` | `E:\Dev\.openclaw\workspace\memory` | 日记数量和最近文件 |
| `models` | `E:\Dev\.openclaw\openclaw.json` | 默认模型、fallback 和可用模型 |
| `backups` | `E:\Dev\.openclaw\data\06-backup` | 最近备份 |
| `webchat` | 指定会话 JSONL | WebChat 统计 |
| `costs` | sessions JSONL | token、费用和模型拆解 |
| `agent` | sessions JSONL | 工具调用和活动状态 |
| `chatCollector` | `workspace\data\03-knowledge\chat-collect` | 知识、统计、报告 |

当前后台视图：

```text
?view=overview
?view=knowledge
?view=collector
?view=reports
?view=models
?view=services
?view=assets
```

实现要求：

1. 私有后台只绑定 `127.0.0.1`。
2. 响应头使用 `Cache-Control: no-store`。
3. 私有后台可以读取私有路径，但不能把原始私有数据写入公开站。
4. Gateway 控制接口保持禁用；`/start-openclaw`、`/kill`、`/chat-collect/run` 返回 HTTP `410`。
5. 快照超过 15 秒后由后台异步刷新；页面空闲时每 60 秒请求局部刷新。

开发验证：

```powershell
npm run private:once
npm run private:serve
```

浏览器检查：

```text
http://127.0.0.1:18666/?view=overview&lang=zh-CN
http://127.0.0.1:18666/?view=services&lang=zh-CN
http://127.0.0.1:18666/?view=reports&lang=en
```

### 5.3 建立脱敏导出链路

实现文件：

```text
exporter/allowlist.json
exporter/export-public-snapshot.mjs
exporter/redaction_rules.json
exporter/scan-public-release.mjs
```

当前规则：

1. `private_snapshot.json` 是私有事实源。
2. `allowlist.json` 决定哪些字段能进入 `public_snapshot.json`。
3. `export-public-snapshot.mjs` 只输出白名单字段。
4. `scan-public-release.mjs` 扫描 `public-site/`，阻断敏感词、敏感路径和敏感文件类型。

新增公开字段的步骤：

1. 先在 `private-console/dashboard-server.mjs` 采集并写入私有快照。
2. 判断该字段是否可以公开。
3. 在 `exporter/allowlist.json` 添加字段。
4. 执行 `npm run export`。
5. 检查 `public-site/data/public_snapshot.json`。
6. 执行 `npm run scan`。
7. 再改公开站渲染。

### 5.4 生成公开站资产

实现文件：

```text
scripts/generate-assets.mjs
```

当前 `npm run assets` 会生成公开站图片资产。开发中如果替换资产，需要保证：

1. 资产位于 `public-site/assets/`。
2. 公开页面引用的是公开资产路径。
3. 不把本地路径、私有截图或日志截图放入公开站。
4. 重新执行 `npm run scan`。

### 5.5 服务化私有后台

实现文件：

```text
private-console/service/AdgaiPrivateConsole.xml
private-console/service/install-service.ps1
private-console/service/uninstall-service.ps1
```

当前服务参数：

| 项 | 当前值 |
| --- | --- |
| 服务名 | `AdgaiPrivateConsole` |
| 工作目录 | `E:\Dev\adgai-site` |
| Node | `E:\Dev\nodejs\node.exe` |
| 启动脚本 | `E:\Dev\adgai-site\private-console\dashboard-server.mjs` |
| 监听地址 | `127.0.0.1:18666` |
| 启动模式 | Automatic |
| 日志目录 | `private-console/logs/` |

服务开发注意：

1. 修改服务 XML 后，用管理员 PowerShell 执行 `install-service.ps1 -Reinstall`。
2. 不提交 `AdgaiPrivateConsole.exe` 或 `WinSW-x64.exe`。
3. 不把服务绑定地址改为 `0.0.0.0`。
4. 服务只托管私有后台，不托管公开站。

## 6. 功能开发流程

### 6.1 修改公开站文案或布局

步骤：

```powershell
Set-Location 'E:\Dev\adgai-site'
```

1. 修改 `public-site/index.html`、`public-site/projects/*.html`、`public-site/assets/site.js` 或 `styles.css`。
2. 同步维护中文和英文文案。
3. 执行：

```powershell
npm run scan
npm run public:serve
```

4. 浏览器检查中文默认和英文切换。

### 6.2 增加私有后台视图

步骤：

1. 在 `PRIVATE_VIEWS` 中增加视图名。
2. 在 `viewLabels()` 中增加中英文标签。
3. 新增 `renderXxxPage()`。
4. 在 `renderPageContent()` 中接入。
5. 如果需要新数据，先在采集器里写入私有快照。
6. 执行：

```powershell
npm run private:once
npm run private:serve
```

7. 检查 `?partial=1&view=新视图&lang=zh-CN` 是否返回 JSON。

### 6.3 增加私有采集器

步骤：

1. 在 `dashboard-server.mjs` 新增 `collectXxx()`。
2. 采集失败时返回 `{ status: 'failed' | 'degraded', error: '...' }`，不要静默吞掉错误。
3. 在 `buildSnapshot()` 的 `resources` 或独立字段中接入。
4. 在相关视图中展示状态和错误。
5. 执行：

```powershell
npm run private:once
Get-Content '.\private-console\snapshots\private_snapshot.json' -Raw
```

6. 如果该数据要公开，再走 allowlist 导出流程。

### 6.4 增加公开数据字段

步骤：

1. 先确认字段不包含本地路径、私有端口、会话原文、日志、密钥或内部标识。
2. 在 `allowlist.json` 加字段。
3. 执行：

```powershell
npm run export
npm run scan
```

4. 检查：

```powershell
Get-Content '.\public-site\data\public_snapshot.json' -Raw
```

5. 再更新公开站渲染。

### 6.5 修改发布扫描规则

步骤：

1. 优先增加规则，不删除已有敏感规则。
2. 修改 `exporter/redaction_rules.json`。
3. 执行：

```powershell
npm run scan
```

4. 如果出现误报，优先改公开文案或公开数据，不要削弱扫描规则。

## 7. 验收标准

每次完成开发后至少执行：

```powershell
npm run build
git diff --check
```

公开站验收：

```powershell
$r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 -Uri 'http://127.0.0.1:8080/'
$r.StatusCode
$r.Content.Contains('lang="zh-CN"')
```

私有后台验收：

```powershell
$r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 -Uri 'http://127.0.0.1:18666/?view=services&lang=zh-CN'
$r.StatusCode
$r.Content.Contains('服务进程')
```

公开快照验收：

```powershell
npm run scan
Get-Content '.\public-site\data\public_snapshot.json' -Raw
```

服务验收：

```powershell
Get-Service -Name AdgaiPrivateConsole | Select-Object Name,Status,StartType
Get-Content -Tail 80 '.\private-console\logs\AdgaiPrivateConsole.wrapper.log'
```

## 8. 发布方案

发布对象只允许是：

```text
public-site/
```

发布前流程：

```powershell
Set-Location 'E:\Dev\adgai-site'
npm run build
npm run scan
```

人工检查：

- `public-site/` 下没有 `.env`、`.git`、`*.log`、`*.jsonl`。
- `public-site/data/public_snapshot.json` 只含公开字段。
- 没有 `E:\Dev\...` 这类本地路径。
- 没有 Feishu、WebChat、WeChat、session 原文或日志片段。
- 没有 API Key、Cookie、Token、Bearer、Secret。
- 没有部署 `private-console/`、`exporter/`、`security/`、`docs/`。

推荐部署关系：

```text
adgai.com -> public-site/
127.0.0.1:18666 -> private-console/dashboard-server.mjs
AdgaiPrivateConsole -> 本机 Windows Service
```

当前阶段不建议部署公网私有后台。确需远程访问时，应放在 VPN、Cloudflare Access 或同等级身份网关后，并继续保持后台绑定本机或内网地址。

## 9. 回滚方案

公开站改坏：

```powershell
git status --short
git diff
npm run build
npm run public:serve
```

私有后台改坏：

```powershell
npm run private:once
Restart-Service -Name AdgaiPrivateConsole
Get-Content -Tail 120 '.\private-console\logs\AdgaiPrivateConsole.err.log'
```

服务配置改坏：

```powershell
.\private-console\service\uninstall-service.ps1
.\private-console\service\install-service.ps1 -Reinstall
Get-Service -Name AdgaiPrivateConsole
```

公开数据误发布风险：

1. 立即停止发布流程。
2. 从 `public-site/` 移除可疑字段或文件。
3. 加强 `redaction_rules.json`。
4. 重新执行 `npm run build` 和 `npm run scan`。
5. 复核 `public_snapshot.json` 后再发布。

## 10. 后续扩展路径

建议按以下顺序扩展：

1. 先完善 `private_snapshot.json` 的私有事实模型。
2. 再通过 `allowlist.json` 明确哪些字段可公开。
3. 再更新公开站 UI。
4. 最后考虑部署、自动化或远程访问。

不建议现在做的事：

- 把私有后台并入公开站部署。
- 把 OpenClaw 原始目录作为静态目录暴露。
- 为了方便操作把 `/kill` 或 `/start-openclaw` 恢复成无认证控制接口。
- 在没有发布扫描的情况下直接上传 `public-site/`。
- 引入复杂框架前没有明确收益。
