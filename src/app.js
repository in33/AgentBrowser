/**
 * AgentBrowser - 渲染进程主逻辑
 * 负责：视图切换、智能浏览器、Agent 工作台、AI 助手、移动云增值服务、设置
 */
const AB = window.agentBrowser;

// ============================================================
// 全局状态
// ============================================================
const state = {
  view: 'home',
  modelConfig: null,       // { provider, model, apiKey, baseUrl, system }
  presets: [],
  customInterfaces: [],    // 自定义接口列表
  hiddenInterfaces: [],    // 被隐藏的接口 id 列表
  pinnedInterfaces: [],    // 置顶接口 id 列表（在下拉中排最前）
  agents: [],
  selectedAgentId: null,
  activeAgent: null,
  agentRunning: false,
  agentStop: false,
  agentResults: [],
  agentChatMessages: [],
  ifaceTested: false,
  taskQueue: [],
  sysInfo: null,
  // 移动云增值服务
  ecloudData: null,
  // AI 助手面板
  aiPanelMessages: [],
  aiPanelSending: false,
  // 浏览历史
  browserHistory: [],
  // 收藏书签
  bookmarks: [],
};

// ============================================================
// 工具函数
// ============================================================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function setStatus(text) {
  $('#statusLeft').textContent = text;
}

function toast(msg, type = 'info') {
  // 仅显示浮动提示，不修改状态栏，避免页面布局移动
  let box = $('#toastBox');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toastBox';
    document.body.appendChild(box);
  }
  const t = document.createElement('div');
  t.className = 'toast-item ' + type;
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => {
    t.classList.add('out');
    setTimeout(() => t.remove(), 400);
  }, 2600);
}

// 简易 Markdown 渲染（支持代码块、标题、列表、粗体、行内代码）
function renderMarkdown(text) {
  if (!text) return '';
  let html = escapeHtml(text);
  // 代码块
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (m, lang, code) => {
    return `<pre><code class="lang-${lang || 'text'}">${code}</code></pre>`;
  });
  // 行内代码
  html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  // 标题
  html = html.replace(/^### (.*)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.*)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.*)$/gm, '<h1>$1</h1>');
  // 粗体
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // 引用
  html = html.replace(/^&gt; (.*)$/gm, '<blockquote>$1</blockquote>');
  // 列表
  html = html.replace(/^- (.*)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`);
  html = html.replace(/^\d+\. (.*)$/gm, '<li>$1</li>');
  // 表格
  html = html.replace(/\|(.+)\|\n\|[\s:|-]+\|\n((?:\|.+\|\n?)+)/g, (m, head, rows) => {
    const hs = head.split('|').filter(Boolean).map((c) => `<th>${c.trim()}</th>`).join('');
    const rss = rows.trim().split('\n').map((r) => {
      const cells = r.split('|').filter(Boolean).map((c) => `<td>${c.trim()}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('');
    return `<table><thead><tr>${hs}</tr></thead><tbody>${rss}</tbody></table>`;
  });
  // 换行
  html = html.replace(/\n/g, '<br/>');
  return html;
}

// ============================================================
// 启动
// ============================================================
async function init() {
  // 加载预设模型
  state.presets = await AB.modelPresets();
  // 加载自定义接口与隐藏状态
  state.customInterfaces = (await AB.customInterfaces()) || [];
  state.hiddenInterfaces = (await AB.hiddenInterfaces()) || [];
  state.pinnedInterfaces = (await AB.storeGet('pinnedInterfaces')) || [];
  populateProviderSelect();
  renderInterfaceManager();
  renderTokenManagerList();

  // 加载模型配置
  state.modelConfig = await AB.storeGet('modelConfig');
  if (state.modelConfig) {
    applyModelConfigToForm();
    updateModelChip();
  } else {
    // 未配置模型时，默认选中移动云 MemS 免费接口并自动填充
    const mems = getAllInterfaces().find((p) => p.id === 'mems-deepseek');
    if (mems) {
      $('#settingsProvider').value = 'mems-deepseek';
      applyPresetToForm();
    }
  }
  // 刷新所有模型下拉选择框（含侧边栏、Agent工作台）
  refreshAllModelSelects();

  // 加载 Agent
  state.agents = (await AB.storeGet('agents')) || [];
  if (state.agents.length === 0) {
    state.agents = defaultAgents();
    await AB.storeSet('agents', state.agents);
  }
  // 确保「常规对话」始终在第一位
  if (!state.agents.some((a) => a.id === 'general')) {
    state.agents.unshift({
      id: 'general', name: '常规对话', icon: '💬',
      desc: '通用 AI 对话，无需多步骤工作流',
      system: '你是一个智能助手。请直接回答用户的问题，简洁明了。',
      tags: ['通用', '对话'], simple: true,
    });
    await AB.storeSet('agents', state.agents);
  }
  // 默认选中第一个 Agent
  if (!state.selectedAgentId) state.selectedAgentId = state.agents[0]?.id || null;
  renderAgents();

  // 加载 Agent 执行结果
  state.agentResults = (await AB.storeGet('agentResults')) || [];
  state.agentChatMessages = [];
  renderAgentChatMessages();

  // 加载浏览历史
  state.browserHistory = (await AB.storeGet('browserHistory')) || [];
  renderBrowserHistory();
  // 加载收藏书签
  state.bookmarks = (await AB.storeGet('bookmarks')) || [];

  // 系统信息
  state.sysInfo = await AB.sysInfo();
  renderAbout();

  // 加载主题
  const savedTheme = (await AB.storeGet('theme')) || 'dark';
  applyTheme(savedTheme);

  // 首页统计
  renderHeroStats();

  // 事件绑定
  bindEvents();

  // 桌面时钟 + 全屏时钟
  updateClock();
  setInterval(updateClock, 1000);

  // 加载移动云服务数据
  await loadEcloudServices();

  // 窗口控制
  initWindowControls();

  // 菜单
  initMenu();

  // AI 助手面板
  initAiPanel();

  // 隐藏启动画面
  setTimeout(() => {
    $('#splash').classList.add('fade');
    setTimeout(() => $('#splash').classList.add('hidden'), 500);
    $('#app').classList.remove('hidden');
  }, 1600);
}

// 桌面时钟
function updateClock() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  // 桌面时钟
  const timeEl = $('#desktopClock');
  if (timeEl) {
    const t = timeEl.querySelector('.clock-time');
    const d = timeEl.querySelector('.clock-date');
    if (t) t.textContent = `${hh}:${mm}:${ss}`;
    if (d) {
      const week = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()];
      d.textContent = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 · 星期${week}`;
    }
  }
  // 同步更新全屏时钟
  updateFsClock();
}

// ============================================================
// 视图切换
// ============================================================
function switchView(view) {
  state.view = view;
  $$('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${view}`));
  if (view === 'ecloud') renderEcloudServices();
  if (view === 'tokens') { renderTokenManagerList(); renderInterfaceManager(); }
  if (view === 'settings') populateSettingsSysInfo();
  if (view === 'agents') {
    renderAgents();
    renderAgentChatMessages();
    renderAgentResults();
  }
  // 进入浏览器视图时刷新所有标签缩略图（此时 webview 可见，capturePage 才有效）
  if (view === 'browser') {
    setTimeout(() => {
      browser.tabs.forEach((t) => captureThumb(t.id));
    }, 300);
  }
}

/** 填充设置页的系统信息 */
async function populateSettingsSysInfo() {
  const el = $('#settingsSysInfo');
  if (!el) return;
  try {
    const info = await AB.sysInfo();
    el.textContent = `${info.platform || 'Unknown'} · ${info.arch || 'Unknown'} · Electron ${info.electron || '?'}`;
  } catch {
    el.textContent = '无法获取系统信息';
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const darkBtn = $('#themeDark');
  const lightBtn = $('#themeLight');
  if (darkBtn) darkBtn.classList.toggle('active', theme === 'dark');
  if (lightBtn) lightBtn.classList.toggle('active', theme === 'light');
}

// ============================================================
// 模型配置
// ============================================================
// 获取全部接口（内置预设 + 自定义接口），并过滤隐藏项
function getAllInterfaces(includeHidden = false) {
  const all = [...state.presets, ...state.customInterfaces];
  if (includeHidden) return all;
  return all.filter((p) => !state.hiddenInterfaces.includes(p.id));
}

// 按分组组织接口
function groupInterfaces(list) {
  const groups = {};
  list.forEach((p) => {
    const g = p.group || '其他';
    if (!groups[g]) groups[g] = [];
    groups[g].push(p);
  });
  return groups;
}

function populateProviderSelect() {
  const sel = $('#settingsProvider');
  sel.innerHTML = '';
  const { pinned, rest } = getSortedInterfaces();
  // 置顶分组
  if (pinned.length > 0) {
    const og = document.createElement('optgroup');
    og.label = '📌 置顶';
    pinned.forEach((p) => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      og.appendChild(opt);
    });
    sel.appendChild(og);
  }
  // 其余按分组
  const groups = groupInterfaces(rest);
  Object.keys(groups).forEach((g) => {
    const og = document.createElement('optgroup');
    og.label = g;
    groups[g].forEach((p) => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      og.appendChild(opt);
    });
    sel.appendChild(og);
  });
  // 选择服务商时自动填充预设信息
  sel.onchange = () => applyPresetToForm();
  // 构建自定义下拉（支持置顶按钮）
  const container = document.querySelector('.model-picker[data-target="settingsProvider"]');
  if (container) buildModelPicker(container, sel, false);
}

// 根据选中的服务商预设自动填充模型 / API Key / Base URL
async function applyPresetToForm() {
  const providerId = $('#settingsProvider').value;
  const preset = getAllInterfaces(true).find((p) => p.id === providerId);
  if (!preset) return;
  // 从 SQLite 加载用户保存的 API Key（不再从静态预设读取）
  const savedKey = await AB.dbGet('apiKey:' + providerId);
  $('#settingsApiKey').value = savedKey || '';
  // 预设模型列表：若当前模型不在列表中，则填入第一个
  if (preset.models && preset.models.length) {
    const cur = $('#settingsModel').value.trim();
    if (!cur || !preset.models.includes(cur)) {
      $('#settingsModel').value = preset.models[0];
    }
  }
  if (preset.baseUrl) {
    $('#settingsBaseUrl').value = preset.baseUrl;
  }
}

function applyModelConfigToForm() {
  const c = state.modelConfig;
  // 若保存的 providerId 已不存在（如旧版 mems 已拆分），回退到默认
  const exists = getAllInterfaces(true).some((p) => p.id === c.providerId);
  const providerId = exists ? c.providerId : 'mems-deepseek';
  $('#settingsProvider').value = providerId;
  $('#settingsModel').value = c.model || '';
  $('#settingsApiKey').value = c.apiKey || '';
  $('#settingsBaseUrl').value = c.baseUrl || '';
  $('#settingsSystem').value = c.system || '';
  // 从 SQLite 加载 Key
  applyPresetToForm();
}

function updateModelChip() {
  // 模型信息已移至设置页面，此函数保留用于兼容调用
}

function getActiveModelConfig() {
  if (state.modelConfig && state.modelConfig.model) return state.modelConfig;
  return null;
}

/**
 * 从下拉选择框获取模型配置（覆盖系统默认）
 * @param {string} selectId - select 元素的 ID
 * @returns {Promise<object|null>} - 如果选择了非默认模型则返回配置，否则返回 null
 */
async function getOverrideModelConfig(selectId) {
  const sel = $(selectId);
  if (!sel) return null;
  const selectedId = sel.value;
  if (!selectedId || selectedId === '__default__') return null;
  const preset = getAllInterfaces(true).find((p) => p.id === selectedId);
  if (!preset) return null;
  const savedKey = await AB.dbGet('apiKey:' + preset.id);
  const savedBaseUrl = await AB.dbGet('baseUrl:' + preset.id);
  return {
    providerId: preset.id,
    name: preset.name,
    provider: preset.provider,
    model: preset.models ? preset.models[0] : (preset.model || ''),
    apiKey: savedKey || '',
    baseUrl: savedBaseUrl || preset.baseUrl || '',
    system: '',
  };
}

async function saveModelConfig() {
  const providerId = $('#settingsProvider').value;
  const preset = getAllInterfaces(true).find((p) => p.id === providerId);
  const config = {
    providerId,
    name: preset ? preset.name : providerId,
    provider: preset ? preset.provider : 'openai',
    model: $('#settingsModel').value.trim(),
    apiKey: $('#settingsApiKey').value.trim(),
    baseUrl: $('#settingsBaseUrl').value.trim() || (preset ? preset.baseUrl : ''),
    system: $('#settingsSystem').value.trim(),
  };
  if (!config.model) {
    toast('请填写模型名称');
    return;
  }
  // 保存 API Key 到 SQLite
  await AB.dbSet('apiKey:' + providerId, config.apiKey);
  await AB.dbSet('baseUrl:' + providerId, config.baseUrl);
  state.modelConfig = config;
  await AB.storeSet('modelConfig', config);
  updateModelChip();
  // 刷新所有模型下拉（"系统默认"标签会更新为新的模型名）
  refreshAllModelSelects();
  $('#settingsTest').textContent = '✓ 模型配置已保存';
  $('#settingsTest').className = 'settings-test ok';
  toast('模型配置已保存');
}

async function testModel() {
  const providerId = $('#settingsProvider').value;
  const preset = getAllInterfaces(true).find((p) => p.id === providerId);
  const config = {
    provider: preset ? preset.provider : 'openai',
    model: $('#settingsModel').value.trim(),
    apiKey: $('#settingsApiKey').value.trim(),
    baseUrl: $('#settingsBaseUrl').value.trim() || (preset ? preset.baseUrl : ''),
  };
  const testEl = $('#settingsTest');
  testEl.innerHTML = '<span class="thinking-hint"><span>正在测试连接</span><span class="typing-indicator"><span></span><span></span><span></span></span></span>';
  testEl.className = 'settings-test';
  const res = await AB.modelChat({
    provider: config.provider,
    config,
    messages: [{ role: 'user', content: '请只回复"连接成功"四个字' }],
    opts: { maxTokens: 1000 },
  });
  if (res.ok) {
    testEl.textContent = `✓ 连接成功：${res.text.slice(0, 60)}`;
    testEl.className = 'settings-test ok';
  } else {
    testEl.textContent = `✗ 连接失败：${res.error}`;
    testEl.className = 'settings-test err';
  }
}

// ============================================================
// 接口管理（分组 / 自定义 / 隐藏）
// ============================================================
function renderInterfaceManager() {
  const box = $('#interfaceManager');
  box.innerHTML = '';
  const all = getAllInterfaces(true);
  if (all.length === 0) {
    box.appendChild(el('div', 'iface-empty', '暂无接口'));
    return;
  }
  const groups = groupInterfaces(all);
  Object.keys(groups).forEach((g) => {
    const groupEl = el('div', 'iface-group');
    const head = el('div', 'iface-group-head');
    head.appendChild(el('b', '', g));
    head.appendChild(el('span', 'iface-count', `${groups[g].length} 个接口`));
    groupEl.appendChild(head);
    groups[g].forEach((p) => {
      const item = el('div', 'iface-item' + (state.hiddenInterfaces.includes(p.id) ? ' hidden-item' : ''));
      const dot = el('span', 'iface-dot ' + (state.hiddenInterfaces.includes(p.id) ? 'off' : 'on'));
      item.appendChild(dot);
      const info = el('div', 'iface-info');
      const name = el('div', 'iface-name', p.name);
      if (p.custom) {
        const tag = el('span', 'iface-tag', '自定义');
        name.appendChild(tag);
      }
      info.appendChild(name);
      const meta = el('div', 'iface-meta', `${p.provider} · ${p.baseUrl || '默认 URL'}`);
      info.appendChild(meta);
      item.appendChild(info);
      const actions = el('div', 'iface-actions');
      // 编辑按钮
      const editBtn = el('button', 'icon-btn iface-edit-btn', '✎');
      editBtn.title = '编辑接口';
      editBtn.onclick = () => editInterface(p);
      actions.appendChild(editBtn);
      // 隐藏/显示开关
      const toggle = el('label', 'iface-toggle');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !state.hiddenInterfaces.includes(p.id);
      cb.onchange = () => toggleInterfaceHidden(p.id, !cb.checked);
      const sw = el('span', 'switch');
      toggle.appendChild(cb);
      toggle.appendChild(sw);
      toggle.appendChild(el('span', '', cb.checked ? '显示' : '隐藏'));
      actions.appendChild(toggle);
      // 自定义接口可删除
      if (p.custom) {
        const del = el('button', 'icon-btn', '🗑');
        del.title = '删除接口';
        del.onclick = () => deleteCustomInterface(p.id);
        actions.appendChild(del);
      }
      item.appendChild(actions);
      groupEl.appendChild(item);
    });
    box.appendChild(groupEl);
  });
}

async function toggleInterfaceHidden(id, hidden) {
  if (hidden) {
    if (!state.hiddenInterfaces.includes(id)) state.hiddenInterfaces.push(id);
  } else {
    state.hiddenInterfaces = state.hiddenInterfaces.filter((x) => x !== id);
  }
  await AB.saveHiddenInterfaces(state.hiddenInterfaces);
  // 若当前选中的接口被隐藏，重置选择
  const cur = $('#settingsProvider').value;
  if (hidden && cur === id) {
    const visible = getAllInterfaces();
    if (visible.length) {
      $('#settingsProvider').value = visible[0].id;
      applyPresetToForm();
    }
  }
  refreshAllModelSelects();
  renderInterfaceManager();
  toast(hidden ? '接口已隐藏' : '接口已显示');
}

async function deleteCustomInterface(id) {
  state.customInterfaces = state.customInterfaces.filter((p) => p.id !== id);
  state.hiddenInterfaces = state.hiddenInterfaces.filter((x) => x !== id);
  await AB.saveCustomInterfaces(state.customInterfaces);
  await AB.saveHiddenInterfaces(state.hiddenInterfaces);
  refreshAllModelSelects();
  renderInterfaceManager();
  toast('自定义接口已删除');
}

// 编辑接口（自定义接口可编辑全部字段，预设接口可编辑 API Key）
function editInterface(p) {
  const body = $('#modalBody');
  body.innerHTML = '';
  const isCustom = !!p.custom;
  const fields = [
    { label: '接口名称', id: 'eiName', type: 'text', ph: '例如：我的本地模型', value: p.name, readonly: !isCustom },
    { label: '分组名称', id: 'eiGroup', type: 'text', ph: '分组', value: p.group || '', readonly: !isCustom },
    { label: '模型名称', id: 'eiModel', type: 'text', ph: '例如：gpt-4o-mini', value: p.model || (p.models && p.models[0]) || '', readonly: !isCustom },
    { label: 'API Key', id: 'eiKey', type: 'password', ph: 'sk-...', value: p.apiKey || '' },
    { label: 'Base URL', id: 'eiUrl', type: 'text', ph: 'https://api.example.com/v1', value: p.baseUrl || '', readonly: !isCustom },
  ];
  fields.forEach((f) => {
    const row = el('div', 'form-row');
    row.appendChild(el('label', '', f.label));
    const inp = el('input', 'input', '');
    inp.id = f.id;
    inp.type = f.type;
    inp.placeholder = f.ph;
    if (f.value) inp.value = f.value;
    if (f.readonly) inp.readOnly = true;
    row.appendChild(inp);
    body.appendChild(row);
  });
  // 协议类型
  const row = el('div', 'form-row');
  row.appendChild(el('label', '', '协议类型'));
  const sel = el('select', 'select', '');
  sel.id = 'eiProvider';
  [['openai', 'OpenAI 兼容'], ['anthropic', 'Anthropic'], ['gemini', 'Gemini']].forEach(([v, t]) => {
    const opt = el('option', '', t);
    opt.value = v;
    if (p.provider === v) opt.selected = true;
    sel.appendChild(opt);
  });
  if (!isCustom) sel.disabled = true;
  row.appendChild(sel);
  body.appendChild(row);

  const actions = el('div', 'modal-actions');
  const cancel = el('button', 'btn btn-ghost', '取消');
  const ok = el('button', 'btn btn-primary', '保存');
  actions.appendChild(cancel);
  actions.appendChild(ok);
  body.appendChild(actions);
  $('#modalTitle').textContent = isCustom ? '编辑自定义接口' : `编辑「${p.name}」`;
  $('#modal').classList.remove('hidden');
  $('#eiKey').focus();
  cancel.onclick = () => { $('#modal').classList.add('hidden'); };
  ok.onclick = async () => {
    const apiKey = $('#eiKey').value.trim();
    if (isCustom) {
      const idx = state.customInterfaces.findIndex((x) => x.id === p.id);
      if (idx >= 0) {
        state.customInterfaces[idx] = {
          ...state.customInterfaces[idx],
          name: $('#eiName').value.trim(),
          group: $('#eiGroup').value.trim() || '自定义',
          model: $('#eiModel').value.trim(),
          baseUrl: $('#eiUrl').value.trim(),
          provider: $('#eiProvider').value,
          models: [$('#eiModel').value.trim()],
        };
        // API Key 保存到 SQLite
        await AB.dbSet('apiKey:' + p.id, apiKey);
        await AB.saveCustomInterfaces(state.customInterfaces);
      }
    } else {
      // 预设接口：保存 API Key 到 SQLite
      await AB.dbSet('apiKey:' + p.id, apiKey);
    }
    $('#modal').classList.add('hidden');
    refreshAllModelSelects();
    renderInterfaceManager();
    // 如果当前选中的是被编辑的接口，刷新表单
    if ($('#settingsProvider').value === p.id) applyPresetToForm();
    toast('接口配置已保存');
  };
}

// 添加自定义接口（默认创建新分组）
function addCustomInterface() {
  const body = $('#modalBody');
  body.innerHTML = '';
  const fields = [
    { label: '接口名称', id: 'ciName', type: 'text', ph: '例如：我的本地模型' },
    { label: '分组名称', id: 'ciGroup', type: 'text', ph: '默认创建新分组，例如：我的分组' },
    { label: '模型名称', id: 'ciModel', type: 'text', ph: '例如：gpt-4o-mini' },
    { label: 'API Key', id: 'ciKey', type: 'password', ph: 'sk-...' },
    { label: 'Base URL', id: 'ciUrl', type: 'text', ph: 'https://api.example.com/v1' },
  ];
  fields.forEach((f) => {
    const row = el('div', 'form-row');
    row.appendChild(el('label', '', f.label));
    const input = el('input', 'input', '');
    input.type = f.type;
    input.id = f.id;
    input.placeholder = f.ph;
    row.appendChild(input);
    body.appendChild(row);
  });
  // 协议类型
  const row = el('div', 'form-row');
  row.appendChild(el('label', '', '协议类型'));
  const sel = el('select', 'select', '');
  sel.id = 'ciProvider';
  [['openai', 'OpenAI 兼容'], ['anthropic', 'Anthropic'], ['gemini', 'Gemini']].forEach(([v, t]) => {
    const opt = el('option', '', t);
    opt.value = v;
    sel.appendChild(opt);
  });
  row.appendChild(sel);
  body.appendChild(row);

  const actions = el('div', 'modal-actions');
  const cancel = el('button', 'btn btn-ghost', '取消');
  const ok = el('button', 'btn btn-primary', '添加接口');
  actions.appendChild(cancel);
  actions.appendChild(ok);
  body.appendChild(actions);
  $('#modalTitle').textContent = '添加自定义接口';
  $('#modal').classList.remove('hidden');
  $('#ciName').focus();
  cancel.onclick = () => { $('#modal').classList.add('hidden'); };
  ok.onclick = async () => {
    const name = $('#ciName').value.trim();
    const group = $('#ciGroup').value.trim();
    const model = $('#ciModel').value.trim();
    const apiKey = $('#ciKey').value.trim();
    const baseUrl = $('#ciUrl').value.trim();
    const provider = $('#ciProvider').value;
    if (!name || !model || !baseUrl) {
      toast('请填写接口名称、模型名称和 Base URL');
      return;
    }
    const id = 'custom-' + Date.now();
    state.customInterfaces.push({
      id, name, group: group || '自定义', provider, model,
      baseUrl, models: [model], custom: true,
    });
    // API Key 保存到 SQLite
    await AB.dbSet('apiKey:' + id, apiKey);
    await AB.saveCustomInterfaces(state.customInterfaces);
    $('#modal').classList.add('hidden');
    refreshAllModelSelects();
    renderInterfaceManager();
    // 自动选中新接口并填充
    $('#settingsProvider').value = id;
    applyPresetToForm();
    toast(`已添加自定义接口「${name}」到分组「${group || '自定义'}」`);
  };
}

// ============================================================
// Agent 工作台
// ============================================================
function defaultAgents() {
  return [
    {
      id: 'general', name: '常规对话', icon: '💬',
      desc: '通用 AI 对话，无需多步骤工作流',
      system: '你是一个智能助手。请直接回答用户的问题，简洁明了。',
      tags: ['通用', '对话'],
      simple: true,
    },
    {
      id: 'research', name: '深度研究员', icon: '🔬',
      desc: '自动搜索、分析、总结，产出结构化研究报告',
      system: '你是一个深度研究员。请系统地分析问题，分步骤思考，给出结构化、有依据的结论。',
      tags: ['研究', '分析'],
    },
    {
      id: 'coder', name: '编程助手', icon: '👨‍💻',
      desc: '编写、审查、优化代码，支持多种语言',
      system: '你是一个资深软件工程师。请给出高质量、可运行的代码，并解释关键逻辑。',
      tags: ['编程', '代码'],
    },
    {
      id: 'writer', name: '内容创作', icon: '✍️',
      desc: '撰写文章、文案、报告，风格多样',
      system: '你是一个专业内容创作者。请产出结构清晰、文笔优美的内容。',
      tags: ['写作', '创作'],
    },
    {
      id: 'analyst', name: '数据分析师', icon: '📈',
      desc: '解读数据、生成图表建议、洞察趋势',
      system: '你是一个数据分析师。请解读数据，给出洞察和可视化建议。',
      tags: ['数据', '洞察'],
    },
    {
      id: 'translator', name: '多语翻译', icon: '🌍',
      desc: '高质量多语言互译，保留语境与风格',
      system: '你是一个专业翻译。请准确翻译，保留原文语境与风格。',
      tags: ['翻译'],
    },
    {
      id: 'planner', name: '任务规划师', icon: '🗺️',
      desc: '把复杂目标拆解为可执行的步骤计划',
      system: '你是一个任务规划专家。请把目标拆解为清晰、可执行的步骤。',
      tags: ['规划', '效率'],
    },
  ];
}

function renderAgents() {
  const list = $('#agentWbList');
  if (!list) return;
  list.innerHTML = '';
  state.agents.forEach((agent) => {
    const item = el('div', 'agent-list-item');
    if (state.selectedAgentId === agent.id) item.classList.add('active');
    item.appendChild(el('span', 'ali-icon', agent.icon));
    const info = el('div', 'ali-info');
    info.appendChild(el('div', 'ali-name', agent.name));
    info.appendChild(el('div', 'ali-desc', agent.desc || ''));
    item.appendChild(info);
    item.title = agent.desc || agent.name;
    item.onclick = () => selectAgent(agent.id);
    list.appendChild(item);
  });
}

function selectAgent(id) {
  state.selectedAgentId = id;
  renderAgents();
}

/** 渲染 Agent 聊天消息区 */
function renderAgentChatMessages() {
  const box = $('#agentChatMessages');
  if (!box) return;
  const msgs = state.agentChatMessages || [];
  if (msgs.length === 0) {
    box.innerHTML = '<div class="agent-empty">选择一个 Agent，输入任务开始对话 ✨</div>';
    return;
  }
  box.innerHTML = '';
  msgs.forEach((m) => {
    const msg = el('div', `msg ${m.role}`);
    const bubble = el('div', 'msg-bubble');
    if (m.role === 'assistant' && m.step) {
      const tag = el('div', 'agent-step-tag' + (m.stepStatus ? ' ' + m.stepStatus : ''), m.step);
      bubble.appendChild(tag);
    }
    // 等待回复中：显示思考动画
    if (m.role === 'assistant' && !m.content && m.stepStatus !== 'error') {
      msg.classList.add('typing');
      const hint = el('div', 'thinking-hint', '');
      hint.appendChild(el('span', '', m.step ? `${m.step}中` : '思考中'));
      const indicator = document.createElement('div');
      indicator.className = 'typing-indicator';
      indicator.innerHTML = '<span></span><span></span><span></span>';
      hint.appendChild(indicator);
      bubble.appendChild(hint);
    } else {
      bubble.innerHTML = m.role === 'assistant' ? renderMarkdown(m.content) : escapeHtml(m.content);
    }
    msg.appendChild(bubble);
    // 助手消息完成后添加操作按钮
    if (m.role === 'assistant' && m.content && m.stepStatus === 'done') {
      const actions = el('div', 'msg-actions');
      const copyBtn = el('button', '', '复制');
      copyBtn.onclick = () => { navigator.clipboard.writeText(m.content); toast('已复制'); };
      actions.appendChild(copyBtn);
      msg.appendChild(actions);
    }
    box.appendChild(msg);
  });
  box.scrollTop = box.scrollHeight;
}

async function sendTask() {
  const input = $('#taskInput');
  const text = input.value.trim();
  if (!text) { toast('请输入任务描述'); return; }
  const agent = state.agents.find((a) => a.id === state.selectedAgentId);
  if (!agent) { toast('请先选择一个 Agent'); return; }
  // 优先使用下拉选择的模型，否则用系统默认
  const overrideConfig = await getOverrideModelConfig('#taskModel');
  const config = overrideConfig || getActiveModelConfig();
  // 首次对话时检查 Key，弹出设置弹窗
  const providerId = overrideConfig?.providerId || config?.providerId;
  if (!await ensureApiKey(providerId)) return;

  state.agentChatMessages = state.agentChatMessages || [];
  // 添加用户消息
  state.agentChatMessages.push({ role: 'user', content: text });
  input.value = '';
  state.agentStop = false;
  $('#btnSendTask').style.display = 'none';
  $('#btnStopAgent').style.display = '';

  renderAgentChatMessages();

  // 「常规对话」Agent 直接单轮回复，其余走 3 步工作流
  const steps = agent.simple
    ? [{ name: '回复', prompt: text }]
    : [
        { name: '规划', prompt: `请针对任务"${text}"，先给出你的执行计划（3-5步）。只输出计划。` },
        { name: '执行', prompt: `请针对任务"${text}"，执行你的计划并给出最终结果。请详细、完整地输出。` },
        { name: '完善', prompt: `请回顾你刚才对任务"${text}"的回答，检查是否有遗漏或错误，并给出最终完善版结论。` },
      ];

  let context = '';
  for (const step of steps) {
    if (state.agentStop) break;
    // 添加占位 assistant 消息
    const placeholder = { role: 'assistant', content: '', step: step.name, stepStatus: '' };
    state.agentChatMessages.push(placeholder);
    renderAgentChatMessages();

    const messages = [
      { role: 'system', content: agent.system },
      ...(context ? [{ role: 'assistant', content: context }] : []),
      { role: 'user', content: step.prompt },
    ];

    // 流式接收
    let streamed = '';
    let firstChunk = true;
    AB.onStreamChunk((chunk) => {
      if (state.agentStop) return;
      if (firstChunk) { firstChunk = false; placeholder.stepStatus = 'done'; }
      streamed += chunk;
      placeholder.content = streamed;
      renderAgentChatMessages();
    });
    const streamPromise = AB.modelChatStream({
      provider: config.provider, config,
      messages, opts: { temperature: 0.7, maxTokens: 1500 },
    });
    const stopWatcher = new Promise((resolve) => {
      const check = () => {
        if (state.agentStop) return resolve({ ok: false, error: '已停止' });
        if (streamPromise.isResolved) return;
        setTimeout(check, 200);
      };
      check();
    });
    const res = await Promise.race([streamPromise, stopWatcher]).catch((e) => ({ ok: false, error: String(e) }));
    streamPromise.isResolved = true;
    AB.offStreamChunk();

    if (state.agentStop) {
      placeholder.content = streamed || '⏹ 已停止';
      placeholder.stepStatus = streamed ? 'done' : 'error';
      renderAgentChatMessages();
      if (streamed) context = streamed;
      break;
    }
    if (res.ok) {
      // 流式无内容时回退到非流式
      if (!streamed) {
        const res2 = await AB.modelChat({
          provider: config.provider, config,
          messages, opts: { temperature: 0.7, maxTokens: 1500 },
        });
        if (res2.ok) {
          streamed = res2.text;
          placeholder.content = streamed;
          placeholder.stepStatus = 'done';
        } else {
          placeholder.content = `⚠️ ${res2.error}`;
          placeholder.stepStatus = 'error';
          renderAgentChatMessages();
          break;
        }
      }
      context = streamed;
      placeholder.content = streamed;
      placeholder.stepStatus = 'done';
    } else {
      placeholder.content = `⚠️ ${res.error}`;
      placeholder.stepStatus = 'error';
      renderAgentChatMessages();
      break;
    }
    renderAgentChatMessages();
  }

  // 保存到结果历史
  if (context && !state.agentStop) {
    state.agentResults = state.agentResults || [];
    state.agentResults.unshift({
      agentName: agent.name,
      agentIcon: agent.icon,
      task: text,
      result: context,
      time: new Date().toLocaleString(),
      stopped: false,
    });
    if (state.agentResults.length > 50) state.agentResults = state.agentResults.slice(0, 50);
    await AB.storeSet('agentResults', state.agentResults);
    renderAgentResults();
  }

  state.agentStop = false;
  $('#btnSendTask').style.display = '';
  $('#btnStopAgent').style.display = 'none';
}

function renderTaskQueue() {
  // 兼容旧调用，新聊天框不再使用任务队列
}

function renderAgentResults() {
  const list = $('#agentResultList');
  const countEl = $('#agentResultCount');
  if (!list) return;
  const results = state.agentResults || [];
  if (countEl) countEl.textContent = `${results.length} 条`;
  if (results.length === 0) {
    list.innerHTML = '<div class="agent-empty">暂无历史结果</div>';
    return;
  }
  list.innerHTML = '';
  results.forEach((r) => {
    const card = el('div', 'agent-result-card');
    if (r.stopped) card.classList.add('stopped');
    const head = el('div', 'arc-head');
    head.appendChild(el('span', 'arc-icon', r.agentIcon || '🤖'));
    head.appendChild(el('span', 'arc-agent', r.agentName || 'Agent'));
    head.appendChild(el('span', 'arc-time', r.time || ''));
    card.appendChild(head);
    const task = el('div', 'arc-task', r.task || '');
    card.appendChild(task);
    const result = el('div', 'arc-result');
    result.innerHTML = renderMarkdown((r.result || '').slice(0, 500) + (r.result && r.result.length > 500 ? '…' : ''));
    card.appendChild(result);
    list.appendChild(card);
  });
}

function clearAgentResults() {
  state.agentChatMessages = [];
  state.agentResults = [];
  AB.storeSet('agentResults', []);
  renderAgentChatMessages();
  renderAgentResults();
  toast('对话已清空');
}

// ============================================================
// 接口自动测试
// ============================================================

/** 测试单个接口是否可用 */
async function testSingleInterface(preset) {
  const savedKey = await AB.dbGet('apiKey:' + preset.id);
  const savedBaseUrl = await AB.dbGet('baseUrl:' + preset.id);
  const apiKey = savedKey || '';
  const baseUrl = savedBaseUrl || preset.baseUrl || '';
  const model = preset.models ? preset.models[0] : (preset.model || '');
  if (!apiKey || !model) {
    return { ok: false, error: '未配置 Key 或模型', latency: 0 };
  }
  const config = {
    providerId: preset.id, name: preset.name,
    provider: preset.provider, model, apiKey, baseUrl, system: '',
  };
  const t0 = Date.now();
  try {
    const res = await AB.modelChat({
      provider: config.provider, config,
      messages: [{ role: 'user', content: 'Hi' }],
      opts: { temperature: 0, maxTokens: 5 },
    });
    const latency = Date.now() - t0;
    if (res.ok) return { ok: true, latency };
    return { ok: false, error: res.error, latency };
  } catch (e) {
    return { ok: false, error: String(e), latency: Date.now() - t0 };
  }
}

/** 测试所有接口并渲染结果面板 */
async function testAllInterfaces() {
  const panel = $('#agentIfacePanel');
  const grid = $('#agentIfaceGrid');
  const countEl = $('#agentIfaceCount');
  if (!panel || !grid) return;
  panel.classList.remove('hidden');
  const interfaces = getAllInterfaces(true);
  if (countEl) countEl.textContent = `${interfaces.length} 个接口`;
  grid.innerHTML = '';
  // 为每个接口创建卡片
  const cards = interfaces.map((p) => {
    const card = el('div', 'agent-iface-card testing');
    card.appendChild(el('span', 'iface-dot'));
    card.appendChild(el('span', 'iface-name', p.name));
    const latency = el('span', 'iface-latency');
    const ti = document.createElement('span');
    ti.className = 'typing-indicator';
    ti.innerHTML = '<span></span><span></span><span></span>';
    latency.appendChild(ti);
    card.appendChild(latency);
    grid.appendChild(card);
    return { card, preset: p, latency };
  });
  // 并行测试所有接口
  let okCount = 0;
  const results = [];
  const promises = cards.map(async ({ card, preset, latency }) => {
    const result = await testSingleInterface(preset);
    results.push({ card, preset, latency, result });
    card.classList.remove('testing');
    if (result.ok) {
      card.classList.add('ok');
      latency.textContent = `${result.latency}ms`;
      card.title = `${preset.name} · 可用 · ${result.latency}ms`;
      okCount++;
    } else {
      card.classList.add('fail');
      latency.textContent = '不可用';
      card.title = `${preset.name} · ${result.error}`;
    }
    if (countEl) countEl.textContent = `${okCount}/${interfaces.length} 可用`;
    // 每完成一个就重新排序：可用 → 不可用 → 测试中，可用按延迟升序
    const order = { ok: 0, fail: 1, testing: 2 };
    results.sort((a, b) => {
      const ra = a.result.ok ? 'ok' : 'fail';
      const rb = b.result.ok ? 'ok' : 'fail';
      if (ra !== rb) return order[ra] - order[rb];
      if (ra === 'ok') return a.result.latency - b.result.latency;
      return 0;
    });
    results.forEach(({ card: c }) => grid.appendChild(c));
  });
  await Promise.all(promises);
}

// ============================================================
// Agent 编辑器（新建/编辑/删除）
// ============================================================
const DEFAULT_AVATARS = [
  '🔬', '👨‍💻', '✍️', '📈', '🌍', '🗺️',
  '🤖', '🧠', '💡', '🎯', '📊', '🛡️',
  '🎨', '📝', '🔍', '⚙️', '🚀', '📦',
];

function openAgentEditor(agent) {
  const existing = $('#agentEditorDialog');
  if (existing) existing.remove();

  const isEdit = !!agent;
  const a = agent ? { ...agent } : { id: '', name: '', icon: '🤖', desc: '', system: '', tags: [] };

  const avatarsHtml = DEFAULT_AVATARS.map((av) =>
    `<button class="avatar-pick ${av === a.icon ? 'selected' : ''}" data-avatar="${av}">${av}</button>`
  ).join('');

  const dlg = document.createElement('div');
  dlg.id = 'agentEditorDialog';
  dlg.className = 'modal';
  dlg.innerHTML = `
    <div class="modal-box" style="max-width:520px;max-height:85vh;">
      <div class="modal-head">
        <span>${isEdit ? '✏️ 编辑 Agent' : '➕ 新建 Agent'}</span>
        <button class="modal-close" onclick="this.closest('.modal').remove()">✕</button>
      </div>
      <div class="modal-body" style="padding:20px;overflow-y:auto;">
        <label style="display:block;margin-bottom:8px;font-size:13px;color:var(--text-1);">头像</label>
        <div class="avatar-grid" id="avatarGrid">${avatarsHtml}</div>
        <div style="margin:12px 0;">
          <label style="display:block;margin-bottom:6px;font-size:13px;color:var(--text-1);">或输入自定义 Emoji</label>
          <input type="text" id="agentCustomAvatar" class="input" style="width:80px;text-align:center;font-size:20px;" value="${escapeHtml(a.icon)}" maxlength="4" />
        </div>
        <div style="margin-bottom:12px;">
          <label style="display:block;margin-bottom:6px;font-size:13px;color:var(--text-1);">名称</label>
          <input type="text" id="agentName" class="input" style="width:100%;" value="${escapeHtml(a.name)}" placeholder="Agent 名称…" />
        </div>
        <div style="margin-bottom:12px;">
          <label style="display:block;margin-bottom:6px;font-size:13px;color:var(--text-1);">描述</label>
          <textarea id="agentDesc" class="input textarea" style="width:100%;min-height:60px;" placeholder="Agent 功能描述…">${escapeHtml(a.desc)}</textarea>
        </div>
        <div style="margin-bottom:12px;">
          <label style="display:block;margin-bottom:6px;font-size:13px;color:var(--text-1);">系统提示词</label>
          <textarea id="agentSystem" class="input textarea" style="width:100%;min-height:80px;" placeholder="定义 Agent 的角色和行为…">${escapeHtml(a.system)}</textarea>
        </div>
        <div style="margin-bottom:12px;">
          <label style="display:block;margin-bottom:6px;font-size:13px;color:var(--text-1);">标签（逗号分隔）</label>
          <input type="text" id="agentTags" class="input" style="width:100%;" value="${escapeHtml((a.tags || []).join(', '))}" placeholder="研究, 分析…" />
        </div>
      </div>
      <div class="modal-actions" style="padding:0 20px 20px;">
        ${isEdit ? '<button class="btn btn-ghost" id="agentDelete" style="margin-right:auto;color:var(--danger);">🗑 删除</button>' : ''}
        <button class="btn btn-ghost" id="agentCancel">取消</button>
        <button class="btn btn-primary" id="agentSave">${isEdit ? '保存' : '创建'}</button>
      </div>
    </div>
  `;
  document.body.appendChild(dlg);

  // 头像选择
  const customAvatarInput = $('#agentCustomAvatar');
  dlg.querySelectorAll('.avatar-pick').forEach((btn) => {
    btn.onclick = () => {
      dlg.querySelectorAll('.avatar-pick').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      customAvatarInput.value = btn.dataset.avatar;
    };
  });
  // 自定义头像输入
  customAvatarInput.oninput = () => {
    dlg.querySelectorAll('.avatar-pick').forEach((b) => b.classList.remove('selected'));
  };

  // 取消
  $('#agentCancel').onclick = () => dlg.remove();
  // 点击遮罩关闭
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.remove(); });

  // 删除
  if (isEdit) {
    $('#agentDelete').onclick = async () => {
      state.agents = state.agents.filter((x) => x.id !== a.id);
      await AB.storeSet('agents', state.agents);
      renderAgents();
      toast('Agent 已删除');
      dlg.remove();
    };
  }

  // 保存
  $('#agentSave').onclick = async () => {
    const name = $('#agentName').value.trim();
    if (!name) { toast('请填写 Agent 名称'); return; }
    const icon = customAvatarInput.value.trim() || '🤖';
    const desc = $('#agentDesc').value.trim();
    const system = $('#agentSystem').value.trim();
    const tags = $('#agentTags').value.split(',').map((t) => t.trim()).filter(Boolean);

    if (isEdit) {
      const idx = state.agents.findIndex((x) => x.id === a.id);
      if (idx >= 0) {
        state.agents[idx] = { ...state.agents[idx], name, icon, desc, system, tags };
      }
    } else {
      const newAgent = {
        id: 'custom-' + Date.now(),
        name, icon, desc, system, tags,
      };
      state.agents.push(newAgent);
    }
    await AB.storeSet('agents', state.agents);
    renderAgents();
    toast(isEdit ? 'Agent 已更新' : 'Agent 已创建');
    dlg.remove();
  };
}

// ============================================================
// 浏览器（多标签 + 竖排标签栏 + 缩略图预览）
// ============================================================
const START_PAGE = 'agentbrowser://start';
function isStartPage(url) {
  if (!url) return true;
  return url === START_PAGE || url === START_PAGE + '/' || url === 'about:blank';
}

const browser = {
  tabs: [],          // { id, title, url, webview, thumb }
  activeId: null,
  seq: 0,
  layout: 'v-thumb', // 默认竖排图文标签
};
let vtabPreview = null;

function initBrowser() {
  const addressBar = $('#addressBar');

  $('#btnGo').onclick = () => navigate(addressBar.value);
  addressBar.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      // 如果有选中的自动补全项，使用它
      const selected = $('#autocompleteDropdown .selected');
      if (selected && !$('#autocompleteDropdown').classList.contains('hidden')) {
        navigate(selected.dataset.url);
        hideAutocomplete();
        return;
      }
      navigate(addressBar.value);
      hideAutocomplete();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      navigateAutocomplete(e.key === 'ArrowDown' ? 1 : -1);
    } else if (e.key === 'Escape') {
      hideAutocomplete();
    }
  });
  addressBar.addEventListener('input', () => showAutocomplete(addressBar.value));
  addressBar.addEventListener('focus', () => { if (addressBar.value) showAutocomplete(addressBar.value); });
  $('#btnBack').onclick = () => { const t = activeTab(); if (t) t.webview.goBack(); };
  $('#btnFwd').onclick = () => { const t = activeTab(); if (t) t.webview.goForward(); };
  $('#btnReload').onclick = () => { const t = activeTab(); if (t) t.webview.reload(); };
  $('#btnNewTab').onclick = () => createTab(START_PAGE);
  $('#btnNewTabToolbar').onclick = () => createTab(START_PAGE);
  $('#btnBookmark').onclick = () => toggleBookmark();

  // 标签布局菜单
  const layoutBtn = $('#btnTabLayout');
  const layoutMenu = $('#tabLayoutMenu');
  layoutBtn.onclick = (e) => {
    e.stopPropagation();
    layoutMenu.classList.toggle('show');
    // 标记当前布局
    layoutMenu.querySelectorAll('.menu-item').forEach((item) => {
      item.classList.toggle('active', item.dataset.layout === browser.layout);
    });
  };
  layoutMenu.addEventListener('click', (e) => e.stopPropagation());
  layoutMenu.querySelectorAll('.menu-item').forEach((item) => {
    item.onclick = (e) => {
      e.preventDefault();
      browser.layout = item.dataset.layout;
      layoutMenu.classList.remove('show');
      applyTabLayout();
      renderTabBar();
    };
  });

  // 历史记录面板
  $('#btnHistory').onclick = (e) => {
    e.stopPropagation();
    $('#historyPanel').classList.toggle('hidden');
  };
  $('#btnClearHistory').onclick = (e) => {
    e.stopPropagation();
    clearBrowserHistory();
  };
  document.addEventListener('click', (e) => {
    const panel = $('#historyPanel');
    if (panel && !panel.contains(e.target) && e.target.id !== 'btnHistory') {
      panel.classList.add('hidden');
    }
    // 点击外部关闭自动补全
    const ac = $('#autocompleteDropdown');
    const ab = $('#addressBar');
    if (ac && !ac.contains(e.target) && e.target !== ab) {
      hideAutocomplete();
    }
    // 点击外部关闭标签布局菜单
    const layoutMenu = $('#tabLayoutMenu');
    if (layoutMenu && !layoutMenu.contains(e.target) && e.target.id !== 'btnTabLayout') {
      layoutMenu.classList.remove('show');
    }
  });

  // AI 侧边栏
  $('#btnAgentBrowse').onclick = () => {
    $('#aiSidebar').classList.remove('hidden');
  };
  $('#btnCloseSidebar').onclick = () => {
    $('#aiSidebar').classList.add('hidden');
  };
  $('#btnSidebarSend').onclick = sidebarAsk;
  $('#sidebarInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sidebarAsk(); }
  });

  // 默认打开一个标签
  applyTabLayout();
  createTab(START_PAGE);
}

function activeTab() {
  return browser.tabs.find((t) => t.id === browser.activeId) || null;
}

function createTab(url) {
  const id = 'tab-' + (++browser.seq);
  const tab = { id, title: '新标签页', url: url || START_PAGE, webview: null, thumb: null };

  const wv = document.createElement('webview');
  wv.className = 'webview';
  wv.setAttribute('allowpopups', '');
  wv.src = tab.url;
  tab.webview = wv;
  $('#vtabContent').appendChild(wv);

  wv.addEventListener('did-navigate', (e) => {
    tab.url = e.url;
    if (id === browser.activeId) { $('#addressBar').value = isStartPage(e.url) ? '' : e.url; updateBookmarkIcon(); }
    addBrowserHistory(e.url, tab.title);
  });
  wv.addEventListener('did-navigate-in-page', (e) => {
    tab.url = e.url;
    if (id === browser.activeId) { $('#addressBar').value = isStartPage(e.url) ? '' : e.url; updateBookmarkIcon(); }
    addBrowserHistory(e.url, tab.title);
  });
  wv.addEventListener('page-title-updated', (e) => {
    updateTabTitle(id, e.title || '新标签页');
  });
  wv.addEventListener('did-stop-loading', () => {
    captureThumb(id);
  });

  browser.tabs.push(tab);
  renderTabBar();
  switchTab(id);
  return tab;
}

function switchTab(id) {
  browser.activeId = id;
  browser.tabs.forEach((t) => {
    t.webview.classList.toggle('active', t.id === id);
  });
  renderTabBar();
  const tab = activeTab();
  if (tab) {
    $('#addressBar').value = isStartPage(tab.url) ? '' : (tab.url || '');
    document.title = `${tab.title || '新标签页'} - AgentBrowser`;
    updateBookmarkIcon();
  }
}

function closeTab(id) {
  const idx = browser.tabs.findIndex((t) => t.id === id);
  if (idx < 0) return;
  const tab = browser.tabs[idx];
  if (tab.webview && tab.webview.parentNode) tab.webview.parentNode.removeChild(tab.webview);
  browser.tabs.splice(idx, 1);
  if (browser.activeId === id) {
    const next = browser.tabs[Math.min(idx, browser.tabs.length - 1)];
    if (next) switchTab(next.id);
    else browser.activeId = null;
  }
  renderTabBar();
  if (browser.tabs.length === 0) {
    $('#addressBar').value = '';
    document.title = 'AgentBrowser';
  }
}

function updateTabTitle(id, title) {
  const tab = browser.tabs.find((t) => t.id === id);
  if (!tab) return;
  if (title && !isStartPage(title)) tab.title = title;
  const item = $('#vtabItem-' + id);
  if (item) {
    const t = item.querySelector('.vtab-title');
    if (t) t.textContent = tab.title || '新标签页';
  }
  if (id === browser.activeId) {
    document.title = `${tab.title || '新标签页'} - AgentBrowser`;
  }
}

async function captureThumb(id) {
  const tab = browser.tabs.find((t) => t.id === id);
  if (!tab || !tab.webview) return;
  // 隐藏的 webview（display:none）capturePage 会返回空，需临时显示再捕获
  const wasActive = tab.webview.classList.contains('active');
  if (!wasActive) tab.webview.classList.add('active');
  try {
    // 等待一帧让 webview 渲染
    await new Promise((r) => setTimeout(r, 150));
    const image = await tab.webview.capturePage();
    if (image && !image.isEmpty()) {
      tab.thumb = image.toDataURL();
      const item = $('#vtabItem-' + id);
      if (item) {
        const thumbBox = item.querySelector('.vtab-thumb');
        if (thumbBox) thumbBox.innerHTML = `<img src="${tab.thumb}" alt=""/>`;
      }
    }
  } catch (e) { /* 忽略捕获失败 */ }
  if (!wasActive) tab.webview.classList.remove('active');
}

/** 根据当前布局模式设置标签栏的 CSS 类 */
function applyTabLayout() {
  const bar = $('#vtabBar');
  const list = $('#vtabList');
  if (!bar || !list) return;
  // 清除所有布局类
  bar.className = 'vtab-bar';
  list.className = 'vtab-list';
  const layout = browser.layout || 'v-thumb';
  const isHorizontal = layout.startsWith('h-');
  const mode = layout.split('-')[1]; // text | thumb | image

  bar.classList.add('layout-' + layout);
  list.classList.add('layout-' + layout);

  if (isHorizontal) {
    bar.classList.add('horizontal');
    list.classList.add('horizontal');
  } else {
    bar.classList.add('vertical');
    list.classList.add('vertical');
  }
  bar.classList.add('mode-' + mode);
}

function renderTabBar() {
  const list = $('#vtabList');
  list.innerHTML = '';
  const layout = browser.layout || 'v-thumb';
  const mode = layout.split('-')[1]; // text | thumb | image

  browser.tabs.forEach((tab) => {
    const item = el('div', 'vtab-item' + (tab.id === browser.activeId ? ' active' : ''));
    item.id = 'vtabItem-' + tab.id;
    item.dataset.id = tab.id;

    // 图片/图文模式显示缩略图
    if (mode === 'thumb' || mode === 'image') {
      const thumb = el('div', 'vtab-thumb');
      if (tab.thumb) thumb.innerHTML = `<img src="${tab.thumb}" alt=""/>`;
      else thumb.textContent = '🌐';
      item.appendChild(thumb);
    }

    // 纯图片模式不显示标题
    if (mode !== 'image') {
      item.appendChild(el('div', 'vtab-title', tab.title || '新标签页'));
    }

    const close = el('button', 'vtab-close', '✕');
    close.title = '关闭标签';
    close.onclick = (e) => { e.stopPropagation(); closeTab(tab.id); };
    item.appendChild(close);

    item.onclick = () => switchTab(tab.id);
    item.addEventListener('mouseenter', (e) => showVtabPreview(tab, e));
    item.addEventListener('mousemove', (e) => moveVtabPreview(e));
    item.addEventListener('mouseleave', hideVtabPreview);

    list.appendChild(item);
  });
}

function showVtabPreview(tab, e) {
  if (!vtabPreview) {
    vtabPreview = document.createElement('div');
    vtabPreview.className = 'vtab-preview';
    document.body.appendChild(vtabPreview);
  }
  const img = tab.thumb ? `<img src="${tab.thumb}" alt=""/>` : '';
  vtabPreview.innerHTML = `${img}<div class="preview-title">${escapeHtml(tab.title || '新标签页')}</div>`;
  vtabPreview.style.display = 'block';
  moveVtabPreview(e);
}
function moveVtabPreview(e) {
  if (!vtabPreview) return;
  const x = e.clientX + 16;
  const y = e.clientY - 120;
  vtabPreview.style.left = Math.min(x, window.innerWidth - 380) + 'px';
  vtabPreview.style.top = Math.max(8, y) + 'px';
}
function hideVtabPreview() {
  if (vtabPreview) vtabPreview.style.display = 'none';
}

function navigate(url) {
  let tab = activeTab();
  if (!tab) { createTab(url); return; }
  let target = url.trim();
  if (!target) return;
  if (!/^https?:\/\//i.test(target)) {
    if (target.includes('.') && !target.includes(' ')) {
      target = 'https://' + target;
    } else {
      target = 'https://www.bing.com/search?q=' + encodeURIComponent(target);
    }
  }
  const wv = tab.webview;
  // 若 webview 尚未触发 dom-ready，先等待其就绪再导航
  if (!wv.getWebContentsId || wv.getWebContentsId() === 0) {
    wv.addEventListener('dom-ready', function onReady() {
      wv.removeEventListener('dom-ready', onReady);
      wv.loadURL(target);
    }, { once: true });
    return;
  }
  wv.loadURL(target);
}

// ---------- 浏览历史 ----------
async function addBrowserHistory(url, title) {
  if (!url || isStartPage(url)) return;
  // 去重：如果最近一条是同一个 URL，则更新时间而不重复添加
  const hist = state.browserHistory;
  if (hist.length > 0 && hist[0].url === url) {
    hist[0].time = Date.now();
    hist[0].title = title || hist[0].title;
  } else {
    hist.unshift({ url, title: title || url, time: Date.now() });
  }
  // 最多保留 10 条
  if (hist.length > 10) state.browserHistory = hist.slice(0, 10);
  await AB.storeSet('browserHistory', state.browserHistory);
  renderBrowserHistory();
}

function renderBrowserHistory() {
  const list = $('#historyList');
  if (!list) return;
  const hist = state.browserHistory || [];
  if (hist.length === 0) {
    list.innerHTML = '<div class="history-empty">暂无浏览历史</div>';
    return;
  }
  list.innerHTML = '';
  hist.forEach((h, i) => {
    const item = el('div', 'history-item');
    item.appendChild(el('span', 'hist-favicon', '🌐'));
    const info = el('div', 'hist-info');
    info.appendChild(el('div', 'hist-title', h.title || h.url));
    info.appendChild(el('div', 'hist-url', h.url));
    item.appendChild(info);
    const timeStr = new Date(h.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    item.appendChild(el('span', 'hist-time', timeStr));
    const del = el('button', 'hist-del', '✕');
    del.title = '删除此条';
    del.onclick = (e) => { e.stopPropagation(); deleteBrowserHistory(i); };
    item.appendChild(del);
    item.onclick = () => {
      $('#addressBar').value = h.url;
      navigate(h.url);
      $('#historyPanel').classList.add('hidden');
    };
    list.appendChild(item);
  });
}

async function deleteBrowserHistory(index) {
  state.browserHistory.splice(index, 1);
  await AB.storeSet('browserHistory', state.browserHistory);
  renderBrowserHistory();
}

async function clearBrowserHistory() {
  state.browserHistory = [];
  await AB.storeSet('browserHistory', []);
  renderBrowserHistory();
  toast('浏览历史已清空');
}

// ---------- 收藏书签 ----------
async function toggleBookmark() {
  const tab = activeTab();
  if (!tab || !tab.url || isStartPage(tab.url)) {
    toast('请先打开一个网页');
    return;
  }
  const url = tab.url;
  const title = tab.title || url;
  const bm = state.bookmarks || [];
  const idx = bm.findIndex(b => b.url === url);
  if (idx >= 0) {
    bm.splice(idx, 1);
    await AB.storeSet('bookmarks', bm);
    toast('已取消收藏');
  } else {
    bm.unshift({ url, title, time: Date.now() });
    await AB.storeSet('bookmarks', bm);
    toast('已收藏');
  }
  state.bookmarks = bm;
  updateBookmarkIcon();
}

function updateBookmarkIcon() {
  const tab = activeTab();
  const btn = $('#btnBookmark');
  if (!btn) return;
  const isBookmarked = tab && state.bookmarks.some(b => b.url === tab.url);
  btn.style.color = isBookmarked ? 'var(--accent-2)' : '';
}

async function deleteBookmark(index) {
  state.bookmarks.splice(index, 1);
  await AB.storeSet('bookmarks', state.bookmarks);
  updateBookmarkIcon();
}

// ---------- 地址栏自动补全 ----------
// 从收藏和历史记录中搜索，前缀优先 + 后缀补全，共显示 10 条
function showAutocomplete(query) {
  const dropdown = $('#autocompleteDropdown');
  if (!dropdown) return;
  const q = (query || '').trim().toLowerCase();
  if (!q) { hideAutocomplete(); return; }

  const bookmarks = state.bookmarks || [];
  const history = state.browserHistory || [];

  // 合并来源，标记类型
  const allItems = [
    ...bookmarks.map(b => ({ ...b, source: 'bookmark' })),
    ...history.map(h => ({ ...h, source: 'history' })),
  ];

  // 去重（同 URL 优先保留收藏）
  const seen = new Set();
  const deduped = [];
  for (const item of allItems) {
    const key = (item.url || '').toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  // 分级匹配：前缀匹配 > 后缀匹配 > 包含匹配
  const prefixMatches = [];
  const suffixMatches = [];
  const containsMatches = [];

  for (const item of deduped) {
    const url = (item.url || '').toLowerCase();
    const title = (item.title || '').toLowerCase();
    if (url.startsWith(q) || title.startsWith(q)) {
      prefixMatches.push(item);
    } else if (url.endsWith(q) || title.endsWith(q)) {
      suffixMatches.push(item);
    } else if (url.includes(q) || title.includes(q)) {
      containsMatches.push(item);
    }
  }

  // 合并：前缀优先，后缀次之，包含最后，共取 10 条
  const matches = [...prefixMatches, ...suffixMatches, ...containsMatches].slice(0, 10);
  if (matches.length === 0) { hideAutocomplete(); return; }

  dropdown.innerHTML = '';
  matches.forEach((h, i) => {
    const item = el('div', 'autocomplete-item');
    item.dataset.url = h.url;
    item.dataset.index = i;
    // 收藏用 ⭐，历史用 🌐
    const fav = el('span', 'ac-favicon', h.source === 'bookmark' ? '⭐' : '🌐');
    item.appendChild(fav);
    const text = el('div', 'ac-text');
    // 高亮匹配部分
    const title = h.title || h.url;
    const url = h.url;
    text.appendChild(el('div', 'ac-title', title));
    text.appendChild(el('div', 'ac-url', url));
    item.appendChild(text);
    // 收藏不显示时间，历史显示时间
    if (h.source === 'bookmark') {
      item.appendChild(el('span', 'ac-time', '收藏'));
    } else {
      const timeStr = new Date(h.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      item.appendChild(el('span', 'ac-time', timeStr));
    }
    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
      navigate(h.url);
      hideAutocomplete();
    });
    item.addEventListener('mouseenter', () => {
      dropdown.querySelectorAll('.autocomplete-item').forEach(x => x.classList.remove('selected'));
      item.classList.add('selected');
    });
    dropdown.appendChild(item);
  });
  dropdown.classList.remove('hidden');
}

function hideAutocomplete() {
  const dropdown = $('#autocompleteDropdown');
  if (dropdown) dropdown.classList.add('hidden');
}

function navigateAutocomplete(dir) {
  const dropdown = $('#autocompleteDropdown');
  if (!dropdown || dropdown.classList.contains('hidden')) return;
  const items = [...dropdown.querySelectorAll('.autocomplete-item')];
  if (items.length === 0) return;
  let curIdx = items.findIndex(x => x.classList.contains('selected'));
  let nextIdx = curIdx + dir;
  if (nextIdx < 0) nextIdx = items.length - 1;
  if (nextIdx >= items.length) nextIdx = 0;
  items.forEach(x => x.classList.remove('selected'));
  items[nextIdx].classList.add('selected');
  items[nextIdx].scrollIntoView({ block: 'nearest' });
}

async function sidebarAsk() {
  const input = $('#sidebarInput');
  const text = input.value.trim();
  if (!text) return;
  const chat = $('#sidebarChat');

  // 先显示用户消息（即使没有配置也能看到发送了什么）
  const userMsg = el('div', 'msg user');
  userMsg.appendChild(el('div', 'msg-bubble', text));
  chat.appendChild(userMsg);
  input.value = '';
  chat.scrollTop = chat.scrollHeight;

  // 优先使用下拉选择的模型，否则用系统默认
  const overrideConfig = await getOverrideModelConfig('#sidebarModel');
  const config = overrideConfig || getActiveModelConfig();
  // 首次对话时检查 Key，弹出设置弹窗
  const providerId = overrideConfig?.providerId || config?.providerId;
  if (!await ensureApiKey(providerId)) {
    const errMsg = el('div', 'msg assistant');
    const errBubble = el('div', 'msg-bubble', '⚠️ 请先设置 API Key 才能使用 AI 对话。');
    errMsg.appendChild(errBubble);
    chat.appendChild(errMsg);
    chat.scrollTop = chat.scrollHeight;
    return;
  }

  const url = $('#addressBar').value;
  const pageText = await getPageText();
  const assistantMsg = el('div', 'msg assistant typing');
  const bubble = el('div', 'msg-bubble', '');
  const indicator = document.createElement('div');
  indicator.className = 'typing-indicator';
  indicator.innerHTML = '<span></span><span></span><span></span>';
  const hint = el('div', 'thinking-hint', '');
  hint.appendChild(el('span', '', '思考中'));
  hint.appendChild(indicator);
  bubble.appendChild(hint);
  assistantMsg.appendChild(bubble);
  chat.appendChild(assistantMsg);
  chat.scrollTop = chat.scrollHeight;

  // 流式接收
  let streamed = '';
  let firstChunk = true;
  AB.onStreamChunk((chunk) => {
    if (firstChunk) { firstChunk = false; bubble.innerHTML = ''; assistantMsg.classList.remove('typing'); }
    streamed += chunk;
    bubble.innerHTML = renderMarkdown(streamed);
    chat.scrollTop = chat.scrollHeight;
  });
  const res = await AB.modelChatStream({
    provider: config.provider, config,
    messages: [{
      role: 'user',
      content: `当前网页地址：${url}\n网页内容摘要：${pageText.slice(0, 3000)}\n\n用户问题：${text}\n请结合网页内容回答。`,
    }],
    opts: { temperature: 0.5, maxTokens: 1000 },
  });
  AB.offStreamChunk();
  assistantMsg.classList.remove('typing');
  if (!res.ok) {
    bubble.textContent = '⚠️ ' + res.error;
  } else if (!streamed) {
    // 流式无内容，回退到非流式
    const res2 = await AB.modelChat({
      provider: config.provider, config,
      messages: [{
        role: 'user',
        content: `当前网页地址：${url}\n网页内容摘要：${pageText.slice(0, 3000)}\n\n用户问题：${text}\n请结合网页内容回答。`,
      }],
      opts: { temperature: 0.5, maxTokens: 1000 },
    });
    if (res2.ok) {
      streamed = res2.text;
      bubble.innerHTML = renderMarkdown(res2.text);
    } else {
      bubble.textContent = '⚠️ ' + res2.error;
    }
  }
  // 添加操作按钮
  if (streamed) {
    const actions = el('div', 'msg-actions');
    const copyBtn = el('button', '', '复制');
    copyBtn.onclick = () => { navigator.clipboard.writeText(streamed); toast('已复制'); };
    actions.appendChild(copyBtn);
    assistantMsg.appendChild(actions);
  }
  chat.scrollTop = chat.scrollHeight;
}

async function getPageText() {
  const tab = activeTab();
  if (!tab || !tab.webview) return '';
  try {
    const text = await tab.webview.executeJavaScript('document.body ? document.body.innerText.slice(0, 5000) : ""');
    return text || '';
  } catch (e) {
    return '';
  }
}

// ============================================================
// 首页统计 & 关于
// ============================================================
function renderHeroStats() {
  const stats = $('#heroStats');
  const items = [
    { num: '358+', label: '移动云模型' },
    { num: '6', label: '内置 Agent' },
    { num: '6', label: '服务领域' },
    { num: '∞', label: '自定义 Agent' },
  ];
  items.forEach((it) => {
    const s = el('div', 'stat');
    s.appendChild(el('div', 'stat-num', it.num));
    s.appendChild(el('div', 'stat-label', it.label));
    stats.appendChild(s);
  });
}

function renderAbout() {
  // 关于信息已移至菜单弹窗，此函数保留用于初始化时预加载
}

function openAboutDialog() {
  const existing = $('#aboutDialog');
  if (existing) existing.remove();

  const info = state.sysInfo || {};
  const rows = [
    ['版本', `v${info.appVersion || '1.0.0'}`],
    ['官网', 'AgentBrowser.com'],
    ['平台', `${info.platform || ''} ${info.arch || ''}`],
    ['Electron', info.electron || ''],
    ['Chromium', info.chrome || ''],
    ['Node', info.node || ''],
    ['系统', info.os || ''],
    ['CPU 核心', info.cpus || ''],
    ['内存', info.memory || ''],
  ];
  const rowsHtml = rows.map(([k, v]) =>
    `<div class="kv"><b>${k}</b><span>${escapeHtml(v)}</span></div>`
  ).join('');

  const dlg = document.createElement('div');
  dlg.id = 'aboutDialog';
  dlg.className = 'modal';
  dlg.innerHTML = `
    <div class="modal-box" style="max-width:480px;max-height:80vh;">
      <div class="modal-head">
        <span>ℹ️ 关于 AgentBrowser</span>
        <button class="modal-close" onclick="this.closest('.modal').remove()">✕</button>
      </div>
      <div class="modal-body" style="padding:16px;overflow-y:auto;">
        <div class="settings-about">${rowsHtml}
          <div class="about-license">
            <div class="license-title">📄 MIT License</div>
            <p class="license-text">Copyright (c) 2026 AgentBrowser</p>
            <p class="license-text">Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:</p>
            <p class="license-text">The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.</p>
            <p class="license-text">THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.</p>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(dlg);
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.remove(); });
}

// ============================================================
// 窗口控制（无边框窗口）
// ============================================================
function initWindowControls() {
  $('#btnWinMin').onclick = () => AB.winMinimize();
  $('#btnWinMax').onclick = () => AB.winMaximize();
  $('#btnWinClose').onclick = () => AB.winClose();
}

// ============================================================
// 竖形三点菜单
// ============================================================
function initMenu() {
  const btn = $('#btnMenu');
  const menu = $('#dropdownMenu');
  btn.onclick = (e) => {
    e.stopPropagation();
    menu.classList.toggle('show');
  };
  document.addEventListener('click', () => menu.classList.remove('show'));
  menu.addEventListener('click', (e) => e.stopPropagation());
  // GitHub 点赞
  $('#menuGithub').onclick = (e) => {
    e.preventDefault();
    AB.openExternal('https://github.com/in33/AgentBrowser');
    menu.classList.remove('show');
  };
  // Token 管理
  $('#menuKeySettings').onclick = (e) => {
    e.preventDefault();
    menu.classList.remove('show');
    switchView('tokens');
    renderTokenManagerList();
  };
  // 关于
  $('#menuAbout').onclick = (e) => {
    e.preventDefault();
    menu.classList.remove('show');
    openAboutDialog();
  };
  // 设置
  $('#menuSettings').onclick = (e) => {
    e.preventDefault();
    switchView('settings');
    menu.classList.remove('show');
  };
}

// ============================================================
// Token 管理（分组表格 + 批量填充 + 首次对话弹窗）
// ============================================================

/**
 * 获取所有接口的 Key 状态（从 SQLite 加载，不依赖静态文件中的 apiKey）
 */
async function loadAllKeyStates() {
  const presets = getAllInterfaces(true);
  const rows = await Promise.all(presets.map(async (p) => {
    const savedKey = await AB.dbGet('apiKey:' + p.id);
    const savedBaseUrl = await AB.dbGet('baseUrl:' + p.id);
    return {
      p,
      key: savedKey || '',
      baseUrl: savedBaseUrl || p.baseUrl || '',
      hasKey: !!savedKey,
    };
  }));
  return rows;
}

/**
 * 渲染 Token 管理页面 — 分组表格结构
 * 每个分组一个表格，表头：接口 | 状态 | API Key | Base URL | 操作
 * 同分组的接口共享一个「批量填充」输入框
 */
async function renderTokenManagerList() {
  const box = $('#tokenManagerList');
  if (!box) return;

  const rows = await loadAllKeyStates();
  if (rows.length === 0) {
    box.innerHTML = '<div style="color:var(--text-2);font-size:13px;text-align:center;padding:20px 0;">暂无接口</div>';
    return;
  }

  // 按分组组织
  const groups = {};
  rows.forEach((r) => {
    const g = r.p.group || '其他';
    if (!groups[g]) groups[g] = [];
    groups[g].push(r);
  });

  // 渲染每个分组的表格
  box.innerHTML = Object.entries(groups).map(([groupName, items]) => {
    const allSameBase = items.every(r => r.baseUrl === items[0].baseUrl);
    const tableRows = items.map((r) => `
      <tr data-pid="${r.p.id}">
        <td class="tt-name">${escapeHtml(r.p.name)}</td>
        <td class="tt-status"><span class="tt-dot ${r.hasKey ? 'on' : 'off'}"></span>${r.hasKey ? '已设置' : '未设置'}</td>
        <td class="tt-key">
          <div class="input-with-toggle" style="position:relative;">
            <input type="password" class="input tt-key-input" data-pid="${r.p.id}" value="${escapeHtml(r.key)}" placeholder="API Key…" style="font-size:12px;" />
            <button class="input-toggle-btn tt-key-toggle" data-pid="${r.p.id}" type="button">👁</button>
          </div>
        </td>
        <td class="tt-baseurl">
          <input type="text" class="input tt-baseurl-input" data-pid="${r.p.id}" value="${escapeHtml(r.baseUrl)}" placeholder="Base URL…" style="font-size:12px;" />
        </td>
        <td class="tt-actions">
          <button class="btn btn-ghost btn-sm tt-save-one" data-pid="${r.p.id}">保存</button>
        </td>
      </tr>
    `).join('');

    // 批量填充行：同分组共享一个 key 输入框，一键填充到该分组所有接口
    const batchRow = `
      <tr class="tt-batch-row">
        <td colspan="5">
          <div class="tt-batch-fill">
            <span class="tt-batch-label">批量填充本组：</span>
            <input type="text" class="input tt-batch-key" placeholder="输入 Key，点击填充到本组所有接口…" style="flex:1;font-size:12px;" />
            <button class="btn btn-ghost btn-sm tt-batch-apply">填充本组</button>
          </div>
        </td>
      </tr>
    `;

    return `
      <div class="tt-group">
        <div class="tt-group-head">
          <span class="tt-group-name">${escapeHtml(groupName)}</span>
          <span class="tt-group-count">${items.length} 个接口</span>
        </div>
        <table class="tt-table">
          <thead>
            <tr>
              <th>接口</th>
              <th>状态</th>
              <th>API Key</th>
              <th>Base URL</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
            ${batchRow}
          </tbody>
        </table>
      </div>
    `;
  }).join('');

  // 绑定事件
  bindTokenTableEvents(box);
}

/**
 * 绑定 Token 表格的事件
 */
function bindTokenTableEvents(box) {
  // 显示/隐藏 key
  box.querySelectorAll('.tt-key-toggle').forEach((btn) => {
    btn.onclick = () => {
      const pid = btn.dataset.pid;
      const input = box.querySelector(`.tt-key-input[data-pid="${pid}"]`);
      const visible = input.type === 'text';
      input.type = visible ? 'password' : 'text';
      btn.textContent = visible ? '👁' : '🙈';
    };
  });

  // 单行保存
  box.querySelectorAll('.tt-save-one').forEach((btn) => {
    btn.onclick = async () => {
      const pid = btn.dataset.pid;
      const keyInput = box.querySelector(`.tt-key-input[data-pid="${pid}"]`);
      const baseUrlInput = box.querySelector(`.tt-baseurl-input[data-pid="${pid}"]`);
      await AB.dbSet('apiKey:' + pid, keyInput.value.trim());
      await AB.dbSet('baseUrl:' + pid, baseUrlInput.value.trim());
      // 更新 modelConfig
      await syncModelConfigKey();
      toast('已保存');
      renderTokenManagerList();
    };
  });

  // 批量填充本组
  box.querySelectorAll('.tt-batch-apply').forEach((btn) => {
    btn.onclick = async () => {
      const group = btn.closest('.tt-group');
      const batchInput = group.querySelector('.tt-batch-key');
      const key = batchInput.value.trim();
      if (!key) { toast('请输入 Key'); return; }
      const keyInputs = group.querySelectorAll('.tt-key-input');
      for (const input of keyInputs) {
        input.value = key;
        const pid = input.dataset.pid;
        await AB.dbSet('apiKey:' + pid, key);
      }
      await syncModelConfigKey();
      toast(`已填充 ${keyInputs.length} 个接口`);
      renderTokenManagerList();
    };
  });
}

/**
 * 同步当前 modelConfig 的 apiKey（从 SQLite 重新加载）
 */
async function syncModelConfigKey() {
  if (state.modelConfig && state.modelConfig.providerId) {
    const updatedKey = await AB.dbGet('apiKey:' + state.modelConfig.providerId);
    const updatedBaseUrl = await AB.dbGet('baseUrl:' + state.modelConfig.providerId);
    if (updatedKey) state.modelConfig.apiKey = updatedKey;
    if (updatedBaseUrl) state.modelConfig.baseUrl = updatedBaseUrl;
    await AB.storeSet('modelConfig', state.modelConfig);
  }
}

/**
 * 首次对话 Key 设置弹窗
 * 当用户首次发起对话但未配置 Key 时弹出，引导用户快速填入 Key
 * @param {string} providerId - 当前选中的接口 ID
 * @returns {Promise<boolean>} true 表示用户已填入并保存了 Key
 */
async function openFirstRunKeyDialog(providerId) {
  const preset = getAllInterfaces(true).find((p) => p.id === providerId);
  if (!preset) return false;

  // 检查是否已有 key
  const existingKey = await AB.dbGet('apiKey:' + providerId);
  if (existingKey) return true;

  const existing = $('#firstRunKeyDialog');
  if (existing) existing.remove();

  return new Promise((resolve) => {
    const dlg = document.createElement('div');
    dlg.id = 'firstRunKeyDialog';
    dlg.className = 'modal';
    dlg.innerHTML = `
      <div class="modal-box" style="max-width:460px;">
        <div class="modal-head">
          <span>🔑 首次使用 — 请设置 API Key</span>
          <button class="modal-close" id="frkClose">✕</button>
        </div>
        <div class="modal-body" style="padding:20px;">
          <p style="font-size:13px;color:var(--text-1);margin-bottom:16px;line-height:1.6;">
            您正在使用 <b>${escapeHtml(preset.name)}</b>，但尚未配置 API Key。<br>
            请输入您的 Key 以开始对话（保存在本地 SQLite 中，不会上传）。
          </p>
          <div class="form-row">
            <label style="display:block;color:var(--text-1);font-size:13px;margin-bottom:6px;">API Key</label>
            <div class="input-with-toggle" style="position:relative;">
              <input type="password" class="input" id="frkKey" placeholder="sk-..." style="width:100%;" autofocus />
              <button class="input-toggle-btn" id="frkToggle" type="button">👁</button>
            </div>
          </div>
          ${preset.baseUrl ? `<p style="font-size:11px;color:var(--text-2);margin-top:8px;">Base URL: ${escapeHtml(preset.baseUrl)}</p>` : ''}
        </div>
        <div class="modal-actions" style="padding:0 20px 20px;">
          <button class="btn btn-ghost" id="frkSkip">跳过</button>
          <span style="flex:1"></span>
          <button class="btn btn-primary" id="frkSave">保存并继续</button>
        </div>
      </div>
    `;
    document.body.appendChild(dlg);

    const close = (result) => { dlg.remove(); resolve(result); };

    $('#frkClose').onclick = () => close(false);
    $('#frkSkip').onclick = () => close(false);
    dlg.addEventListener('click', (e) => { if (e.target === dlg) close(false); });

    $('#frkToggle').onclick = () => {
      const input = $('#frkKey');
      const visible = input.type === 'text';
      input.type = visible ? 'password' : 'text';
      $('#frkToggle').textContent = visible ? '👁' : '🙈';
    };

    $('#frkSave').onclick = async () => {
      const key = $('#frkKey').value.trim();
      if (!key) { toast('请输入 API Key'); return; }
      await AB.dbSet('apiKey:' + providerId, key);
      // 更新 modelConfig
      if (state.modelConfig && state.modelConfig.providerId === providerId) {
        state.modelConfig.apiKey = key;
        await AB.storeSet('modelConfig', state.modelConfig);
      }
      toast('Key 已保存');
      close(true);
    };

    // Enter 键保存
    $('#frkKey').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); $('#frkSave').click(); }
    });

    $('#frkKey').focus();
  });
}

/**
 * 检查当前模型是否已配置 API Key
 * 首次对话时弹出 Key 设置弹窗，引导用户填入 Key
 * @param {string} [providerId] - 可选：指定接口 ID，不传则用当前 modelConfig
 * @returns {Promise<boolean>} true 表示已配置可用
 */
async function ensureApiKey(providerId) {
  // 确定当前使用的接口 ID
  const config = getActiveModelConfig();
  const pid = providerId || config?.providerId;
  if (!pid) {
    toast('请先选择一个模型接口');
    switchView('tokens');
    return false;
  }
  // 检查 SQLite 中是否已有 Key
  const savedKey = await AB.dbGet('apiKey:' + pid);
  if (savedKey) {
    // 同步到 modelConfig
    if (config && config.providerId === pid) {
      config.apiKey = savedKey;
    }
    return true;
  }
  // 首次使用：弹出 Key 设置弹窗
  const ok = await openFirstRunKeyDialog(pid);
  if (ok) {
    // 重新加载 modelConfig
    const newKey = await AB.dbGet('apiKey:' + pid);
    if (config && config.providerId === pid && newKey) {
      config.apiKey = newKey;
    }
    return true;
  }
  return false;
}

// ============================================================
// 浮动 AI 助手面板
// ============================================================
function initAiPanel() {
  $('#aiFab').onclick = () => {
    $('#aiPanel').classList.remove('hidden');
    $('#aiFab').classList.add('hidden');
    renderAiPanelMessages();
  };
  $('#btnCloseAiPanel').onclick = () => {
    $('#aiPanel').classList.add('hidden');
    $('#aiFab').classList.remove('hidden');
  };
  $('#btnAiPanelSend').onclick = sendAiPanelMessage;
  $('#btnAiPanelSettings').onclick = () => switchView('tokens');
  $('#aiPanelInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAiPanelMessage(); }
  });
  populateAiPanelModelSelect();
  populateSidebarModelSelect();
  populateTaskModelSelect();
}

/** 获取排序后的接口列表（置顶在前，再按分组） */
function getSortedInterfaces(includeHidden = false) {
  const all = getAllInterfaces(includeHidden);
  // 置顶的排前面
  const pinned = all.filter((p) => state.pinnedInterfaces.includes(p.id));
  const rest = all.filter((p) => !state.pinnedInterfaces.includes(p.id));
  return { pinned, rest, all };
}

/** 生成模型选项 HTML（系统默认 + 分组列表，含置顶分组） */
function buildModelOptionsHTML() {
  const { pinned, rest } = getSortedInterfaces(true);
  const currentConfig = state.modelConfig || {};
  const currentName = currentConfig.name || '系统默认';
  let html = `<option value="__default__">系统默认（${escapeHtml(currentName)}）</option>`;
  // 置顶分组
  if (pinned.length > 0) {
    html += `<optgroup label="📌 置顶">`;
    pinned.forEach((p) => {
      html += `<option value="${p.id}">${escapeHtml(p.name)}</option>`;
    });
    html += '</optgroup>';
  }
  // 其余按原分组
  const groups = {};
  rest.forEach((p) => {
    const g = p.group || '其他';
    if (!groups[g]) groups[g] = [];
    groups[g].push(p);
  });
  for (const [gname, items] of Object.entries(groups)) {
    html += `<optgroup label="${escapeHtml(gname)}">`;
    items.forEach((p) => {
      html += `<option value="${p.id}">${escapeHtml(p.name)}</option>`;
    });
    html += '</optgroup>';
  }
  return html;
}

/** 构建自定义下拉选择器（支持置顶按钮） */
function buildModelPicker(container, selectEl, includeDefault = true) {
  if (!container) return;
  container.innerHTML = '';
  const { pinned, rest } = getSortedInterfaces(true);
  const currentConfig = state.modelConfig || {};
  const currentName = currentConfig.name || '系统默认';

  // trigger 按钮
  const trigger = document.createElement('div');
  trigger.className = 'model-picker-trigger';
  const labelSpan = document.createElement('span');
  labelSpan.className = 'mp-label';
  const arrow = document.createElement('span');
  arrow.className = 'mp-arrow';
  arrow.textContent = '▼';
  trigger.appendChild(labelSpan);
  trigger.appendChild(arrow);
  container.appendChild(trigger);

  // dropdown 面板
  const dropdown = document.createElement('div');
  dropdown.className = 'model-picker-dropdown';
  container.appendChild(dropdown);

  function updateLabel() {
    const val = selectEl.value;
    if (!val || val === '__default__') {
      labelSpan.textContent = `系统默认（${currentName}）`;
    } else {
      const p = getAllInterfaces(true).find((x) => x.id === val);
      labelSpan.textContent = p ? p.name : val;
    }
  }

  function buildDropdown() {
    dropdown.innerHTML = '';
    // 系统默认
    if (includeDefault) {
      const defItem = document.createElement('div');
      defItem.className = 'mp-item' + (selectEl.value === '__default__' || !selectEl.value ? ' selected' : '');
      const defName = document.createElement('span');
      defName.className = 'mp-name';
      defName.textContent = `系统默认（${currentName}）`;
      defItem.appendChild(defName);
      defItem.onclick = (e) => {
        e.stopPropagation();
        selectEl.value = '__default__';
        updateLabel();
        closeDropdown();
        if (selectEl.onchange) selectEl.onchange();
      };
      dropdown.appendChild(defItem);
    }

    // 置顶分组
    if (pinned.length > 0) {
      const gLabel = document.createElement('div');
      gLabel.className = 'mp-group-label';
      gLabel.textContent = '📌 置顶';
      dropdown.appendChild(gLabel);
      pinned.forEach((p) => dropdown.appendChild(makeItem(p)));
      const sep = document.createElement('div');
      sep.className = 'mp-sep';
      dropdown.appendChild(sep);
    }

    // 其余按分组
    const groups = {};
    rest.forEach((p) => {
      const g = p.group || '其他';
      if (!groups[g]) groups[g] = [];
      groups[g].push(p);
    });
    for (const [gname, items] of Object.entries(groups)) {
      const gLabel = document.createElement('div');
      gLabel.className = 'mp-group-label';
      gLabel.textContent = gname;
      dropdown.appendChild(gLabel);
      items.forEach((p) => dropdown.appendChild(makeItem(p)));
    }
  }

  function makeItem(p) {
    const item = document.createElement('div');
    item.className = 'mp-item' + (selectEl.value === p.id ? ' selected' : '');
    const name = document.createElement('span');
    name.className = 'mp-name';
    name.textContent = p.name;
    item.appendChild(name);
    // 置顶按钮
    const pinBtn = document.createElement('button');
    pinBtn.className = 'mp-pin' + (state.pinnedInterfaces.includes(p.id) ? ' pinned' : '');
    pinBtn.title = state.pinnedInterfaces.includes(p.id) ? '取消置顶' : '置顶';
    pinBtn.innerHTML = state.pinnedInterfaces.includes(p.id) ? '★' : '☆';
    pinBtn.onclick = (e) => {
      e.stopPropagation();
      togglePinInterface(p.id);
    };
    item.appendChild(pinBtn);
    item.onclick = () => {
      selectEl.value = p.id;
      updateLabel();
      closeDropdown();
      if (selectEl.onchange) selectEl.onchange();
    };
    return item;
  }

  function openDropdown() {
    buildDropdown();
    // 用 fixed 定位 + 手动计算坐标，避免被父容器 overflow:hidden 裁剪
    const rect = trigger.getBoundingClientRect();
    const isAiPanel = container.closest('.ai-panel');
    const vw = window.innerWidth, vh = window.innerHeight;
    dropdown.style.position = 'fixed';
    // 先临时显示以测量菜单尺寸
    dropdown.style.visibility = 'hidden';
    dropdown.classList.add('show');
    const dw = dropdown.offsetWidth;
    const dh = dropdown.offsetHeight;
    dropdown.classList.remove('show');
    dropdown.style.visibility = '';
    // 计算位置，确保不超出屏幕
    let left = rect.left;
    let top;
    if (isAiPanel) {
      // AI 面板：向上展开
      top = rect.top - dh - 4;
      if (top < 8) top = 8; // 不够高就改为向下
    } else {
      top = rect.bottom + 4;
      if (top + dh > vh - 8) top = Math.max(8, rect.top - dh - 4); // 向上翻转
    }
    if (left + dw > vw - 8) left = vw - dw - 8;
    if (left < 8) left = 8;
    dropdown.style.top = top + 'px';
    dropdown.style.bottom = 'auto';
    dropdown.style.left = left + 'px';
    dropdown.style.width = Math.max(rect.width, 200) + 'px';
    dropdown.classList.add('show');
  }
  function closeDropdown() {
    dropdown.classList.remove('show');
  }
  function toggleDropdown() {
    if (dropdown.classList.contains('show')) closeDropdown();
    else openDropdown();
  }

  trigger.onclick = (e) => {
    e.stopPropagation();
    toggleDropdown();
  };
  // 点击外部关闭
  document.addEventListener('click', closeDropdown);

  updateLabel();
  // 暴露刷新方法
  container._refreshPicker = () => {
    updateLabel();
  };
}

/** 切换接口置顶状态 */
async function togglePinInterface(id) {
  if (state.pinnedInterfaces.includes(id)) {
    state.pinnedInterfaces = state.pinnedInterfaces.filter((x) => x !== id);
    toast('已取消置顶');
  } else {
    state.pinnedInterfaces.push(id);
    toast('已置顶');
  }
  await AB.storeSet('pinnedInterfaces', state.pinnedInterfaces);
  refreshAllModelSelects();
}

function populateAiPanelModelSelect() {
  const sel = $('#aiPanelModel');
  if (!sel) return;
  sel.innerHTML = buildModelOptionsHTML();
  const container = document.querySelector('.model-picker[data-target="aiPanelModel"]');
  if (container) buildModelPicker(container, sel, true);
}

function populateSidebarModelSelect() {
  const sel = $('#sidebarModel');
  if (!sel) return;
  sel.innerHTML = buildModelOptionsHTML();
  const container = document.querySelector('.model-picker[data-target="sidebarModel"]');
  if (container) buildModelPicker(container, sel, true);
}

function populateTaskModelSelect() {
  const sel = $('#taskModel');
  if (!sel) return;
  sel.innerHTML = buildModelOptionsHTML();
  const container = document.querySelector('.model-picker[data-target="taskModel"]');
  if (container) buildModelPicker(container, sel, true);
}

/** 刷新所有模型下拉选择框（设置页、AI面板、侧边栏、Agent工作台） */
function refreshAllModelSelects() {
  populateProviderSelect();
  populateAiPanelModelSelect();
  populateSidebarModelSelect();
  populateTaskModelSelect();
}

function renderAiPanelMessages() {
  const box = $('#aiPanelChat');
  box.innerHTML = '';
  if (state.aiPanelMessages.length === 0) {
    box.appendChild(el('div', 'msg system', '有什么可以帮你的？ ✨'));
    return;
  }
  state.aiPanelMessages.forEach((m, i) => {
    if (m.role === 'system') return;
    const msg = el('div', `msg ${m.role}`);
    const bubble = el('div', 'msg-bubble');
    bubble.innerHTML = m.role === 'assistant' ? renderMarkdown(m.content) : escapeHtml(m.content);
    msg.appendChild(bubble);
    if (m.role === 'assistant' && m.content) {
      const actions = el('div', 'msg-actions');
      const copyBtn = el('button', '', '复制');
      copyBtn.onclick = () => { navigator.clipboard.writeText(m.content); toast('已复制'); };
      actions.appendChild(copyBtn);
      msg.appendChild(actions);
    }
    box.appendChild(msg);
  });
  box.scrollTop = box.scrollHeight;
}

async function sendAiPanelMessage() {
  const input = $('#aiPanelInput');
  const text = input.value.trim();
  if (!text || state.aiPanelSending) return;
  // 优先使用下拉选择的模型，否则用系统默认
  const overrideConfig = await getOverrideModelConfig('#aiPanelModel');
  const config = overrideConfig || getActiveModelConfig();
  // 首次对话时检查 Key，弹出设置弹窗
  const providerId = overrideConfig?.providerId || config?.providerId;
  if (!await ensureApiKey(providerId)) return;
  state.aiPanelMessages.push({ role: 'user', content: text });
  input.value = '';
  state.aiPanelSending = true;
  renderAiPanelMessages();

  // 占位 assistant 消息
  const assistantMsg = { role: 'assistant', content: '' };
  state.aiPanelMessages.push(assistantMsg);
  const box = $('#aiPanelChat');
  const msgEl = el('div', 'msg assistant typing');
  const bubble = el('div', 'msg-bubble', '');
  const indicator = document.createElement('div');
  indicator.className = 'typing-indicator';
  indicator.innerHTML = '<span></span><span></span><span></span>';
  const hint = el('div', 'thinking-hint', '');
  hint.appendChild(el('span', '', '思考中'));
  hint.appendChild(indicator);
  bubble.appendChild(hint);
  msgEl.appendChild(bubble);
  box.appendChild(msgEl);
  box.scrollTop = box.scrollHeight;

  // 流式接收
  let streamed = '';
  let firstChunk = true;
  AB.onStreamChunk((chunk) => {
    if (firstChunk) { firstChunk = false; bubble.innerHTML = ''; msgEl.classList.remove('typing'); }
    streamed += chunk;
    assistantMsg.content = streamed;
    bubble.innerHTML = renderMarkdown(streamed);
    box.scrollTop = box.scrollHeight;
  });
  const res = await AB.modelChatStream({
    provider: config.provider, config,
    messages: state.aiPanelMessages.filter((m) => m.content),
    opts: { temperature: 0.7, maxTokens: 1500 },
  });
  AB.offStreamChunk();
  state.aiPanelSending = false;
  msgEl.classList.remove('typing');
  if (!res.ok) {
    state.aiPanelMessages.pop();
    bubble.innerHTML = `<span style="color:var(--danger)">⚠️ ${escapeHtml(res.error)}</span>`;
  } else if (!streamed) {
    // 流式无内容，回退到非流式
    const res2 = await AB.modelChat({
      provider: config.provider, config,
      messages: state.aiPanelMessages.filter((m) => m.content),
      opts: { temperature: 0.7, maxTokens: 1500 },
    });
    if (res2.ok) {
      assistantMsg.content = res2.text;
      bubble.innerHTML = renderMarkdown(res2.text);
    } else {
      state.aiPanelMessages.pop();
      bubble.innerHTML = `<span style="color:var(--danger)">⚠️ ${escapeHtml(res2.error)}</span>`;
    }
  }
  // 添加操作按钮
  if (assistantMsg.content) {
    const actions = el('div', 'msg-actions');
    const copyBtn = el('button', '', '复制');
    copyBtn.onclick = () => { navigator.clipboard.writeText(assistantMsg.content); toast('已复制'); };
    actions.appendChild(copyBtn);
    msgEl.appendChild(actions);
  }
  box.scrollTop = box.scrollHeight;
}

// ============================================================
// 全屏时钟
// ============================================================
function updateFsClock() {
  const fsClock = $('#fsClock');
  if (!fsClock) return;
  if (document.fullscreenElement) {
    fsClock.classList.remove('hidden');
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    $('#fsClockTime').textContent = `${hh}:${mm}:${ss}`;
    const week = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()];
    $('#fsClockDate').textContent = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 · 星期${week}`;
  } else {
    fsClock.classList.add('hidden');
  }
}

// ============================================================
// 移动云增值服务
// ============================================================
async function loadEcloudServices() {
  state.ecloudData = await AB.ecloudServices();
  renderEcloudServices();
}

function renderEcloudServices() {
  const body = $('#ecloudBody');
  if (!body) return;
  const data = state.ecloudData;
  if (!data) { body.innerHTML = '<div class="ecloud-empty">正在加载移动云服务数据…</div>'; return; }

  // 统计栏
  const statsBar = $('#ecloudStatsBar');
  if (statsBar) {
    statsBar.innerHTML = '';
    const stats = [
      { num: data.stats.total, label: '可用模型' },
      { num: data.stats.providers, label: '模型服务商' },
      { num: data.stats.families, label: '模型家族' },
      { num: data.stats.domains, label: '服务领域' },
    ];
    stats.forEach((s) => {
      const item = el('div', 'ecloud-stat-item');
      item.appendChild(el('div', 'ecloud-stat-num', s.num));
      item.appendChild(el('div', 'ecloud-stat-label', s.label));
      statsBar.appendChild(item);
    });
  }

  // 分类卡片
  body.innerHTML = '';
  data.categories.forEach((cat) => {
    const section = el('div', 'ecloud-category');
    const head = el('div', 'ecloud-cat-head');
    const icon = el('span', 'ecloud-cat-icon', cat.icon);
    const info = el('div', 'ecloud-cat-info');
    info.appendChild(el('h3', '', cat.name));
    info.appendChild(el('p', 'ecloud-cat-desc', cat.desc));
    head.appendChild(icon);
    head.appendChild(info);
    section.appendChild(head);

    const grid = el('div', 'ecloud-model-grid');
    cat.models.forEach((m) => {
      const card = el('div', 'ecloud-model-card');
      const top = el('div', 'ecloud-model-top');
      top.appendChild(el('div', 'ecloud-model-name', m.name));
      const fam = el('span', 'ecloud-model-family', m.family);
      top.appendChild(fam);
      card.appendChild(top);

      const meta = el('div', 'ecloud-model-meta');
      if (m.ctx && m.ctx !== '—') {
        const ctxItem = el('span', 'ecloud-meta-tag', '📋 ' + m.ctx + ' 上下文');
        meta.appendChild(ctxItem);
      }
      m.features.forEach((f) => {
        const tag = el('span', 'ecloud-meta-tag', '✦ ' + f);
        meta.appendChild(tag);
      });
      card.appendChild(meta);

      const price = el('div', 'ecloud-model-price');
      const inP = el('span', '', '输入: ¥' + m.input + (m.input !== '—' ? '/' + m.unit : ''));
      const outP = el('span', '', '输出: ¥' + m.output + (m.output !== '—' ? '/' + m.unit : ''));
      price.appendChild(inP);
      price.appendChild(outP);
      card.appendChild(price);

      grid.appendChild(card);
    });
    section.appendChild(grid);
    body.appendChild(section);
  });
}

// ============================================================
// 事件绑定
// ============================================================
function bindEvents() {
  // 导航
  $$('.nav-btn').forEach((b) => b.onclick = () => switchView(b.dataset.view));
  $$('[data-goto]').forEach((b) => b.onclick = () => switchView(b.dataset.goto));
  $('#brand').onclick = () => switchView('home');

  // 全屏
  $('#btnFullscreen').onclick = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  };
  document.addEventListener('fullscreenchange', () => {
    updateFsClock();
    if (document.fullscreenElement) {
      // 全屏时显示时钟
      updateFsClock();
    } else {
      $('#fsClock').classList.add('hidden');
    }
  });

  // 设置
  $('#btnSaveModel').onclick = saveModelConfig;
  $('#btnTestModel').onclick = testModel;
  $('#btnAddInterface').onclick = addCustomInterface;
  $('#btnToggleApiKey').onclick = () => {
    const inp = $('#settingsApiKey');
    const btn = $('#btnToggleApiKey');
    if (inp.type === 'password') {
      inp.type = 'text';
      btn.textContent = '🙈';
    } else {
      inp.type = 'password';
      btn.textContent = '👁';
    }
  };
  $('#btnOpenTokenDialog').onclick = () => renderTokenManagerList();

  // 主题切换
  $('#themeDark').onclick = async () => { applyTheme('dark'); await AB.storeSet('theme', 'dark'); };
  $('#themeLight').onclick = async () => { applyTheme('light'); await AB.storeSet('theme', 'light'); };

  // Agent
  $('#btnNewAgent').onclick = () => openAgentEditor();
  $('#btnStopAgent').onclick = () => { state.agentStop = true; };
  $('#btnClearResults').onclick = clearAgentResults;
  $('#btnSendTask').onclick = () => sendTask();
  $('#taskInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      sendTask();
    }
  });

  // 模态框
  $('#btnModalClose').onclick = () => $('#modal').classList.add('hidden');
  $('#modal').addEventListener('click', (e) => {
    if (e.target === $('#modal')) $('#modal').classList.add('hidden');
  });

  // 浏览器
  initBrowser();

  // 移动云增值服务
  $('#btnEcloudLink').onclick = () => {
    if (state.ecloudData && state.ecloudData.url) AB.openExternal(state.ecloudData.url);
  };
}

// ============================================================
// 启动
// ============================================================
window.addEventListener('DOMContentLoaded', init);
