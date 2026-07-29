# Accounts & Auth

Optional. Server-only — no server (or a "play with bots" offline match) means no login UI at
all. Guest play (typed nickname, random localStorage id) still works exactly as before.

## Why
Without an account, stats/rank are keyed to a random id generated once in `localStorage`
(`client/src/net/playerId.ts`) — it doesn't follow you across browsers/devices, and (today, by
design elsewhere) a guest client can claim any id string, so nothing stops one guest from writing
into another guest's stats row. Logging in ties stats to a server-verified identity instead.

## Storage
- `server/data/stats.sqlite3`, new `users` table: `id`, `username` (unique, case-insensitive),
  `password_hash`, `password_salt`, `created_at`.
- Passwords are never stored or transmitted as-is beyond the one login request: hashed with
  Node's built-in `crypto.scryptSync` + a random per-user salt (`server/auth.ts`).
- The client's `localStorage` (`pirates.auth`) holds only `{ token, username }` — never the
  password.

## Username uniqueness
- Registered accounts: enforced twice — `users.username` has a `UNIQUE ... COLLATE NOCASE`
  constraint (case-insensitive), and `POST /login` checks `findUserByUsername` before creating a
  new account, catching the constraint violation as a race-condition backstop (two simultaneous
  first-time logins for the same name). Taken name + wrong password → 401 `неверный пароль`;
  taken name + right password → normal login, never a second account.
- Guests: a typed nickname that matches (case-insensitively) a *registered* account's username is
  rejected — falls back to the default "Игрок N" name, same as an empty/invalid nickname already
  does (`server/session.ts: handleJoin`). Stops an unauthenticated guest from impersonating a
  ranked player's display name in the leaderboard/ship tag. Two guests colliding with *each other*
  (no account involved either side) is unchanged — still allowed, as before.

## Session tokens
- Stateless, HMAC-SHA256 signed (`server/auth.ts`), no server-side session table. Payload:
  `{ userId, username, exp }`, base64url-encoded, `.`-joined with its signature.
- Signing secret: `AUTH_SECRET` env var if set (needed to share one secret across multiple server
  instances behind a load balancer). Otherwise, generated once and persisted to
  `server/data/auth-secret` (mode `0600`, and `server/data` is already gitignored) — a plain
  restart reuses it, so sessions now survive restarts without any configuration. Only a genuinely
  fresh environment (no `server/data` at all) or an explicit `AUTH_SECRET` rotation invalidates
  existing sessions.
- 30-day expiry. No way to revoke a single session early (e.g. "log out everywhere") — logging
  out client-side just clears `localStorage`; the token itself stays valid until it expires. Add
  a real `sessions` DB table later if that ever needs to change.
- No rate limiting on `/login` — fine for a hobby project, worth adding before this is public.

## Endpoints (same host:port as the WebSocket)
There's no separate registration step — login and signup are the same action from the player's
point of view, so there's only one endpoint for both.

| | |
|---|---|
| `POST /login` | `{ username, password }` → `{ token, username }`. First time a username is seen, creates the account with that password on the spot; every time after, the password has to match (401 `неверный пароль` otherwise) |
| `GET /profile` | `Authorization: Bearer <token>` → `{ username, profile }`; `profile` is `null` until the account has finished/left at least one online round |

Trade-off: because a fresh username always succeeds instantly while a taken one either logs you
in or says "wrong password", the response shape leaks whether a given username is registered —
accepted here for the simpler one-field UX; a real username-enumeration guard would need to bring
back a distinct register step.

## Join flow
- `JoinMsg.authToken` (optional). When it verifies (`server/session.ts: handleJoin`), the
  account's `userId`/`username` **replace** the client-supplied `playerId`/`name` outright — a
  logged-in ship's name is always the account username, not a freely-typed nickname.
- Invalid/missing token → falls back to today's guest behavior — but see below, this case is
  distinguished from "no token sent at all".
- Username rules double as ship-name rules: 3-16 chars, latin letters/digits/underscore — no
  further truncation needed anywhere names are displayed.

## Stale-token visibility
A token can still go bad without the player doing anything — it expires (30 days), the secret
gets rotated, or `server/data` is wiped/moved — and this is worth handling gracefully even though
a plain restart no longer does it (see persisted secret, above). `localStorage` would keep the
old token and the menu would still show the account bar, but the server treats every join as a
guest, so kills/rounds silently land in an anonymous DB row instead of the account's. Without the
below, the exact symptom is: "I played matches but my profile still says no data."

- `WelcomeMsg.authRejected` — true only when a join sent a non-empty `authToken` that failed
  verification (distinct from "no token sent", i.e. genuinely a guest). Only the original join
  re-checks this; a round-reset welcome always sends `false`.
- Client reaction (`MainScene.connectOnline`'s `onReady`): drops the stored token immediately
  (`clearStoredAuth()`) and posts a visible warning to the in-match event log, right as the match
  starts — the one place the player is guaranteed to be looking.
- `GET /profile` returning 401 (checked server-side by the same `AUTH_SECRET`) is handled the same
  way client-side (`UnauthorizedError` in `client/src/net/auth.ts`): drop the token, log out.
- The main menu re-reads `localStorage` every time it's shown (on returning from a match), so a
  token dropped for either reason above is reflected immediately — the account bar disappears and
  the guest nickname/password fields come back, prompting a fresh login.

## Client UI
- Main menu: logged in → username + rank badge + "Профиль"/"Выйти"; logged out → nickname field,
  a password field, and a single "Войти" button right there (no modal) — reuses the nickname as
  the username, so leaving the password blank just plays as a guest exactly like before.
- Profile modal: rank + XP progress bar, kills/deaths, wins/losses, accuracy, rounds played,
  total playtime, lifetime XP.
