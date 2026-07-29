import Phaser from 'phaser'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { RankProgress } from '../../../shared/game/rank'
import type { Stats } from '../../../shared/game/stats'
import type { PerkType, PickupType } from '../../../shared/game/types'
import { getGameMode, type ModeHudState, type EndResult } from '../../../shared/game/modes'
import type { LeaderboardEntry, RoundStatus, VoteTallyEntry } from '../../../shared/net/protocol'
import type { VictoryData } from './victoryData'
import { defaultServerUrl } from '../net/config'
import { MainScene, type LaunchConfig } from '../phaser/MainScene'
import HUD from './HUD'
import type { LogEntry, LogEntryKind } from './logEntry'

const LOG_LIMIT = 30

export default function PhaserGame() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const gameRef = useRef<Phaser.Game | null>(null)
  const sceneRef = useRef<MainScene | null>(null)
  const logIdRef = useRef(0)

  const [started, setStarted] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [netError, setNetError] = useState<string | null>(null)
  const [megaAnnounce, setMegaAnnounce] = useState(false)
  const megaTimerRef = useRef<number | undefined>(undefined)
  const [mode, setMode] = useState<'local' | 'online' | null>(null)
  const [adminOpen, setAdminOpen] = useState(false)
  const [stats, setStats] = useState<Stats | null>(null)
  const [log, setLog] = useState<LogEntry[]>([])
  const [roundStatus, setRoundStatus] = useState<RoundStatus | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [voteTally, setVoteTally] = useState<VoteTallyEntry[]>([])
  const [victory, setVictory] = useState<VictoryData | null>(null)
  const [modeHud, setModeHud] = useState<ModeHudState | null>(null)
  const [matchEnd, setMatchEnd] = useState<EndResult | null>(null)
  const [rank, setRank] = useState<RankProgress | null>(null)
  const [levelUp, setLevelUp] = useState<number | null>(null)
  const levelUpTimerRef = useRef<number | undefined>(undefined)
  const [statBoost, setStatBoost] = useState<{ type: PickupType; key: number } | null>(null)
  const statBoostIdRef = useRef(0)
  const statBoostTimerRef = useRef<number | undefined>(undefined)

  const handleStart = useCallback((
    mode: 'local' | 'online',
    botCount: number,
    nickname: string,
    perk: PerkType,
    gameModeId: string | null,
    authToken: string | null,
  ) => {
    if (gameRef.current) return

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: containerRef.current!,
      backgroundColor: '#12161f',
      disableContextMenu: true,
      scale: {
        mode: Phaser.Scale.RESIZE,
        width: window.innerWidth,
        height: window.innerHeight,
      },
      scene: [MainScene],
    })
    const launch: LaunchConfig = {
      mode,
      botCount,
      serverUrl: defaultServerUrl(),
      nickname: nickname.trim() || undefined,
      perk,
      gameMode: gameModeId ? getGameMode(gameModeId) ?? null : null,
      authToken,
    }
    game.registry.set('launch', launch)
    gameRef.current = game
    if (import.meta.env.DEV) (window as unknown as { __game: Phaser.Game }).__game = game

    game.events.once(Phaser.Core.Events.READY, () => {
      const scene = game.scene.getScene('main') as MainScene
      sceneRef.current = scene

      // A lost WebGL context renders as a permanent black canvas while the React HUD keeps
      // working — surface it instead of leaving the player staring into the void.
      game.canvas.addEventListener('webglcontextlost', () =>
        setNetError('Сбой графики (WebGL context lost) — перезагрузите страницу'),
      )

      scene.events.on('stats', (next: Stats) => setStats(next))
      scene.events.on('game-over', () => setGameOver(true))
      scene.events.on('victory', (data: VictoryData) => setVictory(data))
      scene.events.on('net-error', (message: string) => setNetError(message))
      scene.events.on('mega-announce', () => {
        setMegaAnnounce(true)
        window.clearTimeout(megaTimerRef.current)
        megaTimerRef.current = window.setTimeout(() => setMegaAnnounce(false), 5000)
      })
      scene.events.on('restarted', () => {
        setGameOver(false)
        setVictory(null)
        setStats(null)
        setLog([])
        setRoundStatus(null)
        setLeaderboard([])
        setVoteTally([])
        setModeHud(null)
        setMatchEnd(null)
        setStatBoost(null)
      })
      scene.events.on('log', (entry: { text: string; kind: LogEntryKind }) => {
        logIdRef.current += 1
        const id = logIdRef.current
        setLog((prev) => [...prev.slice(-(LOG_LIMIT - 1)), { id, ...entry }])
      })
      scene.events.on(
        'round-status',
        ({ round, leaderboard, voteTally }: { round: RoundStatus; leaderboard: LeaderboardEntry[]; voteTally: VoteTallyEntry[] }) => {
          setRoundStatus(round)
          setLeaderboard(leaderboard)
          setVoteTally(voteTally)
        },
      )
      scene.events.on('mode-hud', (state: ModeHudState | null) => setModeHud(state))
      scene.events.on('match-end', (result: EndResult) => setMatchEnd(result))
      scene.events.on('rank', (r: RankProgress | null) => setRank(r))
      scene.events.on('level-up', (level: number) => {
        setLevelUp(level)
        window.clearTimeout(levelUpTimerRef.current)
        levelUpTimerRef.current = window.setTimeout(() => setLevelUp(null), 5000)
      })
      scene.events.on('stat-boost', (type: PickupType) => {
        statBoostIdRef.current += 1
        setStatBoost({ type, key: statBoostIdRef.current })
        window.clearTimeout(statBoostTimerRef.current)
        statBoostTimerRef.current = window.setTimeout(() => setStatBoost(null), 800)
      })
    })

    setMode(mode)
    setStarted(true)
  }, [])

  // iddqd: opens the debug panel, and only ever in single-player — an online match is run by
  // the server, so handing yourself pickups there would be cheating rather than testing.
  useEffect(() => {
    if (mode !== 'local') return

    let typed = ''
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.length !== 1) return
      typed = (typed + e.key.toLowerCase()).slice(-8)
      if (typed.endsWith('iddqd')) {
        typed = ''
        setAdminOpen((open) => !open)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mode])

  const handleAdminPickup = useCallback((type: PickupType) => {
    sceneRef.current?.grantDebugPickup(type)
  }, [])

  const handleRestart = useCallback(() => {
    sceneRef.current?.restart()
  }, [])

  const handleVote = useCallback((gameModeId: string, botCount: number) => {
    sceneRef.current?.castVote(gameModeId, botCount)
  }, [])

  useEffect(() => {
    return () => {
      window.clearTimeout(megaTimerRef.current)
      window.clearTimeout(levelUpTimerRef.current)
      window.clearTimeout(statBoostTimerRef.current)
      gameRef.current?.destroy(true)
      gameRef.current = null
    }
  }, [])

  return (
    <div className="game-wrap">
      <div ref={containerRef} className="game-canvas" />
      <HUD
        started={started}
        gameOver={gameOver}
        victory={victory}
        netError={netError}
        megaAnnounce={megaAnnounce}
        adminOpen={adminOpen}
        onAdminPickup={handleAdminPickup}
        onAdminClose={() => setAdminOpen(false)}
        stats={stats}
        log={log}
        roundStatus={roundStatus}
        leaderboard={leaderboard}
        voteTally={voteTally}
        modeHud={modeHud}
        matchEnd={matchEnd}
        rank={rank}
        levelUp={levelUp}
        statBoost={statBoost}
        onStart={handleStart}
        onRestart={handleRestart}
        onVote={handleVote}
      />
    </div>
  )
}
