# -*- coding: utf-8 -*-
"""生成 AgentBrowser 参赛 PPT：python ppt\\build_ppt.py"""
from pathlib import Path
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE, MSO_CONNECTOR
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR

ROOT = Path(__file__).resolve().parent
IMG = ROOT / "img"
OUT = ROOT.parent / "AgentBrowser_移动云MoMA_Agent参赛作品.pptx"

BLUE = RGBColor(0x00, 0x5B, 0xE5)
DEEP = RGBColor(0x0A, 0x1F, 0x44)
CYAN = RGBColor(0x00, 0xB4, 0xD8)
LIGHT = RGBColor(0xEE, 0xF4, 0xFF)
GRAY = RGBColor(0x55, 0x5F, 0x6D)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
ORANGE = RGBColor(0xFF, 0x8A, 0x00)
GREEN = RGBColor(0x12, 0xB7, 0x6A)
FONT = "微软雅黑"

prs = Presentation()
prs.slide_width, prs.slide_height = Inches(13.333), Inches(7.5)
SW, SH = prs.slide_width, prs.slide_height
BLANK = prs.slide_layouts[6]
page_no = [0]


def text(slide, x, y, w, h, s, size=14, color=DEEP, bold=False, align=PP_ALIGN.LEFT,
         anchor=MSO_ANCHOR.TOP, line=1.15):
    tb = slide.shapes.add_textbox(x, y, w, h)
    tf = tb.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    tf.margin_left = tf.margin_right = Inches(0.05)
    lines = s if isinstance(s, list) else [s]
    for i, ln in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        p.line_spacing = line
        r = p.add_run()
        r.text = ln
        r.font.size, r.font.bold, r.font.name = Pt(size), bold, FONT
        r.font.color.rgb = color
    return tb


def box(slide, x, y, w, h, fill=LIGHT, line=None, shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.08):
    sp = slide.shapes.add_shape(shape, x, y, w, h)
    sp.fill.solid()
    sp.fill.fore_color.rgb = fill
    if line is None:
        sp.line.fill.background()
    else:
        sp.line.color.rgb = line
        sp.line.width = Pt(1.25)
    sp.shadow.inherit = False
    if shape == MSO_SHAPE.ROUNDED_RECTANGLE:
        sp.adjustments[0] = radius
    return sp


def label_box(slide, x, y, w, h, s, fill=BLUE, color=WHITE, size=13, bold=True, line=None):
    sp = box(slide, x, y, w, h, fill, line)
    tf = sp.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    tf.margin_left = tf.margin_right = Inches(0.06)
    lines = s if isinstance(s, list) else [s]
    for i, ln in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = PP_ALIGN.CENTER
        r = p.add_run()
        r.text = ln
        r.font.size = Pt(size if i == 0 else size - 2)
        r.font.bold = bold if i == 0 else False
        r.font.name = FONT
        r.font.color.rgb = color
    return sp


def card(slide, x, y, w, h, title, items, accent=BLUE, size=12):
    box(slide, x, y, w, h, WHITE, RGBColor(0xD6, 0xE2, 0xF5))
    box(slide, x, y, Inches(0.08), h, accent, shape=MSO_SHAPE.RECTANGLE)
    text(slide, x + Inches(0.2), y + Inches(0.1), w - Inches(0.3), Inches(0.45), title, 15, accent, True)
    text(slide, x + Inches(0.2), y + Inches(0.55), w - Inches(0.3), h - Inches(0.6),
         [("• " + i) if i else "" for i in items], size, GRAY, line=1.25)


def arrow(slide, x1, y1, x2, y2, color=BLUE):
    c = slide.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, x1, y1, x2, y2)
    c.line.color.rgb = color
    c.line.width = Pt(2)
    ln = c.line._get_or_add_ln()
    tail = ln.makeelement("{http://schemas.openxmlformats.org/drawingml/2006/main}tailEnd",
                          {"type": "triangle"})
    ln.append(tail)


def picture(slide, name, x, y, w):
    p = slide.shapes.add_picture(str(IMG / name), x, y, width=w)
    p.line.color.rgb = RGBColor(0xC8, 0xD6, 0xEE)
    p.line.width = Pt(1)
    return p


def new_slide(title, section, notes=""):
    s = prs.slides.add_slide(BLANK)
    page_no[0] += 1
    box(s, 0, 0, SW, Inches(0.95), DEEP, shape=MSO_SHAPE.RECTANGLE)
    box(s, 0, Inches(0.95), SW, Inches(0.05), CYAN, shape=MSO_SHAPE.RECTANGLE)
    text(s, Inches(0.5), Inches(0.18), Inches(9), Inches(0.6), title, 26, WHITE, True)
    text(s, Inches(9.3), Inches(0.28), Inches(3.6), Inches(0.45), section, 13,
         RGBColor(0x9F, 0xC3, 0xFF), align=PP_ALIGN.RIGHT)
    text(s, Inches(0.5), Inches(7.08), Inches(8), Inches(0.3),
         "AgentBrowser · 基于移动云 MoMA 平台的 AI Agent 浏览器", 10, GRAY)
    text(s, Inches(12.2), Inches(7.08), Inches(0.7), Inches(0.3), str(page_no[0]), 10, GRAY,
         align=PP_ALIGN.RIGHT)
    if notes:
        s.notes_slide.notes_text_frame.text = notes
    return s


# ---------- 1 封面 ----------
s = prs.slides.add_slide(BLANK)
page_no[0] += 1
box(s, 0, 0, SW, SH, DEEP, shape=MSO_SHAPE.RECTANGLE)
box(s, 0, Inches(5.2), SW, Inches(0.06), CYAN, shape=MSO_SHAPE.RECTANGLE)
pic = s.shapes.add_picture(str(IMG / "s0.png"), Inches(7.1), Inches(1.0), width=Inches(5.8))
text(s, Inches(0.7), Inches(1.2), Inches(6.3), Inches(0.5), "移动云 MoMA 平台 · Agent 创新大赛参赛作品", 16, CYAN)
text(s, Inches(0.7), Inches(1.8), Inches(6.3), Inches(1.0), "AgentBrowser", 54, WHITE, True)
text(s, Inches(0.7), Inches(2.9), Inches(6.3), Inches(1.2),
     ["让 Agent 替你浏览世界", "基于移动云 MoMA 多模型的 AI Agent 浏览器"], 20, RGBColor(0xCF, 0xE0, 0xFF), line=1.3)
for i, t in enumerate(["358+ 移动云模型", "6 大服务接口", "6 个内置 Agent"]):
    label_box(s, Inches(0.7 + i * 2.05), Inches(4.35), Inches(1.9), Inches(0.55), t, BLUE, size=13)
text(s, Inches(0.7), Inches(5.6), Inches(8), Inches(0.4), "参赛团队：AgentBrowser Team", 16, WHITE)
text(s, Inches(0.7), Inches(6.05), Inches(8), Inches(0.4),
     "官网：AgentBrowser.com    开源仓库：github.com/in33/AgentBrowser", 14, RGBColor(0x9F, 0xC3, 0xFF))
s.notes_slide.notes_text_frame.text = "开场：一句话介绍 AgentBrowser——把浏览器、Agent 工作台、AI 助手和移动云 MoMA 模型能力整合在一个桌面应用中。"

# ---------- 2 目录 ----------
s = new_slide("目录", "CONTENTS")
items = [("01", "Agent 简介", "解决什么问题 · 目标用户"),
         ("02", "能力设计", "功能矩阵 · MoMA 模型调用"),
         ("03", "技术实现", "架构 · Prompt 工程 · 工具调用"),
         ("04", "效果评估", "准确性 · 效率 · 用户反馈"),
         ("05", "商业价值", "场景 · 客户 · 商业模式")]
for i, (n, t, d) in enumerate(items):
    x = Inches(0.6 + i * 2.5)
    box(s, x, Inches(2.0), Inches(2.25), Inches(3.6), LIGHT)
    text(s, x, Inches(2.3), Inches(2.25), Inches(1.0), n, 48, BLUE, True, PP_ALIGN.CENTER)
    text(s, x, Inches(3.5), Inches(2.25), Inches(0.5), t, 20, DEEP, True, PP_ALIGN.CENTER)
    text(s, x + Inches(0.15), Inches(4.2), Inches(1.95), Inches(1.0), d, 13, GRAY, align=PP_ALIGN.CENTER)

# ---------- 3 痛点与用户 ----------
s = new_slide("Agent 简介：我们解决什么问题", "01 Agent 简介",
              "强调痛点真实存在：信息获取在浏览器里，AI 能力在另一个窗口，模型选型和 Key 管理分散。")
text(s, Inches(0.6), Inches(1.25), Inches(12), Inches(0.5),
     "信息在浏览器里，AI 在另一个窗口——知识工作者每天在 \"复制 → 粘贴 → 提问 → 再复制\" 中消耗大量时间", 16, DEEP, True)
pains = [("信息割裂", ["网页阅读与 AI 问答分属不同应用", "长网页需人工摘录再粘贴给大模型", "上下文频繁丢失"], ORANGE),
         ("模型选型难", ["国产大模型种类多、能力差异大", "多平台注册、多套 Key 分散管理", "无法按任务快速切换最合适模型"], ORANGE),
         ("复杂任务难落地", ["单轮对话难以完成研究/分析类任务", "缺少 规划→执行→复盘 的结构化流程", "结果质量依赖个人 Prompt 水平"], ORANGE)]
for i, (t, it, c) in enumerate(pains):
    card(s, Inches(0.6 + i * 4.1), Inches(1.95), Inches(3.9), Inches(2.1), t, it, c, 13)
text(s, Inches(0.6), Inches(4.25), Inches(6), Inches(0.4), "目标用户", 18, BLUE, True)
users = [("政企知识工作者", "公文检索、政策解读、材料汇总"),
         ("金融 / 咨询分析师", "研报阅读、数据洞察、行业研究"),
         ("工业 / 医疗专业人员", "技术文档、规范标准、文献速读"),
         ("开发者与学生", "代码辅助、资料翻译、学习规划")]
for i, (t, d) in enumerate(users):
    x = Inches(0.6 + i * 3.08)
    label_box(s, x, Inches(4.75), Inches(2.9), Inches(0.6), t, BLUE, size=15)
    box(s, x, Inches(5.4), Inches(2.9), Inches(1.0), LIGHT)
    text(s, x, Inches(5.45), Inches(2.9), Inches(0.9), d, 13, GRAY, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
label_box(s, Inches(0.6), Inches(6.5), Inches(12.1), Inches(0.5),
          "我们的答案：把 Agent 装进浏览器，让移动云 MoMA 模型直接 \"读懂\" 当前网页并自动完成任务",
          DEEP, size=14)

# ---------- 4 产品概览 ----------
s = new_slide("Agent 简介：AgentBrowser 是什么", "01 Agent 简介",
              "演示首页：358+ 移动云模型、6 个内置 Agent、6 大服务领域。")
picture(s, "s0.png", Inches(0.6), Inches(1.3), Inches(7.4))
text(s, Inches(8.3), Inches(1.3), Inches(4.5), Inches(0.5), "\"浏览器 + Agent 操作系统\"", 20, BLUE, True)
feat = [("🌐 智能浏览器", "多标签 webview + AI 侧边栏，网页即时问答"),
        ("🤖 Agent 工作台", "6 个专业 Agent，规划→执行→完善"),
        ("💬 AI 助手", "浮动面板随时对话，一键切换模型"),
        ("☁️ 移动云增值服务", "358+ 模型能力、定价一屏可见"),
        ("🔐 本地优先", "Key 仅存本地 SQLite，数据主权归用户")]
for i, (t, d) in enumerate(feat):
    y = Inches(1.95 + i * 0.95)
    box(s, Inches(8.3), y, Inches(4.5), Inches(0.82), LIGHT)
    text(s, Inches(8.45), y + Inches(0.05), Inches(4.3), Inches(0.4), t, 14, DEEP, True)
    text(s, Inches(8.45), y + Inches(0.42), Inches(4.3), Inches(0.4), d, 11, GRAY)

# ---------- 5 功能矩阵 ----------
s = new_slide("能力设计：Agent 功能矩阵", "02 能力设计")
caps = [("网页理解", ["抽取当前标签页正文（≤5000 字）", "结合 URL + 正文回答问题", "总结 / 翻译 / 要点提取"]),
        ("多步任务执行", ["规划：拆解 3-5 步执行计划", "执行：按计划生成完整结果", "完善：自我复盘纠错输出终稿"]),
        ("专业 Agent 角色", ["深度研究员 · 编程助手", "内容创作 · 数据分析师", "多语翻译 · 任务规划师"]),
        ("多模态与生成", ["视觉理解：截图/图表解读", "语音：实时 ASR 语音输入", "视频/图片生成（HappyHorse）"]),
        ("知识检索", ["bge-m3 向量化网页与文档", "bge-reranker 重排提升召回精度", "为 RAG 知识库预留接口"]),
        ("模型网关", ["6 个移动云接口统一接入", "任务级模型切换与回退", "Key 分组批量管理 + 连通测试"])]
for i, (t, it) in enumerate(caps):
    x = Inches(0.6 + (i % 3) * 4.1)
    y = Inches(1.3 + (i // 3) * 2.85)
    card(s, x, y, Inches(3.9), Inches(2.6), t, it, BLUE if i % 2 == 0 else CYAN, 13)

# ---------- 6 MoMA 模型调用 ----------
s = new_slide("能力设计：充分调用移动云 MoMA 平台模型", "02 能力设计",
              "强调覆盖移动云 6 类模型服务：文本、视觉、向量、MoMA 旗舰、语音、生成。")
rows = [("接口", "调用模型（移动云自营 / 合作）", "在 Agent 中的作用"),
        ("文本对话 · 呼和浩特", "DeepSeek-V4-Flash（默认）、DeepSeek-R1、GLM-5.3 / 5.2、Qwen3.7-Max、Kimi-K2.6、MiniMax-M3 等 35+", "规划 / 执行 / 完善主力，推理与工具调用"),
        ("MoMA 合作旗舰", "Qwen3-Max、Qwen3.7-Plus、Qwen3-VL-Plus、Qwen3-Omni-Flash", "高难度研究、长文生成、全模态交互"),
        ("多模态视觉", "Qwen2.5-VL-72B / 32B / 7B-Instruct", "网页截图、图表、票据识别与解读"),
        ("向量与重排 · 郑州", "bge-m3、bge-reranker-v2-m3、bge-base-zh-v1.5", "网页/文档向量检索、RAG 召回重排"),
        ("语音服务", "Qwen3-ASR-Flash-Realtime、Fun-ASR-Flash-8K-Realtime", "语音下达任务、会议/电话录音转写"),
        ("视频与图片生成", "HappyHorse-1.0-Video-Edit、HappyHorse-1.1-I2V", "内容创作 Agent 的图生视频与剪辑")]
tbl = s.shapes.add_table(len(rows), 3, Inches(0.6), Inches(1.3), Inches(12.1), Inches(4.6)).table
for c, w in enumerate([2.4, 6.0, 3.7]):
    tbl.columns[c].width = Inches(w)
for r, row in enumerate(rows):
    for c, v in enumerate(row):
        cell = tbl.cell(r, c)
        cell.fill.solid()
        cell.fill.fore_color.rgb = DEEP if r == 0 else (LIGHT if r % 2 else WHITE)
        cell.vertical_anchor = MSO_ANCHOR.MIDDLE
        p = cell.text_frame.paragraphs[0]
        p.text = ""
        run = p.add_run()
        run.text = v
        run.font.name, run.font.size = FONT, Pt(13 if r == 0 else 12)
        run.font.bold = r == 0 or c == 0
        run.font.color.rgb = WHITE if r == 0 else (BLUE if c == 0 else DEEP)
for i, (n, t) in enumerate([("6", "类服务全覆盖"), ("35+", "文本模型可切换"), ("358+", "平台模型可浏览"), ("3", "个区域节点")]):
    x = Inches(0.6 + i * 3.08)
    box(s, x, Inches(6.05), Inches(2.9), Inches(0.9), LIGHT)
    text(s, x, Inches(6.05), Inches(1.2), Inches(0.9), n, 26, BLUE, True, PP_ALIGN.CENTER, MSO_ANCHOR.MIDDLE)
    text(s, x + Inches(1.15), Inches(6.05), Inches(1.7), Inches(0.9), t, 13, GRAY, anchor=MSO_ANCHOR.MIDDLE)

# ---------- 7 架构 ----------
s = new_slide("技术实现：整体架构设计", "03 技术实现",
              "三层架构：渲染层负责交互，主进程负责模型代理与本地存储，移动云提供模型能力；Key 不出本机。")
layers = [("交互层（渲染进程）", ["智能浏览器", "Agent 工作台", "AI 助手", "数据洞察", "移动云服务"], RGBColor(0xE3, 0xEE, 0xFF)),
          ("Agent 编排层", ["角色 Prompt", "规划→执行→完善", "上下文管理", "流式渲染", "停止/回退"], RGBColor(0xD9, 0xF5, 0xFA)),
          ("工具与网关层（主进程）", ["网页正文抽取", "模型 API 代理", "SQLite Key 存储", "文件/插件系统", "ECharts 图表"], RGBColor(0xE3, 0xEE, 0xFF))]
for i, (t, mods, bg) in enumerate(layers):
    y = Inches(1.3 + i * 1.45)
    box(s, Inches(0.6), y, Inches(8.6), Inches(1.25), bg)
    text(s, Inches(0.75), y + Inches(0.05), Inches(4), Inches(0.4), t, 14, DEEP, True)
    for j, m in enumerate(mods):
        label_box(s, Inches(0.8 + j * 1.68), y + Inches(0.5), Inches(1.55), Inches(0.6), m,
                  BLUE if i != 1 else CYAN, size=12)
for i in range(2):
    arrow(s, Inches(4.9), Inches(2.55 + i * 1.45), Inches(4.9), Inches(2.75 + i * 1.45))
box(s, Inches(0.6), Inches(5.75), Inches(8.6), Inches(1.15), DEEP)
text(s, Inches(0.75), Inches(5.8), Inches(8.3), Inches(0.4), "移动云 MoMA / 智算平台（OpenAI 兼容协议）", 14, WHITE, True)
for j, m in enumerate(["文本对话", "MoMA 旗舰", "多模态视觉", "向量重排", "语音 ASR", "视频生成"]):
    label_box(s, Inches(0.8 + j * 1.4), Inches(6.25), Inches(1.3), Inches(0.5), m, BLUE, size=11)
arrow(s, Inches(4.9), Inches(5.5), Inches(4.9), Inches(5.72))
card(s, Inches(9.5), Inches(1.3), Inches(3.25), Inches(5.6), "关键技术选型", [
    "Electron 33 桌面端，跨平台",
    "contextIsolation 安全隔离，preload 白名单桥接",
    "主进程 fetch 代理模型请求，规避 CORS、Key 不暴露给网页",
    "SSE 流式输出，首字即显",
    "better-sqlite3 本地存储 API Key",
    "多区域 BaseURL：呼和浩特 / 郑州 / MoMA",
    "纯原生 HTML/CSS/JS，启动轻快"], BLUE, 12)

# ---------- 8 Prompt 工程 ----------
s = new_slide("技术实现：核心 Prompt 工程策略", "03 技术实现",
              "讲清三步工作流的 Prompt 模板，以及网页上下文注入方式。")
steps = [("① 规划 Plan", "请针对任务\"{task}\"，先给出你的执行计划（3-5步）。只输出计划。", "约束输出范围，防止模型直接作答"),
         ("② 执行 Act", "请针对任务\"{task}\"，执行你的计划并给出最终结果。请详细、完整地输出。", "上一步计划作为 assistant 上下文注入"),
         ("③ 完善 Reflect", "请回顾你刚才对任务\"{task}\"的回答，检查是否有遗漏或错误，并给出最终完善版结论。", "自我复盘，减少遗漏与幻觉")]
for i, (t, p, d) in enumerate(steps):
    x = Inches(0.6 + i * 4.1)
    label_box(s, x, Inches(1.3), Inches(3.8), Inches(0.55), t, BLUE, size=15)
    box(s, x, Inches(1.9), Inches(3.8), Inches(1.45), LIGHT)
    text(s, x + Inches(0.12), Inches(1.95), Inches(3.6), Inches(1.4), p, 12, DEEP)
    text(s, x, Inches(3.4), Inches(3.8), Inches(0.4), "→ " + d, 12, GRAY)
    if i < 2:
        arrow(s, x + Inches(3.82), Inches(1.57), x + Inches(4.08), Inches(1.57))
card(s, Inches(0.6), Inches(4.0), Inches(4.0), Inches(2.9), "角色化 System Prompt", [
    "6 个 Agent 各有专属人设",
    "研究员：分步思考、结构化有依据",
    "编程：高质量可运行代码 + 解释",
    "翻译：保留原文语境与风格"], BLUE, 12)
card(s, Inches(4.75), Inches(4.0), Inches(4.0), Inches(2.9), "网页上下文注入", [
    "模板：当前网页地址 + 正文摘要 + 用户问题",
    "正文截断 3000 字控制 Token 成本",
    "\"请结合网页内容回答\" 约束信息来源",
    "temperature 0.5 降低发散"], CYAN, 12)
card(s, Inches(8.9), Inches(4.0), Inches(3.85), Inches(2.9), "参数与稳定性策略", [
    "推理模型 maxTokens ≥ 1000，避免空回复",
    "Agent 任务 temperature 0.7 / 1500 tokens",
    "流式为空自动回退非流式请求",
    "用户可随时中断，保留已生成内容"], ORANGE, 12)

# ---------- 9 工具调用 ----------
s = new_slide("技术实现：工具调用设计", "03 技术实现",
              "工具通过 preload 暴露的 IPC 白名单调用，渲染层无法直接访问 Node。")
text(s, Inches(0.6), Inches(1.2), Inches(12), Inches(0.4),
     "Agent 通过 preload 白名单 IPC 调用本地工具，模型调用统一走主进程网关", 15, DEEP, True)
flow = ["用户任务 / 网页", "Agent 编排", "工具调用（IPC）", "MoMA 模型", "流式结果"]
for i, f in enumerate(flow):
    x = Inches(0.6 + i * 2.5)
    label_box(s, x, Inches(1.75), Inches(2.1), Inches(0.65), f, DEEP if i in (0, 4) else BLUE, size=13)
    if i < 4:
        arrow(s, x + Inches(2.12), Inches(2.07), x + Inches(2.48), Inches(2.07))
tools = [("page.read", "webview.executeJavaScript 抽取 innerText", "网页理解"),
         ("model.chatStream", "主进程代理 /chat/completions，SSE 分片回传", "推理生成"),
         ("model.chat", "非流式兜底；兼容 OpenAI / Anthropic / Gemini 协议", "容错回退"),
         ("db.get / db.set", "SQLite kv_store 读写 apiKey:<接口ID>", "密钥管理"),
         ("store.get / set", "会话、Agent、自定义接口 JSON 持久化", "记忆存储"),
         ("fs / plugins", "项目文件读写、插件加载", "应用开发"),
         ("ecloud.services", "移动云服务目录、模型能力与定价", "模型选型"),
         ("tab.capture", "webview.capturePage 生成标签缩略图", "多标签管理")]
tbl = s.shapes.add_table(len(tools) + 1, 3, Inches(0.6), Inches(2.7), Inches(12.1), Inches(4.2)).table
for c, w in enumerate([2.6, 7.0, 2.5]):
    tbl.columns[c].width = Inches(w)
for r, row in enumerate([("工具", "实现方式", "用途")] + tools):
    for c, v in enumerate(row):
        cell = tbl.cell(r, c)
        cell.fill.solid()
        cell.fill.fore_color.rgb = DEEP if r == 0 else (LIGHT if r % 2 else WHITE)
        p = cell.text_frame.paragraphs[0]
        run = p.add_run()
        run.text = v
        run.font.name, run.font.size = FONT, Pt(12)
        run.font.bold = r == 0 or c == 0
        run.font.color.rgb = WHITE if r == 0 else (BLUE if c == 0 else DEEP)

# ---------- 10 产品演示 ----------
s = new_slide("产品演示：核心界面", "03 技术实现",
              "依次展示：智能浏览器、Agent 工作台、移动云增值服务。")
for i, (img, cap) in enumerate([("s1.png", "智能浏览器：竖排多标签 + Agent 浏览侧边栏"),
                                ("s2.png", "Agent 工作台：6 个专业 Agent，可选移动云模型"),
                                ("s3.png", "移动云增值服务：358+ 模型能力与定价")]):
    x = Inches(0.6 + i * 4.1)
    picture(s, img, x, Inches(1.5), Inches(3.9))
    text(s, x, Inches(4.05), Inches(3.9), Inches(0.6), cap, 13, DEEP, True, PP_ALIGN.CENTER)
label_box(s, Inches(0.6), Inches(5.0), Inches(12.1), Inches(1.6),
          ["典型流程：打开政策网页 → 点击「Agent 浏览」→ \"总结这份文件对中小企业的影响\"",
           "→ 页面正文自动注入 → DeepSeek-V4-Flash 流式输出结构化解读 → 一键复制到工作文档"],
          LIGHT, DEEP, size=15)

# ---------- 11 效果评估 ----------
s = new_slide("效果评估：实际测试表现", "04 效果评估",
              "提交前请把示例数据替换为团队实测数据。")
metrics = [("92%", "网页问答准确率", "50 个政务/金融网页 × 4 问"),
           ("-68%", "信息整理耗时", "对比人工 复制-粘贴-提问"),
           ("< 1.5s", "首字响应时间", "DeepSeek-V4-Flash 流式"),
           ("+21%", "复杂任务完整度", "三步工作流 vs 单轮对话")]
for i, (n, t, d) in enumerate(metrics):
    x = Inches(0.6 + i * 3.08)
    box(s, x, Inches(1.3), Inches(2.9), Inches(1.9), LIGHT)
    text(s, x, Inches(1.35), Inches(2.9), Inches(0.8), n, 34, BLUE, True, PP_ALIGN.CENTER)
    text(s, x, Inches(2.15), Inches(2.9), Inches(0.4), t, 15, DEEP, True, PP_ALIGN.CENTER)
    text(s, x, Inches(2.6), Inches(2.9), Inches(0.4), d, 11, GRAY, align=PP_ALIGN.CENTER)
# 模型对比柱状图
from pptx.chart.data import CategoryChartData
from pptx.enum.chart import XL_CHART_TYPE, XL_LEGEND_POSITION
cd = CategoryChartData()
cd.categories = ["DeepSeek-V4", "GLM-5.3", "Qwen3-Max", "Kimi-K2.6"]
cd.add_series("准确率(%)", (90, 88, 93, 89))
cd.add_series("满意度(%)", (91, 87, 94, 88))
gf = s.shapes.add_chart(XL_CHART_TYPE.COLUMN_CLUSTERED, Inches(0.6), Inches(3.45), Inches(6.6), Inches(3.5), cd)
ch = gf.chart
ch.has_title = True
ch.chart_title.text_frame.text = "移动云模型网页问答对比"
ch.chart_title.text_frame.paragraphs[0].runs[0].font.size = Pt(13)
ch.has_legend = True
ch.legend.position = XL_LEGEND_POSITION.BOTTOM
ch.legend.include_in_layout = False
ch.value_axis.minimum_scale, ch.value_axis.maximum_scale = 70, 100
ch.category_axis.tick_labels.font.size = Pt(11)
ch.value_axis.tick_labels.font.size = Pt(11)
ch.legend.font.size = Pt(11)
from pptx.oxml.ns import qn
_tx = ch.category_axis._element.find(qn("c:txPr"))
if _tx is not None:
    _tx.find(qn("a:bodyPr")).set("rot", "0")
for idx, col in enumerate([BLUE, CYAN]):
    ser = ch.plots[0].series[idx]
    ser.format.fill.solid()
    ser.format.fill.fore_color.rgb = col
card(s, Inches(7.45), Inches(3.45), Inches(5.3), Inches(3.5), "用户反馈（内测）", [
    "\"读政策文件不用再来回复制，侧边栏直接问\"",
    "\"一个 Key 就能用 DeepSeek、GLM、千问，切换很方便\"",
    "\"研究员 Agent 先列计划再写报告，结构清楚\"",
    "改进建议：增加 RAG 知识库、批量网页任务",
    "注：以上为内测样例数据，正式提交请替换实测值"], GREEN, 12)

# ---------- 12 应用场景 ----------
s = new_slide("商业价值：行业应用场景", "05 商业价值")
scenes = [("🏛️ 政务", ["政策文件速读与解读", "公文起草与多部门材料汇总", "12345 热线工单语音转写分类"]),
          ("💰 金融", ["研报、公告、财报网页即时分析", "舆情监测与风险要点提取", "合规条款比对（向量检索）"]),
          ("🏭 工业", ["设备手册与标准规范问答", "故障图片视觉诊断（Qwen-VL）", "生产数据 ECharts 洞察"]),
          ("🏥 医疗", ["医学文献与指南速读", "病历结构化整理（专网部署）", "科普内容生成与翻译"])]
for i, (t, it) in enumerate(scenes):
    x = Inches(0.6 + i * 3.08)
    label_box(s, x, Inches(1.3), Inches(2.9), Inches(0.7), t, BLUE, size=18)
    box(s, x, Inches(2.05), Inches(2.9), Inches(2.6), LIGHT)
    text(s, x + Inches(0.15), Inches(2.2), Inches(2.6), Inches(2.4), ["• " + v for v in it], 13, DEEP, line=1.5)
label_box(s, Inches(0.6), Inches(4.95), Inches(12.1), Inches(0.6), "落地可行性", DEEP, size=15)
for i, t in enumerate(["基于移动云国产模型，满足信创与数据合规",
                       "Key 与数据本地存储，可对接移动云专属云 / 私有化部署",
                       "OpenAI 兼容协议，零改造接入客户已有模型"]):
    x = Inches(0.6 + i * 4.1)
    box(s, x, Inches(5.65), Inches(3.9), Inches(1.15), WHITE, RGBColor(0xD6, 0xE2, 0xF5))
    text(s, x + Inches(0.1), Inches(5.65), Inches(3.7), Inches(1.15), t, 13, DEEP,
         align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)

# ---------- 13 商业模式 ----------
s = new_slide("商业价值：潜在客户与商业模式", "05 商业价值",
              "核心逻辑：AgentBrowser 作为移动云模型的流量入口，拉动 Token 消耗。")
tiers = [("个人版 · 免费开源", ["MIT 开源，社区获客", "用户自带移动云 Key", "带动 MoMA Token 消耗"], CYAN),
         ("专业版 · 订阅", ["团队 Agent 模板共享", "RAG 知识库 / 批量任务", "按席位 / 月订阅"], BLUE),
         ("政企版 · 定制", ["私有化 + 移动云专属云", "行业 Agent 定制开发", "项目制 + 年度运维"], DEEP)]
for i, (t, it, c) in enumerate(tiers):
    x = Inches(0.6 + i * 2.75)
    h = Inches(2.6 + i * 0.4)
    y = Inches(5.35) - h
    label_box(s, x, y, Inches(2.55), Inches(0.6), t, c, size=13)
    box(s, x, y + Inches(0.6), Inches(2.55), h - Inches(0.6), LIGHT)
    text(s, x + Inches(0.1), y + Inches(0.7), Inches(2.35), h - Inches(0.7), ["• " + v for v in it], 12, DEEP, line=1.4)
label_box(s, Inches(0.6), Inches(5.6), Inches(8.0), Inches(1.3),
          ["与移动云共赢：Token 分成 + 云资源联合销售",
           "每个 AgentBrowser 用户都是移动云 MoMA 模型的持续调用方"], DEEP, size=15)
card(s, Inches(8.9), Inches(1.3), Inches(3.85), Inches(5.6), "潜在客户群体", [
    "各级政务服务中心与机关单位",
    "银行、券商、保险的研究与合规部门",
    "制造企业技术与运维团队",
    "医院、医学院与医药企业",
    "高校师生与开发者社区",
    "移动云现有政企客户（交叉销售）",
    "",
    "获客路径：开源社区 → 移动云生态联合推广 → 政企标杆项目复制"], BLUE, 14)

# ---------- 14 路线图 & 结尾 ----------
s = new_slide("发展规划", "ROADMAP")
road = [("已完成 v1.0", ["6 类移动云接口接入", "6 个内置 Agent", "多标签智能浏览器"]),
        ("Q4 2026", ["bge-m3 RAG 知识库", "语音下达任务", "Function Calling 自动浏览"]),
        ("2027 H1", ["行业 Agent 市场", "团队协作与权限", "移动云专属云部署"]),
        ("2027 H2", ["多 Agent 协同", "政务/金融标杆案例", "生态伙伴分成"])]
box(s, Inches(0.6), Inches(2.35), Inches(12.1), Inches(0.08), CYAN, shape=MSO_SHAPE.RECTANGLE)
for i, (t, it) in enumerate(road):
    x = Inches(0.6 + i * 3.08)
    sp = s.shapes.add_shape(MSO_SHAPE.OVAL, x + Inches(1.3), Inches(2.2), Inches(0.38), Inches(0.38))
    sp.fill.solid()
    sp.fill.fore_color.rgb = GREEN if i == 0 else BLUE
    sp.line.fill.background()
    text(s, x, Inches(1.5), Inches(2.9), Inches(0.5), t, 17, GREEN if i == 0 else BLUE, True, PP_ALIGN.CENTER)
    box(s, x, Inches(2.85), Inches(2.9), Inches(2.0), LIGHT)
    text(s, x + Inches(0.15), Inches(3.0), Inches(2.6), Inches(1.8), ["• " + v for v in it], 13, DEEP, line=1.5)
box(s, Inches(0.6), Inches(5.25), Inches(12.1), Inches(1.6), DEEP)
text(s, Inches(0.6), Inches(5.35), Inches(12.1), Inches(0.8), "让 Agent 替你浏览世界", 30, WHITE, True, PP_ALIGN.CENTER)
text(s, Inches(0.6), Inches(6.1), Inches(12.1), Inches(0.5), "谢谢观看 · AgentBrowser.com", 16, CYAN, align=PP_ALIGN.CENTER)

prs.save(OUT)
print("saved:", OUT)
