<h1 align="center">FunBuddy</h1>

<p align="center">
  <strong>你桌面上住着一只会陪你工作的星星</strong>
</p>

<p align="center">
  它会在你专注时安静地眨眼，在你完成目标时为你放一场烟花。<br>
  番茄钟、计划管理、Markdown 笔记 — 所有你需要的，都在一个可爱的面板里。
</p>

<p align="center">
  <a href="#核心功能">功能</a> &bull;
  <a href="#ai-路线图">AI 路线图</a> &bull;
  <a href="#技术栈">技术栈</a> &bull;
  <a href="#项目结构">项目结构</a> &bull;
  <a href="#快速开始">安装</a> &bull;
  <a href="#license">License</a>
</p>

<p align="center">
  <a href="README_EN.md">English</a>
</p>

---

## 核心功能

### 桌面萌宠

一只活在桌面上的星星宠物。悬停旋转、弹跳、冒爱心；专注时单眼眨巴加油；完成目标时双眼弯弯、满屏彩纸庆祝。可缩为角落小宠物，也可一键展开为功能面板。番茄钟运行时，萌宠头顶出现 ActionBubble — 随时暂停、恢复或固定倒计时，无需切换面板。

### 番茄钟

三阶段自动轮转（专注 → 短休 → 长休 → …），完成时萌宠提醒并触发庆祝动画。每个番茄钟都有记录 — 可回溯每天专注时长、每个计划花费时间。支持自定义专注时长、短休和长休时间。

### 计划管理

用 Markdown 写计划，设定日期范围，自动识别日计划、周计划、月计划，日历视图用不同颜色标记。卡片视图和紧凑视图两种布局，支持标签、搜索、排序和筛选。计划可关联番茄钟，专注时自动记录到对应计划。

### Markdown 笔记

左右分栏实时预览，所见即所得。浮动目录导航支持长文档快速跳转。加粗、斜体、链接等快捷键 + 右键格式化菜单。代码块自动高亮（JS/TS/Python/CSS/JSON/Bash/XML/Markdown）。`[[笔记名]]` Wiki 链接构建知识网络，输入 `[[` 即可搜索已有笔记。支持导出为 PDF 和图片。

### 多标签页

笔记和计划都支持多标签页浏览。拖拽排序、固定常用项、右键关闭其他标签 — 像浏览器一样管理打开的内容。

### 快速捕获

`Ctrl+Shift+N`（可自定义快捷键），任何应用中弹出浮动小窗，打完字回车即保存为带"快捷笔记"标签的笔记。零打断，灵感落地只要 2 秒。

### AI 助手入口

面板内置 AI 搜索浮层，提供快捷建议：总结计划、查找笔记、新建计划、开始专注。为未来的 AI 功能预留交互入口。

### AI 编程助手（Coding Agent）

面板内置 Coding Agent 面板，直接在萌宠里调度 Claude Code。用自然语言下达任务，流式输出回答，并把每一步工具调用可视化 —— Read / Write / Edit / Bash / Glob / Grep / WebSearch 等操作以可展开的卡片呈现。支持多会话管理（历史回看、删除）、选择工作区目录、生成过程中随时中断。会自动把你的笔记和计划注入上下文，让 Agent 更懂你的项目。

> **前置条件：** 需在本地安装 [Claude Code](https://docs.claude.com/en/docs/claude-code/overview) CLI。若未检测到，面板内会显示安装指引。

### 系统集成

- 系统托盘常驻，最小化到托盘而不关闭
- 开机自启动（可选）
- 全局快捷键快速捕获
- 透明窗口 + 毛玻璃效果，融入桌面
- 数据本地存储，隐私安全

---

## AI 路线图

> 萌宠不只是陪伴 — 它正在成为你的 AI 办公中枢。

- **AI 助手** — 用自然语言管理计划和笔记，智能搜索和总结
- **AI 知识库与记忆** — 让萌宠拥有长期记忆，用自然语言搜到你写过的任何东西
- **浏览器与桌面自动化** — 用自然语言描述任务，萌宠自动操作浏览器和桌面应用
- **即时通讯集成** — 接入微信、飞书、Slack，AI 摘要 + 智能回复建议

---

## 技术栈

| 技术 | 用途 |
|------|------|
| [Electron](https://www.electronjs.org/) 42 | 透明窗口、系统托盘、全局快捷键 |
| [React](https://react.dev/) 19 + TypeScript | 组件化 UI |
| [Tailwind CSS](https://tailwindcss.com/) 4 | 毛玻璃设计系统 |
| [Motion](https://motion.dev/) | 流畅动画与面板形变 |
| [Zustand](https://zustand.docs.pmnd.rs/) + Immer | 响应式状态管理 |
| [marked](https://marked.js.org/) + [highlight.js](https://highlightjs.org/) | Markdown 渲染与代码高亮 |
| [electron-vite](https://electron-vite.org/) | 构建与热更新 |
| [electron-store](https://github.com/sindresorhus/electron-store) | 持久化配置存储 |
| [Lucide React](https://lucide.dev/) | 图标库 |
| [@anthropic-ai/claude-agent-sdk](https://github.com/anthropics/claude-agent-sdk-typescript) | Coding Agent / Claude Code 集成 |
| [Vitest](https://vitest.dev/) | 单元测试 |

---

## 项目结构

```
FunBuddy/
├── src/
│   ├── main/                  # Electron 主进程
│   │   ├── index.ts           # 应用入口
│   │   ├── window.ts          # 窗口管理
│   │   ├── tray.ts            # 系统托盘
│   │   ├── hotkey.ts          # 全局快捷键
│   │   ├── ipc-handlers.ts    # IPC 通信
│   │   ├── store.ts           # 主进程持久化
│   │   ├── claude-service.ts  # Coding Agent 任务编排
│   │   ├── agents/            # Claude Code provider、会话、注册表
│   │   └── logger.ts          # 日志
│   ├── preload/               # 预加载脚本
│   ├── renderer/              # 渲染进程 (React)
│   │   ├── components/
│   │   │   ├── pet/           # 萌宠组件与动画
│   │   │   ├── timer/         # 番茄钟
│   │   │   ├── planner/       # 计划管理
│   │   │   ├── notes/         # Markdown 笔记
│   │   │   ├── agent/         # Coding Agent 面板
│   │   │   ├── settings/      # 设置面板
│   │   │   ├── sidebar/       # 侧边栏、导航、AI 搜索
│   │   │   ├── common/        # 通用组件 (TabBar、Toast、Markdown 等)
│   │   │   └── ui/            # 基础 UI 组件
│   │   ├── stores/            # Zustand 状态仓库
│   │   ├── hooks/             # 自定义 Hooks
│   │   ├── lib/               # 工具库 (IPC、导出、Markdown 解析)
│   │   └── utils/             # 通用工具函数
│   └── shared/                # 主进程/渲染进程共享
│       ├── ipc-channels.ts    # IPC 频道定义
│       ├── store-schema.ts    # 数据 schema
│       └── agent-types.ts     # Agent 类型定义
├── resources/                 # 应用图标
├── electron-builder.yml       # 打包配置
└── electron.vite.config.ts    # Vite 构建配置
```

---

## 快速开始

```bash
git clone https://github.com/PenglongHuang/FunBuddy.git
cd FunBuddy
npm install
npm run dev
```

需要 Node.js >= 18，当前仅支持 Windows 10/11。

### 常用脚本

| 命令 | 作用 |
|------|------|
| `npm run dev` | 启动开发环境（热更新） |
| `npm run build` | 构建生产产物 |
| `npm run preview` | 预览构建产物 |
| `npm test` | 运行单元测试 |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run build:win` | 打包 Windows 安装包 |

### 打包发布

```bash
npm run build:win
```

生成的安装包在 `dist/` 目录下。

---

## License

[Apache License 2.0](LICENSE) &copy; Penglong Huang
