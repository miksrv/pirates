const PLAYER_ID_KEY = 'pirates.playerId'

/** Persistent per-browser identity so the server can tell apart players sharing a nickname.
 * Generated once and kept in localStorage — clearing storage starts a fresh stats history. */
export function getPlayerId(): string {
  let id = localStorage.getItem(PLAYER_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(PLAYER_ID_KEY, id)
  }
  return id
}
