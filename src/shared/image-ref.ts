/**
 * Markdown 图片引用匹配(如 ![alt](./assets/imgs/x.png)),捕获组为完整引用路径。
 * 主进程孤儿图片清理(image-cleanup)与渲染端 PDF 导出(export-pdf)共用,
 * 保证两端对「什么算图片引用」的判定一致。
 */
export const IMAGE_REF_REGEX = /!\[[^\]]*\]\(([^)]*\/assets\/[^)]+)\)/g
