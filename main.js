/**
 * AgentBrowser - Electron 主进程
 * 负责：窗口管理、模型 API 代理（避免 CORS）、文件系统、插件加载、本地存储
 */
const { app, BrowserWindow, ipcMain, shell, dialog, Menu, globalShortcut, nativeImage, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// ---------- SQLite ----------
let Database;
try {
  Database = require('better-sqlite3');
} catch (e) {
  console.error('better-sqlite3 not installed, token storage disabled:', e.message);
}
let db = null;

function initDb() {
  if (!Database) return;
  try {
    const dbPath = path.join(userDataDir, 'agentbrowser.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.exec(`
      CREATE TABLE IF NOT EXISTS kv_store (
        key   TEXT PRIMARY KEY,
        value TEXT
      );
    `);
  } catch (e) {
    console.error('SQLite init failed, token storage disabled:', e.message);
    db = null;
  }
}

function dbGet(key) {
  if (!db) return null;
  const row = db.prepare('SELECT value FROM kv_store WHERE key = ?').get(key);
  return row ? row.value : null;
}

function dbSet(key, value) {
  if (!db) return;
  db.prepare('INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)').run(key, value);
}

const isDev = process.argv.includes('--dev');
const APP_NAME = 'AgentBrowser';

// ---------- 数据目录 ----------
const userDataDir = path.join(app.getPath('userData'));
const dataDir = path.join(userDataDir, 'data');
const pluginsDir = path.join(userDataDir, 'plugins');
const projectsDir = path.join(userDataDir, 'projects');

function ensureDirs() {
  [dataDir, pluginsDir, projectsDir].forEach((d) => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });
  // 首次运行：写入示例项目
  const sampleIndex = path.join(projectsDir, 'index.html');
  if (!fs.existsSync(sampleIndex)) {
    const sampleSrc = path.join(__dirname, 'src', 'sample', 'index.html');
    if (fs.existsSync(sampleSrc)) {
      fs.copyFileSync(sampleSrc, sampleIndex);
    }
  }
}

// ---------- 窗口 ----------
let mainWindow = null;

function createWindow() {
  // 加载应用图标
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  const icon = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : undefined;

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#07070f',
    title: APP_NAME,
    icon: icon,
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
      webviewTag: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  // 调试模式：启用右键菜单（DevTools 通过 Ctrl+Shift+Alt+F12 快捷键打开）
  if (isDev) {
    mainWindow.webContents.on('context-menu', (e, params) => {
      e.preventDefault();
      Menu.buildFromTemplate([
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'inspectElement', click: () => mainWindow.webContents.inspectElement(params.x, params.y) },
      ]).popup(mainWindow);
    });
  }

  // 外部链接用系统浏览器打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });

  // 全局快捷键 Ctrl+Shift+Alt+F12 切换 DevTools（打包后也可用）
  globalShortcut.register('Ctrl+Shift+Alt+F12', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.toggleDevTools();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 注册 agentbrowser:// 自定义协议（必须在 app.ready 之前）
protocol.registerSchemesAsPrivileged([
  { scheme: 'agentbrowser', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

app.whenReady().then(() => {
  protocol.registerFileProtocol('agentbrowser', (request, callback) => {
    const url = request.url.replace('agentbrowser://', '');
    if (url === 'start' || url === 'start/') {
      callback(path.join(__dirname, 'src', 'startpage.html'));
    } else if (url.startsWith('start/assets/')) {
      const rel = url.slice('start/'.length);
      callback(path.join(__dirname, rel));
    } else {
      callback();
    }
  });
  ensureDirs();
  initDb();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll();
  if (process.platform !== 'darwin') app.quit();
});

// ---------- 工具 ----------
function readJson(file, fallback) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    console.error('readJson error', file, e.message);
  }
  return fallback;
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

// ---------- 本地存储 ----------
ipcMain.handle('store:get', (_e, key) => {
  const file = path.join(dataDir, `${key}.json`);
  return readJson(file, null);
});

ipcMain.handle('store:set', (_e, key, value) => {
  const file = path.join(dataDir, `${key}.json`);
  writeJson(file, value);
  return true;
});

// ---------- 模型 API 代理 ----------
/**
 * 统一模型调用。支持 provider:
 *  - openai   : OpenAI 兼容接口 (baseUrl + apiKey + model)
 *  - anthropic: Anthropic Messages API
 *  - gemini   : Google Gemini API
 *  - ollama   : 本地 Ollama
 *  - custom   : 自定义 OpenAI 兼容
 */
async function callModel(provider, cfg, messages, opts = {}) {
  const { temperature = 0.7, maxTokens = 2048, stream = false } = opts     ;
  const timeoutMs = 120000;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    if (provider === 'anthropic') {
      const url = (cfg.baseUrl || 'https://api.anthropic.com/v1/messages').replace(/\/$/, '');
      const body = {
        model: cfg.model,
        max_tokens: maxTokens,
        temperature,
        messages: messages.map((m) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        })),
      };
      if (cfg.system) body.system = cfg.system;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': cfg.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
      const data = await res.json();
      const text = (data.content || [])
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('');
      return { text, raw: data };
    }

    if (provider === 'gemini') {
      const base = (cfg.baseUrl || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, '');
      const url = `${base}/models/${cfg.model}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`;
      const body = {
        contents: messages
          .filter((m) => m.role !== 'system')
          .map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
          })),
        generationConfig: { temperature, maxOutputTokens: maxTokens },
      };
      if (cfg.system) body.systemInstruction = { parts: [{ text: cfg.system }] };
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Gemini API ${res.status}: ${await res.text()}`);
      const data = await res.json();
      const text = (data.candidates?.[0]?.content?.parts || [])
        .map((p) => p.text || '')
        .join('');
      return { text, raw: data };
    }

    // openai / ollama / custom —— 统一 OpenAI 兼容格式
    const base = (cfg.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
    const url = `${base}/chat/completions`;
    const body = {
      model: cfg.model,
      messages: [
        ...(cfg.system ? [{ role: 'system', content: cfg.system }] : []),
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      temperature,
      max_tokens: maxTokens,
      stream,
    };
    const headers = { 'Content-Type': 'application/json' };
    if (cfg.apiKey) headers['Authorization'] = `Bearer ${cfg.apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Model API ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '';
    return { text, raw: data };
  } finally {
    clearTimeout(timeout);
  }
}

ipcMain.handle('model:chat', async (_e, { provider, config, messages, opts }) => {
  try {
    const result = await callModel(provider, config, messages, opts);
    return { ok: true, ...result };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// 流式对话
ipcMain.handle('model:chat-stream', async (e, { provider, config, messages, opts }) => {
  const { temperature = 0.7, maxTokens = 2048 } = opts || {};
  const timeoutMs = 120000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    if (provider === 'anthropic') {
      const url = (config.baseUrl || 'https://api.anthropic.com/v1/messages').replace(/\/$/, '');
      const body = {
        model: config.model, max_tokens: maxTokens, temperature, stream: true,
        messages: messages.filter(m => m.role !== 'system').map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
      };
      if (config.system) body.system = config.system;
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': config.apiKey, 'anthropic-version': '2023-06-01' }, body: JSON.stringify(body), signal: controller.signal });
      if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop();
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const json = JSON.parse(line.slice(6));
              if (json.type === 'content_block_delta' && json.delta?.text) {
                e.sender.send('model:stream-chunk', json.delta.text);
              }
            } catch {}
          }
        }
      }
      return { ok: true };
    }
    if (provider === 'gemini') {
      // Gemini 流式 (streamGenerateContent)
      const base = (config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, '');
      const url = `${base}/models/${config.model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(config.apiKey)}`;
      const body = {
        contents: messages.filter(m => m.role !== 'system').map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        generationConfig: { temperature, maxOutputTokens: maxTokens },
      };
      if (config.system) body.systemInstruction = { parts: [{ text: config.system }] };
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal });
      if (!res.ok) throw new Error(`Gemini API ${res.status}: ${await res.text()}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop();
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const json = JSON.parse(line.slice(6));
              const text = (json.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
              if (text) e.sender.send('model:stream-chunk', text);
            } catch {}
          }
        }
      }
      return { ok: true };
    }
    // openai / ollama / custom — OpenAI 兼容流式
    const base = (config.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
    const url = `${base}/chat/completions`;
    const body = {
      model: config.model,
      messages: [
        ...(config.system ? [{ role: 'system', content: config.system }] : []),
        ...messages.map(m => ({ role: m.role, content: m.content })),
      ],
      temperature, max_tokens: maxTokens, stream: true,
    };
    const headers = { 'Content-Type': 'application/json' };
    if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal });
    if (!res.ok) throw new Error(`Model API ${res.status}: ${await res.text()}`);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) e.sender.send('model:stream-chunk', delta);
          } catch {}
        }
      }
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    clearTimeout(timeout);
  }
});

// 模型列表（内置预设 — 全部来自移动云 ecloud.10086.cn 平台）
ipcMain.handle('models:presets', () => {
  return [
    // ===== 移动云·智算（呼和浩特节点） — 文本对话类 =====
    { id: 'ecloud-hh-text', name: '移动云·智算（文本对话·呼和浩特）', provider: 'openai', group: '移动云', baseUrl: 'https://zhenze-huhehaote.cmecloud.cn/v1', models: [
      'DeepSeek-V4-Flash-0731', 'GLM-5.3-Flash', 'GLM-5.3', 'GLM-5.2', 'GLM-5.1',
      'DeepSeek-V3.2', 'DeepSeek-V3.1', 'DeepSeek-V3', 'DeepSeek-V3-0324', 'DeepSeek-R1', 'DeepSeek-R1-0528',
      'Qwen3.7-Max', 'Qwen3.6-Plus', 'Qwen3.5-Plus', 'Qwen3-235B-A22B', 'Qwen3-32B', 'QwQ-32B',
      'Kimi-K2.6', 'Kimi-K2.7-code', 'MiniMax-M3', 'minimax-m2.5',
      'DeepSeek-R1-Distill-Qwen-32B', 'DeepSeek-R1-Distill-Qwen-14B', 'DeepSeek-R1-Distill-Llama-70B', 'DeepSeek-R1-Distill-Llama-8B',
      'Qwen2.5-72B-Instruct', 'Qwen2.5-72B-Instruct-64K', 'Qwen2.5-32B-Instruct', 'Qwen2.5-14B-Instruct', 'Qwen2.5-7B-Instruct',
      'DeepSeek-V2-Lite-Chat', 'JIUTIAN-75B-8K-Chat', 'qwen3.5-35b-a3b', 'Qwen3.5-397B-A17B', 'Qwen3.5-27B',
    ] },

    // ===== 移动云·智算（呼和浩特节点） — 多模态视觉类 =====
    { id: 'ecloud-hh-vision', name: '移动云·智算（多模态视觉·呼和浩特）', provider: 'openai', group: '移动云', baseUrl: 'https://zhenze-huhehaote.cmecloud.cn/v1', models: [
      'Qwen2.5-VL-72B-Instruct', 'Qwen2.5-VL-32B-Instruct', 'Qwen2.5-VL-7B-Instruct',
    ] },

    // ===== 移动云·MOMA（郑州节点） — 向量与重排类 =====
    { id: 'ecloud-zz-vec', name: '移动云·智算（向量与重排·郑州）', provider: 'openai', group: '移动云', baseUrl: 'https://zhenze-zhengzhou.cmecloud.cn/v1', models: [
      'bge-m3', 'bge-reranker-v2-m3', 'bge-base-zh-v1.5',
    ] },

    // ===== 移动云·MOMA（合作模型） — 旗舰与多模态 =====
    { id: 'ecloud-moma', name: '移动云·MOMA（合作旗舰模型）', provider: 'openai', group: '移动云', baseUrl: 'https://moma.cmecloud.cn/v1', models: [
      'Qwen/Qwen3-Max', 'Qwen/Qwen3.7-Plus', 'Qwen/Qwen3-VL-Plus', 'Qwen/Qwen3-Omni-Flash',
    ] },

    // ===== 移动云·智算（语音服务） =====
    { id: 'ecloud-speech', name: '移动云·智算（语音服务·ASR/TTS）', provider: 'openai', group: '移动云', baseUrl: 'https://zhenze-huhehaote.cmecloud.cn/v1', models: [
      'Qwen/Qwen3-ASR-Flash-Realtime', 'Qwen/Fun-ASR-Flash-8k-Realtime',
    ] },

    // ===== 移动云·智算（视频与图片生成） =====
    { id: 'ecloud-gen', name: '移动云·智算（视频与图片生成）', provider: 'openai', group: '移动云', baseUrl: 'https://zhenze-huhehaote.cmecloud.cn/v1', models: [
      'qwen/happyhorse-1.0-video-edit', 'qwen/happyhorse-1.1-i2v',
    ] },
  ];
});

// 自定义接口：持久化到 userData/data/customInterfaces.json
ipcMain.handle('models:customInterfaces', () => {
  const file = path.join(dataDir, 'customInterfaces.json');
  return readJson(file, []);
});

ipcMain.handle('models:saveCustomInterfaces', (_e, list) => {
  const file = path.join(dataDir, 'customInterfaces.json');
  writeJson(file, list || []);
  return true;
});

// 接口隐藏状态：持久化到 userData/data/hiddenInterfaces.json
ipcMain.handle('models:hiddenInterfaces', () => {
  const file = path.join(dataDir, 'hiddenInterfaces.json');
  return readJson(file, []);
});

ipcMain.handle('models:saveHiddenInterfaces', (_e, list) => {
  const file = path.join(dataDir, 'hiddenInterfaces.json');
  writeJson(file, list || []);
  return true;
});

// ---------- 文件系统（应用开发环境） ----------
function safeProjectPath(rel) {
  const base = path.resolve(projectsDir);
  const target = path.resolve(base, rel || '');
  if (!target.startsWith(base + path.sep) && target !== base) {
    throw new Error('非法路径');
  }
  return target;
}

ipcMain.handle('fs:list', (_e, rel = '') => {
  const dir = safeProjectPath(rel);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).map((d) => ({
    name: d.name,
    isDir: d.isDirectory(),
    path: path.join(rel, d.name).replace(/\\/g, '/'),
  }));
});

ipcMain.handle('fs:read', (_e, rel) => {
  const file = safeProjectPath(rel);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return '';
  return fs.readFileSync(file, 'utf8');
});

ipcMain.handle('fs:write', (_e, rel, content) => {
  const file = safeProjectPath(rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
  return true;
});

ipcMain.handle('fs:mkdir', (_e, rel) => {
  const dir = safeProjectPath(rel);
  fs.mkdirSync(dir, { recursive: true });
  return true;
});

ipcMain.handle('fs:delete', (_e, rel) => {
  const target = safeProjectPath(rel);
  fs.rmSync(target, { recursive: true, force: true });
  return true;
});

ipcMain.handle('fs:rename', (_e, oldRel, newRel) => {
  const a = safeProjectPath(oldRel);
  const b = safeProjectPath(newRel);
  fs.renameSync(a, b);
  return true;
});

ipcMain.handle('fs:projectsRoot', () => projectsDir);

// ---------- 插件系统 ----------
ipcMain.handle('plugins:list', () => {
  const result = [];
  if (fs.existsSync(pluginsDir)) {
    for (const name of fs.readdirSync(pluginsDir)) {
      const dir = path.join(pluginsDir, name);
      if (!fs.statSync(dir).isDirectory()) continue;
      const manifestFile = path.join(dir, 'plugin.json');
      if (!fs.existsSync(manifestFile)) continue;
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
        result.push({ ...manifest, dir });
      } catch (e) {
        result.push({ id: name, name, version: '?', enabled: false, error: e.message, dir });
      }
    }
  }
  return result;
});

ipcMain.handle('plugins:load', (_e, pluginId) => {
  const dir = path.join(pluginsDir, pluginId);
  const manifestFile = path.join(dir, 'plugin.json');
  if (!fs.existsSync(manifestFile)) return { ok: false, error: '插件不存在' };
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  const mainFile = path.join(dir, manifest.main || 'index.js');
  if (!fs.existsSync(mainFile)) return { ok: false, error: '缺少入口文件' };
  try {
    // 在沙箱中执行插件（简单实现：读取并 eval 到独立函数作用域）
    const code = fs.readFileSync(mainFile, 'utf8');
    const fn = new Function('api', 'manifest', code);
    const api = {
      log: (...args) => console.log(`[plugin:${pluginId}]`, ...args),
      store: {
        get: (k) => readJson(path.join(dir, 'store.json'), {})[k],
        set: (k, v) => {
          const s = readJson(path.join(dir, 'store.json'), {});
          s[k] = v;
          writeJson(path.join(dir, 'store.json'), s);
        },
      },
    };
    const result = fn(api, manifest);
    return { ok: true, result: result === undefined ? null : String(result) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// 内置示例插件（写入用户插件目录）
ipcMain.handle('plugins:installSample', () => {
  const dir = path.join(pluginsDir, 'hello-agent');
  fs.mkdirSync(dir, { recursive: true });
  const manifest = {
    id: 'hello-agent',
    name: 'Hello Agent',
    version: '1.0.0',
    description: '示例插件：展示插件系统能力',
    author: 'AgentBrowser',
    main: 'index.js',
    icon: '🤖',
  };
  const code = `// AgentBrowser 示例插件
api.log('插件已加载!');
return 'Hello from AgentBrowser plugin 🚀';`;
  fs.writeFileSync(path.join(dir, 'plugin.json'), JSON.stringify(manifest, null, 2), 'utf8');
  fs.writeFileSync(path.join(dir, 'index.js'), code, 'utf8');
  return true;
});

// ---------- 系统信息 ----------
ipcMain.handle('sys:info', () => ({
  platform: process.platform,
  arch: process.arch,
  node: process.versions.node,
  electron: process.versions.electron,
  chrome: process.versions.chrome,
  os: `${os.type()} ${os.release()}`,
  cpus: os.cpus().length,
  memory: Math.round(os.totalmem() / 1024 / 1024 / 1024) + ' GB',
  appVersion: app.getVersion(),
}));

ipcMain.handle('dialog:openFile', async () => {
  const r = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: '所有文件', extensions: ['*'] }],
  });
  return r.canceled ? [] : r.filePaths;
});

ipcMain.handle('shell:openExternal', (_e, url) => {
  if (url.startsWith('http')) shell.openExternal(url);
});

// ---------- 窗口控制（无边框窗口） ----------
ipcMain.handle('win:minimize', () => {
  if (mainWindow) mainWindow.minimize();
});
ipcMain.handle('win:maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.handle('win:close', () => {
  if (mainWindow) mainWindow.close();
});
ipcMain.handle('win:isMaximized', () => {
  if (!mainWindow) return false;
  return mainWindow.isMaximized();
});

// ---------- SQLite token 存储 ----------
ipcMain.handle('db:get', (_e, key) => {
  const val = dbGet(key);
  if (val === null) return null;
  try { return JSON.parse(val); } catch { return val; }
});
ipcMain.handle('db:set', (_e, key, value) => {
  dbSet(key, typeof value === 'string' ? value : JSON.stringify(value));
  return true;
});

// ---------- 移动云增值服务数据 ----------
ipcMain.handle('ecloud:services', () => {
  return {
    url: 'https://ecloud.10086.cn/mobilecloud',
    categories: [
      {
        id: 'text', icon: '💬', name: 'AI 大模型 · 文本对话',
        desc: 'DeepSeek、GLM、通义千问、Kimi、MiniMax 等主流大语言模型，支持多轮对话、代码生成、逻辑推理、工具调用',
        models: [
          { name: 'DeepSeek-V4-Flash-0731', family: 'DeepSeek', ctx: '128K', input: '0.5', output: '2', unit: '元/百万tokens', features: ['代码生成', '逻辑推理', '工具调用'] },
          { name: 'GLM-5.3-Flash', family: 'GLM', ctx: '128K', input: '0.5', output: '2', unit: '元/百万tokens', features: ['多轮对话', 'Agent', '代码生成'] },
          { name: 'GLM-5.3', family: 'GLM', ctx: '128K', input: '2', output: '8', unit: '元/百万tokens', features: ['复杂推理', 'Agent', '工具调用'] },
          { name: 'GLM-5.2', family: 'GLM', ctx: '128K', input: '2', output: '8', unit: '元/百万tokens', features: ['长文本', '代码生成', '工具调用'] },
          { name: 'DeepSeek-R1-0528', family: 'DeepSeek', ctx: '128K', input: '1', output: '4', unit: '元/百万tokens', features: ['深度推理', '数学', '代码'] },
          { name: 'Qwen3.7-Max', family: '通义千问', ctx: '256K', input: '0.25', output: '10', unit: '元/百万tokens', features: ['思考模式', '工具调用', '万亿参数'] },
          { name: 'Kimi-K2.6', family: 'Moonshot', ctx: '256K', input: '4', output: '12', unit: '元/百万tokens', features: ['长文本', '代码', 'Agent'] },
          { name: 'MiniMax-M3', family: 'MiniMax', ctx: '1M', input: '1', output: '3', unit: '元/百万tokens', features: ['超长上下文', '多模态', 'Agent'] },
        ],
      },
      {
        id: 'vision', icon: '👁️', name: '多模态理解 · 视觉语言',
        desc: '图像理解、视频理解、图文跨模态分析，支持图片/视频输入进行智能问答',
        models: [
          { name: 'Qwen2.5-VL-72B-Instruct', family: '通义千问', ctx: '32K', input: '8', output: '24', unit: '元/百万tokens', features: ['图像理解', '视频理解', 'OCR'] },
          { name: 'Qwen2.5-VL-32B-Instruct', family: '通义千问', ctx: '32K', input: '8', output: '24', unit: '元/百万tokens', features: ['图像理解', '视频理解', '数学推理'] },
          { name: 'Qwen/Qwen3-VL-Plus', family: '通义千问', ctx: '256K', input: '0.1', output: '10', unit: '元/百万tokens', features: ['视觉问答', '图表分析', '文档解析'] },
          { name: 'Qwen/Qwen3-Omni-Flash', family: '通义千问', ctx: '64K', input: '1.8', output: '6.9', unit: '元/百万tokens', features: ['全模态', '音频理解', '视频理解'] },
        ],
      },
      {
        id: 'speech', icon: '🎙️', name: '语音服务 · ASR/TTS',
        desc: '实时语音识别（ASR）、语音合成（TTS），支持中英日韩多语言流式识别',
        models: [
          { name: 'Qwen3-ASR-Flash-Realtime', family: '通义千问', ctx: '—', input: '0.00033', output: '—', unit: '元/秒', features: ['实时流式', '多语言', '会议记录'] },
          { name: 'Fun-ASR-Flash-8K-Realtime', family: '通义千问', ctx: '—', input: '0.00022', output: '—', unit: '元/秒', features: ['电话语音', '8kHz优化', '客服质检'] },
        ],
      },
      {
        id: 'video', icon: '🎬', name: '视频生成 · 文生视频/图生视频',
        desc: '自然语言指令生成视频、图片编辑视频，支持跨片段一致性与音画同步',
        models: [
          { name: 'HappyHorse-1.0-Video-Edit', family: '通义万相', ctx: '—', input: '—', output: '0.9', unit: '元/秒', features: ['视频编辑', '图生视频', '自然语言'] },
          { name: 'HappyHorse-1.1-I2V', family: '通义万相', ctx: '—', input: '—', output: '0.45', unit: '元/秒', features: ['图生视频', '跨片段一致', '音画同步'] },
        ],
      },
      {
        id: 'vector', icon: '🔢', name: '向量检索 · Embedding/Rerank',
        desc: '文本嵌入（Embedding）与重排序（Rerank），用于 RAG 检索增强生成、语义搜索',
        models: [
          { name: 'bge-m3', family: 'BGE', ctx: '8K', input: '0.5', output: '0.5', unit: '元/百万tokens', features: ['多语言', '稀疏+稠密', 'RAG'] },
          { name: 'bge-reranker-v2-m3', family: 'BGE', ctx: '8K', input: '0.5', output: '0.5', unit: '元/百万tokens', features: ['重排序', '多语言', 'RAG增强'] },
          { name: 'bge-base-zh-v1.5', family: 'BGE', ctx: '8K', input: '0.5', output: '0.5', unit: '元/百万tokens', features: ['中文嵌入', '语义搜索', '聚类'] },
        ],
      },
      {
        id: 'agent', icon: '🤖', name: 'Agent 智能体 · 工具调用',
        desc: '支持 Function Calling、结构化输出、网页搜索的智能体模型，可自主规划与执行复杂任务',
        models: [
          { name: 'DeepSeek-V4-Flash-0731', family: 'DeepSeek', ctx: '128K', input: '0.5', output: '2', unit: '元/百万tokens', features: ['Agent', '工具调用', '代码执行'] },
          { name: 'GLM-5.3', family: 'GLM', ctx: '128K', input: '2', output: '8', unit: '元/百万tokens', features: ['Agent', 'MCP', '工具调用'] },
          { name: 'Qwen2.5-72B-Instruct', family: '通义千问', ctx: '64K', input: '4', output: '12', unit: '元/百万tokens', features: ['工具调用', '网页搜索', '结构化输出'] },
          { name: 'Qwen/Qwen3-Max', family: '通义千问', ctx: '256K', input: '0.25', output: '10', unit: '元/百万tokens', features: ['思考模式', '工具调用', '万亿参数'] },
        ],
      },
    ],
    stats: { total: '358+', providers: '10+', families: '15+', domains: '6' },
  };
});
