# Havenwood — Systems Reference

**18,381 lines of vanilla JS** | Phaser 3.80.1 | Zero external assets (all procedural)

---

## Architecture Overview

Havenwood is a dual-world browser game where players switch between two modes via a "phone" mechanic:

1. **Sanctuary Mode** — Top-down animal sanctuary sim. Build habitats, rescue animals, manage visitors and staff, conduct research.
2. **Meta-World Mode** — Campus-life RPG. Attend classes, work jobs, befriend NPCs, complete quests, play minigames.

Progress in one world feeds the other via 16 bidirectional cross-mode unlocks.

### Tech Stack

- Phaser 3.80.1 (CDN), vanilla JS ES modules, no bundler
- All textures procedurally generated (`SpriteGenerator` + `MetaSpriteGenerator`)
- All sound procedurally synthesized (`SoundManager` via Web Audio API)
- `localStorage` for persistence
- Single HTML entry point, minimal CSS (pixel-art rendering)

### Scene Graph

```
BootScene → MenuScene
                ├─→ GameScene + HUDScene (sanctuary)
                │        │
                │   TransitionScene (phone zoom, first time only)
                │        │
                └─→ MetaWorldScene + MetaHUDScene (meta-world)
```

### Cross-Scene Communication

- `game.events` emitter for cross-scene events (`showAnimalInfo`, `rescueAccepted`, `buildModeChanged`, `metaTimeUpdate`, etc.)
- `HUDScene.gs` holds a direct reference to `GameScene` for state/method access
- `MetaHUDScene` accesses `MetaWorldScene` and `GameScene` via `this.scene.get()`

### State Management

- **Sanctuary state**: `GameScene.state` — coins, rep, food, day, time, season, habitats[], animals[], staff[], facilities[], decorations[], missions, research, discoveries, upgrades, achievements
- **Meta-world state**: `MetaState` singleton (`MetaStateManager.js`) — day, timeOfDay, energy, mood, money, knowledge, inventory, friendships, quests, flags, weather
- **Save format**: `havenwood_save` (v5) for sanctuary; `havenwood_meta` (v1) for meta-world. Both in `localStorage`.
- **Mode tracking**: Save includes `mode` field (`'havenwood'`|`'meta'`) so load restores the correct scene pair

---

## File Map

| File | Lines | Purpose |
|------|-------|---------|
| `js/scenes/GameScene.js` | 4,978 | Core sanctuary simulation |
| `js/scenes/MetaWorldScene.js` | 2,518 | Meta-world gameplay |
| `js/scenes/HUDScene.js` | 2,058 | Sanctuary UI overlay |
| `js/SpriteGenerator.js` | 1,269 | Sanctuary texture generation |
| `js/MetaSpriteGenerator.js` | 1,189 | Meta-world texture generation |
| `js/MetaNPCs.js` | 832 | NPC definitions, schedules, dialogue |
| `js/scenes/MenuScene.js` | 733 | Title screen with easter eggs |
| `js/scenes/MetaHUDScene.js` | 700 | Meta-world UI overlay |
| `js/MetaLocations.js` | 470 | Room/area tilemaps |
| `js/QuizQuestions.js` | 433 | 400 quiz questions (4 categories) |
| `js/MetaClassQuiz.js` | 430 | Quiz minigame |
| `js/PingPongGame.js` | 385 | Ping pong minigame |
| `js/GameData.js` | 356 | All sanctuary constants/balancing |
| `js/MetaStateManager.js` | 324 | Meta-world state singleton |
| `js/MetaEvents.js` | 312 | Scripted + random campus events |
| `js/MetaQuests.js` | 230 | 8 quests with step tracking |
| `js/MetaDialogue.js` | 224 | Dialogue overlay system |
| `js/MetaCrossModeUnlocks.js` | 192 | Bidirectional reward transfers |
| `js/SoundManager.js` | 182 | Procedural audio synthesis |
| `js/MetaFriendshipMilestones.js` | 164 | Friendship threshold rewards |
| `js/MetaBulletinBoard.js` | 120 | Rotating daily bulletin content |
| `js/MetaJobs.js` | 119 | Part-time work system |
| `js/scenes/TransitionScene.js` | 110 | Phone zoom-out animation |
| `js/main.js` | 31 | Phaser config + game instance |
| `js/scenes/BootScene.js` | 22 | Font load + texture generation |

---

## Sanctuary Systems

### Grid & Building System

- **Grid**: 30x20 tiles at 32px each. 2D array `this.grid[y][x]` tracks occupancy: `null` (empty), `'fence'`, `'entrance'`, `'hab_xxx'`, `'fac_xxx'`, `'dec_xxx'`
- **Border**: Fence perimeter with entrance gap at bottom-center (cols 13-16)
- **Build preview**: Green/red placement overlay with outline. Decorations support drag-placement.
- **Zoom**: Click a habitat or facility to zoom to 2.5x with cross-navigation between adjacent buildings

### Habitats

| Type | Size | Capacity | Compatible Species |
|------|------|----------|--------------------|
| Meadow | 5x4 | 3 | mammal_small, bird |
| Forest | 5x5 | 4 | mammal_large, mammal_small |
| Pond | 4x4 | 3 | aquatic, amphibian, bird |
| Barn | 4x4 | 5 | domestic |

### Animals

**14 species across 4 rarity tiers:**

| Rarity | Weight | Species |
|--------|--------|---------|
| Common | 50% | cat, dog, rabbit, deer, duck |
| Uncommon | 30% | fox, owl, turtle, butterfly, hedgehog |
| Rare | 15% | bear_cub, snowy_owl, arctic_fox |
| Legendary | 5% | phoenix_chick |

**Per-animal state:** hunger, happiness, health (0-100), bondXP, bondLevel, bonds[], trait, generation, gender, variantIdx, illness, pregnant, cooldown, baby flag, lonelyTimer

**6 personality traits** affect stat decay rates: playful, shy, grumpy, social, curious, lazy

**4 illnesses** with treatment costs and durations: cold, injury, stomach_bug, fatigue

**Breeding:**
- Auto-checks every 15 seconds
- Requirements: same species, same habitat, opposite gender, not baby/pregnant/cooldown/ill, habitat has capacity
- 6% base chance (12% with research)
- Female carries for 3 game-days
- Some variants are breed-only with specific parent pair requirements

**Bond system:** Treats give bond XP scaled by rarity. Higher bond = happiness bonus. Animals with bonded partners in the same habitat get social bonuses.

**Death** occurs at health <= 0.

### Visitors

**5 visitor types:**

| Type | Spawn Weight | Income Mult | Notes |
|------|-------------|-------------|-------|
| Family | 40% | 1.0x | — |
| Tourist | 25% | 1.2x | — |
| Photographer | 15% | 2.0x | 1.4x stay duration |
| School | 15% | 0.7x | 0.7x stay duration |
| VIP | 5% | 3.0x | Requires 100 rep |

**4 NPC visitors** from meta-world (Sam, Elara, Tanaka, Riley) — gated by friendship levels, with visit cooldowns

- 8-direction A* pathfinding to viewing spots
- Phase state machine: `entering → seeking → viewing → leaving` (with branches for guide tours, gift shop, bathroom, confusion)
- Visitor reactions to animal care affect reputation (+/- 1)
- Max ~8 concurrent, spawn window 8am-6pm only

### Staff

| Role | Cost | Behavior |
|------|------|----------|
| Volunteer | Free | Feeds animals |
| Vet | Hire + salary | Heals and cures illness |
| Tour Guide | Hire + salary | Collects visitor groups, leads tours |
| Gardener | Hire + salary | Auto-harvests garden produce |
| Janitor | Hire + salary | Picks up trash, empties trashcans |

All staff use phase-based AI with A* pathfinding.

### Facilities

| Facility | Size | Function |
|----------|------|----------|
| Garden | 3x4 | Grows 12 produce items (tomato, carrot, cabbage). 8-hour regrow timer. |
| Gift Shop | 3x3 | Visitors browse before leaving, generates income |
| Bathroom | 2x2 | Dirtiness accumulates over time. Janitor or player cleans. |

### Decorations

24 types across 4 categories: Flowers, Greenery, Flooring, Utilities. Click-and-drag placement. Paths are walkable. Trashcans collect visitor trash.

### Enrichments

6 habitat add-ons: scratching_post, bird_bath, log_pile, rock_garden, toy_ball, cozy_bed. Each has cost, compatible habitats, and happiness bonus.

### Season & Time

- 1440 minutes/day cycle, 3 time speeds (tortoise / normal / hare)
- 4 seasons x 7 days = 28-day year

| Season | Visitor Mult | Income Mult | Hunger Mult | Build Cost | Particles | Special |
|--------|-------------|-------------|-------------|------------|-----------|---------|
| Spring | 1.0x | 1.0x | 1.0x | 1.0x | Petals | — |
| Summer | 1.2x | 1.0x | 1.0x | -10% | Fireflies | Butterflies spawn |
| Autumn | 1.0x | 1.3x | +20% | 1.0x | Leaves | Hedgehogs spawn |
| Winter | 0.7x | 1.0x | -20% | 1.0x | Snow | Snowy owl, arctic fox spawn |

### Research Tree

4 branches x 4 tiers = 16 nodes. Effects checked via `hasResearch(effectId)`.

| Branch | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|--------|--------|--------|--------|--------|
| Wildlife Biology | Habitat capacity +1 | Rescue odds boost | Seasonal animals | Legendary access |
| Veterinary Science | Feeding efficiency | Illness resistance | Breeding boost | Neonatal care |
| Ecology & Enrichment | Enrichment slots | Season bonus boost | Habitat harmony | Ecosystem mastery |
| Public Outreach | Visitor frequency | VIP access | Gift shop income | Max reputation boost |

### Rescue Missions

5 biomes with species pools, costs, and durations:

| Biome | Species | Cost |
|-------|---------|------|
| Urban | cat, dog, rabbit | Low |
| Coastal | duck, turtle, butterfly | Low |
| Wetland | duck, turtle, owl | Medium |
| Forest | deer, fox, bear_cub, hedgehog, owl | Medium |
| Mountain | bear_cub, snowy_owl, arctic_fox, phoenix_chick | High |

Rescue events are fully modal: pause game time, block all input, show story text + animal preview. Accept/Decline choice.

---

## Meta-World Systems

### Locations

Tile-based rooms with data-driven layouts from `MetaLocations.js`:
- **Tile types**: 0=floor, 1=wall, 2=wall_window, 3=grass, 4=stone_path, 5=exterior_wall, 9=door (walkable)
- **Indoor rooms**: 14x10 grid, 1.35x zoom
- **Outdoor areas**: 23x15 grid, fills screen between HUD bars

Rooms: Bedroom, Hallway, Common Room, Classroom, Campus Quad (outdoor), Library, Park (outdoor), Pet Store, Cafe

Door system provides bidirectional routing between rooms with spawn position targets.

### Player Character

- 4-direction sprites with walk animation frames + phone-holding sprite
- WASD/arrow key movement with 8-direction support
- Collision detection against walls, furniture, and interactables
- Energy decay tied to activity

### NPCs

**4 characters with schedules, weather awareness, and gift preferences:**

| NPC | Role | Gift Love | Gift Like |
|-----|------|-----------|-----------|
| Prof. Elara | Wildlife Biology teacher | book | coffee |
| Sam | Study buddy | coffee | flower |
| Mr. Tanaka | Pet store shopkeeper | treat | flower |
| Riley | Athlete, ping pong | flower | treat |

- Schedule-driven: different locations by time-of-day, day-of-week, and weather
- A* pathfinding within rooms, wandering behavior when idle
- Off-screen transit tracking with wall-clock anchors for cross-room travel
- Rainy/snowy weather redirects outdoor NPCs to indoor fallbacks

### Friendship System

- Friendship 0-100 per NPC, 4 tiers:
  - Stranger (<20), Acquaintance (20+), Friend (50+), Close (80+)
- Gifts: LOVE = +12, LIKE = +6, NEUTRAL = +3 friendship
- Custom reaction dialogue for each gift/NPC combination

**9 milestones (3 per NPC at thresholds 50 and 80):**

| NPC | Threshold | Flag | Effect |
|-----|-----------|------|--------|
| Sam | 50 | `sam_study_spot` | Study bonus (dialogue) |
| Sam | 80 | `sam_best_friend` | +20 mood, +$25 |
| Elara | 50 | `elara_extra_credit` | +10 knowledge |
| Elara | 80 | `elara_research_partner` | +5 knowledge/day passive |
| Tanaka | 50 | `tanaka_insider` | +$15, +10 mood |
| Tanaka | 80 | `tanaka_discount` | 20% price/pay bonus |

### Quest System

**8 quests with mixed trigger types:**

| Quest | Trigger | Type |
|-------|---------|------|
| welcome_to_campus | Auto-start | Tutorial |
| study_buddy | Elara friendship 20+ | Condition |
| top_student | 3+ classes attended | Condition |
| regular_customer | Tanaka friendship 15+ | Condition |
| campus_socialite | Any NPC friendship 50+ | Condition |
| lost_textbook | Bulletin board | Manual |
| campus_cleanup | Bulletin board | Manual |
| book_donations | Bulletin board | Manual |

Step-based progress with check() functions. Rewards: money, mood, knowledge, energy + custom completion handlers.

### Job System

| Activity | Energy | Time | Base Pay | Friendship Gate |
|----------|--------|------|----------|-----------------|
| Stock Shelves | 20 | 90min | $25 | None |
| Sort Mail | 15 | 60min | $20 | None |
| Assist Animals | 30 | 120min | $40 | Tanaka 30+ |
| Manage Inventory | 25 | 90min | $35 | Tanaka 60+ |

- Performance rating: 15-84 base roll + mood/knowledge/friendship bonuses
- Rating tiers: poor (0.7x), ok (1.0x), good (1.2x), excellent (1.5x)
- One job per day. Energy costs double after 10 PM.

### Event System

**4 scripted events (28-day cycle):**

| Day | Event | Location |
|-----|-------|----------|
| 7 | Wildlife Fair | Campus Quad |
| 14 | Campus Festival | Campus Quad |
| 21 | Midterm Week | Classroom |
| 28 | Founder's Day | Campus Quad |

**9 random event types** with weighted probabilities (42-weight "none" means most days are event-free): bake_sale, guest_lecture, lost_cat, book_fair, food_truck, study_group, etc.

Events override NPC locations and spawn temporary interactables with energy costs and rewards.

### Minigames

**Class Quiz** (`MetaClassQuiz.js`):
- 10 questions from 4 categories: Animal Facts, Machine Learning, Havenwood, Startup History (100 questions each)
- Compete vs Sam AI (60% correct rate)
- Knowledge reward = score x 1.5

**Ping Pong** (`PingPongGame.js`):
- Real-time first-to-5 game vs Riley
- Ball accelerates per volley (+15 px/s)
- Win = +15 mood / +10 friendship, Loss = +5 mood / +6 friendship

### Bulletin Board

Rotating daily content from `MetaBulletinBoard.js`:
1. Event announcements (if active)
2. Campus news (10 items, rotated by day seed)
3. NPC gossip (6 items, gated by friendship thresholds)
4. Havenwood tips (8 sanctuary management tips)
5. Help wanted (3 quest posts with unlock conditions)

Deterministic seeded selection ensures same day always shows same content.

---

## Cross-Mode Integration

### Transition Mechanic

- **First time**: Cinematic zoom-out from sanctuary into phone-in-hand (1800ms, screenshot shrink via `TransitionScene`)
- **Subsequent**: Instant scene swap
- `game._hasZoomedOut` flag tracks whether cinematic has played

### Cross-Mode Unlocks

**11 Meta → Sanctuary:**

| Unlock | Condition | Reward |
|--------|-----------|--------|
| wildlife_101 | 1+ class | +2 research |
| job_premium | 1+ shift | +50 coins |
| study_grant | 3+ classes | +5 research |
| employee_perks | 3+ shifts | +100 food |
| social_network | 3+ NPCs met | +50 rep |
| knowledge_mastery | 50+ knowledge | +10 research |
| close_friends | 2+ NPCs at friendship 80+ | +8 research, +100 coins |
| quest_master | 3+ quests completed | +100 rep, +200 food |
| park_naturalist | 3+ flowers in inventory | +75 food |
| campus_cook | 100+ pending food | +75 coins |
| job_savings | $100+ earned | +50% of earnings as coins |

**5 Sanctuary → Meta:**

| Unlock | Condition | Reward |
|--------|-----------|--------|
| sanctuary_rep | 100+ rep | +20 mood |
| animal_lover | 5+ animals | +15 mood, +$25 |
| sanctuary_scholar | 10+ animals | +15 knowledge, +$40 |
| npc_ambassador | 3+ NPC visits | +10 mood, +$30 |
| happy_animals | 300+ rep | +25 mood, +20 energy |

All unlocks are one-time grants, checked at mode transitions.

### Other Bridges

- **Sanctuary snapshot** (`MetaState.sanctuarySnapshot`): animal/habitat/rep/coin counts fed to NPC dialogue context
- **NPC sanctuary visits**: Meta NPCs appear as special visitors in sanctuary, gated by friendship
- **Pending resources**: `pendingFood` / `pendingTreats` accumulated in meta-world, applied on switch to sanctuary
- **Phone notifications**: Queue bridges both worlds

---

## Procedural Generation

### Sprites (`SpriteGenerator.js` + `MetaSpriteGenerator.js`)

All textures generated at boot via Phaser Graphics API:
- **Sanctuary**: terrain tiles (grass variants, paths, fences), 14 animal species with color variants, 5 visitor types + 4 NPC visitors, 5 staff types, UI icons (coin, heart, 11 emotion faces, sick/bond/baby/food/research icons), seasonal particles, 6 enrichments, 24+ decorations
- **Meta-world**: 4-direction character with walk frames + phone sprite, room/outdoor tiles (wood, carpet, grass, stone, brick), 20+ furniture pieces, 4 NPC characters with distinctive clothing, weather particles

### Audio (`SoundManager.js`)

All sound synthesized from oscillators and white noise (Web Audio API):
- 13 sound effects: coin, build, feed, pet, treat, rescue, notify, error, click, upgrade, seasonal, newDay, chirp
- Ambient bird chirps on timer (denser during daytime, sparser at night)

---

## Input Systems

### Sanctuary (GameScene)

- **Build mode**: Preview placement with green/red overlay, drag for decorations
- **Zoom**: Click habitat/facility to zoom 2.5x, scroll wheel to zoom in/out
- **Interaction**: Click animals (select), click produce (harvest), click trash (pick up)
- **ESC priority chain**: settings → rescue → select → move → panels → zoom → build → settings toggle
- **Right-click**: Exits build/move/panels/zoom modes

### Meta-World (MetaWorldScene)

- **WASD / Arrow keys**: 8-direction movement with collision
- **E**: Toggle phone (switch to sanctuary)
- **Q / Tab**: Quest log
- **I**: Inventory
- **N**: Phone notifications
- **ESC**: Settings / close panels

---

## Update Loop (GameScene)

**Guards**: Skips when `rescuePaused`, `settingsPaused`, `_movingHabitat`, `_habSelectMode`, or `buildMode`.

**Order**: updateTime → updateAnimals → updateVisitors → updateStaff → updateMissions → updateGardens → updateBathrooms → SFX ambient → rescue timing → auto-save

---

## Implementation Notes

- `cameras.main.setRoundPixels(true)` required on BOTH `GameScene` and `HUDScene` to prevent sub-pixel jitter
- Graphics objects that `clear()` + `fill()` every frame cause WebGL texture rebuild jitter — use positioned primitives instead
- Visitor/staff pathfinding recalculates on every build/placement change
- Timer callbacks have independent pause guards matching the main update loop
- Save/load must handle `Set` serialization (discoveries, upgrades, research, achievements)
- Build preview system tracks all moveable objects (gfx, decor, enrichments, animals) for live cursor following

---

## Known Bugs

1. **`sam_study_spot` passive unimplemented** — Flag set at Sam friendship 50 but `applyDailyPassives()` in `MetaFriendshipMilestones.js` has no handler for it. The dialogue promises a study bonus that never applies.

2. **Shopkeeper missing rainy weather redirect** — `getRainyRedirect()` in `MetaNPCs.js` handles Elara, Sam, and Riley but has no entry for Tanaka. If he's scheduled outdoors during rain, no redirect occurs.

3. **Asymmetric cross-mode API** — `checkMetaToHavenwood(gameState)` in `MetaCrossModeUnlocks.js` receives a gameState parameter to modify sanctuary state, but `checkHavenwoodToMeta()` takes no parameter and calls MetaState methods directly.

4. **Ping pong ball speed has no cap** — In `PingPongGame.js`, ball speed increases by 15 px/s per volley (`BALL_SPEED_BASE + volleyCount * BALL_SPEED_INC`) with no maximum. Late-game volleys become unreactable.

5. **`study_group` event has no interactables** — In `MetaEvents.js`, the study_group random event triggers but defines no interactables array, so the player can't interact with it.

6. **Inconsistent quest progress tracking** — `MetaQuests.js` mixes quest-specific progress objects with global MetaState counters. `getProgressLabel()` must special-case both patterns.
