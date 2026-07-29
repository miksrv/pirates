import { useEffect, useRef, useState } from 'react'
import { LEVELS_BASE, rankIconKey } from '../../../shared/game/assetKeys'
import { BOT_DEFAULT_COUNT, BOT_MAX_COUNT, MINIMAP_H, MINIMAP_MARGIN, MINIMAP_W } from '../../../shared/game/constants'
import { PICKUP_DEFS, PICKUP_TYPES } from '../../../shared/game/pickups'
import type { RankProgress } from '../../../shared/game/rank'
import type { Stats } from '../../../shared/game/stats'
import type { PickupType } from '../../../shared/game/types'
import { GAME_MODES, type ModeHudState, type EndResult } from '../../../shared/game/modes'
import type { RoundStatus, VoteTallyEntry } from '../../../shared/net/protocol'
import type { VictoryData } from './victoryData'
import type { RoundBanner } from './roundBanner'
import { clearStoredAuth, fetchProfile, getStoredAuth, login, setStoredAuth, UnauthorizedError, type ProfileData, type StoredAuth } from '../net/auth'
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
  /** Live vote tally for the next round's (mode, bot count) — empty outside the 'ended' phase. */
  voteTally: VoteTallyEntry[]
  /** Mode-specific HUD state (timer, status, etc.) — null when no mode is active. */
  modeHud: ModeHudState | null
  /** End-of-match result from the game mode — null while playing. */
  matchEnd: EndResult | null
  /** Victory/defeat announcement for the round/match that just ended — null once its 5s window
   * has passed or no round has ended yet. */
  roundBanner: RoundBanner | null
  /** Whether `roundBanner` is currently in its 5s on-screen window (vs. already expired). */
  bannerVisible: boolean
  /** This connection's own level/XP — null offline, or online before the first stats flush. */
  rank: RankProgress | null
  /** Level just reached (round-transition welcome), shown as a celebration toast; null otherwise. */
  levelUp: number | null
  /** Permanent stat pickup this player just collected — flashes the matching hud-stats value; null otherwise. */
  statBoost: { type: PickupType; key: number } | null
  onStart: (mode: 'local' | 'online', botCount: number, nickname: string, gameModeId: string | null, authToken: string | null) => void
  onRestart: () => void
  /** Casts this player's vote for the next round's mode/bot count (online only). */
  onVote: (gameModeId: string, botCount: number) => void
}

/** mm:ss, rounded up so it counts down to 0 instead of skipping past it. */
function formatRoundTime(seconds: number): string {
  const total = Math.max(0, Math.ceil(seconds))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

const NICKNAME_LS_KEY = 'pirates.nickname'

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

/** Mode grid + bot-count pills — shared by the local wizard's settings step, the online
 * room-create step, and the between-round vote panel. */
function GameModeAndBots({
  gameModeId,
  onGameModeChange,
  botCount,
  onBotCountChange,
}: {
  gameModeId: string
  onGameModeChange: (id: string) => void
  botCount: number
  onBotCountChange: (n: number) => void
}) {
  return (
    <>
      <div className="wizard-section">
        <div className="wizard-section-label">Режим игры</div>
        <div className="gamemode-grid">
          {GAME_MODES.map((m) => {
            const info = MODE_INFO[m.id]
            return (
              <button
                key={m.id}
                className={`gamemode-card${gameModeId === m.id ? ' gamemode-card-selected' : ''}`}
                onClick={() => onGameModeChange(m.id)}
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
              onClick={() => onBotCountChange(n)}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    </>
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

/** Rank icon, shown before a nickname wherever a level is known (leaderboards, HUD widget). */
function RankBadge({ level }: { level: number }) {
  return (
    <img
      className="rank-badge"
      src={`${LEVELS_BASE}/${rankIconKey(level)}.png`}
      alt={`Уровень ${level}`}
      title={`Уровень ${level}`}
    />
  )
}

/** Centered victory/defeat/draw announcement shown for 5s right when a round or match ends,
 * before the (now stats-free) next-round panel takes over. Same shape for local and online play. */
function RoundResultBanner({ banner }: { banner: RoundBanner }) {
  const { outcome, reason, scoreboard, playerStats } = banner
  const title = outcome === 'win' ? '🏆 Победа!' : outcome === 'lose' ? '💀 Поражение' : '🤝 Ничья'
  const hasScoreboard = !!scoreboard && scoreboard.length > 0
  const accuracy = playerStats && playerStats.shotsFired > 0 ? Math.round((playerStats.hits / playerStats.shotsFired) * 100) : 0
  return (
    <div className="overlay">
      <div className={`round-result-banner round-result-${outcome}`}>
        <h1 className="round-result-title">{title}</h1>
        <p className="round-result-reason">{reason}</p>
        {playerStats && !hasScoreboard && (
          <div className="victory-stats">
            <div className="victory-stat">⏱ Время: {Math.floor(playerStats.duration / 60)}:{Math.floor(playerStats.duration % 60).toString().padStart(2, '0')}</div>
            <div className="victory-stat">💀 Потоплено: {playerStats.kills}</div>
            <div className="victory-stat">💣 Выстрелов: {playerStats.shotsFired}</div>
            <div className="victory-stat">🎯 Попаданий: {playerStats.hits} ({accuracy}%)</div>
          </div>
        )}
        {hasScoreboard && (
          <div className="match-scoreboard">
            <div className="scoreboard-header">
              <span className="sb-name">Имя</span>
              <span className="sb-kills">💀</span>
              <span className="sb-deaths">☠️</span>
            </div>
            {scoreboard!.map((entry, i) => (
              <div
                key={i}
                className={`scoreboard-row${entry.isPlayer ? ' scoreboard-row-player' : ''}${entry.faction === 'red' ? ' scoreboard-row-red' : ''}${entry.faction === 'blue' ? ' scoreboard-row-blue' : ''}`}
              >
                <span className="sb-name">{entry.faction === 'red' ? '🔴 ' : entry.faction === 'blue' ? '🔵 ' : ''}{entry.name}</span>
                <span className="sb-kills">{entry.kills}</span>
                <span className="sb-deaths">{entry.deaths}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/** Compact rank widget for the in-match HUD: icon, level, and an XP progress bar towards the
 * next one. Only rendered when the server has actually assigned this connection a rank. */
function RankWidget({ rank }: { rank: RankProgress }) {
  const maxed = rank.xpForNextLevel <= 0
  const pct = maxed ? 100 : Math.min(100, Math.round((rank.xpIntoLevel / rank.xpForNextLevel) * 100))
  const tooltip = maxed ? `Максимальный уровень · ${rank.xp} XP всего` : `${rank.xpIntoLevel} / ${rank.xpForNextLevel} XP до следующего уровня`
  return (
    <div className="hud-badge hud-rank" title={tooltip}>
      <RankBadge level={rank.level} />
      <span className="hud-rank-level">Ур. {rank.level}</span>
      <div className="hud-rank-bar">
        <div className="hud-rank-bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

/** Personal profile page: full lifetime stats + rank progress for the logged-in account. */
function ProfileModal({ auth, profile, onClose }: { auth: StoredAuth; profile: ProfileData | null; onClose: () => void }) {
  const p = profile?.profile
  const maxed = !!p && p.xpForNextLevel <= 0
  const pct = p ? (maxed ? 100 : Math.min(100, Math.round((p.xpIntoLevel / p.xpForNextLevel) * 100))) : 0

  return (
    <div className="help-overlay" onClick={onClose}>
      <div className="help-modal" onClick={(e) => e.stopPropagation()}>
        <div className="help-modal-head">
          <span className="side-panel-title">👤 {auth.username}</span>
          <button className="admin-close" onClick={onClose}>✕</button>
        </div>
        {!p ? (
          <p className="subtitle">Пока нет данных — сыграйте хотя бы один раунд онлайн</p>
        ) : (
          <>
            <div className="profile-rank">
              <RankBadge level={p.level} />
              <div className="profile-rank-text">
                <span className="hud-rank-level">Уровень {p.level}</span>
                <div className="hud-rank-bar profile-rank-bar">
                  <div className="hud-rank-bar-fill" style={{ width: `${pct}%` }} />
                </div>
                <span className="profile-rank-sub">
                  {maxed ? `Максимальный уровень · ${p.xp} XP всего` : `${p.xpIntoLevel} / ${p.xpForNextLevel} XP до следующего уровня`}
                </span>
              </div>
            </div>
            <div className="profile-stats-grid">
              <div className="profile-stat"><span className="profile-stat-value">{p.kills}</span><span className="profile-stat-label">Потоплено</span></div>
              <div className="profile-stat"><span className="profile-stat-value">{p.deaths}</span><span className="profile-stat-label">Потоплен сам</span></div>
              <div className="profile-stat"><span className="profile-stat-value">{p.wins}</span><span className="profile-stat-label">Побед</span></div>
              <div className="profile-stat"><span className="profile-stat-value">{p.losses}</span><span className="profile-stat-label">Поражений</span></div>
              <div className="profile-stat"><span className="profile-stat-value">{Math.round(p.accuracy * 100)}%</span><span className="profile-stat-label">Точность</span></div>
              <div className="profile-stat"><span className="profile-stat-value">{p.roundsPlayed}</span><span className="profile-stat-label">Раундов</span></div>
              <div className="profile-stat"><span className="profile-stat-value">{Math.floor(p.playTimeSeconds / 60)} мин</span><span className="profile-stat-label">В игре</span></div>
              <div className="profile-stat"><span className="profile-stat-value">{p.xp}</span><span className="profile-stat-label">Всего XP</span></div>
            </div>
            <p className="subtitle profile-updated">Обновлено: {formatLastSeen(p.updatedAt)}</p>
          </>
        )}
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
  voteTally,
  modeHud,
  matchEnd,
  roundBanner,
  bannerVisible,
  rank,
  levelUp,
  statBoost,
  onStart,
  onRestart,
  onVote,
}: HUDProps) {
  const [botCount, setBotCount] = useState(BOT_DEFAULT_COUNT)
  const [nickname, setNickname] = useState(() => localStorage.getItem(NICKNAME_LS_KEY) ?? '')
  /** Set once the player picks a mode — switches the menu to the settings step (local, or online
   * room creation); joining an existing online arena launches straight away, no step shown. */
  const [pendingMode, setPendingMode] = useState<'local' | 'online' | null>(null)
  const [gameModeId, setGameModeId] = useState(GAME_MODES[0].id)
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null)
  const [serverUnreachable, setServerUnreachable] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  /** Whether clicking "Играть онлайн" would create a fresh arena (server had 0 players at the
   * time of the click) — decides whether the mode/bots settings step is shown at all: joining an
   * in-progress or waiting arena just falls in, no point configuring something that's ignored. */
  const [onlineCreating, setOnlineCreating] = useState(false)
  const [onlineChecking, setOnlineChecking] = useState(false)
  /** This connection's pick for the next round's vote — reset once a new round actually starts. */
  const [voteGameModeId, setVoteGameModeId] = useState(GAME_MODES[0].id)
  const [voteBotCount, setVoteBotCount] = useState(BOT_DEFAULT_COUNT)
  const [voteCast, setVoteCast] = useState(false)
  const [auth, setAuth] = useState<StoredAuth | null>(() => getStoredAuth())
  const [authProfile, setAuthProfile] = useState<ProfileData | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    if (roundStatus?.phase === 'playing') setVoteCast(false)
  }, [roundStatus?.phase])

  // Resyncs from localStorage whenever we return to the menu — picks up a token dropped
  // mid-match (see MainScene: an authToken the server rejected clears storage directly, since
  // this component isn't mounted-away during a match to react to it any other way).
  useEffect(() => {
    if (started) return
    const stored = getStoredAuth()
    setAuth(stored)
    if (!stored) setAuthProfile(null)
  }, [started])

  // Refetch whenever we (re)gain an account, or when the profile modal is opened — cheap enough
  // (one GET) to just always refresh on open rather than cache stale rank/XP.
  useEffect(() => {
    if (!auth || (!profileOpen && authProfile)) return
    let cancelled = false
    fetchProfile(auth.token)
      .then((data) => { if (!cancelled) setAuthProfile(data) })
      .catch((e: unknown) => {
        if (cancelled) return
        setAuthProfile(null)
        // The token itself is dead server-side (not just a network blip) — drop it so the menu
        // stops claiming we're logged in while every request would keep silently 401ing.
        if (e instanceof UnauthorizedError) {
          clearStoredAuth()
          setAuth(null)
        }
      })
    return () => { cancelled = true }
  }, [auth, profileOpen])

  const handleLogout = () => {
    clearStoredAuth()
    setAuth(null)
    setAuthProfile(null)
  }

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
    const requestedMode = pendingMode === 'local' || (pendingMode === 'online' && onlineCreating) ? gameModeId : null
    onStart(pendingMode, botCount, auth?.username ?? nickname, requestedMode, auth?.token ?? null)
  }

  /** "Войти" both logs in and creates the account on the spot if `nickname` hasn't been used
   * before — see server/index.ts: handleLogin. Reuses the nickname field as the username, so
   * there's nothing to fill in beyond the password. */
  const handleLoginSubmit = () => {
    if (!nickname || !password || authBusy) return
    setAuthError(null)
    setAuthBusy(true)
    login(nickname, password)
      .then((next) => {
        setStoredAuth(next)
        setAuth(next)
        setAuthProfile(null)
        setPassword('')
      })
      .catch((e: unknown) => setAuthError(e instanceof Error ? e.message : 'Ошибка'))
      .finally(() => setAuthBusy(false))
  }

  /** Checks live server occupancy right before deciding whether "Играть онлайн" needs a
   * room-settings step — the last poll (every 5s) may be stale by the time the player clicks.
   * Joining an existing arena has nothing left to configure, so it launches immediately; only
   * creating a fresh (empty) arena shows the settings step first. */
  const handleOnlineClick = () => {
    setOnlineChecking(true)
    fetchServerStatus()
      .then((status) => {
        if (status.players === 0) {
          setOnlineCreating(true)
          setPendingMode('online')
        } else {
          onStart('online', botCount, auth?.username ?? nickname, null, auth?.token ?? null)
        }
      })
      .catch(() => {
        onStart('online', botCount, auth?.username ?? nickname, null, auth?.token ?? null)
      })
      .finally(() => setOnlineChecking(false))
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

  // Step 2 of 2 (local only): pick the game mode and bot count, then launch straight away.
  if (!started && pendingMode === 'local') {
    return (
      <div className="overlay pirate-bg">
        <div className="panel wizard-panel" key="settings">
          <StepHeader step={2} total={2} title="Настройте бой" onBack={() => setPendingMode(null)} />
          <GameModeAndBots
            gameModeId={gameModeId}
            onGameModeChange={setGameModeId}
            botCount={botCount}
            onBotCountChange={setBotCount}
          />
          <div className="menu-buttons">
            <button className="primary-btn primary-btn-big" onClick={handleLaunch}>В бой ⚓</button>
          </div>
        </div>
      </div>
    )
  }

  // Step 2 of 2 (online, room creation only): the server is empty, so this join creates the
  // arena — pick its mode/bot count, then launch. Joining an in-progress or waiting arena skips
  // this screen entirely (handleOnlineClick launches it directly) since any choice here would
  // just be ignored server-side.
  if (!started && pendingMode === 'online' && onlineCreating) {
    return (
      <div className="overlay pirate-bg">
        <div className="panel wizard-panel" key="online-settings">
          <StepHeader
            step={2}
            total={2}
            title="Создайте комнату"
            onBack={() => setPendingMode(null)}
          />
          <p className="subtitle">Сервер свободен — вы задаёте правила боя для всех, кто подключится следом</p>
          <GameModeAndBots
            gameModeId={gameModeId}
            onGameModeChange={setGameModeId}
            botCount={botCount}
            onBotCountChange={setBotCount}
          />
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

            {auth ? (
              <div className="account-bar">
                <div className="account-identity">
                  {authProfile?.profile && <RankBadge level={authProfile.profile.level} />}
                  <span className="account-name">{auth.username}</span>
                </div>
                <div className="account-actions">
                  <button className="secondary-btn account-btn" onClick={() => setProfileOpen(true)}>Профиль</button>
                  <button className="secondary-btn account-btn" onClick={handleLogout}>Выйти</button>
                </div>
              </div>
            ) : (
              <>
                <div className="account-fields">
                  <label className="start-field start-field-half">
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
                  <label className="start-field start-field-half">
                    <span className="start-field-label">Пароль</span>
                    <input
                      className="nickname-input nickname-input-big"
                      type="password"
                      maxLength={200}
                      placeholder="По желанию"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setAuthError(null) }}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleLoginSubmit() }}
                      disabled={serverUnreachable}
                    />
                  </label>
                </div>
                <p className="account-hint">Пароль — по желанию: сохранит ник, ранг и статистику за аккаунтом</p>
                {authError && <p className="auth-error">{authError}</p>}
                <button
                  className="secondary-btn secondary-btn-block account-login-btn"
                  disabled={serverUnreachable || authBusy || !nickname || !password}
                  onClick={handleLoginSubmit}
                >
                  {authBusy ? 'Подождите…' : '🔑 Войти'}
                </button>
              </>
            )}

            <div className="mode-cards">
              <button
                className="mode-card mode-card-online"
                disabled={serverUnreachable || serverStatus?.full || onlineChecking}
                onClick={handleOnlineClick}
              >
                <span className="mode-card-icon">🌐</span>
                <span className="mode-card-title">Играть онлайн</span>
                <span className="mode-card-desc">
                  {serverStatus && serverStatus.players === 0
                    ? 'Сервер свободен — вы создадите комнату и выберете правила'
                    : 'Живые соперники, общий рейтинг'}
                </span>
                <span className={`mode-card-status${serverUnreachable ? ' mode-card-status-offline' : ''}${serverStatus?.full ? ' mode-card-status-full' : ''}`}>
                  <span className="mode-card-dot" />
                  {serverUnreachable && 'Сервер недоступен'}
                  {!serverUnreachable && !serverStatus && 'Проверка сервера...'}
                  {!serverUnreachable && serverStatus && serverStatus.full && `Полон (${serverStatus.players}/${serverStatus.maxPlayers})`}
                  {!serverUnreachable && serverStatus && !serverStatus.full && serverStatus.players === 0 && 'Никого нет — предложите свой режим'}
                  {!serverUnreachable && serverStatus && !serverStatus.full && serverStatus.players > 0 && (
                    `${serverStatus.players}/${serverStatus.maxPlayers} игроков · ботов: ${serverStatus.bots} · режим: ${GAME_MODES.find((m) => m.id === serverStatus.gameMode)?.label ?? serverStatus.gameMode}`
                  )}
                </span>
              </button>

              <button
                className="mode-card mode-card-local"
                onClick={() => setPendingMode('local')}
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
                      <RankBadge level={entry.level} />
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
              <div className="leaderboard-empty">
                <span className="leaderboard-empty-icon">{serverUnreachable ? '📡' : '🏆'}</span>
                <p className="leaderboard-empty-text">
                  {serverUnreachable
                    ? 'Сервер недоступен — рейтинг появится, когда он будет в сети'
                    : !serverStatus
                      ? 'Загружаем рейтинг…'
                      : 'Пока никто не в топе — сыграйте первым и попадите в рейтинг!'}
                </p>
              </div>
            )}
          </div>
        </div>

        {helpModal}
        {profileOpen && auth && <ProfileModal auth={auth} profile={authProfile} onClose={() => setProfileOpen(false)} />}
      </div>
    )
  }

  if ((matchEnd || gameOver || victory) && bannerVisible && roundBanner) {
    return <RoundResultBanner banner={roundBanner} />
  }

  if (matchEnd) {
    return (
      <div className="overlay">
        <div className="panel">
          <h1>Раунд завершён</h1>
          <p className="subtitle">{matchEnd.reason}</p>
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
          <button className="primary-btn" onClick={onRestart}>Заново (R)</button>
        </div>
      </div>
    )
  }

  if (victory) {
    return (
      <div className="overlay">
        <div className="panel">
          <h1>🏆 Победа!</h1>
          <p className="subtitle">Все вражеские корабли потоплены</p>
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
        {rank && <RankWidget rank={rank} />}
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
        <span
          title="Скорость"
          key={statBoost?.type === 'speed' ? `speed-${statBoost.key}` : 'speed'}
          className={statBoost?.type === 'speed' ? 'hud-stat-pop' : undefined}
        >🪢 {stats.speed}</span>
        <span
          title="Урон"
          key={statBoost?.type === 'damage' ? `damage-${statBoost.key}` : 'damage'}
          className={statBoost?.type === 'damage' ? 'hud-stat-pop' : undefined}
        >💥 {stats.damage}</span>
        <span
          title="Броня"
          key={statBoost?.type === 'armor' ? `armor-${statBoost.key}` : 'armor'}
          className={statBoost?.type === 'armor' ? 'hud-stat-pop' : undefined}
        >🧱 {stats.armor}%</span>
        <span
          title="Перезарядка пушки"
          key={statBoost?.type === 'fireRate' ? `reload-${statBoost.key}` : 'reload'}
          className={statBoost?.type === 'fireRate' ? 'hud-stat-pop' : undefined}
        >🧑‍🔧 {stats.reloadSeconds}с</span>
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

      {levelUp !== null && (
        <div className="level-up-banner">
          <RankBadge level={levelUp} />
          <div className="level-up-text">
            <span className="level-up-title">Новый уровень!</span>
            <span className="level-up-sub">Вы достигли {levelUp} уровня</span>
          </div>
        </div>
      )}

      <EventLog log={log} />

      <div
        className="minimap-frame"
        style={{ width: MINIMAP_W, height: MINIMAP_H, right: MINIMAP_MARGIN, bottom: MINIMAP_MARGIN }}
      />

      {roundStatus && roundStatus.phase === 'ended' && bannerVisible && roundBanner && (
        <RoundResultBanner banner={roundBanner} />
      )}

      {roundStatus && roundStatus.phase === 'ended' && !(bannerVisible && roundBanner) && (
        <div className="overlay">
          <div className="panel wizard-panel round-end-panel">
            <h1>Раунд завершён</h1>
            <p className="subtitle">Новый раунд через {Math.ceil(roundStatus.timeRemaining)} с</p>

            <div className="wizard-section vote-section">
              <div className="wizard-section-label">🗳 Голосование за следующий раунд</div>
              <GameModeAndBots
                gameModeId={voteGameModeId}
                onGameModeChange={setVoteGameModeId}
                botCount={voteBotCount}
                onBotCountChange={setVoteBotCount}
              />
              <button
                className="primary-btn primary-btn-big"
                onClick={() => {
                  onVote(voteGameModeId, voteBotCount)
                  setVoteCast(true)
                }}
              >
                {voteCast ? 'Голос учтён ✓ (изменить)' : 'Проголосовать'}
              </button>
              {voteTally.length > 0 && (
                <div className="vote-tally">
                  {voteTally.map((t) => (
                    <div key={`${t.gameMode}:${t.botCount}`} className="vote-tally-row">
                      <span>{GAME_MODES.find((m) => m.id === t.gameMode)?.label ?? t.gameMode} · ботов: {t.botCount}</span>
                      <span className="vote-tally-count">{t.votes} 🗳</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
