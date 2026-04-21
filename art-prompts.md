# Shieldr — Art Asset Prompts

## Global Art Direction

**Style:** Neon sci-fi vector art designed for compositing over a dark game canvas. Clean geometric shapes with vivid color glow and soft bloom. Think Geometry Wars meets synthwave — sharp silhouettes surrounded by luminous halos. Every sprite should feel like it's emitting light into a dark void.

**Fidelity: High-resolution rasterized vector art — NOT pixel art.** Assets should have smooth anti-aliased edges, clean gradients, and soft glowing bloom effects. There should be no visible individual pixels, no dithering, and no chunky aliased edges. The look is crisp, smooth, and modern — closer to Adobe Illustrator renders with glow effects than retro 8-bit or 16-bit pixel art. When prompting an image generator, use terms like "vector art," "clean digital illustration," "smooth edges," "neon glow" — and explicitly exclude "pixel art," "8-bit," "16-bit," "retro," "pixelated" from your prompt or add them to your negative prompt.

**Palette:** Neon cyan, electric blue, hot magenta, acid green, warm gold, and stark white as accent/glow colors. Enemies use warm-to-hostile colors (red, orange, green, magenta). Player elements use cool-to-protective colors (cyan, blue, white, gold).

**Rendering rules for all prompts:**
- **Transparent background (PNG with alpha channel) on every asset — no solid black fill behind sprites**
- Top-down / flat 2D perspective — no 3D depth, no cast shadows
- Crisp anti-aliased edges with soft outer glow / bloom halo
- No photorealism — stylized, geometric, vector-inspired shapes
- Sprites should read clearly at small sizes (48–128px)
- All animation frames should be on a single horizontal spritesheet strip where noted

---

## Image Generator Configuration

The pixel dimensions listed per asset (e.g. 48x48, 128x128) are **final in-game sizes**, not what you request from the generator. AI image generators output at fixed canvas sizes that must be mapped and post-processed.

### Generator Canvas Sizes

| Final game size | Generate at | Generator request | Post-processing |
|---|---|---|---|
| ≤64x64 (e.g. 48x48 drone) | 1024x1024 | Square 1:1, subject centered with generous padding | Trim transparent padding → resize to 2x game size (96x96) → final resize to game size (48x48) |
| 65–128px (e.g. 128x128 planet) | 1024x1024 | Square 1:1, subject fills ~60% of canvas | Trim → resize to 2x (256x256) → final resize (128x128) |
| 129–256px (e.g. 256x256 starbomb) | 1024x1024 | Square 1:1, subject fills ~70–80% of canvas | Trim → resize to 2x (512x512) → final resize (256x256) |
| Wide/rectangular (e.g. 160x24 shield) | 1536x1024 or 1024x1024 | Use landscape aspect ratio (3:2) if available; otherwise generate square with the subject stretched horizontally across center | Trim → resize preserving aspect ratio to 2x (320x48) → final (160x24) |
| Spritesheet strips | 1536x1024 | Generate each frame as a **separate image** at square 1:1, then stitch into a horizontal strip during post-processing | Generate individual frames → trim each to identical bounding box → resize uniformly → stitch left-to-right into final strip |

### Aspect Ratio Reference

- **1:1 (square)** — Default for all circular, square, or nearly-square assets (planet, enemies, orbs, explosions, UI icons)
- **3:2 or 16:9 (landscape)** — Shields, banners, HP bars, tooltip bubbles, any asset significantly wider than tall
- **2:3 or 9:16 (portrait)** — Roulette spin column (48x120); generate tall or generate square and crop

### Consistency Protocol

To keep visual style uniform across all assets:

1. **Same model + settings for each category.** Generate all enemies in one session, all shields in another, all orbs in another. Don't mix categories within a session.
2. **Lock your generation parameters.** If using Stable Diffusion or ComfyUI: pick a checkpoint, sampler, CFG scale, and step count and reuse them for every asset. Document these values. If using DALL-E or Midjourney: use the same style reference / style-raw / `--sref` across all prompts.
3. **Seed anchoring (where supported).** Generate one "hero" asset per category (e.g. the Drone for enemies). Save its seed. Use seed variations for the remaining assets in that category to maintain consistent line weight, glow radius, and color temperature.
4. **Negative prompt (where supported).** Always include: `3D render, photorealistic, realistic lighting, drop shadow, perspective, gradient background, solid background, watermark, text, signature`
5. **Color calibration pass.** After generation, check that enemy colors are warm/hostile (red, orange, magenta, green) and player/shield colors are cool/protective (cyan, blue, white, gold). Adjust hue/saturation in post if a generated asset drifts.

### Post-Processing Pipeline (per asset)

1. **Remove background** — If the generator doesn't support transparency natively, use background removal (e.g. rembg, Photoshop Select Subject, or manual masking against a solid color you specify in the prompt)
2. **Trim** — Auto-trim transparent padding to the content bounding box
3. **Uniform padding** — Add equal transparent padding so the sprite sits centered in its final dimensions
4. **Downscale** — Resize from generation resolution to 2x game size using Lanczos/bicubic, then from 2x to 1x for the final asset. This two-step downscale preserves edge crispness.
5. **Spritesheet assembly** — For multi-frame assets, ensure every frame is trimmed to the same bounding box size before stitching horizontally

### Prompt Suffix (append to every prompt)

Append this to the end of every individual generation prompt for consistency:

> `Flat 2D top-down vector art. Neon glow on black void. No 3D, no shadows, no perspective. Clean geometric shapes. Transparent background. High contrast. Single isolated subject centered on canvas with padding.`

---

## 1. Planet / Core

### 1a. Planet Surface (idle, rotating)
> A glowing sci-fi planet viewed from directly above, top-down perspective. Circular shape with concentric ring patterns on the surface suggesting energy layers. Base color is deep teal-blue with bright cyan energy veins running across the surface. A soft cyan-white glow radiates outward from the center. Two thin orbital rings surround the planet at slight angles, made of faint dotted light. Transparent background. Flat 2D, no 3D shading. Clean vector style with neon glow. 128x128 pixels.

**Variants needed:** 4-frame rotation cycle (rings shift position slightly per frame), delivered as a horizontal spritesheet strip.

### 1b. Planet Damage States
> Same planet as above but showing progressive damage. Three states side by side on a spritesheet strip:
> - **State 1 (healthy):** Intact planet, full cyan glow, clean rings.
> - **State 2 (damaged, ~50% HP):** Surface cracks appear as bright orange-yellow fracture lines. Outer glow shifts from cyan toward yellow. Rings flicker (partial gaps).
> - **State 3 (critical, <25% HP):** Deep red fracture lines covering the surface, chunks visibly separated by glowing red fissures. Glow is now pulsing red-orange. Rings are broken and scattered. Small debris particles float near the surface.
>
> Top-down flat 2D, neon vector style, transparent background. Each frame 128x128.

### 1c. Core Energy Aura
> A circular pulsing energy aura, viewed top-down. Concentric rings of soft cyan-white light radiating outward from a bright center point, fading to transparent at the edges. No solid shapes — just layered translucent glow rings. Think of a calm energy field. Flat 2D, transparent background. 4-frame animation strip showing the rings expanding slightly then contracting (breathing effect). Each frame 192x192.

### 1d. Sanctuary Dome
> A golden semi-transparent energy dome/bubble viewed from above (appears as a glowing golden circle). Outer edge is a crisp bright gold ring. Interior is filled with a soft warm gold gradient fading toward transparent at the center. Faint hexagonal grid pattern visible inside the dome. Small golden sparkle particles scattered within. Flat 2D, neon style, transparent background. 160x160.

### 1e. Healing Pulse Ring
> An expanding ring of soft green-white healing energy. Concentric thin rings radiating outward from center. Inner rings are bright white-green, outer rings fade to transparent emerald. Small plus-sign (+) shaped particles scattered along the rings. 4-frame strip showing the rings expanding outward. Flat 2D, transparent background. Each frame 192x192.

### 1f. Planet Shatter Fragments
> 8–10 irregular angular fragments of a destroyed planet scattered outward from a center point. Each fragment has teal-blue coloring with glowing cyan edges and faint orange-red heat glow on the inner broken faces. Small particle debris between fragments. Flat 2D, neon vector style, transparent background. Single image 256x256.

---

## 2. Enemies — Base Types

### 2a. Drone
> A small sharp equilateral triangle shape, glowing bright orange-red. The interior is a darker burnt orange with a bright pulsing core dot at the center. Edges emit a soft orange glow/bloom. A short motion trail of 2–3 fading afterimage triangles extends behind it (pointing away from the direction of travel). Aggressive, fast-looking. Flat 2D top-down, neon vector style, transparent background. 48x48.

**Variants:** 2-frame animation strip (core dot pulses bright/dim).

### 2b. Rocket
> A larger elongated wedge/chevron shape, pointing forward. Deep crimson red with a bright white-hot core running along its center axis. Edges glow with a pulsing red-orange halo. Heavier and more menacing than the Drone — thick lines, wider shape. A faint engine exhaust glow trails behind. Flat 2D top-down, neon vector style, transparent background. 64x64.

**Variants:** 2-frame animation strip (pulsing glow intensity alternates).

### 2c. Shooter
> A diamond/rhombus shape oriented point-forward. Electric magenta-pink color with a bright white diamond-shaped core at the center. Each of the four corners has a small bright dot suggesting energy nodes. Outer edges glow with soft magenta bloom. Should look precise and tactical compared to the brutish Drone and Rocket. Flat 2D top-down, neon vector style, transparent background. 56x56.

**Variants:** Idle (closed formation) and firing (corners spread slightly outward, center core flares bright white). 2-frame strip.

### 2d. Shooter Energy Bolt
> A small elongated oval projectile, bright magenta-white at its core fading to magenta at the edges. A short comet-like tail trails behind. Compact and fast-looking. Flat 2D, neon vector style, transparent background. 16x32.

### 2e. Mini-Drone (Splitter Fragment)
> A tiny sharp triangle, half the size of a regular Drone. Bright acid green with a flickering unstable glow — edges are slightly jagged/irregular compared to the clean Drone triangle. Feels like a fragment, not a fully-formed enemy. Flat 2D, neon vector style, transparent background. 28x28.

---

## 3. Enemies — New Types

### 3a. Splitter
> A hexagonal shape, noticeably larger than a Drone. Bright acid green with a darker green interior. The center contains a visible cluster of 3 tiny triangle shapes (foreshadowing the split). Outer edges pulse with green glow. Surface has faint fracture lines suggesting it's ready to break apart. Flat 2D top-down, neon vector style, transparent background. 72x72.

**Variants:** 2-frame pulse animation. Bonus: a 3-frame "splitting" animation strip showing the hex breaking into triangle fragments radiating outward.

### 3b. Phaser
> An octagonal shape with sharp precise edges. When visible: bright white-cyan with a hard electric glow, very crisp and bright. Flat 2D top-down, neon vector style, transparent background. 56x56.

**Variants:** 2 states as a strip — **visible** (full bright white-cyan, sharp edges, strong glow) and **ghost** (same shape at ~10% opacity, faint dotted outline, barely perceptible against a dark background). Each frame 56x56.

### 3c. Shield Breaker
> A large angular armored wedge shape with a heavy, imposing silhouette. Bright red outer edge border, thick and distinct. Interior is dark metallic gray-red with a pulsing inner glow. Armored plating lines/segments visible on the surface. Should look tanky and threatening — the heaviest enemy on screen. Flat 2D top-down, neon vector style, transparent background. 80x80.

**Variants:** 3-state strip — **intact** (full armor, bright red outline), **cracked** (visible crack lines across the armor glowing orange-white, red glow dimmer), **destroyed** (large red-orange particle burst, fragments flying outward).

---

## 4. Mini-Bosses

### 4a. Carrier
> A large rotating diamond shape, 3–4x bigger than normal enemies. Warm orange glow with a darker orange interior. Four visible rectangular "hangar bay" slots along the edges, glowing brighter than the body, suggesting openings where drones deploy from. Surface has angular panel lines. Imposing but geometric. Flat 2D top-down, neon vector style, transparent background. 128x128.

**Variants:** 3-state damage strip — **full health** (clean armor, bright orange), **damaged** (crack lines appear, one hangar bay darkened), **critical** (heavy cracks, two bays dark, unstable flickering glow).

### 4b. Carrier Drone Spawn Animation
> A 4-frame horizontal strip showing a small orange drone shape emerging from a rectangular hangar slot. Frame 1: hangar bay flares bright. Frame 2: tiny triangle begins to emerge. Frame 3: triangle fully formed, separating. Frame 4: triangle detached, hangar dims. Flat 2D, neon vector style, transparent background. Each frame 48x48.

### 4c. Siege Unit
> A large crescent/arc shape with a visible turret protruding from the concave side. Teal-colored with bright cyan edge glow. The turret is a small bright white circle with a directional barrel indicator. Surface has smooth curved panel lines. Should look elegant but dangerous — it orbits rather than charges. Flat 2D top-down, neon vector style, transparent background. 112x80.

### 4d. Siege Unit Bolt
> A cluster of 3 small bright teal-white energy bolts in a tight triangular spread pattern. Each bolt is a small glowing oval with a short tail. The cluster moves as one unit. Flat 2D, neon vector style, transparent background. 32x32.

---

## 5. Force Fields / Shields

### 5a. Standard Shield Wall
> A horizontal force field barrier segment. A bright cyan-white energy line with soft blue glow radiating outward from both sides. The line itself is crisp and bright white at the center, fading to electric blue at the edges of the glow. Faint energy crackle/static texture along the line. Flat 2D, neon vector style, transparent background. 160x24.

### 5b. Shield Glow Intensities
> Three versions of the shield wall side by side on a strip:
> - **Normal:** Standard cyan-white glow as described above.
> - **Warming up (3 kills):** Glow expands slightly, color shifts toward cyan-yellow, subtle pulse visible.
> - **Overcharged (5+ kills):** Strong pulsing glow, color is bright gold-white, energy crackles visibly along the surface, glow radius is 2x normal.
>
> Each frame 160x32. Horizontal strip.

### 5c. Reflective Shield Variant
> Same shape as the standard shield but with a distinct mirror/prismatic quality. The line has a rainbow/chromatic aberration shimmer along its length — shifting between cyan, magenta, and white. A faint angular reflection pattern in the glow suggests it bounces things. Flat 2D, neon vector style, transparent background. 160x24.

### 5d. Shield Interference Flicker
> A shield segment that appears unstable. The cyan line is broken into stuttering dashed segments with gaps. The glow flickers unevenly — some sections bright, others dim. Red-orange warning tint bleeds into parts of the glow. Looks like two energy fields are conflicting. Flat 2D, transparent background. 160x24.

### 5e. Shield Shatter Effect
> A 4-frame animation strip showing a shield breaking apart. Frame 1: shield intact but stressed (red tint). Frame 2: shield cracks into 4–5 segments. Frame 3: segments fly apart with bright red-orange particle sparks. Frame 4: fading sparks and debris, nearly gone. Flat 2D, neon vector style, transparent background. Each frame 160x48.

### 5f. Overcharge Detonation Ring
> An expanding circular shockwave ring. Bright gold-white at the leading edge, fading to transparent behind. Energy crackle particles trail the ring. 4-frame strip showing the ring expanding outward from a small radius to a large one. Flat 2D, neon vector style, transparent background. Each frame 192x192.

---

## 6. Particles / VFX

### 6a. Enemy Death Explosion
> A radial burst of 8–12 bright particles flying outward from a center point. Particles are small angular fragments and dots. Color: bright orange-white at center fading to the enemy's signature color at the edges. Energy streaks radiate outward. 4-frame animation strip from initial flash to fading debris. Flat 2D, neon vector style, transparent background. Each frame 64x64.

**Variants:** Generate in orange (Drone/Carrier), red (Rocket/Shield Breaker), magenta (Shooter), green (Splitter), cyan (Phaser), and teal (Siege Unit).

### 6b. Core Impact Flash
> A brief bright flash centered on the planet. A hard white circle expands rapidly outward then fades. Red-orange ring follows behind the white flash. 3-frame strip: bright flash, expanding ring, fading glow. Flat 2D, transparent background. Each frame 192x192.

### 6c. Multi-Kill Badge Sprites
> Three floating text badges with glow effects, each on its own frame:
> - **"x1.5"** in clean white with a soft white glow halo.
> - **"x2"** in bright gold with a warm gold glow halo.
> - **"x3"** in hot red with a fiery red glow halo and small spark particles around it.
>
> Bold, slightly stylized sci-fi font. Flat 2D, transparent background. Each frame 80x32.

### 6d. Gravity Field Vortex
> A swirling circular vortex viewed from above. Concentric spiral arms of cyan energy curving inward toward a bright center point. Faint particle dots being pulled along the spiral paths. The outer edge fades to transparent. Hypnotic, pulling feel. 4-frame rotation strip. Flat 2D, neon vector style, transparent background. Each frame 160x160.

### 6e. Time Bender Ripple
> A screen-wide distortion ripple effect. Concentric rings of faint white-blue light expanding outward from center, with a subtle warping/bending quality to the rings (slightly wavy, not perfectly circular). Ethereal and slow-feeling. 3-frame expansion strip. Flat 2D, transparent background. Each frame 256x256.

### 6f. Time Freeze Crystal Overlay
> A crystalline/frozen effect overlay for enemies. Jagged ice-crystal geometric shapes (sharp angular facets) surrounding a silhouette space in the center where the enemy would be. Bright purple-white with a cold blue tint. Frost particle sparkles at the crystal tips. Flat 2D, transparent background. 80x80.

### 6g. Star Bomb Detonation
> A massive radial explosion. Bright yellow-white core flash with expanding rings of golden energy. Thick streaks of light radiate outward like a starburst. Outer edge is a hot orange ring. Much larger and more dramatic than a normal enemy explosion. 4-frame strip from blinding flash to fading ring. Flat 2D, neon vector style, transparent background. Each frame 256x256.

### 6h. Cardinal Rift Compass Flash
> A bold magenta cross/plus shape spanning the full frame, centered. Four arms pointing N/S/E/W. The cross pulses with bright magenta-white energy at the center intersection, fading to deeper magenta at the arm tips. Faint directional arrows at each arm tip. Brief streaking motion lines along each arm. Flat 2D, neon vector style, transparent background. 256x256.

### 6i. Cardinal Rift Enemy Streak Trail
> A short horizontal motion trail / streak. Bright magenta fading to transparent over its length. Small particle sparks along the trail. Used to show enemies warping to their new position. Flat 2D, transparent background. 64x16.

### 6j. Spawn Telegraph — Precise Dot
> A small glowing dot used as an edge-of-screen spawn marker. Dim white-gray with a soft pulsing glow. Understated — should not compete with enemy or upgrade colors. 2-frame pulse strip (dim/bright). Flat 2D, transparent background. Each frame 16x16.

### 6k. Spawn Telegraph — Sector Glow
> A horizontal gradient bar of soft dim white-gray light, bright at center fading to transparent at both ends. Used along screen edges to indicate a general spawn zone. Subtle and understated. Flat 2D, transparent background. 128x16.

---

## 7. Upgrade Orbs (Passive)

### 7a. Duration+ Orb (Green)
> A floating circular orb with a bright green core and soft green glow halo. A small clock/timer icon silhouette visible inside the orb. Gentle sparkle particles orbit the orb. Feels like a benevolent power-up. Flat 2D, neon vector style, transparent background. 40x40.

**Variants:** 4-frame shimmer animation strip (glow pulses, sparkles rotate).

### 7b. Width+ Orb (Blue)
> A floating circular orb with a bright electric blue core and soft blue glow halo. A small horizontal double-arrow (↔) icon silhouette inside the orb suggesting expansion. Sparkle particles orbit. Flat 2D, neon vector style, transparent background. 40x40.

**Variants:** 4-frame shimmer animation strip.

### 7c. Reflective Shield Orb (Purple)
> A floating circular orb with a bright purple core and soft purple glow halo. A small angular reflection/mirror icon silhouette inside (two arrows bouncing off a surface). Sparkle particles orbit. Flat 2D, neon vector style, transparent background. 40x40.

**Variants:** 4-frame shimmer animation strip.

---

## 8. Item Roulette System

### 8a. Item Box Orb
> A floating circular orb, white core with a rainbow/prismatic shimmer cycling across its surface. A bold question mark (?) icon in the center, bright white. The glow shifts through spectral colors (red → orange → yellow → green → cyan → blue → purple) in a smooth cycle. More mysterious and exciting than the passive upgrade orbs. Flat 2D, neon vector style, transparent background. 48x48.

**Variants:** 4-frame rainbow cycle strip.

### 8b. Item Icons (for HUD queue slots)
> Seven small square icons, each with a distinct color and simple symbolic shape. Clean, readable at small size. Thin glowing outlines, minimal interior detail. All on one horizontal strip. Transparent background. Each icon 32x32.
>
> - **Gravity Field (cyan):** A spiral/vortex symbol.
> - **Time Bender (white):** A clock face with bent/warped hands.
> - **Health Surge (red):** A plus/cross symbol with a heart accent.
> - **Star Bomb (yellow):** A starburst / explosion symbol.
> - **Time Freeze (purple):** A snowflake / crystal symbol.
> - **Sanctuary (gold):** A dome / shield arc symbol.
> - **Cardinal Rift (magenta):** A four-pointed compass / cross symbol.

### 8c. Queue Slot Frame — Empty
> A rounded square outline, dim gray with faint inner bevel. Dashed border suggesting "place item here." Subdued, not distracting. Flat 2D, transparent background. 48x48.

### 8d. Queue Slot Frame — Filled
> Same rounded square but with a bright glowing border (white-cyan). Soft inner glow filling the slot. The border pulses faintly. Ready and active feeling. Flat 2D, transparent background. 48x48.

### 8e. Roulette Spin Animation
> A vertical strip of item icons rapidly cycling, blurred by speed. The strip has motion blur top and bottom, with the center row crisp and highlighted by a bright selection bracket. Think slot machine column. 8–12 frames showing the strip decelerating from fast blur to a stopped result. Flat 2D, neon vector style, transparent background. Each frame 48x120.

### 8f. "QUEUE FULL" Badge
> Floating text badge: "QUEUE FULL" in a bold condensed sci-fi font. Dull amber/warning orange color with a dim glow. Not dramatic — just an informational warning. Flat 2D, transparent background. 120x28.

---

## 9. HUD / UI Elements

### 9a. HP Bar Frame
> A horizontal rounded rectangle frame for the health bar. Thin bright cyan border with subtle corner accents (small angular decorations at each corner). Interior is dark/transparent for the fill to show through. Clean, minimal, sci-fi. Flat 2D, transparent background. 200x20.

### 9b. HP Bar Fill Segments
> Three horizontal fill bar variants (same dimensions, meant to sit inside the HP bar frame):
> - **Healthy (>60%):** Bright green with a subtle lighter green shimmer at the top edge.
> - **Damaged (30–60%):** Amber-yellow with a faint pulse.
> - **Critical (<30%):** Pulsing red with small warning spark particles at the leading edge.
>
> Each 196x16.

### 9c. Perfect Shield Streak Icon
> A small flame icon in bright gold-white. Clean geometric flame shape (not realistic — angular, stylized). A small counter badge circle attached to the upper-right of the flame for the streak number. Flat 2D, neon vector style, transparent background. 24x28.

### 9d. Item Queue Tray Background
> A horizontal pill-shaped dark panel with a thin bright border (cyan). Two recessed rectangular slots visible inside, evenly spaced. Subtle inner shadow/bevel. Acts as the container for the 2 item queue slots. Flat 2D, semi-transparent dark background. 120x56.

### 9e. Title Rank Badges
> Eight small horizontal badge/ribbon sprites, one per rank. Each has the rank name in a compact bold sci-fi font. Color progresses with rank:
> - **Watcher:** Dim gray
> - **Defender:** Steel blue
> - **Guardian:** Bright cyan
> - **Sentinel:** Green
> - **Warden:** Gold
> - **Archon:** Hot magenta
> - **Overlord:** Bright red
> - **Eternal:** Prismatic white with rainbow shimmer
>
> Each badge 80x20. All on a vertical strip.

### 9f. Rank-Up Banner Frame
> A wide horizontal banner frame for rank achievement announcements. Angular/chevron-shaped ends (pointed left and right like a ribbon). Bright gold border with inner glow. Interior is dark with space for text. Dramatic but clean. Flat 2D, transparent background. 400x48.

---

## 10. Screens / Menus

### 10a. "SHIELDR" Logo
> The word "SHIELDR" in a bold, wide, futuristic sci-fi font. Bright cyan-white with strong neon glow and soft bloom radiating outward. Subtle horizontal scan lines across the letters for texture. The letter "I" could be stylized as a vertical force field line with a glow. Below it in smaller, thinner text: "PROTECT THE CORE" in dim cool gray. Flat 2D, transparent background. 512x128.

### 10b. Menu Button — Normal State
> A horizontal rounded rectangle button. Thin bright cyan border. Interior is very dark blue-black, nearly transparent. Clean, minimal. Text area left empty (text rendered by the engine). Flat 2D, transparent background. 200x48.

### 10c. Menu Button — Hover State
> Same button shape but the border is brighter white-cyan and the interior fills with a soft translucent cyan glow (about 20% opacity). Feels activated/highlighted. 200x48.

### 10d. Menu Button — Pressed State
> Same shape but slightly smaller (pressed inward feel). Border is bright white. Interior is a slightly brighter cyan fill than hover. Brief flash quality. 196x44.

### 10e. Game Over Overlay Panel
> A large dark semi-transparent panel (rounded rectangle, very dark blue-black at 85% opacity). Thin red-orange border with faint ember-like particles along the edges. Somber, dramatic. Space for text and stats in the center. Flat 2D. 500x400.

### 10f. Wave Clear Banner
> A horizontal banner bar that appears briefly between waves. Angular/pointed ends. Bright cyan-white border with a brief flash/flare effect. Interior is dark with a subtle energy line running through the center. Clean and celebratory. Flat 2D, transparent background. 360x40.

### 10g. Pause Overlay
> A full-screen dimming layer (dark blue-black at 70% opacity) with a subtle hexagonal grid pattern barely visible across the surface. Centered area is slightly brighter, suggesting a focal point for "PAUSED" text. Atmospheric, not jarring. 256x256 (tileable).

### 10h. Tooltip Callout Bubble
> A rounded speech-bubble/tooltip shape pointing downward. Thin white border, dark semi-transparent interior. Small triangular pointer at the bottom center. Clean and unobtrusive. Flat 2D, transparent background. 240x64.

---

## 11. Background / Environment

### 11a. Starfield Layer
> A tileable starfield texture. Scattered small dots of varying brightness (dim gray, medium white, and occasional bright white with tiny glow halos) on a pure black background. Stars should be sparse — this is deep space, not a dense cluster. A few very faint, tiny colored stars (pale blue, pale yellow) mixed in. No nebulae in this layer. Flat 2D. 512x512, seamlessly tileable.

### 11b. Nebula Backdrop Layer
> A subtle, dark nebula texture. Very faint wisps of deep purple and dark blue color blending into black. Almost invisible — just enough to add depth behind the starfield layer. No bright areas. No stars. This sits behind the starfield. Flat 2D. 512x512, seamlessly tileable.

### 11c. Space Dust Particle Sheet
> 8–10 tiny dust mote sprites on a single strip. Varying sizes (2px to 6px), varying brightness (dim gray to medium white). Some are round dots, some are tiny short streaks. Used for a slow-drifting ambient particle layer. Flat 2D, transparent background. Strip: 80x8.

---

## Asset Delivery Notes

- **Format:** PNG with transparency (alpha channel) for all sprites. Every asset must have a transparent background — no baked-in black fill. The only exception is the starfield (11a) which intentionally uses a black background since it is the base game backdrop.
- **Resolution:** Generate at 2x the listed pixel sizes, then downscale for crisp results. For example, a 64x64 sprite should be generated at 128x128 and scaled down.
- **Spritesheet layout:** All multi-frame animations should be horizontal strips (frames side by side, left to right). Frame count noted per asset.
- **Consistency:** Generate all enemies in the same batch/session if possible to maintain consistent line weight, glow intensity, and style across the set.
- **Color accuracy:** The specific neon colors matter for gameplay readability. Enemies must be visually distinct from shields and upgrades at a glance. Warm = hostile, cool = friendly, gold = special.

public/assets/
├── planet/
│   ├── planet-idle.png
│   ├── planet-damage.png
│   ├── core-aura.png
│   ├── sanctuary-dome.png
│   ├── healing-pulse.png
│   └── planet-shatter.png
├── enemies/
│   ├── drone.png
│   ├── rocket.png
│   ├── shooter.png
│   ├── shooter-bolt.png
│   ├── mini-drone.png
│   ├── splitter.png
│   ├── phaser.png
│   ├── shield-breaker.png
│   ├── carrier.png
│   ├── carrier-spawn.png
│   ├── siege.png
│   └── siege-bolt.png
├── shields/
│   ├── shield-wall.png
│   ├── shield-glow.png
│   ├── shield-reflective.png
│   ├── shield-interference.png
│   ├── shield-shatter.png
│   └── overcharge-ring.png
├── vfx/
│   ├── explosion-orange.png
│   ├── explosion-red.png
│   ├── explosion-magenta.png
│   ├── explosion-green.png
│   ├── explosion-cyan.png
│   ├── explosion-teal.png
│   ├── core-impact.png
│   ├── multikill-badges.png
│   ├── gravity-vortex.png
│   ├── time-ripple.png
│   ├── freeze-overlay.png
│   ├── starbomb-blast.png
│   ├── cardinal-flash.png
│   ├── cardinal-streak.png
│   ├── telegraph-dot.png
│   └── telegraph-glow.png
├── orbs/
│   ├── orb-duration.png
│   ├── orb-width.png
│   ├── orb-reflective.png
│   └── item-box.png
├── ui/
│   ├── hp-bar-frame.png
│   ├── hp-fill-green.png
│   ├── hp-fill-yellow.png
│   ├── hp-fill-red.png
│   ├── streak-flame.png
│   ├── queue-tray.png
│   ├── queue-empty.png
│   ├── queue-filled.png
│   ├── item-icons.png
│   ├── rank-badges.png
│   ├── rankup-banner.png
│   ├── roulette-spin.png
│   └── queue-full-badge.png
├── screens/
│   ├── logo.png
│   ├── btn-normal.png
│   ├── btn-hover.png
│   ├── btn-pressed.png
│   ├── gameover-panel.png
│   ├── wave-clear-banner.png
│   ├── pause-overlay.png
│   └── tooltip.png
└── bg/
    ├── starfield.png
    ├── nebula.png
    └── dust-particles.png