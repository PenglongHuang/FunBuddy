# PDF Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add PDF export to plans and notes with two trigger points (list context menu + editor toolbar more button), embedding images inline and rendering markdown with code highlighting.

**Architecture:** Renderer builds a self-contained HTML string (markdown parsed via `marked`, images as data URLs, code highlighted via `hljs`). Main process creates a hidden BrowserWindow to render the HTML, calls `printToPDF()`, shows save dialog, and writes the file — all in one IPC round trip.

**Tech Stack:** Electron `webContents.printToPDF()`, `marked`, `highlight.js`, existing `imageApi.readAsDataUrl()`

**Spec:** `docs/superpowers/specs/2026-05-11-pdf-export-design.md`

---

### Task 1: Add IPC channel and preload exposure

**Files:**
- Modify: `src/shared/ipc-channels.ts`
- Modify: `src/preload/index.ts`

- [ ] **Step 1: Add IPC channel constant**

In `src/shared/ipc-channels.ts`, add after the `IMAGE_MOVE_ASSETS` line (line 51):

```ts
  EXPORT_PDF: 'export:pdf',
```

- [ ] **Step 2: Add preload exposure**

In `src/preload/index.ts`, add a new method to the `api` object. Insert near the image methods (around line 115):

```ts
    exportPdf: (html: string, fileName: string, defaultPath?: string) =>
      ipcRenderer.invoke(IPC.EXPORT_PDF, html, fileName, defaultPath) as Promise<
        { success: true; filePath: string } | { success: true } | { success: false; error: string }
      >,
```

Note: renderer sends `undefined` for `defaultPath` when not provided — the main handler treats falsy as "no default".

- [ ] **Step 3: Commit**

```bash
git add src/shared/ipc-channels.ts src/preload/index.ts
git commit -m "feat(pdf): add export:pdf IPC channel and preload exposure"
```

---

### Task 2: Add main process PDF handler

**Files:**
- Modify: `src/main/ipc-handlers.ts`

- [ ] **Step 1: Add the IPC handler**

In `src/main/ipc-handlers.ts`, add after the `FS_WRITE_FILE_ABSOLUTE` handler (after line 253). This handler:
1. Creates a hidden BrowserWindow
2. Loads the HTML as a data URL
3. Waits for load + 500ms for image rendering
4. Calls `printToPDF()`
5. Shows save dialog via `withForegroundDialog`
6. Writes the file
7. Cleans up

```ts
ipcMain.handle(
  IPC.EXPORT_PDF,
  async (_e, html: string, fileName: string, defaultPath?: string) => {
    let win: BrowserWindow | null = null
    try {
      win = new BrowserWindow({ width: 800, height: 1200, show: false, webPreferences: { offscreen: true } })
      await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
      await new Promise((r) => setTimeout(r, 500))

      const pdfBytes = await win.webContents.printToPDF({
        pageSize: 'A4',
        printBackground: true,
        margins: { top: 20, bottom: 20, left: 25, right: 25 },
      })

      const saveResult = await withForegroundDialog(() =>
        dialog.showSaveDialog({
          defaultPath: defaultPath || fileName,
          filters: [{ name: 'PDF', extensions: ['pdf'] }],
        }),
      )

      if (saveResult.canceled) {
        return { success: true as const }
      }

      await writeFile(saveResult.filePath!, Buffer.from(pdfBytes))
      return { success: true as const, filePath: saveResult.filePath }
    } catch (err: any) {
      return { success: false as const, error: err.message || String(err) }
    } finally {
      win?.destroy()
    }
  },
)
```

Note: Add `BrowserWindow` to the electron import at the top of the file if not already imported (it's used via `getMainWindow()` but may be imported as a type). Check the existing imports and add `BrowserWindow` if missing.

- [ ] **Step 2: Verify build compiles**

Run: `cd d:/hpl/projects/fun-pets && npx electron-vite build 2>&1 | head -30`
Expected: No errors related to the new handler.

- [ ] **Step 3: Commit**

```bash
git add src/main/ipc-handlers.ts
git commit -m "feat(pdf): add main process printToPDF handler"
```

---

### Task 3: Add renderer IPC wrapper

**Files:**
- Modify: `src/renderer/src/lib/ipc.ts`

- [ ] **Step 1: Add export method**

In `src/renderer/src/lib/ipc.ts`, add a new exported object after the existing namespaces. Add at the end of the file (after `imageApi`, around line 129):

```ts
export const pdfExport = {
  generate: (html: string, fileName: string, defaultPath?: string) =>
    window.api.exportPdf(html, fileName, defaultPath),
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/src/lib/ipc.ts
git commit -m "feat(pdf): add renderer IPC wrapper for PDF export"
```

---

### Task 4: Build export-pdf.ts — HTML construction utility

**Files:**
- Create: `src/renderer/src/lib/export-pdf.ts`

This is the core utility that builds a self-contained HTML document from plan/note data.

- [ ] **Step 1: Create the export utility**

Create `src/renderer/src/lib/export-pdf.ts` with the following content:

```ts
import { marked } from 'marked'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import python from 'highlight.js/lib/languages/python'
import css from 'highlight.js/lib/languages/css'
import json from 'highlight.js/lib/languages/json'
import bash from 'highlight.js/lib/languages/bash'
import xml from 'highlight.js/lib/languages/xml'
import markdown from 'highlight.js/lib/languages/markdown'
import { imageApi } from './ipc'

// Register languages (same as MarkdownPreview)
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('js', javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('ts', typescript)
hljs.registerLanguage('python', python)
hljs.registerLanguage('py', python)
hljs.registerLanguage('css', css)
hljs.registerLanguage('json', json)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('sh', bash)
hljs.registerLanguage('html', xml)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('markdown', markdown)
hljs.registerLanguage('md', markdown)

export type ExportMode = 'title-body' | 'full-metadata'

export interface ExportOptions {
  content: string
  mdFilePath: string
  title: string
  mode: ExportMode
  fileName: string
  meta?: {
    tags?: string[]
    createdAt?: string
    planType?: string
    startDate?: string
    endDate?: string | null
  }
}

const IMAGE_REF_REGEX = /!\[[^\]]*\]\([^)]*\/assets\/([^)]+)\)/g

const CSS = `
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', sans-serif;
  padding: 0; margin: 0;
  color: #1a1a1a; line-height: 1.6; font-size: 14px;
}
h1.title {
  font-size: 24px; font-weight: 700;
  margin-bottom: 16px; padding-bottom: 8px;
  border-bottom: 1px solid #e5e7eb;
}
.meta { font-size: 12px; color: #6b7280; margin-bottom: 12px; line-height: 1.8; }
.meta div { margin-bottom: 2px; }
hr { border: none; border-top: 1px solid #e5e7eb; margin: 16px 0; }
.markdown-body h1 { font-size: 22px; font-weight: 600; margin: 20px 0 8px; }
.markdown-body h2 { font-size: 18px; font-weight: 600; margin: 16px 0 8px; }
.markdown-body h3 { font-size: 16px; font-weight: 600; margin: 12px 0 6px; }
.markdown-body p { margin: 8px 0; }
.markdown-body ul, .markdown-body ol { padding-left: 24px; margin: 8px 0; }
.markdown-body li { margin: 4px 0; }
.markdown-body pre { background: #f6f8fa; padding: 12px; border-radius: 6px; overflow-x: auto; }
.markdown-body code { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; }
.markdown-body :not(pre) > code { background: #f0f0f0; padding: 2px 4px; border-radius: 3px; }
.markdown-body img { max-width: 100%; height: auto; }
.markdown-body blockquote { border-left: 3px solid #d1d5db; padding-left: 12px; color: #6b7280; margin: 8px 0; }
.markdown-body table { border-collapse: collapse; width: 100%; margin: 8px 0; }
.markdown-body th, .markdown-body td { border: 1px solid #d1d5db; padding: 6px 12px; text-align: left; }
.markdown-body th { background: #f6f8fa; font-weight: 600; }
`

function buildCodeRenderer(): marked.MarkedExtension {
  const renderer = new marked.Renderer()
  renderer.code = function ({ text, lang }: { text: string; lang?: string }) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        const result = hljs.highlight(text, { language: lang })
        return `<pre><code class="hljs language-${lang}">${result.value}</code></pre>`
      } catch {}
    }
    const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    return `<pre><code>${escaped}</code></pre>`
  }
  return { renderer }
}

async function resolveImages(content: string, mdFilePath: string): Promise<Record<string, string>> {
  const imageMap: Record<string, string> = {}
  const refs = [...content.matchAll(IMAGE_REF_REGEX)].map((m) => m[1])
  const uniqueRefs = [...new Set(refs)]

  await Promise.all(
    uniqueRefs.map(async (ref) => {
      try {
        const dataUrl = await imageApi.readAsDataUrl(mdFilePath, ref)
        if (dataUrl) imageMap[ref] = dataUrl
      } catch {
        // skip failed images
      }
    }),
  )

  return imageMap
}

function buildImageRenderer(imageMap: Record<string, string>): marked.MarkedExtension {
  const renderer = new marked.Renderer()
  renderer.image = function ({ href, title, text }: { href: string; title?: string; text?: string }) {
    const localMatch = href?.match(/\/assets\/([^/]+)$/)
    if (localMatch && imageMap[localMatch[1]]) {
      return `<img src="${imageMap[localMatch[1]]}" alt="${text || ''}" ${title ? `title="${title}"` : ''} style="max-width:100%;height:auto" />`
    }
    return `<img src="${href || ''}" alt="${text || ''}" ${title ? `title="${title}"` : ''} style="max-width:100%;height:auto" />`
  }
  return { renderer }
}

function renderMetadata(meta: ExportOptions['meta']): string {
  if (!meta) return ''
  const lines: string[] = []
  if (meta.createdAt) lines.push(`<div>创建时间: ${meta.createdAt}</div>`)
  if (meta.tags?.length) lines.push(`<div>标签: ${meta.tags.join(', ')}</div>`)
  if (meta.planType) lines.push(`<div>类型: ${meta.planType}</div>`)
  if (meta.startDate) lines.push(`<div>开始: ${meta.startDate}</div>`)
  if (meta.endDate) lines.push(`<div>结束: ${meta.endDate}</div>`)
  return `<div class="meta">${lines.join('')}</div><hr>`
}

async function renderMarkdown(content: string, mdFilePath: string): Promise<string> {
  const imageMap = await resolveImages(content, mdFilePath)

  marked.use({ gfm: true, breaks: true })
  marked.use(buildCodeRenderer())
  marked.use(buildImageRenderer(imageMap))

  return marked.parse(content, { async: false }) as string
}

export async function buildExportHtml(options: ExportOptions): Promise<string> {
  const body = await renderMarkdown(options.content, options.mdFilePath)
  const metaHtml = options.mode === 'full-metadata' ? renderMetadata(options.meta) : ''

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>${CSS}</style></head>
<body>
<h1 class="title">${escapeHtml(options.title)}</h1>
${metaHtml}
<div class="markdown-body">${body}</div>
</body>
</html>`
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
```

- [ ] **Step 2: Verify build compiles**

Run: `cd d:/hpl/projects/fun-pets && npx electron-vite build 2>&1 | head -30`
Expected: No errors related to `export-pdf.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/lib/export-pdf.ts
git commit -m "feat(pdf): add HTML construction utility for PDF export"
```

---

### Task 5: Build ExportDialog component

**Files:**
- Create: `src/renderer/src/components/common/ExportDialog.tsx`

- [ ] **Step 1: Create the ExportDialog component**

Create `src/renderer/src/components/common/ExportDialog.tsx`:

```tsx
import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { FileDown, Loader2 } from 'lucide-react'
import type { ExportMode } from '@/lib/export-pdf'

interface ExportDialogProps {
  open: boolean
  onClose: () => void
  onExport: (mode: ExportMode) => Promise<void>
}

export default function ExportDialog({ open, onClose, onExport }: ExportDialogProps) {
  const [mode, setMode] = useState<ExportMode>('title-body')
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      await onExport(mode)
    } finally {
      setExporting(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.4)',
          }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'rgba(44,44,46,0.98)',
              borderRadius: 12,
              padding: '20px 24px',
              width: 280,
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>导出为 PDF</div>
              <div style={{ fontSize: 11, color: '#8e8e93', marginTop: 4 }}>选择导出内容范围</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              <Option
                label="标题 + 正文"
                desc="包含标题和正文内容"
                selected={mode === 'title-body'}
                onClick={() => setMode('title-body')}
              />
              <Option
                label="完整元数据 + 正文"
                desc="标题、标签、日期等 + 正文"
                selected={mode === 'full-metadata'}
                onClick={() => setMode('full-metadata')}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={onClose}
                disabled={exporting}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  color: '#8e8e93',
                  border: 'none',
                  padding: '6px 16px',
                  borderRadius: 6,
                  fontSize: 12,
                  cursor: exporting ? 'default' : 'pointer',
                }}
              >
                取消
              </button>
              <button
                onClick={handleExport}
                disabled={exporting}
                style={{
                  background: exporting ? '#2563eb' : '#3b82f6',
                  color: '#fff',
                  border: 'none',
                  padding: '6px 16px',
                  borderRadius: 6,
                  fontSize: 12,
                  cursor: exporting ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {exporting ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <FileDown size={12} />
                )}
                {exporting ? '导出中...' : '导出'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Option({
  label,
  desc,
  selected,
  onClick,
}: {
  label: string
  desc: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: selected ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${selected ? '#3b82f6' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: 8,
        padding: '10px 12px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <div
        style={{
          width: 16,
          height: 16,
          borderRadius: '50%',
          border: `2px solid ${selected ? '#3b82f6' : '#4b5563'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {selected && (
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6' }} />
        )}
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#e5e5e5' }}>{label}</div>
        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{desc}</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build compiles**

Run: `cd d:/hpl/projects/fun-pets && npx electron-vite build 2>&1 | head -30`
Expected: No errors related to `ExportDialog.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/common/ExportDialog.tsx
git commit -m "feat(pdf): add ExportDialog component"
```

---

### Task 6: Wire up PlanList context menu export trigger

**Files:**
- Modify: `src/renderer/src/components/planner/PlanList.tsx`

PlanList already has a context menu with items at lines 327-332. We add an "导出 PDF" item and state for the ExportDialog.

- [ ] **Step 1: Add imports**

At the top of `PlanList.tsx`, add these imports to the existing import blocks:

```ts
import ExportDialog from '@/components/common/ExportDialog'
import { buildExportHtml, type ExportMode } from '@/lib/export-pdf'
import { pdfExport } from '@/lib/ipc'
import { Download } from 'lucide-react'
```

Find an existing `lucide-react` import and add `Download` to it. Find or add the new imports as separate lines.

- [ ] **Step 2: Add export dialog state**

After the existing `contextMenu` state (around line 39), add:

```ts
const [exportTarget, setExportTarget] = useState<{ planId: string; title: string } | null>(null)
const [exporting, setExporting] = useState(false)
```

- [ ] **Step 3: Add export handler function**

Add a handler function inside the component, before the return:

```ts
const handleExportPdf = async (planId: string, mode: ExportMode) => {
  const plan = plans.find((p) => p.id === planId)
  if (!plan) return
  setExporting(true)
  try {
    const content = await loadPlanContent(planId)
    const html = await buildExportHtml({
      content: content || '',
      mdFilePath: plan.filePath,
      title: plan.title,
      mode,
      fileName: `${plan.title}.pdf`,
      meta: {
        tags: plan.tags,
        createdAt: plan.createdAt?.slice(0, 10),
        planType: plan.planType,
        startDate: plan.startDate,
        endDate: plan.endDate,
      },
    })
    const result = await pdfExport.generate(html, `${plan.title}.pdf`)
    setExportTarget(null)
    if (result.success && 'filePath' in result) {
      useToastStore.getState().show('PDF 导出成功')
    } else if (!result.success) {
      useToastStore.getState().show('导出失败: ' + result.error)
    }
  } catch (err: any) {
    setExportTarget(null)
    useToastStore.getState().show('导出失败: ' + (err.message || String(err)))
  } finally {
    setExporting(false)
  }
}
```

Note: `plans` and `loadPlanContent` are already available in the component from the plan store. Verify `useToastStore` is imported (add `import { useToastStore } from '@/stores/toastStore'` if not already imported).

- [ ] **Step 4: Add context menu item**

In the ContextMenu items array (lines 327-332), add a new item after "查看详情" and before "编辑类型和时间":

```ts
{
  label: '导出 PDF',
  icon: <Download size={13} />,
  onClick: () => {
    const plan = plans.find((p) => p.id === contextMenu.planId)
    if (plan) setExportTarget({ planId: contextMenu.planId, title: plan.title })
    setContextMenu(null)
  },
},
```

- [ ] **Step 5: Add ExportDialog to JSX**

After the ContextMenu closing tag (around line 337), add:

```tsx
{exportTarget && (
  <ExportDialog
    open
    onClose={() => setExportTarget(null)}
    onExport={(mode) => handleExportPdf(exportTarget.planId, mode)}
  />
)}
```

- [ ] **Step 6: Verify build compiles**

Run: `cd d:/hpl/projects/fun-pets && npx electron-vite build 2>&1 | head -30`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/components/planner/PlanList.tsx
git commit -m "feat(pdf): add PDF export to plan list context menu"
```

---

### Task 7: Wire up NotesPanel context menu export trigger

**Files:**
- Modify: `src/renderer/src/components/notes/NotesPanel.tsx`

Same pattern as Task 6 but for notes.

- [ ] **Step 1: Add imports**

At the top of `NotesPanel.tsx`, add:

```ts
import ExportDialog from '@/components/common/ExportDialog'
import { buildExportHtml, type ExportMode } from '@/lib/export-pdf'
import { pdfExport } from '@/lib/ipc'
import { Download } from 'lucide-react'
```

Add `Download` to existing lucide-react imports.

- [ ] **Step 2: Add export dialog state**

After the existing `contextMenu` state (around line 33), add:

```ts
const [exportTarget, setExportTarget] = useState<{ noteId: string; title: string } | null>(null)
const [exporting, setExporting] = useState(false)
```

- [ ] **Step 3: Add export handler function**

```ts
const handleExportPdf = async (noteId: string, mode: ExportMode) => {
  const note = notes.find((n) => n.id === noteId)
  if (!note) return
  setExporting(true)
  try {
    const content = await loadNoteContent(noteId)
    const html = await buildExportHtml({
      content: content || '',
      mdFilePath: note.filePath,
      title: note.title,
      mode,
      fileName: `${note.title}.pdf`,
      meta: {
        tags: note.tags,
        createdAt: note.createdAt?.slice(0, 10),
      },
    })
    const result = await pdfExport.generate(html, `${note.title}.pdf`)
    setExportTarget(null)
    if (result.success && 'filePath' in result) {
      useToastStore.getState().show('PDF 导出成功')
    } else if (!result.success) {
      useToastStore.getState().show('导出失败: ' + result.error)
    }
  } catch (err: any) {
    setExportTarget(null)
    useToastStore.getState().show('导出失败: ' + (err.message || String(err)))
  } finally {
    setExporting(false)
  }
}
```

Note: `notes` and `loadNoteContent` are already available from the note store. Add `import { useToastStore } from '@/stores/toastStore'` if not already imported.

- [ ] **Step 4: Add context menu item**

In the ContextMenu items array (lines 300-303), add after "查看详情" and before "删除笔记":

```ts
{
  label: '导出 PDF',
  icon: <Download size={13} />,
  onClick: () => {
    const note = notes.find((n) => n.id === contextMenu.noteId)
    if (note) setExportTarget({ noteId: contextMenu.noteId, title: note.title })
    setContextMenu(null)
  },
},
```

- [ ] **Step 5: Add ExportDialog to JSX**

After the ContextMenu closing tag (around line 308), add:

```tsx
{exportTarget && (
  <ExportDialog
    open
    onClose={() => setExportTarget(null)}
    onExport={(mode) => handleExportPdf(exportTarget.noteId, mode)}
  />
)}
```

- [ ] **Step 6: Verify build compiles**

Run: `cd d:/hpl/projects/fun-pets && npx electron-vite build 2>&1 | head -30`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/components/notes/NotesPanel.tsx
git commit -m "feat(pdf): add PDF export to notes panel context menu"
```

---

### Task 8: Add more button to PlanEditor toolbar

**Files:**
- Modify: `src/renderer/src/components/planner/PlanEditor.tsx`

Add a MoreButton and ContextMenu with "导出 PDF" to the existing toolbar.

- [ ] **Step 1: Add imports**

At the top, add to existing import blocks:

```ts
import MoreButton from '@/components/ui/MoreButton'
import ContextMenu from '@/components/ui/ContextMenu'
import ExportDialog from '@/components/common/ExportDialog'
import { buildExportHtml, type ExportMode } from '@/lib/export-pdf'
import { pdfExport } from '@/lib/ipc'
import { Download } from 'lucide-react'
```

- [ ] **Step 2: Add state**

Inside the component, after existing state declarations, add:

```ts
const [editorContextMenu, setEditorContextMenu] = useState<DOMRect | null>(null)
const [exportOpen, setExportOpen] = useState(false)
```

- [ ] **Step 3: Add export handler**

```ts
const handleExport = async (mode: ExportMode) => {
  if (!plan) return
  try {
    const content = await loadPlanContent(planId)
    const html = await buildExportHtml({
      content: content || '',
      mdFilePath: plan.filePath,
      title: plan.title,
      mode,
      fileName: `${plan.title}.pdf`,
      meta: {
        tags: plan.tags,
        createdAt: plan.createdAt?.slice(0, 10),
        planType: plan.planType,
        startDate: plan.startDate,
        endDate: plan.endDate,
      },
    })
    const result = await pdfExport.generate(html, `${plan.title}.pdf`)
    setExportOpen(false)
    if (result.success && 'filePath' in result) {
      useToastStore.getState().show('PDF 导出成功')
    } else if (!result.success) {
      useToastStore.getState().show('导出失败: ' + result.error)
    }
  } catch (err: any) {
    setExportOpen(false)
    useToastStore.getState().show('导出失败: ' + (err.message || String(err)))
  }
}
```

- [ ] **Step 4: Add MoreButton to toolbar**

In the toolbar `<div className="flex items-center gap-3">` (line 265), after the mode toggle `</div>` (line 319) and before the toolbar closing `</div>` (line 320), insert:

```tsx
<MoreButton onClick={(e) => setEditorContextMenu(e.currentTarget.getBoundingClientRect())} />
```

Note: The MoreButton should use `opacity-100` instead of `opacity-0 group-hover:opacity-100` in the editor context since there's no group-hover parent. Override the button's opacity via style or add `group` class to the toolbar div. The simplest approach is to always show the button in the editor toolbar. Apply `style={{ opacity: 1 }}` to override the default hidden state.

- [ ] **Step 5: Add ContextMenu and ExportDialog**

After the toolbar div, before the editor content area, add:

```tsx
{editorContextMenu && (
  <ContextMenu
    items={[
      {
        label: '导出 PDF',
        icon: <Download size={13} />,
        onClick: () => {
          setExportOpen(true)
          setEditorContextMenu(null)
        },
      },
    ]}
    anchorRect={editorContextMenu}
    onClose={() => setEditorContextMenu(null)}
  />
)}
{exportOpen && <ExportDialog open onClose={() => setExportOpen(false)} onExport={handleExport} />}
```

- [ ] **Step 6: Verify build compiles**

Run: `cd d:/hpl/projects/fun-pets && npx electron-vite build 2>&1 | head -30`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/components/planner/PlanEditor.tsx
git commit -m "feat(pdf): add more button with PDF export to plan editor"
```

---

### Task 9: Add more button to NoteEditor toolbar

**Files:**
- Modify: `src/renderer/src/components/notes/NoteEditor.tsx`

Same pattern as Task 8 but for the note editor.

- [ ] **Step 1: Add imports**

```ts
import MoreButton from '@/components/ui/MoreButton'
import ContextMenu from '@/components/ui/ContextMenu'
import ExportDialog from '@/components/common/ExportDialog'
import { buildExportHtml, type ExportMode } from '@/lib/export-pdf'
import { pdfExport } from '@/lib/ipc'
import { Download } from 'lucide-react'
```

- [ ] **Step 2: Add state**

```ts
const [editorContextMenu, setEditorContextMenu] = useState<DOMRect | null>(null)
const [exportOpen, setExportOpen] = useState(false)
```

- [ ] **Step 3: Add export handler**

```ts
const handleExport = async (mode: ExportMode) => {
  if (!note) return
  try {
    const content = await loadNoteContent(activeNoteId!)
    const html = await buildExportHtml({
      content: content || '',
      mdFilePath: note.filePath,
      title: note.title,
      mode,
      fileName: `${note.title}.pdf`,
      meta: {
        tags: note.tags,
        createdAt: note.createdAt?.slice(0, 10),
      },
    })
    const result = await pdfExport.generate(html, `${note.title}.pdf`)
    setExportOpen(false)
    if (result.success && 'filePath' in result) {
      useToastStore.getState().show('PDF 导出成功')
    } else if (!result.success) {
      useToastStore.getState().show('导出失败: ' + result.error)
    }
  } catch (err: any) {
    setExportOpen(false)
    useToastStore.getState().show('导出失败: ' + (err.message || String(err)))
  }
}
```

- [ ] **Step 4: Add MoreButton to toolbar**

In the toolbar div (line 392), after the mode toggle `</div>` (line 469) and before the toolbar closing `</div>` (line 470), insert:

```tsx
<MoreButton onClick={(e) => setEditorContextMenu(e.currentTarget.getBoundingClientRect())} />
```

Same opacity note as Task 8 — override to always visible in the editor toolbar.

- [ ] **Step 5: Add ContextMenu and ExportDialog**

After the toolbar div, add:

```tsx
{editorContextMenu && (
  <ContextMenu
    items={[
      {
        label: '导出 PDF',
        icon: <Download size={13} />,
        onClick: () => {
          setExportOpen(true)
          setEditorContextMenu(null)
        },
      },
    ]}
    anchorRect={editorContextMenu}
    onClose={() => setEditorContextMenu(null)}
  />
)}
{exportOpen && <ExportDialog open onClose={() => setExportOpen(false)} onExport={handleExport} />}
```

- [ ] **Step 6: Verify build compiles**

Run: `cd d:/hpl/projects/fun-pets && npx electron-vite build 2>&1 | head -30`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/components/notes/NoteEditor.tsx
git commit -m "feat(pdf): add more button with PDF export to note editor"
```

---

### Task 10: Manual verification and polish

- [ ] **Step 1: Start the app in dev mode**

Run: `cd d:/hpl/projects/fun-pets && npx electron-vite dev`

- [ ] **Step 2: Test list context menu export**
1. Create or open an existing plan with content and images
2. Right-click (or click more button) on the plan card in the list
3. Verify "导出 PDF" appears in the context menu
4. Click it — verify ExportDialog appears
5. Select a mode, click "导出"
6. Verify save dialog appears
7. Save the file — verify Toast shows success
8. Open the PDF — verify title, content, images, and code blocks render correctly
9. Repeat for a note

- [ ] **Step 3: Test editor toolbar export**
1. Open a plan in the editor view
2. Verify "..." more button appears in the toolbar
3. Click it — verify context menu with "导出 PDF" appears
4. Click "导出 PDF" — verify ExportDialog appears
5. Test both export modes
6. Repeat for a note in the editor

- [ ] **Step 4: Test edge cases**
1. Export a plan/note with no images — should succeed
2. Export a plan/note with external URL images — should include them (may show broken if offline)
3. Cancel the save dialog — should silently close, no error Toast
4. Test with Chinese characters in title — filename should be correct

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(pdf): polish after manual testing"
```
