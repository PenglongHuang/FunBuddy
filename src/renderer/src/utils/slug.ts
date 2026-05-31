export function titleToSlug(title: string, maxLen = 20): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9一-鿿]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLen)
  return slug || 'untitled'
}
