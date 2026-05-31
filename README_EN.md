<h1 align="center">FunBuddy</h1>

<p align="center">
  <strong>A tiny star lives on your desktop — and it actually helps you work</strong>
</p>

<p align="center">
  It blinks quietly while you focus, throws confetti when you hit your goals.<br>
  Pomodoro timer, planner, Markdown notes — everything you need in one adorable panel.
</p>

<p align="center">
  <a href="#features">Features</a> &bull;
  <a href="#ai-roadmap">AI Roadmap</a> &bull;
  <a href="#tech-stack">Tech Stack</a> &bull;
  <a href="#project-structure">Project Structure</a> &bull;
  <a href="#getting-started">Install</a> &bull;
  <a href="#license">License</a>
</p>

<p align="center">
  <a href="README.md">中文</a>
</p>

---

## Features

### Desktop Pet

A star with moods that lives on your desktop. Hover and it spins, bounces, or bursts into hearts. When you're deep in focus, it winks to cheer you on. When you finish a session, it throws a full-screen confetti party. Shrink it into a tiny companion in the corner, or expand into a full-featured panel with one click. During a Pomodoro session, an ActionBubble appears above the pet — pause, resume, or pin the countdown without switching panels.

### Pomodoro Timer

Three phases auto-cycle (focus → short break → long break → …), and when it's time to rest, your pet nudges you. Every session is logged — look back at how long you focused today, how many minutes per plan, all tracked automatically. Customizable focus duration, short break, and long break times.

### Planner

Write plans in Markdown, set a date range, and FunBuddy auto-detects whether it's daily, weekly, or monthly — then marks it with color-coded dots on the calendar. Card view for scanning, compact view for density. Tags, search, sorting, and filtering. Link plans to Pomodoro sessions for automatic time tracking.

### Markdown Notes

Write on the left, see it rendered on the right — instant feedback. Toggle the floating table of contents and jump to any heading in long docs. Bold, italic, links — all have keyboard shortcuts, plus a right-click formatting menu. Code blocks get syntax highlighting (JS/TS/Python/CSS/JSON/Bash/XML/Markdown). Insert wiki-style links with `[[note name]]` to connect related notes — type `[[` to search and link existing notes, building your own knowledge network. Export notes to PDF and images.

### Multi-Tab

Both notes and plans support multi-tab browsing. Drag to reorder, pin frequently used items, right-click to close others — just like a browser. No more switching back and forth between lists.

### Quick Capture

`Ctrl+Shift+N` (customizable hotkey) — anytime, any app. A floating window pops up, you type, hit Enter, and it's saved as a note with a "Quick Note" tag. Zero workflow interruption. From spark to saved note in 2 seconds.

### AI Assistant Entry

Built-in AI search overlay with quick suggestions: summarize plans, find notes, create a plan, start a focus session. The interaction entry point is ready for future AI features.

### System Integration

- System tray — minimizes to tray instead of closing
- Auto-start on boot (optional)
- Global hotkey for quick capture
- Transparent window with glassmorphism — blends into your desktop
- Local data storage — your data stays on your machine

---

## AI Roadmap

> The pet isn't just a companion — it's becoming your AI work hub.

- **AI Assistant** — Manage plans and notes with natural language, smart search and summarization
- **Coding Agent Control Hub** — Orchestrate Claude Code, OpenAI Codex from the panel with visual multi-agent task tracking
- **AI Knowledge Base & Memory** — Give the pet long-term memory so you can find anything you've ever written using plain language
- **Browser & Desktop Automation** — Describe tasks in natural language, the pet operates browsers and apps for you
- **IM Integration** — Connect WeChat, Feishu, Slack with AI summaries and smart reply suggestions

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| [Electron](https://www.electronjs.org/) 42 | Transparent windows, tray, global hotkeys |
| [React](https://react.dev/) 19 + TypeScript | Component-based UI |
| [Tailwind CSS](https://tailwindcss.com/) 4 | Glassmorphism design system |
| [Motion](https://motion.dev/) | Smooth animations & panel morphing |
| [Zustand](https://zustand.docs.pmnd.rs/) + Immer | Reactive state management |
| [marked](https://marked.js.org/) + [highlight.js](https://highlightjs.org/) | Markdown rendering & code highlighting |
| [electron-vite](https://electron-vite.org/) | Build & HMR |
| [electron-store](https://github.com/sindresorhus/electron-store) | Persistent config storage |
| [Lucide React](https://lucide.dev/) | Icon library |

---

## Project Structure

```
fun-buddy/
├── src/
│   ├── main/                  # Electron main process
│   │   ├── index.ts           # App entry point
│   │   ├── window.ts          # Window management
│   │   ├── tray.ts            # System tray
│   │   ├── hotkey.ts          # Global hotkeys
│   │   ├── ipc-handlers.ts    # IPC communication
│   │   └── store.ts           # Main process persistence
│   ├── preload/               # Preload scripts
│   ├── renderer/              # Renderer process (React)
│   │   ├── components/
│   │   │   ├── pet/           # Pet components & animations
│   │   │   ├── timer/         # Pomodoro timer
│   │   │   ├── planner/       # Plan management
│   │   │   ├── notes/         # Markdown notes
│   │   │   ├── settings/      # Settings panel
│   │   │   ├── sidebar/       # Sidebar, navigation, AI search
│   │   │   ├── common/        # Shared components (TabBar, Toast, Markdown, etc.)
│   │   │   └── ui/            # Base UI components
│   │   ├── stores/            # Zustand state stores
│   │   ├── hooks/             # Custom hooks
│   │   ├── lib/               # Libraries (IPC, export, Markdown parsing)
│   │   └── utils/             # General utilities
│   └── shared/                # Shared between main/renderer
│       ├── ipc-channels.ts    # IPC channel definitions
│       └── store-schema.ts    # Data schema
├── resources/                 # App icons
├── electron-builder.yml       # Packaging config
└── electron.vite.config.ts    # Vite build config
```

---

## Getting Started

```bash
git clone https://github.com/PenglongHuang/fun-buddy.git
cd fun-buddy
npm install
npm run dev
```

Requires Node.js >= 18. Windows 10/11 only for now.

### Build for Distribution

```bash
npm run build:win
```

The installer will be generated in the `dist/` directory.

---

## License

[Apache License 2.0](LICENSE) &copy; Penglong Huang
