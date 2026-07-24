export interface Vec2 {
  x: number
  y: number
}

export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y })
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y })
export const scale = (a: Vec2, s: number): Vec2 => ({ x: a.x * s, y: a.y * s })
export const length = (a: Vec2): number => Math.hypot(a.x, a.y)
export const distance = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y)

export function normalize(a: Vec2): Vec2 {
  const len = length(a)
  if (len < 1e-6) return { x: 0, y: 0 }
  return { x: a.x / len, y: a.y / len }
}

export function fromAngle(angle: number): Vec2 {
  return { x: Math.cos(angle), y: Math.sin(angle) }
}

export function angleOf(a: Vec2): number {
  return Math.atan2(a.y, a.x)
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

/** Shortest signed difference between two angles, result in [-PI, PI]. */
export function angleDiff(target: number, current: number): number {
  let diff = (target - current) % (Math.PI * 2)
  if (diff > Math.PI) diff -= Math.PI * 2
  if (diff < -Math.PI) diff += Math.PI * 2
  return diff
}

export function moveAngleTowards(current: number, target: number, maxDelta: number): number {
  const diff = angleDiff(target, current)
  if (Math.abs(diff) <= maxDelta) return target
  return current + Math.sign(diff) * maxDelta
}
