import type { Note } from '@/types/note'

const TAG_ACCENT_COLORS = [
  '#0A84FF', // --accent-blue
  '#BF5AF2', // --accent-purple
  '#FF375F', // --accent-pink
  '#FF6B6B', // coral
  '#FFD60A', // --accent-yellow
  '#30D158', // --accent-green
  '#64D2FF', // --accent-teal
  '#5E5CE6', // --accent-indigo
]

function djb2Hash(str: string): number {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0
  }
  return hash
}

export function getTagColor(name: string): string {
  return TAG_ACCENT_COLORS[djb2Hash(name) % TAG_ACCENT_COLORS.length]
}

export function getAllTags(notes: Note[]): string[] {
  const counts = new Map<string, number>()
  for (const note of notes) {
    for (const tag of note.tags ?? []) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name]) => name)
}
