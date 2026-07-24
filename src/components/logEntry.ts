export type LogEntryKind = 'pickup' | 'damage' | 'kill' | 'shield'

export interface LogEntry {
  id: number
  text: string
  kind: LogEntryKind
}
