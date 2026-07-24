import Phaser from 'phaser'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Stats } from '../game/stats'
import type { PerkType } from '../game/types'
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

    setStarted(true)
  }, [])

  const handleRestart = useCallback(() => {
    sceneRef.current?.restart()
  }, [])

  useEffect(() => {
    return () => {
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
        stats={stats}
        log={log}
        onStart={handleStart}
        onRestart={handleRestart}
      />
    </div>
  )
}
