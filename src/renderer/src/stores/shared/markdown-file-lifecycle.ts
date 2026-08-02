interface FileIo {
  readFile: (path: string) => Promise<string>
  writeFile: (path: string, content: string) => Promise<void>
  deleteFile: (path: string) => Promise<void>
}

interface AssetIo {
  cleanup: (markdownPath: string) => Promise<unknown>
  moveAssets: (oldMarkdownPath: string, newMarkdownPath: string) => Promise<unknown>
}

export async function appendIndexRecord<T>(
  io: FileIo,
  indexPath: string,
  record: T,
): Promise<void> {
  let records: T[] = []
  try {
    const parsed: unknown = JSON.parse(await io.readFile(indexPath))
    if (Array.isArray(parsed)) records = parsed as T[]
  } catch {
    // Missing or malformed indexes start fresh, matching existing note creation behavior.
  }
  records.push(record)
  await io.writeFile(indexPath, JSON.stringify(records, null, 2))
}

export async function deleteMarkdownDocument(
  io: FileIo,
  assets: AssetIo,
  filePath: string,
): Promise<void> {
  try {
    await assets.cleanup(filePath)
  } catch {
    // Missing asset directories do not prevent document deletion.
  }
  try {
    await io.deleteFile(filePath)
  } catch {
    // The Markdown file may already have been removed.
  }
}

export async function moveMarkdownDocument(
  io: FileIo,
  assets: AssetIo,
  oldFilePath: string,
  newFilePath: string,
): Promise<void> {
  if (oldFilePath === newFilePath) return

  const content = await io.readFile(oldFilePath)
  await io.writeFile(newFilePath, content)
  try {
    await io.deleteFile(oldFilePath)
  } catch {
    // The old Markdown file may already have been removed.
  }
  try {
    await assets.moveAssets(oldFilePath, newFilePath)
  } catch {
    // Missing asset directories do not invalidate a successful document move.
  }
}
