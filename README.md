# Havenwood

An animal sanctuary management game built with [Phaser 3](https://phaser.io/). Rescue animals, build habitats, hire staff, research upgrades, and attract visitors — all rendered with procedural pixel art and sound, no external assets required.

## Quick Start

Serve the project root with any static file server and open `index.html` in a browser. No build step or dependencies to install.

```bash
# Python
python3 -m http.server 8000

# Node (npx)
npx serve .
```

Then visit `http://localhost:8000`.

The game auto-saves to `localStorage` every 60 seconds and on manual save. You can also export your save as a JSON file from the in-game menu.

---

## Project Structure

```
havenwood/
├── index.html              # Entry HTML — loads Phaser CDN, Google Font, and main.js
├── style.css               # Minimal CSS — centers canvas, enables pixelated rendering
├── CNAME                   # GitHub Pages custom domain config
└── js/
    ├── main.js             # Phaser config and game initialization (4 scenes)
    ├── GameData.js         # All static game data: constants, species, habitats, etc.
    ├── SoundManager.js     # Procedural sound effects via Web Audio API
    ├── SpriteGenerator.js  # Procedural pixel-art textures via Phaser Graphics API
    └── scenes/
        ├── BootScene.js    # Loads font, generates sprites, transitions to menu
        ├── MenuScene.js    # Title screen with New Game / Continue
        ├── GameScene.js    # Core gameplay: simulation, economy, all game systems
        └── HUDScene.js     # UI overlay: toolbar, panels, notifications
```

### Key Files

| File | Role |
|---|---|
| `GameData.js` | Central data registry. Every species, habitat, upgrade, research node, achievement, etc. is defined here. Species include `foodCost` (food consumed per feed), `bondTreatsBase` (bond XP per treat), and breed-only variants with parent recipes. Volunteers are free with a max count of 1. Change game balance by editing this file. |
| `GameScene.js` | The game simulation. Manages the grid map, animal behavior, visitors, staff, time/seasons, automatic breeding, illness, missions, research, economy, achievements, and save/load. |
| `HUDScene.js` | All UI. Runs as a parallel Phaser scene on top of GameScene. Toolbar with Build popup menu for habitat placement, vertically centered management panels (Rescue, Upgrades, Staff, Research, Journal — all closeable with ESC), settings/pause menu, and notifications. Exposes `hasOpenPanel()` and `closeAllPanels()` so GameScene can suppress world clicks and close panels via keyboard. Communicates via `this.game.events` (Phaser's global event emitter). |
| `SpriteGenerator.js` | Draws every texture at boot using Phaser's Graphics API — animals, terrain, UI icons, particles, enrichment items, staff, visitors. Zero external image files. |
| `SoundManager.js` | Generates all sound effects procedurally using the Web Audio API — oscillators and filtered noise. Zero audio files. |

---

## Architecture

### Scene Flow

```
BootScene  →  MenuScene  →  GameScene (+ HUDScene launched in parallel)
```

- **BootScene**: Waits for the Google Font to load, calls `SpriteGenerator.generate()` to create all textures, then starts MenuScene.
- **MenuScene**: Animated title screen with a procedurally generated night scene — dense layered forest with color-varied trees, a starry sky with twinkling stars and crescent moon, wildflower meadow, hopping clickable bunnies, and a campfire with smoke, benches, and a tent. Checks `localStorage` for a save to show the "Continue" button.
- **GameScene**: The main simulation loop. Initializes game state, creates the tile map, sets up timed events, and runs `update()` every frame.
- **HUDScene**: Launched by GameScene as a parallel overlay scene. Listens for events from GameScene to update the UI.

### Cross-Scene Communication

GameScene and HUDScene communicate via Phaser's global event system (`this.game.events`):

- **GameScene emits**: `timeUpdate`, `coinsUpdate`, `foodUpdate`, `rescueEvent`, `showAnimalInfo`, `showHabitatInfo`, `notification`, `buildModeChanged`, `seasonChanged`, `upgradesUpdate`, `staffUpdate`, `missionsUpdate`, `achievementEarned`, `researchUpdate`, `animalUpdate`, `habitatViewClosed`
- **HUDScene emits**: `rescueAccepted` (when player accepts a rescue)
- **HUDScene reads**: `this.gs.state` for current game data, calls `this.gs.methodName()` for player actions (including `zoomOut()` from the Back button)

---

## Game Systems

### Time & Seasons

- 1 game day = 1440 minutes (matching real 24-hour clock)
- `TIME_SCALE` (default: 2) controls how many game-minutes pass per real second
- Day/night cycle affects a color overlay (dawn, day, dusk, night phases)
- 4 seasons cycle every 7 days (28-day year): Spring → Summer → Autumn → Winter
- Each season has gameplay bonuses/penalties (e.g., summer boosts visitors, winter reduces them) and particle effects (petals, fireflies, leaves, snow)

### Habitats

4 buildable habitat types placed on a 30x20 tile grid. When entering build mode, a live preview of the habitat (background fill, border, and type-specific decor at 70% opacity) follows the cursor with a green/red overlay showing placement validity. Rescue events are suppressed during build mode.

| Habitat | Cost | Size | Capacity | Animal Types |
|---|---|---|---|---|
| Meadow | 100g | 5x4 | 3 | mammal_small, bird |
| Forest | 200g | 5x5 | 4 | mammal_large, mammal_small |
| Pond | 150g | 4x4 | 3 | aquatic, amphibian, bird |
| Barn | 250g | 4x4 | 5 | domestic |

Capacity can be increased by the Habitat Plus upgrade (+1) and the Wildlife Biology research tree (+1).

#### Habitat Zoom View

Clicking a habitat from the sanctuary overview zooms the camera (2.5x) to center on it, opens the habitat info panel on the left, and auto-selects a random animal. The panel has a red X close button in its top-right corner, and the bottom toolbar is replaced with a centered "< Back" button — both zoom back out. Animals are only clickable while zoomed in; hovering over an animal shows a glow effect that follows the sprite shape (using Phaser's `preFX.addGlow`), which persists while the animal's info panel is open. Navigation arrows (`<` / `>`) below the animal panel cycle through all animals in the habitat, transferring the glow highlight. Pressing ESC or clicking Back/X zooms back out to the sanctuary overview, closing both the habitat and any open animal panel. The zoom uses Phaser's `camera.pan()` and `camera.zoomTo()` with `force: true` so it can be safely interrupted. Grass extends 8 tiles beyond the main grid so the blue background never shows through when zooming into edge habitats.

#### Move Habitat

The habitat info panel includes a "Move Habitat" button. Clicking it zooms back out, pauses time and all movement, temporarily removes the habitat from the grid, and enters a placement preview mode. The full habitat — background, decor, enrichments, and animals — follows the cursor with a green/red overlay indicating valid or invalid placement. Click to confirm the new location; press ESC or right-click to cancel and return the habitat to its original spot. Rescue events are suppressed during move mode.

### Animals

14 species across 4 rarity tiers (common, uncommon, rare, legendary). Some are seasonal-only. Each species has multiple color variants with unique names; each individual animal has a gender (male/female, shown with a colored icon in the panel). Each animal has:

- **Stats**: hunger, happiness, health (all 0-100)
- **Health**: stays at 100 until the animal contracts an illness, then deteriorates. Restores gradually once the condition is healed.
- **Neglect & Death**: if hunger or happiness reaches 0 for more than 1 game-hour, the animal's health begins to drain. If health drops to 0, the animal dies and is permanently removed.
- **Trait**: randomly assigned personality (playful, shy, grumpy, social, curious, lazy) that modifies stat rates
- **Player Bond**: a leveling relationship with the player. Bond XP increases by giving treats (costs 20g, grants XP based on species' `bondTreatsBase`). Bond also grows passively over time while the animal is well cared for. Each level requires more XP than the last (level 1→2 = 50 XP, 2→3 = 75 XP, etc.). Shown in the animal panel as a level + XP progress bar with heart indicators.
- **Friendships**: bonds with habitat-mates that form naturally over time
- **Illness**: random chance of getting sick; can be cured by vets or manual healing

Animals wander within their habitat, bob up and down, sleep at night (with "zzz" particles), and display status icons when hungry, unhappy, low health, or sick. Animals are only clickable from the zoomed-in habitat view. The animal info panel auto-refreshes every 2 seconds and immediately on illness changes so stats and actions stay current. Navigation arrows below the panel let the player cycle through all animals in the habitat. If another compatible habitat with room exists, a "Relocate" button appears in the animal panel — clicking it zooms out and lets the player pick a destination habitat from the highlighted options.

### Food

The sanctuary starts with 1000 food. Each time you feed an animal, it consumes food based on the species' `foodCost` (e.g., rabbits cost 4, bear cubs cost 15). The current food count is displayed in the top bar next to the gold icon. If you run out of food, you can't feed animals. Staff auto-feeding (volunteers, caretakers) does not consume food.

### Rescue Events

Random rescue events pop up periodically (every ~50 seconds, 30% faster with Conservation upgrade). A grey tint dims the game and time pauses while the popup is shown. The player can accept (if a compatible habitat has room) or pass. Rescue events do not interrupt the current view — if zoomed into a habitat, the habitat and animal panels remain open behind the popup. If the rescued animal enters the currently viewed habitat, the panel refreshes to show the updated count. Rescue events are suppressed during build mode and habitat move mode to avoid interrupting placement.

### Breeding

Breeding happens automatically. A male and female of the same species in the same habitat will occasionally start expecting a baby on their own, provided both are adults, healthy, and off cooldown, and the habitat has room. The game checks eligible pairs every 15 seconds with a 6% chance per pair (12% with the breed boost research). The female carries the pregnancy. Babies grow to adults over 5 game-days. The Vet research branch can halve pregnancy time and reduce cooldown.

Each species has 2 special **breed-only variants** that can only be obtained by breeding specific parent variant combinations together. These exclusive variants cannot appear in rescue events or missions. The bestiary's variant sub-page shows them in a separate "Breed-Only" section with star markers, and once discovered, reveals the parent combination recipe. Undiscovered breed-only slots display a "Breed Only" hint so players know to experiment with breeding pairs.

### Visitors

Visitors spawn during business hours (8 AM - 6 PM), walk in through a randomized entrance tile (any of the 4 entrance tiles), wander open tiles (avoiding habitats), then leave via a random entrance tile. Income comes in two parts:

- **Admission fee** (on entry): flat 5g base, scaled by visitor type multiplier and income upgrades/research
- **Donation** (on exit): satisfaction-based tip calculated from average animal happiness, total animal count, enrichment happiness bonuses, season bonuses, gift shop upgrade, and tour guide staff multipliers

Visitor types: Family, Tourist, Photographer, School, VIP — each with different income multipliers and stay durations.

### Staff

4 hirable roles with daily salaries:

| Role | Hire Cost | Salary | Limit | Effect |
|---|---|---|---|---|
| Volunteer | FREE | FREE | 1 | Auto-feeds one random habitat |
| Caretaker | 150g | 30g/day | — | Auto-feeds all animals |
| Veterinarian | 200g | 40g/day | — | Heals animals, auto-cures illness |
| Tour Guide | 100g | 25g/day | — | +25% visitor income |

Volunteers are free to hire and have no daily salary, but you can only have one at a time. Caretakers, vets, and guides can walk freely into habitats. Tour guides avoid habitats the same way visitors do.

If you can't afford salaries at the start of a day, staff leave automatically.

### Rescue Missions

Send expeditions to 5 biomes (Urban, Coastline, Wetlands, Deep Forest, Mountains). Each has a cost, duration, and species pool. Missions run on a timer and can result in finding an animal (65%), supplies/coins (25%), or nothing (10%). Max 2 active missions at once.

### Enrichments

Place items in habitats to boost animal happiness:

- Scratching Post (barn), Bird Bath (meadow/pond), Log Pile (forest), Rock Garden (pond), Toy Ball (any), Cozy Bed (any)
- Default max 3 per habitat (4 with Ecology research)
- Costs can be reduced 30% with research

### Upgrades

8 one-time purchases that permanently improve the sanctuary:

| Upgrade | Cost | Effect |
|---|---|---|
| Better Feed | 200g | Feeding restores 45 hunger |
| Enrichment | 300g | Happiness decays 50% slower |
| Sanctuary Sign | 150g | +20% visitor income |
| Medical Kit | 250g | Unlocks manual Heal action |
| Gift Shop | 400g | +3 coins per visitor |
| Habitat Plus | 500g | All habitats +1 capacity |
| Premium Food | 600g | Feed gives 60 hunger + 15 happy |
| Conservation | 800g | Rescues arrive 30% faster |

### Research Tree

4 branches with 4 tiers each (16 nodes total). Costs Research Points (RP), earned passively (1/day, 1/rescue, 2/mission). Each tier requires the previous to be unlocked.

| Branch | Focus | Tier 4 Capstone |
|---|---|---|
| Wildlife Biology | Habitat capacity, bonds, rare species | Rare/legendary rescues 2x more likely |
| Veterinary Science | Illness resist, feeding, breeding | Instant vet cures, half heal cost |
| Ecology | Enrichment cost/capacity, seasons | Enrichment bonuses doubled |
| Public Outreach | Visitors, income, VIP access | All visitor income +50% |

### Achievements

22 milestones tracked automatically (first rescue, species discovered, breeding, earnings, etc.). Viewable in the Journal panel.

### Save System

- **Auto-save**: every 60 seconds to `localStorage` (key: `havenwood_save`)
- **Manual save**: via the settings menu (gear icon in top bar)
- **Export**: download save as JSON file
- **Exit to Menu**: saves and returns to the title screen via the settings menu
- Save format version is tracked (`v: 5`) for migration compatibility
- `Set` objects (upgrades, discoveries, achievements, research) are serialized as arrays

---

## Tech Stack

- **Phaser 3.80.1** (loaded from CDN) — game engine
- **ES Modules** — all JS uses `import`/`export` with `type="module"` in the script tag
- **Web Audio API** — procedural sound effects
- **Google Fonts** — "Press Start 2P" for pixel-art typography
- **localStorage** — game save persistence
- **No build tools** — pure vanilla JS, served as static files
