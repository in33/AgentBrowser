# ◈ AgentBrowser — 当前上下文（Context）

> 本文件记录项目**当前状态**，供 AI 助手与开发者快速了解"现在进行到哪一步"。每次改动后请更新本文件。

---

## 一、项目概况

| 项 | 值 |
|----|----|
| 项目名 | AgentBrowser（agent-browser） |
| 版本 | v1.0.0 |
| 官网 | https://AgentBrowser.com |
| 技术栈 | Electron 33 + ECharts 5 + better-sqlite3 + 纯 HTML/CSS/JS |
| 路径 | `D:\WWW\Agent浏览器_开源中国\Monad_AgentBrowser` |
| 授权 | MIT |

---

## 二、当前布局（最新改动：无边框窗口 + 横向导航 + Monad 交易）

- **无边框窗口**：`frame: false`，自定义标题栏（`-webkit-app-region: drag`）
- **顶部 topbar**：品牌 Logo + **横向导航栏**（`topnav`，11 个功能按钮横排）+ 模型芯片（`#modelChip`）+ 全屏按钮 + **竖形三点菜单按钮**（`#btnMenu`）+ 窗口控制按钮（最小化/最大化/关闭）
- **中间 `.main`**：显示当前功能视图
- **首页 `view-home`**：`.desktop-wall` 居中显示实时时钟（`#desktopClock`，每秒更新）+ 欢迎语 + 统计（`#heroStats`）
- **右下角 AI 助手**：浮动按钮（`#aiFab`）点击展开竖形 AI 面板（`#aiPanel`，360×520px）
- **全屏时钟**：全屏时右下角 AI 助手左侧显示时间（`#fsClock`）
- 时钟逻辑：`updateClock()` 在 `init()` 中调用并 `setInterval(updateClock, 1000)`，同时更新全屏时钟

### 11 个视图
`home` / `browser` / `chat` / `agents` / `charts` / `dev` / `plugins` / `society` / `trust` / `settings` / **`monad`**（Monad 交易应用）

### 竖形三点菜单
- ⭐ GitHub 点赞（跳转 GitHub 仓库链接）
- ℹ️ 关于

---

## 三、功能模块状态（全部可用）

| 模块 | 状态 | 说明 |
|------|------|------|
| 🌐 智能浏览器 | ✅ | `<webview>` + AI 侧边栏，导航/后退/前进/刷新正常 |
| 🧠 多模型网关 | ✅ | 15 个接口（官方 10 + YDY 5），分组管理，可隐藏/自定义 |
| 🤖 Agent 工作台 | ✅ | 6 个模板，规划→执行→反思，任务弹窗 |
| 📊 数据洞察 | ✅ | ECharts 9 类图表，随机数据/AI 生成 |
| 💻 应用开发 | ✅ | 文件树 + 编辑器 + 实时预览 + AI 编程 |
| 🧩 插件生态 | ✅ | 插件列表/安装示例 |
| 🎯 社会·文化 | ✅ | 6 大议题，AI 分析 |
| 🛡️ 信任·AI基建 | ✅ | 6 大议题，AI 分析 |
| 💰 Monad 交易 | ✅ | 实时价格（CoinGecko API）+ 买入/卖出 + 组合 + 历史 |
| ⚙️ 设置 | ✅ | 模型配置/测试连接/接口管理/关于 |

---

## 四、模型接口配置（当前生效）

### 默认模型
- **mems-deepseek**（`deepseek-v4-flash-0731`）
- baseUrl：`https://zhenze-huhehaote.cmecloud.cn/v1`
- apiKey：`WIA6ilp3-m_hUkHxjdAqr7hSl5VuPmN-Hf33tW9bCq8`

### 分组
- **官方**（10）：codex / claude / grok / gemini / openai / deepseek / ollama / moonshot / zhipu / qwen
- **YDY**（5）：mems-deepseek / mems-qwen / mems-minimax / mems-glm / mems-jiutian
- **自定义**：用户添加，默认创建新分组

### 已验证
- ✅ MemS 5 个免费接口连接成功（测试连接通过）
- ✅ 聊天模型下拉切换生效（`#chatModelSelect` onchange 已绑定）
- ✅ 添加自定义接口弹窗正常
- ✅ 接口隐藏/显示正常

---

## 五、最近修复记录（2026-10-11 按钮响应调试）

| 问题 | 修复 |
|------|------|
| webview 无初始 src，`loadURL` 报错 | webview 加 `src="about:blank"`；`navigate()` 等待 `dom-ready` |
| `toast()` 只更新状态栏，用户看不到 | 增加浮动提示 `#toastBox` + `.toast-item`（info/err/ok） |
| `#chatModelSelect` 无 onchange，切换无效 | 绑定 onchange：同步设置页 + 保存配置 + 更新芯片 + toast |

---

## 六、浏览器竖排标签栏（2026-10-14 新增）

### 功能
- **左侧竖排标签栏**（`#vtabBar`，宽 132px）：每个标签显示**页面缩略图** + **竖排标题**（`writing-mode: vertical-rl`）
- **多标签页**：`#btnNewTab` 新建标签，每个标签独立 `<webview>`，可切换/关闭
- **缩略图预览**：鼠标悬停标签显示**大图预览浮层**（`.vtab-preview`，360×240）
- **标签内容区**（`#vtabContent`）：多个 webview 绝对定位，`active` 类控制显示

### 关键实现
- `browser` 对象：`{ tabs: [{id,title,url,webview,thumb}], activeId, seq }`
- `createTab(url)` / `switchTab(id)` / `closeTab(id)` / `updateTabTitle(id,title)` / `captureThumb(id)` / `renderTabBar()`
- `captureThumb`：隐藏 webview 需临时加 `active` 类再 `capturePage()`，否则返回空图
- `switchView('browser')` 时延迟 300ms 刷新所有标签缩略图（此时 webview 可见）
- `navigate()` / `getPageText()` 改为操作 `activeTab()` 的 webview
- 缩略图在 `did-stop-loading` 事件触发时捕获

### 已验证（CDP 测试通过）
- ✅ 标签栏存在，默认创建 1 个标签
- ✅ 新建标签 → 2 个 webview，导航 example.com / bing.com 正常
- ✅ 缩略图生成（2 个标签都有缩略图）
- ✅ 竖排标题正确（"Example Domain" / "搜索 - Microsoft 必应"）
- ✅ 标签切换、关闭正常，地址栏同步更新

---

## 六.5、无边框窗口 + Monad 交易 + AI 助手（2026-10 新增）

### 无边框窗口
- `frame: false`，topbar 设为 `-webkit-app-region: drag`（可拖动）
- topnav / 按钮区域设为 `-webkit-app-region: no-drag`
- 窗口控制：`#btnWinMin` / `#btnWinMax` / `#btnWinClose`（IPC: `win:minimize` / `win:maximize` / `win:close` / `win:isMaximized`）

### 横向导航栏
- 原 sidenav（左侧竖排 84px）改为 topnav（顶部横排），节省左侧空间
- 11 个导航按钮：home / browser / chat / agents / charts / dev / plugins / society / trust / settings / monad
- 每个按钮：图标（`nav-ico`）+ 文字（`nav-txt`）竖排排列

### Monad 交易应用（`view-monad`）
- 实时价格卡片：通过 CoinGecko API 获取 MON 价格（IPC: `monad:price`）
- 买入/卖出面板：输入金额 → 计算预估 → 执行交易
- 组合显示：MON 余额 + USD 余额 + 当前价值
- 交易历史：记录每笔买入/卖出
- 数据持久化：通过 SQLite `db:set('monadPortfolio', ...)` 存储

### 竖形三点菜单
- `#btnMenu`（⋮）位于全屏按钮右侧
- 下拉菜单：⭐ GitHub 点赞（打开 GitHub 链接）+ ℹ️ 关于

### AI 助手面板
- `#aiFab`：右下角浮动圆形按钮（56px，渐变背景）
- 点击展开 `#aiPanel`（360×520px，竖形面板）
- 支持聊天对话，使用当前选中的模型配置
- 关闭按钮收回面板，恢复 FAB

### 全屏时钟
- `#fsClock`：全屏时在右下角 AI 助手左侧显示时间
- `updateFsClock()` 检测 `document.fullscreenElement`，全屏时显示，否则隐藏
- 显示时间 + 日期，每秒随 `updateClock()` 更新

---

## 七、数据存储位置

- 用户数据：`C:\Users\zgq\AppData\Roaming\AgentBrowser`
- **SQLite 数据库**：`agentbrowser.db`（better-sqlite3，`kv_store` 表：key/value 存储）
  - Token keys 通过 `db:get` / `db:set` IPC 存入 SQLite
  - Monad 交易组合数据通过 `db:get('monadPortfolio')` / `db:set('monadPortfolio', ...)` 持久化
- 模型配置：`data/modelConfig.json`
- 会话：`data/chats.json`
- Agent：`data/agents.json`
- 自定义接口：`data/customInterfaces.json`
- 隐藏接口：`data/hiddenInterfaces.json`
- 项目文件：`projects/`
- 插件：`plugins/`

---

## 八、运行状态

- 启动方式：`npm start` 或 `npm run dev`（开启 DevTools）
- 无边框窗口：自定义最小化/最大化/关闭按钮（IPC: `win:minimize` / `win:maximize` / `win:close`）
- better-sqlite3 已安装（`^11.10.0`），预编译二进制可直接在 Electron 33 中使用
- `scripts/` 仅保留 `vendor.mjs`

---

## 九、待办 / 后续方向（可选）

- [ ] 插件市场在线化（当前仅本地示例插件）
- [ ] Agent 自定义创建（当前仅 6 个内置模板）
- [ ] 数据洞察更多图表交互
- [ ] 打包分发（electron-builder / electron-forge）
- [ ] Monad 交易接入真实链上数据（当前仅 CoinGecko 价格 + 模拟交易）
- [ ] AI 助手面板支持流式输出（当前为单次请求）

---

## 十、记忆文件

- 仓库记忆：`/memories/repo/agentbrowser-electron.md`（含架构约束、接口分组、布局、修复记录）
- 用户记忆：`/memories/agentbrowser-glm.md`、`/memories/agentbrowser-ide.md`
