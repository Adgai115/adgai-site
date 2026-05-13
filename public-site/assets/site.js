const LANGUAGES = ['zh-CN', 'en'];
const DEFAULT_LANGUAGE = 'zh-CN';

const COPY = {
  'zh-CN': {
    pageTitles: {
      home: 'Adgai - AI 系统与知识自动化',
      'project-resource-console': 'OpenClaw 资源后台 - Adgai',
      'project-intelhub': 'IntelHub - Adgai',
      'project-knowledge-automation': '知识自动化 - Adgai',
    },
    description: 'Adgai 构建本地优先的 AI 系统、资源编排工具和知识自动化工作流。',
    nav: {
      projects: '项目',
      notes: '文章',
      now: '近况',
      security: '安全',
      home: '首页',
    },
    home: {
      heroEyebrow: '本地优先的 AI 系统',
      heroTitle: '把私人工作沉淀成公开成果的个人 AI 基础设施。',
      heroLead: '这里展示经过筛选的项目、文章和工作原则。实时资源后台保持私有；公开站只读取脱敏后的发布数据。',
      viewProjects: '查看项目',
      securityModel: '安全模型',
      heroImageAlt: '私有 AI 资源工作台的抽象预览，包含面板和状态区。',
      heroCaption: '公开版脱敏预览。运行细节仍保持私有。',
      metricsAria: '公开指标',
    },
    metrics: {
      projects: '项目',
      notes: '公开文章',
      console: '资源后台',
      updated: '更新',
      localOnly: '仅本地',
      snapshotMissing: '快照缺失',
    },
    projects: {
      eyebrow: '精选工作',
      title: '项目',
      loadingStatus: '加载中',
      loadingTitle: '正在加载项目',
      loadingText: '正在读取脱敏后的公开快照。',
    },
    now: {
      eyebrow: '近况',
      title: '当前关注',
      focus: ['AI 资源编排', '本地优先的个人知识系统', '把私有工作转化为公开成果的自动化流程'],
      policyTitle: '以私有为默认的发布流程',
      policyText: '私有采集器可以读取本地运行数据。公开站只接收经过字段白名单、脱敏和发布扫描后的摘要。',
    },
    notes: {
      eyebrow: '写作',
      title: '公开文章',
      empty: '还没有导出通过审核的公开文章。',
    },
    security: {
      eyebrow: '边界',
      title: '安全模型',
      originTitle: '独立来源',
      originText: '公开内容放在公开域名；私有操作留在本机、VPN 或身份网关保护的子域名。',
      allowlistTitle: '白名单导出',
      allowlistText: '公开数据只从小范围字段白名单生成。本站不会直接读取 OpenClaw 原始数据。',
      scanTitle: '发布扫描',
      scanText: '自动检查会在部署前拦截本地路径、原始会话、日志、凭据和其他敏感字符串。',
    },
    footer: {
      note: '公开站由脱敏数据生成。',
    },
    status: {
      'private alpha': '私有 Alpha',
      active: '活跃',
      building: '建设中',
      loading: '加载中',
    },
    projectCopy: {
      'openclaw-resource-console': {
        name: 'OpenClaw 资源后台',
        summary: '面向 AI 模型、工具、任务和知识产出的本地优先运行工作台。',
      },
      intelhub: {
        name: 'IntelHub',
        summary: '面向固定来源和简报的结构化情报采集工作流。',
      },
      'knowledge-automation': {
        name: '知识自动化',
        summary: '把审核后的私人笔记提升为公开成果的发布流水线。',
      },
    },
    projectPages: {
      resource: {
        eyebrow: '项目',
        title: 'OpenClaw 资源后台',
        lead: '面向 AI 模型、工具、计划任务和知识产出的本地优先运行工作台。公开版本只描述方法，不暴露私有资源状态。',
        principlesTitle: '原则',
        principlesText: '运行数据保留在本地，只导出审核后的摘要，并显式展示采集的新鲜度。',
        boundaryTitle: '公开边界',
        boundaryText: '这个项目页不会展示实时进程数、私有路径、日志或原始自动化输出。',
      },
      intelhub: {
        eyebrow: '项目',
        title: 'IntelHub',
        lead: '面向周期性采集、审阅和综合分析的结构化情报工作流。',
        focusTitle: '重点',
        focusText: '强调来源纪律、可重复简报，以及把私人研究循环转化为可发布结论。',
      },
      knowledge: {
        eyebrow: '项目',
        title: '知识自动化',
        lead: '通过明确发布门禁，把审核后的私人笔记提升为公开页面的发布流水线。',
        disciplineTitle: '发布纪律',
        disciplineText: '私人笔记需要可见性标签、审核标记、白名单导出和扫描，才能成为公开成果。',
      },
    },
  },
  en: {
    pageTitles: {
      home: 'Adgai - AI Systems and Knowledge Automation',
      'project-resource-console': 'OpenClaw Resource Console - Adgai',
      'project-intelhub': 'IntelHub - Adgai',
      'project-knowledge-automation': 'Knowledge Automation - Adgai',
    },
    description: 'Adgai builds local-first AI systems, resource orchestration tools, and knowledge automation workflows.',
    nav: {
      projects: 'Projects',
      notes: 'Notes',
      now: 'Now',
      security: 'Security',
      home: 'Home',
    },
    home: {
      heroEyebrow: 'Local-first AI systems',
      heroTitle: 'Personal AI infrastructure that turns private work into public artifacts.',
      heroLead: 'A public surface for selected projects, writing, and operating principles. The live resource console stays private; this site only reads sanitized release data.',
      viewProjects: 'View Projects',
      securityModel: 'Security Model',
      heroImageAlt: 'Abstract view of a private AI resource workbench with panels and status lanes.',
      heroCaption: 'Sanitized public preview. Operational details remain private.',
      metricsAria: 'Public metrics',
    },
    metrics: {
      projects: 'Projects',
      notes: 'Public Notes',
      console: 'Console',
      updated: 'Updated',
      localOnly: 'local-only',
      snapshotMissing: 'snapshot missing',
    },
    projects: {
      eyebrow: 'Selected work',
      title: 'Projects',
      loadingStatus: 'loading',
      loadingTitle: 'Loading projects',
      loadingText: 'Reading sanitized public snapshot.',
    },
    now: {
      eyebrow: 'Now',
      title: 'Current focus',
      focus: ['AI resource orchestration', 'local-first personal knowledge systems', 'automation that turns private work into public artifacts'],
      policyTitle: 'Private-by-design publishing',
      policyText: 'Private collectors can read local operational data. The public site receives only an allowlisted summary after redaction and release scanning.',
    },
    notes: {
      eyebrow: 'Writing',
      title: 'Public notes',
      empty: 'No reviewed public notes have been exported yet.',
    },
    security: {
      eyebrow: 'Boundary',
      title: 'Security model',
      originTitle: 'Separate origins',
      originText: 'Public content belongs on the public domain. Private operations belong on localhost, VPN, or an identity-aware subdomain.',
      allowlistTitle: 'Allowlist exports',
      allowlistText: 'Public data is generated from a small field allowlist. Raw OpenClaw data is never read by this site.',
      scanTitle: 'Release scanning',
      scanText: 'Automated checks block local paths, raw sessions, logs, credentials, and other sensitive strings before deployment.',
    },
    footer: {
      note: 'Public site generated from sanitized data.',
    },
    status: {
      'private alpha': 'private alpha',
      active: 'active',
      building: 'building',
      loading: 'loading',
    },
    projectCopy: {
      'openclaw-resource-console': {
        name: 'OpenClaw Resource Console',
        summary: 'A local-first operations surface for AI models, tools, tasks, and knowledge output.',
      },
      intelhub: {
        name: 'IntelHub',
        summary: 'A structured intelligence collection workflow for recurring sources and briefings.',
      },
      'knowledge-automation': {
        name: 'Knowledge Automation',
        summary: 'A publishing pipeline that promotes reviewed private notes into public artifacts.',
      },
    },
    projectPages: {
      resource: {
        eyebrow: 'Project',
        title: 'OpenClaw Resource Console',
        lead: 'A local-first operational console for AI models, tools, scheduled work, and knowledge output. The public version describes the approach without exposing private resource state.',
        principlesTitle: 'Principles',
        principlesText: 'Keep operational data local, export only reviewed summaries, and make collection freshness visible.',
        boundaryTitle: 'Public boundary',
        boundaryText: 'This project page intentionally avoids live process counts, private paths, logs, and raw automation outputs.',
      },
      intelhub: {
        eyebrow: 'Project',
        title: 'IntelHub',
        lead: 'A structured intelligence workflow for recurring collection, review, and synthesis.',
        focusTitle: 'Focus',
        focusText: 'Source discipline, repeatable briefings, and converting private research loops into publishable conclusions.',
      },
      knowledge: {
        eyebrow: 'Project',
        title: 'Knowledge Automation',
        lead: 'A publishing pipeline that promotes reviewed private notes into public pages through explicit gates.',
        disciplineTitle: 'Release discipline',
        disciplineText: 'Private notes need visibility tags, review flags, allowlist export, and scanning before they become public artifacts.',
      },
    },
  },
};

let snapshotData = null;

function getNestedValue(object, key) {
  return key.split('.').reduce((current, part) => current?.[part], object);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function safeUrl(value) {
  return typeof value === 'string' && value.startsWith('/') ? value : '';
}

function getLanguage() {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get('lang');
  if (LANGUAGES.includes(requested)) {
    localStorage.setItem('adgai-language', requested);
    return requested;
  }
  const stored = localStorage.getItem('adgai-language');
  return LANGUAGES.includes(stored) ? stored : DEFAULT_LANGUAGE;
}

function setLanguage(language) {
  localStorage.setItem('adgai-language', language);
  applyLanguage(language);
}

function localizeStatus(value, language) {
  const key = String(value || 'active').toLowerCase();
  return COPY[language].status[key] || value || COPY[language].status.active;
}

function localizeConsoleStatus(value, language) {
  if (String(value).toLowerCase() === 'local-only') return COPY[language].metrics.localOnly;
  return value || COPY[language].metrics.localOnly;
}

function renderProjects(projects, language) {
  const target = document.querySelector('[data-projects]');
  if (!target || !Array.isArray(projects) || projects.length === 0) return;

  target.innerHTML = projects.map((project) => {
    const copy = COPY[language].projectCopy[project.slug] || {};
    const name = copy.name || project.name || '';
    const summary = copy.summary || project.summary || '';
    const href = safeUrl(project.public_url);
    return `
      <article class="project-card">
        <span class="status">${escapeHtml(localizeStatus(project.status, language))}</span>
        <h3>${href ? `<a href="${escapeHtml(href)}">${escapeHtml(name)}</a>` : escapeHtml(name)}</h3>
        <p>${escapeHtml(summary)}</p>
      </article>
    `;
  }).join('');
}

function renderFocus(language) {
  const target = document.querySelector('[data-focus]');
  if (!target) return;
  target.innerHTML = COPY[language].now.focus.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
}

function renderNotes(notes, language) {
  const target = document.querySelector('[data-notes]');
  if (!target) return;

  if (!Array.isArray(notes) || notes.length === 0) {
    target.innerHTML = `<p class="muted">${escapeHtml(COPY[language].notes.empty)}</p>`;
    return;
  }

  target.innerHTML = notes.map((note) => `
    <article class="note-row">
      <strong>${escapeHtml(note.title || '')}</strong>
      <span class="muted">${escapeHtml(note.date || '')}</span>
      <p>${escapeHtml(note.summary || '')}</p>
    </article>
  `).join('');
}

function renderMetrics(snapshot, language) {
  const metrics = snapshot?.public_metrics || {};
  setMetric('project_count', metrics.project_count ?? '-');
  setMetric('public_note_count', metrics.public_note_count ?? '-');
  setMetric('resource_console_status', localizeConsoleStatus(metrics.resource_console_status, language));
  setMetric('last_public_update', metrics.last_public_update ?? '-');
}

function setMetric(name, value) {
  document.querySelectorAll(`[data-metric="${name}"]`).forEach((node) => {
    node.textContent = value;
  });
}

function applyStaticTranslations(language) {
  const copy = COPY[language];
  document.documentElement.lang = language;
  document.title = copy.pageTitles[document.body.dataset.page] || copy.pageTitles.home;

  const description = document.querySelector('meta[name="description"]');
  if (description) description.setAttribute('content', copy.description);

  document.querySelectorAll('[data-i18n]').forEach((node) => {
    const value = getNestedValue(copy, node.dataset.i18n);
    if (value) node.textContent = value;
  });

  document.querySelectorAll('[data-i18n-alt]').forEach((node) => {
    const value = getNestedValue(copy, node.dataset.i18nAlt);
    if (value) node.setAttribute('alt', value);
  });

  document.querySelectorAll('[data-i18n-aria-label]').forEach((node) => {
    const value = getNestedValue(copy, node.dataset.i18nAriaLabel);
    if (value) node.setAttribute('aria-label', value);
  });

  document.querySelectorAll('[data-lang-option]').forEach((button) => {
    const active = button.dataset.langOption === language;
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
    button.classList.toggle('active', active);
  });
}

function applyLanguage(language) {
  applyStaticTranslations(language);
  renderMetrics(snapshotData, language);
  renderProjects(snapshotData?.featured_projects || [], language);
  renderFocus(language);
  renderNotes(snapshotData?.public_notes || [], language);
}

async function loadSnapshot() {
  const response = await fetch('/data/public_snapshot.json', { cache: 'no-store' });
  if (!response.ok) throw new Error(`snapshot ${response.status}`);
  return response.json();
}

document.querySelectorAll('[data-lang-option]').forEach((button) => {
  button.addEventListener('click', () => setLanguage(button.dataset.langOption));
});

const initialLanguage = getLanguage();
applyLanguage(initialLanguage);

loadSnapshot()
  .then((snapshot) => {
    snapshotData = snapshot;
    applyLanguage(getLanguage());
  })
  .catch(() => {
    setMetric('resource_console_status', COPY[getLanguage()].metrics.snapshotMissing);
  });
