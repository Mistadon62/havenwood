/**
 * GameScene - Core gameplay scene for Havenwood, a Phaser 3 animal sanctuary management game.
 * Handles map, building (habitats, decorations, facilities), habitat zoom view (with
 * auto-select, animal cycling, and cross-navigation between habitats and facilities by
 * clicking/hovering nearby ones while zoomed), facility zoom view (with clickable produce), animals,
 * goal-driven visitors (8-direction A* pathfinding, prefer dec_path/entrance tiles for
 * viewing spots and routes, "?" confused pause when leaving path network for off-path
 * habitats, react with speech bubbles, reputation per visit, paths recalculate on build changes),
 * phase-based staff AI (volunteers/vets walk into habitats via A* pathfinding,
 * perform localized work with heart animations; gardeners walk to adjacent tiles of
 * gardens and auto-harvest ready crops one by one, wandering around the garden when
 * idle; tour guides are player-placed anywhere on the map and wait at their post —
 * ~50% of visitors want a tour and walk to the guide, the guide accumulates a group
 * then leads them through all habitats with individual viewing spots using direct
 * staff-walkable routes, then returns the group to its post and releases them to
 * explore on their own — followers always trail behind the guide based on movement
 * direction), automatic breeding (trait inheritance, generation
 * tracking, name inheritance from same-gender parent, breed-only variant recipes with
 * fixed names), missions, research, time, seasons, rescue events (game-time driven,
 * fully modal with time-pause — spawning suppressed, persisted across save/load),
 * settings/pause menu (ESC from sanctuary or during rescue), auto-save (toggleable),
 * animal relocation, food system (starting food 100, gardens produce food over time),
 * bond XP/levels, friendship happiness buffs, loneliness debuffs, and save/load.
 * Facilities are zoomable multi-tile buildings (like gardens) that block walkability and
 * occupy grid space but hold no animals. Gardens contain 12 produce items (3 types × 4
 * each) that start unripe, grow over 8 in-game hours, can be clicked to harvest for food,
 * then regrow. Mini progress bars beneath each item are visible only when zoomed in.
 * Decorations show a sprite preview while placing and support click-and-drag for rapid
 * multi-tile placement. All placements (habitats, facilities, decorations) show a floating
 * gold cost indicator that rises and fades. Timer-based callbacks (bonds, breeding,
 * illness, achievements) have independent pause guards matching the main update loop.
 * Staff work is driven inline by phase-based AI, not by a separate timer.
 */
import { TILE, COLS, ROWS, W, H, MAP_Y, TIME_SCALE, START_COINS, HABITATS, SPECIES, RARITY_WEIGHT, RESCUE_MSG, CLR,
    SEASONS, SEASON_ORDER, SEASON_LENGTH, SEASON_CYCLE, UPGRADES, STAFF_TYPES,
    TRAITS, TRAIT_IDS, ILLNESSES, ENRICHMENTS, MISSIONS, VISITOR_TYPES, NPC_VISITOR_TYPES, ACHIEVEMENTS,
    RESEARCH, RESEARCH_BRANCHES, DECORATIONS, FACILITIES, GARDEN_PRODUCE, GARDEN_REGROW_TIME, BATHROOM_DIRTY_RATE, TRASH_DROP_CHANCE } from '../GameData.js';
import { SoundManager } from '../SoundManager.js';
import MetaState from '../MetaStateManager.js';

let uid = 0;
// Generates unique IDs for game entities (habitats, animals, staff, missions, trash) to avoid collisions.
function genId(prefix) { return `${prefix}_${Date.now().toString(36)}_${(uid++).toString(36)}`; }

const TRASH_PICKUP_RADIUS = 18;
const TRASH_GROSS_RADIUS = 28;

export default class GameScene extends Phaser.Scene {
    constructor() { super('GameScene'); }

    init(data) { this.isNewGame = data?.newGame !== false; }

    create() {
        // IMPORTANT: roundPixels must be set on BOTH GameScene and HUDScene cameras.
        // Without this, per-frame work (e.g. garden regrow timers) causes slight frame-timing
        // variations that expose sub-pixel rendering jitter. Because the HUD bars are
        // semi-transparent (alpha 0.9), any sub-pixel shifts in the GameScene layer underneath
        // bleed through, making HUD icons/text appear to gain/lose a pixel every ~500ms.
        // Phaser's pixelArt:true only sets roundPixels on the renderer config, not on individual
        // scene cameras — each camera needs setRoundPixels(true) explicitly.
        //
        // ADDITIONAL PITFALL: Graphics objects that call clear()+fill() every frame (e.g. trails,
        // dynamic shapes) also trigger sub-pixel jitter — each clear/redraw rebuilds the object's
        // internal WebGL texture, causing a pipeline state change that shifts rounding for other
        // objects. Use positioned primitives (Circle, Rectangle) instead of per-frame Graphics
        // redraws. See PingPongGame.js ball trail for the fix.
        this.cameras.main.setRoundPixels(true);
        this.sfx = new SoundManager();
        this.sfx.init();
        this.input.on('pointerdown', () => this.sfx.resume());

        this.state = {
            day: 1, time: 360, coins: START_COINS, rep: 50, food: 100,
            buildMode: null,
            habitats: [], animals: [], staff: [],
            discoveries: new Set(),
            seenVariants: new Set(),
            rescuedVariants: new Set(),
            upgrades: new Set(),
            achievementsEarned: new Set(),
            seasonsVisited: new Set(['spring']),
            stats: { rescued: 0, visitors: 0, earned: 0, bred: 0, missionsComplete: 0, healed: 0 },
            season: 'spring', prevSeason: 'spring',
            activeMissions: [],
            breedingPairs: [],
            researchPoints: 0,
            researchUnlocked: new Set(),
            viewingHabitat: null,
            viewingFacility: null,
            rescuePaused: false,
            settingsPaused: false,
            autoSave: true,
            decorations: [],
            facilities: [],
            trashcanFullness: {},
        };
        this.visitors = [];
        this.decorSprites = [];
        this.facilitySprites = [];
        this.staffSprites = [];
        this.grid = [];
        this.habitatDecoObjects = [];
        this.enrichmentSprites = [];
        this.trash = [];
        this._skipPointerDown = false;
        this.timeSpeedMult = 1;

        this.createMap();
        this.overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000033, 0).setDepth(100);
        this.seasonOverlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0).setDepth(99);
        this.preview = this.add.graphics().setDepth(60).setVisible(false);
        this.hoverOutline = this.add.graphics().setDepth(59).setVisible(false);

        this.setupParticles();
        this.setupInput();
        this.scene.launch('HUDScene');

        if (!this.isNewGame) this.loadGame();
        else { MetaState.reset(); this.game._hasZoomedOut = false; }
        this.updateSeason();
        const loadedMeta = this._loadedMode === 'meta';
        if (this.state.autoSave) {
            if (loadedMeta) this._saveMode = 'meta';
            this.saveGame();
            this._saveMode = null;
        }

        // If saved in meta-world mode, auto-transition to the room scene
        if (loadedMeta) {
            this._loadedMode = null;
            this.game._hasZoomedOut = true; // zoom already happened in a previous session
            MetaState.load(); // restore meta-world state
            this.time.delayedCall(100, () => {
                const hud = this.scene.get('HUDScene');
                if (hud && hud.closeAllPanels) hud.closeAllPanels(true);
                this.scene.sleep('GameScene');
                this.scene.sleep('HUDScene');
                this.scene.launch('MetaWorldScene', {
                    startWithPhone: false,
                    locationId: MetaState.state.currentLocation,
                    spawnGx: MetaState.state.playerTileX,
                    spawnGy: MetaState.state.playerTileY,
                });
                this.scene.launch('MetaHUDScene');
            });
        }

        this.rescueInterval = 50000;
        this._rescueAccum = this.rescueInterval - 4000;
        this._firstRescue = true;
        this._autoSaveAccum = 0;
        this.time.addEvent({ delay: 7000, callback: () => this.trySpawnVisitor(), loop: true });
        this.time.addEvent({ delay: 15000, callback: () => this.trySpawnNPCVisitor(), loop: true });
        this.time.addEvent({ delay: 10000, callback: () => this.checkIllness(), loop: true });
        this.time.addEvent({ delay: 8000, callback: () => this.updateBonds(), loop: true });
        this.time.addEvent({ delay: 15000, callback: () => this.checkAutoBreed(), loop: true });
        this.time.addEvent({ delay: 5000, callback: () => this.checkAchievements(), loop: true });
        // Reputation gain/loss is handled per-habitat visit in _visitorReact()

        this.game.events.on('rescueAccepted', this.acceptRescue, this);
    }

    /* ========== MAP ========== */
    // Builds the 2D grid: fence borders (horizontal top/bottom, vertical sides, corner pieces), entrance gap
    // with reserved path tiles in front, and grass variants.

    createMap() {
        const pad = 8;
        for (let y = -pad; y < ROWS + pad; y++) {
            if (y >= 0 && y < ROWS) this.grid[y] = [];
            for (let x = -pad; x < COLS + pad; x++) {
                const inGrid = y >= 0 && y < ROWS && x >= 0 && x < COLS;
                const px = x * TILE + TILE / 2, py = MAP_Y + y * TILE + TILE / 2;
                if (!inGrid) {
                    this.add.image(px, py, `grass_${((Math.abs(x) * 7 + Math.abs(y) * 13) % 4) + 1}`).setDepth(0);
                    continue;
                }
                const isBorder = y === 0 || y === ROWS - 1 || x === 0 || x === COLS - 1;
                const isEntrance = y === ROWS - 1 && x >= 13 && x <= 16;
                const isEntrancePath = y === ROWS - 2 && x >= 13 && x <= 16;
                this.grid[y][x] = (isEntrance || isEntrancePath) ? 'entrance' : isBorder ? 'fence' : null;
                if (isEntrance) {
                    this.add.image(px, py, `grass_${((x * 7 + y * 13) % 4) + 1}`).setDepth(0);
                } else if (isBorder) {
                    const isTop = y === 0, isBot = y === ROWS - 1;
                    const isLeft = x === 0, isRight = x === COLS - 1;
                    let fenceTex = 'fence';
                    if (isTop && isLeft) fenceTex = 'fence_tl';
                    else if (isTop && isRight) fenceTex = 'fence_tr';
                    else if (isBot && isLeft) fenceTex = 'fence_bl';
                    else if (isBot && isRight) fenceTex = 'fence_br';
                    else if (isLeft || isRight) fenceTex = 'fence_v';
                    this.add.image(px, py, fenceTex).setDepth(0);
                } else {
                    this.add.image(px, py, `grass_${((x * 7 + y * 13) % 4) + 1}`).setDepth(0);
                }
            }
        }
    }

    /* ========== PARTICLES ========== */
    // Seasonal ambient effects: snow, leaves, petals, fireflies (summer only).

    setupParticles() { this.seasonEmitter = null; this.fireflyEmitter = null; }

    updateSeasonParticles() {
        if (this.seasonEmitter) { this.seasonEmitter.destroy(); this.seasonEmitter = null; }
        if (this.fireflyEmitter) { this.fireflyEmitter.destroy(); this.fireflyEmitter = null; }
        const s = SEASONS[this.state.season];
        if (s.particle) {
            this.seasonEmitter = this.add.particles(0, MAP_Y - 10, s.particle, {
                x: { min: 0, max: W }, lifespan: this.state.season === 'winter' ? 7000 : 5000,
                speedY: { min: 12, max: this.state.season === 'winter' ? 35 : 25 },
                speedX: { min: -15, max: 15 }, scale: { min: 0.4, max: 1 },
                alpha: { start: 0.7, end: 0 },
                rotate: this.state.season === 'autumn' ? { min: 0, max: 360 } : 0,
                quantity: 1, frequency: this.state.season === 'winter' ? 150 : 400,
            }).setDepth(95);
        }
        if (this.state.season === 'summer') {
            this.fireflyEmitter = this.add.particles(0, 0, 'particle_firefly', {
                x: { min: 60, max: W - 60 }, y: { min: MAP_Y + 40, max: MAP_Y + ROWS * TILE - 80 },
                lifespan: 2500, speedY: { min: -6, max: 6 }, speedX: { min: -6, max: 6 },
                scale: { min: 0.3, max: 0.8 }, alpha: { start: 0.8, end: 0 },
                quantity: 1, frequency: 700,
            }).setDepth(95);
        }
    }

    /* ========== INPUT ========== */
    // Pointer move shows build preview in build mode (habitat, decoration, or facility); in default
    // mode, hovering over a habitat or facility shows a pointer cursor and faint stroke outline.
    // Decorations support click-and-drag: holding the pointer while moving places decorations on
    // each new tile entered (tracked by _lastDecorTile to avoid double-placement).
    // Pointerdown places buildable or zooms in; zooming into a habitat auto-selects a random animal,
    // zooming into a facility (garden) enables produce clicking. While zoomed into a facility,
    // hovering ripe produce shows pointer cursor and clicking harvests it.
    // Cross-navigation: while zoomed into any habitat or facility, hovering a *different* habitat
    // or facility shows a hover outline and pointer cursor; clicking navigates to it (pans camera,
    // updates panels). Clicking an animal in another habitat also navigates. Produce hover is
    // checked first so garden picking still works. Hovering an animal sprite while zoomed into a
    // habitat shows the pointer cursor. World clicks are otherwise suppressed while zoomed
    // (viewingHabitat/viewingFacility) or while a HUD management panel is open.
    // Wheel: scroll up over habitat/facility zooms in; scroll down when zoomed zooms out.
    // Right-click is intercepted at the DOM level (capture-phase mousedown) so Phaser never
    // processes it — no game object pointerdown handlers fire. _handleRightClick() then exits
    // build/move mode or closes open HUD panels. ESC priority: close settings → open settings
    // during rescue → cancel habitat select → cancel move → close panels → zoom out → exit build →
    // open settings. Browser context menu is suppressed on the canvas.

    setupInput() {
        this.game.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 2) {
                e.stopImmediatePropagation();
                this._handleRightClick();
            }
        }, true);

        this.input.on('pointermove', ptr => {
            if (ptr.y < MAP_Y) return;
            if (this.state.buildMode) {
                this.hoverOutline.setVisible(false);
                const gx = Math.floor(ptr.worldX / TILE), gy = Math.floor((ptr.worldY - MAP_Y) / TILE);
                const isDecor = this.state.buildMode.startsWith('decor_');
                const isFacility = this.state.buildMode.startsWith('facility_');

                if (this.state.buildMode === '_place_guide') {
                    const ok = this._canPlaceGuide(gx, gy);
                    const c = ok ? 0x00ff00 : 0xff0000;
                    if (this._guidePreview) {
                        this._guidePreview.setPosition(gx * TILE + TILE / 2, MAP_Y + gy * TILE + TILE / 2).setVisible(true);
                    }
                    this.preview.clear().setVisible(true);
                    this.preview.fillStyle(c, 0.25);
                    this.preview.fillRect(gx * TILE, MAP_Y + gy * TILE, TILE, TILE);
                    this.preview.lineStyle(2, c, 0.7);
                    this.preview.strokeRect(gx * TILE, MAP_Y + gy * TILE, TILE, TILE);
                    return;
                }

                if (isDecor) {
                    if (ptr.isDown && this.canPlaceDecor(gx, gy)) {
                        const key = `${gx},${gy}`;
                        if (this._lastDecorTile !== key) {
                            this._lastDecorTile = key;
                            this.placeDecor(this.state.buildMode.replace('decor_', ''), gx, gy);
                        }
                    }
                    const ok = this.canPlaceDecor(gx, gy);
                    const c = ok ? 0x00ff00 : 0xff0000;
                    if (this._decorPreview) {
                        this._decorPreview.setPosition(gx * TILE + TILE / 2, MAP_Y + gy * TILE + TILE / 2).setVisible(true);
                    }
                    this.preview.clear().setVisible(true);
                    this.preview.fillStyle(c, 0.25);
                    this.preview.fillRect(gx * TILE, MAP_Y + gy * TILE, TILE, TILE);
                    this.preview.lineStyle(2, c, 0.7);
                    this.preview.strokeRect(gx * TILE, MAP_Y + gy * TILE, TILE, TILE);
                    return;
                }

                if (isFacility) {
                    const facId = this.state.buildMode.replace('facility_', '');
                    const ft = FACILITIES[facId];
                    const fw = ft.w, fh = ft.h;
                    const fgx = gx - Math.floor(fw / 2), fgy = gy - Math.floor(fh / 2);
                    const ok = this.canPlaceFacility(facId, fgx, fgy);
                    const c = ok ? 0x00ff00 : 0xff0000;
                    if (this._buildPreview) {
                        const dx = fgx * TILE, dy = fgy * TILE;
                        for (const t of this._buildPreview.tracked) {
                            t.obj.setVisible(true);
                            if (t.isGfx) t.obj.setPosition(t.origX + dx, t.origY + dy);
                            else { t.obj.x = t.origX + dx; t.obj.y = t.origY + dy; }
                        }
                    }
                    this.preview.clear().setVisible(true);
                    this.preview.fillStyle(c, 0.25);
                    this.preview.fillRect(fgx * TILE, MAP_Y + fgy * TILE, fw * TILE, fh * TILE);
                    this.preview.lineStyle(2, c, 0.7);
                    this.preview.strokeRect(fgx * TILE, MAP_Y + fgy * TILE, fw * TILE, fh * TILE);
                    return;
                }

                if (this.state.buildMode.startsWith('_movefac_')) {
                    const facType = this.state.buildMode.replace('_movefac_', '');
                    const ft = FACILITIES[facType];
                    const fw = ft.w, fh = ft.h;
                    const fgx = gx - Math.floor(fw / 2), fgy = gy - Math.floor(fh / 2);
                    const ok = this.canPlaceFacilityMove(facType, fgx, fgy);
                    const c = ok ? 0x00ff00 : 0xff0000;
                    if (this._facMoveTracked) {
                        const dx = (fgx - this._facMoveOrigin.gx) * TILE;
                        const dy = (fgy - this._facMoveOrigin.gy) * TILE;
                        for (const t of this._facMoveTracked) {
                            if (t.isGfx) t.obj.setPosition(t.origX + dx, t.origY + dy);
                            else { t.obj.x = t.origX + dx; t.obj.y = t.origY + dy; }
                        }
                    }
                    this.preview.clear().setVisible(true);
                    this.preview.fillStyle(c, 0.25);
                    this.preview.fillRect(fgx * TILE, MAP_Y + fgy * TILE, fw * TILE, fh * TILE);
                    this.preview.lineStyle(2, c, 0.7);
                    this.preview.strokeRect(fgx * TILE, MAP_Y + fgy * TILE, fw * TILE, fh * TILE);
                    return;
                }

                const isMove = this.state.buildMode.startsWith('_move_');
                const habType = isMove ? this.state.buildMode.replace('_move_', '') : this.state.buildMode;
                const ht = HABITATS[habType];
                const hw = ht.w, hh = ht.h;
                const hgx = gx - Math.floor(hw / 2), hgy = gy - Math.floor(hh / 2);
                const ok = isMove ? this.canPlaceMove(habType, hgx, hgy) : this.canPlace(this.state.buildMode, hgx, hgy);
                const c = ok ? 0x00ff00 : 0xff0000;

                if (isMove && this._moveTracked) {
                    const dx = (hgx - this._moveOrigin.gx) * TILE;
                    const dy = (hgy - this._moveOrigin.gy) * TILE;
                    for (const t of this._moveTracked) {
                        if (t.isGfx) t.obj.setPosition(t.origX + dx, t.origY + dy);
                        else { t.obj.x = t.origX + dx; t.obj.y = t.origY + dy; }
                    }
                } else if (!isMove && this._buildPreview) {
                    const dx = hgx * TILE, dy = hgy * TILE;
                    for (const t of this._buildPreview.tracked) {
                        t.obj.setVisible(true);
                        if (t.isGfx) t.obj.setPosition(t.origX + dx, t.origY + dy);
                        else { t.obj.x = t.origX + dx; t.obj.y = t.origY + dy; }
                    }
                }

                this.preview.clear().setVisible(true);
                this.preview.fillStyle(c, 0.25);
                this.preview.fillRect(hgx * TILE, MAP_Y + hgy * TILE, hw * TILE, hh * TILE);
                this.preview.lineStyle(2, c, 0.7);
                this.preview.strokeRect(hgx * TILE, MAP_Y + hgy * TILE, hw * TILE, hh * TILE);
                return;
            }
            this.preview.setVisible(false);
            if (this._habSelectMode) {
                const gx = Math.floor(ptr.worldX / TILE), gy = Math.floor((ptr.worldY - MAP_Y) / TILE);
                if (gy >= 0 && gy < ROWS && gx >= 0 && gx < COLS) {
                    const cell = this.grid[gy]?.[gx];
                    if (cell && typeof cell === 'string' && cell.startsWith('hab_') && this._habSelectMode.compatIds?.has(cell)) {
                        const hab = this.state.habitats.find(h => h.id === cell);
                        if (hab) {
                            const ht = HABITATS[hab.type];
                            this.hoverOutline.clear().setVisible(true);
                            this.hoverOutline.lineStyle(3, 0x00ff88, 0.8);
                            this.hoverOutline.strokeRect(hab.gx * TILE, MAP_Y + hab.gy * TILE, (hab.w ?? ht.w) * TILE, (hab.h ?? ht.h) * TILE);
                            this.game.canvas.style.cursor = 'pointer';
                            return;
                        }
                    }
                }
                this.hoverOutline.setVisible(false);
                this.game.canvas.style.cursor = 'default';
                return;
            }
            if (this.state.viewingHabitat || this.state.viewingFacility) {
                const hud1 = this.scene.get('HUDScene');
                if (hud1 && hud1.isPointerOverPanel(ptr.x, ptr.y)) {
                    this.hoverOutline.setVisible(false);
                    this.game.canvas.style.cursor = 'default';
                    return;
                }
                if (this.state.viewingFacility) {
                    const fac = this.state.facilities.find(f => f.id === this.state.viewingFacility);
                    if (fac && fac.produce) {
                        const wx = ptr.worldX, wy = ptr.worldY;
                        const hitRadius = 6;
                        for (const slot of fac.produce) {
                            if (slot.picked) continue;
                            const dx = wx - slot.x, dy = wy - slot.y;
                            if (dx * dx + dy * dy < hitRadius * hitRadius) {
                                this.hoverOutline.setVisible(false);
                                this.game.canvas.style.cursor = 'pointer';
                                return;
                            }
                        }
                    }
                }
                const gx = Math.floor(ptr.worldX / TILE), gy = Math.floor((ptr.worldY - MAP_Y) / TILE);
                if (gy >= 0 && gy < ROWS && gx >= 0 && gx < COLS) {
                    const cell = this.grid[gy]?.[gx];
                    if (cell && typeof cell === 'string' && cell.startsWith('hab_') && cell !== this.state.viewingHabitat) {
                        const hab = this.state.habitats.find(h => h.id === cell);
                        if (hab) {
                            const ht = HABITATS[hab.type];
                            this.hoverOutline.clear().setVisible(true);
                            this.hoverOutline.lineStyle(2, ht.stroke, 0.5);
                            this.hoverOutline.strokeRect(hab.gx * TILE, MAP_Y + hab.gy * TILE, (hab.w ?? ht.w) * TILE, (hab.h ?? ht.h) * TILE);
                            this.game.canvas.style.cursor = 'pointer';
                            return;
                        }
                    }
                    if (cell && typeof cell === 'string' && cell.startsWith('fac_') && cell !== this.state.viewingFacility) {
                        const fac = this.state.facilities.find(f => f.id === cell);
                        if (fac) {
                            const ft = FACILITIES[fac.type];
                            this.hoverOutline.clear().setVisible(true);
                            this.hoverOutline.lineStyle(2, ft.stroke, 0.5);
                            this.hoverOutline.strokeRect(fac.gx * TILE, MAP_Y + fac.gy * TILE, (fac.w ?? ft.w) * TILE, (fac.h ?? ft.h) * TILE);
                            this.game.canvas.style.cursor = 'pointer';
                            return;
                        }
                    }
                }
                this.hoverOutline.setVisible(false);
                if (this.getTrashAt(ptr.worldX, ptr.worldY)) { this.game.canvas.style.cursor = 'pointer'; return; }
                const overAnimal = this.state.animals.some(a =>
                    a.sprite?.input?.enabled && a.sprite.getBounds().contains(ptr.worldX, ptr.worldY)
                );
                this.game.canvas.style.cursor = overAnimal ? 'pointer' : 'default';
                return;
            }
            const hud = this.scene.get('HUDScene');
            if (hud && hud.hasOpenPanel()) { this.hoverOutline.setVisible(false); this.game.canvas.style.cursor = 'default'; return; }
            if (this.getTrashAt(ptr.worldX, ptr.worldY)) { this.hoverOutline.setVisible(false); this.game.canvas.style.cursor = 'pointer'; return; }
            const gx = Math.floor(ptr.worldX / TILE), gy = Math.floor((ptr.worldY - MAP_Y) / TILE);
            if (gy >= 0 && gy < ROWS && gx >= 0 && gx < COLS) {
                const cell = this.grid[gy]?.[gx];
                if (cell && typeof cell === 'string' && cell.startsWith('hab_')) {
                    const hab = this.state.habitats.find(h => h.id === cell);
                    if (hab) {
                        const ht = HABITATS[hab.type];
                        this.hoverOutline.clear().setVisible(true);
                        this.hoverOutline.lineStyle(2, ht.stroke, 0.5);
                        this.hoverOutline.strokeRect(hab.gx * TILE, MAP_Y + hab.gy * TILE, ht.w * TILE, ht.h * TILE);
                        this.game.canvas.style.cursor = 'pointer';
                        return;
                    }
                }
                if (cell && typeof cell === 'string' && cell.startsWith('fac_')) {
                    const fac = this.state.facilities.find(f => f.id === cell);
                    if (fac) {
                        const ft = FACILITIES[fac.type];
                        this.hoverOutline.clear().setVisible(true);
                        this.hoverOutline.lineStyle(2, ft.stroke, 0.5);
                        this.hoverOutline.strokeRect(fac.gx * TILE, MAP_Y + fac.gy * TILE, ft.w * TILE, ft.h * TILE);
                        this.game.canvas.style.cursor = 'pointer';
                        return;
                    }
                }
            }
            this.hoverOutline.setVisible(false);
            this.game.canvas.style.cursor = 'default';
        });

        this.input.on('pointerdown', ptr => {
            if (this._habSelectMode) {
                const gx = Math.floor(ptr.worldX / TILE), gy = Math.floor((ptr.worldY - MAP_Y) / TILE);
                if (gy >= 0 && gy < ROWS && gx >= 0 && gx < COLS) {
                    const cell = this.grid[gy]?.[gx];
                    if (cell && typeof cell === 'string' && cell.startsWith('hab_') && this._habSelectMode.compatIds?.has(cell)) {
                        const hab = this.state.habitats.find(h => h.id === cell);
                        if (hab) {
                            const select = this._habSelectMode.onSelect;
                            this._exitHabitatSelect();
                            if (select) select(hab);
                        }
                    }
                }
                return;
            }
            if (this._skipPointerDown) { this._skipPointerDown = false; return; }
            if (this.state.rescuePaused) return;
            if (this.state.viewingFacility) {
                const hud0 = this.scene.get('HUDScene');
                if (hud0 && hud0.isPointerOverPanel(ptr.x, ptr.y)) return;
                const t0 = this.getTrashAt(ptr.worldX, ptr.worldY);
                if (t0) { this.pickUpTrash(t0.id); return; }
                const fac = this.state.facilities.find(f => f.id === this.state.viewingFacility);
                if (fac && fac.produce) {
                    const wx = ptr.worldX, wy = ptr.worldY;
                    const hitRadius = 6;
                    for (const slot of fac.produce) {
                        if (slot.picked) continue;
                        const dx = wx - slot.x, dy = wy - slot.y;
                        if (dx * dx + dy * dy < hitRadius * hitRadius) {
                            this.pickProduce(fac, slot);
                            return;
                        }
                    }
                }
                const gx = Math.floor(ptr.worldX / TILE), gy = Math.floor((ptr.worldY - MAP_Y) / TILE);
                if (gy >= 0 && gy < ROWS && gx >= 0 && gx < COLS) {
                    const cell = this.grid[gy]?.[gx];
                    if (cell && typeof cell === 'string' && cell.startsWith('hab_')) {
                        const hab = this.state.habitats.find(h => h.id === cell);
                        if (hab) {
                            this.sfx.click();
                            this.zoomToHabitat(hab);
                            this.game.events.emit('showHabitatInfo', hab);
                            const habAnimals = this.state.animals.filter(a => a.habitatId === hab.id);
                            if (habAnimals.length > 0) {
                                this.selectAnimal(Phaser.Utils.Array.GetRandom(habAnimals));
                            }
                            return;
                        }
                    }
                    if (cell && typeof cell === 'string' && cell.startsWith('fac_') && cell !== this.state.viewingFacility) {
                        const navFac = this.state.facilities.find(f => f.id === cell);
                        if (navFac) { this.sfx.click(); this.zoomToFacility(navFac); return; }
                    }
                }
                return;
            }
            if (this.state.viewingHabitat) {
                const hud0 = this.scene.get('HUDScene');
                if (hud0 && hud0.isPointerOverPanel(ptr.x, ptr.y)) return;
                const t1 = this.getTrashAt(ptr.worldX, ptr.worldY);
                if (t1) { this.pickUpTrash(t1.id); return; }
                const gx = Math.floor(ptr.worldX / TILE), gy = Math.floor((ptr.worldY - MAP_Y) / TILE);
                if (gy >= 0 && gy < ROWS && gx >= 0 && gx < COLS) {
                    const cell = this.grid[gy]?.[gx];
                    if (cell && typeof cell === 'string' && cell.startsWith('hab_') && cell !== this.state.viewingHabitat) {
                        const hab = this.state.habitats.find(h => h.id === cell);
                        if (hab) {
                            this.sfx.click();
                            this.zoomToHabitat(hab);
                            this.game.events.emit('showHabitatInfo', hab);
                            const habAnimals = this.state.animals.filter(a => a.habitatId === hab.id);
                            if (habAnimals.length > 0) {
                                this.selectAnimal(Phaser.Utils.Array.GetRandom(habAnimals));
                            } else {
                                this.clearSelectedAnimal();
                            }
                            return;
                        }
                    }
                    if (cell && typeof cell === 'string' && cell.startsWith('fac_')) {
                        const navFac = this.state.facilities.find(f => f.id === cell);
                        if (navFac) { this.sfx.click(); this.clearSelectedAnimal(); this.zoomToFacility(navFac); return; }
                    }
                }
                return;
            }
            const hud = this.scene.get('HUDScene');
            if (hud && hud.hasOpenPanel()) return;
            if (this.state.buildMode) {
                const gx = Math.floor(ptr.worldX / TILE), gy = Math.floor((ptr.worldY - MAP_Y) / TILE);
                if (this.state.buildMode === '_place_guide') {
                    if (this._canPlaceGuide(gx, gy)) this._finishGuidePlacement(gx, gy);
                } else if (this.state.buildMode.startsWith('decor_')) {
                    if (this.canPlaceDecor(gx, gy)) {
                        this._lastDecorTile = `${gx},${gy}`;
                        this.placeDecor(this.state.buildMode.replace('decor_', ''), gx, gy);
                    }
                } else if (this.state.buildMode.startsWith('facility_')) {
                    const facId = this.state.buildMode.replace('facility_', '');
                    const ft = FACILITIES[facId];
                    const fw = ft.w, fh = ft.h;
                    const fgx = gx - Math.floor(fw / 2), fgy = gy - Math.floor(fh / 2);
                    if (this.canPlaceFacility(facId, fgx, fgy)) { this.placeFacility(facId, fgx, fgy); this.exitBuild(); }
                } else if (this._movingFacility) {
                    const facType = this.state.buildMode.replace('_movefac_', '');
                    const ft = FACILITIES[facType];
                    const fw = ft.w, fh = ft.h;
                    const fgx = gx - Math.floor(fw / 2), fgy = gy - Math.floor(fh / 2);
                    if (this.canPlaceFacilityMove(facType, fgx, fgy)) this.finishFacilityMove(fgx, fgy);
                } else if (this._movingHabitat) {
                    const habType = this.state.buildMode.replace('_move_', '');
                    const ht = HABITATS[habType];
                    const hw = ht.w, hh = ht.h;
                    const hgx = gx - Math.floor(hw / 2), hgy = gy - Math.floor(hh / 2);
                    if (this.canPlaceMove(habType, hgx, hgy)) this.finishMove(hgx, hgy);
                } else {
                    const ht = HABITATS[this.state.buildMode];
                    if (ht) {
                        const hw = ht.w, hh = ht.h;
                        const hgx = gx - Math.floor(hw / 2), hgy = gy - Math.floor(hh / 2);
                        if (this.canPlace(this.state.buildMode, hgx, hgy)) { this.placeHabitat(this.state.buildMode, hgx, hgy); this.exitBuild(); }
                    }
                }
            } else {
                const t = this.getTrashAt(ptr.worldX, ptr.worldY);
                if (t) {
                    this.pickUpTrash(t.id);
                    return;
                }
                const gx = Math.floor(ptr.worldX / TILE), gy = Math.floor((ptr.worldY - MAP_Y) / TILE);
                if (gy >= 0 && gy < ROWS && gx >= 0 && gx < COLS) {
                    const cell = this.grid[gy]?.[gx];
                    if (cell && typeof cell === 'string' && cell.startsWith('hab_')) {
                        const hab = this.state.habitats.find(h => h.id === cell);
                        if (hab) {
                            this.sfx.click();
                            this.zoomToHabitat(hab);
                            this.game.events.emit('showHabitatInfo', hab);
                            const habAnimals = this.state.animals.filter(a => a.habitatId === hab.id);
                            if (habAnimals.length > 0) {
                                const pick = Phaser.Utils.Array.GetRandom(habAnimals);
                                this.selectAnimal(pick);
                            }
                        }
                    } else if (cell && typeof cell === 'string' && cell.startsWith('fac_')) {
                        const fac = this.state.facilities.find(f => f.id === cell);
                        if (fac) {
                            this.sfx.click();
                            this.zoomToFacility(fac);
                        }
                    }
                }
            }
        });

        this.input.on('wheel', (pointer, _go, _dx, deltaY) => {
            if (this.state.buildMode || this._habSelectMode || this._movingHabitat || this._movingFacility || this.state.rescuePaused) return;
            const hud = this.scene.get('HUDScene');
            if (hud && hud.isPointerOverPanel(pointer.x, pointer.y)) return;

            const worldPt = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
            const gx = Math.floor(worldPt.x / TILE), gy = Math.floor((worldPt.y - MAP_Y) / TILE);

            if (deltaY < 0) {
                if (!this.state.viewingHabitat && !this.state.viewingFacility && gy >= 0 && gy < ROWS && gx >= 0 && gx < COLS) {
                    const cell = this.grid[gy]?.[gx];
                    if (cell && typeof cell === 'string' && cell.startsWith('hab_')) {
                        const hab = this.state.habitats.find(h => h.id === cell);
                        if (hab) { this.sfx.click(); this.zoomToHabitat(hab); this.game.events.emit('showHabitatInfo', hab); }
                    } else if (cell && typeof cell === 'string' && cell.startsWith('fac_')) {
                        const fac = this.state.facilities.find(f => f.id === cell);
                        if (fac) { this.sfx.click(); this.zoomToFacility(fac); }
                    }
                }
            } else if (deltaY > 0 && (this.state.viewingHabitat || this.state.viewingFacility)) {
                this.sfx.click();
                this.zoomOut();
            }
        });

        this.input.keyboard.on('keydown-ESC', () => {
            const hud = this.scene.get('HUDScene');
            if (hud && hud.settingsPanel) { hud.closeSettingsMenu(); return; }
            if (this.state.rescuePaused) { if (hud) hud.toggleSettingsMenu(); return; }
            if (this._habSelectMode) {
                const cancel = this._habSelectMode.onCancel;
                this._exitHabitatSelect();
                if (cancel) cancel();
                return;
            }
            if (this._movingHabitat) { this.cancelMove(); return; }
            if (this._movingFacility) { this.cancelFacilityMove(); return; }
            if (hud && hud.hasOpenPanel()) { hud.closeAllPanels(); return; }
            if (this.state.viewingHabitat || this.state.viewingFacility || this.cameras.main.zoom > 1) this.zoomOut();
            else if (this.state.buildMode) this.exitBuild();
            else if (hud) hud.toggleSettingsMenu();
        });

        this.input.keyboard.on('keydown-E', () => {
            const hud = this.scene.get('HUDScene');
            if (!hud) return;
            // Don't switch if a menu/panel is open or in a special mode
            if (hud.settingsPanel) return;
            if (this.state.rescuePaused || this._habSelectMode || this._movingHabitat || this._movingFacility) return;
            if (this.state.buildMode) return;
            hud.triggerPhoneTransition();
        });

        this.game.canvas.addEventListener('contextmenu', e => e.preventDefault());
    }

    // Consolidated right-click handler, invoked from a DOM capture-phase listener so that
    // Phaser never sees the mousedown and no game object pointerdown handlers fire.
    _handleRightClick() {
        if (this._habSelectMode) {
            const cancel = this._habSelectMode.onCancel;
            this._exitHabitatSelect();
            if (cancel) cancel();
            return;
        }
        if (this._movingHabitat) { this.cancelMove(); return; }
        if (this._movingFacility) { this.cancelFacilityMove(); return; }
        if (this.state.buildMode) { this.exitBuild(); return; }
        const hud = this.scene.get('HUDScene');
        if (hud && hud.hasOpenPanel()) { hud.closeAllPanels(); return; }
        if (this.state.viewingHabitat || this.state.viewingFacility) this.zoomOut();
    }

    /* ========== HABITAT / FACILITY ZOOM ========== */
    // Zoom camera (2.5x) to center on a habitat or facility; zoom out restores default view.
    // Uses camera.pan/zoomTo with force:true so rescue events can't leave the camera stuck.
    // viewingHabitat/viewingFacility track the active id; only one is set at a time.
    // zoomToHabitat clears viewingFacility (hiding garden mini bars if needed) and vice versa,
    // so cross-navigation between habitats and facilities stays consistent.
    // zoomOut clears both, hides garden mini bars, removes animal hover glow, and emits
    // habitatViewClosed. zoomToFacility shows garden mini bars and emits showFacilityView.

    zoomToHabitat(hab) {
        if (this.state.viewingFacility) {
            const oldFac = this.state.facilities.find(f => f.id === this.state.viewingFacility);
            if (oldFac && oldFac.type === 'garden') this.hideGardenMiniBars(oldFac);
            this.state.viewingFacility = null;
            const hud = this.scene.get('HUDScene');
            if (hud && hud.facilityPanel) { hud.facilityPanel.destroy(); hud.facilityPanel = null; }
        }
        const ht = HABITATS[hab.type];
        const hw = hab.w ?? ht.w, hh = hab.h ?? ht.h;
        const cx = hab.gx * TILE + (hw * TILE) / 2;
        const cy = MAP_Y + hab.gy * TILE + (hh * TILE) / 2;
        this.state.viewingHabitat = hab.id;
        this.hoverOutline.setVisible(false);
        this.game.canvas.style.cursor = 'default';

        const cam = this.cameras.main;
        cam.pan(cx, cy, 400, 'Quad.easeInOut', true);
        cam.zoomTo(2.5, 400, 'Quad.easeInOut', true);
    }

    zoomToFacility(fac) {
        if (this.state.viewingHabitat) {
            this.state.viewingHabitat = null;
            this.clearSelectedAnimal();
            const hud = this.scene.get('HUDScene');
            if (hud) {
                if (hud.habitatPanel) { hud.habitatPanel.destroy(); hud.habitatPanel = null; }
                if (hud.animalPanel) { hud.animalPanel.destroy(); hud.animalPanel = null; hud._viewedAnimal = null; }
            }
        }
        if (this.state.viewingFacility) {
            const oldFac = this.state.facilities.find(f => f.id === this.state.viewingFacility);
            if (oldFac && oldFac.type === 'garden') this.hideGardenMiniBars(oldFac);
        }
        const ft = FACILITIES[fac.type];
        const fw = fac.w ?? ft.w, fh = fac.h ?? ft.h;
        const cx = fac.gx * TILE + (fw * TILE) / 2;
        const cy = MAP_Y + fac.gy * TILE + (fh * TILE) / 2;
        this.state.viewingFacility = fac.id;
        this.hoverOutline.setVisible(false);
        this.game.canvas.style.cursor = 'default';

        if (fac.type === 'garden') this.showGardenMiniBars(fac);

        const cam = this.cameras.main;
        cam.pan(cx, cy, 400, 'Quad.easeInOut', true);
        cam.zoomTo(2.5, 400, 'Quad.easeInOut', true);
        this.game.events.emit('showFacilityView', fac);
    }

    zoomOut() {
        if (!this.state.viewingHabitat && !this.state.viewingFacility && this.cameras.main.zoom === 1) return;
        if (this.state.viewingFacility) {
            const fac = this.state.facilities.find(f => f.id === this.state.viewingFacility);
            if (fac && fac.type === 'garden') this.hideGardenMiniBars(fac);
        }
        this.state.viewingHabitat = null;
        this.state.viewingFacility = null;
        this._selectedAnimal = null;
        for (const a of this.state.animals) {
            if (a.sprite._hoverGlow) { a.sprite.preFX.remove(a.sprite._hoverGlow); a.sprite._hoverGlow = null; }
        }
        this.game.events.emit('habitatViewClosed');

        const cam = this.cameras.main;
        cam.pan(W / 2, H / 2, 350, 'Quad.easeInOut', true);
        cam.zoomTo(1, 350, 'Quad.easeInOut', true, (_cam, progress) => {
            if (progress === 1) {
                cam.scrollX = 0;
                cam.scrollY = 0;
            }
        });
    }

    clearSelectedAnimal() {
        if (this._selectedAnimal && this._selectedAnimal.sprite._hoverGlow) {
            this._selectedAnimal.sprite.preFX.remove(this._selectedAnimal.sprite._hoverGlow);
            this._selectedAnimal.sprite._hoverGlow = null;
        }
        this._selectedAnimal = null;
        this.game.events.emit('animalDeselected');
    }

    selectAnimal(animal) {
        this.clearSelectedAnimal();
        this._selectedAnimal = animal;
        if (animal.sprite.preFX && !animal.sprite._hoverGlow) {
            animal.sprite._hoverGlow = animal.sprite.preFX.addGlow(0xffffff, 2, 0, false, 0.15, 10);
        }
        this.game.events.emit('showAnimalInfo', animal);
    }

    /* ========== MOVE HABITAT ========== */
    // Zoom out, temporarily remove habitat from grid, enter a build-like preview mode.
    // All habitat elements (gfx, decor, enrichments, animals) stay visible and follow the
    // cursor as a live preview with a green/red overlay. Time and movement are paused.
    // Click to place at new location; ESC or right-click cancels and returns it to the original spot.
    // Visitors seeking the moved habitat recalculate their target viewing spot and path.

    enterMoveMode(hab) {
        this._movingHabitat = hab;
        this._moveOrigin = { gx: hab.gx, gy: hab.gy };

        this.state.viewingHabitat = null;
        this.state.viewingFacility = null;
        this._selectedAnimal = null;
        for (const a of this.state.animals) {
            if (a.sprite._hoverGlow) { a.sprite.preFX.remove(a.sprite._hoverGlow); a.sprite._hoverGlow = null; }
        }
        this.game.events.emit('habitatViewClosed');
        this._hideNPCs();

        const cam = this.cameras.main;
        cam.pan(W / 2, H / 2, 350, 'Quad.easeInOut', true);
        cam.zoomTo(1, 350, 'Quad.easeInOut', true, (_cam, progress) => {
            if (progress === 1) {
                cam.scrollX = 0;
                cam.scrollY = 0;

                const ht = HABITATS[hab.type];
                const hw = hab.w ?? ht.w, hh = hab.h ?? ht.h;
                for (let dy = 0; dy < hh; dy++)
                    for (let dx = 0; dx < hw; dx++)
                        this.grid[hab.gy + dy][hab.gx + dx] = null;

                const moveEnrich = this.enrichmentSprites.filter(e => e.habitatId === hab.id);
                const moveAnimals = this.state.animals.filter(a => a.habitatId === hab.id);

                if (hab.gfx) hab.gfx.setDepth(55);
                if (hab.decor) hab.decor.forEach(d => d.setDepth(56));
                moveEnrich.forEach(e => e.sprite.setDepth(57));
                moveAnimals.forEach(a => {
                    a.sprite.setDepth(58);
                    if (a.alertIcon) a.alertIcon.setDepth(59);
                });

                const tracked = [];
                if (hab.gfx) tracked.push({ obj: hab.gfx, origX: hab.gfx.x || 0, origY: hab.gfx.y || 0, isGfx: true });
                if (hab.decor) {
                    for (const d of hab.decor)
                        tracked.push({ obj: d, origX: d.x || 0, origY: d.y || 0, isGfx: d.type === 'Graphics' });
                }
                for (const e of moveEnrich)
                    tracked.push({ obj: e.sprite, origX: e.sprite.x, origY: e.sprite.y, isGfx: false });
                for (const a of moveAnimals) {
                    tracked.push({ obj: a.sprite, origX: a.sprite.x, origY: a.sprite.y, isGfx: false });
                    if (a.alertIcon) tracked.push({ obj: a.alertIcon, origX: a.alertIcon.x, origY: a.alertIcon.y, isGfx: false });
                }

                this._moveTracked = tracked;
                this.state.buildMode = `_move_${hab.type}`;
                this.game.events.emit('buildModeChanged', this.state.buildMode);
            }
        });
    }

    canPlaceMove(type, gx, gy) {
        const ht = HABITATS[type];
        const w = ht.w, h = ht.h;
        if (gx < 1 || gy < 1 || gx + w > COLS - 1 || gy + h > ROWS - 1) return false;
        for (let dy = 0; dy < h; dy++)
            for (let dx = 0; dx < w; dx++)
                if (this.grid[gy + dy][gx + dx] !== null) return false;
        return true;
    }

    finishMove(gx, gy) {
        const hab = this._movingHabitat;
        if (!hab) return;
        const ht = HABITATS[hab.type];
        const w = ht.w, h = ht.h;
        const orig = this._moveOrigin;
        const offsetX = (gx - orig.gx) * TILE;
        const offsetY = (gy - orig.gy) * TILE;

        hab.gx = gx; hab.gy = gy; hab.w = w; hab.h = h;
        for (let dy = 0; dy < h; dy++)
            for (let dx = 0; dx < w; dx++)
                this.grid[gy + dy][gx + dx] = hab.id;

        if (hab.gfx) {
            hab.gfx.setPosition(0, 0).setDepth(10);
            const px = gx * TILE, py = MAP_Y + gy * TILE, pw = w * TILE, ph = h * TILE;
            hab.gfx.clear(); hab.gfx.fillStyle(ht.fill, 0.4); hab.gfx.fillRect(px, py, pw, ph);
            hab.gfx.lineStyle(2, ht.stroke, 0.9); hab.gfx.strokeRect(px + 1, py + 1, pw - 2, ph - 2);
        }
        if (this._moveTracked) {
            for (const t of this._moveTracked) {
                if (t.obj === hab.gfx) continue;
                const fx = t.origX + offsetX, fy = t.origY + offsetY;
                if (t.isGfx) t.obj.setPosition(fx, fy);
                else { t.obj.x = fx; t.obj.y = fy; }
            }
        }
        if (hab.decor) hab.decor.forEach(d => d.setDepth(12));
        this.enrichmentSprites.filter(e => e.habitatId === hab.id).forEach(e => e.sprite.setDepth(11));
        this.state.animals.filter(a => a.habitatId === hab.id).forEach(a => {
            a.baseX += offsetX; a.baseY += offsetY;
            a.tx = a.baseX; a.ty = a.baseY;
            a.sprite.x = Math.round(a.baseX);
            a.sprite.y = Math.round(a.baseY);
            a.sprite.setDepth(40);
            if (a.alertIcon) a.alertIcon.setDepth(55);
        });

        this._nudgeNPCsFromHabitat(gx, gy, w, h);
        this._recalcVisitorPaths();
        this._recalcStaffPaths();
        this._showNPCs();
        this._movingHabitat = null; this._moveOrigin = null; this._moveTracked = null;
        this.state.buildMode = null; this.preview.setVisible(false);
        if (this._decorPreview) { this._decorPreview.destroy(); this._decorPreview = null; }
        if (this._guidePreview) { this._guidePreview.destroy(); this._guidePreview = null; }
        this.game.events.emit('buildModeChanged', null);
        this.sfx.build();
    }

    cancelMove() {
        if (!this._movingHabitat) return;
        const o = this._moveOrigin;
        this.finishMove(o.gx, o.gy);
    }

    enterFacilityMoveMode(fac) {
        this._movingFacility = fac;
        this._facMoveOrigin = { gx: fac.gx, gy: fac.gy };

        this.state.viewingHabitat = null;
        this.state.viewingFacility = null;
        if (fac.type === 'garden') this.hideGardenMiniBars(fac);
        this.game.events.emit('habitatViewClosed');
        this._hideNPCs();

        const cam = this.cameras.main;
        cam.pan(W / 2, H / 2, 350, 'Quad.easeInOut', true);
        cam.zoomTo(1, 350, 'Quad.easeInOut', true, (_cam, progress) => {
            if (progress === 1) {
                cam.scrollX = 0;
                cam.scrollY = 0;

                const ft = FACILITIES[fac.type];
                    const fw = fac.w ?? ft.w, fh = fac.h ?? ft.h;
                    for (let dy = 0; dy < fh; dy++)
                        for (let dx = 0; dx < fw; dx++)
                            this.grid[fac.gy + dy][fac.gx + dx] = null;

                if (fac.gfx) fac.gfx.setDepth(55);
                if (fac.decor) fac.decor.forEach(d => d.setDepth(56));

                const tracked = [];
                if (fac.gfx) tracked.push({ obj: fac.gfx, origX: fac.gfx.x || 0, origY: fac.gfx.y || 0, isGfx: true });
                if (fac.decor) {
                    for (const d of fac.decor)
                        tracked.push({ obj: d, origX: d.x || 0, origY: d.y || 0, isGfx: d.type === 'Graphics' });
                }
                if (fac.produce) {
                    for (const slot of fac.produce) {
                        if (slot.sprite) {
                            slot.sprite.setDepth(57);
                            tracked.push({ obj: slot.sprite, origX: slot.sprite.x, origY: slot.sprite.y, isGfx: false });
                        }
                    }
                    if (fac._produceGfx) {
                        fac._produceGfx.setDepth(57);
                        tracked.push({ obj: fac._produceGfx, origX: fac._produceGfx.x || 0, origY: fac._produceGfx.y || 0, isGfx: true });
                    }
                    if (fac._miniBarGfx) {
                        fac._miniBarGfx.setVisible(false);
                    }
                }

                this._facMoveTracked = tracked;
                this.state.buildMode = `_movefac_${fac.type}`;
                this.game.events.emit('buildModeChanged', this.state.buildMode);
            }
        });
    }

    canPlaceFacilityMove(type, gx, gy) {
        const ft = FACILITIES[type];
        const w = ft.w, h = ft.h;
        if (gx < 1 || gy < 1 || gx + w > COLS - 1 || gy + h > ROWS - 1) return false;
        for (let dy = 0; dy < h; dy++)
            for (let dx = 0; dx < w; dx++)
                if (this.grid[gy + dy][gx + dx] !== null) return false;
        return true;
    }

    finishFacilityMove(gx, gy) {
        const fac = this._movingFacility;
        if (!fac) return;
        const ft = FACILITIES[fac.type];
        const w = ft.w, h = ft.h;
        const orig = this._facMoveOrigin;
        const offsetX = (gx - orig.gx) * TILE;
        const offsetY = (gy - orig.gy) * TILE;

        fac.gx = gx; fac.gy = gy; fac.w = w; fac.h = h;
        for (let dy = 0; dy < h; dy++)
            for (let dx = 0; dx < w; dx++)
                this.grid[gy + dy][gx + dx] = fac.id;

        if (fac.gfx) {
            fac.gfx.setPosition(0, 0).setDepth(10);
            const px = gx * TILE, py = MAP_Y + gy * TILE, pw = w * TILE, ph = h * TILE;
            fac.gfx.clear(); fac.gfx.fillStyle(ft.fill, 0.4); fac.gfx.fillRect(px, py, pw, ph);
            fac.gfx.lineStyle(2, ft.stroke, 0.9); fac.gfx.strokeRect(px + 1, py + 1, pw - 2, ph - 2);
        }
        if (fac.decor) fac.decor.forEach(d => d.destroy());
        if (fac._dirtyGfx) { fac._dirtyGfx.destroy(); fac._dirtyGfx = null; }
        fac.decor = this.addFacilityDecor(fac.type, gx, gy, { ...ft, w, h });
        if (fac.type === 'bathroom' && (fac.dirty || 0) > 0.1) this._updateBathroomDirtyVisual(fac);
        if (fac.produce) {
            this._recomputeGardenProducePositions(fac);
            if (fac._produceGfx) {
                fac._produceGfx.setPosition(0, 0).setDepth(13);
            }
            if (fac._miniBarGfx) {
                fac._miniBarGfx.setPosition(0, 0).setDepth(14).setVisible(false);
            }
        }

        this._showNPCs();
        this._movingFacility = null; this._facMoveOrigin = null; this._facMoveTracked = null;
        this.state.buildMode = null; this.preview.setVisible(false);
        this.game.events.emit('buildModeChanged', null);
        this.sfx.build();
        this._recalcVisitorPaths();
        this._recalcStaffPaths();
    }

    cancelFacilityMove() {
        if (!this._movingFacility) return;
        const o = this._facMoveOrigin;
        this.finishFacilityMove(o.gx, o.gy);
    }

    destroyFacility(facId) {
        const idx = this.state.facilities.findIndex(f => f.id === facId);
        if (idx === -1) return;
        const fac = this.state.facilities[idx];
        const ft = FACILITIES[fac.type];
        const w = fac.w ?? ft.w, h = fac.h ?? ft.h;
        for (let dy = 0; dy < h; dy++)
            for (let dx = 0; dx < w; dx++)
                this.grid[fac.gy + dy][fac.gx + dx] = null;
        if (fac.type === 'garden') this.hideGardenMiniBars(fac);
        if (fac._dirtyGfx) { fac._dirtyGfx.destroy(); fac._dirtyGfx = null; }
        if (fac.gfx) fac.gfx.destroy();
        if (fac.decor) fac.decor.forEach(d => d.destroy());
        if (fac._produceGfx) fac._produceGfx.destroy();
        if (fac._miniBarGfx) fac._miniBarGfx.destroy();
        if (fac.produce) {
            for (const slot of fac.produce) {
                if (slot.sprite) slot.sprite.destroy();
            }
        }
        this.state.facilities.splice(idx, 1);
        this.facilitySprites = this.facilitySprites.filter(f => f.id !== facId);
        this.zoomOut();
        this._recalcVisitorPaths();
        this._recalcStaffPaths();
        this.sfx.build();
        this.game.events.emit('notification', `${ft.name} demolished.`);
    }

    destroyHabitat(habId) {
        const idx = this.state.habitats.findIndex(h => h.id === habId);
        if (idx === -1) return;
        const hab = this.state.habitats[idx];
        if (hab.animals.length > 0) return;
        const ht = HABITATS[hab.type];
        const w = hab.w ?? ht.w, h = hab.h ?? ht.h;
        for (let dy = 0; dy < h; dy++)
            for (let dx = 0; dx < w; dx++)
                this.grid[hab.gy + dy][hab.gx + dx] = null;
        if (hab.gfx) hab.gfx.destroy();
        if (hab.decor) hab.decor.forEach(d => d.destroy());
        this.state.habitats.splice(idx, 1);
        this.zoomOut();
        this._recalcVisitorPaths();
        this._recalcStaffPaths();
        this.sfx.build();
        this.game.events.emit('notification', `${ht.name} demolished.`);
    }

    // True if every animal in the habitat can be relocated to another compatible habitat with space.
    canAllAnimalsInHabitatBeRelocated(habId) {
        const hab = this.state.habitats.find(h => h.id === habId);
        if (!hab) return false;
        const animals = this.state.animals.filter(a => a.habitatId === habId);
        if (animals.length === 0) return true;

        const occupancy = {};
        for (const h of this.state.habitats) {
            if (h.id === habId) continue;
            const inH = this.state.animals.filter(a => a.habitatId === h.id);
            occupancy[h.id] = inH.length + inH.filter(a => a.isPregnant).length;
        }

        for (const a of animals) {
            const sp = SPECIES[a.speciesId];
            const target = this.state.habitats.find(h => {
                if (h.id === habId) return false;
                if (!HABITATS[h.type].types.includes(sp.type)) return false;
                return occupancy[h.id] < this.getHabitatCapacity(h);
            });
            if (!target) return false;
            occupancy[target.id]++;
        }
        return true;
    }

    // Relocates all animals to compatible habitats, then destroys. Call only if canAllAnimalsInHabitatBeRelocated.
    destroyHabitatWithAutoRelocate(habId) {
        const hab = this.state.habitats.find(h => h.id === habId);
        if (!hab || !this.canAllAnimalsInHabitatBeRelocated(habId)) return;

        const animals = [...this.state.animals.filter(a => a.habitatId === habId)];
        const occupancy = {};
        for (const h of this.state.habitats) {
            if (h.id === habId) continue;
            const inH = this.state.animals.filter(a => a.habitatId === h.id);
            occupancy[h.id] = inH.length + inH.filter(a => a.isPregnant).length;
        }

        for (const a of animals) {
            const sp = SPECIES[a.speciesId];
            const target = this.state.habitats.find(h => {
                if (h.id === habId) return false;
                if (!HABITATS[h.type].types.includes(sp.type)) return false;
                return occupancy[h.id] < this.getHabitatCapacity(h);
            });
            if (target) {
                occupancy[target.id]++;
                this._relocateAnimalSilent(a, target);
            }
        }

        this.destroyHabitat(habId);
    }

    /* ========== BUILD ========== */
    // (pointermove only fires on mouse move, so Q/E would leave the new preview invisible until then).
    _syncBuildPreviewToPointer() {
        const ptr = this.input.activePointer;
        const gx = Math.floor(ptr.worldX / TILE), gy = Math.floor((ptr.worldY - MAP_Y) / TILE);
        const m = this.state.buildMode;
        if (m.startsWith('facility_')) {
            const facId = m.replace('facility_', '');
            const ft = FACILITIES[facId];
            const fw = ft.w, fh = ft.h;
            const fgx = gx - Math.floor(fw / 2), fgy = gy - Math.floor(fh / 2);
            if (this._buildPreview) {
                const dx = fgx * TILE, dy = fgy * TILE;
                for (const t of this._buildPreview.tracked) {
                    t.obj.setVisible(true);
                    if (t.isGfx) t.obj.setPosition(t.origX + dx, t.origY + dy);
                    else { t.obj.x = t.origX + dx; t.obj.y = t.origY + dy; }
                }
            }
        } else if (m.startsWith('_movefac_') && this._facMoveTracked) {
            const facType = m.replace('_movefac_', '');
            const ft = FACILITIES[facType];
            const fw = ft.w, fh = ft.h;
            const fgx = gx - Math.floor(fw / 2), fgy = gy - Math.floor(fh / 2);
            const dx = (fgx - this._facMoveOrigin.gx) * TILE;
            const dy = (fgy - this._facMoveOrigin.gy) * TILE;
            for (const t of this._facMoveTracked) {
                if (t.isGfx) t.obj.setPosition(t.origX + dx, t.origY + dy);
                else { t.obj.x = t.origX + dx; t.obj.y = t.origY + dy; }
            }
        } else if (m.startsWith('_move_') && this._moveTracked) {
            const habType = m.replace('_move_', '');
            const ht = HABITATS[habType];
            const hw = ht.w, hh = ht.h;
            const hgx = gx - Math.floor(hw / 2), hgy = gy - Math.floor(hh / 2);
            const dx = (hgx - this._moveOrigin.gx) * TILE;
            const dy = (hgy - this._moveOrigin.gy) * TILE;
            for (const t of this._moveTracked) {
                if (t.isGfx) t.obj.setPosition(t.origX + dx, t.origY + dy);
                else { t.obj.x = t.origX + dx; t.obj.y = t.origY + dy; }
            }
        } else if (m in HABITATS && this._buildPreview) {
            const ht = HABITATS[m];
            const hw = ht.w, hh = ht.h;
            const hgx = gx - Math.floor(hw / 2), hgy = gy - Math.floor(hh / 2);
            const dx = hgx * TILE, dy = hgy * TILE;
            for (const t of this._buildPreview.tracked) {
                t.obj.setVisible(true);
                if (t.isGfx) t.obj.setPosition(t.origX + dx, t.origY + dy);
                else { t.obj.x = t.origX + dx; t.obj.y = t.origY + dy; }
            }
        }
    }

    _refreshFacilityMoveDisplay() {
        const fac = this._movingFacility;
        if (!fac) return;
        const ft = FACILITIES[fac.type];
        const w = ft.w, h = ft.h;
        const gx = this._facMoveOrigin.gx, gy = this._facMoveOrigin.gy;
        if (fac.gfx) {
            fac.gfx.clear();
            fac.gfx.fillStyle(ft.fill, 0.4);
            fac.gfx.fillRect(gx * TILE, MAP_Y + gy * TILE, w * TILE, h * TILE);
            fac.gfx.lineStyle(2, ft.stroke, 0.9);
            fac.gfx.strokeRect(gx * TILE + 1, MAP_Y + gy * TILE + 1, w * TILE - 2, h * TILE - 2);
        }
        if (fac.decor) fac.decor.forEach(d => d.destroy());
        fac.decor = this.addFacilityDecor(fac.type, gx, gy, { ...ft, w, h });
        fac.decor.forEach(d => d.setDepth(56));
        this._facMoveTracked = [].concat(
            fac.gfx ? [{ obj: fac.gfx, origX: 0, origY: 0, isGfx: true }] : [],
            fac.decor.map(d => ({ obj: d, origX: d.x || 0, origY: d.y || 0, isGfx: d.type === 'Graphics' }))
        );
        if (fac.produce) {
            this._redrawAllProduce(fac);
            if (fac._produceGfx) this._facMoveTracked.push({ obj: fac._produceGfx, origX: 0, origY: 0, isGfx: true });
        }
    }

    _refreshHabitatMoveDisplay() {
        const hab = this._movingHabitat;
        if (!hab) return;
        const ht = HABITATS[hab.type];
        const w = ht.w, h = ht.h;
        const gx = this._moveOrigin.gx, gy = this._moveOrigin.gy;
        const ptr = this.input.activePointer;
        const px = Math.floor(ptr.worldX / TILE), py = Math.floor((ptr.worldY - MAP_Y) / TILE);
        const hgx = px - Math.floor(w / 2), hgy = py - Math.floor(h / 2);
        const moveDx = (hgx - gx) * TILE, moveDy = (hgy - gy) * TILE;
        if (hab.gfx) {
            hab.gfx.clear();
            hab.gfx.fillStyle(ht.fill, 0.4);
            hab.gfx.fillRect(gx * TILE, MAP_Y + gy * TILE, w * TILE, h * TILE);
            hab.gfx.lineStyle(2, ht.stroke, 0.9);
            hab.gfx.strokeRect(gx * TILE + 1, MAP_Y + gy * TILE + 1, w * TILE - 2, h * TILE - 2);
        }
        if (hab.decor) hab.decor.forEach(d => d.destroy());
        hab.decor = this.addHabitatDecor(hab.type, gx, gy, { ...ht, w, h });
        hab.decor.forEach(d => d.setDepth(56));
        const moveEnrich = this.enrichmentSprites.filter(e => e.habitatId === hab.id);
        const moveAnimals = this.state.animals.filter(a => a.habitatId === hab.id);
        this._moveTracked = [].concat(
            hab.gfx ? [{ obj: hab.gfx, origX: 0, origY: 0, isGfx: true }] : [],
            hab.decor.map(d => ({ obj: d, origX: d.x || 0, origY: d.y || 0, isGfx: d.type === 'Graphics' })),
            moveEnrich.map(e => ({ obj: e.sprite, origX: e.sprite.x - moveDx, origY: e.sprite.y - moveDy, isGfx: false })),
            ...moveAnimals.map(a => {
                const arr = [{ obj: a.sprite, origX: a.baseX, origY: a.baseY, isGfx: false }];
                if (a.alertIcon) arr.push({ obj: a.alertIcon, origX: a.alertIcon.x - moveDx, origY: a.alertIcon.y - moveDy, isGfx: false });
                return arr;
            })
        ).flat();
    }

    // Habitat/decoration/facility placement with live preview that follows the cursor, overlaid
    // with a green/red tint for placement validation. Habitats and facilities use multi-tile
    // previews (gfx + decor at 70% opacity); decorations use a single-tile sprite preview
    // (_decorPreview) at 70% opacity and support click-and-drag for rapid multi-tile placement.
    // Tour guide hiring uses '_place_guide' build mode with a sprite preview on any staff-walkable tile.
    // Path decorations can be placed on entrance tiles (including the gate row).
    // All placements show a floating gold cost indicator (_showFloatingCost) that rises and fades.
    // Seasonal cost discounts apply to habitats. exitBuild recalculates visitor and staff paths.

    enterBuild(type) {
        const hud = this.scene.get('HUDScene');
        if (hud && hud.hasOpenPanel()) {
            this._preBuildPanel = hud._activePanel;
            hud.closeAllPanels(true);
        } else {
            this._preBuildPanel = null;
        }
        if (this.state.viewingHabitat || this.state.viewingFacility || this.cameras.main.zoom > 1) {
            this.zoomOut();
        }
        this.state.buildMode = type;
        this._createBuildPreview(type);
        this._hideNPCs();
        this.game.events.emit('buildModeChanged', type);
    }

    exitBuild() {
        this.state.buildMode = null;
        this.preview.setVisible(false);
        this._destroyBuildPreview();
        if (this._decorPreview) { this._decorPreview.destroy(); this._decorPreview = null; }
        if (this._guidePreview) { this._guidePreview.destroy(); this._guidePreview = null; }
        this._showNPCs();
        this._recalcVisitorPaths();
        this._recalcStaffPaths();
        this.game.events.emit('buildModeChanged', null);
        const hud = this.scene.get('HUDScene');
        if (hud && hud._pendingRescue) {
            const ev = hud._pendingRescue;
            hud._pendingRescue = null;
            const hab = this.findCompatibleHabitat(SPECIES[ev.speciesId]);
            if (hab) {
                this.acceptRescueInto(ev, hab);
            } else {
                ev.habitat = null;
                hud.showRescue(ev);
            }
        }
        if (this._preBuildPanel && hud) {
            hud.reopenPanel(this._preBuildPanel);
            this._preBuildPanel = null;
        }
    }

    enterDecorBuild(decorId) {
        const hud = this.scene.get('HUDScene');
        if (hud && hud.hasOpenPanel()) hud.closeAllPanels(true);
        if (this.state.viewingHabitat || this.state.viewingFacility || this.cameras.main.zoom > 1) this.zoomOut();
        this.state.buildMode = `decor_${decorId}`;
        this._decorPreview = this.add.image(0, 0, `decor_${decorId}`).setDepth(56).setAlpha(0.7).setVisible(false);
        this._hideNPCs();
        this.game.events.emit('buildModeChanged', this.state.buildMode);
    }

    canPlaceDecor(gx, gy) {
        const decorId = this.state.buildMode.replace('decor_', '');
        const isEntranceArea = (gy === ROWS - 1 || gy === ROWS - 2) && gx >= 13 && gx <= 16;
        if (!isEntranceArea && (gx < 1 || gy < 1 || gx >= COLS - 1 || gy >= ROWS - 1)) return false;
        const dec = DECORATIONS[decorId];
        if (!dec || this.state.coins < dec.cost) return false;
        const cell = this.grid[gy]?.[gx];
        if (cell === null) return true;
        if (cell === 'entrance' && dec?.isPath) return true;
        return false;
    }

    _showFloatingCost(px, py, amount) {
        const txt = this.add.text(px, py - 8, `-${amount}g`, {
            fontFamily: 'monospace', fontSize: '14px', color: '#ff4444',
            stroke: '#000000', strokeThickness: 2,
        }).setDepth(100).setOrigin(0.5);
        this.tweens.add({
            targets: txt, y: py - 40, alpha: 0, duration: 1200, ease: 'Cubic.easeOut',
            onComplete: () => txt.destroy(),
        });
    }

    placeDecor(decorId, gx, gy) {
        const dec = DECORATIONS[decorId];
        if (!dec) return;
        this.spendCoins(dec.cost);
        this.grid[gy][gx] = `dec_${decorId}`;
        const px = gx * TILE + TILE / 2, py = MAP_Y + gy * TILE + TILE / 2;
        const sprite = this.add.image(px, py, `decor_${decorId}`).setDepth(10);
        this.decorSprites.push({ id: decorId, gx, gy, sprite });
        this.state.decorations.push({ id: decorId, gx, gy });
        this._showFloatingCost(px, py, dec.cost);
        this.sfx.build();
        this._recalcVisitorPaths();
        this._recalcStaffPaths();
    }

    removeDecor(gx, gy) {
        const idx = this.state.decorations.findIndex(d => d.gx === gx && d.gy === gy);
        if (idx < 0) return;
        this.state.decorations.splice(idx, 1);
        const si = this.decorSprites.findIndex(d => d.gx === gx && d.gy === gy);
        if (si >= 0) { this.decorSprites[si].sprite.destroy(); this.decorSprites.splice(si, 1); }
        const isEntranceArea = (gy === ROWS - 1 || gy === ROWS - 2) && gx >= 13 && gx <= 16;
        this.grid[gy][gx] = isEntranceArea ? 'entrance' : null;
        this._recalcVisitorPaths();
        this._recalcStaffPaths();
    }

    /* ========== FACILITIES ========== */
    // Facilities are multi-tile buildings placed like habitats but without animals.
    // Garden: 4×4 tiles, contains 12 produce items (3 rows × 4 columns). Produce starts unripe
    // on fresh placement, grows over GARDEN_REGROW_TIME (480 min / 8 hours), and can be clicked
    // while zoomed in to harvest for food (or auto-harvested by gardener staff). Each item shows
    // a mini progress bar (visible only when zoomed in) while regrowing. Facility grid cells use
    // 'fac_' prefix IDs, blocking walkability. Facilities are persisted in save/load including
    // per-item produce regrow state.

    enterFacilityBuild(facId) {
        const hud = this.scene.get('HUDScene');
        if (hud && hud.hasOpenPanel()) hud.closeAllPanels(true);
        if (this.state.viewingHabitat || this.state.viewingFacility || this.cameras.main.zoom > 1) this.zoomOut();
        this.state.buildMode = `facility_${facId}`;
        this._createFacilityPreview(facId);
        this._hideNPCs();
        this.game.events.emit('buildModeChanged', this.state.buildMode);
    }

    canPlaceFacility(facId, gx, gy) {
        const ft = FACILITIES[facId];
        if (!ft) return false;
        const w = ft.w, h = ft.h;
        if (gx < 1 || gy < 1 || gx + w > COLS - 1 || gy + h > ROWS - 1) return false;
        if (this.state.coins < ft.cost) return false;
        for (let dy = 0; dy < h; dy++)
            for (let dx = 0; dx < w; dx++)
                if (this.grid[gy + dy][gx + dx] !== null) return false;
        return true;
    }

    placeFacility(facId, gx, gy, opts = {}) {
        const ft = FACILITIES[facId];
        const w = ft.w, h = ft.h;
        const id = opts.id || genId('fac');
        for (let dy = 0; dy < h; dy++)
            for (let dx = 0; dx < w; dx++)
                this.grid[gy + dy][gx + dx] = id;

        let gfx, decor;
        if (this._buildPreview) {
            gfx = this._buildPreview.gfx;
            this._buildPreview.decor.forEach(d => d.destroy());
            gfx.setPosition(0, 0).setDepth(10).setAlpha(1);
            const px = gx * TILE, py = MAP_Y + gy * TILE, pw = w * TILE, ph = h * TILE;
            gfx.clear(); gfx.fillStyle(ft.fill, 0.4); gfx.fillRect(px, py, pw, ph);
            gfx.lineStyle(2, ft.stroke, 0.9); gfx.strokeRect(px + 1, py + 1, pw - 2, ph - 2);
            decor = this.addFacilityDecor(facId, gx, gy, { ...ft, w, h });
            decor.forEach(d => { d.setDepth(12); d.setAlpha(1); });
            this._buildPreview.adopted = true;
        } else {
            gfx = this.add.graphics().setDepth(10);
            const px = gx * TILE, py = MAP_Y + gy * TILE, pw = w * TILE, ph = h * TILE;
            gfx.fillStyle(ft.fill, 0.4); gfx.fillRect(px, py, pw, ph);
            gfx.lineStyle(2, ft.stroke, 0.9); gfx.strokeRect(px + 1, py + 1, pw - 2, ph - 2);
            decor = this.addFacilityDecor(facId, gx, gy, { ...ft, w, h });
        }

        const fac = { id, type: facId, gx, gy, w, h, gfx, decor };
        if (facId === 'bathroom') fac.dirty = opts.dirty ?? 0;
        this.state.facilities.push(fac);
        this.facilitySprites.push(fac);

        if (facId === 'garden') this.initGardenProduce(fac, opts.produce);
        if (facId === 'bathroom') this._updateBathroomDirtyVisual(fac);

        if (opts.cost !== false) {
            this.spendCoins(ft.cost);
            this._showFloatingCost(gx * TILE + w * TILE / 2, MAP_Y + gy * TILE + h * TILE / 2, ft.cost);
            this.sfx.build();
        }
        this._nudgeNPCsFromHabitat(gx, gy, w, h);
        this._recalcVisitorPaths();
        this._recalcStaffPaths();
        return fac;
    }

    addFacilityDecor(facId, gx, gy, ft) {
        const base = gx * TILE, top = MAP_Y + gy * TILE;
        const pw = ft.w * TILE, ph = ft.h * TILE;
        const g = this.add.graphics().setDepth(12);
        const objects = [g];
        if (facId === 'garden') {
            g.fillStyle(0x6B4226, 0.35);
            const rowSpacing = (ph - 16) / 3;
            for (let row = 0; row < 3; row++) {
                const ry = top + 10 + row * rowSpacing;
                g.fillRoundedRect(base + 8, ry - 2, pw - 16, 10, 2);
            }
        } else if (facId === 'gift_shop') {
            g.fillStyle(0x8B4513, 0.5);
            const awningW = 24, awningH = 6;
            g.fillRect(base + 4, top + 4, pw - 8, 8);
            g.fillStyle(0xDEB887, 0.6);
            g.fillRect(base + pw / 2 - awningW / 2, top + 2, awningW, awningH);
        } else if (facId === 'bathroom') {
            g.fillStyle(0xE8EEF4, 0.85);
            g.fillRect(base + 4, top + 4, pw - 8, ph - 8);
            g.fillStyle(0x5A7ABB, 0.6);
            g.fillRect(base + 6, top + 6, pw - 12, 10);
            g.fillStyle(0xFFFFFF, 0.9);
            g.fillRect(base + 10, top + 8, 8, 6);
            const doorW = 14, doorH = 22;
            const doorX = base + pw / 2 - doorW / 2;
            const doorY = top + ph - doorH - 6;
            g.fillStyle(0x4A6A8A, 0.9);
            g.fillRect(doorX - 2, doorY - 2, doorW + 4, doorH + 4);
            g.fillStyle(0xD8E0E8, 0.95);
            g.fillRect(doorX, doorY, doorW, doorH);
            g.fillStyle(0x3A5A7A, 1);
            g.fillRect(doorX + doorW - 3, doorY + doorH / 2 - 2, 2, 4);
        }
        return objects;
    }

    _getGardenProducePosition(fac, row, col) {
        const ft = FACILITIES[fac.type];
        const w = fac.w ?? ft.w, h = fac.h ?? ft.h;
        const base = fac.gx * TILE, top = MAP_Y + fac.gy * TILE;
        const pw = w * TILE, ph = h * TILE;
        const rowSpacing = (ph - 16) / 3;
        const produceColSpacing = (pw - 40) / 3;
        const x = base + 20 + col * produceColSpacing;
        const y = top + 10 + row * rowSpacing;
        return { x, y };
    }

    initGardenProduce(fac, saved) {
        fac.produce = [];
        fac._produceGfx = this.add.graphics().setDepth(13);
        fac._miniBarGfx = this.add.graphics().setDepth(14).setVisible(false);
        const ft = FACILITIES[fac.type];
        const w = fac.w ?? ft.w, h = fac.h ?? ft.h;
        const base = fac.gx * TILE, top = MAP_Y + fac.gy * TILE;
        const pw = w * TILE, ph = h * TILE;

        for (let row = 0; row < 3; row++) {
            const pType = GARDEN_PRODUCE[row];
            for (let col = 0; col < 4; col++) {
                const pos = this._getGardenProducePosition(fac, row, col);
                const idx = row * 4 + col;
                const sv = saved ? saved[idx] : null;
                const regrowLeft = sv ? sv.regrowLeft : (saved ? 0 : GARDEN_REGROW_TIME);
                const picked = regrowLeft > 0;
                fac.produce.push({ row, col, type: pType.id, x: pos.x, y: pos.y, picked, regrowLeft });
            }
        }
        this._redrawAllProduce(fac);
    }

    _recomputeGardenProducePositions(fac) {
        if (!fac.produce) return;
        for (const slot of fac.produce) {
            const pos = this._getGardenProducePosition(fac, slot.row, slot.col);
            slot.x = pos.x;
            slot.y = pos.y;
        }
        this._redrawAllProduce(fac);
        this._redrawAllMiniBars(fac);
    }

    _redrawAllProduce(fac) {
        const g = fac._produceGfx;
        g.clear();
        for (const slot of fac.produce) {
            const pos = { x: slot.x, y: slot.y };
            const pType = GARDEN_PRODUCE.find(p => p.id === slot.type);
            const cy = pos.y + 3;
            if (slot.picked) {
                g.fillStyle(0x6B4226, 0.2);
                g.fillCircle(pos.x, cy, 2);
            } else {
                g.fillStyle(pType.leafColor);
                g.fillRect(pos.x - 1, cy + 1, 2, 4);
                g.fillStyle(pType.leafColor, 0.7);
                g.fillCircle(pos.x - 2, cy, 2);
                g.fillCircle(pos.x + 2, cy, 2);
                g.fillStyle(pType.color);
                g.fillCircle(pos.x, cy - 1, 3);
            }
        }
    }

    _redrawAllMiniBars(fac) {
        const g = fac._miniBarGfx;
        g.clear();
        const bw = 10, bh = 2;
        const offset = 9;
        for (const slot of fac.produce) {
            if (!slot.picked) continue;
            const pct = 1 - (slot.regrowLeft / GARDEN_REGROW_TIME);
            g.fillStyle(0x333333, 0.6);
            const bx = slot.x - bw / 2, by = slot.y + offset;
            g.fillRect(bx, by, bw, bh);
            if (pct > 0) {
                g.fillStyle(0x66AA33, 0.9);
                g.fillRect(bx, by, Math.round(bw * pct), bh);
            }
        }
    }

    showGardenMiniBars(fac) {
        if (!fac._miniBarGfx) return;
        this._redrawAllMiniBars(fac);
        fac._miniBarGfx.setVisible(true);
    }

    hideGardenMiniBars(fac) {
        if (!fac._miniBarGfx) return;
        fac._miniBarGfx.setVisible(false);
    }

    pickProduce(fac, slot) {
        if (slot.picked) return;
        slot.picked = true;
        slot.regrowLeft = GARDEN_REGROW_TIME;
        const pType = GARDEN_PRODUCE.find(p => p.id === slot.type);
        this.addFood(pType.food);
        this.sfx.click();
        this._redrawAllProduce(fac);
        this._redrawAllMiniBars(fac);
    }

    _updateBathroomDirtyVisual(fac) {
        if (fac.type !== 'bathroom') return;
        if (fac._dirtyGfx) {
            fac._dirtyGfx.destroy();
            fac._dirtyGfx = null;
        }
        if ((fac.dirty || 0) > 0.1) {
            const base = fac.gx * TILE, top = MAP_Y + fac.gy * TILE;
            const pw = fac.w * TILE, ph = fac.h * TILE;
            const g = this.add.graphics().setDepth(11);
            const alpha = Math.min(0.6, fac.dirty * 0.7);
            g.fillStyle(0x4A3A20, alpha);
            g.fillRect(base + 4, top + 4, pw - 8, ph - 8);
            g.fillStyle(0x5A4A30, alpha * 0.8);
            const rng = new Phaser.Math.RandomDataGenerator([fac.id, 'dirty']);
            for (let i = 0; i < 6; i++) {
                g.fillCircle(base + 8 + rng.between(0, pw - 20), top + 8 + rng.between(0, ph - 20), 4);
            }
            fac._dirtyGfx = g;
        }
    }

    cleanBathroom(fac) {
        if (fac.type !== 'bathroom') return;
        fac.dirty = 0;
        this._updateBathroomDirtyVisual(fac);
        this.game.events.emit('timeUpdate', { time: this.state.time, day: this.state.day, season: this.state.season, rep: this.state.rep });
    }

    updateGardens(delta) {
        const dt = TIME_SCALE * this.timeSpeedMult * delta / 1000;
        for (const fac of this.state.facilities) {
            if (fac.type !== 'garden' || !fac.produce) continue;
            let changed = false;
            for (const slot of fac.produce) {
                if (!slot.picked) continue;
                slot.regrowLeft -= dt;
                if (slot.regrowLeft <= 0) {
                    slot.regrowLeft = 0;
                    slot.picked = false;
                    changed = true;
                }
            }
            if (changed) this._redrawAllProduce(fac);
            if (this.state.viewingFacility === fac.id) this._redrawAllMiniBars(fac);
        }
    }

    updateBathrooms(delta) {
        for (const fac of this.state.facilities) {
            if (fac.type !== 'bathroom') continue;
            const wasDirty = (fac.dirty || 0) > 0.1;
            fac.dirty = Math.min(1, (fac.dirty || 0) + delta * BATHROOM_DIRTY_RATE * this.timeSpeedMult);
            if (!wasDirty && (fac.dirty || 0) > 0.1) this._updateBathroomDirtyVisual(fac);
        }
    }

    _createFacilityPreview(facId) {
        this._destroyBuildPreview();
        const ft = FACILITIES[facId];
        const w = ft.w, h = ft.h;
        const gfx = this.add.graphics().setDepth(55).setAlpha(0.7);
        gfx.fillStyle(ft.fill, 0.4); gfx.fillRect(0, MAP_Y, w * TILE, h * TILE);
        gfx.lineStyle(2, ft.stroke, 0.9); gfx.strokeRect(1, MAP_Y + 1, w * TILE - 2, h * TILE - 2);

        const decor = this.addFacilityDecor(facId, 0, 0, { ...ft, w, h });
        decor.forEach(d => { d.setDepth(56); d.setAlpha(0.7); });

        const tracked = [{ obj: gfx, origX: 0, origY: 0, isGfx: true }];
        for (const d of decor)
            tracked.push({ obj: d, origX: d.x || 0, origY: d.y || 0, isGfx: d.type === 'Graphics' });

        this._buildPreview = { gfx, decor, tracked };
        gfx.setVisible(false);
        decor.forEach(d => d.setVisible(false));
    }

    _createBuildPreview(type) {
        this._destroyBuildPreview();
        const ht = HABITATS[type];
        const w = ht.w, h = ht.h;
        const gfx = this.add.graphics().setDepth(55).setAlpha(0.7);
        gfx.fillStyle(ht.fill, 0.4); gfx.fillRect(0, MAP_Y, w * TILE, h * TILE);
        gfx.lineStyle(2, ht.stroke, 0.9); gfx.strokeRect(1, MAP_Y + 1, w * TILE - 2, h * TILE - 2);

        const decor = this.addHabitatDecor(type, 0, 0, { ...ht, w, h });
        decor.forEach(d => { d.setDepth(56); d.setAlpha(0.7); });

        const tracked = [{ obj: gfx, origX: 0, origY: 0, isGfx: true }];
        for (const d of decor)
            tracked.push({ obj: d, origX: d.x || 0, origY: d.y || 0, isGfx: d.type === 'Graphics' });

        this._buildPreview = { gfx, decor, tracked };
        gfx.setVisible(false);
        decor.forEach(d => d.setVisible(false));
    }

    _destroyBuildPreview() {
        if (!this._buildPreview) return;
        if (!this._buildPreview.adopted) {
            this._buildPreview.gfx.destroy();
            this._buildPreview.decor.forEach(d => d.destroy());
        }
        this._buildPreview = null;
    }

    _hideNPCs() {
        for (const v of this.visitors) {
            v.sprite.setVisible(false);
            if (v._bubble) v._bubble.setVisible(false);
        }
        for (const s of this.state.staff) s.sprite.setVisible(false);
    }

    _showNPCs() {
        for (const v of this.visitors) {
            v.sprite.setVisible(true);
            if (v._bubble) v._bubble.setVisible(true);
        }
        for (const s of this.state.staff) s.sprite.setVisible(true);
    }

    _nudgeNPCsFromHabitat(gx, gy, w, h) {
        const left = gx * TILE, right = (gx + w) * TILE;
        const top = MAP_Y + gy * TILE, bottom = MAP_Y + (gy + h) * TILE;
        const nearest = (ox, oy) => {
            let best = null, bestDist = Infinity;
            for (let dy = -1; dy <= h; dy++) {
                for (let dx = -1; dx <= w; dx++) {
                    if (dx >= 0 && dx < w && dy >= 0 && dy < h) continue;
                    const nx = gx + dx, ny = gy + dy;
                    if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
                    if (this.grid[ny][nx] !== null) continue;
                    const px = nx * TILE + TILE / 2, py = MAP_Y + ny * TILE + TILE / 2;
                    const d = (px - ox) * (px - ox) + (py - oy) * (py - oy);
                    if (d < bestDist) { bestDist = d; best = { x: px, y: py }; }
                }
            }
            return best || this.randomOpenTile();
        };
        const nudge = (obj) => {
            if (obj.x >= left && obj.x < right && obj.y >= top && obj.y < bottom) {
                const dest = nearest(obj.x, obj.y);
                obj.x = dest.x; obj.y = dest.y;
                return dest;
            }
            return null;
        };
        for (const v of this.visitors) {
            const d = nudge(v.sprite);
            if (d) { v.tx = d.x; v.ty = d.y; }
        }
        for (const s of this.state.staff) {
            if (s.type !== 'guide') continue;
            const d = nudge(s.sprite);
            if (d) { s.tx = d.x; s.ty = d.y; }
        }
    }

    getHabitatCost(type) {
        let cost = HABITATS[type].cost;
        const s = SEASONS[this.state.season];
        if (s.bonuses.buildCost) cost = Math.round(cost * s.bonuses.buildCost);
        return cost;
    }

    canPlace(type, gx, gy) {
        const ht = HABITATS[type];
        const w = ht.w, h = ht.h;
        if (gx < 1 || gy < 1 || gx + w > COLS - 1 || gy + h > ROWS - 1) return false;
        if (this.state.coins < this.getHabitatCost(type)) return false;
        for (let dy = 0; dy < h; dy++)
            for (let dx = 0; dx < w; dx++)
                if (this.grid[gy + dy][gx + dx] !== null) return false;
        return true;
    }

    getHabitatCapacity(hab) {
        let cap = HABITATS[hab.type].capacity;
        if (this.state.upgrades.has('habitat_plus')) cap += 1;
        if (this.hasResearch('habitat_cap_1')) cap += 1;
        return cap;
    }

    placeHabitat(type, gx, gy, opts = {}) {
        const ht = HABITATS[type];
        const w = ht.w, h = ht.h;
        const id = opts.id || genId('hab');
        for (let dy = 0; dy < h; dy++)
            for (let dx = 0; dx < w; dx++)
                this.grid[gy + dy][gx + dx] = id;

        let gfx, decor;
        if (this._buildPreview) {
            gfx = this._buildPreview.gfx;
            decor = this._buildPreview.decor;
            gfx.setPosition(0, 0).setDepth(10).setAlpha(1);
            const px = gx * TILE, py = MAP_Y + gy * TILE, pw = w * TILE, ph = h * TILE;
            gfx.clear(); gfx.fillStyle(ht.fill, 0.4); gfx.fillRect(px, py, pw, ph);
            gfx.lineStyle(2, ht.stroke, 0.9); gfx.strokeRect(px + 1, py + 1, pw - 2, ph - 2);
            const dx = gx * TILE, dy = gy * TILE;
            for (const t of this._buildPreview.tracked) {
                if (t.obj === gfx) continue;
                if (t.isGfx) t.obj.setPosition(t.origX + dx, t.origY + dy);
                else { t.obj.x = t.origX + dx; t.obj.y = t.origY + dy; }
            }
            decor.forEach(d => { d.setDepth(12); d.setAlpha(1); });
            this._buildPreview.adopted = true;
        } else {
            gfx = this.add.graphics().setDepth(10);
            const px = gx * TILE, py = MAP_Y + gy * TILE, pw = w * TILE, ph = h * TILE;
            gfx.fillStyle(ht.fill, 0.4); gfx.fillRect(px, py, pw, ph);
            gfx.lineStyle(2, ht.stroke, 0.9); gfx.strokeRect(px + 1, py + 1, pw - 2, ph - 2);
            decor = this.addHabitatDecor(type, gx, gy, { ...ht, w, h });
        }

        const hab = { id, type, gx, gy, w, h, animals: [], gfx, decor, enrichments: [] };
        this.state.habitats.push(hab);

        if (opts.cost !== false) {
            const cost = this.getHabitatCost(type);
            this.spendCoins(cost);
            this._showFloatingCost(gx * TILE + w * TILE / 2, MAP_Y + gy * TILE + h * TILE / 2, cost);
            this.sfx.build();
        }
        this._nudgeNPCsFromHabitat(gx, gy, w, h);
        this._recalcVisitorPaths();
        this._recalcStaffPaths();
        return hab;
    }

    addHabitatDecor(type, gx, gy, ht) {
        const rng = new Phaser.Math.RandomDataGenerator([`${gx}${gy}`]);
        const base = gx * TILE, top = MAP_Y + gy * TILE;
        const g = this.add.graphics().setDepth(12);
        const objects = [g];
        if (type === 'forest') {
            for (let i = 0; i < 4; i++) {
                const tx = base + rng.between(8, ht.w * TILE - 8);
                const ty = top + rng.between(16, ht.h * TILE - 8);
                g.fillStyle(0x2a5a2a); g.fillCircle(tx, ty - 10, 8);
                g.fillStyle(0x4a3020); g.fillRect(tx - 2, ty - 4, 4, 8);
                const treeImg = this.add.circle(tx, ty - 10, 8, 0x2a5a2a, 0).setDepth(12);
                this.tweens.add({ targets: treeImg, angle: 2, yoyo: true, repeat: -1, duration: 2000 + rng.between(0, 1000), ease: 'Sine.easeInOut' });
                objects.push(treeImg);
            }
        } else if (type === 'pond') {
            const cx = base + ht.w * TILE / 2, cy = top + ht.h * TILE / 2 + 4;
            const rad = ht.w * TILE / 3;
            g.fillStyle(0x3a6a9a, 0.5); g.fillCircle(cx, cy, rad);
            g.fillStyle(0x5a9aca, 0.3); g.fillCircle(cx - 5, cy - 3, rad / 2);
            const shimmer = this.add.circle(cx, cy, rad * 0.7, 0x88bbee, 0.1).setDepth(12);
            this.tweens.add({ targets: shimmer, alpha: 0.25, scaleX: 1.05, scaleY: 0.95, yoyo: true, repeat: -1, duration: 2500, ease: 'Sine.easeInOut' });
            objects.push(shimmer);
        } else if (type === 'meadow') {
            for (let i = 0; i < 6; i++) {
                const fx = base + rng.between(6, ht.w * TILE - 6);
                const fy = top + rng.between(14, ht.h * TILE - 6);
                g.fillStyle(rng.pick([0xFFDD44, 0xFF8899, 0xAABBFF, 0xFFFFFF]));
                g.fillCircle(fx, fy, 2);
            }
        } else if (type === 'barn') {
            const bx = base + ht.w * TILE / 2 - 14, by = top + 14;
            g.fillStyle(0x8B4513); g.fillRect(bx, by, 28, 20);
            g.fillStyle(0xA0522D); g.fillTriangle(bx - 4, by, bx + 14, by - 10, bx + 32, by);
            g.fillStyle(0x444444); g.fillRect(bx + 10, by + 8, 8, 12);
        }
        return objects;
    }

    /* ========== ENRICHMENT ========== */
    // Habitat items (toys, shelters) that boost animal happiness.

    addEnrichment(habitatId, enrichId) {
        const hab = this.state.habitats.find(h => h.id === habitatId);
        const en = ENRICHMENTS[enrichId];
        if (!hab || !en) return false;
        const maxEnrich = this.hasResearch('enrich_cap_4') ? 4 : 3;
        if (hab.enrichments.length >= maxEnrich) {
            this.game.events.emit('notification', `Habitat full! Max ${maxEnrich} enrichments.`);
            this.sfx.error(); return false;
        }
        if (en.habitats && !en.habitats.includes(hab.type)) {
            this.game.events.emit('notification', 'Not compatible with this habitat.');
            this.sfx.error(); return false;
        }
        let cost = en.cost;
        if (this.hasResearch('cheap_enrich')) cost = Math.round(cost * 0.7);
        if (this.state.coins < cost) {
            this.game.events.emit('notification', 'Not enough coins!');
            this.sfx.error(); return false;
        }
        this.spendCoins(cost);
        hab.enrichments.push(enrichId);

        const px = (hab.gx + 0.3 + Math.random() * (hab.w - 0.6)) * TILE;
        const py = MAP_Y + (hab.gy + 0.4 + Math.random() * (hab.h - 0.8)) * TILE;
        const spr = this.add.image(px, py, `enrich_${enrichId}`).setDepth(11).setScale(0.9);
        this.enrichmentSprites.push({ habitatId, enrichId, sprite: spr });

        this.sfx.build();
        this.game.events.emit('notification', `${en.name} added!`);
        if (!this.state.achievementsEarned.has('first_enrichment')) this.checkAchievements();
        return true;
    }

    getEnrichmentHappyBonus(hab) {
        let bonus = 0;
        for (const eId of (hab.enrichments || [])) {
            const en = ENRICHMENTS[eId];
            if (en) bonus += en.happyBonus;
        }
        if (this.hasResearch('double_enrich')) bonus *= 2;
        return bonus;
    }

    /* ========== ANIMALS ========== */
    // Spawn, wander, bob, hunger/happiness decay, traits, illness, bond XP/levels, friendships, death.
    // Health stays at 100 unless ill (drains during illness, recovers after healing).
    // Neglect: 0 hunger or happiness for >1 game-hour causes health drain. Health 0 = death.
    // Friends in the same habitat grant a happiness buff; relocating away triggers a temporary loneliness debuff.
    // Animals are clickable while zoomed into any habitat; clicking an animal in a different habitat
    // navigates to that habitat (pans camera, updates panels). Hover glow follows sprite shape.
    // selectAnimal() centralizes selection: clears previous glow, applies new glow, emits showAnimalInfo.
    // clearSelectedAnimal() emits animalDeselected so the HUD closes the animal panel.
    // updateAnimals emits animalUpdate every ~2s so the HUD animal panel auto-refreshes.

    addAnimal(speciesId, name, habitatId, opts = {}) {
        const hab = this.state.habitats.find(h => h.id === habitatId);
        if (!hab) return null;
        const sp = SPECIES[speciesId];

        let vi = opts.variantIdx;
        if (vi == null) {
            const idx = sp.variants.findIndex(v => v.name === name);
            vi = idx >= 0 ? idx : Phaser.Math.Between(0, sp.variants.length - 1);
        }
        const variant = sp.variants[vi];
        const gender = opts.gender || (variant ? (variant.gender === 'm' ? 'male' : 'female') : (Math.random() < 0.5 ? 'male' : 'female'));

        const ax = (hab.gx + 0.5 + Math.random() * (hab.w - 1)) * TILE;
        const ay = MAP_Y + (hab.gy + 0.5 + Math.random() * (hab.h - 1)) * TILE;
        const texKey = `animal_${speciesId}_${vi}`;
        const sprite = this.add.image(ax, ay, texKey).setDepth(40);
        sprite.setInteractive({ useHandCursor: true });

        const trait = opts.trait || Phaser.Utils.Array.GetRandom(TRAIT_IDS);

        const animal = {
            id: opts.id || genId('a'), speciesId, name, habitatId,
            variantIdx: vi, gender,
            hunger: opts.hunger ?? 75, happiness: opts.happiness ?? 60, health: opts.health ?? 100,
            sprite, tx: ax, ty: ay,
            wTimer: 0, wInterval: Phaser.Math.Between(2000, 6000),
            bobOffset: Math.random() * Math.PI * 2, baseX: ax, baseY: ay, sleeping: false,
            trait,
            illness: opts.illness || null,
            bonds: opts.bonds || [],
            bondLevel: opts.bondLevel || 0,
            bondXP: opts.bondXP || 0,
            neglectTimer: opts.neglectTimer || 0,
            lonelyTimer: opts.lonelyTimer || 0,
            isBaby: opts.isBaby || false,
            growthTimer: opts.growthTimer || 0,
            breedCooldown: opts.breedCooldown || 0,
            isPregnant: opts.isPregnant || false,
            pregnancyTimer: opts.pregnancyTimer || 0,
            mateVariantIdx: opts.mateVariantIdx,
            mateTrait: opts.mateTrait,
            mateName: opts.mateName,
            mateGeneration: opts.mateGeneration,
            generation: opts.generation || 1,
        };

        if (animal.isBaby) sprite.setScale(0.6);

        sprite.on('pointerdown', () => {
            if (!this.state.viewingHabitat || this.state.rescuePaused) return;
            this._skipPointerDown = true;
            this.sfx.click();
            if (this.state.viewingHabitat !== animal.habitatId) {
                const hab = this.state.habitats.find(h => h.id === animal.habitatId);
                if (!hab) return;
                this.zoomToHabitat(hab);
                this.game.events.emit('showHabitatInfo', hab);
            }
            this.selectAnimal(animal);
        });
        sprite.on('pointerover', () => {
            if (!this.state.viewingHabitat || this.state.rescuePaused) return;
            if (!sprite.preFX) return;
            if (!sprite._hoverGlow) sprite._hoverGlow = sprite.preFX.addGlow(0xffffff, 2, 0, false, 0.15, 10);
        });
        sprite.on('pointerout', () => {
            if (this._selectedAnimal === animal) return;
            if (sprite._hoverGlow) { sprite.preFX.remove(sprite._hoverGlow); sprite._hoverGlow = null; }
        });

        this.state.animals.push(animal);
        hab.animals.push(animal.id);
        return animal;
    }

    updateAnimals(delta, time) {
        const sDelta = delta * this.timeSpeedMult;
        // Night: 21:00–05:00 (1260–300 min in 1440-min day)
        const isNight = this.state.time >= 1260 || this.state.time < 300;
        const seasonBonus = SEASONS[this.state.season].bonuses;
        const enrichUpgrade = this.state.upgrades.has('enrichment_up') ? 0.5 : 1;
        const hungerMult = seasonBonus.hungerRate || 1;

        for (const a of this.state.animals) {
            const sp = SPECIES[a.speciesId];
            const tr = TRAITS[a.trait] || {};
            a.sleeping = isNight;

            const hab = this.state.habitats.find(h => h.id === a.habitatId);
            const enrichHappy = hab ? this.getEnrichmentHappyBonus(hab) * 0.002 : 0;
            const enrichMod = (tr.enrichBonus || 1);

            a.hunger = Math.max(0, a.hunger - sp.hungerRate * (tr.hungerMult || 1) * hungerMult * sDelta / 1000);
            if (a.hunger < 20) a.happiness = Math.max(0, a.happiness - 0.4 * sDelta / 1000);
            const happyDecay = 0.03 * (tr.happyMult || 1) * enrichUpgrade;
            a.happiness = Math.max(0, Math.min(100, a.happiness - happyDecay * sDelta / 1000 + enrichHappy * enrichMod * sDelta / 1000));
            if (a.health < 50) a.happiness = Math.max(0, a.happiness - 0.2 * sDelta / 1000);

            // Bond happiness boost: only friends in the same habitat count
            if (a.bonds.length > 0) {
                const nearbyFriends = a.bonds.filter(bid => {
                    const f = this.state.animals.find(x => x.id === bid);
                    return f && f.habitatId === a.habitatId;
                }).length;
                if (nearbyFriends > 0) {
                    a.happiness = Math.min(100, a.happiness + 0.008 * nearbyFriends * sDelta / 1000);
                }
            }

            // Loneliness debuff: temporary sadness after being separated from friends
            if (a.lonelyTimer > 0) {
                a.happiness = Math.max(0, a.happiness - 0.04 * sDelta / 1000);
                a.lonelyTimer = Math.max(0, a.lonelyTimer - sDelta);
            }

            // Natural bond XP growth (slow passive gain while well cared for)
            if (a.hunger > 40 && a.happiness > 40 && !a.illness) {
                a.bondXP += 0.015 * sDelta / 1000;
                const needed = this.getBondXPForLevel(a.bondLevel);
                if (a.bondXP >= needed) this.addBondXP(a, 0);
            }

            // Health: stays at 100 unless ill; restores slowly when healthy
            if (a.illness) {
                const ill = ILLNESSES[a.illness.type];
                if (ill) {
                    a.health = Math.max(0, a.health - ill.healthDrain * sDelta / 1000);
                    a.happiness = Math.max(0, a.happiness - ill.happyDrain * sDelta / 1000);
                }
            } else if (a.health < 100) {
                a.health = Math.min(100, a.health + 0.08 * sDelta / 1000);
            }

            // Neglect: hunger or happiness at 0 for >1 game-hour drains health
            if (a.hunger <= 0 || a.happiness <= 0) {
                a.neglectTimer += sDelta / 1000;
                if (a.neglectTimer >= 60) {
                    a.health = Math.max(0, a.health - 0.5 * sDelta / 1000);
                }
            } else {
                a.neglectTimer = 0;
            }

            // Death
            if (a.health <= 0) {
                this.game.events.emit('notification', `${a.name} the ${sp.name} has passed away...`);
                if (a.alertIcon) a.alertIcon.destroy();
                a.sprite.destroy();
                const habObj = this.state.habitats.find(h => h.id === a.habitatId);
                if (habObj) habObj.animals = habObj.animals.filter(id => id !== a.id);
                this.state.animals = this.state.animals.filter(x => x.id !== a.id);
                if (this._selectedAnimal === a) { this._selectedAnimal = null; }
                this.game.events.emit('animalUpdate');
                continue;
            }

            // Baby growth: 720 = minutes per in-game day
            if (a.isBaby) {
                a.growthTimer += sDelta / 1000;
                const growDays = 5;
                const growProgress = Math.min(1, a.growthTimer / (growDays * 720));
                a.sprite.setScale(0.6 + 0.4 * growProgress);
                if (growProgress >= 1) {
                    a.isBaby = false;
                    a.growthTimer = 0;
                    a.sprite.setScale(1);
                    this.game.events.emit('notification', `${a.name} has grown up!`);
                }
            }

            // Breeding cooldown
            if (a.breedCooldown > 0) a.breedCooldown -= sDelta / 1000;

            // Pregnancy
            if (a.isPregnant) {
                a.pregnancyTimer -= sDelta / 1000;
                if (a.pregnancyTimer <= 0) {
                    a.isPregnant = false;
                    this.birthBaby(a);
                }
            }

            if (a.sleeping) {
                a.sprite.setAlpha(0.75);
                if (!a.zzzTimer) a.zzzTimer = 0;
                a.zzzTimer += sDelta;
                if (a.zzzTimer > 3000) {
                    a.zzzTimer = 0;
                    const z = this.add.image(a.sprite.x + 10, a.sprite.y - 12, 'particle_zzz').setDepth(55).setScale(0.5).setAlpha(0.7);
                    this.tweens.add({ targets: z, y: z.y - 20, alpha: 0, scale: 0.8, duration: 1500, onComplete: () => z.destroy() });
                }
            } else {
                a.sprite.setAlpha(1);
                a.wTimer += sDelta;
                if (a.wTimer >= a.wInterval) {
                    a.wTimer = 0;
                    a.wInterval = Phaser.Math.Between(2000, 6000);
                    if (hab) {
                        a.tx = (hab.gx + 0.5 + Math.random() * (hab.w - 1)) * TILE;
                        a.ty = MAP_Y + (hab.gy + 0.5 + Math.random() * (hab.h - 1)) * TILE;
                    }
                }
                const dx = a.tx - a.baseX, dy = a.ty - a.baseY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 1) {
                    const spd = Math.min(18 * sDelta / 1000, dist);
                    a.baseX += (dx / dist) * spd;
                    a.baseY += (dy / dist) * spd;
                    a.sprite.setFlipX(dx < 0);
                }
                const bob = Math.sin((time * 0.002) + a.bobOffset) * 1.5;
                a.sprite.x = Math.round(a.baseX);
                a.sprite.y = Math.round(a.baseY + bob);
            }

            // Alert icon: any problem (low hunger, low happiness, low health, illness)
            const needsAlert = a.hunger < 15 || a.happiness < 15 || a.health < 40 || a.illness;
            if (needsAlert && !a.alertIcon) {
                a.alertIcon = this.add.text(0, 0, '!', {
                    fontFamily: '"Press Start 2P", monospace', fontSize: '10px', color: '#FF4444',
                    stroke: '#000', strokeThickness: 2
                }).setDepth(55);
            }
            if (a.alertIcon) {
                if (!needsAlert) { a.alertIcon.destroy(); a.alertIcon = null; }
                else a.alertIcon.setPosition(a.sprite.x + 12, a.sprite.y - 16);
            }
        }
        this._animalRefreshTimer = (this._animalRefreshTimer || 0) + delta;
        if (this._animalRefreshTimer >= 2000) {
            this._animalRefreshTimer = 0;
            this.game.events.emit('animalUpdate');
        }
    }

    feedAnimal(id) {
        const a = this.state.animals.find(x => x.id === id);
        if (!a) return;
        const sp = SPECIES[a.speciesId];
        const cost = sp.foodCost || 5;
        if (this.state.food < cost) {
            this.game.events.emit('notification', 'Not enough food!');
            this.sfx.error(); return;
        }
        this.state.food -= cost;
        this.game.events.emit('foodUpdate', this.state.food);
        let feedAmt = 35;
        if (this.state.upgrades.has('premium_food')) feedAmt = 60;
        else if (this.state.upgrades.has('better_feed')) feedAmt = 45;
        if (this.hasResearch('feed_boost')) feedAmt = Math.round(feedAmt * 1.2);
        a.hunger = Math.min(100, a.hunger + feedAmt);
        this.heartEffect(a.sprite.x, a.sprite.y);
        this.sfx.feed();
        this.tweens.add({
            targets: a.sprite, scaleX: a.isBaby ? 0.72 : 1.2, scaleY: a.isBaby ? 0.51 : 0.85,
            yoyo: true, duration: 150, ease: 'Quad.easeOut',
            onComplete: () => { a.sprite.scaleX = a.isBaby ? 0.6 : 1; a.sprite.scaleY = a.isBaby ? 0.6 : 1; }
        });
    }

    petAnimal(id) {
        const a = this.state.animals.find(x => x.id === id);
        if (!a) return;
        const tr = TRAITS[a.trait] || {};
        const bonus = 20 * (tr.petBonus || 1);
        a.happiness = Math.min(100, a.happiness + bonus);
        this.heartEffect(a.sprite.x, a.sprite.y);
        this.sfx.pet();
        this.tweens.add({ targets: a.sprite, y: a.sprite.y - 6, yoyo: true, duration: 180, ease: 'Quad.easeOut' });
    }

    getBondXPForLevel(level) {
        return 50 + level * 25;
    }

    addBondXP(animal, amount) {
        animal.bondXP += amount;
        let needed = this.getBondXPForLevel(animal.bondLevel);
        while (animal.bondXP >= needed) {
            animal.bondXP -= needed;
            animal.bondLevel++;
            needed = this.getBondXPForLevel(animal.bondLevel);
            this.starEffect(animal.sprite.x, animal.sprite.y);
            this.game.events.emit('notification', `Bond with ${animal.name} reached level ${animal.bondLevel}!`);
        }
    }

    treatAnimal(id) {
        const a = this.state.animals.find(x => x.id === id);
        if (!a || this.state.coins < 20) return;
        this.spendCoins(20);
        a.hunger = Math.min(100, a.hunger + 15);
        a.happiness = Math.min(100, a.happiness + 15);
        const sp = SPECIES[a.speciesId];
        this.addBondXP(a, sp.bondTreatsBase * 2);
        this.heartEffect(a.sprite.x, a.sprite.y);
        this.sfx.treat();
    }

    healAnimal(id) {
        const a = this.state.animals.find(x => x.id === id);
        if (!a) return;
        if (a.illness) {
            const ill = ILLNESSES[a.illness.type];
            let cost = ill ? ill.treatCost : 30;
            if (this.hasResearch('super_vet')) cost = Math.round(cost * 0.5);
            if (this.state.coins < cost) { this.sfx.error(); return; }
            this.spendCoins(cost);
            a.illness = null;
            a.health = Math.min(100, a.health + 25);
            this.state.stats.healed++;
            this.game.events.emit('notification', `${a.name} has been cured!`);
        } else {
            if (this.state.coins < 30) { this.sfx.error(); return; }
            if (!this.state.upgrades.has('medical_kit')) return;
            this.spendCoins(30);
            a.health = Math.min(100, a.health + 35);
        }
        a.happiness = Math.min(100, a.happiness + 5);
        this.starEffect(a.sprite.x, a.sprite.y);
        this.sfx.treat();
    }

    heartEffect(x, y) {
        for (let i = 0; i < 3; i++) {
            const h = this.add.image(x + Phaser.Math.Between(-8, 8), y, 'particle_heart').setDepth(55).setScale(0.5);
            this.tweens.add({ targets: h, y: y - 25 - i * 8, alpha: 0, scale: 1.2, duration: 700, delay: i * 120, onComplete: () => h.destroy() });
        }
    }

    starEffect(x, y) {
        for (let i = 0; i < 2; i++) {
            const s = this.add.image(x + Phaser.Math.Between(-12, 12), y - 5, 'particle_star').setDepth(55).setScale(0.4);
            this.tweens.add({ targets: s, y: y - 30, alpha: 0, scale: 1, angle: 180, duration: 600, delay: i * 100, onComplete: () => s.destroy() });
        }
    }

    /* ========== BREEDING ========== */
    // Automatic: male+female of same species, same habitat, both adult/healthy/off cooldown.
    // checkAutoBreed runs periodically from a timer; small random chance per eligible pair per check.
    // Trait inheritance: 45% mother / 45% father / 10% random mutation.
    // Generations: baby gen = max(parent gens) + 1; rescued animals are gen 1.
    // Naming: breed-only babies always use their variant's fixed name; normal babies
    // inherit the same-gender parent's name (girls from mother, boys from father).

    checkAutoBreed() {
        if (this.state.rescuePaused || this.state.settingsPaused || this._habSelectMode) return;
        const checked = new Set();
        for (const a of this.state.animals) {
            if (a.isBaby || a.isPregnant || a.breedCooldown > 0 || a.illness) continue;
            if (checked.has(a.id)) continue;
            const hab = this.state.habitats.find(h => h.id === a.habitatId);
            if (!hab || hab.animals.length >= this.getHabitatCapacity(hab)) continue;
            const partner = this.state.animals.find(b =>
                b.id !== a.id && b.speciesId === a.speciesId &&
                b.habitatId === a.habitatId && !b.isBaby && !b.isPregnant &&
                b.breedCooldown <= 0 && !b.illness &&
                b.gender !== a.gender
            );
            if (!partner) continue;
            checked.add(a.id); checked.add(partner.id);

            const breedBoost = this.hasResearch('breed_boost');
            const chance = breedBoost ? 0.12 : 0.06;
            if (Math.random() > chance) continue;

            // Female carries the pregnancy
            const mother = a.gender === 'female' ? a : partner;
            const father = mother === a ? partner : a;
            mother.isPregnant = true;
            mother.mateVariantIdx = father.variantIdx;
            mother.mateTrait = father.trait;
            mother.mateName = father.name;
            mother.mateGeneration = father.generation || 1;
            mother.pregnancyTimer = (breedBoost ? 1.5 : 3) * 720;
            mother.breedCooldown = (breedBoost ? 4 : 7) * 720;
            father.breedCooldown = (breedBoost ? 4 : 7) * 720;

            this.heartEffect(a.sprite.x, a.sprite.y);
            this.heartEffect(partner.sprite.x, partner.sprite.y);
            this.sfx.rescue();
            this.game.events.emit('notification', `${mother.name} and ${father.name} are expecting!`);
        }
    }

    birthBaby(parent) {
        const sp = SPECIES[parent.speciesId];
        const pA = parent.variantIdx;
        const pB = parent.mateVariantIdx;

        // Check for breed-only variant recipes
        let vi = null;
        if (pA != null && pB != null) {
            for (let i = 0; i < sp.variants.length; i++) {
                const v = sp.variants[i];
                if (!v.breedOnly || !v.parents) continue;
                const [rA, rB] = v.parents;
                if ((pA === rA && pB === rB) || (pA === rB && pB === rA)) {
                    vi = i;
                    break;
                }
            }
        }
        if (vi == null) {
            const normal = sp.variants.map((v, i) => v.breedOnly ? -1 : i).filter(i => i >= 0);
            vi = normal[Phaser.Math.Between(0, normal.length - 1)];
        }

        const v = sp.variants[vi];
        const isSpecial = v.breedOnly;
        const babyGen = Math.max(parent.generation || 1, parent.mateGeneration || 1) + 1;

        // Trait inheritance: 45% mother, 45% father, 10% mutation
        const tRoll = Math.random();
        const inheritedTrait = tRoll < 0.45 ? parent.trait
            : tRoll < 0.9 ? (parent.mateTrait || parent.trait)
            : Phaser.Utils.Array.GetRandom(TRAIT_IDS);

        // Breed-only babies always use their variant's fixed name;
        // normal babies inherit the same-gender parent's name
        let babyName = v.name;
        if (!isSpecial) {
            const babyIsFemale = v.gender === 'f';
            if (babyIsFemale) babyName = parent.name;
            else if (parent.mateName) babyName = parent.mateName;
        }

        const baby = this.addAnimal(sp.id, babyName, parent.habitatId, {
            isBaby: true, variantIdx: vi, trait: inheritedTrait, generation: babyGen,
        });
        if (baby) {
            this.state.stats.bred++;
            this.state.rescuedVariants.add(`${sp.id}_${vi}`);
            this.state.seenVariants.add(`${sp.id}_${vi}`);
            if (!this.state.discoveries.has(parent.speciesId)) this.state.discoveries.add(parent.speciesId);
            const label = isSpecial ? `★ Special variant! ${babyName}` : babyName;
            this.game.events.emit('notification', `${label} the baby ${sp.name} was born!`);
            this.sfx.rescue();
            this.starEffect(parent.sprite.x, parent.sprite.y);
        }
        parent.mateVariantIdx = undefined;
        parent.mateTrait = undefined;
        parent.mateName = undefined;
        parent.mateGeneration = undefined;
    }

    /* ========== ILLNESS ========== */
    // Random chance per tick; hunger/happiness increase risk. Vets can auto-cure.
    // Emits animalUpdate when illness state changes so the HUD panel refreshes immediately.

    checkIllness() {
        if (this.state.rescuePaused || this.state.settingsPaused || this._habSelectMode) return;
        const hasVet = this.state.staff.some(s => s.type === 'vet');
        let changed = false;
        for (const a of this.state.animals) {
            if (a.illness) {
                const vetChance = this.hasResearch('super_vet') ? 1.0 : 0.3;
                if (hasVet && Math.random() < vetChance) {
                    a.illness = null;
                    a.health = Math.min(100, a.health + 15);
                    this.game.events.emit('notification', `Vet cured ${a.name}!`);
                    changed = true;
                }
                continue;
            }
            let chance = 0.03;
            if (a.hunger < 20) chance += 0.04;
            if (a.happiness < 20) chance += 0.02;
            if (hasVet) chance *= 0.4;
            if (this.hasResearch('illness_resist')) chance *= 0.6;
            if (Math.random() < chance) {
                const types = Object.keys(ILLNESSES);
                a.illness = { type: Phaser.Utils.Array.GetRandom(types), dayStarted: this.state.day };
                const ill = ILLNESSES[a.illness.type];
                this.game.events.emit('notification', `${a.name} has ${ill.name}!`);
                changed = true;
            }
        }
        if (changed) this.game.events.emit('animalUpdate');
    }

    /* ========== BONDS ========== */
    // Pairs in same habitat form friendships over time; social trait speeds this up.
    // Guarded: skipped while rescuePaused, settingsPaused, or habSelectMode (runs on its own timer).

    updateBonds() {
        if (this.state.rescuePaused || this.state.settingsPaused || this._habSelectMode) return;
        for (const hab of this.state.habitats) {
            const habAnimals = this.state.animals.filter(a => a.habitatId === hab.id && !a.isBaby);
            if (habAnimals.length < 2) continue;
            for (let i = 0; i < habAnimals.length; i++) {
                for (let j = i + 1; j < habAnimals.length; j++) {
                    const a = habAnimals[i], b = habAnimals[j];
                    if (a.bonds.includes(b.id)) continue;
                    let chance = 0.05;
                    if (TRAITS[a.trait]?.id === 'social') chance += 0.1;
                    if (TRAITS[b.trait]?.id === 'social') chance += 0.1;
                    if (this.hasResearch('fast_bonds')) chance *= 3;
                    if (Math.random() < chance) {
                        a.bonds.push(b.id);
                        b.bonds.push(a.id);
                        this.game.events.emit('notification', `${a.name} and ${b.name} became friends!`);
                    }
                }
            }
        }
    }

    /* ========== MISSIONS ========== */
    // Expeditions to biomes; timer-based, then random outcome (animal, supplies, or nothing).

    launchMission(biomeId) {
        const m = MISSIONS[biomeId];
        if (!m) return;
        if (this.state.activeMissions.length >= 2) {
            this.game.events.emit('notification', 'Max 2 active missions!');
            this.sfx.error(); return;
        }
        if (this.state.coins < m.cost) {
            this.game.events.emit('notification', 'Not enough coins!');
            this.sfx.error(); return;
        }
        this.spendCoins(m.cost);
        this.state.activeMissions.push({
            id: genId('mis'), biome: biomeId,
            startTime: this.state.time, startDay: this.state.day,
            duration: m.duration, elapsed: 0, complete: false
        });
        this.sfx.build();
        this.game.events.emit('notification', `Mission to ${m.name} launched!`);
        this.game.events.emit('missionsUpdate');
    }

    updateMissions(delta) {
        for (const mis of this.state.activeMissions) {
            if (mis.complete) continue;
            mis.elapsed += TIME_SCALE * this.timeSpeedMult * delta / 1000;
            if (mis.elapsed >= mis.duration) {
                mis.complete = true;
                this.completeMission(mis);
            }
        }
        this.state.activeMissions = this.state.activeMissions.filter(m => !m.complete);
    }

    completeMission(mis) {
        const m = MISSIONS[mis.biome];
        this.state.stats.missionsComplete++;
        this.earnResearchPoints(2);

        const roll = Math.random();
        if (roll < 0.65) {
            let pool = [...m.species];
            if (this.hasResearch('mission_species_bonus')) {
                const extra = Object.values(SPECIES)
                    .filter(s => !pool.includes(s.id) && (!s.season || s.season === this.state.season))
                    .sort(() => Math.random() - 0.5).slice(0, 2).map(s => s.id);
                pool.push(...extra);
            }
            const speciesId = Phaser.Utils.Array.GetRandom(pool);
            const sp = SPECIES[speciesId];
            const normal = sp.variants.map((v, i) => v.breedOnly ? -1 : i).filter(i => i >= 0);
            const vi = normal[Phaser.Math.Between(0, normal.length - 1)];
            const v = sp.variants[vi];
            const hab = this.findCompatibleHabitat(sp);
            if (hab) {
                this.addAnimal(speciesId, v.name, hab.id, { variantIdx: vi });
                this.state.stats.rescued++;
                this.state.rescuedVariants.add(`${speciesId}_${vi}`);
                this.state.seenVariants.add(`${speciesId}_${vi}`);
                if (!this.state.discoveries.has(speciesId)) {
                    this.state.discoveries.add(speciesId);
                    this.game.events.emit('notification', `New species discovered: ${sp.name}!`);
                }
                this.game.events.emit('notification', `Mission found ${name} the ${sp.name}!`);
                this.sfx.rescue();
            } else {
                const coins = Math.round(m.cost * 0.5);
                this.addCoins(coins);
                this.game.events.emit('notification', `Found a ${sp.name} but no habitat! Refunded ${coins}g.`);
            }
        } else if (roll < 0.9) {
            const coins = Phaser.Math.Between(30, 80);
            this.addCoins(coins);
            this.game.events.emit('notification', `Mission found ${coins}g worth of supplies!`);
        } else {
            this.game.events.emit('notification', 'Mission found nothing this time.');
        }
        this.sfx.notify();
        this.game.events.emit('missionsUpdate');
    }

    /* ========== SEASONS ========== */
    // Cycle through spring/summer/autumn/winter; affects particles, bonuses, species availability.

    getSeason() {
        return SEASON_ORDER[Math.floor(((this.state.day - 1) % SEASON_CYCLE) / SEASON_LENGTH)];
    }

    updateSeason() {
        const newSeason = this.getSeason();
        if (newSeason !== this.state.season) {
            this.state.prevSeason = this.state.season;
            this.state.season = newSeason;
            this.game.events.emit('notification', `${SEASONS[newSeason].name} has arrived!`);
            this.game.events.emit('seasonChanged', newSeason);
            this.sfx.seasonal();
        }
        this.state.seasonsVisited.add(this.state.season);
        const s = SEASONS[this.state.season];
        this.seasonOverlay.setFillStyle(s.tint, s.tintAlpha);
        this.updateSeasonParticles();
    }

    /* ========== TIME ========== */
    // 1440 min/day, TIME_SCALE for speed. Day/night overlay: pre-dawn 04:00–05:00, dawn 05:00–07:00, day 07:00–12:00, dusk 12:00–17:00, sunset 17:00–20:00, night 20:00–04:00.

    updateTime(delta) {
        this.state.time += TIME_SCALE * this.timeSpeedMult * delta / 1000;
        if (this.state.time >= 1440) {
            this.state.time -= 1440;
            this.state.day++;
            if (this.state.stats.visitors > 0) this.state.rep += 2;
            this.earnResearchPoints(1);
            this.paySalaries();
            this.updateSeason();
            this.sfx.newDay();
            this.game.events.emit('notification', `Day ${this.state.day} begins!`);
        }

        const t = this.state.time;
        // Lighting phases: 240–300 pre-dawn, 300–420 dawn, 420–720 day, 720–1020 dusk, 1020–1200 sunset, night otherwise
        let color = 0x000033, alpha = 0;
        if (t >= 240 && t < 300) {
            const p = (t - 240) / 60;
            alpha = 0.32 - p * 0.14;
            color = Phaser.Display.Color.GetColor(p * 40 | 0, p * 20 | 0, 51 + p * 4 | 0);
        } else if (t >= 300 && t < 420) {
            const p = (t - 300) / 120;
            alpha = 0.18 * (1 - p);
            color = Phaser.Display.Color.GetColor(40 + p * 20 | 0, 20 + p * 30 | 0, 55 - p * 40 | 0);
        } else if (t >= 420 && t < 720) {
            alpha = 0;
        } else if (t >= 720 && t < 1020) {
            alpha = 0.03; color = 0x332200;
        } else if (t >= 1020 && t < 1200) {
            const p = (t - 1020) / 180;
            alpha = 0.08 + p * 0.2;
            color = Phaser.Display.Color.GetColor(50 * p | 0, 15 * p | 0, 35 * p | 0);
        } else {
            color = 0x000033; alpha = 0.32;
        }
        this.overlay.setFillStyle(color, alpha);
        this.game.events.emit('timeUpdate', {
            time: this.state.time, day: this.state.day,
            season: this.state.season, rep: this.state.rep
        });
    }

    /* ========== VISITORS ========== */
    // Goal-driven AI: visitors enter (admission fee collected silently), then visit habitats one by one.
    // ~50% of visitors have wantsTour=true and will walk to the tour guide's post (seekingGuide phase)
    // instead of exploring independently. If no guide is available they fall back to normal seeking.
    // Phases: entering → [seekingGuide →] seeking → [confused →] seeking → viewing → seeking/leaving.
    // Visitors prefer path tiles (dec_path/entrance) for both routes and viewing spots. If a habitat
    // is not connected to the path network, they walk on paths as far as possible, pause with a "?"
    // bubble for 2 seconds (confused phase), then walk on grass. Short grass gaps (≤2 tiles) are
    // walked seamlessly without pausing. Guided visitors (following a tour guide) skip normal movement.
    // findViewingSpot picks spots adjacent to habitats, preferring path tiles, avoiding overlap with
    // other seeking/viewing visitors and with guided visitors' assigned _showingSpot positions.
    // At each habitat they react: heart bubble (+1 rep) if animals are well, worried bubble (-1 rep) if
    // animals are suffering, or "..." bubble (no rep change) if the habitat is empty — they linger briefly
    // then move on. A* pathfinding uses 8-direction diagonal movement for natural-looking routes.
    // On exit they pay a satisfaction-based donation. Spawning is suppressed during rescue popups.
    // Each visitor tracks habitats already visited and views each for a variable duration.

    pickVisitorType() {
        const vipThreshold = this.hasResearch('vip_easier') ? 50 : null;
        const types = Object.values(VISITOR_TYPES).filter(vt => {
            const minRep = (vt.id === 'vip' && vipThreshold !== null) ? vipThreshold : vt.minRep;
            if (minRep && this.state.rep < minRep) return false;
            return true;
        });
        const total = types.reduce((s, t) => s + t.weight, 0);
        let r = Math.random() * total;
        for (const t of types) { r -= t.weight; if (r <= 0) return t; }
        return types[0];
    }

    randomOpenTile() {
        for (let attempt = 0; attempt < 20; attempt++) {
            const gx = Phaser.Math.Between(1, COLS - 2);
            const gy = Phaser.Math.Between(1, ROWS - 2);
            if (this.grid[gy][gx] === null) {
                return { x: gx * TILE + TILE / 2, y: MAP_Y + gy * TILE + TILE / 2 };
            }
        }
        return { x: Phaser.Math.Between(3, COLS - 4) * TILE, y: MAP_Y + Phaser.Math.Between(3, ROWS - 4) * TILE };
    }

    findViewingSpot(hab, visitor) {
        const pathSpots = [];
        const grassSpots = [];
        const sides = [
            { dx: -1, dy: 0 }, { dx: hab.w, dy: 0 },
            { dx: 0, dy: -1 }, { dx: 0, dy: hab.h },
        ];
        for (const side of sides) {
            const len = (side.dx === -1 || side.dx === hab.w) ? hab.h : hab.w;
            for (let s = 0; s < len; s++) {
                const gx = hab.gx + (side.dx === -1 ? -1 : side.dx === hab.w ? hab.w : s);
                const gy = hab.gy + (side.dy === -1 ? -1 : side.dy === hab.h ? hab.h : s);
                if (gx < 0 || gx >= COLS || gy < 0 || gy >= ROWS) continue;
                const cell = this.grid[gy]?.[gx];
                if ((cell && cell.startsWith('dec_path')) || cell === 'entrance') {
                    pathSpots.push({ x: gx * TILE + TILE / 2, y: MAP_Y + gy * TILE + TILE / 2 });
                } else if (cell === null) {
                    grassSpots.push({ x: gx * TILE + TILE / 2, y: MAP_Y + gy * TILE + TILE / 2 });
                }
            }
        }
        const spots = pathSpots.length > 0 ? pathSpots : grassSpots;
        if (spots.length === 0) return null;

        const minDist = TILE * 0.8;
        const isFree = (sp) => {
            for (const ov of this.visitors) {
                if (ov === visitor) continue;
                if (ov.phase === 'viewing' || ov.phase === 'seeking') {
                    if (Math.abs(ov.tx - sp.x) + Math.abs(ov.ty - sp.y) < minDist) return false;
                }
                if (ov._showingSpot) {
                    if (Math.abs(ov._showingSpot.x - sp.x) + Math.abs(ov._showingSpot.y - sp.y) < minDist) return false;
                }
            }
            return true;
        };

        const vx = visitor ? visitor.sprite.x : 0;
        const vy = visitor ? visitor.sprite.y : 0;
        const distTo = (sp) => Math.abs(sp.x - vx) + Math.abs(sp.y - vy);

        const free = spots.filter(isFree);
        const pool = free.length > 0 ? free : spots;
        pool.sort((a, b) => distTo(a) - distTo(b));

        const closest = distTo(pool[0]);
        const nearPool = pool.filter(sp => distTo(sp) <= closest + TILE * 2);
        return Phaser.Utils.Array.GetRandom(nearPool);
    }

    pickNextHabitat(v) {
        const unvisited = this.state.habitats.filter(h => !v.visitedHabs.has(h.id));
        const pool = unvisited.length > 0 ? unvisited : this.state.habitats;
        if (pool.length === 0) return null;
        const crowdCount = (hab) => this.visitors.filter(
            ov => ov !== v && (ov.targetHab === hab.id) && (ov.phase === 'viewing' || ov.phase === 'seeking')
        ).length;
        pool.sort((a, b) => crowdCount(a) - crowdCount(b));
        const leastCrowded = crowdCount(pool[0]);
        const best = pool.filter(h => crowdCount(h) <= leastCrowded + 1);
        return Phaser.Utils.Array.GetRandom(best);
    }

    pickGiftShop() {
        const shops = this.state.facilities.filter(f => f.type === 'gift_shop');
        return shops.length > 0 ? Phaser.Utils.Array.GetRandom(shops) : null;
    }

    pickBathroom() {
        const bathrooms = this.state.facilities.filter(f => f.type === 'bathroom');
        return bathrooms.length > 0 ? Phaser.Utils.Array.GetRandom(bathrooms) : null;
    }

    findFacilitySpot(fac, visitor) {
        const pathSpots = [];
        const grassSpots = [];
        const sides = [
            { dx: -1, dy: 0 }, { dx: fac.w, dy: 0 },
            { dx: 0, dy: -1 }, { dx: 0, dy: fac.h },
        ];
        for (const side of sides) {
            const len = (side.dx === -1 || side.dx === fac.w) ? fac.h : fac.w;
            for (let s = 0; s < len; s++) {
                const gx = fac.gx + (side.dx === -1 ? -1 : side.dx === fac.w ? fac.w : s);
                const gy = fac.gy + (side.dy === -1 ? -1 : side.dy === fac.h ? fac.h : s);
                if (gx < 0 || gx >= COLS || gy < 0 || gy >= ROWS) continue;
                const cell = this.grid[gy]?.[gx];
                if ((cell && cell.startsWith('dec_path')) || cell === 'entrance') {
                    pathSpots.push({ x: gx * TILE + TILE / 2, y: MAP_Y + gy * TILE + TILE / 2 });
                } else if (cell === null) {
                    grassSpots.push({ x: gx * TILE + TILE / 2, y: MAP_Y + gy * TILE + TILE / 2 });
                }
            }
        }
        const spots = pathSpots.length > 0 ? pathSpots : grassSpots;
        if (spots.length === 0) return null;
        const minDist = TILE * 0.8;
        const isFree = (sp) => {
            for (const ov of this.visitors) {
                if (ov === visitor) continue;
                if (ov.phase === 'viewing' || ov.phase === 'seeking' || ov.phase === 'atGiftShop' || ov.phase === 'seekingGiftShop' || ov.phase === 'atBathroom' || ov.phase === 'seekingBathroom' || ov.phase === 'noBathroom') {
                    const ox = ov._giftShopSpot ? ov._giftShopSpot.x : ov.tx;
                    const oy = ov._giftShopSpot ? ov._giftShopSpot.y : ov.ty;
                    if (Math.abs(ox - sp.x) + Math.abs(oy - sp.y) < minDist) return false;
                }
            }
            return true;
        };
        const free = spots.filter(isFree);
        const pool = free.length > 0 ? free : spots;
        return Phaser.Utils.Array.GetRandom(pool);
    }

    trySpawnVisitor() {
        if (this.state.buildMode || this._habSelectMode || this.state.settingsPaused || this.state.rescuePaused) return;
        const t = this.state.time;
        if (t < 480 || t > 1080) return;
        if (this.state.habitats.length === 0) return;
        const seasonBonus = SEASONS[this.state.season].bonuses;
        let visMult = seasonBonus.visitors || 1;
        if (this.hasResearch('no_season_penalty') && visMult < 1) visMult = 1;
        if (this.hasResearch('more_visitors')) visMult *= 1.3;
        const maxVisitors = Math.round(8 * visMult);
        if (this.visitors.length >= maxVisitors) return;

        const vType = this.pickVisitorType();
        const entX = Phaser.Math.Between(13, 16) * TILE + TILE / 2;
        const sprite = this.add.image(entX, MAP_Y + (ROWS - 1) * TILE, `visitor_${vType.spriteIdx}`).setDepth(30).setAlpha(0.85);

        const entGx = Math.floor(entX / TILE);
        const entryTarget = { x: entGx * TILE + TILE / 2, y: MAP_Y + (ROWS - 2) * TILE + TILE / 2 };

        const v = {
            sprite, visitorType: vType.id,
            tx: entryTarget.x, ty: entryTarget.y,
            speed: Phaser.Math.Between(25, 40),
            timer: 0,
            maxTime: Phaser.Math.Between(12000, 25000) * (vType.stayMult || 1),
            phase: 'entering',
            targetHab: null,
            visitedHabs: new Set(),
            habsToVisit: Math.min(this.state.habitats.length, Phaser.Math.Between(1, Math.max(1, this.state.habitats.length))),
            viewTimer: 0,
            satisfaction: 0,
            wantsTour: Math.random() < 0.5,
            wantsGiftShop: Math.random() < 0.4,
            wantsBathroom: Math.random() < 0.35,
        };
        this._setVisitorPath(v);
        this.visitors.push(v);
    }

    // Spawn special NPC visitors from the meta-world (friendship-gated)
    trySpawnNPCVisitor() {
        if (this.state.buildMode || this._habSelectMode || this.state.settingsPaused || this.state.rescuePaused) return;
        const t = this.state.time;
        if (t < 480 || t > 1080) return;
        if (this.state.habitats.length === 0) return;
        if (this.visitors.length >= 10) return;

        // Check each NPC type
        for (const [npcKey, npcDef] of Object.entries(NPC_VISITOR_TYPES)) {
            // Already visiting?
            if (this.visitors.some(v => v._npcId === npcDef.id)) continue;

            // Cooldown: each NPC can only visit once per meta-day
            const metaDay = MetaState.state.day;
            const lastVisit = MetaState.state.npcVisitCooldowns[npcDef.id];
            if (lastVisit && lastVisit >= metaDay) continue;

            // Friendship gate
            const friendshipId = npcDef.id === 'tanaka' ? 'shopkeeper' : npcDef.id === 'elara' ? 'prof_elara' : npcDef.id;
            const friendship = MetaState.getFriendship(friendshipId);
            if (friendship < npcDef.minFriendship) continue;

            // Probability: higher friendship = more likely (10-40% per check)
            const chance = 0.1 + (friendship / 100) * 0.3;
            if (Math.random() > chance) continue;

            // Spawn this NPC visitor!
            const entX = Phaser.Math.Between(13, 16) * TILE + TILE / 2;
            const sprite = this.add.image(entX, MAP_Y + (ROWS - 1) * TILE, npcDef.spriteKey).setDepth(31).setAlpha(0.9);

            const entGx = Math.floor(entX / TILE);
            const entryTarget = { x: entGx * TILE + TILE / 2, y: MAP_Y + (ROWS - 2) * TILE + TILE / 2 };

            const v = {
                sprite, visitorType: 'family', // fallback for income calculations
                _npcId: npcDef.id,
                _npcDef: npcDef,
                tx: entryTarget.x, ty: entryTarget.y,
                speed: Phaser.Math.Between(28, 38),
                timer: 0,
                maxTime: Phaser.Math.Between(18000, 35000) * npcDef.stayMult,
                phase: 'entering',
                targetHab: null,
                visitedHabs: new Set(),
                habsToVisit: Math.min(this.state.habitats.length, Phaser.Math.Between(2, this.state.habitats.length)),
                viewTimer: 0,
                satisfaction: 0,
                wantsTour: false,
                wantsGiftShop: Math.random() < 0.6,
                wantsBathroom: Math.random() < 0.3,
            };
            this._setVisitorPath(v);
            this.visitors.push(v);

            // Track the visit
            MetaState.state.npcVisitCooldowns[npcDef.id] = metaDay;
            MetaState.state.npcVisitsTotal++;

            // Store a phone notification for meta-world
            MetaState.state.phoneNotifications.push({
                text: `${npcDef.name} visited your sanctuary!`,
                day: metaDay,
            });

            break; // Only spawn one NPC per check
        }
    }

    _isWalkable(gx, gy) {
        if (gy < 0 || gy >= ROWS || gx < 0 || gx >= COLS) return false;
        const cell = this.grid[gy]?.[gx];
        return cell === null || cell === 'entrance' || (cell && cell.startsWith('dec_path'));
    }

    _isPathWalkable(gx, gy) {
        if (gy < 0 || gy >= ROWS || gx < 0 || gx >= COLS) return false;
        const cell = this.grid[gy]?.[gx];
        return cell === 'entrance' || (cell && cell.startsWith('dec_path'));
    }

    _isStaffWalkable(gx, gy) {
        if (gy < 0 || gy >= ROWS || gx < 0 || gx >= COLS) return false;
        const cell = this.grid[gy]?.[gx];
        if (cell === null || cell === 'entrance' || (cell && cell.startsWith('dec_path'))) return true;
        if (typeof cell === 'string' && cell.startsWith('hab_')) return true;
        return false;
    }

    _isGuideWalkable(gx, gy) {
        if (gy < 0 || gy >= ROWS || gx < 0 || gx >= COLS) return false;
        const cell = this.grid[gy]?.[gx];
        return cell === null || cell === 'entrance' || (cell && cell.startsWith('dec_path'));
    }

    _findPath(sx, sy, ex, ey, walkFn) {
        const canWalk = walkFn || ((gx, gy) => this._isWalkable(gx, gy));
        const sgx = Math.floor(sx / TILE), sgy = Math.floor((sy - MAP_Y) / TILE);
        const egx = Math.floor(ex / TILE), egy = Math.floor((ey - MAP_Y) / TILE);
        if (sgx === egx && sgy === egy) return [];
        if (!canWalk(egx, egy)) return null;

        const key = (x, y) => x + y * COLS;
        const open = [{ gx: sgx, gy: sgy, g: 0, f: 0 }];
        const closed = new Set();
        const from = {};
        const gCost = {};
        gCost[key(sgx, sgy)] = 0;
        const DIAG = 1.414;
        const heuristic = (ax, ay) => {
            const dx = Math.abs(egx - ax), dy = Math.abs(egy - ay);
            return Math.min(dx, dy) * DIAG + Math.abs(dx - dy);
        };
        open[0].f = heuristic(sgx, sgy);

        const dirs = [
            [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
            [1, 1, DIAG], [-1, 1, DIAG], [1, -1, DIAG], [-1, -1, DIAG],
        ];
        let iterations = 0;
        while (open.length > 0 && iterations < 600) {
            iterations++;
            open.sort((a, b) => a.f - b.f);
            const cur = open.shift();
            const ck = key(cur.gx, cur.gy);
            if (cur.gx === egx && cur.gy === egy) {
                const path = [];
                let k = ck;
                while (from[k] !== undefined) {
                    const px = k % COLS, py = Math.floor(k / COLS);
                    path.unshift({ x: px * TILE + TILE / 2, y: MAP_Y + py * TILE + TILE / 2 });
                    k = from[k];
                }
                return path;
            }
            closed.add(ck);
            for (const [dx, dy, cost] of dirs) {
                const nx = cur.gx + dx, ny = cur.gy + dy;
                const nk = key(nx, ny);
                if (closed.has(nk) || !canWalk(nx, ny)) continue;
                if (dx !== 0 && dy !== 0) {
                    if (!canWalk(cur.gx + dx, cur.gy) || !canWalk(cur.gx, cur.gy + dy)) continue;
                }
                const ng = cur.g + cost;
                if (gCost[nk] !== undefined && ng >= gCost[nk]) continue;
                gCost[nk] = ng;
                from[nk] = ck;
                open.push({ gx: nx, gy: ny, g: ng, f: ng + heuristic(nx, ny) });
            }
        }
        return null;
    }

    _nearestPathTile(px, py) {
        const gx0 = Math.floor(px / TILE), gy0 = Math.floor((py - MAP_Y) / TILE);
        let best = null, bestDist = Infinity;
        const radius = 8;
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const nx = gx0 + dx, ny = gy0 + dy;
                if (this._isPathWalkable(nx, ny)) {
                    const d = dx * dx + dy * dy;
                    if (d < bestDist) {
                        bestDist = d;
                        best = { x: nx * TILE + TILE / 2, y: MAP_Y + ny * TILE + TILE / 2 };
                    }
                }
            }
        }
        return best;
    }

    _setVisitorPath(v) {
        v._grassPath = null;
        v._needsConfused = false;

        const hasPlacedPaths = this.state.decorations.some(d => DECORATIONS[d.id]?.isPath);
        if (!hasPlacedPaths) {
            const full = this._findPath(v.sprite.x, v.sprite.y, v.tx, v.ty);
            v._path = full || [];
            v._pathIdx = 0;
            return;
        }

        const pathWalk = (gx, gy) => this._isPathWalkable(gx, gy);

        const vgx = Math.floor(v.sprite.x / TILE);
        const vgy = Math.floor((v.sprite.y - MAP_Y) / TILE);
        const onPath = this._isPathWalkable(vgx, vgy);

        if (onPath) {
            const pathOnly = this._findPath(v.sprite.x, v.sprite.y, v.tx, v.ty, pathWalk);
            if (pathOnly) {
                v._path = pathOnly;
                v._pathIdx = 0;
                return;
            }
        }

        const nearDest = this._nearestPathTile(v.tx, v.ty);
        const nearStart = onPath ? null : this._nearestPathTile(v.sprite.x, v.sprite.y);

        if (nearDest) {
            const pathStart = nearStart
                ? { x: nearStart.x, y: nearStart.y }
                : { x: v.sprite.x, y: v.sprite.y };

            const toNearPath = nearStart
                ? (this._findPath(v.sprite.x, v.sprite.y, nearStart.x, nearStart.y) || [])
                : [];

            const onPathSeg = this._findPath(pathStart.x, pathStart.y, nearDest.x, nearDest.y, pathWalk);

            if (onPathSeg) {
                const grassSeg = this._findPath(nearDest.x, nearDest.y, v.tx, v.ty) || [];
                if (grassSeg.length <= 2) {
                    v._path = [...toNearPath, ...onPathSeg, ...grassSeg];
                    v._pathIdx = 0;
                } else {
                    v._path = [...toNearPath, ...onPathSeg];
                    v._pathIdx = 0;
                    v._grassPath = grassSeg;
                    v._needsConfused = true;
                }
                return;
            }
        }

        const full = this._findPath(v.sprite.x, v.sprite.y, v.tx, v.ty);
        v._path = full || [];
        v._pathIdx = 0;
    }

    _recalcVisitorPaths() {
        for (const v of this.visitors) {
            if (v.phase === 'viewing' || v.phase === 'confused' || v.phase === 'guided' || v.phase === 'seekingGuide' || v.phase === 'atGiftShop' || v.phase === 'atBathroom' || v.phase === 'noBathroom' || v.phase === 'seekingTrashcan' || v.phase === 'usingTrashcan') continue;
            if (v.phase === 'seeking' && v.targetHab) {
                const hab = this.state.habitats.find(h => h.id === v.targetHab);
                if (hab) {
                    const spot = this.findViewingSpot(hab, v) || this.randomOpenTile();
                    v.tx = spot.x; v.ty = spot.y;
                }
            }
            if ((v.phase === 'seekingGiftShop' || v.phase === 'seekingBathroom') && v.targetFac) {
                const fac = this.state.facilities.find(f => f.id === v.targetFac);
                if (fac) {
                    const spot = (fac.type === 'gift_shop' ? this.findGiftShopEntranceSpot(fac) : null) || this.findFacilitySpot(fac, v) || this.randomOpenTile();
                    v.tx = spot.x; v.ty = spot.y;
                }
            }
            this._setVisitorPath(v);
        }
    }

    updateVisitors(delta) {
        const sDelta = delta * this.timeSpeedMult;
        for (let i = this.visitors.length - 1; i >= 0; i--) {
            const v = this.visitors[i];
            v.timer += sDelta;

            if (v.phase === 'guided') continue;
            if (v.phase === 'confused') {
                v._confusedTimer = (v._confusedTimer || 0) + sDelta;
                if (v._confusedTimer >= 2000) {
                    v._path = v._grassPath || [];
                    v._pathIdx = 0;
                    v._grassPath = null;
                    v._needsConfused = false;
                    v.phase = 'seeking';
                }
                continue;
            }
            if (v.phase === 'seekingGuide') {
                const tg = this.state.staff.find(s => s.id === v._targetGuideId);
                if (!tg || (tg.phase !== 'idle' && tg.phase !== 'waiting')) {
                    v.phase = 'seeking';
                    v._targetGuideId = null;
                    this._visitorSeekHabitat(v);
                    continue;
                }
            }

            let wpx, wpy;
            if (v._path && v._pathIdx < v._path.length) {
                wpx = v._path[v._pathIdx].x;
                wpy = v._path[v._pathIdx].y;
            } else if (v._needsConfused && v._grassPath && v._grassPath.length > 0 && v.phase === 'seeking') {
                v.phase = 'confused';
                v._confusedTimer = 0;
                this.showVisitorBubble(v, 'confused');
                continue;
            } else {
                wpx = v.tx; wpy = v.ty;
            }
            const dx = wpx - v.sprite.x, dy = wpy - v.sprite.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 3) {
                const spd = v.speed * sDelta / 1000;
                v.sprite.x += (dx / dist) * spd;
                v.sprite.y += (dy / dist) * spd;
                if (Math.abs(dx) > 1) v.sprite.setFlipX(dx < 0);
                if (v._bubble) v._bubble.setPosition(v.sprite.x, v.sprite.y - 22);
                const nearTrash = this.getTrashNear(v.sprite.x, v.sprite.y);
                if (nearTrash && !(v._grossedTrash && v._grossedTrash.has(nearTrash.id))) {
                    this.showVisitorBubble(v, 'gross');
                    if (!v._grossedTrash) v._grossedTrash = new Set();
                    v._grossedTrash.add(nearTrash.id);
                }
                continue;
            }

            if (v._path && v._pathIdx < v._path.length) {
                v._pathIdx++;
                continue;
            }

            if (v.phase === 'entering') {
                this.visitorAdmission(v);
                if (v.wantsTour) {
                    const guide = this._findAvailableGuide();
                    if (guide) {
                        v.phase = 'seekingGuide';
                        v._targetGuideId = guide.id;
                        v.tx = guide.homeX;
                        v.ty = guide.homeY;
                        this._setVisitorPath(v);
                    } else {
                        v.phase = 'seeking';
                        this._visitorSeekHabitat(v);
                    }
                } else {
                    v.phase = 'seeking';
                    this._visitorSeekHabitat(v);
                }
            } else if (v.phase === 'seekingTrashcan') {
                v.phase = 'usingTrashcan';
                v._useTrashcanTimer = 0;
            } else if (v.phase === 'usingTrashcan') {
                v._useTrashcanTimer = (v._useTrashcanTimer || 0) + sDelta;
                if (v._useTrashcanTimer >= 600) {
                    this._visitorUseTrashcan(v);
                    v.phase = 'leaving';
                    v.tx = Phaser.Math.Between(13, 16) * TILE + TILE / 2;
                    v.ty = MAP_Y + (ROWS - 1) * TILE;
                    this._setVisitorPath(v);
                }
                continue;
            } else if (v.phase === 'seekingGiftShop') {
                v.phase = 'atGiftShop';
                v.giftShopTimer = 0;
                v.giftShopDuration = Phaser.Math.Between(2000, 4000);
                v.sprite.setVisible(false);
                if (v._bubble) { v._bubble.destroy(); v._bubble = null; }
            } else if (v.phase === 'seekingBathroom') {
                v.phase = 'atBathroom';
                v.bathroomTimer = 0;
                v.bathroomDuration = Phaser.Math.Between(1000, 2500);
                v.sprite.setVisible(false);
                if (v._bubble) { v._bubble.destroy(); v._bubble = null; }
            } else if (v.phase === 'atBathroom') {
                v.bathroomTimer = (v.bathroomTimer || 0) + sDelta;
                if (v.bathroomTimer >= v.bathroomDuration) {
                    const bathroom = this.state.facilities.find(f => f.id === v.targetFac);
                    const wasDirty = bathroom && (bathroom.dirty || 0) > 0.5;
                    if (bathroom) {
                        bathroom.dirty = Math.min(1, (bathroom.dirty || 0) + 0.15);
                        if ((bathroom.dirty || 0) > 0.1) this._updateBathroomDirtyVisual(bathroom);
                        if (wasDirty) {
                            this.showVisitorBubble(v, 'nauseous');
                            this.state.rep = Math.max(0, this.state.rep - 2);
                        } else {
                            v.satisfaction = Math.min(5, (v.satisfaction || 0) + 1);
                            this.state.rep = Math.min(100, this.state.rep + 1);
                        }
                    }
                    v.sprite.setVisible(true);
                    this._visitorLeaveWithTrash(v);
                }
            } else if (v.phase === 'atGiftShop') {
                v.giftShopTimer = (v.giftShopTimer || 0) + sDelta;
                if (v.giftShopTimer >= v.giftShopDuration) {
                    if (Math.random() < 0.6) {
                        const vType = VISITOR_TYPES[v.visitorType] || VISITOR_TYPES.family;
                        let spend = Phaser.Math.Between(8, 25);
                        spend = Math.round(spend * (vType.incomeMult || 1));
                        if (v.satisfaction > 0) spend = Math.round(spend * (1 + v.satisfaction * 0.1));
                        spend = Math.max(5, spend);
                        this.addCoins(spend);
                        const txt = this.add.text(v.sprite.x, v.sprite.y - 10, `+${spend}`, {
                            fontFamily: '"Press Start 2P", monospace', fontSize: '8px', color: '#88DDAA',
                            stroke: '#000', strokeThickness: 2
                        }).setOrigin(0.5).setDepth(55);
                        this.tweens.add({ targets: txt, y: txt.y - 20, alpha: 0, duration: 800, onComplete: () => txt.destroy() });
                    }
                    v.sprite.setVisible(true);
                    this._visitorLeaveWithTrash(v);
                }
            } else if (v.phase === 'noBathroom') {
                const sub = v._noBathroomWanderPhase || 'waiting';
                if (sub === 'walking') {
                    v._noBathroomWanderPhase = 'waiting';
                    v._noBathroomTimer = 0;
                } else if (sub === 'waiting') {
                    v._noBathroomTimer = (v._noBathroomTimer || 0) + sDelta;
                    if (v._noBathroomTimer >= 2500) {
                        this.showVisitorBubble(v, 'poopWorried');
                        this.state.rep = Math.max(0, this.state.rep - 2);
                        v._noBathroomWanderPhase = 'shown';
                        v._noBathroomTimer = 0;
                    }
                } else {
                    v._noBathroomTimer = (v._noBathroomTimer || 0) + sDelta;
                    if (v._noBathroomTimer >= 2000) {
                        this._visitorLeaveWithTrash(v);
                    }
                }
            } else if (v.phase === 'seekingGuide') {
                const guide = this.state.staff.find(s => s.id === v._targetGuideId);
                if (!guide || (guide.phase !== 'idle' && guide.phase !== 'waiting')) {
                    v.phase = 'seeking';
                    v._targetGuideId = null;
                    this._visitorSeekHabitat(v);
                }
            } else if (v.phase === 'seeking') {
                v.phase = 'viewing';
                v.viewTimer = 0;
                const hab = this.state.habitats.find(h => h.id === v.targetHab);
                const habEmpty = hab && this.state.animals.filter(a => a.habitatId === v.targetHab).length === 0;
                v.viewDuration = habEmpty ? Phaser.Math.Between(500, 1000) : Phaser.Math.Between(2000, 5000);
                if (hab) v.sprite.setFlipX(v.sprite.x > (hab.gx + hab.w / 2) * TILE);
            } else if (v.phase === 'viewing') {
                v.viewTimer += sDelta;
                if (v.viewTimer >= v.viewDuration) {
                    this._visitorReact(v);
                    v.visitedHabs.add(v.targetHab);
                    v.habsToVisit--;
                    if (v.habsToVisit <= 0 || v.timer >= v.maxTime) {
                        const shop = v.wantsGiftShop ? this.pickGiftShop() : null;
                        const bathroom = v.wantsBathroom ? this.pickBathroom() : null;
                        if (shop) {
                            this._visitorSeekGiftShop(v, shop);
                        } else if (bathroom) {
                            this._visitorSeekBathroom(v, bathroom);
                        } else if (v.wantsBathroom) {
                            this._visitorSeekNoBathroom(v);
                        } else {
                            this._visitorLeaveWithTrash(v);
                        }
                    } else {
                        v.phase = 'seeking';
                        this._visitorSeekHabitat(v);
                    }
                }
            } else if (v.phase === 'leaving') {
                if (v._grassPath && v._grassPath.length > 0) {
                    v._path = v._grassPath;
                    v._pathIdx = 0;
                    v._grassPath = null;
                    v._needsConfused = false;
                    continue;
                }
                this.visitorDonation(v);
                if (v._bubble) { v._bubble.destroy(); v._bubble = null; }
                v.sprite.destroy();
                this.visitors.splice(i, 1);
            }
        }
    }

    _visitorSeekHabitat(v) {
        const hab = this.pickNextHabitat(v);
        if (!hab) {
            this._visitorLeaveWithTrash(v);
            return;
        }
        v.targetHab = hab.id;
        const spot = this.findViewingSpot(hab, v) || this.randomOpenTile();
        v.tx = spot.x; v.ty = spot.y;
        this._setVisitorPath(v);
    }

    _visitorSeekGiftShop(v, shop) {
        v.targetFac = shop.id;
        const spot = this.findGiftShopEntranceSpot(shop) || this.findFacilitySpot(shop, v) || this.randomOpenTile();
        v.tx = spot.x; v.ty = spot.y;
        v._giftShopSpot = spot;
        v._giftShopFac = shop;
        v.phase = 'seekingGiftShop';
        this._setVisitorPath(v);
    }

    _visitorSeekBathroom(v, bathroom) {
        v.targetFac = bathroom.id;
        const spot = this.findFacilitySpot(bathroom, v) || this.randomOpenTile();
        v.tx = spot.x; v.ty = spot.y;
        v._giftShopSpot = spot;
        v._giftShopFac = bathroom;
        v.phase = 'seekingBathroom';
        this._setVisitorPath(v);
    }

    _visitorSeekNoBathroom(v) {
        v.phase = 'noBathroom';
        v._noBathroomWanderPhase = 'walking';
        v._noBathroomTimer = 0;
        const spot = this.randomOpenTile();
        v.tx = spot.x;
        v.ty = spot.y;
        this._setVisitorPath(v);
    }

    findGiftShopEntranceSpot(fac) {
        const ft = FACILITIES[fac.type];
        const w = fac.w ?? ft.w;
        const entGx = fac.gx + Math.floor(w / 2);
        const entGy = fac.gy - 1;
        if (entGy < 0 || entGy >= ROWS || entGx < 0 || entGx >= COLS) return null;
        const cell = this.grid[entGy]?.[entGx];
        if (cell !== null && cell !== 'entrance' && !(cell && cell.startsWith('dec_path'))) return null;
        return {
            x: entGx * TILE + TILE / 2,
            y: MAP_Y + entGy * TILE + TILE / 2,
        };
    }

    dropTrashMaybe(v) {
        if (!v.sprite || !v.sprite.active) return;
        if (Math.random() >= TRASH_DROP_CHANCE) return;
        const id = genId('trash');
        const sprite = this.add.image(v.sprite.x, v.sprite.y, 'particle_trash').setDepth(25).setScale(1.6);
        this.trash.push({ id, x: v.sprite.x, y: v.sprite.y, sprite });
    }

    _pickTrashcanForVisitor(v) {
        const trashcans = this.state.decorations.filter(d => d.id === 'trashcan');
        if (trashcans.length === 0) return null;
        const walkFn = (gx, gy) => this._isWalkable(gx, gy);
        let best = null;
        let bestLen = Infinity;
        for (const tc of trashcans) {
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const ax = tc.gx + dx, ay = tc.gy + dy;
                if (!walkFn(ax, ay)) continue;
                const spotX = ax * TILE + TILE / 2, spotY = MAP_Y + ay * TILE + TILE / 2;
                const path = this._findPath(v.sprite.x, v.sprite.y, spotX, spotY, walkFn);
                if (path && path.length < bestLen) {
                    bestLen = path.length;
                    best = { trashcan: tc, spot: { x: spotX, y: spotY } };
                }
            }
        }
        return best;
    }

    _visitorTryUseTrashcan(v) {
        if (!v.sprite || !v.sprite.active) return false;
        if (Math.random() >= TRASH_DROP_CHANCE) return false;
        const result = this._pickTrashcanForVisitor(v);
        if (!result) return false;
        v._targetTrashcan = result.trashcan;
        v.tx = result.spot.x;
        v.ty = result.spot.y;
        this._setVisitorPath(v);
        return true;
    }

    _visitorUseTrashcan(v) {
        const tc = v._targetTrashcan;
        if (!tc) return;
        const key = `${tc.gx},${tc.gy}`;
        this.state.trashcanFullness[key] = (this.state.trashcanFullness[key] || 0) + 10;
        this._refreshTrashcanSprite(tc.gx, tc.gy);
    }

    _refreshTrashcanSprite(gx, gy) {
        const key = `${gx},${gy}`;
        const fullness = this.state.trashcanFullness?.[key] || 0;
        const tex = fullness > 0 ? 'decor_trashcan_full' : 'decor_trashcan';
        const entry = this.decorSprites.find(d => d.id === 'trashcan' && d.gx === gx && d.gy === gy);
        if (entry?.sprite?.active) entry.sprite.setTexture(tex);
    }

    _visitorLeaveWithTrash(v) {
        if (this._visitorTryUseTrashcan(v)) {
            v.phase = 'seekingTrashcan';
        } else {
            this.dropTrashMaybe(v);
            v.phase = 'leaving';
            v.tx = Phaser.Math.Between(13, 16) * TILE + TILE / 2;
            v.ty = MAP_Y + (ROWS - 1) * TILE;
            this._setVisitorPath(v);
        }
    }

    pickUpTrash(id, silent = false) {
        const idx = this.trash.findIndex(t => t.id === id);
        if (idx === -1) return;
        const t = this.trash[idx];
        if (t.sprite) t.sprite.destroy();
        this.trash.splice(idx, 1);
        if (!silent) this.sfx.click();
    }

    getTrashAt(wx, wy) {
        for (const t of this.trash) {
            const dx = wx - t.x, dy = wy - t.y;
            if (dx * dx + dy * dy < TRASH_PICKUP_RADIUS * TRASH_PICKUP_RADIUS) return t;
        }
        return null;
    }

    getTrashNear(x, y) {
        for (const t of this.trash) {
            const dx = x - t.x, dy = y - t.y;
            if (dx * dx + dy * dy < TRASH_GROSS_RADIUS * TRASH_GROSS_RADIUS) return t;
        }
        return null;
    }

    _visitorReact(v) {
        const hab = this.state.habitats.find(h => h.id === v.targetHab);
        if (!hab) return;
        const habAnimals = this.state.animals.filter(a => a.habitatId === hab.id);
        if (habAnimals.length === 0) {
            this.showVisitorBubble(v, 'ellipsis');
            return;
        }
        const mistreated = habAnimals.some(a => a.hunger < 20 || a.happiness < 20 || a.health < 40 || a.illness);
        const repBonus = v._npcDef ? v._npcDef.repBonus : 0;
        if (mistreated) {
            this.showVisitorBubble(v, 'worried');
            this.state.rep = Math.max(0, this.state.rep - 1);
            v.satisfaction--;
        } else {
            this.showVisitorBubble(v, 'heart');
            this.state.rep += 1 + repBonus;
            v.satisfaction++;
        }
    }

    visitorAdmission(v) {
        const vType = VISITOR_TYPES[v.visitorType] || VISITOR_TYPES.family;
        let fee = 5;
        if (this.state.upgrades.has('sanctuary_sign')) fee = Math.round(fee * 1.2);
        if (this.hasResearch('income_50')) fee = Math.round(fee * 1.5);
        const incomeMult = v._npcDef ? v._npcDef.incomeMult : vType.incomeMult;
        fee = Math.round(fee * incomeMult);
        fee = Math.max(1, fee);
        this.addCoins(fee);
    }

    visitorDonation(v) {
        const vType = VISITOR_TYPES[v.visitorType] || VISITOR_TYPES.family;
        let donation = 0;

        const avgHappy = this.state.animals.length > 0
            ? this.state.animals.reduce((s, a) => s + a.happiness, 0) / this.state.animals.length : 50;
        donation += avgHappy * 0.06;
        donation += this.state.animals.length * 0.8;
        for (const hab of this.state.habitats) {
            donation += this.getEnrichmentHappyBonus(hab) * 0.3;
        }
        donation += v.satisfaction * 2;

        let typeMult = vType.incomeMult;
        if (vType.id === 'school' && this.hasResearch('school_boost')) typeMult *= 2;
        donation *= typeMult;
        const seasonBonus = SEASONS[this.state.season].bonuses;
        if (seasonBonus.income) donation *= seasonBonus.income;
        if (v._guidedTour) donation *= 1.5;

        donation = Math.round(Math.max(0, donation));
        if (donation > 0) {
            this.addCoins(donation);
            const txt = this.add.text(v.sprite.x, v.sprite.y - 10, `+${donation}`, {
                fontFamily: '"Press Start 2P", monospace', fontSize: '8px', color: '#88DDAA',
                stroke: '#000', strokeThickness: 2
            }).setOrigin(0.5).setDepth(55);
            this.tweens.add({ targets: txt, y: txt.y - 20, alpha: 0, duration: 800, onComplete: () => txt.destroy() });
        }
        this.state.stats.visitors++;
    }

    showVisitorBubble(v, type) {
        if (v._bubble) { v._bubble.destroy(); v._bubble = null; }

        const ct = this.add.container(v.sprite.x, v.sprite.y - 22).setDepth(56);
        const bubble = this.add.graphics();
        bubble.fillStyle(0xFFFFFF, 0.9);
        const bw = (type === 'toiletConfused' || type === 'poopWorried') ? 28 : 20;
        bubble.fillRoundedRect(-bw / 2, -10, bw, 18, 4);
        bubble.fillTriangle(-3, 8, 3, 8, 0, 13);
        ct.add(bubble);

        let icon;
        if (type === 'heart') {
            icon = this.add.image(0, -1, 'particle_heart').setScale(0.8);
        } else if (type === 'worried') {
            icon = this.add.image(0, -1, 'icon_worried').setScale(0.9);
        } else if (type === 'confused') {
            icon = this.add.image(0, -1, 'icon_confused').setScale(0.9);
        } else if (type === 'nauseous') {
            icon = this.add.image(0, -1, 'icon_nauseous').setScale(0.9);
        } else if (type === 'toilet') {
            icon = this.add.image(0, -1, 'icon_toilet').setScale(0.9);
        } else if (type === 'gross') {
            icon = this.add.image(0, -1, 'icon_gross').setScale(0.9);
        } else if (type === 'toiletConfused') {
            icon = this.add.container(0, -1);
            icon.add(this.add.image(-6, 0, 'icon_toilet').setScale(0.8));
            icon.add(this.add.image(6, 0, 'icon_confused').setScale(0.8));
        } else if (type === 'poopWorried') {
            icon = this.add.container(0, -1);
            icon.add(this.add.image(-6, 0, 'icon_poop').setScale(1));
            icon.add(this.add.image(6, 0, 'icon_worried').setScale(0.8));
        } else {
            icon = this.add.graphics();
            icon.fillStyle(0x888888);
            icon.fillCircle(-4, -1, 1.5);
            icon.fillCircle(0, -1, 1.5);
            icon.fillCircle(4, -1, 1.5);
        }
        ct.add(icon);

        v._bubble = ct;
        this.tweens.add({
            targets: ct, alpha: 0, duration: 600, delay: 1200,
            ease: 'Quad.easeIn', onComplete: () => { ct.destroy(); if (v._bubble === ct) v._bubble = null; }
        });
    }

    /* ========== STAFF ========== */
    // Phase-based goal-driven AI with A* pathfinding. Work effects are localized (per-habitat).
    // Volunteer/vet use _isStaffWalkable (can walk through habitats). Guide/gardener use
    // _isGuideWalkable (paths, grass, entrance only — no walking through habitats/facilities).
    // Volunteer/vet: idle → walking → working (inside habitat, heart animation) → idle.
    // Gardener: idle → walking (to adjacent tile of garden) → working (harvests one crop every
    //   1.2s until all picked) → idle. When no crops are ready, wanders around a garden:
    //   idle → wandering (walks to adjacent tile) → wanderPause (waits 2-5s, checks for
    //   ready crops) → wandering/idle. Targets gardens with ready crops first.
    // Tour guide: hired via placement mode (player clicks a walkable tile to set the guide's post).
    // homeX/homeY store the post position. idle (wait at post) → grabs seekingGuide visitors one
    // at a time (_guideGrabOne) → waiting (accumulates group, starts tour when 4 gathered, or
    // 2+ after 10s, or any after 18s) → leading (direct route to habitat) → showing (followers
    // spread to individual viewing spots, react) → leading → ... → returning (lead group back
    // to post, release followers as seeking with +50% donation bonus). Followers trail behind
    // the guide based on movement direction (perpendicular lateral spread).

    _initStaffState(s) {
        s.phase = 'idle';
        s.idleTimer = 0;
        s.workTimer = 0;
        s.targetHab = null;
        s.tx = s.sprite.x;
        s.ty = s.sprite.y;
        s._path = [];
        s._pathIdx = 0;
        s.visitedHabs = new Set();
        s._targetFac = null;
        s.followers = [];
        s.habsToShow = 0;
        if (s.type === 'guide' && s.homeX == null) {
            s.homeX = s.sprite.x;
            s.homeY = s.sprite.y;
        }
    }

    _setStaffPath(s) {
        const walkFn = (s.type === 'guide' || s.type === 'gardener' || s.type === 'janitor')
            ? (gx, gy) => this._isGuideWalkable(gx, gy)
            : (gx, gy) => this._isStaffWalkable(gx, gy);
        const path = this._findPath(s.sprite.x, s.sprite.y, s.tx, s.ty, walkFn);
        if (path === null) {
            s._path = [];
            s._pathIdx = 0;
            s._noPath = true;
            return;
        }
        s._path = path;
        s._pathIdx = 0;
        s._noPath = false;
    }

    _recalcStaffPaths() {
        for (const s of this.state.staff) {
            if (s.phase === 'working' || s.phase === 'showing' || s.phase === 'idle' || s.phase === 'waiting' || s.phase === 'wanderPause') continue;
            this._setStaffPath(s);
        }
    }

    _pickStaffTarget(s) {
        if (this.state.habitats.length === 0) return null;
        if (s.type === 'volunteer') {
            return Phaser.Utils.Array.GetRandom(this.state.habitats);
        }
        if (s.type === 'vet') {
            const sick = this.state.habitats.filter(h =>
                this.state.animals.some(a => a.habitatId === h.id && (a.illness || a.health < 60))
            );
            if (sick.length > 0) return Phaser.Utils.Array.GetRandom(sick);
            let best = null, worstHealth = Infinity;
            for (const hab of this.state.habitats) {
                const animals = this.state.animals.filter(a => a.habitatId === hab.id);
                if (animals.length === 0) continue;
                const avgHealth = animals.reduce((sum, a) => sum + a.health, 0) / animals.length;
                if (avgHealth < worstHealth) { worstHealth = avgHealth; best = hab; }
            }
            return best || Phaser.Utils.Array.GetRandom(this.state.habitats);
        }
        return null;
    }

    _randomPointInHabitat(hab) {
        const px = (hab.gx + 0.5 + Math.random() * (hab.w - 1)) * TILE;
        const py = MAP_Y + (hab.gy + 0.5 + Math.random() * (hab.h - 1)) * TILE;
        return { x: px, y: py };
    }

    _staffDoWork(s) {
        const hab = this.state.habitats.find(h => h.id === s.targetHab);
        if (!hab) return;
        const animals = this.state.animals.filter(a => a.habitatId === hab.id);
        if (animals.length === 0) return;

        if (s.type === 'volunteer') {
            animals.forEach(a => {
                const cost = SPECIES[a.speciesId]?.foodCost || 5;
                if (this.state.food >= cost) {
                    this.state.food -= cost;
                    a.hunger = Math.min(100, a.hunger + 12);
                }
                a.happiness = Math.min(100, a.happiness + 8);
            });
            this.game.events.emit('foodUpdate', this.state.food);
        } else if (s.type === 'vet') {
            const vetChance = this.hasResearch('super_vet') ? 1.0 : 0.3;
            animals.forEach(a => {
                a.health = Math.min(100, a.health + 5);
                if (a.health < 50) a.health = Math.min(100, a.health + 10);
                if (a.illness && Math.random() < vetChance) {
                    a.illness = null;
                    a.health = Math.min(100, a.health + 15);
                    this.game.events.emit('notification', `Vet cured ${a.name}!`);
                }
            });
        }

        const target = Phaser.Utils.Array.GetRandom(animals);
        this.heartEffect(target.sprite.x, target.sprite.y);
    }

    _findAvailableGuide() {
        return this.state.staff.find(s => s.type === 'guide' && (s.phase === 'idle' || s.phase === 'waiting'));
    }

    _guideIsNearHome(s) {
        const dx = Math.abs(s.sprite.x - s.homeX);
        const dy = Math.abs(s.sprite.y - s.homeY);
        return dx < TILE * 2 && dy < TILE * 2;
    }

    _guideHomePos(s) {
        return { x: s.homeX, y: s.homeY };
    }

    _guideGrabOne(s) {
        if (s.followers.length >= 4) return false;
        const range = TILE * 3;
        let best = null, bestDist = Infinity;
        for (const v of this.visitors) {
            if (v.guidedBy) continue;
            if (v.phase !== 'seekingGuide') continue;
            const d = Math.abs(v.sprite.x - s.sprite.x) + Math.abs(v.sprite.y - s.sprite.y);
            if (d < range && d < bestDist) { bestDist = d; best = v; }
        }
        if (!best) return false;
        best.guidedBy = s.id;
        best._guidedTour = true;
        best._grassPath = null;
        best._needsConfused = false;
        best.phase = 'guided';
        s.followers.push(best);
        return true;
    }

    _guideReleaseAtHome(s) {
        for (const v of s.followers) {
            if (!v.sprite || !v.sprite.active) continue;
            v.guidedBy = null;
            v._showingSpot = null;
            v._guidedTour = true;
            const shop = v.wantsGiftShop ? this.pickGiftShop() : null;
            const bathroom = v.wantsBathroom ? this.pickBathroom() : null;
            if (shop) {
                this._visitorSeekGiftShop(v, shop);
            } else if (bathroom) {
                this._visitorSeekBathroom(v, bathroom);
            } else if (v.wantsBathroom) {
                this._visitorSeekNoBathroom(v);
            } else {
                this._visitorLeaveWithTrash(v);
            }
        }
        s.followers = [];
    }

    _guideReleaseFollowers(s) {
        for (const v of s.followers) {
            if (!v.sprite || !v.sprite.active) continue;
            v.guidedBy = null;
            v._showingSpot = null;
            const shop = v.wantsGiftShop ? this.pickGiftShop() : null;
            const bathroom = v.wantsBathroom ? this.pickBathroom() : null;
            if (shop) {
                this._visitorSeekGiftShop(v, shop);
            } else if (bathroom) {
                this._visitorSeekBathroom(v, bathroom);
            } else if (v.wantsBathroom) {
                this._visitorSeekNoBathroom(v);
            } else {
                this._visitorLeaveWithTrash(v);
            }
        }
        s.followers = [];
    }

    hireStaff(typeId) {
        const st = STAFF_TYPES[typeId];
        if (st.maxCount) {
            const count = this.state.staff.filter(s => s.type === typeId).length;
            if (count >= st.maxCount) {
                this.game.events.emit('notification', `Already at max ${st.name}s!`);
                this.sfx.error(); return false;
            }
        }
        if (this.state.coins < st.hireCost) {
            this.game.events.emit('notification', 'Not enough coins!');
            this.sfx.error(); return false;
        }
        if (typeId === 'guide') {
            this.enterGuidePlacement();
            return true;
        }
        this.spendCoins(st.hireCost);
        const sprite = this.add.image(15 * TILE, MAP_Y + (ROWS - 2) * TILE, `staff_${typeId}`).setDepth(32).setAlpha(0.9);
        const s = {
            id: genId('staff'), type: typeId, sprite,
            tx: 15 * TILE, ty: MAP_Y + (ROWS - 2) * TILE, wTimer: 0
        };
        this._initStaffState(s);
        this.state.staff.push(s);
        this.sfx.build();
        this.game.events.emit('notification', `${st.name} hired!`);
        this.game.events.emit('staffUpdate', this.state.staff);
        return true;
    }

    enterGuidePlacement() {
        const hud = this.scene.get('HUDScene');
        if (hud && hud.hasOpenPanel()) hud.closeAllPanels(true);
        if (this.state.viewingHabitat || this.state.viewingFacility || this.cameras.main.zoom > 1) this.zoomOut();
        this.state.buildMode = '_place_guide';
        this._guidePreview = this.add.image(0, 0, 'staff_guide').setDepth(56).setAlpha(0.7).setVisible(false);
        this._hideNPCs();
        this.game.events.emit('buildModeChanged', this.state.buildMode);
    }

    _canPlaceGuide(gx, gy) {
        if (gx < 1 || gy < 1 || gx >= COLS - 1 || gy >= ROWS - 1) return false;
        return this._isGuideWalkable(gx, gy);
    }

    _finishGuidePlacement(gx, gy) {
        const st = STAFF_TYPES.guide;
        this.spendCoins(st.hireCost);
        const px = gx * TILE + TILE / 2, py = MAP_Y + gy * TILE + TILE / 2;
        this._showFloatingCost(px, py, st.hireCost);
        const postSprite = this.add.image(px, py, 'guide_post').setDepth(12);
        const sprite = this.add.image(px, py, 'staff_guide').setDepth(32).setAlpha(0.9);
        const s = {
            id: genId('staff'), type: 'guide', sprite,
            tx: px, ty: py, wTimer: 0
        };
        s.postSprite = postSprite;
        this._initStaffState(s);
        s.homeX = px;
        s.homeY = py;
        this.state.staff.push(s);
        this.sfx.build();
        this.game.events.emit('notification', `${st.name} hired!`);
        this.game.events.emit('staffUpdate', this.state.staff);
        this.exitBuild();
    }

    fireStaff(staffId) {
        const idx = this.state.staff.findIndex(s => s.id === staffId);
        if (idx === -1) return;
        const s = this.state.staff[idx];
        if (s.type === 'guide') this._guideReleaseFollowers(s);
        if (s.postSprite) { s.postSprite.destroy(); s.postSprite = null; }
        s.sprite.destroy();
        this.state.staff.splice(idx, 1);
        this.game.events.emit('staffUpdate', this.state.staff);
        this.game.events.emit('notification', 'Staff member let go.');
    }

    updateStaff(delta) {
        const sDelta = delta * this.timeSpeedMult;
        for (const s of this.state.staff) {
            if (!s.phase) this._initStaffState(s);

            if (s.type === 'guide') {
                this._updateGuide(s, sDelta);
            } else if (s.type === 'gardener') {
                this._updateGardener(s, sDelta);
            } else if (s.type === 'janitor') {
                this._updateJanitor(s, sDelta);
            } else {
                this._updateWorker(s, sDelta);
            }
        }
    }

    _staffMoveAlongPath(s, sDelta) {
        if (s._noPath) { s._noPath = false; return true; }
        let wpx, wpy;
        if (s._path && s._pathIdx < s._path.length) {
            wpx = s._path[s._pathIdx].x;
            wpy = s._path[s._pathIdx].y;
        } else {
            wpx = s.tx; wpy = s.ty;
        }
        const dx = wpx - s.sprite.x, dy = wpy - s.sprite.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 3) {
            const speed = s.type === 'guide' ? 36 : 32;
            const spd = speed * sDelta / 1000;
            s.sprite.x += (dx / dist) * spd;
            s.sprite.y += (dy / dist) * spd;
            if (Math.abs(dx) > 1) s.sprite.setFlipX(dx < 0);
            return false;
        }
        if (s._path && s._pathIdx < s._path.length) {
            s._pathIdx++;
            return false;
        }
        return true;
    }

    _updateWorker(s, sDelta) {
        if (s.phase === 'idle') {
            s.idleTimer += sDelta;
            const idleWait = s.type === 'volunteer' ? 4000 : 2500;
            if (s.idleTimer >= idleWait) {
                s.idleTimer = 0;
                const hab = this._pickStaffTarget(s);
                if (hab) {
                    s.targetHab = hab.id;
                    const pt = this._randomPointInHabitat(hab);
                    s.tx = pt.x; s.ty = pt.y;
                    s.phase = 'walking';
                    this._setStaffPath(s);
                }
            }
        } else if (s.phase === 'walking') {
            const arrived = this._staffMoveAlongPath(s, sDelta);
            if (arrived) {
                s.phase = 'working';
                s.workTimer = 0;
            }
        } else if (s.phase === 'working') {
            s.workTimer += sDelta;
            if (s.workTimer >= 2500) {
                this._staffDoWork(s);
                s.phase = 'idle';
                s.workTimer = 0;
                s.targetHab = null;
            }
        }
    }

    _findGardenWithReadyCrops() {
        for (const fac of this.state.facilities) {
            if (fac.type !== 'garden' || !fac.produce) continue;
            if (fac.produce.some(slot => !slot.picked)) return fac;
        }
        return null;
    }

    _gardenAdjacentTile(fac) {
        const ft = FACILITIES[fac.type];
        const w = fac.w ?? ft.w, h = fac.h ?? ft.h;
        const candidates = [];
        for (let dx = 0; dx < w; dx++) {
            candidates.push({ gx: fac.gx + dx, gy: fac.gy - 1 });
            candidates.push({ gx: fac.gx + dx, gy: fac.gy + h });
        }
        for (let dy = 0; dy < h; dy++) {
            candidates.push({ gx: fac.gx - 1, gy: fac.gy + dy });
            candidates.push({ gx: fac.gx + w, gy: fac.gy + dy });
        }
        const walkable = candidates.filter(c => this._isGuideWalkable(c.gx, c.gy));
        if (walkable.length === 0) return null;
        return Phaser.Utils.Array.GetRandom(walkable);
    }

    _findAnyGarden() {
        const gardens = this.state.facilities.filter(f => f.type === 'garden');
        return gardens.length > 0 ? Phaser.Utils.Array.GetRandom(gardens) : null;
    }

    _findDirtyBathroom() {
        const dirty = this.state.facilities.filter(f => f.type === 'bathroom' && (f.dirty || 0) > 0.1);
        if (dirty.length === 0) return null;
        return Phaser.Utils.Array.GetRandom(dirty);
    }

    _findAnyBathroom() {
        const bathrooms = this.state.facilities.filter(f => f.type === 'bathroom');
        return bathrooms.length > 0 ? Phaser.Utils.Array.GetRandom(bathrooms) : null;
    }

    _bathroomAdjacentTile(fac) {
        const ft = FACILITIES[fac.type];
        const w = fac.w ?? ft.w, h = fac.h ?? ft.h;
        const candidates = [];
        for (let dx = 0; dx < w; dx++) {
            candidates.push({ gx: fac.gx + dx, gy: fac.gy - 1 });
            candidates.push({ gx: fac.gx + dx, gy: fac.gy + h });
        }
        for (let dy = 0; dy < h; dy++) {
            candidates.push({ gx: fac.gx - 1, gy: fac.gy + dy });
            candidates.push({ gx: fac.gx + w, gy: fac.gy + dy });
        }
        const walkable = candidates.filter(c => this._isGuideWalkable(c.gx, c.gy));
        if (walkable.length === 0) return null;
        return Phaser.Utils.Array.GetRandom(walkable);
    }

    _findNearestTrashForJanitor(s) {
        if (this.trash.length === 0) return null;
        const walkFn = (gx, gy) => this._isStaffWalkable(gx, gy);
        let best = null;
        let bestLen = Infinity;
        for (const t of this.trash) {
            const path = this._findPath(s.sprite.x, s.sprite.y, t.x, t.y, walkFn);
            if (path && path.length < bestLen) {
                bestLen = path.length;
                best = { trash: t, tx: t.x, ty: t.y };
            }
        }
        return best;
    }

    _findTrashcanToEmpty(s) {
        const walkFn = (gx, gy) => this._isStaffWalkable(gx, gy);
        let best = null;
        let bestLen = Infinity;
        for (const tc of this.state.decorations) {
            if (tc.id !== 'trashcan') continue;
            const key = `${tc.gx},${tc.gy}`;
            const fullness = this.state.trashcanFullness?.[key] || 0;
            if (fullness <= 0) continue;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const ax = tc.gx + dx, ay = tc.gy + dy;
                if (!walkFn(ax, ay)) continue;
                const spotX = ax * TILE + TILE / 2, spotY = MAP_Y + ay * TILE + TILE / 2;
                const path = this._findPath(s.sprite.x, s.sprite.y, spotX, spotY, walkFn);
                if (path && path.length < bestLen) {
                    bestLen = path.length;
                    best = { trashcan: tc, tile: { gx: ax, gy: ay }, tx: spotX, ty: spotY };
                }
            }
        }
        return best;
    }

    _updateJanitor(s, sDelta) {
        if (s.phase === 'idle') {
            s.idleTimer += sDelta;
            if (s.idleTimer >= 3000) {
                s.idleTimer = 0;
                const bathroom = this._findDirtyBathroom();
                if (bathroom) {
                    s._targetFac = bathroom.id;
                    const tile = this._bathroomAdjacentTile(bathroom);
                    if (tile) {
                        s.tx = tile.gx * TILE + TILE / 2;
                        s.ty = MAP_Y + tile.gy * TILE + TILE / 2;
                        s.phase = 'walking';
                        this._setStaffPath(s);
                    }
                } else {
                    const trashTarget = this._findNearestTrashForJanitor(s);
                    if (trashTarget) {
                        s._targetTrashId = trashTarget.trash.id;
                        s.tx = trashTarget.tx;
                        s.ty = trashTarget.ty;
                        s.phase = 'pickingTrash';
                        this._setStaffPath(s);
                    } else {
                        const tcTarget = this._findTrashcanToEmpty(s);
                        if (tcTarget) {
                            s._targetTrashcan = tcTarget.trashcan;
                            s.tx = tcTarget.tx;
                            s.ty = tcTarget.ty;
                            s.phase = 'emptyingTrashcan';
                            this._setStaffPath(s);
                        } else {
                            const bathroom2 = this._findAnyBathroom();
                            if (bathroom2) {
                                s._targetFac = bathroom2.id;
                                const tile = this._bathroomAdjacentTile(bathroom2);
                                if (tile) {
                                    s.tx = tile.gx * TILE + TILE / 2;
                                    s.ty = MAP_Y + tile.gy * TILE + TILE / 2;
                                    s.phase = 'wandering';
                                    this._setStaffPath(s);
                                }
                            }
                        }
                    }
                }
            }
        } else if (s.phase === 'pickingTrash') {
            const arrived = this._staffMoveAlongPath(s, sDelta);
            if (arrived) {
                this.pickUpTrash(s._targetTrashId, true);
                this.heartEffect(s.sprite.x, s.sprite.y);
                s.phase = 'idle';
                s.idleTimer = 0;
                s._targetTrashId = null;
            }
        } else if (s.phase === 'emptyingTrashcan') {
            const arrived = this._staffMoveAlongPath(s, sDelta);
            if (arrived) {
                s.phase = 'working';
                s.workTimer = 0;
            }
        } else if (s.phase === 'wandering') {
            const arrived = this._staffMoveAlongPath(s, sDelta);
            if (arrived) {
                s._wanderTimer = 0;
                s._wanderWait = 2000 + Math.random() * 3000;
                s.phase = 'wanderPause';
            }
        } else if (s.phase === 'wanderPause') {
            s._wanderTimer += sDelta;
            if (s._wanderTimer >= s._wanderWait) {
                const bathroom = this._findDirtyBathroom();
                if (bathroom) {
                    s._targetFac = bathroom.id;
                    const tile = this._bathroomAdjacentTile(bathroom);
                    if (tile) {
                        s.tx = tile.gx * TILE + TILE / 2;
                        s.ty = MAP_Y + tile.gy * TILE + TILE / 2;
                        s.phase = 'walking';
                        this._setStaffPath(s);
                        return;
                    }
                }
                const trashTarget = this._findNearestTrashForJanitor(s);
                if (trashTarget) {
                    s._targetTrashId = trashTarget.trash.id;
                    s.tx = trashTarget.tx;
                    s.ty = trashTarget.ty;
                    s.phase = 'pickingTrash';
                    this._setStaffPath(s);
                    return;
                }
                const tcTarget = this._findTrashcanToEmpty(s);
                if (tcTarget) {
                    s._targetTrashcan = tcTarget.trashcan;
                    s.tx = tcTarget.tx;
                    s.ty = tcTarget.ty;
                    s.phase = 'emptyingTrashcan';
                    this._setStaffPath(s);
                    return;
                }
                const fac = this.state.facilities.find(f => f.id === s._targetFac);
                if (fac) {
                    const tile = this._bathroomAdjacentTile(fac);
                    if (tile) {
                        s.tx = tile.gx * TILE + TILE / 2;
                        s.ty = MAP_Y + tile.gy * TILE + TILE / 2;
                        s.phase = 'wandering';
                        this._setStaffPath(s);
                        return;
                    }
                }
                s.phase = 'idle';
                s.idleTimer = 0;
                s._targetFac = null;
            }
        } else if (s.phase === 'walking') {
            const arrived = this._staffMoveAlongPath(s, sDelta);
            if (arrived) {
                s.phase = 'working';
                s.workTimer = 0;
            }
        } else if (s.phase === 'working') {
            s.workTimer += sDelta;
            if (s.workTimer >= 1500) {
                if (s._targetTrashcan) {
                    const tc = s._targetTrashcan;
                    const key = `${tc.gx},${tc.gy}`;
                    this.state.trashcanFullness[key] = 0;
                    this._refreshTrashcanSprite(tc.gx, tc.gy);
                    this.heartEffect(s.sprite.x, s.sprite.y);
                    s._targetTrashcan = null;
                } else {
                    const fac = this.state.facilities.find(f => f.id === s._targetFac);
                    if (fac && fac.type === 'bathroom' && (fac.dirty || 0) > 0) {
                        this.cleanBathroom(fac);
                        this.heartEffect(s.sprite.x, s.sprite.y);
                    }
                    s._targetFac = null;
                }
                s.phase = 'idle';
                s.workTimer = 0;
            }
        }
    }

    _updateGardener(s, sDelta) {
        if (s.phase === 'idle') {
            s.idleTimer += sDelta;
            if (s.idleTimer >= 3000) {
                s.idleTimer = 0;
                const garden = this._findGardenWithReadyCrops();
                if (garden) {
                    s._targetFac = garden.id;
                    const tile = this._gardenAdjacentTile(garden);
                    if (tile) {
                        s.tx = tile.gx * TILE + TILE / 2;
                        s.ty = MAP_Y + tile.gy * TILE + TILE / 2;
                        s.phase = 'walking';
                        this._setStaffPath(s);
                    }
                } else {
                    const garden2 = this._findAnyGarden();
                    if (garden2) {
                        s._targetFac = garden2.id;
                        const tile = this._gardenAdjacentTile(garden2);
                        if (tile) {
                            s.tx = tile.gx * TILE + TILE / 2;
                            s.ty = MAP_Y + tile.gy * TILE + TILE / 2;
                            s.phase = 'wandering';
                            this._setStaffPath(s);
                        }
                    }
                }
            }
        } else if (s.phase === 'wandering') {
            const arrived = this._staffMoveAlongPath(s, sDelta);
            if (arrived) {
                s._wanderTimer = 0;
                s._wanderWait = 2000 + Math.random() * 3000;
                s.phase = 'wanderPause';
            }
        } else if (s.phase === 'wanderPause') {
            s._wanderTimer += sDelta;
            if (s._wanderTimer >= s._wanderWait) {
                const garden = this._findGardenWithReadyCrops();
                if (garden) {
                    s._targetFac = garden.id;
                    const tile = this._gardenAdjacentTile(garden);
                    if (tile) {
                        s.tx = tile.gx * TILE + TILE / 2;
                        s.ty = MAP_Y + tile.gy * TILE + TILE / 2;
                        s.phase = 'walking';
                        this._setStaffPath(s);
                        return;
                    }
                }
                const fac = this.state.facilities.find(f => f.id === s._targetFac);
                if (fac) {
                    const tile = this._gardenAdjacentTile(fac);
                    if (tile) {
                        s.tx = tile.gx * TILE + TILE / 2;
                        s.ty = MAP_Y + tile.gy * TILE + TILE / 2;
                        s.phase = 'wandering';
                        this._setStaffPath(s);
                        return;
                    }
                }
                s.phase = 'idle';
                s.idleTimer = 0;
                s._targetFac = null;
            }
        } else if (s.phase === 'walking') {
            const arrived = this._staffMoveAlongPath(s, sDelta);
            if (arrived) {
                s.phase = 'working';
                s.workTimer = 0;
            }
        } else if (s.phase === 'working') {
            s.workTimer += sDelta;
            if (s.workTimer >= 1200) {
                const fac = this.state.facilities.find(f => f.id === s._targetFac);
                if (fac && fac.produce) {
                    const ready = fac.produce.filter(slot => !slot.picked);
                    if (ready.length > 0) {
                        this.pickProduce(fac, ready[0]);
                        this.heartEffect(s.sprite.x, s.sprite.y);
                    }
                    const moreReady = fac.produce.some(slot => !slot.picked);
                    if (moreReady) {
                        s.workTimer = 0;
                        return;
                    }
                }
                s.phase = 'idle';
                s.workTimer = 0;
                s._targetFac = null;
            }
        }
    }

    _updateGuide(s, sDelta) {
        if (s.phase === 'idle') {
            if (!this._guideIsNearHome(s)) {
                const hp = this._guideHomePos(s);
                s.tx = hp.x; s.ty = hp.y;
                this._setStaffPath(s);
                s.phase = 'returning';
                return;
            }
            if (this.state.habitats.length > 0) {
                this._guideGrabOne(s);
                if (s.followers.length > 0) {
                    s.phase = 'waiting';
                    s.waitTimer = 0;
                }
            }
        } else if (s.phase === 'waiting') {
            s.waitTimer += sDelta;
            s.followers = s.followers.filter(v => v.sprite && v.sprite.active && v.guidedBy === s.id);
            this._guideGrabOne(s);
            this._guideUpdateFollowers(s, sDelta);
            if (s.followers.length === 0) {
                s.phase = 'idle';
                s.idleTimer = 0;
            } else if (s.followers.length >= 4 || (s.followers.length >= 2 && s.waitTimer >= 10000) || s.waitTimer >= 18000) {
                s.visitedHabs = new Set();
                s.phase = 'leading';
                this._guideSeekNextHabitat(s);
            }
        } else if (s.phase === 'returning') {
            const arrived = this._staffMoveAlongPath(s, sDelta);
            this._guideUpdateFollowers(s, sDelta);
            if (arrived) {
                if (s.followers.length > 0) {
                    this._guideReleaseAtHome(s);
                }
                s.phase = 'idle';
                s.idleTimer = 0;
                s.targetHab = null;
            }
        } else if (s.phase === 'leading') {
            const arrived = this._staffMoveAlongPath(s, sDelta);
            this._guideUpdateFollowers(s, sDelta);
            if (arrived) {
                s.phase = 'showing';
                s.workTimer = 0;
                this._guideSpreadFollowers(s);
            }
        } else if (s.phase === 'showing') {
            s.workTimer += sDelta;
            this._guideShowingFollowers(s, sDelta);
            if (s.workTimer >= 4000) {
                s.visitedHabs.add(s.targetHab);
                s.followers = s.followers.filter(v => v.sprite && v.sprite.active && v.guidedBy === s.id);
                const unvisited = this.state.habitats.filter(h => !s.visitedHabs.has(h.id));
                if (unvisited.length === 0 || s.followers.length === 0) {
                    const hp = this._guideHomePos(s);
                    s.tx = hp.x; s.ty = hp.y;
                    this._setStaffPath(s);
                    s.phase = 'returning';
                    s.targetHab = null;
                    for (const v of s.followers) {
                        if (v.sprite && v.sprite.active) v._showingSpot = null;
                    }
                } else {
                    s.phase = 'leading';
                    for (const v of s.followers) {
                        if (v.sprite && v.sprite.active) v._showingSpot = null;
                    }
                    this._guideSeekNextHabitat(s);
                }
            }
        }
    }

    _guideSeekNextHabitat(s) {
        const unvisited = this.state.habitats.filter(h => !s.visitedHabs.has(h.id));
        if (unvisited.length === 0) {
            const hp = this._guideHomePos(s);
            s.tx = hp.x; s.ty = hp.y;
            this._setStaffPath(s);
            s.phase = 'returning';
            return;
        }
        const hab = Phaser.Utils.Array.GetRandom(unvisited);
        s.targetHab = hab.id;
        const spot = this.findViewingSpot(hab, { sprite: s.sprite }) || this.randomOpenTile();
        s.tx = spot.x; s.ty = spot.y;
        this._setStaffPath(s);
    }

    _guideSpreadFollowers(s) {
        const hab = this.state.habitats.find(h => h.id === s.targetHab);
        if (!hab) return;
        for (const v of s.followers) {
            if (!v.sprite || !v.sprite.active) continue;
            const spot = this.findViewingSpot(hab, v) || { x: s.sprite.x, y: s.sprite.y };
            v._showingSpot = spot;
            v._showingReacted = false;
            v.targetHab = hab.id;
            v.visitedHabs.add(hab.id);
        }
    }

    _guideShowingFollowers(s, sDelta) {
        for (const v of s.followers) {
            if (!v.sprite || !v.sprite.active) continue;
            if (v._showingSpot) {
                const dx = v._showingSpot.x - v.sprite.x;
                const dy = v._showingSpot.y - v.sprite.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 3) {
                    const spd = 30 * sDelta / 1000;
                    v.sprite.x += (dx / dist) * Math.min(spd, dist);
                    v.sprite.y += (dy / dist) * Math.min(spd, dist);
                    if (Math.abs(dx) > 1) v.sprite.setFlipX(dx < 0);
                } else if (!v._showingReacted) {
                    v._showingReacted = true;
                    const hab = this.state.habitats.find(h => h.id === s.targetHab);
                    if (hab) v.sprite.setFlipX(v.sprite.x > (hab.gx + hab.w / 2) * TILE);
                    this._visitorReact(v);
                }
            }
            if (v._bubble) v._bubble.setPosition(v.sprite.x, v.sprite.y - 22);
        }
    }

    _guideUpdateFollowers(s, sDelta) {
        let fwdX = 0, fwdY = -1;
        if (s._path && s._pathIdx < s._path.length) {
            const wp = s._path[s._pathIdx];
            const rx = wp.x - s.sprite.x, ry = wp.y - s.sprite.y;
            const len = Math.sqrt(rx * rx + ry * ry);
            if (len > 2) { fwdX = rx / len; fwdY = ry / len; }
        }
        const perpX = -fwdY, perpY = fwdX;
        for (let i = 0; i < s.followers.length; i++) {
            const v = s.followers[i];
            if (!v.sprite || !v.sprite.active) continue;
            const lateral = ((i % 2 === 0) ? -1 : 1) * (8 + Math.floor(i / 2) * 6);
            const trail = 14 + i * 10;
            const goalX = s.sprite.x - fwdX * trail + perpX * lateral;
            const goalY = s.sprite.y - fwdY * trail + perpY * lateral;
            const dx = goalX - v.sprite.x, dy = goalY - v.sprite.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 4) {
                const toFX = v.sprite.x - s.sprite.x, toFY = v.sprite.y - s.sprite.y;
                const ahead = toFX * fwdX + toFY * fwdY;
                const baseSpeed = ahead > 0 ? 12 : Math.min(50, 26 + dist * 0.5);
                const spd = baseSpeed * sDelta / 1000;
                v.sprite.x += (dx / dist) * Math.min(spd, dist);
                v.sprite.y += (dy / dist) * Math.min(spd, dist);
                if (Math.abs(dx) > 1) v.sprite.setFlipX(dx < 0);
            }
            if (v._bubble) v._bubble.setPosition(v.sprite.x, v.sprite.y - 22);
        }
    }

    paySalaries() {
        let total = this.state.staff.reduce((s, st) => s + STAFF_TYPES[st.type].salary, 0);
        if (total <= 0) return;
        if (this.state.coins >= total) {
            this.spendCoins(total);
            for (const s of this.state.staff) {
                this._showFloatingCost(s.sprite.x, s.sprite.y, STAFF_TYPES[s.type].salary);
            }
            this.game.events.emit('notification', `Paid ${total}g in salaries.`);
        } else {
            this.game.events.emit('notification', "Can't afford salaries! Staff leaving.");
            while (this.state.staff.length > 0 && this.state.coins < total) {
                const last = this.state.staff.pop();
                if (last.type === 'guide') this._guideReleaseFollowers(last);
                if (last.postSprite) { last.postSprite.destroy(); last.postSprite = null; }
                last.sprite.destroy();
                total -= STAFF_TYPES[last.type].salary;
            }
            if (total > 0 && this.state.coins >= total) {
                this.spendCoins(total);
                for (const s of this.state.staff) {
                    this._showFloatingCost(s.sprite.x, s.sprite.y, STAFF_TYPES[s.type].salary);
                }
            }
            this.game.events.emit('staffUpdate', this.state.staff);
        }
    }


    /* ========== UPGRADES ========== */
    // One-time purchases (better food, medical kit, gift shop, etc.) that persist in state.

    buyUpgrade(id) {
        const up = UPGRADES[id];
        if (!up || this.state.upgrades.has(id)) return false;
        if (this.state.coins < up.cost) { this.sfx.error(); this.game.events.emit('notification', 'Not enough coins!'); return false; }
        this.spendCoins(up.cost);
        this.state.upgrades.add(id);
        this.sfx.upgrade();
        this.game.events.emit('notification', `Upgrade unlocked: ${up.name}!`);
        this.game.events.emit('upgradesUpdate', [...this.state.upgrades]);
        if (id === 'conservation') {
            this.rescueInterval = Math.round(this.rescueInterval * 0.7);
        }
        return true;
    }

    /* ========== RESEARCH ========== */
    // Tech tree: 4 branches, nodes grant effects checked via hasResearch() throughout the game.

    hasResearch(effectId) {
        for (const rId of this.state.researchUnlocked) {
            const r = RESEARCH[rId];
            if (r && r.effect === effectId) return true;
        }
        return false;
    }

    canUnlockResearch(id) {
        const r = RESEARCH[id];
        if (!r || this.state.researchUnlocked.has(id)) return false;
        if (r.requires && !this.state.researchUnlocked.has(r.requires)) return false;
        if (this.state.researchPoints < r.cost) return false;
        return true;
    }

    unlockResearch(id) {
        const r = RESEARCH[id];
        if (!r || !this.canUnlockResearch(id)) {
            this.sfx.error();
            if (r && this.state.researchPoints < r.cost)
                this.game.events.emit('notification', 'Not enough research points!');
            return false;
        }
        this.state.researchPoints -= r.cost;
        this.state.researchUnlocked.add(id);
        this.sfx.upgrade();
        this.game.events.emit('notification', `Research complete: ${r.name}!`);
        this.game.events.emit('researchUpdate');
        return true;
    }

    earnResearchPoints(n) {
        this.state.researchPoints += n;
        this.game.events.emit('researchUpdate');
    }

    /* ========== RESCUE ========== */
    // Timed events: pick species by rarity weights, show rescue dialog, accept adds animal.
    // Rescue timing is driven by game-time (accumulated in update()), not wall-clock time, so
    // it pauses naturally with the game and scales with speed. triggerRescue skips if rescuePaused.
    // HUDScene sets rescuePaused, shows a grey tint, and blocks all other interactions.
    // Pending rescue is stored in state.pendingRescue for save/load persistence.
    // If zoomed into a habitat, panels stay open; accepting re-emits showHabitatInfo to refresh.

    triggerRescue(forceSpecies) {
        if (this.state.rescuePaused || this.state.settingsPaused || this.state.buildMode || this._habSelectMode) return;
        const sp = forceSpecies ? SPECIES[forceSpecies] : this.pickSpecies();
        const normal = sp.variants.map((v, i) => v.breedOnly ? -1 : i).filter(i => i >= 0);
        const vi = normal[Phaser.Math.Between(0, normal.length - 1)];
        const v = sp.variants[vi];
        const hab = this.findCompatibleHabitat(sp);
        const tmpl = Phaser.Utils.Array.GetRandom(RESCUE_MSG);
        const msg = tmpl.replace('{name}', v.name).replace('{species}', sp.name);
        this.state.seenVariants.add(`${sp.id}_${vi}`);
        this.sfx.rescue();
        const ev = { speciesId: sp.id, name: v.name, variantIdx: vi, habitat: hab, msg };
        this.state.pendingRescue = ev;
        this.game.events.emit('rescueEvent', ev);
    }

    // Weighted by RARITY_WEIGHT; season match and rare_boost research double odds.
    pickSpecies() {
        const season = this.state.season;
        const list = Object.values(SPECIES).filter(s => !s.season || s.season === season);
        const rareBoost = this.hasResearch('rare_boost');
        const weights = list.map(s => {
            let w = RARITY_WEIGHT[s.rarity];
            if (s.season === season) w *= 2;
            if (rareBoost && (s.rarity === 'rare' || s.rarity === 'legendary')) w *= 2;
            return w;
        });
        const total = weights.reduce((a, b) => a + b, 0);
        let r = Math.random() * total;
        for (let i = 0; i < list.length; i++) { r -= weights[i]; if (r <= 0) return list[i]; }
        return list[0];
    }

    findCompatibleHabitat(sp) {
        return this.findAllCompatibleHabitats(sp)[0] || null;
    }

    findAllCompatibleHabitats(sp) {
        return this.state.habitats.filter(h => {
            const ht = HABITATS[h.type];
            if (!ht.types.includes(sp.type)) return false;
            const animalsInHab = this.state.animals.filter(a => a.habitatId === h.id);
            const pregnantCount = animalsInHab.filter(a => a.isPregnant).length;
            const effectiveOccupancy = animalsInHab.length + pregnantCount;
            return effectiveOccupancy < this.getHabitatCapacity(h);
        });
    }

    acceptRescue(ev) {
        const hab = this.findCompatibleHabitat(SPECIES[ev.speciesId]);
        if (!hab) { this.game.events.emit('notification', 'No compatible habitat! Build one first.'); this.sfx.error(); return; }
        this.acceptRescueInto(ev, hab);
    }

    acceptRescueInto(ev, hab) {
        this.state.pendingRescue = null;
        this.addAnimal(ev.speciesId, ev.name, hab.id, { variantIdx: ev.variantIdx });
        this.state.stats.rescued++;
        this.state.rescuedVariants.add(`${ev.speciesId}_${ev.variantIdx}`);
        this.earnResearchPoints(1);
        if (!this.state.discoveries.has(ev.speciesId)) {
            this.state.discoveries.add(ev.speciesId);
            this.game.events.emit('notification', `New species discovered: ${SPECIES[ev.speciesId].name}!`);
        }
        this.game.events.emit('notification', `${ev.name} the ${SPECIES[ev.speciesId].name} has been rescued!`);
        this.sfx.rescue();
        if (this.state.viewingHabitat) {
            const viewedHab = this.state.habitats.find(h => h.id === this.state.viewingHabitat);
            if (viewedHab) this.game.events.emit('showHabitatInfo', viewedHab);
        }
    }

    /* ========== HABITAT SELECTION MODE ========== */
    // Generic mode for picking a highlighted habitat from the zoomed-out sanctuary view.
    // Used by rescue (multiple compatible habitats) and relocate (move animal to another habitat).
    // Compatible habitats get a green highlight; clicking one invokes onSelect, ESC/right-click invokes onCancel.

    _enterHabitatSelect(compatIds, labelText, onSelect, onCancel) {
        this._habSelectMode = { compatIds, onSelect, onCancel };
        this._hideNPCs();

        this._selectHighlights = this.add.graphics().setDepth(61);
        for (const hab of this.state.habitats) {
            if (!compatIds.has(hab.id)) continue;
            const ht = HABITATS[hab.type];
            this._selectHighlights.fillStyle(0x00ff88, 0.15);
            this._selectHighlights.fillRect(hab.gx * TILE, MAP_Y + hab.gy * TILE, (hab.w ?? ht.w) * TILE, (hab.h ?? ht.h) * TILE);
            this._selectHighlights.lineStyle(2, 0x00ff88, 0.7);
            this._selectHighlights.strokeRect(hab.gx * TILE, MAP_Y + hab.gy * TILE, (hab.w ?? ht.w) * TILE, (hab.h ?? ht.h) * TILE);
        }

        this.game.events.emit('habitatSelectEnter', labelText);
    }

    _exitHabitatSelect() {
        if (this._selectHighlights) { this._selectHighlights.destroy(); this._selectHighlights = null; }
        this._habSelectMode = null;
        this.hoverOutline.setVisible(false);
        this._showNPCs();
        this.game.events.emit('habitatSelectExit');
    }

    enterRescueSelect(ev) {
        const sp = SPECIES[ev.speciesId];
        const compatIds = new Set(this.findAllCompatibleHabitats(sp).map(h => h.id));
        const hud = this.scene.get('HUDScene');
        this._enterHabitatSelect(compatIds, `Click a habitat to place ${ev.name}`, hab => {
            if (hud) hud._pendingRescue = null;
            this.state.rescuePaused = false;
            this.acceptRescueInto(ev, hab);
        }, () => {
            if (hud) { hud._pendingRescue = null; hud.showRescue(ev); }
        });
    }

    exitRescueSelect() { this._exitHabitatSelect(); }

    enterRelocateSelect(animal) {
        const sp = SPECIES[animal.speciesId];
        const compatIds = new Set(
            this.findAllCompatibleHabitats(sp)
                .filter(h => h.id !== animal.habitatId)
                .map(h => h.id)
        );
        this._enterHabitatSelect(compatIds, `Click a habitat to relocate ${animal.name}`, hab => {
            this.relocateAnimal(animal, hab);
        }, () => {
            const srcHab = this.state.habitats.find(h => h.id === animal.habitatId);
            if (srcHab) {
                this.zoomToHabitat(srcHab);
                this.game.events.emit('showHabitatInfo', srcHab);
            }
        });
    }

    relocateAnimal(animal, targetHab) {
        this._relocateAnimalSilent(animal, targetHab);
        this.game.events.emit('notification', `${animal.name} relocated!`);
        this.sfx.click();
        this.zoomToHabitat(targetHab);
        this.game.events.emit('showHabitatInfo', targetHab);
    }

    _relocateAnimalSilent(animal, targetHab) {
        const srcHab = this.state.habitats.find(h => h.id === animal.habitatId);
        const leftFriends = animal.bonds.filter(bid => {
            const f = this.state.animals.find(x => x.id === bid);
            return f && f.habitatId === animal.habitatId;
        }).length;
        if (srcHab) {
            srcHab.animals = srcHab.animals.filter(id => id !== animal.id);
        }

        animal.habitatId = targetHab.id;

        if (leftFriends > 0) {
            animal.lonelyTimer = 60000 * leftFriends;
            this.game.events.emit('notification', `${animal.name} misses their friends...`);
        }
        targetHab.animals.push(animal.id);

        const tx = (targetHab.gx + 0.5 + Math.random() * (targetHab.w - 1)) * TILE;
        const ty = MAP_Y + (targetHab.gy + 0.5 + Math.random() * (targetHab.h - 1)) * TILE;
        animal.baseX = tx; animal.baseY = ty;
        animal.tx = tx; animal.ty = ty;
        animal.sprite.x = Math.round(tx);
        animal.sprite.y = Math.round(ty);
    }

    /* ========== ACHIEVEMENTS ========== */
    // One-time unlocks; each has a check function; emits ★-prefixed notification and achievementEarned.

    checkAchievements() {
        if (this.state.rescuePaused || this.state.settingsPaused || this._habSelectMode) return;
        const s = this.state;
        const checks = {
            first_rescue: () => s.stats.rescued >= 1,
            five_animals: () => s.animals.length >= 5,
            ten_animals: () => s.animals.length >= 10,
            twenty_animals: () => s.animals.length >= 20,
            all_habitats: () => {
                const built = new Set(s.habitats.map(h => h.type));
                return Object.keys(HABITATS).every(k => built.has(k));
            },
            first_breed: () => s.stats.bred >= 1,
            five_breeds: () => s.stats.bred >= 5,
            rare_find: () => [...s.discoveries].some(d => SPECIES[d]?.rarity === 'rare'),
            legendary_find: () => [...s.discoveries].some(d => SPECIES[d]?.rarity === 'legendary'),
            rich: () => s.stats.earned >= 5000,
            millionaire: () => s.stats.earned >= 50000,
            full_year: () => s.seasonsVisited.size >= 4,
            half_bestiary: () => s.discoveries.size >= Math.ceil(Object.keys(SPECIES).length / 2),
            full_bestiary: () => s.discoveries.size >= Object.keys(SPECIES).length,
            first_mission: () => s.stats.missionsComplete >= 1,
            first_staff: () => s.staff.length >= 1,
            first_upgrade: () => s.upgrades.size >= 1,
            all_upgrades: () => s.upgrades.size >= Object.keys(UPGRADES).length,
            first_enrichment: () => s.habitats.some(h => (h.enrichments || []).length > 0),
            healer: () => s.stats.healed >= 1,
            first_research: () => s.researchUnlocked.size >= 1,
            full_research: () => s.researchUnlocked.size >= Object.keys(RESEARCH).length,
        };

        for (const ach of ACHIEVEMENTS) {
            if (s.achievementsEarned.has(ach.id)) continue;
            const fn = checks[ach.id];
            if (fn && fn()) {
                s.achievementsEarned.add(ach.id);
                this.game.events.emit('notification', { text: `Achievement: ${ach.name}!`, icon: 'particle_star' });
                this.sfx.upgrade();
                this.game.events.emit('achievementEarned', ach.id);
            }
        }
    }

    /* ========== ECONOMY ========== */
    // Coins: add/spend, emit coinsUpdate. stats.earned tracks total income.
    // Food: addFood increases food and emits foodUpdate (used by garden produce harvesting).

    addCoins(n) {
        this.state.coins += n;
        this.state.stats.earned += n;
        this.sfx.coin();
        this.game.events.emit('coinsUpdate', this.state.coins);
    }

    spendCoins(n) {
        this.state.coins -= n;
        this.game.events.emit('coinsUpdate', this.state.coins);
    }

    addFood(n) {
        this.state.food += n;
        this.game.events.emit('foodUpdate', this.state.food);
    }

    /* ========== SAVE / LOAD ========== */
    // Serialize state to localStorage. Sets become arrays; load rebuilds habitats, animals, staff
    // (with position and phase), visitors, missions, decorations, and facilities (including per-item
    // garden produce regrow state). Guided/confused visitors are reset to seeking on load.

    saveGame() {
        const data = {
            v: 5,
            mode: this._saveMode || 'havenwood',
            day: this.state.day, time: this.state.time,
            coins: this.state.coins, rep: this.state.rep,
            food: this.state.food,
            habitats: this.state.habitats.map(h => ({
                id: h.id, type: h.type, gx: h.gx, gy: h.gy,
                enrichments: h.enrichments || []
            })),
            animals: this.state.animals.map(a => ({
                id: a.id, speciesId: a.speciesId, name: a.name, habitatId: a.habitatId,
                variantIdx: a.variantIdx, gender: a.gender,
                hunger: a.hunger, happiness: a.happiness, health: a.health,
                trait: a.trait, illness: a.illness, bonds: a.bonds,
                bondLevel: a.bondLevel, bondXP: a.bondXP,
                neglectTimer: a.neglectTimer, lonelyTimer: a.lonelyTimer,
                isBaby: a.isBaby, growthTimer: a.growthTimer,
                breedCooldown: a.breedCooldown, isPregnant: a.isPregnant,
                pregnancyTimer: a.pregnancyTimer, mateVariantIdx: a.mateVariantIdx,
                mateTrait: a.mateTrait, mateName: a.mateName, mateGeneration: a.mateGeneration,
                generation: a.generation,
            })),
            staff: this.state.staff.map(s => ({ id: s.id, type: s.type, x: s.sprite.x, y: s.sprite.y, phase: s.phase || 'idle', homeX: s.homeX, homeY: s.homeY })),
            discoveries: [...this.state.discoveries],
            seenVariants: [...this.state.seenVariants],
            rescuedVariants: [...this.state.rescuedVariants],
            upgrades: [...this.state.upgrades],
            achievementsEarned: [...this.state.achievementsEarned],
            seasonsVisited: [...this.state.seasonsVisited],
            stats: { ...this.state.stats },
            activeMissions: this.state.activeMissions.map(m => ({
                id: m.id, biome: m.biome, duration: m.duration, elapsed: m.elapsed
            })),
            researchPoints: this.state.researchPoints,
            researchUnlocked: [...this.state.researchUnlocked],
            pendingRescue: this.state.pendingRescue ? {
                speciesId: this.state.pendingRescue.speciesId,
                name: this.state.pendingRescue.name,
                variantIdx: this.state.pendingRescue.variantIdx,
                msg: this.state.pendingRescue.msg,
            } : null,
            rescueAccum: this._rescueAccum,
            decorations: this.state.decorations.map(d => ({ id: d.id, gx: d.gx, gy: d.gy })),
            trashcanFullness: this.state.trashcanFullness || {},
            trash: this.trash.map(t => ({ id: t.id, x: t.x, y: t.y })),
            facilities: this.state.facilities.map(f => ({
                id: f.id, type: f.type, gx: f.gx, gy: f.gy,
                produce: f.produce ? f.produce.map(p => ({ type: p.type, picked: p.picked, regrowLeft: p.regrowLeft })) : undefined,
                dirty: f.dirty,
            })),
            autoSave: this.state.autoSave,
            timeSpeedMult: this.timeSpeedMult,
            visitors: this.visitors.map(v => ({
                visitorType: v.visitorType, x: v.sprite.x, y: v.sprite.y,
                tx: v.tx, ty: v.ty, speed: v.speed, timer: v.timer,
                maxTime: v.maxTime, phase: v.phase, targetHab: v.targetHab,
                visitedHabs: [...v.visitedHabs], habsToVisit: v.habsToVisit,
                viewTimer: v.viewTimer, satisfaction: v.satisfaction,
                wantsTour: v.wantsTour || false, wantsGiftShop: v.wantsGiftShop || false, wantsBathroom: v.wantsBathroom || false,
            })),
        };
        localStorage.setItem('havenwood_save', JSON.stringify(data));
        // Also save meta-world state when saving in meta mode
        if (this._saveMode === 'meta') MetaState.save();
    }

    loadGame() {
        const raw = localStorage.getItem('havenwood_save');
        if (!raw) return;
        try {
            const d = JSON.parse(raw);
            this.state.day = d.day; this.state.time = d.time;
            this.state.coins = d.coins; this.state.rep = d.rep || 0;
            this.state.food = d.food ?? 100;
            this.state.discoveries = new Set(d.discoveries || []);
            this.state.seenVariants = new Set(d.seenVariants || []);
            this.state.rescuedVariants = new Set(d.rescuedVariants || []);
            this.state.upgrades = new Set(d.upgrades || []);
            this.state.achievementsEarned = new Set(d.achievementsEarned || []);
            this.state.seasonsVisited = new Set(d.seasonsVisited || ['spring']);
            this.state.stats = { rescued: 0, visitors: 0, earned: 0, bred: 0, missionsComplete: 0, healed: 0, ...d.stats };
            this.state.researchPoints = d.researchPoints || 0;
            this.state.researchUnlocked = new Set(d.researchUnlocked || []);
            this.state.season = this.getSeason();

            for (const h of d.habitats) {
                const hab = this.placeHabitat(h.type, h.gx, h.gy, { id: h.id, cost: false });
                if (hab && h.enrichments) {
                    hab.enrichments = h.enrichments;
                    for (const eId of h.enrichments) {
                        const px = (hab.gx + 0.3 + Math.random() * (hab.w - 0.6)) * TILE;
                        const py = MAP_Y + (hab.gy + 0.4 + Math.random() * (hab.h - 0.8)) * TILE;
                        const spr = this.add.image(px, py, `enrich_${eId}`).setDepth(11).setScale(0.9);
                        this.enrichmentSprites.push({ habitatId: hab.id, enrichId: eId, sprite: spr });
                    }
                }
            }
            if (d.trash) {
                for (const td of d.trash) {
                    const sprite = this.add.image(td.x, td.y, 'particle_trash').setDepth(25).setScale(1.6);
                    this.trash.push({ id: td.id, x: td.x, y: td.y, sprite });
                }
            }
            this.state.trashcanFullness = d.trashcanFullness || {};
            if (d.decorations) {
                for (const dec of d.decorations) {
                    if (!DECORATIONS[dec.id]) continue;
                    this.grid[dec.gy][dec.gx] = `dec_${dec.id}`;
                    const px = dec.gx * TILE + TILE / 2, py = MAP_Y + dec.gy * TILE + TILE / 2;
                    const sprite = this.add.image(px, py, `decor_${dec.id}`).setDepth(10);
                    this.decorSprites.push({ id: dec.id, gx: dec.gx, gy: dec.gy, sprite });
                    this.state.decorations.push({ id: dec.id, gx: dec.gx, gy: dec.gy });
                    if (dec.id === 'trashcan') this._refreshTrashcanSprite(dec.gx, dec.gy);
                }
            }
            if (d.facilities) {
                for (const f of d.facilities) {
                    if (!FACILITIES[f.type]) continue;
                    this.placeFacility(f.type, f.gx, f.gy, { id: f.id, cost: false, produce: f.produce, dirty: f.dirty });
                }
            }
            for (const a of d.animals) {
                const hab = this.state.habitats.find(h => h.id === a.habitatId);
                if (!hab) continue;
                const animal = this.addAnimal(a.speciesId, a.name, hab.id, {
                    id: a.id, variantIdx: a.variantIdx, gender: a.gender,
                    hunger: a.hunger, happiness: a.happiness, health: a.health,
                    trait: a.trait, illness: a.illness, bonds: a.bonds || [],
                    bondLevel: a.bondLevel || 0, bondXP: a.bondXP || 0,
                    neglectTimer: a.neglectTimer || 0, lonelyTimer: a.lonelyTimer || 0,
                    isBaby: a.isBaby, growthTimer: a.growthTimer,
                    breedCooldown: a.breedCooldown || 0, isPregnant: a.isPregnant,
                    pregnancyTimer: a.pregnancyTimer || 0, mateVariantIdx: a.mateVariantIdx,
                    mateTrait: a.mateTrait, mateName: a.mateName, mateGeneration: a.mateGeneration,
                    generation: a.generation || 1,
                });
            }
            if (d.staff) {
                for (const sd of d.staff) {
                    const sx = sd.x || 15 * TILE, sy = sd.y || MAP_Y + (ROWS - 2) * TILE;
                    const sprite = this.add.image(sx, sy, `staff_${sd.type}`).setDepth(32).setAlpha(0.9);
                    const s = {
                        id: sd.id, type: sd.type, sprite,
                        tx: sx, ty: sy, wTimer: 0
                    };
                    if (sd.homeX != null) { s.homeX = sd.homeX; s.homeY = sd.homeY; }
                    if (sd.type === 'guide' && s.homeX != null) {
                        s.postSprite = this.add.image(s.homeX, s.homeY, 'guide_post').setDepth(12);
                    }
                    this._initStaffState(s);
                    this.state.staff.push(s);
                }
            }
            if (d.visitors) {
                for (const sv of d.visitors) {
                    const vType = VISITOR_TYPES[sv.visitorType] || VISITOR_TYPES.family;
                    const sprite = this.add.image(sv.x, sv.y, `visitor_${vType.spriteIdx}`).setDepth(30).setAlpha(0.85);
                    let loadedPhase = sv.phase;
                    if (loadedPhase === 'guided' || loadedPhase === 'confused' || loadedPhase === 'seekingGuide') loadedPhase = 'seeking';
                    else if (loadedPhase === 'seekingGiftShop' || loadedPhase === 'atGiftShop' || loadedPhase === 'seekingBathroom' || loadedPhase === 'atBathroom' || loadedPhase === 'noBathroom') loadedPhase = 'leaving';
                    const v = {
                        sprite, visitorType: sv.visitorType,
                        tx: sv.tx, ty: sv.ty, speed: sv.speed,
                        timer: sv.timer, maxTime: sv.maxTime,
                        phase: loadedPhase, targetHab: sv.targetHab,
                        visitedHabs: new Set(sv.visitedHabs || []),
                        habsToVisit: sv.habsToVisit, viewTimer: sv.viewTimer || 0,
                        satisfaction: sv.satisfaction || 0,
                        wantsTour: sv.wantsTour || false,
                        wantsGiftShop: sv.wantsGiftShop || false,
                        wantsBathroom: sv.wantsBathroom || false,
                    };
                    if (loadedPhase === 'leaving') {
                        v.tx = Phaser.Math.Between(13, 16) * TILE + TILE / 2;
                        v.ty = MAP_Y + (ROWS - 1) * TILE;
                    }
                    this._setVisitorPath(v);
                    this.visitors.push(v);
                }
            }
            if (d.activeMissions) {
                this.state.activeMissions = d.activeMissions;
            }

            this.updateSeason();
            this.game.events.emit('coinsUpdate', this.state.coins);
            this.game.events.emit('upgradesUpdate', [...this.state.upgrades]);
            this.game.events.emit('staffUpdate', this.state.staff);
            this.game.events.emit('missionsUpdate');

            this._rescueAccum = d.rescueAccum ?? 0;
            this._firstRescue = false;
            this.state.autoSave = d.autoSave ?? true;
            this.timeSpeedMult = d.timeSpeedMult ?? 1;
            this._loadedMode = d.mode || 'havenwood';

            if (d.pendingRescue) {
                const pr = d.pendingRescue;
                this.state.pendingRescue = pr;
                this.time.delayedCall(0, () => {
                    this.game.events.emit('rescueEvent', pr);
                });
            }
        } catch (e) {
            console.error('Failed to load save:', e);
        }
    }

    exportSave() {
        this.saveGame();
        const raw = localStorage.getItem('havenwood_save');
        const blob = new Blob([raw], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `havenwood_day${this.state.day}.json`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /* ========== UPDATE ========== */
    // Main loop: time, animals, visitors, staff, missions, gardens, ambient sound, rescue timing,
    // auto-save. Skipped entirely while rescuePaused, settingsPaused, movingHabitat, habSelectMode,
    // or buildMode is set (game time pauses during build/place/move modes).
    // Timer-based callbacks (updateBonds, checkAutoBreed, checkIllness, checkAchievements)
    // run on independent Phaser timers and have their own pause guards for the same conditions.

    update(time, delta) {
        if (this.state.rescuePaused || this.state.settingsPaused || this._movingHabitat || this._habSelectMode || this.state.buildMode) return;
        this.updateTime(delta);
        this.updateAnimals(delta, time);
        this.updateVisitors(delta);
        this.updateStaff(delta);
        this.updateMissions(delta);
        this.updateGardens(delta);
        this.updateBathrooms(delta);
        this.sfx.updateAmbient(delta, this.state.time);

        if (!this.state.buildMode && !this._habSelectMode) {
            this._rescueAccum += delta * this.timeSpeedMult;
        }
        if (this._rescueAccum >= this.rescueInterval) {
            if (!this.state.buildMode && !this._habSelectMode) {
                this._rescueAccum -= this.rescueInterval;
                if (this._firstRescue) { this._firstRescue = false; this.triggerRescue('cat'); }
                else this.triggerRescue();
            }
        }

        if (this.state.autoSave) {
            this._autoSaveAccum += delta;
            if (this._autoSaveAccum >= 60000) {
                this._autoSaveAccum -= 60000;
                this.saveGame();
            }
        }
    }
}
