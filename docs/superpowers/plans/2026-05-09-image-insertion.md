# Markdown 图片插入功能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为计划模块和笔记模块的 Markdown 编辑器添加图片插入支持（粘贴、拖拽、文件选择器），图片就近存储在独立 assets 目录中。

**Architecture:** IPC 主进程处理——渲染进程捕获事件并读取图片为 ArrayBuffer，通过新增 IPC 通道传给主进程保存到 assets 目录。预览通过 Data URL（sharp 按需缩放 + 缓存）渲染本地图片。

**Tech Stack:** Electron 42 IPC, sharp (图片处理), nanoid (文件名), marked (已有, 渲染), React 19

**Spec:** `docs/superpowers/specs/2026-05-09-image-insertion-design.md`

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/shared/ipc-channels.ts` | 6 个新 IPC 通道常量 |
| `src/main/ipc-handlers.ts` | 图片 IPC handler 实现 + 路径验证 + Data URL 缓存 |
| `src/preload/index.ts` | 桥接 6 个新 IPC 通道 |
| `src/preload/index.d.ts` | 新增方法类型声明 |
| `src/renderer/src/lib/ipc.ts` | 图片 IPC 调用封装 (`imageApi`) |
| `src/renderer/src/lib/markdown-operations.ts` | 新增 `createInsertImageWithPath` 纯文本操作 |
| `src/renderer/src/components/common/MarkdownEditor.tsx` | onPaste/onDrop/onDragOver + mdFilePath prop + Toast |
| `src/renderer/src/components/common/MarkdownPreview.tsx` | 图片路径 Data URL 转换 |
| `src/renderer/src/components/common/SplitPaneLiveEditor.tsx` | 透传 mdFilePath |
| `src/renderer/src/components/ui/MarkdownContextMenu.tsx` | 图片菜单项异步回调 |
| `src/renderer/src/components/notes/NoteEditor.tsx` | 传递 mdFilePath + onInsertImageFromPicker + 孤立图片清理 |
| `src/renderer/src/components/planner/PlanEditor.tsx` | 传递 mdFilePath + onInsertImageFromPicker + 孤立图片清理 |
| `src/renderer/src/stores/noteStore.ts` | 删除时 image:cleanup |
| `src/renderer/src/stores/planStore.ts` | 删除时 image:cleanup + 移动时迁移 assets |
| `package.json` | sharp 依赖 |
| `electron-builder.yml` | sharp 原生模块打包配置 |

---

### Task 1: Install sharp + update electron-builder.yml

**Files:**
- Modify: `package.json`
- Modify: `electron-builder.yml`

- [ ] **Step 1: Install sharp**

```bash
cd d:/hpl/projects/fun-pets && npm install sharp
```

- [ ] **Step 2: Verify installation**

```bash
cd d:/hpl/projects/fun-pets && node -e "const sharp = require('sharp'); console.log('sharp loaded')"
```
Expected: `sharp loaded`

- [ ] **Step 3: Update electron-builder.yml**

In `electron-builder.yml`, update the `files` section to include sharp's native modules:

```yaml
files:
  - out/**/*
  - resources/**/*
  - node_modules/sharp/**/*
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json electron-builder.yml
git commit -m "chore: add sharp dependency and configure electron-builder for native modules"
```

---

### Task 2: Add IPC channels + preload bridge + TypeScript declarations

This task adds all 6 IPC channels, the preload bridge, type declarations, and the renderer IPC wrapper in one shot. This ensures TypeScript compiles from this point forward.

**Files:**
- Modify: `src/shared/ipc-channels.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/preload/index.d.ts`
- Modify: `src/renderer/src/lib/ipc.ts`

- [ ] **Step 1: Add IPC channel constants**

In `src/shared/ipc-channels.ts`, add before the closing `} as const`:

```typescript
  // Image
  IMAGE_SAVE: 'image:save',
  IMAGE_PICK_AND_SAVE: 'image:pickAndSave',
  IMAGE_DELETE: 'image:delete',
  IMAGE_CLEANUP: 'image:cleanup',
  IMAGE_READ_AS_DATA_URL: 'image:readAsDataUrl',
  IMAGE_MOVE_ASSETS: 'image:moveAssets',
```

- [ ] **Step 2: Add preload bridge methods**

In `src/preload/index.ts`, add after the `// FS absolute` block (after the `fsWriteFileAbsolute` method, before `// Auto-launch`):

```typescript
  // Image
  imageSave: (mdFilePath: string, imageData: ArrayBuffer, ext: string, altName?: string) =>
    ipcRenderer.invoke(IPC.IMAGE_SAVE, mdFilePath, imageData, ext, altName) as Promise<{ relativePath: string; fileName: string }>,
  imagePickAndSave: (mdFilePath: string) =>
    ipcRenderer.invoke(IPC.IMAGE_PICK_AND_SAVE, mdFilePath) as Promise<{ relativePath: string; fileName: string } | null>,
  imageDelete: (mdFilePath: string, imageFileName: string) =>
    ipcRenderer.invoke(IPC.IMAGE_DELETE, mdFilePath, imageFileName) as Promise<void>,
  imageCleanup: (mdFilePath: string) =>
    ipcRenderer.invoke(IPC.IMAGE_CLEANUP, mdFilePath) as Promise<void>,
  imageReadAsDataUrl: (mdFilePath: string, imageFileName: string, maxWidth?: number) =>
    ipcRenderer.invoke(IPC.IMAGE_READ_AS_DATA_URL, mdFilePath, imageFileName, maxWidth) as Promise<{ dataUrl: string; mimeType: string }>,
  imageMoveAssets: (oldMdFilePath: string, newMdFilePath: string) =>
    ipcRenderer.invoke(IPC.IMAGE_MOVE_ASSETS, oldMdFilePath, newMdFilePath) as Promise<void>,
```

- [ ] **Step 3: Add TypeScript declarations**

In `src/preload/index.d.ts`, add these methods to the `FunBuddyAPI` interface (before the closing `}`):

```typescript
  // Image
  imageSave: (mdFilePath: string, imageData: ArrayBuffer, ext: string, altName?: string) => Promise<{ relativePath: string; fileName: string }>
  imagePickAndSave: (mdFilePath: string) => Promise<{ relativePath: string; fileName: string } | null>
  imageDelete: (mdFilePath: string, imageFileName: string) => Promise<void>
  imageCleanup: (mdFilePath: string) => Promise<void>
  imageReadAsDataUrl: (mdFilePath: string, imageFileName: string, maxWidth?: number) => Promise<{ dataUrl: string; mimeType: string }>
  imageMoveAssets: (oldMdFilePath: string, newMdFilePath: string) => Promise<void>
```

- [ ] **Step 4: Add renderer IPC wrapper**

In `src/renderer/src/lib/ipc.ts`, add a new `imageApi` export after the `windowModeEvents` block:

```typescript
export const imageApi = {
  save: (mdFilePath: string, imageData: ArrayBuffer, ext: string, altName?: string) =>
    window.api.imageSave(mdFilePath, imageData, ext, altName),
  pickAndSave: (mdFilePath: string) =>
    window.api.imagePickAndSave(mdFilePath),
  deleteImage: (mdFilePath: string, imageFileName: string) =>
    window.api.imageDelete(mdFilePath, imageFileName),
  cleanup: (mdFilePath: string) =>
    window.api.imageCleanup(mdFilePath),
  readAsDataUrl: (mdFilePath: string, imageFileName: string, maxWidth?: number) =>
    window.api.imageReadAsDataUrl(mdFilePath, imageFileName, maxWidth),
  moveAssets: (oldMdFilePath: string, newMdFilePath: string) =>
    window.api.imageMoveAssets(oldMdFilePath, newMdFilePath),
}
```

- [ ] **Step 5: Commit**

```bash
git add src/shared/ipc-channels.ts src/preload/index.ts src/preload/index.d.ts src/renderer/src/lib/ipc.ts
git commit -m "feat: add all 6 image IPC channels, preload bridge, types, and renderer API"
```

---

### Task 3: Add main process image handlers

**Files:**
- Modify: `src/main/ipc-handlers.ts`

- [ ] **Step 1: Update imports**

At the top of `src/main/ipc-handlers.ts`, update the fs/promises import:

```typescript
import { readFile, writeFile, unlink, readdir, mkdir, rm, cp } from 'fs/promises'
```

Update the path import:

```typescript
import { join, dirname, resolve, parse as parsePath } from 'path'
```

Add new imports:

```typescript
import { nanoid } from 'nanoid'
import sharp from 'sharp'
```

- [ ] **Step 2: Add helper functions**

Inside `registerIpcHandlers()`, after the `getStorageDir()` function (line 17), add:

```typescript
  const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp']
  const IMAGE_MAX_SIZE = 10 * 1024 * 1024

  const dataUrlCache = new Map<string, { dataUrl: string; mimeType: string }>()

  function validatePath(dir: string, filePath: string): string {
    const fullPath = resolve(dir, filePath)
    if (!fullPath.startsWith(resolve(dir))) {
      throw new Error('Invalid path')
    }
    return fullPath
  }

  function getAssetsInfo(mdFilePath: string): { dir: string; assetsDir: string; baseName: string } {
    const dir = getStorageDir()
    const mdFull = validatePath(dir, mdFilePath)
    const mdDir = dirname(mdFull)
    const { name } = parsePath(mdFull)
    return { dir, assetsDir: join(mdDir, name, 'assets'), baseName: name }
  }
```

- [ ] **Step 3: Add IMAGE_SAVE handler**

After the existing IPC handlers (before the closing `}` of `registerIpcHandlers`), add:

```typescript
  // === Image handlers ===

  ipcMain.handle(IPC.IMAGE_SAVE, async (_e, mdFilePath: string, imageData: ArrayBuffer, ext: string, _altName?: string) => {
    if (!IMAGE_EXTENSIONS.includes(ext.toLowerCase())) {
      throw new Error(`Unsupported image format: ${ext}`)
    }

    const { assetsDir, baseName } = getAssetsInfo(mdFilePath)
    await mkdir(assetsDir, { recursive: true })

    const buffer = Buffer.from(imageData)
    if (buffer.length > IMAGE_MAX_SIZE) {
      throw new Error('Image exceeds 10MB limit')
    }

    // Validate image content via sharp
    let format: string
    try {
      const meta = await sharp(buffer).metadata()
      if (!meta.format) throw new Error('No format')
      format = meta.format
    } catch {
      throw new Error('Invalid image data')
    }

    const actualExt = format === 'jpeg' ? 'jpg' : format
    const fileName = `${nanoid(8)}.${actualExt}`
    await writeFile(join(assetsDir, fileName), buffer)

    const relativePath = `./${baseName}/assets/${fileName}`
    return { relativePath, fileName }
  })
```

- [ ] **Step 4: Add IMAGE_PICK_AND_SAVE handler**

```typescript
  ipcMain.handle(IPC.IMAGE_PICK_AND_SAVE, async (_e, mdFilePath: string) => {
    const result = await withForegroundDialog(() =>
      dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Images', extensions: IMAGE_EXTENSIONS }],
      })
    )
    if (result.canceled || result.filePaths.length === 0) return null

    const { assetsDir, baseName } = getAssetsInfo(mdFilePath)
    await mkdir(assetsDir, { recursive: true })

    const saved = await Promise.all(result.filePaths.map(async (srcPath) => {
      const ext = srcPath.split('.').pop()?.toLowerCase() || 'png'
      const fileName = `${nanoid(8)}.${ext}`
      await cp(srcPath, join(assetsDir, fileName))
      return { relativePath: `./${baseName}/assets/${fileName}`, fileName }
    }))

    return saved[0]
  })
```

- [ ] **Step 5: Add IMAGE_DELETE handler**

```typescript
  ipcMain.handle(IPC.IMAGE_DELETE, async (_e, mdFilePath: string, imageFileName: string) => {
    const { assetsDir } = getAssetsInfo(mdFilePath)
    const fullPath = join(assetsDir, imageFileName)
    if (!resolve(fullPath).startsWith(resolve(assetsDir))) {
      throw new Error('Invalid image path')
    }
    try { await unlink(fullPath) } catch { /* already deleted */ }
    for (const key of dataUrlCache.keys()) {
      if (key.includes(imageFileName)) dataUrlCache.delete(key)
    }
  })
```

- [ ] **Step 6: Add IMAGE_CLEANUP handler**

```typescript
  ipcMain.handle(IPC.IMAGE_CLEANUP, async (_e, mdFilePath: string) => {
    const { dir } = getAssetsInfo(mdFilePath)
    const mdFull = validatePath(dir, mdFilePath)
    const mdDir = dirname(mdFull)
    const { name } = parsePath(mdFull)
    const noteDir = join(mdDir, name)
    if (!resolve(noteDir).startsWith(resolve(mdDir))) {
      throw new Error('Invalid path')
    }
    try { await rm(noteDir, { recursive: true, force: true }) } catch { /* ignore */ }
    for (const key of dataUrlCache.keys()) {
      if (key.startsWith(mdFilePath)) dataUrlCache.delete(key)
    }
  })
```

- [ ] **Step 7: Add IMAGE_READ_AS_DATA_URL handler**

```typescript
  ipcMain.handle(IPC.IMAGE_READ_AS_DATA_URL, async (_e, mdFilePath: string, imageFileName: string, maxWidth?: number) => {
    const cacheKey = `${mdFilePath}:${imageFileName}:${maxWidth || 0}`
    const cached = dataUrlCache.get(cacheKey)
    if (cached) return cached

    const { assetsDir } = getAssetsInfo(mdFilePath)
    const fullPath = join(assetsDir, imageFileName)
    if (!resolve(fullPath).startsWith(resolve(assetsDir))) {
      throw new Error('Invalid image path')
    }

    let buffer: Buffer
    let mimeType: string

    if (maxWidth && maxWidth > 0) {
      const image = sharp(fullPath)
      const meta = await image.metadata()
      if (meta.width && meta.width > maxWidth) {
        buffer = await image.resize(maxWidth).toBuffer()
      } else {
        buffer = await readFile(fullPath) as Buffer
      }
      const format = meta.format || 'png'
      mimeType = `image/${format === 'jpg' ? 'jpeg' : format}`
    } else {
      buffer = await readFile(fullPath) as Buffer
      const meta = await sharp(buffer).metadata()
      const format = meta.format || 'png'
      mimeType = `image/${format === 'jpg' ? 'jpeg' : format}`
    }

    const dataUrl = `data:${mimeType};base64,${buffer.toString('base64')}`
    const result = { dataUrl, mimeType }
    dataUrlCache.set(cacheKey, result)
    return result
  })
```

- [ ] **Step 8: Add IMAGE_MOVE_ASSETS handler**

```typescript
  ipcMain.handle(IPC.IMAGE_MOVE_ASSETS, async (_e, oldMdFilePath: string, newMdFilePath: string) => {
    const dir = getStorageDir()
    const oldMdFull = validatePath(dir, oldMdFilePath)
    const newMdFull = validatePath(dir, newMdFilePath)
    const { name: oldBase } = parsePath(oldMdFull)
    const { name: newBase } = parsePath(newMdFull)
    const oldDir = join(dirname(oldMdFull), oldBase)
    const newDir = join(dirname(newMdFull), newBase)
    try {
      await mkdir(dirname(newDir), { recursive: true })
      await cp(oldDir, newDir, { recursive: true })
      await rm(oldDir, { recursive: true, force: true })
    } catch { /* no assets to move */ }
    for (const key of dataUrlCache.keys()) {
      if (key.startsWith(oldMdFilePath)) {
        const newKey = key.replace(oldMdFilePath, newMdFilePath)
        dataUrlCache.set(newKey, dataUrlCache.get(key)!)
        dataUrlCache.delete(key)
      }
    }
  })
```

- [ ] **Step 9: Verify build**

```bash
cd d:/hpl/projects/fun-pets && npx electron-vite build 2>&1 | tail -10
```
Expected: Build succeeds

- [ ] **Step 10: Commit**

```bash
git add src/main/ipc-handlers.ts
git commit -m "feat: add all 6 main process image IPC handlers with validation and caching"
```

---

### Task 4: Add insertImageWithPath + update MarkdownEditor

**Files:**
- Modify: `src/renderer/src/lib/markdown-operations.ts`
- Modify: `src/renderer/src/components/common/MarkdownEditor.tsx`

- [ ] **Step 1: Add createInsertImageWithPath**

In `src/renderer/src/lib/markdown-operations.ts`, add before `copyToClipboard`:

```typescript
export function createInsertImageWithPath(relativePath: string, altText: string): MarkdownOperation {
  return (text, start, _end): OperationResult => {
    const inserted = `![${altText}](${relativePath})`
    return {
      text: text.substring(0, start) + inserted + text.substring(start),
      start: start + 2,
      end: start + 2 + altText.length,
    }
  }
}
```

- [ ] **Step 2: Update MarkdownEditor props and imports**

In `src/renderer/src/components/common/MarkdownEditor.tsx`, add imports at the top:

```typescript
import { imageApi } from '@/lib/ipc'
import { createInsertImageWithPath } from '@/lib/markdown-operations'
```

Update the interface:

```typescript
interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  onCursorLineChange?: (lineIndex: number | null) => void
  onContextMenu?: (e: React.MouseEvent<HTMLTextAreaElement>) => void
  mdFilePath?: string
  onInsertImageFromPicker?: () => void
  showToast?: (msg: string) => void
}
```

Update the destructuring:

```typescript
export default function MarkdownEditor({ value, onChange, placeholder, onCursorLineChange, onContextMenu, mdFilePath, onInsertImageFromPicker, showToast }: MarkdownEditorProps) {
```

- [ ] **Step 3: Add handlePaste**

Add before `handleKeyDown`:

```typescript
  const handlePaste = useCallback(async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (!mdFilePath) return
    const items = e.clipboardData.items
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (!file) continue
        if (file.size > 10 * 1024 * 1024) {
          showToast?.('图片过大，请选择 10MB 以内的图片')
          return
        }
        const buffer = await file.arrayBuffer()
        const ext = item.type.split('/')[1] || 'png'
        const altName = file.name || 'image'
        try {
          const result = await imageApi.save(mdFilePath, buffer, ext, altName)
          const op = createInsertImageWithPath(result.relativePath, altName)
          const ta = e.currentTarget
          const res = op(value, ta.selectionStart, ta.selectionEnd)
          applyOperationToTextarea(ta, value, res.text, res.start, res.end)
        } catch {
          showToast?.('保存图片失败')
        }
        return
      }
    }
  }, [mdFilePath, value, showToast])
```

- [ ] **Step 4: Add handleDragOver and handleDrop**

```typescript
  const handleDragOver = useCallback((e: React.DragEvent<HTMLTextAreaElement>) => {
    const hasImage = [...e.dataTransfer.items].some(item => item.type.startsWith('image/'))
    if (hasImage) e.preventDefault()
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent<HTMLTextAreaElement>) => {
    if (!mdFilePath) return
    const files = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/'))
    if (files.length === 0) return
    e.preventDefault()

    const ta = e.currentTarget
    let currentText = value
    let currentPos = ta.selectionStart

    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        showToast?.('图片过大，请选择 10MB 以内的图片')
        continue
      }
      const buffer = await file.arrayBuffer()
      const ext = file.type.split('/')[1] || 'png'
      const altName = file.name || 'image'
      try {
        const result = await imageApi.save(mdFilePath, buffer, ext, altName)
        const op = createInsertImageWithPath(result.relativePath, altName)
        const res = op(currentText, currentPos, currentPos)
        applyOperationToTextarea(ta, currentText, res.text, res.start, res.end)
        currentText = res.text
        currentPos = res.end
      } catch {
        showToast?.('保存图片失败')
      }
    }
  }, [mdFilePath, value, showToast])
```

- [ ] **Step 5: Add Ctrl+Shift+I shortcut**

In `handleKeyDown`, inside the `if (e.ctrlKey || e.metaKey)` block, add before the SHORTCUTS find:

```typescript
      if (e.shiftKey && e.code === 'KeyI') {
        e.preventDefault()
        onInsertImageFromPicker?.()
        return
      }
```

- [ ] **Step 6: Update textarea JSX**

Add the new event handlers to the textarea:

```tsx
    <textarea
      className="w-full h-full bg-transparent text-xs text-white/80 font-mono resize-none outline-none placeholder:text-white/20"
      style={{ userSelect: 'text' }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onSelect={() => { ... }}
      onContextMenu={(e) => onContextMenu?.(e)}
      placeholder={placeholder}
      spellCheck={false}
    />
```

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/lib/markdown-operations.ts src/renderer/src/components/common/MarkdownEditor.tsx
git commit -m "feat: add image paste, drag-drop, file picker shortcut, and Toast feedback to MarkdownEditor"
```

---

### Task 5: Update MarkdownPreview for image Data URL rendering

**Files:**
- Modify: `src/renderer/src/components/common/MarkdownPreview.tsx`

- [ ] **Step 1: Rewrite MarkdownPreview**

Replace the entire file content with:

```typescript
import { useState, useEffect, useMemo } from 'react'
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
import { imageApi } from '@/lib/ipc'

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

// Code renderer (shared, not dependent on image state)
const codeRenderer = new marked.Renderer()
codeRenderer.code = function ({ text, lang }: { text: string; lang?: string }) {
  const language = lang && hljs.getLanguage(lang) ? lang : undefined
  const highlighted = language
    ? hljs.highlight(text, { language }).value
    : text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return `<pre><code class="hljs language-${lang || 'plaintext'}">${highlighted}</code></pre>`
}

interface MarkdownPreviewProps {
  content: string
  mdFilePath?: string
}

export default function MarkdownPreview({ content, mdFilePath }: MarkdownPreviewProps) {
  const [imageMap, setImageMap] = useState<Record<string, string>>({})

  // Extract image file names from content
  const imageRefs = useMemo(() => {
    const refs: string[] = []
    const regex = /!\[[^\]]*\]\(\.?\/?assets\/([^)]+)\)/g
    let match
    while ((match = regex.exec(content)) !== null) {
      if (match[1]) refs.push(match[1])
    }
    return refs
  }, [content])

  const imageRefsKey = imageRefs.join(',')

  // Resolve images to Data URLs
  useEffect(() => {
    if (!mdFilePath || imageRefs.length === 0) {
      setImageMap({})
      return
    }

    let cancelled = false
    ;(async () => {
      const entries = await Promise.all(
        imageRefs.map(async (ref) => {
          try {
            const { dataUrl } = await imageApi.readAsDataUrl(mdFilePath, ref, 800)
            return [ref, dataUrl] as const
          } catch {
            return [ref, ''] as const
          }
        })
      )
      if (cancelled) return
      const map: Record<string, string> = {}
      for (const [ref, url] of entries) {
        if (url) map[ref] = url
      }
      setImageMap(map)
    })()

    return () => { cancelled = true }
  }, [mdFilePath, imageRefsKey])

  // Build renderer with resolved image URLs
  const renderer = useMemo(() => {
    const r = new marked.Renderer()

    r.code = codeRenderer.code.bind(codeRenderer)

    r.image = function ({ href, title, text }: { href: string; title?: string; text?: string }) {
      const localMatch = href?.match(/\.?\/?assets\/(.+)/)
      if (localMatch && imageMap[localMatch[1]]) {
        return `<img src="${imageMap[localMatch[1]]}" alt="${text || ''}" ${title ? `title="${title}"` : ''} style="max-width:100%;border-radius:var(--radius-sm)">`
      }
      if (localMatch && !imageMap[localMatch[1]]) {
        return `<div style="padding:8px 12px;background:rgba(255,255,255,0.05);border-radius:var(--radius-sm);color:var(--text-tertiary);font-size:12px;text-align:center">图片未找到: ${text || localMatch[1]}</div>`
      }
      return `<img src="${href || ''}" alt="${text || ''}" ${title ? `title="${title}"` : ''} style="max-width:100%;border-radius:var(--radius-sm)">`
    }

    return r
  }, [imageMap])

  const html = useMemo(() => {
    marked.use({ renderer, gfm: true, breaks: true })
    return marked.parse(content, { async: false }) as string
  }, [content, renderer])

  return (
    <div
      className="markdown-body"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/src/components/common/MarkdownPreview.tsx
git commit -m "feat: resolve local image paths to Data URLs with caching in MarkdownPreview"
```

---

### Task 6: Update MarkdownContextMenu for async image insertion

**Files:**
- Modify: `src/renderer/src/components/ui/MarkdownContextMenu.tsx`

- [ ] **Step 1: Add onInsertImage prop**

Update the interface:

```typescript
interface MarkdownContextMenuProps {
  anchorRect: DOMRect
  onClose: () => void
  mode: 'edit' | 'live' | 'preview'
  text: string
  selectionStart: number
  selectionEnd: number
  selectedText: string
  hasSelection: boolean
  onApplyOperation: (newText: string, newStart: number, newEnd: number) => void
  onInsertImage?: () => void
  previewContent?: string
}
```

Add to destructuring:

```typescript
  onInsertImage, previewContent,
```

- [ ] **Step 2: Update image menu item**

Change the image menu item in the `editItems` useMemo (the one at `{ label: '图片', icon: <Image size={13} />, onClick: ... }`):

```typescript
        { label: '图片', icon: <Image size={13} />, onClick: () => onInsertImage ? onInsertImage() : applyOp(insertImage) },
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/ui/MarkdownContextMenu.tsx
git commit -m "feat: add async onInsertImage callback to MarkdownContextMenu"
```

---

### Task 7: Update SplitPaneLiveEditor to pass mdFilePath

**Files:**
- Modify: `src/renderer/src/components/common/SplitPaneLiveEditor.tsx`

- [ ] **Step 1: Add props**

Update interface:

```typescript
interface SplitPaneLiveEditorProps {
  value: string
  onChange: (value: string) => void
  onCursorLineChange?: (lineIndex: number | null) => void
  placeholder?: string
  onContextMenu?: (e: React.MouseEvent<HTMLTextAreaElement>) => void
  onPreviewContextMenu?: (e: React.MouseEvent) => void
  mdFilePath?: string
  onInsertImageFromPicker?: () => void
  showToast?: (msg: string) => void
}
```

Update destructuring:

```typescript
export default function SplitPaneLiveEditor({ value, onChange, onCursorLineChange, placeholder, onContextMenu, onPreviewContextMenu, mdFilePath, onInsertImageFromPicker, showToast }: SplitPaneLiveEditorProps) {
```

- [ ] **Step 2: Pass to MarkdownEditor and MarkdownPreview**

Update the MarkdownEditor:

```tsx
        <MarkdownEditor
          value={value}
          onChange={onChange}
          onCursorLineChange={onCursorLineChange}
          placeholder={placeholder}
          onContextMenu={onContextMenu}
          mdFilePath={mdFilePath}
          onInsertImageFromPicker={onInsertImageFromPicker}
          showToast={showToast}
        />
```

Update the MarkdownPreview:

```tsx
        <MarkdownPreview content={value} mdFilePath={mdFilePath} />
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/common/SplitPaneLiveEditor.tsx
git commit -m "feat: pass mdFilePath, onInsertImageFromPicker, and showToast through SplitPaneLiveEditor"
```

---

### Task 8: Integrate with NoteEditor + orphan cleanup

**Files:**
- Modify: `src/renderer/src/components/notes/NoteEditor.tsx`

- [ ] **Step 1: Add imports**

```typescript
import { imageApi } from '@/lib/ipc'
import { createInsertImageWithPath } from '@/lib/markdown-operations'
```

- [ ] **Step 2: Add orphan image cleanup utility**

Add a helper function outside the component:

```typescript
const IMAGE_REF_REGEX = /!\[[^\]]*\]\(\.?\/?assets\/([^)]+)\)/g

async function cleanupOrphanImages(mdFilePath: string, content: string): Promise<void> {
  const refs = new Set<string>()
  let match
  while ((match = IMAGE_REF_REGEX.exec(content)) !== null) {
    if (match[1]) refs.add(match[1])
  }
  if (refs.size === 0) return

  try {
    const dir = mdFilePath.replace(/\.md$/, '')
    const assetsPath = `${dir}/assets`
    const files = await fs.readDir(assetsPath)
    for (const file of files) {
      if (!refs.has(file)) {
        await imageApi.deleteImage(mdFilePath, file)
      }
    }
  } catch { /* no assets dir */ }
}
```

- [ ] **Step 3: Add imageRefsChanged tracking**

In the component, add a ref to track image references:

```typescript
  const prevImageRefsRef = useRef<Set<string>>(new Set())
```

- [ ] **Step 4: Update doSave to run orphan cleanup**

In the `doSave` callback, add orphan cleanup after saving:

```typescript
  const doSave = useCallback(async (isAuto: boolean) => {
    if (!note) return
    await saveNoteContent(note.id, contentRef.current)

    const h1 = extractH1Title(contentRef.current)
    if (h1 && h1 !== note.title) {
      await updateNoteTitle(note.id, h1)
    }

    // Orphan image cleanup — only when image refs changed
    const currentRefs = new Set<string>()
    let match
    while ((match = IMAGE_REF_REGEX.exec(contentRef.current)) !== null) {
      if (match[1]) currentRefs.add(match[1])
    }
    if (currentRefs.size > 0 || prevImageRefsRef.current.size > 0) {
      if (currentRefs.size !== prevImageRefsRef.current.size ||
          [...currentRefs].some(r => !prevImageRefsRef.current.has(r))) {
        await cleanupOrphanImages(note.filePath, contentRef.current)
      }
    }
    prevImageRefsRef.current = currentRefs

    setDirty(false)
    showToast(isAuto ? '自动保存成功' : '保存成功')
  }, [note, saveNoteContent, updateNoteTitle, showToast])
```

- [ ] **Step 5: Implement handleInsertImageFromPicker**

Add after `handleApplyOperation`:

```typescript
  const handleInsertImageFromPicker = useCallback(async () => {
    if (!note || !textareaEl) return
    try {
      const result = await imageApi.pickAndSave(note.filePath)
      if (!result) return
      const op = createInsertImageWithPath(result.relativePath, result.fileName)
      const res = op(content, textareaEl.selectionStart, textareaEl.selectionEnd)
      applyOperationToTextarea(textareaEl, content, res.text, res.start, res.end)
    } catch {
      showToast('保存图片失败')
    }
  }, [note, content, textareaEl, showToast])
```

- [ ] **Step 6: Pass mdFilePath to all editor components**

Update `SplitPaneLiveEditor`:

```tsx
          <SplitPaneLiveEditor
            key={activeNoteId}
            value={content}
            onChange={handleChange}
            onCursorLineChange={setCurrentLineIndex}
            onContextMenu={handleEditorContextMenu}
            onPreviewContextMenu={handleLivePreviewContextMenu}
            mdFilePath={note.filePath}
            onInsertImageFromPicker={handleInsertImageFromPicker}
            showToast={showToast}
          />
```

Update `MarkdownEditor`:

```tsx
          <MarkdownEditor
            value={content}
            onChange={handleChange}
            onCursorLineChange={setCurrentLineIndex}
            placeholder="# 标题\n\n内容..."
            onContextMenu={handleEditorContextMenu}
            mdFilePath={note.filePath}
            onInsertImageFromPicker={handleInsertImageFromPicker}
            showToast={showToast}
          />
```

Update `MarkdownPreview`:

```tsx
            <MarkdownPreview content={content} mdFilePath={note.filePath} />
```

- [ ] **Step 7: Pass onInsertImage to context menu**

Add `onInsertImage` to the MarkdownContextMenu props:

```tsx
          onInsertImage={handleInsertImageFromPicker}
```

- [ ] **Step 8: Commit**

```bash
git add src/renderer/src/components/notes/NoteEditor.tsx
git commit -m "feat: integrate image insertion and orphan cleanup into NoteEditor"
```

---

### Task 9: Integrate with PlanEditor + orphan cleanup

**Files:**
- Modify: `src/renderer/src/components/planner/PlanEditor.tsx`

- [ ] **Step 1: Add imports**

```typescript
import { imageApi } from '@/lib/ipc'
import { createInsertImageWithPath } from '@/lib/markdown-operations'
```

- [ ] **Step 2: Add refs and cleanup helper**

Add the same IMAGE_REF_REGEX and cleanupOrphanImages from Task 8 Step 2 (or import from a shared utility). For simplicity, define them locally:

```typescript
const IMAGE_REF_REGEX = /!\[[^\]]*\]\(\.?\/?assets\/([^)]+)\)/g

async function cleanupOrphanImages(mdFilePath: string, content: string): Promise<void> {
  const refs = new Set<string>()
  let match
  while ((match = IMAGE_REF_REGEX.exec(content)) !== null) {
    if (match[1]) refs.add(match[1])
  }
  if (refs.size === 0) return
  try {
    const dir = mdFilePath.replace(/\.md$/, '')
    const assetsPath = `${dir}/assets`
    const files = await fs.readDir(assetsPath)
    for (const file of files) {
      if (!refs.has(file)) {
        await imageApi.deleteImage(mdFilePath, file)
      }
    }
  } catch { /* no assets dir */ }
}
```

- [ ] **Step 3: Add prevImageRefsRef**

```typescript
  const prevImageRefsRef = useRef<Set<string>>(new Set())
```

- [ ] **Step 4: Update doSave with orphan cleanup**

Same pattern as Task 8 Step 4 — add the orphan cleanup block after savePlanContent.

- [ ] **Step 5: Implement handleInsertImageFromPicker**

```typescript
  const handleInsertImageFromPicker = useCallback(async () => {
    if (!plan || !textareaEl) return
    try {
      const result = await imageApi.pickAndSave(plan.filePath)
      if (!result) return
      const op = createInsertImageWithPath(result.relativePath, result.fileName)
      const res = op(content, textareaEl.selectionStart, textareaEl.selectionEnd)
      applyOperationToTextarea(textareaEl, content, res.text, res.start, res.end)
    } catch {
      showToast('保存图片失败')
    }
  }, [plan, content, textareaEl, showToast])
```

- [ ] **Step 6: Pass mdFilePath to editor components**

Update `MarkdownEditor`:

```tsx
          <MarkdownEditor
            value={content}
            onChange={handleChange}
            placeholder="# 计划内容\n\n- [ ] 待办项 1\n- [ ] 待办项 2"
            onContextMenu={handleEditorContextMenu}
            mdFilePath={plan.filePath}
            onInsertImageFromPicker={handleInsertImageFromPicker}
            showToast={showToast}
          />
```

Update `MarkdownPreview`:

```tsx
            <MarkdownPreview content={content} mdFilePath={plan.filePath} />
```

- [ ] **Step 7: Pass onInsertImage to context menu**

Add `onInsertImage` to the MarkdownContextMenu props.

- [ ] **Step 8: Commit**

```bash
git add src/renderer/src/components/planner/PlanEditor.tsx
git commit -m "feat: integrate image insertion and orphan cleanup into PlanEditor"
```

---

### Task 10: Add image cleanup to stores

**Files:**
- Modify: `src/renderer/src/stores/noteStore.ts`
- Modify: `src/renderer/src/stores/planStore.ts`

- [ ] **Step 1: Update noteStore import**

```typescript
import { fs, store, imageApi } from '@/lib/ipc'
```

- [ ] **Step 2: Update deleteNote**

```typescript
    deleteNote: async (id) => {
      const note = get().notes.find((n) => n.id === id)
      if (note) {
        try { await imageApi.cleanup(note.filePath) } catch {}
        try { await fs.deleteFile(note.filePath) } catch {}
      }
      set((s) => { s.notes = s.notes.filter((n) => n.id !== id) })
      await fs.writeFile('notes/index.json', JSON.stringify(get().notes, null, 2))
    },
```

- [ ] **Step 3: Update deleteNotes (batch)**

```typescript
    deleteNotes: async (ids) => {
      const idSet = new Set(ids)
      const notes = get().notes
      for (const note of notes) {
        if (idSet.has(note.id)) {
          try { await imageApi.cleanup(note.filePath) } catch {}
          try { await fs.deleteFile(note.filePath) } catch { /* already deleted */ }
        }
      }
      set((s) => { s.notes = s.notes.filter((n) => !idSet.has(n.id)) })
      await fs.writeFile('notes/index.json', JSON.stringify(get().notes, null, 2))
    },
```

- [ ] **Step 4: Update planStore import**

```typescript
import { fs, store, imageApi } from '@/lib/ipc'
```

- [ ] **Step 5: Update deletePlan**

```typescript
    deletePlan: async (id) => {
      const plan = get().plans.find((p) => p.id === id)
      if (plan) {
        try { await imageApi.cleanup(plan.filePath) } catch {}
        try { await fs.deleteFile(plan.filePath) } catch { /* already deleted */ }
      }
      set((s) => { s.plans = s.plans.filter((p) => p.id !== id) })
      await fs.writeFile('plans/index.json', JSON.stringify(get().plans, null, 2))
    },
```

- [ ] **Step 6: Update deletePlans (batch)**

```typescript
    deletePlans: async (ids) => {
      const idSet = new Set(ids)
      const plans = get().plans
      for (const plan of plans) {
        if (idSet.has(plan.id)) {
          try { await imageApi.cleanup(plan.filePath) } catch {}
          try { await fs.deleteFile(plan.filePath) } catch { /* already deleted */ }
        }
      }
      set((s) => { s.plans = s.plans.filter((p) => !idSet.has(p.id)) })
      await fs.writeFile('plans/index.json', JSON.stringify(get().plans, null, 2))
    },
```

- [ ] **Step 7: Update updatePlan to move assets**

In the file move block, add after `try { await fs.deleteFile(plan.filePath) } catch { /* ignore */ }`:

```typescript
        try { await imageApi.moveAssets(plan.filePath, newFilePath) } catch {}
```

- [ ] **Step 8: Commit**

```bash
git add src/renderer/src/stores/noteStore.ts src/renderer/src/stores/planStore.ts
git commit -m "feat: add image cleanup on delete and assets move on plan update"
```

---

### Task 11: Build verification and manual testing

**Files:** None (verification only)

- [ ] **Step 1: Run full build**

```bash
cd d:/hpl/projects/fun-pets && npx electron-vite build
```
Expected: Build succeeds

- [ ] **Step 2: Start dev app**

```bash
cd d:/hpl/projects/fun-pets && npx electron-vite dev
```

- [ ] **Step 3: Test paste image in note**

1. Open a note in edit mode
2. Take a screenshot (Win+Shift+S)
3. Ctrl+V in the editor
4. Verify: `![image](./xxx/assets/xxx.png)` appears
5. Switch to preview — verify image renders

- [ ] **Step 4: Test drag-drop image**

1. Drag an image from Explorer onto the textarea
2. Verify: markdown image syntax appears

- [ ] **Step 5: Test file picker**

1. Right-click → Insert Elements → Image
2. Verify: file dialog opens, selecting an image inserts markdown

- [ ] **Step 6: Test Ctrl+Shift+I shortcut**

1. Press Ctrl+Shift+I in editor
2. Verify: file dialog opens

- [ ] **Step 7: Test delete note with images**

1. Create a note with an image
2. Delete the note
3. Verify: assets directory removed

- [ ] **Step 8: Test plan editor**

1. Open a plan, paste an image
2. Verify: same behavior as notes

- [ ] **Step 9: Fix any issues and final commit**

```bash
git add -A
git commit -m "fix: address integration issues from manual testing"
```
