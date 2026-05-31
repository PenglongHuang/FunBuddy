# PDF Export for Plans and Notes

## Overview

Add PDF export capability to plans and notes with two trigger points: list item context menu and detail page "more" button. Exported PDFs embed images inline and render markdown with code highlighting, matching Obsidian-quality output.

## Requirements

- Two trigger points: list item context menu and detail page "more" button
- Simple export dialog: radio select between "Title + Body" and "Full Metadata + Body"
- Images always embedded as data URLs (not optional)
- High-quality PDF output using Chrome's rendering engine (Electron `printToPDF`)
- Code syntax highlighting preserved in PDF
- Loading state during export with error feedback via Toast

## Architecture

### Data Flow

The main process owns the entire export pipeline (generate PDF + save dialog + write file) to avoid transferring binary PDF data across IPC.

```
User clicks "Export PDF"
       |
Renderer: show ExportDialog, user picks mode
       |
Renderer: build standalone HTML string
  - marked.parse() with the same config as MarkdownPreview (gfm, breaks, custom renderer)
  - local images converted to data URLs via imageApi.readAsDataUrl()
  - highlight.js for code blocks (inline styles via hljs.highlight())
  - inject title/metadata header based on mode
  - inline all CSS (no CSS custom properties — use resolved values)
       |
Renderer: IPC invoke 'export:pdf' with { html, fileName, defaultPath }
       |
Main: create hidden BrowserWindow, load HTML as data URL
Main: webContents.printToPDF() -> PDF bytes
Main: dialog.showSaveDialog() -> user picks save location
Main: fs.writeFile(savePath, pdfBytes) (binary write)
Main: return { success: true, filePath } or { success: false, error: string }
       |
Renderer: close ExportDialog, show Toast (success or error)
```

### New IPC Channel

| Channel | Direction | Payload | Returns |
|---------|-----------|---------|---------|
| `export:pdf` | renderer -> main | `{ html: string, fileName: string, defaultPath?: string }` | `{ success: boolean, filePath?: string, error?: string }` |

All file I/O and dialog interaction happens in the main process. Binary PDF bytes never cross the IPC boundary.

### Markdown-to-HTML Extraction

`MarkdownPreview.tsx` is a React component with hooks and side effects — it can't be directly reused for export. Extract the pure markdown-to-HTML conversion into a shared utility:

- **New function** in `src/renderer/src/lib/export-pdf.ts`: `buildExportHtml(options)` that calls `marked.parse()` directly with the same renderer config (GFM, breaks, code highlighting via hljs, image data URL resolution).
- The custom `image` renderer in MarkdownPreview resolves local assets to data URLs — replicate this logic in the export utility.
- Wiki-link rendering is excluded from export (wiki-links are app-internal, meaningless in a PDF).

## UI Changes

### 1. List Item Context Menus (modify existing)

Add "Export to PDF" menu item to both PlanList and NotesPanel context menus:

**PlanList context menu:**
- Start Focus
- View Details
- Export to PDF (new)
- Edit Type and Date
- Delete Plan

**NotesPanel context menu:**
- View Details
- Export to PDF (new)
- Delete Note

Clicking triggers ExportDialog.

### 2. Detail Page "More" Button (modify existing)

Add a "..." more button to the existing toolbar area of PlanEditor and NoteEditor. **No toolbar restructuring** — just append the more button to the right end of each editor's existing toolbar.

**PlanEditor toolbar (no layout change, append button):**
```
[Edit] [Preview]                          [...]
```

**NoteEditor toolbar (no layout change, append button):**
```
[Edit] [Live] [Preview] [TOC]            [...]
```

The "..." button opens a ContextMenu with "Export to PDF". Each editor keeps its existing toolbar layout; only the more button is appended.

### 3. ExportDialog Component (new)

Simple radio-select dialog:

- Title: "Export to PDF"
- Two radio options:
  - "Title + Body" — includes title heading and rendered body
  - "Full Metadata + Body" — title, metadata fields, then body
- Footer: "Cancel" + "Export" buttons
- Export button shows loading spinner and is disabled during generation
- Dialog closes after the main process returns (success or failure)
- On success: close dialog, show success Toast with file path
- On failure: close dialog, show error Toast

### 4. New Files

| File | Purpose |
|------|---------|
| `src/renderer/src/components/common/ExportDialog.tsx` | Export options dialog |
| `src/renderer/src/lib/export-pdf.ts` | HTML construction (marked + hljs + image data URLs) + IPC call |

### 5. Modified Files

| File | Change |
|------|--------|
| `src/renderer/src/components/planner/PlanEditor.tsx` | Append MoreButton to existing toolbar, add ContextMenu with "Export to PDF" |
| `src/renderer/src/components/notes/NoteEditor.tsx` | Append MoreButton to existing toolbar, add ContextMenu with "Export to PDF" |
| `src/renderer/src/components/planner/PlanList.tsx` | Add "Export to PDF" context menu item |
| `src/renderer/src/components/notes/NotesPanel.tsx` | Add "Export to PDF" context menu item |
| `src/renderer/src/lib/ipc.ts` | Add `export.pdf()` method |
| `src/main/ipc-handlers.ts` | Add `export:pdf` handler (generate + save dialog + write) |
| `src/preload/index.ts` | Expose `exportPdf` IPC channel |
| `src/shared/ipc-channels.ts` | Add `EXPORT_PDF: 'export:pdf'` constant |

## PDF Generation

### Main Process Handler

1. Receive `{ html, fileName, defaultPath }` from renderer via IPC
2. Create hidden BrowserWindow (`show: false`, width: 800, height: 1200)
3. Load HTML as data URL (`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
4. Wait for `did-finish-load` event + 500ms delay (ensure embedded data URL images render)
5. Call `webContents.printToPDF({ pageSize: 'A4', printBackground: true, margins: { top: 20, bottom: 20, left: 25, right: 25 } })`
6. Show save dialog via `dialog.showSaveDialog({ defaultPath: fileName, filters: [{ name: 'PDF', extensions: ['pdf'] }] })`
7. If user cancels: destroy window, return `{ success: true }` (no error)
8. Write PDF bytes: `fs.writeFile(savePath, Buffer.from(pdfBytes))` (binary write, no encoding)
9. Destroy hidden BrowserWindow
10. Return `{ success: true, filePath: savePath }` or `{ success: false, error: message }`

### HTML Template

The exported HTML is a fully self-contained document with **inline CSS values** (no CSS custom properties, since the hidden BrowserWindow has no theme context):

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', sans-serif;
      padding: 0;
      margin: 0;
      color: #1a1a1a;
      line-height: 1.6;
      font-size: 14px;
    }
    h1.title {
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid #e5e7eb;
    }
    .meta {
      font-size: 12px;
      color: #6b7280;
      margin-bottom: 12px;
      line-height: 1.8;
    }
    .meta div { margin-bottom: 2px; }
    hr { border: none; border-top: 1px solid #e5e7eb; margin: 16px 0; }
    .markdown-body h1 { font-size: 22px; }
    .markdown-body h2 { font-size: 18px; }
    .markdown-body h3 { font-size: 16px; }
    .markdown-body pre { background: #f6f8fa; padding: 12px; border-radius: 6px; overflow-x: auto; }
    .markdown-body code { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; }
    .markdown-body img { max-width: 100%; height: auto; }
    .markdown-body blockquote { border-left: 3px solid #d1d5db; padding-left: 12px; color: #6b7280; }
    .markdown-body table { border-collapse: collapse; width: 100%; }
    .markdown-body th, .markdown-body td { border: 1px solid #d1d5db; padding: 6px 12px; }
    /* highlight.js inline styles for code blocks */
  </style>
</head>
<body>
  <!-- Mode: Title + Body -->
  <h1 class="title">Plan/Note Title</h1>
  <div class="markdown-body">...rendered content...</div>

  <!-- Mode: Full Metadata + Body (plan) -->
  <h1 class="title">Plan Title</h1>
  <div class="meta">
    <div>Created: 2025-05-11</div>
    <div>Tags: work, important</div>
    <div>Type: Daily Plan</div>
    <div>Start: 2025-05-11</div>
    <div>End: 2025-05-12</div>
  </div>
  <hr>
  <div class="markdown-body">...rendered content...</div>

  <!-- Mode: Full Metadata + Body (note) -->
  <h1 class="title">Note Title</h1>
  <div class="meta">
    <div>Created: 2025-05-11</div>
    <div>Tags: work, important</div>
  </div>
  <hr>
  <div class="markdown-body">...rendered content...</div>
</body>
</html>
```

Metadata fields differ by type:
- **Plans**: title, createdAt, tags, planType, startDate, endDate
- **Notes**: title, createdAt, tags

### Image Handling

- Local images (`./xxx/assets/img.png`): read via `imageApi.readAsDataUrl()` and embedded as `data:image/...;base64,...` during HTML construction in the renderer
- External URL images: kept as-is (printToPDF will attempt to load; failure shows broken image icon)
- All images: `max-width: 100%; height: auto;` to fit within page margins
- Image read failure: skip that image, continue export

### Error Handling

- Image read failure: log warning, skip image, continue export
- PDF generation failure: return error to renderer, show error Toast
- User cancels save dialog: silent return, no Toast
- Duplicate click prevention: Export button disabled during generation

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| PDF engine | Electron `printToPDF` | Zero dependencies, vector text, Chrome rendering quality (same as Obsidian) |
| Image embedding | Data URLs in HTML | Self-contained PDF, no external references, guaranteed to render offline |
| HTML construction | Renderer process | Reuses existing marked + hljs + image resolution logic |
| Export pipeline owner | Main process | Avoids binary data over IPC, single round trip |
| Export dialog style | Simple radio select | Only 2 options, no need for full settings panel; images always included |
| Detail page button | Append MoreButton to existing toolbar | Minimal change, no toolbar restructuring |
| CSS in template | Fully inlined values | Hidden BrowserWindow has no theme context, CSS custom properties won't resolve |
| Wiki-links | Excluded from export | App-internal navigation, meaningless in a standalone PDF |
