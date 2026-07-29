import { useEffect, useRef, useState } from 'react'
import { BOT_DEFAULT_COUNT, BOT_MAX_COUNT, MINIMAP_H, MINIMAP_MARGIN, MINIMAP_W } from '../../../shared/game/constants'
import { isPerkType, PERK_DEFS, PERK_TYPES } from '../../../shared/game/perks'
import { PICKUP_DEFS, PICKUP_TYPES } from '../../../shared/game/pickups'
import type { Stats } from '../../../shared/game/stats'
import type { PerkType, PickupType } from '../../../shared/game/types'
import { GAME_MODES, type ModeHudState, type EndResult } from '../../../shared/game/modes'
import type { LeaderboardEntry, RoundStatus } from '../../../shared/net/protocol'
import type { VictoryData } from './victoryData'
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
  victory: VictoryData | null
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
  /** Mode-specific HUD state (timer, status, etc.) — null when no mode is active. */
  modeHud: ModeHudState | null
  /** End-of-match result from the game mode — null while playing. */
  matchEnd: EndResult | null
  onStart: (mode: 'local' | 'online', botCount: number, nickname: string, perk: PerkType, gameModeId: string | null) => void
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

/** Flavor text for the mode-select cards — kept local to the HUD since it's presentational only. */
const MODE_INFO: Record<string, { icon: string; desc: string }> = {
  lastShipStanding: { icon: '☠️', desc: 'Без возрождений — побеждает последний на плаву' },
  deathmatch: { icon: '⚔️', desc: 'Респавн включён, у кого больше потоплений к концу раунда' },
  battleRoyale: { icon: '🌀', desc: 'Зона сужается — не задерживайтесь на краю карты' },
  kingOfTheHill: { icon: '⛰️', desc: 'Удерживайте зону в центре дольше соперников' },
  teamDeathmatch: { icon: '🚩', desc: 'Командный бой 🔴 против 🔵 до конца раунда' },
  captureTheFlag: { icon: '🏁', desc: 'Захватите флаг соперника и принесите на свою базу' },
}

function StepHeader({
  step,
  total,
  title,
  onBack,
}: {
  step: number
  total: number
  title: string
  onBack: () => void
}) {
  return (
    <div className="wizard-head">
      <button className="wizard-back" onClick={onBack} title="Назад">←</button>
      <div className="wizard-progress">
        <span className="wizard-step">Шаг {step} из {total}</span>
        <div className="wizard-dots">
          {Array.from({ length: total }).map((_, i) => (
            <span key={i} className={`wizard-dot${i < step ? ' wizard-dot-done' : ''}`} />
          ))}
        </div>
      </div>
      <h1 className="wizard-title">{title}</h1>
    </div>
  )
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

export default function HUD({
  started,
  gameOver,
  victory,
  netError,
  megaAnnounce,
  adminOpen,
  onAdminPickup,
  onAdminClose,
  stats,
  log,
  roundStatus,
  leaderboard,
  modeHud,
  matchEnd,
  onStart,
  onRestart,
}: HUDProps) {
  const [botCount, setBotCount] = useState(BOT_DEFAULT_COUNT)
  const [nickname, setNickname] = useState(() => localStorage.getItem(NICKNAME_LS_KEY) ?? '')
  /** Set once the player picks a mode — switches the menu to the config/perk steps. */
  const [pendingMode, setPendingMode] = useState<'local' | 'online' | null>(null)
  /** Local-only sub-step: game mode + bot count, before the shared perk step. */
  const [localStep, setLocalStep] = useState<'settings' | 'perk'>('settings')
  const [gameModeId, setGameModeId] = useState(GAME_MODES[0].id)
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
    onStart(pendingMode, botCount, nickname, perk, pendingMode === 'local' ? gameModeId : null)
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

  const helpFab = (
    <button className="help-fab" onClick={() => setHelpOpen(true)} title="Как играть">❓</button>
  )

  const helpModal = helpOpen && (
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
  )

  // Step 2 of 3 (local only): pick the game mode and bot count before the shared perk step.
  if (!started && pendingMode === 'local' && localStep === 'settings') {
    return (
      <div className="overlay pirate-bg">
        <div className="panel wizard-panel" key="settings">
          <StepHeader step={2} total={3} title="Настройте бой" onBack={() => setPendingMode(null)} />

          <div className="wizard-section">
            <div className="wizard-section-label">Режим игры</div>
            <div className="gamemode-grid">
              {GAME_MODES.map((m) => {
                const info = MODE_INFO[m.id]
                return (
                  <button
                    key={m.id}
                    className={`gamemode-card${gameModeId === m.id ? ' gamemode-card-selected' : ''}`}
                    onClick={() => setGameModeId(m.id)}
                  >
                    <span className="gamemode-icon">{info?.icon ?? '🎮'}</span>
                    <span className="gamemode-label">{m.label}</span>
                    <span className="gamemode-desc">{info?.desc ?? ''}</span>
                    <span className={`gamemode-badge${m.teamMode ? ' gamemode-badge-team' : ''}`}>
                      {m.teamMode ? '🔴🔵 Команды' : '🆓 Все против всех'}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="wizard-section">
            <div className="wizard-section-label">Количество ботов: <b className="bot-count-value">{botCount}</b></div>
            <div className="bot-pills">
              {Array.from({ length: BOT_MAX_COUNT + 1 }).map((_, n) => (
                <button
                  key={n}
                  className={`bot-pill${botCount === n ? ' bot-pill-selected' : ''}`}
                  onClick={() => setBotCount(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="menu-buttons">
            <button className="primary-btn primary-btn-big" onClick={() => setLocalStep('perk')}>Далее →</button>
          </div>
        </div>
      </div>
    )
  }

  // Perk step — shared by both modes; last step for online (2/2), final step for local (3/3).
  if (!started && pendingMode) {
    const total = pendingMode === 'local' ? 3 : 2
    const step = total
    const summary = pendingMode === 'local'
      ? `${GAME_MODES.find((m) => m.id === gameModeId)?.label ?? ''} · ботов: ${botCount}`
      : 'Мультиплеер'
    return (
      <div className="overlay pirate-bg">
        <div className="panel wizard-panel" key="perk">
          <StepHeader
            step={step}
            total={total}
            title="Выберите стартовый буст"
            onBack={() => (pendingMode === 'local' ? setLocalStep('settings') : setPendingMode(null))}
          />
          <p className="subtitle">
            Бонус действует весь бой{pendingMode === 'online' ? ' и сохраняется после возрождения' : ''}
          </p>
          <div className="perk-grid">
            {PERK_TYPES.map((type) => {
              const def = PERK_DEFS[type]
              return (
                <button
                  key={type}
                  className={`perk-card${perk === type ? ' perk-card-selected' : ''}`}
                  onClick={() => setPerk(type)}
                >
                  <span className="perk-icon-wrap"><span className="perk-emoji">{def.emoji}</span></span>
                  <span className="perk-label">{def.label}</span>
                  <span className="perk-desc">{def.description}</span>
                </button>
              )
            })}
          </div>
          <div className="wizard-summary">{summary}{nickname ? ` · ${nickname}` : ''}</div>
          <div className="menu-buttons">
            <button className="primary-btn primary-btn-big" onClick={handleLaunch}>В бой ⚓</button>
          </div>
        </div>
      </div>
    )
  }

  if (!started) {
    return (
      <div className="overlay pirate-bg">
        <div className="start-deco" aria-hidden="true">
          <span className="start-deco-item start-deco-1">🧭</span>
          <span className="start-deco-item start-deco-2">☠️</span>
          <span className="start-deco-item start-deco-3">⚓</span>
          <span className="start-deco-item start-deco-4">🌊</span>
        </div>
        <div className="menu-columns">
          <div className="panel menu-panel">
            {helpFab}

            <div className="start-badge">🏴‍☠️ Морская арена</div>
            <h1 className="start-title">Pirates Arena</h1>
            <p className="subtitle">Морской бой на выживание — потопите все корабли на арене</p>

            <label className="start-field">
              <span className="start-field-label">Имя капитана</span>
              <input
                className="nickname-input nickname-input-big"
                type="text"
                maxLength={16}
                placeholder="Ваш ник"
                value={nickname}
                onChange={(e) => handleNickname(e.target.value)}
                autoFocus
              />
            </label>

            <div className="mode-cards">
              <button
                className="mode-card mode-card-online"
                disabled={serverUnreachable || serverStatus?.full}
                onClick={() => setPendingMode('online')}
              >
                <span className="mode-card-icon">🌐</span>
                <span className="mode-card-title">Играть онлайн</span>
                <span className="mode-card-desc">Живые соперники, общий рейтинг</span>
                <span className={`mode-card-status${serverUnreachable ? ' mode-card-status-offline' : ''}${serverStatus?.full ? ' mode-card-status-full' : ''}`}>
                  <span className="mode-card-dot" />
                  {serverUnreachable && 'Сервер недоступен'}
                  {!serverUnreachable && !serverStatus && 'Проверка сервера...'}
                  {!serverUnreachable && serverStatus && (
                    serverStatus.full
                      ? `Полон (${serverStatus.players}/${serverStatus.maxPlayers})`
                      : `${serverStatus.players}/${serverStatus.maxPlayers} игроков · ботов: ${serverStatus.bots}`
                  )}
                </span>
              </button>

              <button
                className="mode-card mode-card-local"
                onClick={() => {
                  setLocalStep('settings')
                  setPendingMode('local')
                }}
              >
                <span className="mode-card-icon">🏝</span>
                <span className="mode-card-title">Играть с ботами</span>
                <span className="mode-card-desc">Оффлайн, настройте режим и число соперников</span>
              </button>
            </div>
          </div>

          <div className="side-panel leaderboard-panel start-leaderboard">
            <div className="side-panel-title">🏆 Топ-10 игроков</div>
            {serverStatus && serverStatus.leaderboard.length > 0 ? (
              <div className="leaderboard">
                {serverStatus.leaderboard.map((entry, i) => (
                  <div key={entry.playerId} className="leaderboard-row">
                    <span className="leaderboard-name">
                      <span className={`leaderboard-rank${i < 3 ? ` leaderboard-rank-${i + 1}` : ''}`}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                      </span>{' '}
                      {entry.name}
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

        {helpModal}
      </div>
    )
  }

  if (matchEnd) {
    const hasScoreboard = matchEnd.scoreboard && matchEnd.scoreboard.length > 0
    const ps = matchEnd.playerStats
    const accuracy = ps && ps.shotsFired > 0 ? Math.round((ps.hits / ps.shotsFired) * 100) : 0
    return (
      <div className="overlay">
        <div className="panel">
          <h1>{matchEnd.winner ? '🏆 Победа!' : matchEnd.reason}</h1>
          {matchEnd.winner && <p className="subtitle">{matchEnd.reason}</p>}
          {ps && !hasScoreboard && (
            <div className="victory-stats">
              <div className="victory-stat">⏱ Время: {Math.floor(ps.duration / 60)}:{Math.floor(ps.duration % 60).toString().padStart(2, '0')}</div>
              <div className="victory-stat">💀 Потоплено: {ps.kills}</div>
              <div className="victory-stat">💣 Выстрелов: {ps.shotsFired}</div>
              <div className="victory-stat">🎯 Попаданий: {ps.hits} ({accuracy}%)</div>
            </div>
          )}
          {hasScoreboard && (
            <div className="match-scoreboard">
              <div className="scoreboard-header">
                <span className="sb-name">Имя</span>
                <span className="sb-kills">💀</span>
                <span className="sb-deaths">☠️</span>
              </div>
              {matchEnd.scoreboard!.map((entry, i) => (
                <div key={i} className={`scoreboard-row${entry.isPlayer ? ' scoreboard-row-player' : ''}${entry.faction === 'red' ? ' scoreboard-row-red' : ''}${entry.faction === 'blue' ? ' scoreboard-row-blue' : ''}`}>
                  <span className="sb-name">{entry.faction === 'red' ? '🔴 ' : entry.faction === 'blue' ? '🔵 ' : ''}{entry.name}</span>
                  <span className="sb-kills">{entry.kills}</span>
                  <span className="sb-deaths">{entry.deaths}</span>
                </div>
              ))}
            </div>
          )}
          <button className="primary-btn" onClick={onRestart}>Заново (R)</button>
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

  if (victory) {
    const accuracy = victory.shotsFired > 0 ? Math.round((victory.hits / victory.shotsFired) * 100) : 0
    const mins = Math.floor(victory.duration / 60)
    const secs = Math.floor(victory.duration % 60)
    return (
      <div className="overlay">
        <div className="panel">
          <h1>🏆 Победа!</h1>
          <p className="subtitle">Все вражеские корабли потоплены</p>
          <div className="victory-stats">
            <div className="victory-stat">⏱ Время: {mins}:{secs.toString().padStart(2, '0')}</div>
            <div className="victory-stat">💀 Потоплено: {victory.kills}</div>
            <div className="victory-stat">💣 Выстрелов: {victory.shotsFired}</div>
            <div className="victory-stat">🎯 Попаданий: {victory.hits} ({accuracy}%)</div>
          </div>
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
        <div className="hud-badge">Потоплено: {stats.kills}</div>
        <div className="hud-badge">Кораблей на плаву: {stats.botsAlive} / {stats.botsTotal}</div>
        {roundStatus && roundStatus.phase === 'playing' && (
          <div className="hud-badge">⏱ {formatRoundTime(roundStatus.timeRemaining)}</div>
        )}
        {modeHud?.timer && !roundStatus && (
          <div className="hud-badge">⏱ {modeHud.timer}</div>
        )}
        {modeHud?.status && (
          <div className="hud-badge">{modeHud.status}</div>
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
          <span className="mega-banner-title">🏴‍☠️ ЧЁРНАЯ ЖЕМЧУЖИНА</span>
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
