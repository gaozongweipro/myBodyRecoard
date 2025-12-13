# SmartCare Pro (智护) - 项目蓝图与技术规范

## 1. 产品愿景 (Product Vision)

**“记录健康不应成为负担，隐私安全不应成为牺牲品。”**

SmartCare Pro 是一款**基于 AI 智能解析、隐私完全受控**的个人医疗健康记录应用。它旨在解决传统医疗记录 App “填表难、分类繁、隐私忧”的三大痛点。用户只需极其简单的操作（拍照、语音），即可生成结构化、高价值的医疗档案。

### 核心理念：Throw-and-Forget (用完即走，全权托管)
用户不需要思考“这个该填在哪”，只需要把单子“扔”给 App，剩下的全部由 AI 完成。

---

## 2. 核心交互流程：Mask & Ask (脱敏与询问)

这是本应用最核心的创新点，解决了“便利性”与“隐私性”的矛盾。

### 流程 Step-by-Step：

**1. 采集 (Capture)**
*   用户点击巨大的“+”号。
*   选择：**拍照** (病历/药盒)、**语音** (碎碎念)、**文字** (快速记)。

**2. 脱敏 (Privacy Masking) - *关键步骤***
*   若上传图片，App 立即进入**“隐私涂鸦模式”**。
*   **交互**：图片变暗，用户用手指在图片上滑动，滑过的地方变成纯黑（或马赛克），遮盖姓名、身份证号等敏感信息。
*   **辅助**：提供“自动人脸遮挡”或“文字区域高亮”辅助用户定位。
*   **心理学设计**：只有用户点击“我已完成脱敏，确认上传”，图片才会离开手机内存。

**3. 解析 (Cloud Intelligence)**
*   脱敏后的图片/语音被发送至云端顶尖大模型（如 DeepSeek-VL, GPT-4o）。
*   **Prompt**：“提取图片中的就诊时间、医院、科室、诊断结论、开药清单（名称/剂量/频次）。忽略涂抹区域。”
*   AI 返回标准的 JSON 数据。

**4. 确认 (Verification)**
*   App 弹出一个精美的“生成的卡片”。
*   用户快速扫视，点击“保存”。（也支持手动修正）。

**5. 归档 (Local Archiving)**
*   结构化数据存入本地数据库 (IndexedDB)。
*   脱敏后的图片作为附件保存。
*   **原始未脱敏图片默认不保存**（或加密保存在本地沙盒深处，仅用户生物验证后可见）。

---

## 3. 功能模块规划 (MVP Scope)

### 3.1 首页：智能时间轴 (Smart Timeline)
*   不再是死板的列表，而是像社交媒体一样的时间轴。
*   卡片式展示：每次就诊是一个大卡片，包含概览。
*   **AI 助手悬浮球**：时刻准备回答“我上次什么时候...”

### 3.2 采集中心 (Capture Center)
*   **Canvas 脱敏编辑器**：支持笔刷大小调节、撤销、一键黑屏（只留中间）。
*   **语音胶囊**：录音 -> 转文字 -> 提炼要点。

### 3.3 医疗档案 (Medical Profile)
*   **用药管家**：从病历自动导入的用药计划。
*   **数据统计**：自动计算每笔就诊花费，按科室/年份统计。

### 3.4 隐私控制台 (Privacy Hub)
*   **API 设置**：用户可填入自己的 API Key（极客模式）。
*   **数据导出/销毁**：一键导出所有 JSON。

---

## 4. 技术栈选型 (Tech Stack)

为了实现极致的性能和本地化体验，我们采用以下技术栈：

*   **框架**: **React 18** + **Vite** (极致快)
*   **UI 系统**: **TailwindCSS** + **Shadcn/UI** (或是自建极简设计系统，追求高颜值)
*   **路由**: **React Router v6**
*   **本地数据库**: **Dexie.js** (IndexedDB 的最佳封装)
*   **图形处理**: **React-Canvas-Draw** 或原生 Canvas API (用于脱敏功能)
*   **AI 接口**:
    *   **Adapter Pattern**：设计通用的 AI 适配器，支持 DeepSeek, OpenAI, Azure 等多源切换。
    *   不做本地模型，只做 API 调用（轻量化）。
*   **打包**: **Capacitor** (依然支持打包为 Android/iOS App)

---

## 5. 目录结构规范

```
src/
├── components/
│   ├── ui/             # 基础 UI 组件 (Button, Card...)
│   ├── business/       # 业务组件 (PrivacyCanvas, RecordCard...)
├── pages/              # 页面级组件
├── services/
│   ├── ai/             # AI 服务 (LLM Service, Parser)
│   ├── db/             # 数据库服务 (Dexie schema)
│   ├── privacy/        # 隐私处理 (Image masking logic)
├── hooks/              # 自定义 Hooks
├── utils/              # 工具函数
└── context/            # 全局状态 (AIContext, UserContext)
```

---

## 6. 下一步行动计划 (Action Plan)

1.  **初始化项目**：使用 Vite 创建 React + Tailwind 项目。
2.  **搭建脚手架**：配置路由、Dexie 数据库。
3.  **核心攻关**：优先实现 **PrivacyCanvas** 组件，打通“拍照 -> 涂抹 -> 导出图片”流程。
4.  **AI 对接**：实现一个简单的 API 调用 Demo，验证脱敏图片解析效果。

> Created by SmartCare Architect on 2025-12-12
