# Markdown 图片插入功能设计

## 概述

为计划模块（PlanEditor）和笔记模块（NoteEditor）的 Markdown 编辑器添加图片插入支持。用户可通过剪贴板粘贴、拖拽文件、文件选择器三种方式插入图片，图片就近存储在每篇笔记/计划独立的 `assets/` 目录中。

## 需求决策

| 决策点 | 选择 |
|--------|------|
| 图片来源 | 文件选择器 + 剪贴板粘贴 + 拖拽文件 + 截图（通过粘贴） |
| 存储方式 | 就近存储——每篇笔记/计划独立 assets 目录 |
| 图片优化 | 存原图，预览时按需生成缩略图 |
| 编辑器呈现 | 编辑模式纯文本 Markdown 语法，预览模式渲染图片 |
| 清理策略 | 删除笔记时清 assets 目录；编辑中移除图片语法时删除孤立文件 |
| 架构方案 | IPC 主进程处理——新增图片专用 IPC 通道 |

## 架构

### 数据流

以粘贴图片为例：

```
用户 Ctrl+V → MarkdownEditor onPaste → 提取 Blob → ArrayBuffer
→ IPC image:save → 主进程写入 assets/ → 返回 ./assets/xxx.png
→ 插入 ![图片.png](./assets/xxx.png)
```

**设计原则：所有图片数据通过 ArrayBuffer 在渲染进程中读取后传给主进程。** 不使用 `File.path`（Electron 非标准扩展，sandbox 模式下不可用），避免路径遍历风险。

### 存储结构

`assets/` 目录是 .md 文件的兄弟目录，使用与 .md 文件相同的基础名称：

```
funbuddy-workspace/
  notes/
    index.json
    abc123-my-note.md
    abc123-my-note/              ← 目录，与 .md 文件同名（去扩展名）
      assets/                    ← 图片存放目录
        v1a2b3c4.png
        x5y6z7w8.jpg
    def456-another.md
    def456-another/
      assets/
  plans/
    index.json
    2026-05/
      09/
        F9Zo2NRv-2026-05-09.md
        F9Zo2NRv-2026-05-09/
          assets/
```

图片文件以 `{nanoid(8)}.{ext}` 命名，避免文件名冲突和特殊字符问题。

每个 .md 文件的 assets 路径通过 `join(dirName, baseNameWithoutExt, 'assets')` 计算，确保完全隔离。

### IPC 通道

| 通道 | 入参 | 返回 | 说明 |
|------|------|------|------|
| `image:save` | `{ mdFilePath, imageData: ArrayBuffer, ext: string, altName?: string }` | `{ relativePath, fileName }` | 从 ArrayBuffer 保存图片到 assets/ |
| `image:pickAndSave` | `{ mdFilePath }` | `{ relativePath, fileName } \| null` | 打开文件选择器 + 保存，一步到位 |
| `image:delete` | `{ mdFilePath, imageFileName }` | `void` | 删除单个图片文件 |
| `image:cleanup` | `{ mdFilePath }` | `void` | 删除整个 {baseName}/assets 目录 |
| `image:readAsDataUrl` | `{ mdFilePath, imageFileName, maxWidth? }` | `{ dataUrl, mimeType }` | 读取图片为 Data URL，支持按需缩放 |

注：移除了 `image:saveFromFile`。拖拽场景也通过渲染进程读取为 ArrayBuffer 后使用 `image:save`，避免传递文件路径的路径遍历风险。

### 安全：路径验证

所有接受 `mdFilePath` 的 IPC handler 在主进程中必须进行路径验证：

```typescript
const fullPath = resolve(storageDir, filePath)
if (!fullPath.startsWith(resolve(storageDir))) {
  throw new Error('Invalid path')
}
```

### 安全：图片内容验证

主进程 `image:save` handler 必须验证：
1. `ext` 参数在白名单内：`['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp']`
2. 通过 sharp 读取 ArrayBuffer 的 metadata 验证确实是图片格式
3. `altName` 仅用于 Markdown alt 文本，不用于文件名；实际文件名由主进程用 nanoid 生成

**不支持 SVG**：SVG 可包含 JavaScript，通过 `<img>` 标签渲染 Data URL 时虽然安全，但如果未来通过 `dangerouslySetInnerHTML` 渲染则存在 XSS 风险。为安全起见，不在支持列表中。

## 编辑器集成

### MarkdownEditor.tsx 改动

**新增 Props：**
- `mdFilePath?: string` — 当前编辑文件的路径，用于定位 assets 目录
- `onInsertImageFromPicker?: () => void` — 异步图片插入回调（供上下文菜单使用）

**新增事件处理：**
- `onPaste` — 检测 `clipboardData.types` 是否包含 `Files`，提取图片文件
- `onDrop` + `onDragOver`（必须调用 `e.preventDefault()` 阻止浏览器默认打开文件行为） — 过滤 `dataTransfer.files` 中的图片类型

**不变的部分：**
- textarea 本身保持纯文本
- 现有快捷键系统不变
- `applyOperationToTextarea` 不变
- `insertImage` 保持为纯文本操作（见下文）

### insertImage 操作分层

`insertImage` 在 `markdown-operations.ts` 中保持为纯文本同步操作，新增参数支持真实路径：

```typescript
// 纯文本操作，不涉及 IPC
export const insertImageWithPath = (relativePath: string, altText: string): MarkdownOperation =>
  (text, start, _end) => ({
    text: text.substring(0, start) + `![${altText}](${relativePath})` + text.substring(start),
    start: start + 2,
    end: start + 2 + altText.length,
  })
```

IPC 调用（文件选择器）在组件层面完成，拿到路径后再调用纯文本操作。这保持了现有 `MarkdownOperation` 类型系统不变。

### 插入入口详细设计

**剪贴板粘贴 (Ctrl+V)：**
1. 监听 textarea 的 `onPaste` 事件
2. 检查 `clipboardData.types` 包含 `'Files'`
3. 取第一个文件，检查 `file.type.startsWith('image/')`
4. 检查文件大小 ≤ 10MB
5. 读取为 ArrayBuffer
6. 从 `file.type` 提取扩展名，从 `file.name` 提取 alt 文本
7. 调用 `image:save` IPC
8. 在光标位置插入 `![{altName}](./assets/{nanoid}.png)`

**拖拽文件：**
1. 监听 textarea 的 `onDrop` 事件
2. 从 `dataTransfer.files` 过滤图片类型（`type.startsWith('image/')`）
3. 支持多张图片批量插入
4. 在渲染进程中读取为 ArrayBuffer，使用 `image:save`（不使用 File.path）
5. 对每张图片依次调用 IPC → 插入 Markdown 语法

**文件选择器：**
1. 通过上下文菜单或快捷键 `Ctrl+Shift+I` 触发
2. 调用 `image:pickAndSave` IPC（主进程内部调用 `dialog.showOpenDialog`）
3. filters: PNG, JPG, JPEG, GIF, WebP, BMP
4. 返回路径后使用 `insertImageWithPath` 插入 Markdown 语法

### 上下文菜单更新

在 MarkdownContextMenu 的 "插入元素" 组中，现有 "图片" 菜单项从同步插入模板改为异步流程：
- 不再使用 `applyOp(insertImage)` 同步调用
- 改为调用新增的 `onInsertImageFromPicker` prop
- 该 prop 在 NoteEditor / PlanEditor 中实现：调用 IPC → 拿到路径 → 调用 `applyOp(insertImageWithPath(path, name))`

### 预览模式图片渲染

`marked` 已原生支持 `![alt](src)` 渲染为 `<img>`。需要：
1. 在 MarkdownPreview 的自定义 marked renderer 中拦截 `image` 方法
2. 将相对路径 `./assets/xxx.png` 通过 `image:readAsDataUrl` IPC 转换为 Data URL
3. 使用 Data URL 而非 `file://` 协议，避免 Electron 安全策略问题

**Data URL 缓存**：在主进程中维护 `Map<string, { dataUrl, mimeType }>` 缓存，key 为 `{mdFilePath}:{imageFileName}:{maxWidth}`。由于图片文件以 nanoid 命名不会变更，缓存仅在 `image:delete` 时清理。避免预览中多张图片重复 IPC 调用导致内存压力。

现有 CSS `.markdown-body img { max-width: 100%; border-radius }` 无需改动。

## NoteEditor / PlanEditor 集成

两个编辑器组件需要：
1. 将当前笔记/计划的 `filePath` 作为 `mdFilePath` 传递给 MarkdownEditor
2. 在 SplitPaneLiveEditor 中同样传递（用于 NoteEditor 的 live 模式）
3. 实现 `onInsertImageFromPicker` 回调并传递给 MarkdownEditor 和 MarkdownContextMenu

### 计划文件移动

planStore 的 `updatePlan` 在日期/类型变更时会移动 .md 文件。需要同步移动整个 `{baseName}/` 目录（包含 assets）。在 `updatePlan` 的文件移动逻辑中，增加对关联目录的移动。

## 图片生命周期管理

### 清理场景

**场景 A：删除笔记/计划**
- 在 noteStore / planStore 的单个删除和批量删除（`deleteNotes` / `deletePlans`）中，对每个被删除项调用 `image:cleanup`
- 时机：用户确认删除后，与 .md 文件一同清理

**场景 B：编辑中移除图片语法**
- 保存内容时（auto-save 或 Ctrl+S），仅在图片引用集合发生变化时执行清理
- 使用脏标记 `imageRefsChanged` 跟踪图片引用是否变化，避免每次保存都运行清理逻辑
- 清理检测逻辑：
  1. 用正则 `/!\[[^\]]*\]\(\.?\/?assets\/([^)]+)\)/g` 提取 .md 中所有图片引用（兼容 `./assets/` 和 `assets/` 两种写法）
  2. 通过 IPC 列出 assets/ 目录中的所有文件
  3. 差集 = 目录中有但 .md 中未引用的
  4. 调用 `image:delete` 删除孤立文件

### 手动复制 .md 文件的场景

图片引用使用相对路径（`./assets/`），如果用户手动复制 .md 文件但不复制关联的 assets 目录，预览中会显示 "图片未找到" 占位符。这是可接受的降级行为。

### 缩略图策略

不预存缩略图文件，预览渲染时按需生成：
- `image:readAsDataUrl` 接受 `maxWidth` 参数（默认 800px）
- 使用 `sharp`（Node.js 原生图片处理库）在主进程内存中缩放
- 图片本身小于 maxWidth 时直接返回原图 Data URL
- 结果缓存于主进程 Map 中，避免重复处理

### sharp 依赖说明

- `sharp` 使用 libvips 原生二进制，需要与 Electron 的 Node ABI 版本匹配
- 安装时确保使用与 Electron 匹配的版本：`npm install sharp`
- `electron-builder` 配置需确保 sharp 的原生模块被包含在打包中（可能需要配置 `extraResources` 或在 `files` 中显式包含 `node_modules/sharp/**/*`）
- 如果 sharp 在目标平台安装失败，备选方案为 `jimp`（纯 JavaScript，无原生依赖，但性能较差）

## 错误处理

| 场景 | 处理方式 |
|------|----------|
| 图片超过 10MB | Toast 提示 "图片过大，请选择 10MB 以内的图片" |
| 不支持的格式 | 仅接受白名单内的 MIME 类型，非图片类型的粘贴/拖拽静默忽略 |
| assets 目录创建失败 | IPC 返回错误，Toast 提示 "保存图片失败" |
| 图片文件丢失（手动删除） | 预览中显示占位符 + "图片未找到" 文字提示 |
| 磁盘空间不足 | IPC 返回错误，Toast 提示 "磁盘空间不足，无法保存图片" |

## 涉及文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `src/shared/ipc-channels.ts` | 修改 | 新增 5 个图片 IPC 通道常量 |
| `src/main/ipc-handlers.ts` | 修改 | 新增 5 个 IPC handler + 路径验证 + Data URL 缓存 |
| `src/preload/index.ts` | 修改 | 桥接新 IPC 通道 |
| `src/renderer/src/lib/ipc.ts` | 修改 | 新增图片 IPC 调用封装 |
| `src/renderer/src/components/common/MarkdownEditor.tsx` | 修改 | 新增 onPaste/onDrop/onDragOver，mdFilePath prop，onInsertImageFromPicker prop |
| `src/renderer/src/components/common/MarkdownPreview.tsx` | 修改 | 图片路径 Data URL 转换 + 缓存 |
| `src/renderer/src/components/common/SplitPaneLiveEditor.tsx` | 修改 | 透传 mdFilePath |
| `src/renderer/src/components/ui/MarkdownContextMenu.tsx` | 修改 | 图片菜单项改为异步回调 |
| `src/renderer/src/lib/markdown-operations.ts` | 修改 | 新增 insertImageWithPath 纯文本操作 |
| `src/renderer/src/components/notes/NoteEditor.tsx` | 修改 | 传递 mdFilePath，实现 onInsertImageFromPicker |
| `src/renderer/src/components/planner/PlanEditor.tsx` | 修改 | 传递 mdFilePath，实现 onInsertImageFromPicker |
| `src/renderer/src/stores/noteStore.ts` | 修改 | 单个和批量删除时调用 image:cleanup |
| `src/renderer/src/stores/planStore.ts` | 修改 | 单个和批量删除时调用 image:cleanup；updatePlan 移动关联目录 |
| `package.json` | 修改 | 新增 sharp 依赖 |
| `electron-builder.yml` 或 `package.json` build 配置 | 修改 | 确保 sharp 原生模块包含在打包中 |
