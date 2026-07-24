import Phaser from 'phaser'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Stats } from '../game/stats'
import type { PerkType, PickupType } from '../game/types'
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

  const handleStart = useCallback((mode: 'local' | 'online', botCount: number, nickname: string, perk: PerkType) => {
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
      scene.events.on('net-error', (message: string) => setNetError(message))
      scene.events.on('mega-announce', () => {
        setMegaAnnounce(true)
        window.clearTimeout(megaTimerRef.current)
        megaTimerRef.current = window.setTimeout(() => setMegaAnnounce(false), 5000)
      })
      scene.events.on('restarted', () => {
        setGameOver(false)
        setStats(null)
        setLog([])
      })
      scene.events.on('log', (entry: { text: string; kind: LogEntryKind }) => {
        logIdRef.current += 1
        const id = logIdRef.current
        setLog((prev) => [...prev.slice(-(LOG_LIMIT - 1)), { id, ...entry }])
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

  useEffect(() => {
    return () => {
      window.clearTimeout(megaTimerRef.current)
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
        netError={netError}
        megaAnnounce={megaAnnounce}
        adminOpen={adminOpen}
        onAdminPickup={handleAdminPickup}
        onAdminClose={() => setAdminOpen(false)}
        stats={stats}
        log={log}
        onStart={handleStart}
        onRestart={handleRestart}
      />
    </div>
  )
}
