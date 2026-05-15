# Adgai Site 运维手册

> 适用项目：`adgai-site`
> 当前形态：公开个人站 + 本地私有资源后台 + 脱敏导出器
> 默认语言：中文，支持切换英文
> 当前根目录：`E:\Dev\adgai-site`
> 私有后台推荐运行方式：Windows Service `AdgaiPrivateConsole`

## 1. 系统定位

`adgai-site` 分为三个运行边界：

| 边界 | 目录 | 作用 | 是否可公开部署 |
| --- | --- | --- | --- |
| 公开站 | `public-site/` | 个人网站、项目展示、公开文章、脱敏摘要 | 可以 |
| 私有资源站 | `private-console/` | 本地 OpenClaw 资源状态、采集器健康、私有快照 | 不可以直接公开 |
| 脱敏链路 | `exporter/` | 从私有快照生成公开快照，并扫描公开目录 | 不对外提供服务 |

安全原则：

```text
OpenClaw 私有数据
  -> private-console/snapshots/private_snapshot.json
  -> exporter allowlist
  -> public-site/data/public_snapshot.json
  -> 公开站
```

公开站不能直接读取 `E:\Dev\.openclaw`、会话、日志、备份、配置或任何私有运行目录。

## 2. 运行环境

当前项目使用 Node.js 标准库实现，无第三方 npm 依赖。

最低要求：

- Windows
- Node.js 可用
- npm 可用
- OpenClaw 本地目录存在：`E:\Dev\.openclaw`
- 私有后台服务脚本默认 Node 路径：`E:\Dev\nodejs\node.exe`

检查命令：

```powershell
node --version
npm --version
Test-Path 'E:\Dev\.openclaw'
Test-Path 'E:\Dev\nodejs\node.exe'
```

当前项目脚本见 `package.json`：

```powershell
npm run assets
npm run private:once
npm run export
npm run scan
npm run public:serve
npm run private:serve
npm run build
```

私有后台的服务化运行使用 WinSW 包装器：

```text
private-console/service/AdgaiPrivateConsole.xml
private-console/service/install-service.ps1
private-console/service/uninstall-service.ps1
```

`install-service.ps1` 会在需要时下载 `WinSW-x64.exe`，复制为 `AdgaiPrivateConsole.exe` 并注册服务。服务日志写入：

```text
private-console/logs/
```

本地快照、日志和服务 exe 已在 `.gitignore` 中排除；需要时重新生成，不要提交。

## 3. 端口与访问地址

| 服务 | 地址 | 说明 |
| --- | --- | --- |
| 公开站预览 | `http://127.0.0.1:8080/` | 默认中文，可右上角切英文 |
| 私有资源站 | `http://127.0.0.1:18666/` | 默认中文 |
| 私有资源站英文 | `http://127.0.0.1:18666/?lang=en` | 英文界面 |
| 私有后台服务 | `AdgaiPrivateConsole` | Windows Service，自动启动 |

私有资源站默认只绑定 `127.0.0.1`。不要改成 `0.0.0.0`，除非前面有 VPN 或身份网关。

私有资源站支持视图参数：

```text
?view=overview     总览
?view=knowledge    知识条目
?view=collector    知识产物
?view=reports      统计与报告
?view=models       模型队列
?view=services     服务进程
?view=assets       资产数据
```

可与语言参数组合，例如：

```text
http://127.0.0.1:18666/?view=services&lang=zh-CN
http://127.0.0.1:18666/?view=reports&lang=en
```

## 4. 常用启动流程

进入项目目录：

```powershell
Set-Location 'E:\Dev\adgai-site'
```

完整构建：

```powershell
npm run build
```

这个命令会依次执行：

1. 生成公开站图片资产。
2. 采集一次私有资源快照。
3. 导出公开脱敏快照。
4. 扫描公开站目录，阻断敏感内容。

推荐把私有后台作为 Windows Service 运行。首次安装或更新服务时，用管理员 PowerShell 执行：

```powershell
Set-Location 'E:\Dev\adgai-site'
.\private-console\service\install-service.ps1
```

重装服务：

```powershell
Set-Location 'E:\Dev\adgai-site'
.\private-console\service\install-service.ps1 -Reinstall
```

只安装不启动：

```powershell
.\private-console\service\install-service.ps1 -NoStart
```

查看服务状态：

```powershell
Get-Service -Name AdgaiPrivateConsole
```

前台启动公开站：

```powershell
npm run public:serve
```

前台启动私有资源站只用于临时开发。如果 Windows Service 正在运行，先停止服务或不要再启动前台进程，否则会占用同一个 `18666` 端口。

```powershell
npm run private:serve
```

后台启动公开站：

```powershell
$node = (Get-Command node.exe).Source
Start-Process -WindowStyle Hidden -FilePath $node -ArgumentList @('public-site/server.mjs') -WorkingDirectory 'E:\Dev\adgai-site'
```

如果不安装服务，也可以临时后台启动私有资源站：

```powershell
$node = (Get-Command node.exe).Source
Start-Process -WindowStyle Hidden -FilePath $node -ArgumentList @('private-console/dashboard-server.mjs') -WorkingDirectory 'E:\Dev\adgai-site'
```

## 5. 停止与重启

不要直接停止所有 `node.exe`，因为 OpenClaw Gateway 和其他本地工具也可能使用 Node。

私有后台服务的正常启停：

```powershell
Get-Service -Name AdgaiPrivateConsole
Restart-Service -Name AdgaiPrivateConsole
Stop-Service -Name AdgaiPrivateConsole
Start-Service -Name AdgaiPrivateConsole
```

服务模式下会看到 `AdgaiPrivateConsole.exe` 包装器和一个子 `node.exe`。优先通过服务控制，不要手工杀子进程。

查看 `18666` 端口占用：

```powershell
Get-NetTCPConnection -LocalPort 18666 -State Listen -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,OwningProcess
```

如果是临时前台或后台模式，查看本项目 Node 进程：

```powershell
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
  Where-Object { $_.CommandLine -like '*adgai-site*' } |
  Select-Object ProcessId,CommandLine
```

停止临时前台或后台进程：

```powershell
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
  Where-Object { $_.CommandLine -like '*adgai-site*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
```

重启建议顺序：

```powershell
npm run build
Restart-Service -Name AdgaiPrivateConsole
npm run public:serve
```

OpenClaw Gateway 不由私有后台启动或停止。`/start-openclaw`、`/kill` 和 `/chat-collect/run` 当前返回 HTTP `410`，私有后台只做监控和展示。Gateway 的启停应走 OpenClaw 自己的终端、计划任务或服务。

## 6. 健康检查

公开站 HTTP 检查：

```powershell
$r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 -Uri 'http://127.0.0.1:8080/'
$r.StatusCode
$r.Content.Contains('lang="zh-CN"')
```

私有资源站中文检查：

```powershell
$r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 -Uri 'http://127.0.0.1:18666/'
$r.StatusCode
$r.Content.Contains('Adgai 私有资源后台')
```

私有资源站英文检查：

```powershell
$r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 -Uri 'http://127.0.0.1:18666/?lang=en'
$r.StatusCode
$r.Content.Contains('Adgai Private Resource Console')
```

私有后台服务检查：

```powershell
Get-Service -Name AdgaiPrivateConsole | Select-Object Name,Status,StartType
Get-Content -Tail 80 '.\private-console\logs\AdgaiPrivateConsole.out.log'
Get-Content -Tail 80 '.\private-console\logs\AdgaiPrivateConsole.wrapper.log'
```

私有后台视图检查：

```powershell
$r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 -Uri 'http://127.0.0.1:18666/?view=services&lang=zh-CN'
$r.StatusCode
$r.Content.Contains('服务进程')
```

局部刷新接口检查：

```powershell
$r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 -Uri 'http://127.0.0.1:18666/?partial=1&view=services&lang=zh-CN'
($r.Content | ConvertFrom-Json).heading
```

私有快照检查：

```powershell
Get-Content '.\private-console\snapshots\private_snapshot.json' -Raw
```

重点看：

- `health.status` 是否为 `ok`
- `health.failed_collectors` 是否为空
- `resources.disk.free_gb` 是否合理
- `resources.gateway.process_count` 是否有值
- `resources.sessions.today_count` 是否有值
- `resources.costs.total_tokens`、`resources.agent.tool_calls` 是否能正常解析
- `chatCollector.status` 是否为 `ok` 或可解释的 `degraded`
- `snapshot_meta.refresh_error` 是否为空

公开快照检查：

```powershell
Get-Content '.\public-site\data\public_snapshot.json' -Raw
```

公开快照不应该出现本地路径、日志、会话、备份路径、密钥或私有端口。

## 7. 发布流程

发布对象只允许是：

```text
public-site/
```

发布前执行：

```powershell
npm run build
```

再执行一次扫描：

```powershell
npm run scan
```

手工核查：

- `public-site/` 下没有 `.env`、`.git`、`*.log`、`*.jsonl`。
- `public-site/data/public_snapshot.json` 只包含白名单字段。
- 没有 `E:\Dev\...` 这类本地路径。
- 没有 Feishu、WebChat、WeChat 原始内容。
- 没有 API Key、Cookie、Token、Bearer、Secret。
- 没有内部服务地址和私有端口。
- 没有把 `private-console/`、`exporter/`、`security/` 当作公开站部署内容。

部署建议：

```text
公开域名：adgai.com -> public-site/
私有域名：console.adgai.com -> 仅在 VPN / Cloudflare Access / 身份网关后使用
```

当前阶段私有资源站建议保持本地访问。

## 8. 内容维护

### 8.1 修改公开站首页文案

主要文件：

```text
public-site/index.html
public-site/assets/site.js
```

中文和英文文案集中在 `public-site/assets/site.js` 的 `COPY` 对象里。

修改后执行：

```powershell
npm run scan
```

### 8.2 修改项目卡片

项目数据来自：

```text
private-console/dashboard-server.mjs
```

位置：

```js
featured_projects
```

公开站显示的中英文名称和摘要来自：

```text
public-site/assets/site.js
```

位置：

```js
projectCopy
```

修改后执行：

```powershell
npm run build
```

### 8.3 修改项目详情页

项目详情页：

```text
public-site/projects/resource-console.html
public-site/projects/intelhub.html
public-site/projects/knowledge-automation.html
```

详情页中英文文案来自 `public-site/assets/site.js` 的 `projectPages`。

### 8.4 增加公开文章

当前版本未接入完整文章系统。短期做法：

1. 在 `private-console/dashboard-server.mjs` 的 `public_notes` 中增加候选。
2. 在 `exporter/allowlist.json` 中确认字段允许。
3. 执行 `npm run build`。
4. 检查 `public-site/data/public_snapshot.json`。
5. 执行 `npm run scan`。

长期建议把公开文章迁入独立目录，例如：

```text
public-site/notes/
```

并加 `visibility: public`、`reviewed: true` 等发布门禁。

### 8.5 维护私有后台视图

私有后台路由和页面渲染集中在：

```text
private-console/dashboard-server.mjs
```

主要入口：

| 视图 | 参数 | 作用 |
| --- | --- | --- |
| 总览 | `?view=overview` | Gateway、Token、知识、磁盘、会话概览 |
| 知识条目 | `?view=knowledge` | 查看 chat-collect 产出的知识条目，支持平台、标签、搜索过滤 |
| 知识产物 | `?view=collector` | 最近采集、知识 JSON、统计文件、日报状态 |
| 统计与报告 | `?view=reports` | 清洗统计、平台分布、贡献者排行、报告预览 |
| 模型队列 | `?view=models` | 默认模型、可用模型、fallback 队列 |
| 服务进程 | `?view=services` | OpenClaw Gateway 监听、健康检查、任务状态、进程明细 |
| 资产数据 | `?view=assets` | 备份、日记、最新知识条目 |

快照刷新规则：

- 服务启动时同步生成一次私有快照。
- 请求到来且快照超过 15 秒时，后台异步刷新。
- 页面在空闲状态下每 60 秒静默请求 `partial=1&refresh=1`。
- 手工强制刷新可访问 `http://127.0.0.1:18666/?refresh=1`。

知识产物读取路径来自 OpenClaw 工作区：

```text
E:\Dev\.openclaw\workspace\data\03-knowledge\chat-collect
```

如果知识视图为空，先确认 OpenClaw 的采集和分析任务是否已经产出 `knowledge`、`stats`、`report` 目录下的最新 JSON/Markdown。

## 9. 双语维护

公开站：

- 默认语言：中文。
- 切换方式：右上角 `中 / EN`。
- 状态保存：浏览器 `localStorage` 的 `adgai-language`。
- URL 参数：`?lang=zh-CN` 或 `?lang=en` 可覆盖当前语言。

私有资源站：

- 默认语言：中文。
- 中文：`http://127.0.0.1:18666/`
- 英文：`http://127.0.0.1:18666/?lang=en`
- 语言由服务端按 URL 参数渲染，不写入公开快照。

如果界面语言没有变化：

1. 刷新页面。
2. 检查浏览器 `localStorage` 是否保留旧语言。
3. 对私有资源站，确认旧 Node 进程已停止，新代码已启动。

## 10. 故障排查

### 10.1 端口拒绝连接

现象：

```text
由于目标计算机积极拒绝，无法连接。
```

检查进程：

```powershell
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
  Where-Object { $_.CommandLine -like '*adgai-site*' } |
  Select-Object ProcessId,CommandLine
```

处理：

```powershell
Get-Service -Name AdgaiPrivateConsole
Start-Service -Name AdgaiPrivateConsole
npm run public:serve
```

如果未安装服务，用 `npm run private:serve` 临时启动私有后台。

### 10.2 端口被旧进程占用

现象：

- 改了代码但页面仍是旧内容。
- 新进程启动后立刻退出。
- 私有资源站仍显示旧英文模板。

处理：

```powershell
Get-Service -Name AdgaiPrivateConsole -ErrorAction SilentlyContinue
Get-NetTCPConnection -LocalPort 18666 -State Listen -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,OwningProcess
```

如果已安装服务，优先重启服务：

```powershell
Restart-Service -Name AdgaiPrivateConsole
```

如果是临时 Node 进程，再停止本项目进程：

```powershell
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
  Where-Object { $_.CommandLine -like '*adgai-site*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
```

然后重新启动服务。

### 10.3 私有后台服务安装或重装失败

安装脚本需要管理员 PowerShell。先检查：

```powershell
Test-Path 'E:\Dev\adgai-site'
Test-Path 'E:\Dev\nodejs\node.exe'
Test-Path '.\private-console\service\AdgaiPrivateConsole.xml'
```

如果端口被占用：

```powershell
Get-NetTCPConnection -LocalPort 18666 -State Listen -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,OwningProcess
```

如果需要完全重装：

```powershell
.\private-console\service\uninstall-service.ps1
.\private-console\service\install-service.ps1 -Reinstall
```

查看服务日志：

```powershell
Get-Content -Tail 120 '.\private-console\logs\AdgaiPrivateConsole.wrapper.log'
Get-Content -Tail 120 '.\private-console\logs\AdgaiPrivateConsole.err.log'
```

### 10.4 控制接口返回 HTTP 410

这是当前设计，不是故障。私有后台只监控 OpenClaw Gateway，不直接启动、停止 Gateway，也不触发 chat-collect 任务。

相关接口：

```text
POST /start-openclaw
POST /kill
POST /chat-collect/run
```

如果需要操作 Gateway，使用 OpenClaw 自己的终端、计划任务或服务；不要把无认证的控制能力重新暴露在私有后台里。

### 10.5 OpenClaw Gateway 显示 `stopped`、`stalled` 或 `degraded`

私有后台会检查 `127.0.0.1:18789/health`、监听端口和计划任务 `OpenClaw Gateway`。处理顺序：

```powershell
Get-NetTCPConnection -LocalPort 18789 -State Listen -ErrorAction SilentlyContinue
Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 -Uri 'http://127.0.0.1:18789/health'
schtasks /query /tn 'OpenClaw Gateway' /fo list /v
```

如果 Gateway 未运行，按 OpenClaw 的运行手册启动 Gateway；私有后台服务本身不负责拉起它。

### 10.6 `npm run scan` 失败

原因通常是公开目录出现敏感词或敏感文件类型。

查看输出里的文件路径和命中的 pattern，然后处理：

- 如果是真泄露：从 `public-site/` 移除内容。
- 如果是公开页面中的安全说明误报：优先改写公开文案，把详细安全词汇放到 `security/` 文档里。
- 不要为了通过扫描而删除 `redaction_rules.json` 里的关键规则。

### 10.7 私有采集器降级

检查：

```powershell
npm run private:once
Get-Content '.\private-console\snapshots\private_snapshot.json' -Raw
```

常见原因：

| 采集器 | 可能原因 | 处理 |
| --- | --- | --- |
| `disk` | E 盘不可访问或 Node `statfsSync` 异常 | 检查磁盘挂载和权限 |
| `gateway` | PowerShell 不可用或 Node 进程查询失败 | 检查 PowerShell 路径和权限 |
| `sessions` | OpenClaw sessions 目录不存在 | 检查 `E:\Dev\.openclaw\agents\main\sessions` |
| `diaries` | memory 目录不存在 | 检查 `E:\Dev\.openclaw\workspace\memory` |
| `models` | `openclaw.json` 不存在或 JSON 解析失败 | 校验配置文件 |
| `backups` | backup 目录不存在 | 检查备份路径 |
| `webchat` | 指定 WebChat 会话文件不存在或格式变化 | 检查对应 sessions JSONL |
| `costs` | sessions 内容无法解析 token/cost | 检查最近 session 格式 |
| `agent` | sessions 目录缺失或 toolCall 结构变化 | 检查 agent session JSONL |

### 10.8 知识产物视图为空

检查 OpenClaw chat-collect 产物目录：

```powershell
Get-ChildItem 'E:\Dev\.openclaw\workspace\data\03-knowledge\chat-collect' -Recurse |
  Select-Object FullName,Length,LastWriteTime
```

然后强制刷新私有后台：

```powershell
Invoke-WebRequest -UseBasicParsing -TimeoutSec 10 -Uri 'http://127.0.0.1:18666/?refresh=1'
```

### 10.9 公开站数据显示 `snapshot missing`

检查文件是否存在：

```powershell
Test-Path '.\public-site\data\public_snapshot.json'
```

重新生成：

```powershell
npm run build
```

### 10.10 浏览器控制台报错

用 Playwright 或浏览器开发者工具检查。

常见问题：

- `favicon.ico` 404：确认 `public-site/favicon.svg` 存在，HTML 有 favicon 链接。
- `public_snapshot.json` 404：执行 `npm run export` 或 `npm run build`。
- JS 语法错误：检查 `public-site/assets/site.js`。

## 11. 安全操作规范

禁止操作：

- 把 `private-console/` 作为公网目录部署。
- 把 `private_snapshot.json` 发布到公开站。
- 把 `E:\Dev\.openclaw` 放入静态站根目录。
- 在公开站里写真实日志、会话、路径、密钥、内部端口。
- 直接停止所有 `node.exe`。
- 把 `/kill`、`/start-openclaw`、`/chat-collect/run` 改回无认证控制接口。
- 提交 `private-console/logs/`、`private-console/snapshots/private_snapshot.json` 或 `private-console/service/*.exe`。

允许操作：

- 发布 `public-site/`。
- 编辑 `public-site/assets/site.js` 中的公开文案。
- 通过 `exporter/allowlist.json` 增加可公开字段。
- 通过 `exporter/redaction_rules.json` 增加阻断规则。
- 在本机安装或重装 `AdgaiPrivateConsole` 服务。
- 查看私有后台日志和私有快照，但不要发布这些文件。

变更安全规则：

1. 优先增加阻断规则。
2. 不要删除已有敏感词规则。
3. 每次改规则后执行 `npm run scan`。
4. 每次发布前复核 `public-site/data/public_snapshot.json`。

## 12. 回滚

如果公开站改坏：

1. 停止本项目 Node 服务。
2. 回到上一个可用 Git 版本或恢复对应文件。
3. 执行：

```powershell
npm run build
```

4. 重新启动公开站。
5. 检查：

```powershell
Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 -Uri 'http://127.0.0.1:8080/'
```

如果私有资源站改坏：

1. 停止本项目私有后台进程。
2. 恢复 `private-console/dashboard-server.mjs`。
3. 执行：

```powershell
npm run private:once
npm run private:serve
```

4. 检查中文和英文地址。

## 13. 日常维护节奏

每日或每次改动后：

```powershell
npm run build
```

发布前：

```powershell
npm run scan
```

服务健康检查：

```powershell
Get-Service -Name AdgaiPrivateConsole
Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 -Uri 'http://127.0.0.1:8080/'
Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 -Uri 'http://127.0.0.1:18666/'
```

私有后台日志检查：

```powershell
Get-Content -Tail 80 '.\private-console\logs\AdgaiPrivateConsole.out.log'
Get-Content -Tail 80 '.\private-console\logs\AdgaiPrivateConsole.wrapper.log'
```

每周建议：

- 检查 `redaction_rules.json` 是否需要增加新敏感词。
- 检查公开项目文案是否过期。
- 检查私有采集器是否长期 `ok`。
- 检查公开快照是否仍然只包含必要字段。
- 检查 `AdgaiPrivateConsole` 服务是否仍为 `Automatic` 且运行中。
- 检查 `private-console/logs/` 是否有持续增长的错误日志。

## 14. 关键文件索引

| 文件 | 用途 |
| --- | --- |
| `package.json` | 运维脚本入口 |
| `public-site/index.html` | 公开站首页结构 |
| `public-site/assets/site.js` | 公开站中英文文案、语言切换、快照渲染 |
| `public-site/assets/styles.css` | 公开站样式 |
| `public-site/server.mjs` | 公开站本地预览服务 |
| `private-console/dashboard-server.mjs` | 私有资源站采集、快照刷新、多视图渲染、双语 |
| `private-console/service/AdgaiPrivateConsole.xml` | Windows Service 配置 |
| `private-console/service/install-service.ps1` | 安装、重装并启动私有后台服务 |
| `private-console/service/uninstall-service.ps1` | 卸载私有后台服务 |
| `private-console/logs/` | 私有后台服务日志，本地生成，不提交 |
| `private-console/snapshots/private_snapshot.json` | 私有快照，本地生成，不发布 |
| `exporter/export-public-snapshot.mjs` | 私有快照到公开快照的脱敏导出 |
| `exporter/allowlist.json` | 公开字段白名单 |
| `exporter/redaction_rules.json` | 敏感内容阻断规则 |
| `exporter/scan-public-release.mjs` | 公开发布扫描 |
| `security/content-policy.md` | 内容发布安全策略 |
| `security/release-checklist.md` | 发布前检查清单 |
