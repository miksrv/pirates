import { useEffect, useRef, useState } from 'react'
import { BOT_DEFAULT_COUNT, BOT_MAX_COUNT, MINIMAP_H, MINIMAP_MARGIN, MINIMAP_W } from '../../../shared/game/constants'
import { isPerkType, PERK_DEFS, PERK_TYPES } from '../../../shared/game/perks'
import { PICKUP_DEFS, PICKUP_TYPES } from '../../../shared/game/pickups'
import type { Stats } from '../../../shared/game/stats'
import type { PerkType, PickupType } from '../../../shared/game/types'
import type { LeaderboardEntry, RoundStatus } from '../../../shared/net/protocol'
import { fetchServerStatus, type ServerStatus } from '../net/status'
import type { LogEntry } from './logEntry'
import './HUD.css'

const SERVER_STATUS_POLL_MS = 5000

function formatLastSeen(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString()
}

interface HUDProps {
  started: boolean
  gameOver: boolean
  netError: string | null
  megaAnnounce: boolean
  /** iddqd debug panel — single-player only, wired up in PhaserGame. */
  adminOpen: boolean
  onAdminPickup: (type: PickupType) => void
  onAdminClose: () => void
  stats: Stats | null
  log: LogEntry[]
  /** Server-authoritative round clock — null in single-player, where there's no round concept. */
  roundStatus: RoundStatus | null
  leaderboard: LeaderboardEntry[]
  onStart: (mode: 'local' | 'online', botCount: number, nickname: string, perk: PerkType) => void
  onRestart: () => void
}

/** mm:ss, rounded up so it counts down to 0 instead of skipping past it. */
function formatRoundTime(seconds: number): string {
  const total = Math.max(0, Math.ceil(seconds))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

const NICKNAME_LS_KEY = 'pirates.nickname'
const PERK_LS_KEY = 'pirates.perk'

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

export default function HUD({
  started,
  gameOver,
  netError,
  megaAnnounce,
  adminOpen,
  onAdminPickup,
  onAdminClose,
  stats,
  log,
  roundStatus,
  leaderboard,
  onStart,
  onRestart,
}: HUDProps) {
  const [botCount, setBotCount] = useState(BOT_DEFAULT_COUNT)
  const [nickname, setNickname] = useState(() => localStorage.getItem(NICKNAME_LS_KEY) ?? '')
  /** Set once the player picks a mode — switches the menu to the perk step. */
  const [pendingMode, setPendingMode] = useState<'local' | 'online' | null>(null)
  const [perk, setPerk] = useState<PerkType>(() => {
    const saved = localStorage.getItem(PERK_LS_KEY)
    return isPerkType(saved) ? saved : 'swiftSails'
  })
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null)
  const [serverUnreachable, setServerUnreachable] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)

  // Polled only while the mode-select screen is up — no point pinging the server mid-match.
  useEffect(() => {
    if (started) return
    let cancelled = false
    const poll = () => {
      fetchServerStatus()
        .then((status) => {
          if (cancelled) return
          setServerStatus(status)
          setServerUnreachable(false)
        })
        .catch(() => {
          if (cancelled) return
          setServerStatus(null)
          setServerUnreachable(true)
        })
    }
    poll()
    const id = window.setInterval(poll, SERVER_STATUS_POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [started])

  const handleNickname = (value: string) => {
    setNickname(value)
    localStorage.setItem(NICKNAME_LS_KEY, value)
  }

  const handleLaunch = () => {
    if (!pendingMode) return
    localStorage.setItem(PERK_LS_KEY, perk)
    onStart(pendingMode, botCount, nickname, perk)
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

  if (!started && pendingMode) {
    return (
      <div className="overlay">
        <div className="panel">
          <h1>Выберите перк</h1>
          <p className="subtitle">
            {pendingMode === 'online' ? 'Мультиплеер' : 'Одиночная игра'} — бонус действует весь бой
            {pendingMode === 'online' ? ' и сохраняется после возрождения' : ''}
          </p>
          {pendingMode === 'local' && (
            <div className="menu-setting">
              <label htmlFor="bot-count">Ботов: <b>{botCount}</b></label>
              <input
                id="bot-count"
                type="range"
                min={0}
                max={BOT_MAX_COUNT}
                value={botCount}
                onChange={(e) => setBotCount(Number(e.target.value))}
              />
            </div>
          )}
          <div className="perk-grid">
            {PERK_TYPES.map((type) => {
              const def = PERK_DEFS[type]
              return (
                <button
                  key={type}
                  className={`perk-card${perk === type ? ' perk-card-selected' : ''}`}
                  onClick={() => setPerk(type)}
                >
                  <span className="perk-emoji">{def.emoji}</span>
                  <span className="perk-label">{def.label}</span>
                  <span className="perk-desc">{def.description}</span>
                </button>
              )
            })}
          </div>
          <div className="menu-buttons">
            <button className="primary-btn" onClick={handleLaunch}>В бой</button>
            <button className="secondary-btn" onClick={() => setPendingMode(null)}>Назад</button>
          </div>
        </div>
      </div>
    )
  }

  if (!started) {
    return (
      <div className="overlay">
        <div className="menu-columns">
          <div className="panel menu-panel">
            <button className="help-fab" onClick={() => setHelpOpen(true)} title="Как играть">❓</button>

            <h1>Pirates Arena</h1>
            <p className="subtitle">Морской бой на выживание — потопите все корабли на арене</p>

            <input
              className="nickname-input nickname-input-big"
              type="text"
              maxLength={16}
              placeholder="Ваш ник"
              value={nickname}
              onChange={(e) => handleNickname(e.target.value)}
              autoFocus
            />

            <button
              className="primary-btn primary-btn-big"
              disabled={serverStatus?.full}
              onClick={() => setPendingMode('online')}
            >
              ⚓ Играть онлайн
            </button>
            <p className={`server-status${serverUnreachable ? ' server-status-offline' : ''}${serverStatus?.full ? ' server-status-full' : ''}`}>
              {serverUnreachable && 'Сервер недоступен — попробуйте одиночную игру'}
              {!serverUnreachable && !serverStatus && 'Проверка сервера...'}
              {!serverUnreachable && serverStatus && (
                serverStatus.full
                  ? `Сервер полон (${serverStatus.players}/${serverStatus.maxPlayers})`
                  : `Сервер: ${serverStatus.players}/${serverStatus.maxPlayers} игроков · ботов: ${serverStatus.bots}`
              )}
            </p>

            <button className="secondary-btn secondary-btn-block" onClick={() => setPendingMode('local')}>
              🏝 Играть с ботами
            </button>
          </div>

          <div className="side-panel leaderboard-panel">
            <div className="side-panel-title">🏆 Топ-10 игроков</div>
            {serverStatus && serverStatus.leaderboard.length > 0 ? (
              <div className="leaderboard">
                {serverStatus.leaderboard.map((entry, i) => (
                  <div key={entry.playerId} className="leaderboard-row">
                    <span className="leaderboard-name">
                      <span className="leaderboard-rank">#{i + 1}</span> {entry.name}
                    </span>
                    <span
                      className="leaderboard-kills"
                      title={`Побед: ${entry.wins} · Поражений: ${entry.losses} · Точность: ${Math.round(entry.accuracy * 100)}% · Последний вход: ${formatLastSeen(entry.updatedAt)}`}
                    >
                      💀 {entry.kills}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="subtitle">Пока нет данных</p>
            )}
          </div>
        </div>

        {helpOpen && (
          <div className="help-overlay" onClick={() => setHelpOpen(false)}>
            <div className="help-modal" onClick={(e) => e.stopPropagation()}>
              <div className="help-modal-head">
                <span className="side-panel-title">Как играть</span>
                <button className="admin-close" onClick={() => setHelpOpen(false)}>✕</button>
              </div>
              <ul className="rules">
                <li><b>WASD / стрелки</b> — управление кораблём</li>
                <li><b>Мышь</b> — прицеливание пушкой</li>
                <li><b>ЛКМ / пробел</b> — огонь</li>
                <li><b>Shift</b> — ускорение</li>
                <li>Разбивайте бочки и обломки, собирайте предметы, чтобы усилить корабль</li>
              </ul>
              <div className="side-panel-title">🎁 Бусты</div>
              <div className="boosts-list">
                {PICKUP_TYPES.map((type) => {
                  const def = PICKUP_DEFS[type]
                  return (
                    <div key={type} className="boost-item">
                      <span className="boost-item-emoji">{def.emoji}</span>
                      <div className="boost-item-text">
                        <span className="boost-item-label">{def.label}</span>
                        <span className="boost-item-desc">{def.description}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
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
        {roundStatus && roundStatus.phase === 'playing' && (
          <div className="hud-badge">⏱ {formatRoundTime(roundStatus.timeRemaining)}</div>
        )}
      </div>

      <div className="hud-stats">
        <span title="Скорость">🚀 {stats.speed}</span>
        <span title="Урон">💥 {stats.damage}</span>
        <span title="Броня">🛡 {stats.armor}%</span>
        <span title="Перезарядка пушки">🔁 {stats.reloadSeconds}с</span>
      </div>

      {adminOpen && (
        <div className="admin-panel">
          <div className="admin-head">
            <span className="admin-title">🛠 iddqd — тестовая панель</span>
            <button className="admin-close" onClick={onAdminClose} title="Закрыть (iddqd)">
              ✕
            </button>
          </div>
          <p className="admin-hint">Выдать бонус своему кораблю (только одиночная игра)</p>
          <div className="admin-grid">
            {PICKUP_TYPES.map((type) => {
              const def = PICKUP_DEFS[type]
              return (
                <button
                  key={type}
                  className="admin-item"
                  title={def.description}
                  onClick={() => onAdminPickup(type)}
                >
                  <span className="admin-item-emoji">{def.emoji}</span>
                  <span className="admin-item-label">{def.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {megaAnnounce && (
        <div className="mega-banner">
          <span className="mega-banner-title">🔱 ЯРОСТЬ ЛЕВИАФАНА</span>
          <span className="mega-banner-sub">Появилась на карте — смотрите метку на миникарте!</span>
        </div>
      )}

      <EventLog log={log} />

      <div
        className="minimap-frame"
        style={{ width: MINIMAP_W, height: MINIMAP_H, right: MINIMAP_MARGIN, bottom: MINIMAP_MARGIN }}
      />

      {roundStatus && roundStatus.phase === 'ended' && (
        <div className="overlay">
          <div className="panel">
            <h1>Раунд завершён</h1>
            <p className="subtitle">Новый раунд через {Math.ceil(roundStatus.timeRemaining)} с</p>
            <div className="leaderboard">
              {leaderboard.map((entry) => (
                <div
                  key={entry.shipId}
                  className={`leaderboard-row${entry.alive ? '' : ' leaderboard-row-dead'}`}
                >
                  <span className="leaderboard-name">
                    {entry.team === 'bot' ? '🤖 ' : '⚓ '}
                    {entry.name}
                  </span>
                  <span className="leaderboard-kills">💀 {entry.kills} · ⚰️ {entry.deaths}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
