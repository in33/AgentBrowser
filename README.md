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

## � 核心优势

AgentBrowser 的核心理念：**「浏览器 + Agent 工作台 + AI 助手 + Monad 交易」四位一体**。

- **多模型网关** —— 一个界面切换 9+ 模型服务商，包括本地 Ollama
- **Agent 工作台** —— 内置 6 个 Agent 模板，支持自定义 Agent 与头像
- **AI 助手** —— 浮动面板随时对话，支持模型切换
- **Monad 交易** —— 内置 Monad 代币实时行情与价格走势
- **完全开源、本地优先** —— 数据主权在用户手中

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
