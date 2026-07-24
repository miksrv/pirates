import type Phaser from 'phaser'
import { SFX } from '../../../shared/game/assetKeys'
import { PICKUP_DEFS } from '../../../shared/game/pickups'
import type { GameEvent } from '../../../shared/game/types'
import { spawnDamageNumber, spawnExplosionFx } from './fx'

/** Turns one frame of simulation events into sound, screen effects, and log lines. */
export function handleEvents(scene: Phaser.Scene, events: GameEvent[]): void {
  for (const ev of events) {
    if (ev.kind === 'shot') {
      scene.sound.play(SFX.shoot, { volume: 0.3 })
    } else if (ev.kind === 'impact') {
      spawnExplosionFx(scene, ev.pos, ev.lethal)
      scene.sound.play(ev.lethal ? SFX.explosion : SFX.hit, { volume: ev.lethal ? 0.55 : 0.2 })
      if (ev.lethal) scene.cameras.main.shake(140, 0.006)
    } else if (ev.kind === 'pickup') {
      scene.sound.play(SFX.pickup, { volume: 0.45 })
      const def = PICKUP_DEFS[ev.pickupType]
      scene.events.emit('log', { text: `${def.emoji} ${ev.shipName} подобрал: ${def.label}`, kind: 'pickup' })
    } else if (ev.kind === 'damage') {
      scene.events.emit('log', {
        text: `⚔️ ${ev.attackerName} → ${ev.targetName}: -${ev.amount} HP`,
        kind: 'damage',
      })
    } else if (ev.kind === 'kill') {
      scene.events.emit('log', { text: `💀 ${ev.attackerName} потопил ${ev.targetName}`, kind: 'kill' })
    } else if (ev.kind === 'shieldBlock') {
      scene.events.emit('log', { text: `🛡️ ${ev.shipName} заблокировал удар`, kind: 'shield' })
    } else if (ev.kind === 'playerJoined') {
      scene.events.emit('log', { text: `⚓ ${ev.shipName} вошёл в бой`, kind: 'info' })
    } else if (ev.kind === 'playerLeft') {
      scene.events.emit('log', { text: `🏳️ ${ev.shipName} покинул бой`, kind: 'info' })
    } else if (ev.kind === 'damageNumber') {
      spawnDamageNumber(scene, ev.pos, ev.amount)
    } else if (ev.kind === 'megaSpawned') {
      scene.sound.play(SFX.pickup, { volume: 0.6 })
      scene.cameras.main.flash(400, 90, 0, 80)
      scene.events.emit('log', {
        text: '🔱 ЯРОСТЬ ЛЕВИАФАНА поднялась из глубин! Ищите метку на миникарте',
        kind: 'mega',
      })
      scene.events.emit('mega-announce')
    }
  }
}
