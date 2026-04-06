Create a complete 2D planet-defense game called "Shieldr" in Phaser 4 + TypeScript using the existing Vite setup (or create a fresh Phaser 4 Vite project if none exists). The final game must be a single-page web app that loads instantly with ZERO loading screens or heavy asset downloads.

**Competition compliance (critical):**
- Must run instantly in any modern browser with no login/signup.
- Add a simple one-time username modal (HTML overlay) on first launch: "Enter your Guardian Name" (default "StarWard", max 12 characters). Save to localStorage.
- Leaderboard must be purely client-side (localStorage only) — no external APIs or backends.
- Game must feel instantly playable the moment the page loads.
- Desktop only — no mobile or touch support.
- If a mobile or touch device is detected (small viewport or `navigator.maxTouchPoints > 0`), don't load the game. Instead show a friendly full-screen message: "Shieldr is a desktop experience — grab a mouse and a bigger screen to defend the Core! Mobile coming soon." styled to match the game's neon aesthetic.
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

---

## Game Improvements Part 1

> The sections below extend and override parts of the base spec above. Where a new rule conflicts with the base spec (e.g. scoring multipliers override "No multipliers or combo system"), the improvement takes precedence.

---

### Scoring Improvements

**Multi-Kill Bonus (overrides "No multipliers or combo system"):**
- Track how many enemies each individual shield destroys before it expires.
- If a single shield destroys 3+ enemies, apply a score multiplier to all kills on that shield:
  - 3–4 kills on one shield → x1.5 multiplier on those kills' points.
  - 5–7 kills on one shield → x2 multiplier.
  - 8+ kills on one shield → x3 multiplier.
- Display a brief "MULTI-KILL x3!" floating text at the shield's position when it expires (only for 3+ kills). Color-coded: white for x1.5, gold for x2, red for x3.
- Multi-kills of 5+ also earn a roulette item (see Item Roulette System below).

**Close Call Bonus:**
- +150 bonus points for destroying an enemy within a short radius of the core (roughly 1.5x the planet's visual radius from center).
- Display "CLOSE CALL!" in orange text near the kill location.

**Last Second Bonus:**
- +100 bonus points for blocking an enemy projectile (from Shooters) that is within a short distance of the core surface.
- Display "LAST SECOND!" text. Can trigger alongside Close Call if both conditions are met (they stack).

**Perfect Shield Streak:**
- Track consecutive waves cleared with zero core damage (consecutive "Perfect Shield" waves).
- Display a visible streak counter on the HUD (a small flame icon with a number, next to the wave counter).
- Each consecutive Perfect Shield wave grants a cumulative +0.5 second buff to all shield duration (stacks additively). Example: 4-wave streak = +2s duration on all shields.
- Any core damage instantly resets the streak counter to 0 and removes the duration buff.
- The streak counter persists visually even at 0 so the player always knows the system exists.

---

### New Enemy Types

These are added to the existing Drone / Rocket / Shooter roster. All new enemies are still destroyed in a single shield collision unless stated otherwise.

**Splitter (introduced at Wave 9):**
- Visual: A larger hexagonal shape, glowing green, slightly pulsing. Noticeably bigger than Drones.
- Speed: Medium (between Drone and Rocket speed).
- Damage: 10 to the core on direct impact.
- Split mechanic: When a Splitter collides with a shield **far from the core** (outer 60% of the screen radius from center), it is destroyed but splits into 2–3 fast mini-drones that scatter in random outward-angled directions before curving back toward the core. Mini-drones deal 2 damage each and move at 1.5x normal Drone speed.
- Clean kill: When a Splitter collides with a shield **near the core** (inner 40% of the screen radius), it dies cleanly with no split. Particle burst + normal score.
- Score: +75 for the Splitter itself. Mini-drones award +25 each if destroyed.
- Strategic implication: Players must decide — intercept early (safe but spawns fragments) or let them get dangerously close for a clean kill (risky but simpler).

**Phaser (introduced at Wave 12):**
- Visual: An octagonal shape that flickers between fully visible (bright white/cyan glow) and invisible (completely transparent, no hitbox).
- Speed: Medium-slow (similar to Rockets but smaller).
- Damage: 10 to the core on impact.
- Flicker cycle: Alternates between 0.8s visible and 0.8s invisible. The cycle is consistent and not random.
- Interaction with shields: Can ONLY be destroyed by a shield while in the visible phase. If invisible, it passes through shields harmlessly.
- Visual telegraph: During the invisible phase, a faint ghost outline (10% opacity) shows the Phaser's position so the player can track it and time their shield placement.
- Score: +100 per Phaser destroyed.

**Shield Breaker (introduced at Wave 14):**
- Visual: A large, angular, armored-looking wedge shape with a distinct bright red outline and a pulsing inner glow. Should look heavy and threatening.
- Speed: Slow (75% of Rocket speed).
- Damage: 20 to the core on impact.
- Shield interaction: On first contact with a shield, the Shield Breaker **destroys that shield** instead of dying. The shield shatters with a unique red particle burst. The Shield Breaker takes visible damage (its outer armor cracks / red glow dims) and continues toward the core. On second contact with any shield, it is destroyed normally with a large explosion.
- Score: +200 per Shield Breaker destroyed.
- Strategic implication: Players must layer two shields in its path. Forces forward planning and shield positioning.

---

### Shield Mechanics

**Overcharge:**
- When a single shield destroys 5 or more enemies before it expires, it detonates on expiration instead of fading out.
- The detonation is a radial blast centered on the shield's position. Radius: roughly 1.5x the shield's own length.
- Any enemy caught in the blast radius is instantly destroyed (particles + score). These kills count toward scoring but do NOT count as another multi-kill for that shield.
- Visual: The shield glows brighter as its kill count increases (subtle glow at 3 kills, strong pulsing glow at 5+). On detonation, a bright expanding ring + particle burst.
- Audio: A satisfying "boom" tone on detonation, distinct from normal enemy-destroy sounds.

**Shield Interference (overlap-based degradation):**
- When two or more active shields overlap each other by more than 30% of their length, all overlapping shields lose duration faster — they decay at 1.5x normal speed for each additional overlapping shield.
- Example: Two shields overlapping 40% both decay at 1.5x speed. Three shields stacked on top of each other decay at 2x speed each.
- Visual indicator: Overlapping shields flicker/strobe slightly to signal the interference. The flicker intensity increases with more overlap.
- Non-overlapping shields placed in the same general area are unaffected. The mechanic only triggers on actual geometric overlap of the shield line segments (plus their width/thickness).
- This prevents the "wall off one direction with 20 stacked shields" strategy and forces the player to space shields out for proper coverage.

**Spawn Telegraphs:**
- 1.5 seconds before each wave's enemies begin appearing, show faint glowing directional markers on the screen edges indicating where enemies will spawn.
- Early waves (1–10): Show precise spawn positions as small glowing dots on the screen edge.
- Later waves (11+): Show only general sector indicators (a soft glow along a section of the screen edge) rather than exact positions.
- Wave 21+: Telegraphs become very faint and only flash for 0.75 seconds instead of 1.5.
- The telegraphs use a neutral color (dim white/gray) so they don't conflict with enemy or upgrade orb colors.

---

### Item Roulette System

> This system replaces the "Core Repair" and "Shockwave" entries from the base Upgrades section. Those two items move into the roulette pool below as "Core Surge" and "Nova Burst." The remaining passive upgrades (Duration+, Width+, Reflective Shield) stay as colored orb pickups with their existing behavior.

**Item Queue (2 slots):**
- The player has a 2-slot item queue displayed on the HUD (bottom-center of the screen, horizontal layout).
- **Slot 1** is the "ready" slot — right-click fires this item.
- **Slot 2** is the "on deck" slot — when Slot 1 is used, Slot 2 automatically slides into Slot 1 with a quick shift animation.
- Empty slots show a dim outline. Filled slots show the item's icon glowing in its signature color.
- When both slots are full and the player earns or collects an item, the item is **lost**. A brief "QUEUE FULL" text flashes in a dim warning color on the HUD with a dull buzz tone. This teaches the player to use items proactively rather than hoarding.

**Acquisition — Two Paths:**

1. **Item Boxes (one per wave max):**
   - A glowing question-mark orb (white with a rainbow shimmer) spawns during or between waves. Spawns from a random screen edge and drifts slowly across the screen, same movement as upgrade orbs.
   - Spawn rules: No item boxes in Waves 1–3. ~60% chance per wave starting at Wave 4. Maximum one item box on screen at a time. Item boxes and passive upgrade orbs can coexist on screen.
   - Player clicks the item box to collect it. If the player's queue is full, clicking the box does nothing — the box continues drifting and eventually leaves the screen.
   - On collection, a roulette animation spins in the next empty queue slot for ~1.5 seconds, then lands on a result. The game does NOT pause during the roulette — enemies keep moving.

2. **Earned Through Gameplay:**
   - **Multi-kill (5+ enemies on one shield):** Automatically triggers a roulette spin into the next empty queue slot. If the queue is full, display "QUEUE FULL" and the reward is lost.
   - **Perfect Shield wave:** Completing a wave with zero core damage triggers a roulette spin into the next empty queue slot. Same full-queue rule applies.
   - Display "ITEM EARNED!" text briefly on screen when a gameplay trigger fires.

**Activation:**
- Right-click to use the item in Slot 1. Placement items (Gravity Field, Star Bomb) activate at the cursor's current position. Global effect items (Time Bender, Health Surge, Time Freeze, Sanctuary, Cardinal Rift) activate instantly regardless of cursor position.
- First-time tutorial text on first item earned: "Right-click to use item" (dismisses after first use).

**Item Pool:**

| Item | Icon Color | Effect | Details |
|---|---|---|---|
| **Gravity field** | Cyan | Place at cursor position. Pulls all enemies within a medium radius toward the well's center for 3 seconds. | Does not damage enemies. Risk: pulls enemies closer to the core if placed poorly. Reward: clumps enemies for a massive multi-kill shield placement. Visual: swirling vortex particles. |
| **Time Bender** | White | All enemies on screen slow to 30% speed for 4 seconds. | Global effect, no placement. Shields function normally. Visual: brief screen-wide ripple, enemies trail afterimages while slowed. |
| **Health Surge** | Red | Instantly restores 20 HP to the planet core (capped at 100). | Global effect. Visual: healing pulse radiates outward from the planet. Audio: warm rising chime. |
| **Star bomb** | Yellow | The next shield the player places detonates on placement with a large radial blast. | Consumed on next left-click shield placement. Blast radius ~3x a normal shield's length. Destroys all enemies in the blast zone. Visual: massive bright explosion ring. The placed shield still exists normally after the blast. |
| **Time Freeze** | Purple | All enemies freeze in place for 2.5 seconds. | Global effect. Frozen enemies can still be destroyed by shields. Projectiles already in flight also freeze mid-air. Visual: enemies gain a crystalline/frozen overlay. |
| **Sanctuary** | Gold | The planet core becomes invulnerable for 4 seconds. Any enemy or projectile that hits the core during Sanctuary deals zero damage. | Global effect. Enemies that reach the core during Sanctuary are still destroyed (particles + score awarded) but inflict no damage. Visual: a bright golden dome/bubble surrounds the planet, pulsing gently. A visible countdown ring around the dome shrinks as the duration ticks down. Audio: a warm, resonant hum while active, ending with a soft chime when it expires. Strategic use: pop this when overwhelmed from multiple directions and you can't cover everything — buys time to clean up without losing HP. |
| **Cardinal Rift** | Magenta | All enemies on screen are instantly warped to the nearest cardinal axis (directly north, south, east, or west of the core). | Global effect. Each enemy snaps to whichever cardinal direction (N/S/E/W) it is closest to, repositioning onto that axis line while keeping its current distance from the core. Enemies resume moving toward the core from their new position immediately after the warp. Visual: a brief magenta cross/compass flash over the screen, enemies streak toward their new axis with a short motion trail. Audio: a sharp "whoosh-snap" tone. Strategic use: consolidates scattered enemies into 4 predictable lanes, making them far easier to block with well-placed shields. Pairs powerfully with Gravity Field (clump a lane) or Star Bomb (blast an entire lane). |

**Weighted Randomness:**
- The roulette is not purely random. Weight probabilities based on game state:
  - Core HP below 30% → Health Surge and Sanctuary probability increases significantly (~30% combined).
  - Core HP above 80% → Health Surge probability drops to near zero (~3%). Sanctuary stays at normal weight.
  - 15+ enemies currently on screen → Gravity Field, Star Bomb, and Cardinal Rift are more likely.
  - Fewer than 5 enemies on screen → Time Bender and Time Freeze are less likely.
  - Enemies spread across 3+ screen quadrants → Cardinal Rift probability increases (it's most useful when enemies are scattered).
- The player does not see the weighting. It should feel subtly helpful, not obviously rigged.

**Audio & Feedback:**
- Item box collected: Distinct "ding" tone followed by the roulette spin sound (rapid ticking that slows down).
- Roulette lands: Satisfying confirmation chime + the item icon in the queue slot pulses once.
- Item used: Each item has a unique activation sound (Gravity Field = deep whoosh, Time Bender = slow-motion "stretch" tone, Health Surge = warm pulse, Star Bomb = heavy detonation, Time Freeze = crystalline snap, Sanctuary = resonant golden hum, Cardinal Rift = sharp whoosh-snap).
- "QUEUE FULL" warning: Dull buzz tone.

---

### Passive Upgrades (revised)

> Core Repair and Shockwave are removed from the passive orb pool (they are now Core Surge and Nova Burst in the Item Roulette System). The remaining passive upgrades function as permanent run buffs.

- **Duration+** (green orb): Force fields last 3 seconds longer. Stacks up to 3 times (max +9s). Permanent for the run.
- **Width+** (blue orb): Force fields become 25% wider/thicker. Stacks up to 3 times. Permanent for the run.
- **Reflective Shield** (purple orb): Force fields bounce enemy projectiles back toward enemies instead of absorbing them. One-time pickup, permanent for the run.

**Upgrade Choice (select waves):**
- On approximately every 3rd upgrade orb spawn, show 2 orbs side by side drifting across the screen instead of 1. The player clicks one to collect it; the other fades away.
- Example pairings: Duration+ vs Width+, Reflective Shield vs Duration+, etc. Pairing is random from the available pool (excluding upgrades already at max stacks).
- This gives the player ownership over their build and makes runs feel different from each other.

Orb spawn chance remains ~40% between waves, ~10% mid-wave. Only one orb spawn event at a time (either 1 orb or a 2-orb choice). Passive orbs and item boxes can be on screen simultaneously.

---

### Mini-Boss Waves

Every 10 waves (Wave 10, 20, 30, etc.), a mini-boss spawns alongside the normal wave enemies.

**Carrier (first appears Wave 10):**
- Visual: A large rotating diamond shape, 3–4x the size of a normal enemy, with a distinct orange glow and visible "hangar" slots.
- Speed: Very slow (50% of Rocket speed). Moves toward the core.
- Damage: 25 on core impact.
- Behavior: Every 3 seconds, the Carrier spawns 1–2 Drones from its body that fly toward the core independently. The Carrier continues spawning Drones until destroyed.
- Shield interaction: Each shield hit stops the Carrier's Drone spawning for 2 seconds and deals visible damage (cracks appear). The Carrier requires **3 shield hits** to destroy. Each hit triggers a brief stagger animation.
- Score: +500 per Carrier destroyed.
- Max spawned Drones capped at 8 to prevent performance issues.

**Siege Unit (first appears Wave 20):**
- Visual: A large crescent/arc shape with a glowing turret, teal-colored. Imposing and distinct.
- Speed: Slow. Does NOT move toward the core. Instead, it enters from a screen edge and begins **orbiting the planet** at mid-range distance.
- Behavior: While orbiting, it fires an arc of 3 energy bolts every 2.5 seconds aimed at the core (each bolt deals 5 damage). It completes one full orbit in ~12 seconds, then moves slightly closer to the core and orbits again.
- Shield interaction: Destroyed in a single shield hit like normal enemies. The challenge is that it orbits at mid-range, requiring the player to place shields further out than usual at a moving position.
- If the Siege Unit reaches the core (after multiple orbits shrinking inward): 30 damage on impact.
- Score: +400 per Siege Unit destroyed.

Mini-bosses do not replace normal wave enemies — they spawn in addition to them. Later mini-boss waves (Wave 30+) can spawn both a Carrier and a Siege Unit simultaneously.

---

### Run Statistics (Game Over Screen)

On the Game Over screen, display the following stats below the main score and wave info:

- **Total Shields Placed** — total left-clicks during the run.
- **Best Multi-Kill** — highest number of enemies destroyed by a single shield.
- **Longest Perfect Streak** — most consecutive Perfect Shield waves.
- **Favorite Sector** — divide the screen into 4 quadrants (NE, NW, SE, SW). Show which quadrant the player placed the most shields in. Display as a label like "Northeast Guardian."
- **Items Used** — total roulette items activated during the run.
- **Close Calls** — total Close Call bonuses earned.
- **Shields Per Wave** — average number of shields placed per wave (Total Shields Placed ÷ Highest Wave reached, rounded to one decimal). Gives competitive players a self-optimization metric for shield efficiency without imposing any in-game penalty.

---

### Personal Milestones & Titles

Track lifetime stats across all runs in localStorage:

- Total enemies destroyed (all-time).
- Total shields placed (all-time).
- Highest wave reached (all-time).
- Highest Perfect Shield streak (all-time).

**Titles:** Based on the player's best single-run highest wave, display a rank title next to their Guardian Name on the HUD and leaderboard:

| Highest Wave | Title |
|---|---|
| Wave 5 | Watcher |
| Wave 10 | Defender |
| Wave 15 | Guardian |
| Wave 20 | Sentinel |
| Wave 25 | Warden |
| Wave 30 | Archon |
| Wave 40 | Overlord |
| Wave 50+ | Eternal |

- When the player reaches a new title tier for the first time during a run, display a brief full-width banner: "RANK ACHIEVED: SENTINEL" with a dramatic chime.
- The title is stored in localStorage alongside the Guardian Name and updates if a higher tier is reached.
- The leaderboard table adds a "Title" column: Rank | Guardian Name | Title | Highest Wave | Score.

---

### Controls (updated)

> Extends the base Controls section.

- **Left-click:** Place a force field (unchanged).
- **Right-click:** Activate the item in Slot 1 of the item queue. If the item requires placement (Gravity Well, Nova Burst), it activates at the cursor position. If the item is a global effect (Time Fracture, Core Surge, Phase Lock), it activates immediately regardless of cursor position. If no item is in the queue, right-click does nothing.
- **Space bar:** Emergency clear — instantly removes all active force fields (unchanged).
- **ESC:** Pause (unchanged).
- **Leaderboard/menu buttons:** Clicking HUD buttons does NOT pause the game. The leaderboard opens as a semi-transparent overlay while gameplay continues underneath.

---




