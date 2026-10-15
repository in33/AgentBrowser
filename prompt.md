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
| 渲染层 | 纯 HTML / CSS / JS（无框架） |
| 主进程 | `main.js`（窗口、模型 API 代理、文件系统、插件、本地存储） |
| 预加载 | `preload.js`（contextBridge 暴露 `window.agentBrowser`） |
| 渲染层 | `src/index.html` + `src/app.css` + `src/app.js` |

### 关键架构约束
- **`webviewTag: true` 必须开启**（浏览器视图依赖）
- **CSP** 在 `index.html` 的 `<meta>` 中，`connect-src` 需允许 `https: http: ws: wss:`
- **`contextIsolation: true`、`sandbox: false`**
- 模型调用在**主进程用 `fetch` 代理**（避免 CORS）
- 数据存 `userData/data/*.json`（`store:get` / `store:set` IPC）
- 项目文件存 `userData/projects`，插件存 `userData/plugins`
- ECharts 通过 `scripts/vendor.mjs`（postinstall）复制到 `src/vendor`

---

## 三、目录结构

```
deepseek/
├── main.js            # 主进程
├── preload.js         # 预加载（window.agentBrowser）
├── package.json
├── README.md
├── prompt.md          # 本文件（更新提示词）
├── context.md         # 当前上下文
├── scripts/
│   └── vendor.mjs     # echarts 复制脚本（postinstall）
└── src/
    ├── index.html     # 渲染层 UI
    ├── app.css        # 未来感深空主题
    ├── app.js         # 渲染层逻辑
    ├── sample/index.html
    └── vendor/echarts.min.js
```

---

## 四、模型接口体系（重要）

### 分组
- **官方**：codex、claude、grok、gemini、openai、deepseek、ollama、moonshot、zhipu、qwen（官方默认 URL）
- **YDY**：5 个移动云 MemS 免费接口
  - `mems-deepseek` → `deepseek-v4-flash-0731`
  - `mems-qwen` → `qwen3.5-397b-a17b`
  - `mems-minimax` → `minimax-m2.5`
  - `mems-glm` → `glm-5.2`
  - `mems-jiutian` → `jiutian-35b-256k-chat`
  - baseUrl：`https://zhenze-huhehaote.cmecloud.cn/v1`
  - apiKey：`WIA6ilp3-m_hUkHxjdAqr7hSl5VuPmN-Hf33tW9bCq8`
- **自定义**：用户添加，默认创建新分组

### Provider 类型
- `openai` / `ollama` / `custom` → OpenAI 兼容 `/chat/completions`
- `anthropic` → `/v1/messages`
- `gemini` → `generateContent`

### 关键注意
- **MemS 推理模型需 `maxTokens` ≥ 1000**，否则返回空内容
- 接口可**隐藏/显示**（默认全部显示），隐藏后不出现在下拉框但保留在接口管理
- 自定义接口持久化到 `userData/data/customInterfaces.json`
- 隐藏状态存 `userData/data/hiddenInterfaces.json`

---

## 五、视图与布局（桌面系统风格）

### 布局
- **顶部 topbar**：品牌 + 模型芯片 + 全屏（状态区）
- **左侧 sidenav（84px）**：10 个功能图标按钮（`nav-ico` + `nav-txt`），垂直排列
- **中间 `.main`**：显示当前功能视图（中间留空，像系统桌面）
- **首页 `view-home`**：`.desktop-wall` 居中显示实时时钟（`#desktopClock`）+ 欢迎语 + 统计

### 10 个视图
`home` / `browser` / `chat` / `agents` / `charts` / `dev` / `plugins` / `society` / `trust` / `settings`

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
npm start          # 启动应用
```

### 调试（CDP 自动化测试）
- 应用以 `--remote-debugging-port=9222` 启动
- 用 Node 内置 WebSocket 连接 `http://localhost:9222/json`，取页面 `webSocketDebuggerUrl`
- 用 `Runtime.evaluate`（`returnByValue` + `awaitPromise`）测试渲染层
- **测试脚本用完即删**（`scripts/` 只保留 `vendor.mjs`）

### 通用规则
- 修改前先确认实际元素 ID（见第五节），避免测试脚本用错 ID 误判为 bug
- 改完用 `get_errors` 检查语法
- 涉及 UI 改动后重启应用验证
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
