# ◈ AgentBrowser — 更新提示词（Prompt）

> 本文件用于指导 AI 助手（GitHub Copilot / 其他编码 Agent）在 **AgentBrowser** 项目中进行后续开发、调试与维护。请每次开始工作前阅读本文件，遵循其中的约束与规范。

---

## 一、项目一句话定位

**AgentBrowser** 是一款基于 **Electron** 构建的未来感 **AI Agent 浏览器**（官网 AgentBrowser.com）。它不止是浏览器，更是一个 **Agent 操作系统**：集多模型网关、Agent 工作台、数据洞察、应用开发、插件生态于一体，采用"浏览器系统桌面"式布局（功能在周边、中间留空）。

---

## 二、技术栈与架构（务必遵守）

| 项 | 值 |
|----|----|
| 运行时 | Electron `^33.2.0`（Node 24 / npm 11） |
| 图表 | ECharts `^5.5.1`（复制到 `src/vendor/echarts.min.js`） |
| 数据库 | better-sqlite3 `^11.10.0`（arm64 预编译，`kv_store` 表） |
| 渲染层 | 纯 HTML / CSS / JS（无框架） |
| 主进程 | `main.js`（窗口、模型 API 代理、文件系统、插件、本地存储、SQLite） |
| 预加载 | `preload.js`（contextBridge 暴露 `window.agentBrowser` / `AB`） |
| 渲染层 | `src/index.html` + `src/app.css` + `src/app.js` |

### 关键架构约束
- **`webviewTag: true` 必须开启**（浏览器视图依赖）
- **CSP** 在 `index.html` 的 `<meta>` 中，`connect-src` 需允许 `https: http: ws: wss:`，`img-src` 需允许 `'self' data: blob: https:`
- **`contextIsolation: true`、`sandbox: false`、`nodeIntegration: false`**
- 模型调用在**主进程用 `fetch` 代理**（避免 CORS）
- **API Key 仅存储在 SQLite**（`kv_store` 表，key 格式 `apiKey:<接口ID>`），不保存在任何静态文件或 JSON 中
- 数据存 `userData/data/*.json`（`store:get` / `store:set` IPC）
- SQLite 存取通过 `db:get` / `db:set` IPC（`AB.dbGet(key)` / `AB.dbSet(key, value)`）
- 项目文件存 `userData/projects`，插件存 `userData/plugins`
- ECharts 通过 `scripts/vendor.mjs`（postinstall）复制到 `src/vendor`
- **DevTools 不自动打开**（dev 模式仅启用右键菜单，DevTools 通过 `Ctrl+Shift+Alt+F12` 快捷键打开）
- **所有图标统一使用 `assets/icon.png`**（启动页、顶栏品牌、任务栏均使用同一图标）

---

## 三、目录结构

```
YDY_AgentBrowser/
├── main.js              # Electron 主进程（窗口、模型代理、文件系统、SQLite）
├── preload.js           # 预加载（contextBridge 暴露 window.agentBrowser / AB）
├── package.json
├── README.md
├── prompt.md            # 本文件（更新提示词）
├── context.md           # 当前上下文
├── assets/
│   └── icon.png         # 应用图标（任务栏 + 启动页 + 顶栏品牌统一使用）
├── scripts/
│   └── vendor.mjs       # echarts 复制脚本（postinstall）
├── src/
│   ├── index.html       # 渲染层 UI
│   ├── startpage.html   # 启动页（agentbrowser:// 协议）
│   ├── app.css          # 未来感深空主题
│   ├── app.js           # 渲染层逻辑
│   ├── sample/index.html
│   └── vendor/
│       └── echarts.min.js
└── website/
    └── index.html       # AgentBrowser.com 官网
```

---

## 四、模型接口体系（重要）

### 分组
- **移动云**（6 个预设接口，全部来自 ecloud.10086.cn 平台）：
  - `ecloud-hh-text` → 文本对话类（DeepSeek/GLM/Qwen/Kimi/MiniMax 等 35+ 模型）
  - `ecloud-hh-vision` → 多模态视觉类（Qwen2.5-VL-72B/32B/7B-Instruct）
  - `ecloud-zz-vec` → 向量与重排类（bge-m3/bge-reranker-v2-m3/bge-base-zh-v1.5）
  - `ecloud-moma` → MOMA 合作旗舰模型（Qwen3-Max/Qwen3.7-Plus/Qwen3-VL-Plus/Qwen3-Omni-Flash）
  - `ecloud-speech` → 语音服务 ASR/TTS（Qwen3-ASR-Flash-Realtime/Fun-ASR-Flash-8K-Realtime）
  - `ecloud-gen` → 视频与图片生成（HappyHorse-1.0-Video-Edit/HappyHorse-1.1-I2V）
  - baseUrl：`https://zhenze-huhehaote.cmecloud.cn/v1` / `https://zhenze-zhengzhou.cmecloud.cn/v1` / `https://moma.cmecloud.cn/v1`
  - **apiKey 不在预设中硬编码**，首次使用时由用户填入，保存在 SQLite
- **自定义**：用户添加，默认创建新分组

### Provider 类型
- `openai` / `ollama` / `custom` → OpenAI 兼容 `/chat/completions`
- `anthropic` → `/v1/messages`
- `gemini` → `generateContent`

### Token 管理（2026-10-15 重构）
- **Key 仅存储在 SQLite**（`kv_store` 表，key = `apiKey:<接口ID>`），不在静态预设或 JSON 文件中
- **首次安装不带任何 Key**，数据库为空
- **首次对话时弹出 Key 设置弹窗**（`openFirstRunKeyDialog()`），引导用户填入
- **Token 管理页面**：分组表格结构，每组一个表格（接口 | 状态 | API Key | Base URL | 操作）
- **批量填充**：同分组可输入一个 Key 一键填充到该组所有接口
- **单行保存**：每个接口可单独保存 Key 和 Base URL
- 相关函数：`loadAllKeyStates()` / `renderTokenManagerList()` / `bindTokenTableEvents()` / `syncModelConfigKey()` / `ensureApiKey(providerId)` / `openFirstRunKeyDialog(providerId)`
- CSS 类名前缀：`.tt-*`（`.tt-group` / `.tt-table` / `.tt-key-input` / `.tt-batch-fill` 等）

### 关键注意
- **移动云推理模型需 `maxTokens` ≥ 1000**，否则返回空内容
- 接口可**隐藏/显示**（默认全部显示），隐藏后不出现在下拉框但保留在接口管理
- 自定义接口持久化到 `userData/data/customInterfaces.json`（不含 apiKey，Key 存 SQLite）
- 隐藏状态存 `userData/data/hiddenInterfaces.json`
- **所有 `preset.apiKey` 回退已移除**：`applyPresetToForm` / `getOverrideModelConfig` / `saveModelConfig` / `testModel` / `testSingleInterface` 均只从 SQLite 或用户输入获取 Key

---

## 五、视图与布局（桌面系统风格）

### 布局
- **无边框窗口**：`frame: false`，自定义标题栏（`-webkit-app-region: drag`）
- **顶部 topbar**：品牌 Logo（`assets/icon.png`）+ 横向导航栏 + 模型芯片（`#modelChip`）+ 全屏按钮 + 竖形三点菜单（`#btnMenu`）+ 窗口控制按钮
- **中间 `.main`**：显示当前功能视图（中间留空，像系统桌面）
- **首页 `view-home`**：`.desktop-wall` 居中显示实时时钟（`#desktopClock`）+ 欢迎语 + 统计
- **右下角 AI 助手**：浮动按钮（`#aiFab`）点击展开竖形 AI 面板（`#aiPanel`）

### 视图
`home` / `browser` / `chat` / `agents` / `charts` / `dev` / `plugins` / `society` / `trust` / `settings` / `ecloud`

### 关键元素 ID（测试/开发时务必用对）
- Agent 网格：`#agentsGrid`（**不是** `#agentGrid`）
- 开发文件树：`#devTree`（**不是** `#fileTree`）
- 插件网格：`#pluginsGrid`（**不是** `#pluginGrid`）
- 浏览器：`#addressBar` / `#btnGo` / `#btnBack` / `#btnFwd` / `#btnReload` / `#btnAgentBrowse` / `#aiSidebar`（**不是** `#browserUrl`）
- **浏览器竖排标签栏**：`#vtabBar` / `#vtabList` / `#vtabContent` / `#btnNewTab`；标签项 `#vtabItem-<id>`，内含 `.vtab-thumb`（缩略图）+ `.vtab-title`（竖排标题）+ `.vtab-close`；悬停预览浮层 `.vtab-preview`
- 浏览器多标签：`browser` 对象（`tabs`/`activeId`/`seq`），`createTab`/`switchTab`/`closeTab`/`captureThumb`/`renderTabBar`；`navigate()`/`getPageText()` 操作 `activeTab()` 的 webview
- Agent 运行器：`#agentRunner` / `#runnerLog`
- 开发：`#codeEditor` / `#previewFrame` / `#devTabs` / `#devStatus`
- 赛道：`#societyGrid` / `#trustGrid` / `#societyPanel` / `#trustPanel`
- Token 管理：`#tokenManagerList`（`.token-table-wrap` 容器，内含 `.tt-group` 分组表格）

---

## 六、已修复的"按钮没反应"问题（勿回退）

1. **webview 导航报错**：webview 无初始 `src` 时 `loadURL` 报错
   - 修复：`index.html` 中 webview 加 `src="about:blank"`；`navigate()` 检查 `getWebContentsId()==0` 时等待 `dom-ready`
2. **toast 不可见**：`toast()` 只更新状态栏文字
   - 修复：增加浮动提示 `#toastBox` + `.toast-item`（info/err/ok 三种样式）
3. **聊天模型下拉切换无效**：`#chatModelSelect` 无 `onchange`
   - 修复：`chatSel.onchange` 同步设置页 + 保存 `modelConfig` + 更新芯片 + toast

---

## 七、开发 / 调试规范

### 启动
```bash
npm install        # 自动跑 postinstall 复制 echarts
npm start          # 启动应用（不打开 DevTools）
npm run dev        # 启动应用（dev 模式，不自动打开 DevTools，启用右键菜单）
```

### DevTools
- **不自动打开**（已移除 `openDevTools` 调用）
- 通过快捷键 `Ctrl+Shift+Alt+F12` 打开/关闭 DevTools
- dev 模式下右键菜单包含 `toggleDevTools` 选项

### 通用规则
- 修改前先确认实际元素 ID（见第五节），避免测试脚本用错 ID 误判为 bug
- 改完用 `get_errors` 检查语法
- 涉及 UI 改动后重启应用验证
- PowerShell 中 `npx electron` 的 stderr 会被当作 NativeCommandError，但实际运行正常，用 `npx electron . --dev 2>&1 | Out-String` 启动
- 重要经验写入 `/memories/repo/agentbrowser-electron.md`

---

## 八、给 AI 助手的明确指令

当用户提出需求时，请按以下顺序执行：
1. **阅读** `context.md` 了解当前状态
2. **定位** 相关文件（`main.js` / `preload.js` / `src/*`）
3. **遵守** 本文件的架构约束与元素 ID
4. **实现** 改动，保持未来感深空主题风格
5. **验证**（`get_errors` + 必要时 CDP 测试 + 重启应用）
6. **更新** `context.md` 与记忆文件，记录本次改动
