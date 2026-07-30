/**
 * Server endpoint resolution:
 * - VITE_SERVER_URL env override wins (e.g. VITE_SERVER_URL=ws://192.168.1.5:8081 npm run dev)
 * - dev builds default to a locally running server (`npm run server`)
 * - production builds default to the hosted service
 */
export function defaultServerUrl(): string {
  const override = import.meta.env.VITE_SERVER_URL as string | undefined
  if (override) return override
  if (import.meta.env.DEV) return 'ws://localhost:8081'
  return 'wss://pirates.miksoft.pro/ws'
}
