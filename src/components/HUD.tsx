import { useEffect, useRef, useState } from 'react'
import { BOT_COUNT, MAX_BOT_COUNT, MINIMAP_H, MINIMAP_MARGIN, MINIMAP_W } from '../game/constants'
import type { Stats } from '../game/stats'
import type { LogEntry } from './logEntry'
import './HUD.css'

interface HUDProps {
  started: boolean
  gameOver: boolean
  netError: string | null
  stats: Stats | null
  log: LogEntry[]
  onStart: (mode: 'local' | 'online', botCount: number, nickname: string) => void
  onRestart: () => void
}

const NICKNAME_LS_KEY = 'pirates.nickname'

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

export default function HUD({ started, gameOver, netError, stats, log, onStart, onRestart }: HUDProps) {
  const [botCount, setBotCount] = useState(BOT_COUNT)
  const [nickname, setNickname] = useState(() => localStorage.getItem(NICKNAME_LS_KEY) ?? '')

  const handleNickname = (value: string) => {
    setNickname(value)
    localStorage.setItem(NICKNAME_LS_KEY, value)
  }

  if (netError) {
    return (
      <div className="overlay">
        <div className="panel">
          <h1>Мультиплеер</h1>
          <p className="subtitle">{netError}</p>
          <button className="primary-btn" onClick={() => window.location.reload()}>В меню</button>
        </div>
      </div>
    )
  }

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
            <li><b>Shift</b> — ускорение; голубая полоска под кораблём тратится и восстанавливается</li>
            <li>Разбивайте бочки и обломки, собирайте предметы, чтобы усилить корабль</li>
          </ul>
          <div className="menu-setting">
            <label htmlFor="bot-count">Ботов: <b>{botCount}</b></label>
            <input
              id="bot-count"
              type="range"
              min={0}
              max={MAX_BOT_COUNT}
              value={botCount}
              onChange={(e) => setBotCount(Number(e.target.value))}
            />
          </div>
          <div className="menu-setting">
            <label htmlFor="nickname">Ник:</label>
            <input
              id="nickname"
              className="nickname-input"
              type="text"
              maxLength={16}
              placeholder="для Multi Player"
              value={nickname}
              onChange={(e) => handleNickname(e.target.value)}
            />
          </div>
          <div className="menu-buttons">
            <button className="primary-btn" onClick={() => onStart('local', botCount, nickname)}>Играть</button>
            <button className="secondary-btn" onClick={() => onStart('online', botCount, nickname)}>Multi Player</button>
          </div>
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
