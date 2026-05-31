import { readdir, readFile, writeFile, mkdir, cp, rm } from 'fs/promises'
import { existsSync } from 'fs'
import { join, parse } from 'path'

// Usage: node scripts/migrate-images.mjs <storageDir>
// e.g.: node scripts/migrate-images.mjs "D:\Users\User\Desktop"
const storageDir = process.argv[2]
if (!storageDir) {
  console.error('Usage: node scripts/migrate-images.mjs <storageDir>')
  process.exit(1)
}

const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'])

// Match: ./{baseName}/assets/{fileName}  or  ./{baseName}/assets/{fileName})  (capture excludes trailing paren)
const IMAGE_REF = /(!\[[^\]]*\]\()\.(\/[^/\s)]+?)\/assets\/([^/\s)]+)(\))/g

async function migrateCategory(categoryDir) {
  if (!existsSync(categoryDir)) {
    console.log(`  Skipping (directory not found): ${categoryDir}`)
    return
  }

  const newImgsDir = join(categoryDir, 'assets', 'imgs')
  await mkdir(newImgsDir, { recursive: true })
  console.log(`  Created: ${newImgsDir}`)

  const entries = await readdir(categoryDir, { withFileTypes: true })
  let movedCount = 0
  let updatedCount = 0

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const subDir = join(categoryDir, entry.name)

    // Check for assets directory inside
    const assetsDir = join(subDir, 'assets')
    if (!existsSync(assetsDir)) continue

    // Move all image files to centralized dir
    const assetFiles = await readdir(assetsDir)
    for (const file of assetFiles) {
      const ext = file.split('.').pop()?.toLowerCase()
      if (!IMAGE_EXT.has(ext)) continue
      const src = join(assetsDir, file)
      const dst = join(newImgsDir, file)
      if (!existsSync(dst)) {
        await cp(src, dst)
        movedCount++
      } else {
        console.log(`  Skip (already exists): ${file}`)
      }
    }

    // Remove the now-empty assets dir (and parent if empty)
    try { await rm(assetsDir) } catch { /* not empty or other error */ }
    try { await rm(subDir) } catch { /* not empty or other error */ }
  }

  // Scan recursively for .md files and update references
  async function scanForMd(base) {
    const entries = await readdir(base, { withFileTypes: true })
    for (const entry of entries) {
      const full = join(base, entry.name)
      if (entry.isDirectory()) {
        await scanForMd(full)
      } else if (entry.name.endsWith('.md')) {
        let content = await readFile(full, 'utf-8')
        let changed = false
        const newContent = content.replace(IMAGE_REF, (_match, prefix, _basePath, fileName, suffix) => {
          changed = true
          return `${prefix}./assets/imgs/${fileName}${suffix}`
        })
        if (changed) {
          await writeFile(full, newContent, 'utf-8')
          updatedCount++
          console.log(`  Updated refs in: ${full}`)
        }
      }
    }
  }

  await scanForMd(categoryDir)
  console.log(`  Moved ${movedCount} images, updated ${updatedCount} markdown files`)
}

async function main() {
  console.log(`Migrating images in: ${storageDir}`)

  const notesDir = join(storageDir, 'notes')
  const plansDir = join(storageDir, 'plans')

  console.log('\n=== Notes ===')
  await migrateCategory(notesDir)

  console.log('\n=== Plans ===')
  await migrateCategory(plansDir)

  console.log('\nDone!')
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
