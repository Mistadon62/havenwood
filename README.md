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
| `GameData.js` | Central data registry. Every species, habitat, upgrade, research node, achievement, etc. is defined here. Change game balance by editing this file. |
| `GameScene.js` | The game simulation. Manages the grid map, animal behavior, visitors, staff, time/seasons, breeding, illness, missions, research, economy, achievements, and save/load. |
| `HUDScene.js` | All UI. Runs as a parallel Phaser scene on top of GameScene. Toolbar with Build popup menu for habitat placement, vertically centered management panels, and notifications. Exposes `hasOpenPanel()` so GameScene can suppress world clicks while a panel is visible. Communicates via `this.game.events` (Phaser's global event emitter). |
| `SpriteGenerator.js` | Draws every texture at boot using Phaser's Graphics API — animals, terrain, UI icons, particles, enrichment items, staff, visitors. Zero external image files. |
| `SoundManager.js` | Generates all sound effects procedurally using the Web Audio API — oscillators and filtered noise. Zero audio files. |

---

## Architecture

### Scene Flow

```
BootScene  →  MenuScene  →  GameScene (+ HUDScene launched in parallel)
```

- **BootScene**: Waits for the Google Font to load, calls `SpriteGenerator.generate()` to create all textures, then starts MenuScene.
- **MenuScene**: Title screen. Checks `localStorage` for a save to show the "Continue" button.
- **GameScene**: The main simulation loop. Initializes game state, creates the tile map, sets up timed events, and runs `update()` every frame.
- **HUDScene**: Launched by GameScene as a parallel overlay scene. Listens for events from GameScene to update the UI.

### Cross-Scene Communication

GameScene and HUDScene communicate via Phaser's global event system (`this.game.events`):

- **GameScene emits**: `timeUpdate`, `coinsUpdate`, `rescueEvent`, `showAnimalInfo`, `showHabitatInfo`, `notification`, `buildModeChanged`, `seasonChanged`, `upgradesUpdate`, `staffUpdate`, `missionsUpdate`, `achievementEarned`, `researchUpdate`, `animalUpdate`, `habitatViewClosed`
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

4 buildable habitat types placed on a 30x20 tile grid:

| Habitat | Cost | Size | Capacity | Animal Types |
|---|---|---|---|---|
| Meadow | 100g | 4x3 | 3 | mammal_small, bird |
| Forest | 200g | 4x4 | 4 | mammal_large, mammal_small |
| Pond | 150g | 3x3 | 3 | aquatic, amphibian, bird |
| Barn | 250g | 3x3 | 5 | domestic |

Capacity can be increased by the Habitat Plus upgrade (+1) and the Wildlife Biology research tree (+1).

#### Habitat Zoom View

Clicking a habitat from the sanctuary overview zooms the camera (2.5x) to center on it and opens the habitat info panel on the left. The panel has a red X close button in its top-right corner, and the bottom toolbar is replaced with a centered "< Back" button — both zoom back out. Animals are only clickable while zoomed in; hovering over an animal shows a glow effect that follows the sprite shape (using Phaser's `preFX.addGlow`). Pressing ESC or clicking Back/X zooms back out to the sanctuary overview, closing both the habitat and any open animal panel. The zoom uses Phaser's `camera.pan()` and `camera.zoomTo()` with `force: true` so it can be safely interrupted (e.g., by rescue events).

### Animals

14 species across 4 rarity tiers (common, uncommon, rare, legendary). Some are seasonal-only. Each animal has:

- **Stats**: hunger, happiness, health (all 0-100)
- **Trait**: randomly assigned personality (playful, shy, grumpy, social, curious, lazy) that modifies stat rates
- **Bonds**: friendships with habitat-mates that form over time
- **Illness**: random chance of getting sick; can be cured by vets or manual healing

Animals wander within their habitat, bob up and down, sleep at night (with "zzz" particles), and display status icons when hungry or sick. Animals are only clickable from the zoomed-in habitat view. The animal info panel auto-refreshes every 2 seconds and immediately on illness changes so stats and actions stay current.

### Rescue Events

Random rescue events pop up periodically (every ~50 seconds, 30% faster with Conservation upgrade). A grey tint dims the game and time pauses while the popup is shown. The player can accept (if a compatible habitat has room) or pass. Rescue events do not interrupt the current view — if zoomed into a habitat, the habitat and animal panels remain open behind the popup. If the rescued animal enters the currently viewed habitat, the panel refreshes to show the updated count.

### Breeding

Two same-species adults in the same habitat can breed if both are healthy and off cooldown. Initiates a pregnancy timer, then a baby is born. Babies grow to adults over 5 game-days. The Vet research branch can halve pregnancy time and reduce cooldown.

### Visitors

Visitors spawn during business hours (8 AM - 6 PM), walk in through the entrance gap, wander open tiles (avoiding habitats), then leave. Income comes in two parts:

- **Admission fee** (on entry): flat 5g base, scaled by visitor type multiplier and income upgrades/research
- **Donation** (on exit): satisfaction-based tip calculated from average animal happiness, total animal appeal (modified by visitor type preferences), enrichment appeal bonuses, season bonuses, gift shop upgrade, and tour guide staff multipliers

Visitor types: Family, Tourist, Photographer, School, VIP — each with different income multipliers, species/rarity preferences, and stay durations.

### Staff

4 hirable roles with daily salaries:

| Role | Hire Cost | Salary | Effect |
|---|---|---|---|
| Volunteer | 50g | 10g/day | Auto-feeds one random habitat |
| Caretaker | 150g | 30g/day | Auto-feeds all animals |
| Veterinarian | 200g | 40g/day | Heals animals, auto-cures illness |
| Tour Guide | 100g | 25g/day | +25% visitor income |

Volunteers, caretakers, and vets can walk freely into habitats. Tour guides avoid habitats the same way visitors do.

If you can't afford salaries at the start of a day, staff leave automatically.

### Rescue Missions

Send expeditions to 5 biomes (Urban, Coastline, Wetlands, Deep Forest, Mountains). Each has a cost, duration, and species pool. Missions run on a timer and can result in finding an animal (65%), supplies/coins (25%), or nothing (10%). Max 2 active missions at once.

### Enrichments

Place items in habitats to boost animal happiness and visitor appeal:

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
- **Manual save**: SAVE button in top bar
- **Export**: download save as JSON file
- Save format version is tracked (`v: 4`) for migration compatibility
- `Set` objects (upgrades, discoveries, achievements, research) are serialized as arrays

---

## Tech Stack

- **Phaser 3.80.1** (loaded from CDN) — game engine
- **ES Modules** — all JS uses `import`/`export` with `type="module"` in the script tag
- **Web Audio API** — procedural sound effects
- **Google Fonts** — "Press Start 2P" for pixel-art typography
- **localStorage** — game save persistence
- **No build tools** — pure vanilla JS, served as static files
