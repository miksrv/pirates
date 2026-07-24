export type LogEntryKind = 'pickup' | 'damage' | 'kill' | 'shield' | 'info'

export interface LogEntry {
  id: number
  text: string
  kind: LogEntryKind
}
