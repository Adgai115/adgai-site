# Adgai 公开站重建计划

> 时间：2026-05-15 | 基于纯 HTML/CSS/JS，零 npm 依赖

## 🎯 目标

用两份参考文件 + 4 个精选案例的精华，重写 `public-site/`。

## 📐 技术约束

- ✅ 纯 HTML/CSS/JS，零框架
- ✅ 保留双语 i18n（`data-i18n` + site.js COPY 对象）
- ✅ 保留数据边界（`public_snapshot.json`）
- ✅ 零 npm 依赖（anime.js 也不加，纯 CSS 动画）
- ✅ 保留 `npm run build` 构建流程

## 🎨 设计系统

### 配色
```css
--bg:       #030807   最深黑绿
--surface:  #0a1a14   卡片底色
--text:     #f0fdf4   正文
--muted:    #6b7c76   次级文字
--accent:   #10b981   翠绿强调
--accent-glow: #34d399 发光
--line:     rgba(255,255,255,.07)
```

### 字体
- 标题：系统字体堆栈，`letter-spacing: -0.06em`
- 正文：16px/1.7
- 英文数字：`font-mono`（Consolas/等宽）

### 动效原则
- 入场：渐显 + 上移（`opacity + translateY`）
- 滚动触发：Intersection Observer → 添加 `.is-visible` 类
- 悬停：`translateY(-2px)` + 边框发光
- Canvas 背景：网格 + 粒子 + 鼠标辉光

---

## 📁 新文件结构

```
public-site/
├── index.html          ← 唯一页面（SPA 锚点导航）
├── favicon.svg         ← 保留现有
├── server.mjs          ← 不动
├── data/
│   └── public_snapshot.json  ← 不动
├── assets/
│   ├── site.js         ← 重写：双语 + 渲染 + Canvas + 动效
│   ├── styles.css      ← 重写：暗色主题全量 CSS
│   └── resource-workbench.png ← 可选替换
└── projects/
    ├── resource-console.html   ← 不动
    ├── intelhub.html           ← 不动
    └── knowledge-automation.html ← 不动
```

---

## 🧩 页面模块（从上到下）

### 1. Loader（参考文件 1 + Brittany Chiang）
```
📍 位置：<body> 第一个子元素
🎬 效果：SVG Logo 描边 → 填充发光 → 缩小淡出
⏱️ 时序：~2.5s 总时长
📋 内容：
  - SVG "A" Logo（描边绘制 1.3s）
  - "ADGAI" 文字（延迟浮现 1.1s）
  - 流光进度条（0.6s 后开始，1.4s 扫过）
  - 整体缩小淡出（2.2s 后）
  - 页面从下方浮入（body.is-ready）
🔁 sessionStorage 防刷新重复
♿ prefers-reduced-motion 支持
```

### 2. Canvas 背景（参考文件 2）
```
📍 位置：<canvas id="bgCanvas">，z-index: -20
🎬 效果：
  - 深黑绿底
  - 网格线（64px 间距，缓慢漂移）
  - 粒子（~100 个，随机漂浮，同组连线）
  - 鼠标跟随辉光（径向渐变跟随 pointer）
  - 顶部径向辉光
  - CSS 噪点叠加层
📐 JS 实现：
  - initBackground(canvas)
  - requestAnimationFrame 循环
  - resize 监听
  - pointermove 监听
```

### 3. Header（参考文件 2）
```
📍 位置：<header>，sticky，z-index: 30
🎨 样式：毛玻璃 backdrop-blur，底部细线边框
📋 内容：
  - 左：Adgai（brand）
  - 中：导航 [项目] [文章] [近况] [关于]（锚点链接）
  - 右：中/EN 语言切换按钮
✨ 动效：页面加载后延迟 1.55s 从上方滑入
```

### 4. Hero（参考文件 2 + Kent C. Dodds）
```
📍 位置：<section id="top">
📐 布局：2 列 grid（左文右面板），min-h: calc(100vh - 4rem)
📋 左列：
  - Eyebrow：细线 + "本地优先的 AI 系统"
  - h1："把私人工作沉淀成公开成果的个人 AI 基础设施"
    「AI」二字渐变翠绿
  - p：简介文案
  - 2 个 CTA 按钮：查看项目（实心绿）/ 了解更多（描边）
  - 底部：🟢 最近更新：日期
📋 右列：系统状态面板
  - 玻璃卡片 + 顶部渐变线
  - 流光扫过动画
  - 标题行 + ONLINE 徽标（脉冲绿点）
  - 4 行指标（项目数、文章数、更新频率、运行时长）
  - SVG 路径动画图表
✨ 动效：
  - 文字延迟浮现（stagger 1.82s ~ 2.45s）
  - 视差滚动（useTransform 式 CSS translate）
  - 状态面板悬停上浮
```

### 5. Projects（参考 Max Böck + 文件 2）
```
📍 位置：<section id="项目">
📐 布局：3 列 grid
📋 数据源：public_snapshot.featured_projects
🎨 卡片样式：
  - 玻璃底 border-white/10
  - 顶部渐变线
  - 图标 + 标题 + 状态徽标
  - 描述
  - 3 个指标（key-value）
✨ 动效：
  - 滚动入视口时逐个浮现（Intersection Observer）
  - 悬停：translateY(-4px) + 边框翠绿发光
  - 状态灯脉动
```

### 6. Notes（参考 Max Böck + Eugene Yan）
```
📍 位置：<section id="文章">
📐 布局：左侧日期竖排 + 右侧内容
📋 数据源：public_snapshot.public_notes
🎨 样式：
  - 时间轴式列表
  - 每行：日期 ｜ 标题 ｜ 标签 ｜ 摘要
  - 悬停整行高亮
  - 空态："还没有公开文章"
✨ 动效：滚动入视口时行逐条浮现
```

### 7. Now（参考文件 2）
```
📍 位置：<section id="近况">
📐 布局：2 列
📋 左：当前关注列表
  - 轨道环动画（SVG 旋转圆环）
  - 3 个条目：图标 + 标题 + 描述
📋 右：发布流程说明
  - 安全模型 3 列
✨ 动效：轨道环旋转 + 条目渐显
```

### 8. About（参考文件 2 + Kent C. Dodds）
```
📍 位置：<section id="关于">
📐 布局：2 列（文字 + 订阅）
📋 左：关于描述
📋 右：订阅表单（可选）
```

### 9. Footer（参考文件 2 + Kent C. Dodds）
```
📍 位置：<footer>
📐 布局：4 列网格
📋 内容：
  - 品牌 + 简介
  - 导航链接
  - 资源链接
  - 社交媒体图标
📋 底部：© 2026 Adgai · 公开站由脱敏数据生成
```

---

## 📝 实施步骤

### Phase 1：基础框架
- [ ] 重写 `styles.css`（CSS 变量 + 暗色主题 + 全局样式 + 响应式）
- [ ] 创建 `index.html` 骨架（所有 section 的 HTML 结构）
- [ ] 实现 Canvas 背景（`site.js` 中的 `initBackground()`）

### Phase 2：加载动画 + Hero
- [ ] Loader：SVG 描边 + 发光 + 淡出
- [ ] Header：毛玻璃 + 导航 + 语言切换
- [ ] Hero：左文右面板，延迟浮现动效

### Phase 3：内容区
- [ ] Projects：卡片网格 + 快照数据渲染
- [ ] Notes：时间轴列表 + 快照数据渲染
- [ ] Now：关注列表 + 安全模型
- [ ] About + Footer

### Phase 4：动效 + 打磨
- [ ] Intersection Observer 滚动入场
- [ ] 悬停交互
- [ ] 双语切换
- [ ] 响应式适配
- [ ] prefers-reduced-motion

### Phase 5：测试 + 发布
- [ ] `npm run build` 全流程验证
- [ ] `npm run scan` 安全扫描
- [ ] 浏览器测试（Chrome/Firefox/Edge）

---

## ⚠️ 风险点

| 风险 | 应对 |
|------|------|
| Canvas 性能 | 限制粒子数、dpr ≤ 2、RAF 节流 |
| 双语维护成本 | COPY 对象保持扁平化，一键切换 |
| 快照数据为空 | 每种渲染函数都有 empty state |
| 移动端适配 | 2 级断点（900px / 640px） |
