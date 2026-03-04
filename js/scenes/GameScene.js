/**
 * GameScene - Core gameplay scene for Havenwood, a Phaser 3 animal sanctuary management game.
 * Handles map, building, habitat zoom view, animals, visitors, staff, missions, research, time,
 * seasons, rescue events (with time-pause), and save/load.
 */
import { TILE, COLS, ROWS, W, H, MAP_Y, TIME_SCALE, START_COINS, HABITATS, SPECIES, RARITY_WEIGHT, RESCUE_MSG, CLR,
    SEASONS, SEASON_ORDER, SEASON_LENGTH, SEASON_CYCLE, UPGRADES, STAFF_TYPES,
    TRAITS, TRAIT_IDS, ILLNESSES, ENRICHMENTS, MISSIONS, VISITOR_TYPES, ACHIEVEMENTS,
    RESEARCH, RESEARCH_BRANCHES } from '../GameData.js';
import { SoundManager } from '../SoundManager.js';

let uid = 0;
// Generates unique IDs for game entities (habitats, animals, staff, missions) to avoid collisions.
function genId(prefix) { return `${prefix}_${Date.now().toString(36)}_${(uid++).toString(36)}`; }

export default class GameScene extends Phaser.Scene {
    constructor() { super('GameScene'); }

    init(data) { this.isNewGame = data?.newGame !== false; }

    create() {
        this.sfx = new SoundManager();
        this.sfx.init();
        this.input.on('pointerdown', () => this.sfx.resume());

        this.state = {
            day: 1, time: 360, coins: START_COINS, rep: 0,
            buildMode: null,
            habitats: [], animals: [], staff: [],
            discoveries: new Set(),
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
            rescuePaused: false,
        };
        this.visitors = [];
        this.staffSprites = [];
        this.grid = [];
        this.habitatDecoObjects = [];
        this.enrichmentSprites = [];
        this._skipPointerDown = false;

        this.createMap();
        this.overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000033, 0).setDepth(100);
        this.seasonOverlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0).setDepth(99);
        this.preview = this.add.graphics().setDepth(60).setVisible(false);
        this.hoverOutline = this.add.graphics().setDepth(59).setVisible(false);

        this.setupParticles();
        this.setupInput();
        this.scene.launch('HUDScene');

        if (!this.isNewGame) this.loadGame();
        this.updateSeason();

        this.time.delayedCall(4000, () => this.triggerRescue('cat'));

        this.rescueInterval = 50000;
        this.rescueTimer = this.time.addEvent({
            delay: this.rescueInterval, callback: () => this.triggerRescue(), loop: true
        });
        this.time.addEvent({ delay: 7000, callback: () => this.trySpawnVisitor(), loop: true });
        this.time.addEvent({ delay: 60000, callback: () => this.saveGame(), loop: true });
        this.time.addEvent({ delay: 5000, callback: () => this.staffWork(), loop: true });
        this.time.addEvent({ delay: 10000, callback: () => this.checkIllness(), loop: true });
        this.time.addEvent({ delay: 8000, callback: () => this.updateBonds(), loop: true });
        this.time.addEvent({ delay: 5000, callback: () => this.checkAchievements(), loop: true });

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
    // Pointer move shows build preview in build mode; in default mode, hovering over a habitat
    // shows a pointer cursor and faint stroke outline. Pointerdown places habitat or zooms in.
    // World clicks and hover outlines are suppressed while zoomed (viewingHabitat) or while a
    // HUD management panel is open (hasOpenPanel check prevents clicking through panels).
    // Right-click or ESC exits build mode; ESC also zooms out if viewing a habitat.
    // Browser context menu is suppressed on the canvas.

    setupInput() {
        this.input.on('pointermove', ptr => {
            if (this.state.buildMode) {
                this.hoverOutline.setVisible(false);
                const gx = Math.floor(ptr.worldX / TILE), gy = Math.floor((ptr.worldY - MAP_Y) / TILE);
                const isMove = this.state.buildMode.startsWith('_move_');
                const habType = isMove ? this.state.buildMode.replace('_move_', '') : this.state.buildMode;
                const ht = HABITATS[habType];
                const ok = isMove ? this.canPlaceMove(habType, gx, gy) : this.canPlace(this.state.buildMode, gx, gy);
                const c = ok ? 0x00ff00 : 0xff0000;
                this.preview.clear().setVisible(true);
                this.preview.fillStyle(c, 0.25);
                this.preview.fillRect(gx * TILE, MAP_Y + gy * TILE, ht.w * TILE, ht.h * TILE);
                this.preview.lineStyle(2, c, 0.7);
                this.preview.strokeRect(gx * TILE, MAP_Y + gy * TILE, ht.w * TILE, ht.h * TILE);
                return;
            }
            this.preview.setVisible(false);
            if (this.state.viewingHabitat) { this.hoverOutline.setVisible(false); return; }
            const hud = this.scene.get('HUDScene');
            if (hud && hud.hasOpenPanel()) { this.hoverOutline.setVisible(false); this.game.canvas.style.cursor = 'default'; return; }
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
            }
            this.hoverOutline.setVisible(false);
            this.game.canvas.style.cursor = 'default';
        });

        this.input.on('pointerdown', ptr => {
            if (ptr.rightButtonDown()) { if (this._movingHabitat) { this.cancelMove(); } else { this.exitBuild(); } return; }
            if (this._skipPointerDown) { this._skipPointerDown = false; return; }
            if (this.state.viewingHabitat) return;
            const hud = this.scene.get('HUDScene');
            if (hud && hud.hasOpenPanel()) return;
            if (this.state.buildMode) {
                const gx = Math.floor(ptr.worldX / TILE), gy = Math.floor((ptr.worldY - MAP_Y) / TILE);
                if (this._movingHabitat) {
                    const habType = this.state.buildMode.replace('_move_', '');
                    if (this.canPlaceMove(habType, gx, gy)) this.finishMove(gx, gy);
                } else {
                    if (this.canPlace(this.state.buildMode, gx, gy)) { this.placeHabitat(this.state.buildMode, gx, gy); this.exitBuild(); }
                }
            } else {
                const gx = Math.floor(ptr.worldX / TILE), gy = Math.floor((ptr.worldY - MAP_Y) / TILE);
                if (gy >= 0 && gy < ROWS && gx >= 0 && gx < COLS) {
                    const cell = this.grid[gy]?.[gx];
                    if (cell && typeof cell === 'string' && cell.startsWith('hab_')) {
                        const hab = this.state.habitats.find(h => h.id === cell);
                        if (hab) { this.sfx.click(); this.zoomToHabitat(hab); this.game.events.emit('showHabitatInfo', hab); }
                    }
                }
            }
        });

        this.input.keyboard.on('keydown-ESC', () => {
            if (this._movingHabitat) { this.cancelMove(); return; }
            const hud = this.scene.get('HUDScene');
            if (hud && hud.hasOpenPanel()) { hud.closeAllPanels(); return; }
            if (this.state.viewingHabitat || this.cameras.main.zoom > 1) this.zoomOut();
            else this.exitBuild();
        });

        this.game.canvas.addEventListener('contextmenu', e => e.preventDefault());
    }

    /* ========== HABITAT ZOOM ========== */
    // Zoom camera (2.5x) to center on a habitat; zoom out restores default view.
    // Uses camera.pan/zoomTo with force:true so rescue events can't leave the camera stuck.
    // viewingHabitat tracks the active habitat id; world clicks and build mode are suppressed while set.
    // zoomOut clears any active animal hover glow and emits habitatViewClosed before animating.

    zoomToHabitat(hab) {
        const ht = HABITATS[hab.type];
        const cx = hab.gx * TILE + (ht.w * TILE) / 2;
        const cy = MAP_Y + hab.gy * TILE + (ht.h * TILE) / 2;
        this.state.viewingHabitat = hab.id;
        this.hoverOutline.setVisible(false);
        this.game.canvas.style.cursor = 'default';

        const cam = this.cameras.main;
        cam.pan(cx, cy, 400, 'Quad.easeInOut', true);
        cam.zoomTo(2.5, 400, 'Quad.easeInOut', true);
    }

    zoomOut() {
        if (!this.state.viewingHabitat && this.cameras.main.zoom === 1) return;
        this.state.viewingHabitat = null;
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
    }

    /* ========== MOVE HABITAT ========== */
    // Zoom out, temporarily remove habitat from grid, enter a build-like preview mode.
    // Click to place at new location; ESC or right-click cancels and returns it to the original spot.

    enterMoveMode(hab) {
        this._movingHabitat = hab;
        this._moveOrigin = { gx: hab.gx, gy: hab.gy };

        this.state.viewingHabitat = null;
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

                const ht = HABITATS[hab.type];
                for (let dy = 0; dy < ht.h; dy++)
                    for (let dx = 0; dx < ht.w; dx++)
                        this.grid[hab.gy + dy][hab.gx + dx] = null;
                if (hab.gfx) hab.gfx.setVisible(false);
                if (hab.decor) hab.decor.forEach(d => d.setVisible(false));
                this.enrichmentSprites.filter(e => e.habitatId === hab.id).forEach(e => e.sprite.setVisible(false));
                this.state.animals.filter(a => a.habitatId === hab.id).forEach(a => a.sprite.setVisible(false));

                this.state.buildMode = `_move_${hab.type}`;
                this.game.events.emit('buildModeChanged', this.state.buildMode);
            }
        });
    }

    canPlaceMove(type, gx, gy) {
        const h = HABITATS[type];
        if (gx < 1 || gy < 1 || gx + h.w > COLS - 1 || gy + h.h > ROWS - 1) return false;
        for (let dy = 0; dy < h.h; dy++)
            for (let dx = 0; dx < h.w; dx++)
                if (this.grid[gy + dy][gx + dx] !== null) return false;
        return true;
    }

    finishMove(gx, gy) {
        const hab = this._movingHabitat;
        if (!hab) return;
        const ht = HABITATS[hab.type];

        hab.gx = gx; hab.gy = gy;
        for (let dy = 0; dy < ht.h; dy++)
            for (let dx = 0; dx < ht.w; dx++)
                this.grid[gy + dy][gx + dx] = hab.id;

        const px = gx * TILE, py = MAP_Y + gy * TILE, pw = ht.w * TILE, ph = ht.h * TILE;
        if (hab.gfx) { hab.gfx.clear().setVisible(true); hab.gfx.fillStyle(ht.fill, 0.4); hab.gfx.fillRect(px, py, pw, ph); hab.gfx.lineStyle(2, ht.stroke, 0.9); hab.gfx.strokeRect(px + 1, py + 1, pw - 2, ph - 2); }
        if (hab.decor) hab.decor.forEach(d => d.destroy());
        hab.decor = this.addHabitatDecor(hab.type, gx, gy, ht);

        this.enrichmentSprites.filter(e => e.habitatId === hab.id).forEach(e => {
            e.sprite.x = (gx + 0.3 + Math.random() * (ht.w - 0.6)) * TILE;
            e.sprite.y = MAP_Y + (gy + 0.4 + Math.random() * (ht.h - 0.8)) * TILE;
            e.sprite.setVisible(true);
        });
        this.state.animals.filter(a => a.habitatId === hab.id).forEach(a => {
            const ax = (gx + 0.5 + Math.random() * (ht.w - 1)) * TILE;
            const ay = MAP_Y + (gy + 0.5 + Math.random() * (ht.h - 1)) * TILE;
            a.baseX = ax; a.baseY = ay; a.tx = ax; a.ty = ay;
            a.sprite.x = Math.round(ax); a.sprite.y = Math.round(ay);
            a.sprite.setVisible(true);
        });

        this._movingHabitat = null; this._moveOrigin = null;
        this.state.buildMode = null; this.preview.setVisible(false);
        this.game.events.emit('buildModeChanged', null);
        this.sfx.build();
    }

    cancelMove() {
        if (!this._movingHabitat) return;
        const o = this._moveOrigin;
        this.finishMove(o.gx, o.gy);
    }

    /* ========== BUILD ========== */
    // Habitat placement with preview overlay, validation, and seasonal cost discounts.

    enterBuild(type) { this.state.buildMode = type; this.game.events.emit('buildModeChanged', type); }
    exitBuild() { this.state.buildMode = null; this.preview.setVisible(false); this.game.events.emit('buildModeChanged', null); }

    getHabitatCost(type) {
        let cost = HABITATS[type].cost;
        const s = SEASONS[this.state.season];
        if (s.bonuses.buildCost) cost = Math.round(cost * s.bonuses.buildCost);
        return cost;
    }

    canPlace(type, gx, gy) {
        const h = HABITATS[type];
        if (gx < 1 || gy < 1 || gx + h.w > COLS - 1 || gy + h.h > ROWS - 1) return false;
        if (this.state.coins < this.getHabitatCost(type)) return false;
        for (let dy = 0; dy < h.h; dy++)
            for (let dx = 0; dx < h.w; dx++)
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
        const id = opts.id || genId('hab');
        for (let dy = 0; dy < ht.h; dy++)
            for (let dx = 0; dx < ht.w; dx++)
                this.grid[gy + dy][gx + dx] = id;

        const gfx = this.add.graphics().setDepth(10);
        const px = gx * TILE, py = MAP_Y + gy * TILE, pw = ht.w * TILE, ph = ht.h * TILE;
        gfx.fillStyle(ht.fill, 0.4); gfx.fillRect(px, py, pw, ph);
        gfx.lineStyle(2, ht.stroke, 0.9); gfx.strokeRect(px + 1, py + 1, pw - 2, ph - 2);

        const decor = this.addHabitatDecor(type, gx, gy, ht);

        const hab = { id, type, gx, gy, w: ht.w, h: ht.h, animals: [], gfx, decor, enrichments: [] };
        this.state.habitats.push(hab);

        if (opts.cost !== false) {
            this.spendCoins(this.getHabitatCost(type));
            this.sfx.build();
        }
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
    // Habitat items (toys, shelters) that boost animal happiness and visitor appeal.

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

    getEnrichmentAppealBonus(hab) {
        let bonus = 0;
        for (const eId of (hab.enrichments || [])) {
            const en = ENRICHMENTS[eId];
            if (en) bonus += en.appealBonus;
        }
        return bonus;
    }

    /* ========== ANIMALS ========== */
    // Spawn, wander, bob, hunger/happiness/health decay, traits, illness, bonds, breeding.
    // Animals are only clickable while zoomed into their habitat (viewingHabitat guard).
    // Hovering over an animal while zoomed in adds a preFX glow that follows the sprite shape.
    // updateAnimals emits animalUpdate every ~2s so the HUD animal panel auto-refreshes.

    addAnimal(speciesId, name, habitatId, opts = {}) {
        const hab = this.state.habitats.find(h => h.id === habitatId);
        if (!hab) return null;

        const ax = (hab.gx + 0.5 + Math.random() * (hab.w - 1)) * TILE;
        const ay = MAP_Y + (hab.gy + 0.5 + Math.random() * (hab.h - 1)) * TILE;
        const sprite = this.add.image(ax, ay, `animal_${speciesId}`).setDepth(40);
        sprite.setInteractive({ useHandCursor: true });

        const trait = opts.trait || Phaser.Utils.Array.GetRandom(TRAIT_IDS);

        const animal = {
            id: opts.id || genId('a'), speciesId, name, habitatId,
            hunger: opts.hunger ?? 75, happiness: opts.happiness ?? 60, health: opts.health ?? 100,
            sprite, tx: ax, ty: ay,
            wTimer: 0, wInterval: Phaser.Math.Between(2000, 6000),
            bobOffset: Math.random() * Math.PI * 2, baseX: ax, baseY: ay, sleeping: false,
            trait,
            illness: opts.illness || null,
            bonds: opts.bonds || [],
            isBaby: opts.isBaby || false,
            growthTimer: opts.growthTimer || 0,
            breedCooldown: opts.breedCooldown || 0,
            isPregnant: opts.isPregnant || false,
            pregnancyTimer: opts.pregnancyTimer || 0,
        };

        if (animal.isBaby) sprite.setScale(0.6);

        sprite.on('pointerdown', () => {
            if (!this.state.viewingHabitat) return;
            this._skipPointerDown = true;
            this.sfx.click();
            this.clearSelectedAnimal();
            this._selectedAnimal = animal;
            if (!sprite._hoverGlow && sprite.preFX) {
                sprite._hoverGlow = sprite.preFX.addGlow(0xffffff, 2, 0, false, 0.15, 10);
            }
            this.game.events.emit('showAnimalInfo', animal);
        });
        sprite.on('pointerover', () => {
            if (!this.state.viewingHabitat) return;
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

            a.hunger = Math.max(0, a.hunger - sp.hungerRate * (tr.hungerMult || 1) * hungerMult * delta / 1000);
            if (a.hunger < 20) a.happiness = Math.max(0, a.happiness - 0.4 * delta / 1000);
            const happyDecay = 0.03 * (tr.happyMult || 1) * enrichUpgrade;
            a.happiness = Math.max(0, Math.min(100, a.happiness - happyDecay * delta / 1000 + enrichHappy * enrichMod * delta / 1000));
            if (a.health < 50) a.happiness = Math.max(0, a.happiness - 0.2 * delta / 1000);

            // Bond happiness boost
            if (a.bonds.length > 0) {
                a.happiness = Math.min(100, a.happiness + 0.005 * a.bonds.length * delta / 1000);
            }

            // Illness drain
            if (a.illness) {
                const ill = ILLNESSES[a.illness.type];
                if (ill) {
                    a.health = Math.max(0, a.health - ill.healthDrain * delta / 1000);
                    a.happiness = Math.max(0, a.happiness - ill.happyDrain * delta / 1000);
                }
            }

            // Baby growth: 720 = minutes per in-game day
            if (a.isBaby) {
                a.growthTimer += delta / 1000;
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
            if (a.breedCooldown > 0) a.breedCooldown -= delta / 1000;

            // Pregnancy
            if (a.isPregnant) {
                a.pregnancyTimer -= delta / 1000;
                if (a.pregnancyTimer <= 0) {
                    a.isPregnant = false;
                    this.birthBaby(a);
                }
            }

            if (a.sleeping) {
                a.sprite.setAlpha(0.75);
                if (!a.zzzTimer) a.zzzTimer = 0;
                a.zzzTimer += delta;
                if (a.zzzTimer > 3000) {
                    a.zzzTimer = 0;
                    const z = this.add.image(a.sprite.x + 10, a.sprite.y - 12, 'particle_zzz').setDepth(55).setScale(0.5).setAlpha(0.7);
                    this.tweens.add({ targets: z, y: z.y - 20, alpha: 0, scale: 0.8, duration: 1500, onComplete: () => z.destroy() });
                }
            } else {
                a.sprite.setAlpha(1);
                a.wTimer += delta;
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
                    const spd = Math.min(18 * delta / 1000, dist);
                    a.baseX += (dx / dist) * spd;
                    a.baseY += (dy / dist) * spd;
                    a.sprite.setFlipX(dx < 0);
                }
                const bob = Math.sin((time * 0.002) + a.bobOffset) * 1.5;
                a.sprite.x = Math.round(a.baseX);
                a.sprite.y = Math.round(a.baseY + bob);
            }

            // Hungry icon
            if (a.hunger < 15 && !a.hungryIcon) {
                a.hungryIcon = this.add.text(0, 0, '!', {
                    fontFamily: '"Press Start 2P", monospace', fontSize: '10px', color: '#FF4444',
                    stroke: '#000', strokeThickness: 2
                }).setDepth(55);
            }
            if (a.hungryIcon) {
                if (a.hunger >= 15) { a.hungryIcon.destroy(); a.hungryIcon = null; }
                else a.hungryIcon.setPosition(a.sprite.x + 12, a.sprite.y - 16);
            }

            // Sick icon
            if (a.illness && !a.sickIcon) {
                a.sickIcon = this.add.image(0, 0, 'icon_sick').setDepth(56).setScale(0.7);
            }
            if (a.sickIcon) {
                if (!a.illness) { a.sickIcon.destroy(); a.sickIcon = null; }
                else a.sickIcon.setPosition(a.sprite.x - 12, a.sprite.y - 16);
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

    treatAnimal(id) {
        const a = this.state.animals.find(x => x.id === id);
        if (!a || this.state.coins < 20) return;
        this.spendCoins(20);
        a.health = Math.min(100, a.health + 25);
        a.hunger = Math.min(100, a.hunger + 10);
        a.happiness = Math.min(100, a.happiness + 10);
        this.heartEffect(a.sprite.x, a.sprite.y);
        this.starEffect(a.sprite.x, a.sprite.y);
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
            if (a.sickIcon) { a.sickIcon.destroy(); a.sickIcon = null; }
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
    // Same species, same habitat, both adult/healthy. Pregnancy and cooldown in minutes (720 = 1 day).

    canBreed(animal) {
        if (animal.isBaby || animal.isPregnant || animal.breedCooldown > 0) return false;
        if (animal.illness) return false;
        const hab = this.state.habitats.find(h => h.id === animal.habitatId);
        if (!hab || hab.animals.length >= this.getHabitatCapacity(hab)) return false;
        const partner = this.state.animals.find(b =>
            b.id !== animal.id && b.speciesId === animal.speciesId &&
            b.habitatId === animal.habitatId && !b.isBaby && !b.isPregnant &&
            b.breedCooldown <= 0 && !b.illness
        );
        return !!partner;
    }

    startBreeding(animalId) {
        const a = this.state.animals.find(x => x.id === animalId);
        if (!a || !this.canBreed(a)) { this.sfx.error(); return; }
        const partner = this.state.animals.find(b =>
            b.id !== a.id && b.speciesId === a.speciesId &&
            b.habitatId === a.habitatId && !b.isBaby && !b.isPregnant &&
            b.breedCooldown <= 0 && !b.illness
        );
        if (!partner) return;

        a.isPregnant = true;
        const breedBoost = this.hasResearch('breed_boost');
        // pregnancyTimer in minutes: 720 = 1 in-game day
        a.pregnancyTimer = (breedBoost ? 1.5 : 3) * 720;
        a.breedCooldown = (breedBoost ? 4 : 7) * 720;
        partner.breedCooldown = (breedBoost ? 4 : 7) * 720;

        this.heartEffect(a.sprite.x, a.sprite.y);
        this.heartEffect(partner.sprite.x, partner.sprite.y);
        this.sfx.rescue();
        this.game.events.emit('notification', `${a.name} and ${partner.name} are expecting!`);
    }

    birthBaby(parent) {
        const sp = SPECIES[parent.speciesId];
        const name = Phaser.Utils.Array.GetRandom(sp.names);
        const baby = this.addAnimal(parent.speciesId, name, parent.habitatId, { isBaby: true });
        if (baby) {
            this.state.stats.bred++;
            if (!this.state.discoveries.has(parent.speciesId)) this.state.discoveries.add(parent.speciesId);
            this.game.events.emit('notification', `${name} the baby ${sp.name} was born!`);
            this.sfx.rescue();
            this.starEffect(parent.sprite.x, parent.sprite.y);
        }
    }

    /* ========== ILLNESS ========== */
    // Random chance per tick; hunger/happiness increase risk. Vets can auto-cure.
    // Emits animalUpdate when illness state changes so the HUD panel refreshes immediately.

    checkIllness() {
        const hasVet = this.state.staff.some(s => s.type === 'vet');
        let changed = false;
        for (const a of this.state.animals) {
            if (a.illness) {
                const vetChance = this.hasResearch('super_vet') ? 1.0 : 0.3;
                if (hasVet && Math.random() < vetChance) {
                    a.illness = null;
                    if (a.sickIcon) { a.sickIcon.destroy(); a.sickIcon = null; }
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

    updateBonds() {
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
            mis.elapsed += TIME_SCALE * delta / 1000;
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
            const name = Phaser.Utils.Array.GetRandom(sp.names);
            const hab = this.findCompatibleHabitat(sp);
            if (hab) {
                this.addAnimal(speciesId, name, hab.id);
                this.state.stats.rescued++;
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
    // 1440 min/day, TIME_SCALE for speed. Day/night overlay: dawn 05:00–07:00, dusk 17:00–20:00, night 21:00–05:00.

    updateTime(delta) {
        this.state.time += TIME_SCALE * delta / 1000;
        if (this.state.time >= 1440) {
            this.state.time -= 1440;
            this.state.day++;
            this.state.rep += 2;
            this.earnResearchPoints(1);
            this.paySalaries();
            this.updateSeason();
            this.sfx.newDay();
            this.game.events.emit('notification', `Day ${this.state.day} begins!`);
        }

        const t = this.state.time;
        // Lighting phases: 300–420 dawn, 420–720 day, 720–1020 dusk, 1020–1200 sunset, 1200–300 night
        let color = 0x000033, alpha = 0;
        if (t >= 300 && t < 420) {
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
    // Enter (flat admission fee), wander open tiles avoiding habitats, leave (satisfaction-based donation).

    pickVisitorType() {
        const vipThreshold = this.hasResearch('vip_easier') ? 50 : null;
        const types = Object.values(VISITOR_TYPES).filter(vt => {
            const minRep = (vt.id === 'vip' && vipThreshold !== null) ? vipThreshold : vt.minRep;
            if (minRep && this.state.rep < minRep) return false;
            return true;
        });
        // Weighted random: sum weights, roll, subtract until <= 0
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

    trySpawnVisitor() {
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

        const dest = this.randomOpenTile();
        this.visitors.push({
            sprite, visitorType: vType.id,
            tx: dest.x, ty: dest.y,
            speed: Phaser.Math.Between(25, 40),
            timer: 0,
            maxTime: Phaser.Math.Between(12000, 25000) * (vType.stayMult || 1),
            phase: 'entering'
        });
    }

    updateVisitors(delta) {
        for (let i = this.visitors.length - 1; i >= 0; i--) {
            const v = this.visitors[i];
            v.timer += delta;
            const dx = v.tx - v.sprite.x, dy = v.ty - v.sprite.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 3) {
                const spd = v.speed * delta / 1000;
                const nx = v.sprite.x + (dx / dist) * spd;
                const ny = v.sprite.y + (dy / dist) * spd;
                const gx = Math.floor(nx / TILE), gy = Math.floor((ny - MAP_Y) / TILE);
                if (gy >= 0 && gy < ROWS && gx >= 0 && gx < COLS && this.grid[gy]?.[gx] !== null && this.grid[gy][gx] !== 'entrance') {
                    const rr = this.randomOpenTile(); v.tx = rr.x; v.ty = rr.y;
                } else {
                    v.sprite.x = nx;
                    v.sprite.y = ny;
                    v.sprite.setFlipX(dx < 0);
                }
            } else if (v.phase === 'entering') {
                v.phase = 'wandering';
                this.visitorAdmission(v);
                const t1 = this.randomOpenTile(); v.tx = t1.x; v.ty = t1.y;
            } else if (v.phase === 'wandering') {
                if (v.timer >= v.maxTime) {
                    v.phase = 'leaving'; v.tx = Phaser.Math.Between(13, 16) * TILE + TILE / 2; v.ty = MAP_Y + (ROWS - 1) * TILE;
                } else {
                    const t2 = this.randomOpenTile(); v.tx = t2.x; v.ty = t2.y;
                }
            } else if (v.phase === 'leaving') {
                this.visitorDonation(v); v.sprite.destroy(); this.visitors.splice(i, 1);
            }
        }
    }

    visitorAdmission(v) {
        const vType = VISITOR_TYPES[v.visitorType] || VISITOR_TYPES.family;
        let fee = 5;
        if (this.state.upgrades.has('sanctuary_sign')) fee = Math.round(fee * 1.2);
        if (this.hasResearch('income_50')) fee = Math.round(fee * 1.5);
        fee = Math.round(fee * vType.incomeMult);
        fee = Math.max(1, fee);
        this.addCoins(fee);

        const txt = this.add.text(v.sprite.x, v.sprite.y - 10, `+${fee}`, {
            fontFamily: '"Press Start 2P", monospace', fontSize: '8px', color: CLR.gold,
            stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5).setDepth(55);
        this.tweens.add({ targets: txt, y: txt.y - 20, alpha: 0, duration: 800, onComplete: () => txt.destroy() });
    }

    visitorDonation(v) {
        const vType = VISITOR_TYPES[v.visitorType] || VISITOR_TYPES.family;
        let donation = 0;

        const avgHappy = this.state.animals.length > 0
            ? this.state.animals.reduce((s, a) => s + a.happiness, 0) / this.state.animals.length : 50;
        donation += avgHappy * 0.06;

        for (const a of this.state.animals) {
            let appeal = SPECIES[a.speciesId].appeal * 0.3;
            if (vType.prefTypes?.length && vType.prefTypes.includes(SPECIES[a.speciesId].type)) appeal *= 1.5;
            if (vType.prefRarity?.length && vType.prefRarity.includes(SPECIES[a.speciesId].rarity)) appeal *= 1.5;
            donation += appeal;
        }

        for (const hab of this.state.habitats) {
            donation += this.getEnrichmentAppealBonus(hab) * 0.5;
        }

        let typeMult = vType.incomeMult;
        if (vType.id === 'school' && this.hasResearch('school_boost')) typeMult *= 2;
        donation *= typeMult;
        const seasonBonus = SEASONS[this.state.season].bonuses;
        if (seasonBonus.income) donation *= seasonBonus.income;
        if (this.state.upgrades.has('gift_shop')) donation += 3;
        const guideCount = this.state.staff.filter(s => s.type === 'guide').length;
        donation *= (1 + guideCount * 0.25);

        donation = Math.round(Math.max(0, donation));
        if (donation > 0) {
            this.addCoins(donation);
            const txt = this.add.text(v.sprite.x, v.sprite.y - 10, `+${donation} tip`, {
                fontFamily: '"Press Start 2P", monospace', fontSize: '8px', color: '#88DDAA',
                stroke: '#000', strokeThickness: 2
            }).setOrigin(0.5).setDepth(55);
            this.tweens.add({ targets: txt, y: txt.y - 20, alpha: 0, duration: 800, onComplete: () => txt.destroy() });
        }
        this.state.stats.visitors++;
        this.state.rep++;
    }

    /* ========== STAFF ========== */
    // Hired NPCs: caretakers feed, volunteers feed one habitat, vets heal. Wander and auto-work.
    // Volunteers, caretakers, and vets can walk into habitats; tour guides avoid them like visitors.

    hireStaff(typeId) {
        const st = STAFF_TYPES[typeId];
        if (this.state.coins < st.hireCost) {
            this.game.events.emit('notification', 'Not enough coins!');
            this.sfx.error(); return false;
        }
        this.spendCoins(st.hireCost);
        const sprite = this.add.image(15 * TILE, MAP_Y + (ROWS - 2) * TILE, `staff_${typeId}`).setDepth(32).setAlpha(0.9);
        this.state.staff.push({
            id: genId('staff'), type: typeId, sprite,
            tx: Phaser.Math.Between(4, COLS - 5) * TILE,
            ty: MAP_Y + Phaser.Math.Between(4, ROWS - 5) * TILE, wTimer: 0
        });
        this.sfx.build();
        this.game.events.emit('notification', `${st.name} hired!`);
        this.game.events.emit('staffUpdate', this.state.staff);
        return true;
    }

    fireStaff(staffId) {
        const idx = this.state.staff.findIndex(s => s.id === staffId);
        if (idx === -1) return;
        this.state.staff[idx].sprite.destroy();
        this.state.staff.splice(idx, 1);
        this.game.events.emit('staffUpdate', this.state.staff);
        this.game.events.emit('notification', 'Staff member let go.');
    }

    updateStaff(delta) {
        for (const s of this.state.staff) {
            s.wTimer += delta;
            const dx = s.tx - s.sprite.x, dy = s.ty - s.sprite.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 3) {
                const spd = 22 * delta / 1000;
                const nx = s.sprite.x + (dx / dist) * spd;
                const ny = s.sprite.y + (dy / dist) * spd;
                if (s.type === 'guide') {
                    const gx = Math.floor(nx / TILE), gy = Math.floor((ny - MAP_Y) / TILE);
                    if (gy >= 0 && gy < ROWS && gx >= 0 && gx < COLS && this.grid[gy]?.[gx] !== null && this.grid[gy][gx] !== 'entrance') {
                        const rr = this.randomOpenTile(); s.tx = rr.x; s.ty = rr.y;
                        continue;
                    }
                }
                s.sprite.x = nx; s.sprite.y = ny;
                s.sprite.setFlipX(dx < 0);
            } else {
                if (s.type === 'guide') {
                    const t = this.randomOpenTile(); s.tx = t.x; s.ty = t.y;
                } else {
                    s.tx = Phaser.Math.Between(4, COLS - 5) * TILE;
                    s.ty = MAP_Y + Phaser.Math.Between(4, ROWS - 5) * TILE;
                }
            }
        }
    }

    staffWork() {
        for (const s of this.state.staff) {
            if (s.type === 'caretaker') {
                this.state.animals.forEach(a => { a.hunger = Math.min(100, a.hunger + 8); });
            } else if (s.type === 'volunteer') {
                if (this.state.habitats.length > 0) {
                    const hab = Phaser.Utils.Array.GetRandom(this.state.habitats);
                    this.state.animals.filter(a => a.habitatId === hab.id)
                        .forEach(a => { a.hunger = Math.min(100, a.hunger + 12); });
                }
            } else if (s.type === 'vet') {
                this.state.animals.forEach(a => {
                    a.health = Math.min(100, a.health + 5);
                    if (a.health < 50) a.health = Math.min(100, a.health + 10);
                });
            }
        }
    }

    paySalaries() {
        let total = this.state.staff.reduce((s, st) => s + STAFF_TYPES[st.type].salary, 0);
        if (total <= 0) return;
        if (this.state.coins >= total) {
            this.spendCoins(total);
            this.game.events.emit('notification', `Paid ${total}g in salaries.`);
        } else {
            this.game.events.emit('notification', "Can't afford salaries! Staff leaving.");
            while (this.state.staff.length > 0 && this.state.coins < total) {
                const last = this.state.staff.pop();
                last.sprite.destroy();
                total -= STAFF_TYPES[last.type].salary;
            }
            if (total > 0 && this.state.coins >= total) this.spendCoins(total);
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
            this.rescueTimer.delay = this.rescueInterval;
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
    // Only one rescue at a time — triggerRescue skips if rescuePaused. The rescue timer is paused
    // while a popup is active so events don't queue up. HUDScene pauses game time (rescuePaused),
    // shows a grey tint, and resumes the timer on dismiss.
    // If zoomed into a habitat, panels stay open; accepting re-emits showHabitatInfo to refresh.

    triggerRescue(forceSpecies) {
        if (this.state.rescuePaused) return;
        const sp = forceSpecies ? SPECIES[forceSpecies] : this.pickSpecies();
        const name = Phaser.Utils.Array.GetRandom(sp.names);
        const hab = this.findCompatibleHabitat(sp);
        const tmpl = Phaser.Utils.Array.GetRandom(RESCUE_MSG);
        const msg = tmpl.replace('{name}', name).replace('{species}', sp.name);
        this.sfx.rescue();
        this.game.events.emit('rescueEvent', { speciesId: sp.id, name, habitat: hab, msg });
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
        return this.state.habitats.find(h => {
            const ht = HABITATS[h.type];
            return ht.types.includes(sp.type) && h.animals.length < this.getHabitatCapacity(h);
        }) || null;
    }

    acceptRescue(ev) {
        const hab = this.findCompatibleHabitat(SPECIES[ev.speciesId]);
        if (!hab) { this.game.events.emit('notification', 'No compatible habitat! Build one first.'); this.sfx.error(); return; }
        this.addAnimal(ev.speciesId, ev.name, hab.id);
        this.state.stats.rescued++;
        this.state.rep += 10;
        this.earnResearchPoints(1);
        if (!this.state.discoveries.has(ev.speciesId)) {
            this.state.discoveries.add(ev.speciesId);
            this.game.events.emit('notification', `New species discovered: ${SPECIES[ev.speciesId].name}!`);
        }
        this.game.events.emit('notification', `${ev.name} the ${SPECIES[ev.speciesId].name} has been rescued!`);
        if (this.state.viewingHabitat) {
            const viewedHab = this.state.habitats.find(h => h.id === this.state.viewingHabitat);
            if (viewedHab) this.game.events.emit('showHabitatInfo', viewedHab);
        }
    }

    /* ========== ACHIEVEMENTS ========== */
    // One-time unlocks; each has a check function; emits notification and achievementEarned.

    checkAchievements() {
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
                this.game.events.emit('notification', `Achievement: ${ach.name}!`);
                this.sfx.upgrade();
                this.game.events.emit('achievementEarned', ach.id);
            }
        }
    }

    /* ========== ECONOMY ========== */
    // Coins: add/spend, emit coinsUpdate. stats.earned tracks total income.

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

    /* ========== SAVE / LOAD ========== */
    // Serialize state to localStorage. Sets become arrays; load rebuilds habitats, animals, staff, missions.

    saveGame() {
        const data = {
            v: 4,
            day: this.state.day, time: this.state.time,
            coins: this.state.coins, rep: this.state.rep,
            habitats: this.state.habitats.map(h => ({
                id: h.id, type: h.type, gx: h.gx, gy: h.gy,
                enrichments: h.enrichments || []
            })),
            animals: this.state.animals.map(a => ({
                id: a.id, speciesId: a.speciesId, name: a.name, habitatId: a.habitatId,
                hunger: a.hunger, happiness: a.happiness, health: a.health,
                trait: a.trait, illness: a.illness, bonds: a.bonds,
                isBaby: a.isBaby, growthTimer: a.growthTimer,
                breedCooldown: a.breedCooldown, isPregnant: a.isPregnant,
                pregnancyTimer: a.pregnancyTimer,
            })),
            staff: this.state.staff.map(s => ({ id: s.id, type: s.type })),
            discoveries: [...this.state.discoveries],
            upgrades: [...this.state.upgrades],
            achievementsEarned: [...this.state.achievementsEarned],
            seasonsVisited: [...this.state.seasonsVisited],
            stats: { ...this.state.stats },
            activeMissions: this.state.activeMissions.map(m => ({
                id: m.id, biome: m.biome, duration: m.duration, elapsed: m.elapsed
            })),
            researchPoints: this.state.researchPoints,
            researchUnlocked: [...this.state.researchUnlocked],
        };
        localStorage.setItem('havenwood_save', JSON.stringify(data));
    }

    loadGame() {
        const raw = localStorage.getItem('havenwood_save');
        if (!raw) return;
        try {
            const d = JSON.parse(raw);
            this.state.day = d.day; this.state.time = d.time;
            this.state.coins = d.coins; this.state.rep = d.rep || 0;
            this.state.discoveries = new Set(d.discoveries || []);
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
            for (const a of d.animals) {
                const hab = this.state.habitats.find(h => h.id === a.habitatId);
                if (!hab) continue;
                const animal = this.addAnimal(a.speciesId, a.name, hab.id, {
                    id: a.id, hunger: a.hunger, happiness: a.happiness, health: a.health,
                    trait: a.trait, illness: a.illness, bonds: a.bonds || [],
                    isBaby: a.isBaby, growthTimer: a.growthTimer,
                    breedCooldown: a.breedCooldown || 0, isPregnant: a.isPregnant,
                    pregnancyTimer: a.pregnancyTimer || 0,
                });
            }
            if (d.staff) {
                for (const s of d.staff) {
                    const sprite = this.add.image(15 * TILE, MAP_Y + (ROWS - 2) * TILE, `staff_${s.type}`).setDepth(32).setAlpha(0.9);
                    this.state.staff.push({
                        id: s.id, type: s.type, sprite,
                        tx: Phaser.Math.Between(4, COLS - 5) * TILE,
                        ty: MAP_Y + Phaser.Math.Between(4, ROWS - 5) * TILE, wTimer: 0
                    });
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
    // Main loop: time, animals, visitors, staff, missions, ambient sound.
    // Skipped entirely while rescuePaused is set (rescue popup freezes all simulation).

    update(time, delta) {
        if (this.state.rescuePaused) return;
        this.updateTime(delta);
        this.updateAnimals(delta, time);
        this.updateVisitors(delta);
        this.updateStaff(delta);
        this.updateMissions(delta);
        this.sfx.updateAmbient(delta, this.state.time);
    }
}
