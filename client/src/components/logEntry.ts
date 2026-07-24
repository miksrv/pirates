export type LogEntryKind = 'pickup' | 'damage' | 'kill' | 'shield' | 'info' | 'mega'

export interface LogEntry {
  id: number
  text: string
  kind: LogEntryKind
}
