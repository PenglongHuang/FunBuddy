/** 本地日期键 YYYY-MM-DD。"今天/历史分组"一律用本地日期，禁止 toISOString().split('T')[0]。 */
export function localDateKey(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** UTC ISO → datetime-local 输入值（按本地时区显示，修复编辑偏移） */
export function isoToDatetimeLocal(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** datetime-local 输入值 → UTC ISO。无效/空输入（受控输入被清空）返回 ''，不抛错。 */
export function datetimeLocalToIso(value: string): string {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString()
}
