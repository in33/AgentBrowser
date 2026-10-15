# ◈ AgentBrowser — 未来感 AI Agent 浏览器

> 官网：**AgentBrowser.com** · 让 Agent 替你浏览世界

AgentBrowser 是一款基于 **Electron** 构建的未来感 AI Agent 浏览器。集多模型网关、智能浏览器、Agent 工作台、AI 助手、Monad 交易于一体。

## 📄 License

[MIT License](./LICENSE) — Copyright (c) 2026 AgentBrowser

---

## ✨ 核心功能

| 模块 | 说明 |
|------|------|
| 🏠 **主页** | 未来感桌面首页，快速入口与系统概览 |
| 🌐 **智能浏览器** | 内置 `<webview>` 浏览器 + AI 侧边栏，网页即时问答、总结、翻译 |
| 🤖 **Agent 工作台** | 内置 6 个 Agent 模板（研究员/编程/创作/分析/翻译/规划），自动「规划→执行→反思」，支持自定义 Agent 与头像 |
| 🤖 **AI 助手** | 浮动 AI 助手面板，随时对话，支持模型切换，Markdown 渲染 |
| ◈ **Monad 交易** | Monad 代币实时行情、价格走势图与交易信息 |

---

## 📊 市场调研：前 10 款相关产品

### 产品清单

| # | 产品 | 定位 | 核心能力 | 商业模式 |
|---|------|------|----------|----------|
| 1 | **Arc / Dia** (The Browser Company) | AI 原生浏览器 | 空间管理、AI 命令栏、Dia 自主浏览 | 免费 + 企业版 |
| 2 | **Perplexity Comet** | AI 搜索浏览器 | 深度研究、实时搜索、Agent 浏览 | 订阅制 |
| 3 | **OpenAI Operator** | 云端 Agent | CUA 模型自主操作网页、表单、购物 | ChatGPT Pro 订阅 |
| 4 | **Anthropic Claude for Chrome** | 浏览器扩展 | 网页问答、代码、Computer Use | 订阅制 |
| 5 | **Microsoft Edge + Copilot** | 传统浏览器 + AI | 侧边栏 Copilot、总结、写作 | 免费 + 订阅 |
| 6 | **Google Chrome + Gemini** | 传统浏览器 + AI | Gemini 侧边栏、搜索增强 | 免费 |
| 7 | **Brave + Leo AI** | 隐私浏览器 + AI | 隐私优先、Leo 对话、本地模型 | 免费 + 订阅 |
| 8 | **Opera + Aria** | 传统浏览器 + AI | Aria 助手、侧边栏、AI 工具 | 免费 |
| 9 | **Kagi Orion** | 付费浏览器 | 无广告搜索、隐私、AI 集成 | 订阅制 |
| 10 | **Manus / browser-use / AutoGPT** | Agent 平台 | 自主任务执行、浏览器操作、工作流 | 订阅 + API |

### 相同之处（共同点）

1. **AI 深度集成**：所有产品都把 AI 作为核心，而非附加功能
2. **Agent 化趋势**：从「被动搜索」转向「主动执行任务」
3. **侧边栏/对话式交互**：普遍采用 AI 侧边栏或对话界面
4. **网页理解能力**：都能总结、问答、提取网页内容
5. **隐私与安全**：都强调用户控制、数据安全、防提示注入

### 不同之处（差异点）

| 维度 | 传统浏览器+AI (Edge/Chrome/Opera) | AI 原生浏览器 (Arc/Comet) | Agent 平台 (Operator/Manus) | **AgentBrowser** |
|------|------|------|------|------|
| 模型 | 单一厂商 | 单一厂商 | 单一厂商 | **9+ 服务商统一** |
| Agent 工作台 | ✗ | ✗ | 部分 | **✓ 内置** |
| 本地模型 | ✗ | ✗ | ✗ | **✓ Ollama** |
| 开源 | ✗ | ✗ | 部分 | **✓ 完全开源** |

### 市场空白与痛点

1. **模型锁定**：几乎所有产品绑定单一模型厂商，用户无法自由切换
2. **数据孤岛**：浏览、对话、Agent 彼此割裂
3. **闭源不透明**：数据与算法不透明，用户缺乏掌控

### 未来趋势

- **浏览器 → Agent 操作系统**：浏览器成为 Agent 运行与交互的载体
- **多模型自由切换**：用户不再被单一厂商锁定
- **本地优先 + 隐私**：本地模型与数据主权成为差异化优势

---

## 🚀 差异化定位（与众不同）

AgentBrowser 的核心理念：**「浏览器 + Agent 工作台 + AI 助手 + Monad 交易」四位一体**。

- **与众不同 1**：多模型网关 —— 一个界面切换 9+ 模型服务商，包括本地 Ollama
- **与众不同 2**：Agent 工作台 —— 内置 6 个 Agent 模板，支持自定义 Agent 与头像
- **与众不同 3**：AI 助手 —— 浮动面板随时对话，支持模型切换
- **与众不同 4**：Monad 交易 —— 内置 Monad 代币实时行情与价格走势
- **与众不同 5**：完全开源、本地优先 —— 数据主权在用户手中

---

## 🛠️ 技术栈

- **Electron** ^33.2.0（桌面应用框架）
- 纯 HTML / CSS / JavaScript（无框架，轻量快速）
- Node.js 内置 `fetch`（模型 API 调用，主进程代理避免 CORS）

## 📁 项目结构

```
Monad_AgentBrowser/
├── main.js              # Electron 主进程（窗口、模型代理、文件系统）
├── preload.js           # contextBridge 安全桥接
├── package.json
├── scripts/
│   └── vendor.mjs       # 复制 echarts 到 src/vendor
├── src/
│   ├── index.html       # 应用界面
│   ├── app.css          # 未来感样式
│   ├── app.js           # 渲染进程逻辑
│   └── vendor/          # 第三方库
└── website/
    └── index.html       # AgentBrowser.com 官网
```

## 🚀 快速开始

```bash
# 安装依赖
npm install

# 启动应用
npm start
```

## ⚙️ 使用说明

1. **配置模型**：进入「设置」，选择服务商，填写 API Key 和模型名，点击「测试连接」
2. **接口管理**：在「设置 → 接口管理」中按分组查看所有接口，可隐藏/显示每个接口，或点击「＋ 添加自定义接口」创建新接口
3. **浏览器**：在地址栏输入网址或搜索，AI 侧边栏随时问答网页内容
4. **Agent 工作台**：点击 Agent 卡片分配任务，Agent 自动「规划→执行→反思」；点击「＋ 新建 Agent」创建自定义 Agent
5. **AI 助手**：点击右下角浮动按钮打开 AI 助手面板，选择模型后开始对话
6. **Monad 交易**：查看 Monad 代币实时行情与价格走势

## 🔌 支持的模型服务商

接口按分组管理，可在「设置 → 接口管理」中隐藏/显示每个接口（默认全部显示），并可添加自定义接口。

### 📦 默认分组（国际常用接口，使用官方默认 URL）

| 服务商 | Provider | 默认模型 |
|--------|----------|----------|
| Apistate | openai | gpt-4o, gpt-4o-mini, claude-3-5-sonnet, deepseek-chat |
| OpenAI Codex | openai | gpt-5-codex, codex-mini-latest |
| Anthropic Claude | anthropic | claude-3-5-sonnet, claude-3-5-haiku |
| xAI Grok | openai | grok-2-latest, grok-beta |
| Google Gemini | gemini | gemini-1.5-pro, gemini-1.5-flash |
| OpenAI | openai | gpt-4o, gpt-4o-mini |
| DeepSeek | openai | deepseek-chat |
| Ollama (本地) | ollama | llama3.1, qwen2.5 |
| Moonshot Kimi | openai | moonshot-v1-8k |
| 智谱 GLM | openai | glm-4-plus |
| 通义千问 | openai | qwen-max |

### 🟡 YDY 分组（移动云 MemS 免费接口）

| 服务商 | Provider | 默认模型 |
|--------|----------|----------|
| MemS deepseek-v4-flash | openai | deepseek-v4-flash-0731 |
| MemS qwen3.5-397b | openai | qwen3.5-397b-a17b |
| MemS minimax-m2.5 | openai | minimax-m2.5 |
| MemS glm-5.2 | openai | glm-5.2 |
| MemS jiutian-35b | openai | jiutian-35b-256k-chat |

### ➕ 自定义分组

点击「设置 → 接口管理 → ＋ 添加自定义接口」，填写名称、分组、模型、API Key、Base URL 和协议类型即可添加任意 OpenAI 兼容 / Anthropic / Gemini 接口。

> 💡 **移动云 MemS**：内置免费 API Key，选择该服务商后自动填充，无需手动配置即可使用 5 个模型。
> 💡 **Key 批量管理**：在三点菜单中可批量管理所有接口的 API Key 和 Base URL，支持一键重置。

## 📄 License

MIT © 2026 AgentBrowser
