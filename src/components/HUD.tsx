import { useEffect, useRef } from 'react'
import { MINIMAP_H, MINIMAP_MARGIN, MINIMAP_W } from '../game/constants'
import type { Stats } from '../game/stats'
import type { LogEntry } from './logEntry'
import './HUD.css'

interface HUDProps {
  started: boolean
  gameOver: boolean
  stats: Stats | null
  log: LogEntry[]
  onStart: () => void
  onRestart: () => void
}

function EventLog({ log }: { log: LogEntry[] }) {
  const listRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [log])

  return (
    <div className="event-log">
      <div className="event-log-list" ref={listRef}>
        {log.length === 0 && <div className="event-log-empty">Пока тихо...</div>}
        {log.map((entry) => (
          <div key={entry.id} className={`event-log-entry event-log-${entry.kind}`}>
            {entry.text}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function HUD({ started, gameOver, stats, log, onStart, onRestart }: HUDProps) {
  if (!started) {
    return (
      <div className="overlay">
        <div className="panel">
          <h1>Pirates Arena</h1>
          <p className="subtitle">Морской бой: вражеские корабли, острова и апгрейды из сундуков</p>
          <ul className="rules">
            <li><b>WASD / стрелки</b> — управление кораблём</li>
            <li><b>Мышь</b> — прицеливание пушкой</li>
            <li><b>ЛКМ / пробел</b> — огонь</li>
            <li>Разбивайте бочки и обломки, собирайте предметы, чтобы усилить корабль</li>
          </ul>
          <button className="primary-btn" onClick={onStart}>Играть</button>
        </div>
      </div>
    )
  }

  if (gameOver) {
    return (
      <div className="overlay">
        <div className="panel">
          <h1>Корабль потоплен</h1>
          {stats && <p className="subtitle">Убийств: {stats.kills}</p>}
          <button className="primary-btn" onClick={onRestart}>Заново (R)</button>
        </div>
      </div>
    )
  }

  if (!stats) return null

  const hpFrac = stats.maxHp > 0 ? stats.hp / stats.maxHp : 0

  return (
    <div className="hud">
      <div className="hud-top">
        <div className="hp-block">
          <div className="hp-bar">
            <div
              className="hp-fill"
              style={{
                width: `${Math.max(0, hpFrac) * 100}%`,
                background: hpFrac > 0.4 ? '#3ee06f' : '#e05252',
              }}
            />
          </div>
          <span className="hp-text">{stats.hp} / {stats.maxHp} HP</span>
        </div>
        <div className="hud-badge">Убийства: {stats.kills}</div>
        <div className="hud-badge">Кораблей на плаву: {stats.botsAlive} / {stats.botsTotal}</div>
      </div>

      <div className="hud-stats">
        <span title="Скорость">🚀 {stats.speed}</span>
        <span title="Урон">💥 {stats.damage}</span>
        <span title="Броня">🛡 {stats.armor}%</span>
        <span title="Перезарядка пушки">🔁 {stats.reloadSeconds}с</span>
      </div>

      <EventLog log={log} />

      <div
        className="minimap-frame"
        style={{ width: MINIMAP_W, height: MINIMAP_H, right: MINIMAP_MARGIN, bottom: MINIMAP_MARGIN }}
      />
    </div>
  )
}
