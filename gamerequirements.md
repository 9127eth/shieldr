Create a complete 2D planet-defense game called "Shieldr" in Phaser 4 + TypeScript using the existing Vite setup (or create a fresh Phaser 4 Vite project if none exists). The final game must be a single-page web app that loads instantly with ZERO loading screens or heavy asset downloads.

**Competition compliance (critical):**
- Must run instantly in any modern browser with no login/signup.
- Add a simple one-time username modal (HTML overlay) on first launch: "Enter your Guardian Name" (default "StarWard", max 12 characters). Save to localStorage.
- Leaderboard must be purely client-side (localStorage only) — no external APIs or backends.
- Game must feel instantly playable the moment the page loads.
- Desktop only — no mobile or touch support.
- If localStorage is unavailable (e.g. private browsing), the game still runs but skips saving scores and uses "StarWard" as the default name with an unobtrusive notice.

**Core game concept:**
- Screen centered on a glowing planet (simple circle + rings sprite or graphics).
- "Precious core" health displayed on the planet (starts at 100, loses health when enemies reach it).
- Enemies spawn from the outer edges of the screen in waves and fly inward toward the planet.
- Player clicks the mouse to place a fixed-length force field wall. The direction/angle of the wall is determined by the mouse position relative to the planet center. Click = instant placement.
- Force field lasts 4–8 seconds (visual countdown fade), then disappears.
- No limit on the number of simultaneous force fields on screen.
- Any enemy that collides with a force field is instantly destroyed (particles + score). Enemies do NOT have hit points — one shield hit = one kill.
- Force fields also block and destroy incoming enemy projectiles.
- Force fields are free to place with no cooldown or resource cost.

**Enemy types:**
- **Drones (fast / low damage):** Small glowing triangles that zip toward the planet quickly. Deal 3 damage to the core on impact. Easy to intercept but dangerous in swarms.
- **Rockets (slow / heavy damage):** Larger pulsing wedge shapes that move slowly and deliberately. Deal 15 damage to the core on impact. Their size makes them easier to spot but missing one hurts badly.
- **Shooters (medium speed / ranged):** Introduced at Wave 5. Diamond-shaped enemies that stop at mid-range and fire small energy bolts at the planet (each bolt deals 5 damage). The shooter itself deals 8 damage if it reaches the core. Destroyed on contact with any force field.

All enemies are destroyed in a single force field collision — no health bars on enemies.

**Waves & progression:**
- Endless wave-based gameplay — there is no final wave. The game continues until the planet core is destroyed.
- **Wave 1–3:** Drones only. Start with 3 enemies, increasing by 2 each wave. Slow base speed.
- **Wave 4–6:** Mix of Drones and Rockets. 8–14 enemies per wave. Drones get 10% faster each wave.
- **Wave 7–10:** Shooters introduced. 12–20 enemies per wave. Rockets begin spawning in pairs.
- **Wave 11–15:** All three types. 18–28 enemies. Enemies spawn from tighter clusters and in trios. Shooter fire rate increases.
- **Wave 16–20:** 25–40 enemies. Drones move 2x original speed. Rockets spawn in pairs frequently. Shooters fire faster and stop closer to the planet.
- **Wave 21+:** Difficulty scales infinitely. Each wave adds +3 enemies, +5% enemy speed, and +1 damage to all enemy types. Spawning groups grow from pairs to quads to swarms of 6+.
- Enemies spawn from random positions along the screen edges. Early waves space spawns out; later waves overlap and cluster.
- Each wave ends when all enemies in that wave are destroyed or have impacted the core. A 3-second "WAVE CLEAR" pause separates waves.

**Upgrades (floating pickups):**
- No shop or purchasable upgrades.
- Between waves (during the 3-second pause) or occasionally mid-wave, upgrade orbs float slowly across the screen from a random edge.
- Player clicks an orb to collect it. Uncollected orbs drift off-screen and disappear.
- Upgrade types:
  - **Duration+**: Force fields last 3 seconds longer (stacks up to 3 times, max +9s).
  - **Width+**: Force fields become 25% wider/thicker (stacks up to 3 times).
  - **Reflective Shield**: Force fields bounce enemy projectiles back toward enemies instead of just absorbing them. One-time pickup.
  - **Core Repair**: Restores 15 HP to the planet core (does not stack, just heals).
  - **Shockwave**: Next force field placed triggers a radial pulse that destroys all enemies within a short radius. Single use, consumed on next placement.
- Orb spawn chance: ~40% between waves, ~10% chance mid-wave. Only one orb on screen at a time.
- Orbs glow with a distinct color per type (green = Duration, blue = Width, purple = Reflective, red = Core Repair, yellow = Shockwave).

**Controls:**
- Mouse only: click to place a fixed-length force field. The wall's angle is oriented based on the mouse position relative to the planet (perpendicular to the line from planet center to cursor).
- Space bar = emergency clear: instantly removes all active force fields from the screen (useful for repositioning strategy).
- ESC = pause the game (freezes all action, dims the screen, shows "PAUSED — click to resume").
- No mobile or touch support.

**Game modes:**
- **Practice:** Endless waves, no core damage, just experiment with force field placement. Upgrades still float in. Score is not recorded.
- **Normal:** Full campaign with waves, core health, scoring. Score is recorded to leaderboard.

**Scoring:**
- +50 per Drone destroyed.
- +75 per Shooter destroyed.
- +100 per Rocket destroyed.
- +200 bonus per wave cleared with zero core damage taken that wave ("Perfect Shield" flash on screen).
- No multipliers or combo system.
- Score accumulates across the entire run.

**Win & loss conditions:**
- **Game Over:** Core health reaches 0. The planet shatters (particle burst animation), screen darkens, "THE CORE HAS FALLEN" text with final score, highest wave reached, and a "Try Again" button.
- **No win state:** The game is endless. Survival is the goal. The Game Over screen shows how far the player got.

**Leaderboard:**
- Only Normal mode records scores.
- On Game Over, save the run to localStorage under the player's Guardian Name (keep the best score per name).
- Leaderboard button (accessible from top bar and Game Over screen) shows a clean table: Rank | Guardian Name | Highest Wave | Score, sorted by score descending.
- Include 4 hardcoded demo entries so the board never looks empty on first play (e.g., "Orion" Wave 14 / 4200, "Nova" Wave 11 / 3100, "Cosmo" Wave 8 / 1800, "Pixel" Wave 5 / 900).
- Show current wave and personal best on the HUD at all times.

**UI (lightweight HTML overlay + Phaser UI):**
- **Main Menu:** Game title "SHIELDR" with glowing neon text, subtitle "Protect the Core", three buttons: Normal, Practice, Leaderboard. Planet slowly rotates in the background.
- **HUD top bar:** Wave number | Score | Core Health (glowing HP bar that shifts green → yellow → red) | Guardian Name | Leaderboard button.
- **First-play tooltip:** "Click anywhere to place a force field — protect the Core!" (dismisses after first placement).
- **Pause overlay:** Dim screen + "PAUSED" text + "Click to resume".
- **Game Over screen:** Planet shatter animation, "THE CORE HAS FALLEN", stats (Score, Wave, Personal Best), "Try Again" and "Main Menu" buttons.
- **Wave clear banner:** Brief "WAVE 12 CLEAR" text that fades in and out over the 3-second inter-wave pause.
- Full-screen responsive canvas (desktop aspect ratios only).

**Audio & feedback:**
- All audio generated procedurally or via simple Web Audio API tones — no audio file downloads.
- **Force field placed:** Short bright "zap" tone.
- **Enemy destroyed:** Crunchy pop/burst sound.
- **Core hit:** Deep thud + brief red screen flash + subtle screen shake.
- **Wave clear:** Rising chime.
- **Upgrade collected:** Sparkle/power-up tone.
- **Background:** Low ambient hum that increases in intensity with wave number (optional, subtle).
- Volume toggle on the main menu (on/off, default on).

**Performance & polish:**
- Keep bundle tiny: use built-in Phaser shapes, particles, and arcade physics (no heavy assets).
- Satisfying feedback: force field placement glow, particle explosions on enemy death, screen shake on core hits.
- 60 fps target, clean modular code (separate scenes for Menu, Game, GameOver).
- Enemies that reach the core trigger a brief impact flash on the planet before their damage is applied.

Build the full game on top of the Phaser 4 Vite template. Make placing force fields feel snappy and powerful, the inward-spawning enemies create constant pressure, and clearing a wave with a perfect ring of shields should feel amazing. This should look and play like nothing else in the hackathon.
