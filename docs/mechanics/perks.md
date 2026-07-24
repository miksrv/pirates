# Perks (pre-match loadout)

Source: `src/game/perks.ts` · Chosen on the "Выберите перк" screen after picking Играть / Multi Player.

- ⛵ **Быстрые паруса** — +25% speed (187.5 → 234)
- ⏱️ **Скорая перезарядка** — +25% reload speed (3s → 2.4s)
- 💣 **Тяжёлые ядра** — +25% damage (14 → 17.5)

## Rules
- Exactly one perk per player, applied on top of base stats at spawn; stacks with pickups, still bound by the usual caps.
- **Kept on respawn** in multiplayer (pickup upgrades are not) — it's your loadout, not loot.
- Last choice is remembered in localStorage (`pirates.perk`).
- Multiplayer: sent with the join message and validated server-side; an unknown value falls back to no perk.
- Bots don't get perks.
