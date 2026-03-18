// MetaWorldScene — The "real world" top-down scene where the character lives.
// Data-driven: loads room layout, furniture, NPCs, and interactables from MetaLocations.
// Supports door transitions between locations, proximity-based interaction,
// time progression, weather overlays, and cross-mode unlocks.
// Outdoor areas use a height-based zoom to fill the space between top/bottom HUD bars,
// with a grass-colored background. Edge columns on outdoor maps block walking to prevent
// going off-screen. Indoor rooms use a fixed 1.35x zoom centered in the canvas.

import { W, H, TILE, CLR } from '../GameData.js';
import { getLocation } from '../MetaLocations.js';
import { getNPC, getNPCsAtLocation } from '../MetaNPCs.js';
import MetaState from '../MetaStateManager.js';
import MetaDialogue from '../MetaDialogue.js';
import MetaCrossModeUnlocks from '../MetaCrossModeUnlocks.js';
import MetaQuests from '../MetaQuests.js';
import MetaEvents from '../MetaEvents.js';
import MetaJobs from '../MetaJobs.js';
import MetaBulletinBoard from '../MetaBulletinBoard.js';
import MetaFriendshipMilestones from '../MetaFriendshipMilestones.js';

const MOVE_SPEED = 120;
// 1 real second = 1 game minute
const META_TIME_SCALE = 1;

export default class MetaWorldScene extends Phaser.Scene {
    constructor() { super('MetaWorldScene'); }

    init(data) {
        this._startWithPhone = data?.startWithPhone || false;
        this._locationId = data?.locationId || MetaState.state.currentLocation || 'bedroom';
        this._spawnGx = data?.spawnGx;
        this._spawnGy = data?.spawnGy;
        this._fromDoor = data?.fromDoor || false;
    }

    create() {
        this.cameras.main.setRoundPixels(true);
        this._roomObjects = [];

        // Background fill (persistent)
        this._bg = this.add.rectangle(W / 2, H / 2, W, H, 0x1a1a2a).setDepth(0);

        // Day/night tint overlay (persistent, not tracked by _roomObjects)
        this._dayNightOverlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0).setDepth(50);

        // Weather overlay container (persistent)
        this._weatherParticles = [];

        this.setupInput();
        this.buildLocation(this._locationId, this._spawnGx, this._spawnGy);

        this._interactCooldown = false;
        this._energyDecayAccum = 0;
        this._frozen = this._startWithPhone;
        this._timeAccum = 0;
        this._doorCooldown = true;

        if (this._startWithPhone) {
            this.char.setTexture('char_phone');
        }

        // Initial quest check
        this._questCheckAccum = 0;
        this.checkQuests();
    }

    // Build or rebuild a location without restarting the scene (preserves input)
    buildLocation(locationId, spawnGx, spawnGy) {
        // Destroy old room objects
        for (const obj of (this._roomObjects || [])) {
            if (obj && obj.destroy) obj.destroy();
        }
        this._roomObjects = [];
        if (this._highlightRect) { this._highlightRect.destroy(); this._highlightRect = null; }
        this._lastHighlightKey = null;

        this.location = getLocation(locationId);
        MetaState.state.currentLocation = locationId;

        // Track location visits for quests
        if (locationId === 'library') MetaState.setFlag('visited_library');
        if (locationId === 'park') {
            MetaState.setFlag('visited_park');
            if (MetaState.isQuestActive('campus_cleanup')) {
                MetaState.incrementQuestProgress('campus_cleanup', 'visits');
            }
        }
        if (locationId === 'classroom') {
            // Quest: lost textbook — return to classroom after finding it
            if (MetaState.isQuestActive('lost_textbook') && MetaState.hasFlag('quest_lt_library') && !MetaState.hasFlag('quest_lt_returned')) {
                MetaState.setFlag('quest_lt_returned');
            }
        }

        if (this.location.outdoor) {
            // Zoom so room fills height between top bar (42px) and bottom bar (62px)
            // Add 2px to compensate for sub-pixel rounding at both edges
            const zoom = (H - 42 - 62 + 2) / (this.location.rows * TILE);
            this.cameras.main.setZoom(zoom);
            this.cameras.main.centerOn(W / 2, H / 2);
            const scrollY = H / 2 - H / (2 * zoom);
            // Top-align room flush with top bar
            const topWorldY = 42 / zoom + scrollY;
            this.roomX = Math.floor((W - this.location.cols * TILE) / 2);
            this.roomY = Math.round(topWorldY) - 1;
            this._bg.setFillStyle(0x4A8B4A);
        } else {
            this.cameras.main.setZoom(1.35);
            this.cameras.main.centerOn(W / 2, H / 2);
            this.roomX = Math.floor((W - this.location.cols * TILE) / 2);
            this.roomY = Math.floor((H - this.location.rows * TILE) / 2);
            this._bg.setFillStyle(0x1a1a2a);
        }

        this.drawRoom();
        this.placeFurniture();
        this.placeNPCs();
        this.createCharacter(spawnGx, spawnGy);
        this.updateWeatherOverlay();

        this._doorCooldown = true;
    }

    // Track a room object for cleanup on location change
    _track(obj) { this._roomObjects.push(obj); return obj; }

    drawRoom() {
        const loc = this.location;
        const tileTextures = {
            0: loc.floorTile || 'floor_wood',
            1: 'wall',
            2: 'wall_window',
            3: 'floor_grass',
            4: 'floor_stone',
            5: 'wall_exterior',
        };

        for (let ry = 0; ry < loc.rows; ry++) {
            for (let rx = 0; rx < loc.cols; rx++) {
                const tile = loc.tileMap[ry][rx];
                const px = this.roomX + rx * TILE + TILE / 2;
                const py = this.roomY + ry * TILE + TILE / 2;

                let texKey;
                if (tile === 9) {
                    // Door tile — pick texture based on whether adjacent to exterior walls
                    texKey = this._getDoorTexture(loc, rx, ry);
                } else {
                    texKey = tileTextures[tile] || 'floor_wood';
                }
                this._track(this.add.image(px, py, texKey).setDepth(1));
            }
        }
    }

    // Determine which door texture to use based on neighboring wall types
    _getDoorTexture(loc, rx, ry) {
        const neighbors = [
            ry > 0 ? loc.tileMap[ry - 1][rx] : -1,
            ry < loc.rows - 1 ? loc.tileMap[ry + 1][rx] : -1,
            rx > 0 ? loc.tileMap[ry][rx - 1] : -1,
            rx < loc.cols - 1 ? loc.tileMap[ry][rx + 1] : -1,
        ];
        // If any neighbor is an exterior wall (5), use exterior door
        if (neighbors.includes(5)) return 'door_exterior';
        // If any neighbor is an interior wall (1 or 2), use interior door
        if (neighbors.includes(1) || neighbors.includes(2)) return 'door_interior';
        // Edge of map or near-edge on outdoor maps (border doors)
        if (ry === 0 || ry === loc.rows - 1 || rx === 0 || rx === loc.cols - 1) return 'door_interior';
        if (loc.outdoor && (rx <= 1 || rx >= loc.cols - 2)) return 'door_exterior';
        // Fallback to floor
        return loc.floorTile || 'floor_wood';
    }

    placeFurniture() {
        this.furnitureSprites = [];
        for (const f of this.location.furniture) {
            const px = this.roomX + f.gx * TILE;
            const py = this.roomY + f.gy * TILE;

            if (f.type === 'rug') {
                const rug = this._track(this.add.image(px + 48, py + 32, 'furniture_rug').setDepth(2));
                this.furnitureSprites.push(rug);
            } else if (f.type === 'desk') {
                const desk = this._track(this.add.image(px + 32, py + TILE / 2, 'furniture_desk').setDepth(5));
                this.furnitureSprites.push(desk);
            } else if (f.type === 'bed') {
                const bed = this._track(this.add.image(px + 32, py + 48, 'furniture_bed').setDepth(5));
                this.furnitureSprites.push(bed);
            } else if (f.type === 'lamp') {
                const lamp = this._track(this.add.image(px + TILE / 2, py + TILE / 2 - 8, 'furniture_lamp').setDepth(7));
                this.furnitureSprites.push(lamp);
                this._track(this.add.circle(px + TILE / 2, py + TILE / 2, 40, 0xFFFF88, 0.06).setDepth(3));
            } else if (f.type === 'bench') {
                const bench = this._track(this.add.image(px + 32, py + TILE / 2, 'furniture_bench').setDepth(5));
                this.furnitureSprites.push(bench);
            } else if (f.type === 'counter') {
                const counter = this._track(this.add.image(px + 32, py + TILE / 2, 'furniture_counter').setDepth(5));
                this.furnitureSprites.push(counter);
            } else if (f.type === 'job_board') {
                const jb = this._track(this.add.image(px + TILE / 2, py + TILE / 2, 'furniture_job_board').setDepth(5));
                this.furnitureSprites.push(jb);
            } else if (f.type === 'chalkboard') {
                const cb = this._track(this.add.image(px + 32, py + TILE / 2, 'furniture_chalkboard').setDepth(5));
                this.furnitureSprites.push(cb);
            } else if (f.type === 'couch') {
                const couch = this._track(this.add.image(px + 32, py + TILE / 2, 'furniture_couch').setDepth(5));
                this.furnitureSprites.push(couch);
            } else if (f.type === 'pond') {
                const pond = this._track(this.add.image(px + 32, py + 32, 'furniture_pond').setDepth(2));
                this.furnitureSprites.push(pond);
            } else if (f.type === 'tree') {
                const tree = this._track(this.add.image(px + TILE / 2, py + TILE / 2, 'furniture_tree').setDepth(7));
                this.furnitureSprites.push(tree);
                // Shadow under tree
                this._track(this.add.circle(px + TILE / 2, py + TILE / 2 + 4, 14, 0x000000, 0.1).setDepth(2));
            } else if (f.type === 'flower') {
                const fl = this._track(this.add.image(px + TILE / 2, py + TILE / 2, 'furniture_flower').setDepth(3));
                this.furnitureSprites.push(fl);
            } else {
                const key = `furniture_${f.type}`;
                if (this.textures.exists(key)) {
                    const sprite = this._track(this.add.image(px + TILE / 2, py + TILE / 2, key).setDepth(5));
                    this.furnitureSprites.push(sprite);
                }
            }
        }

        for (const ia of this.location.interactables) {
            if (ia.action === 'job' && !this.location.furniture.some(f => f.type === 'job_board' && f.gx === ia.gx && f.gy === ia.gy)) {
                const px = this.roomX + ia.gx * TILE;
                const py = this.roomY + ia.gy * TILE;
                this._track(this.add.image(px + TILE / 2, py + TILE / 2, 'furniture_job_board').setDepth(5));
            }
        }

        // Place event furniture (temporary, tracked for cleanup)
        const eventFurniture = MetaEvents.getEventFurniture(this.location.id);
        for (const f of eventFurniture) {
            const px = this.roomX + f.gx * TILE;
            const py = this.roomY + f.gy * TILE;
            const key = `furniture_${f.type}`;
            if (this.textures.exists(key)) {
                const sprite = this._track(this.add.image(px + TILE / 2, py + TILE / 2, key).setDepth(5));
                this.furnitureSprites.push(sprite);
            }
        }
    }

    placeNPCs() {
        this.npcSprites = [];
        // Dynamic NPC placement based on schedule (time of day + day of week)
        this._activeNPCRefs = getNPCsAtLocation(this.location.id);
        for (const npcRef of this._activeNPCRefs) {
            const npcDef = getNPC(npcRef.id);
            if (!npcDef) continue;
            const px = this.roomX + npcRef.gx * TILE + TILE / 2;
            const py = this.roomY + npcRef.gy * TILE + TILE / 2;
            const sprite = this._track(this.add.image(px, py, npcDef.spriteKey).setDepth(10));
            this.npcSprites.push({ id: npcRef.id, gx: npcRef.gx, gy: npcRef.gy, sprite, def: npcDef });
        }
    }

    // Rebuild NPC sprites without full location rebuild (for schedule changes)
    refreshNPCs() {
        // Remove old NPC sprites from tracked objects and destroy them
        for (const npc of this.npcSprites) {
            if (npc.sprite) {
                const idx = this._roomObjects.indexOf(npc.sprite);
                if (idx >= 0) this._roomObjects.splice(idx, 1);
                npc.sprite.destroy();
            }
        }
        this.placeNPCs();
    }

    createCharacter(spawnGx, spawnGy) {
        const gx = spawnGx ?? MetaState.state.playerTileX ?? 6;
        const gy = spawnGy ?? MetaState.state.playerTileY ?? 5;
        // Clamp to room bounds
        const clampedGx = Math.max(1, Math.min(gx, this.location.cols - 2));
        const clampedGy = Math.max(1, Math.min(gy, this.location.rows - 2));
        const px = this.roomX + clampedGx * TILE + TILE / 2;
        const py = this.roomY + clampedGy * TILE + TILE / 2;

        this.char = this._track(this.add.image(px, py, 'char_down').setDepth(10));
        this.charDir = 'down';
        this.charMoving = false;
        this.walkFrame = 0;
        this.walkTimer = 0;
    }

    setupInput() {
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = {
            W: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
            A: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
            S: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
            D: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
        };
        this.interactKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    }

    isWalkable(wx, wy) {
        const rx = Math.floor((wx - this.roomX) / TILE);
        const ry = Math.floor((wy - this.roomY) / TILE);
        if (rx < 0 || rx >= this.location.cols || ry < 0 || ry >= this.location.rows) return false;
        // Block edge columns on outdoor areas (they overflow off-screen)
        if (this.location.outdoor && (rx === 0 || rx === this.location.cols - 1)) {
            const tile = this.location.tileMap[ry][rx];
            if (tile !== 9) return false; // only doors are walkable on edges
        }
        const tile = this.location.tileMap[ry][rx];
        if (tile === 1 || tile === 2 || tile === 5) return false;

        // Furniture collision
        for (const f of this.location.furniture) {
            if (f.type === 'rug' || f.type === 'lamp' || f.type === 'stool' || f.type === 'flower') continue;
            let fw = 1, fh = 1;
            if (f.type === 'desk' || f.type === 'bench' || f.type === 'counter' || f.type === 'chalkboard' || f.type === 'couch') { fw = 2; fh = 1; }
            if (f.type === 'bed') { fw = 2; fh = 3; }
            if (f.type === 'pond') { fw = 2; fh = 2; }
            if (rx >= f.gx && rx < f.gx + fw && ry >= f.gy && ry < f.gy + fh) return false;
        }

        // NPC collision (dynamic schedule)
        for (const npcRef of (this._activeNPCRefs || [])) {
            if (rx === npcRef.gx && ry === npcRef.gy) return false;
        }

        // Interactable collision (job board, bulletin board, etc.)
        for (const ia of this.location.interactables) {
            if ((ia.action === 'job' || ia.action === 'bulletin_board') &&
                rx >= ia.gx && rx < ia.gx + (ia.w || 1) && ry >= ia.gy && ry < ia.gy + (ia.h || 1)) return false;
        }

        // Event furniture collision
        const eventFurniture = MetaEvents.getEventFurniture(this.location.id);
        for (const f of eventFurniture) {
            const fw = f.type === 'fair_booth' ? 2 : 1;
            const fh = 1;
            if (rx >= f.gx && rx < f.gx + fw && ry >= f.gy && ry < f.gy + fh) return false;
        }

        return true;
    }

    // Get the tile the character is facing
    getFacingTile() {
        const rx = Math.floor((this.char.x - this.roomX) / TILE);
        const ry = Math.floor((this.char.y + 6 - this.roomY) / TILE);
        let fx = rx, fy = ry;
        if (this.charDir === 'up') fy--;
        else if (this.charDir === 'down') fy++;
        else if (this.charDir === 'left') fx--;
        else if (this.charDir === 'right') fx++;
        return { fx, fy };
    }

    // Check what's at a tile position
    getInteractableAt(fx, fy) {
        // Check NPCs (dynamic schedule)
        for (const npcRef of (this._activeNPCRefs || [])) {
            if (npcRef.gx === fx && npcRef.gy === fy) {
                return { type: 'npc', id: npcRef.id };
            }
        }
        // Check interactables (location + event)
        const allInteractables = [
            ...this.location.interactables,
            ...MetaEvents.getEventInteractables(this.location.id),
        ];
        for (const ia of allInteractables) {
            const w = ia.w || 1, h = ia.h || 1;
            if (fx >= ia.gx && fx < ia.gx + w && fy >= ia.gy && fy < ia.gy + h) {
                return { type: 'interactable', data: ia };
            }
        }
        return null;
    }

    update(time, delta) {
        // Handle dialogue advancement even when frozen
        if (MetaDialogue.isActive()) {
            if (Phaser.Input.Keyboard.JustDown(this.interactKey) ||
                Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
                const hudScene = this.scene.get('MetaHUDScene');
                MetaDialogue.advance(hudScene);
            }
            return;
        }

        if (this._frozen) return;

        this.handleMovement(delta);
        this.handleDoors();
        this.handleInteraction();
        this.updateProximityPrompt();
        this.updateTime(delta);
        this.updateQuestChecks(delta);
        this.animateWeather(delta);
    }

    updateTime(delta) {
        this._timeAccum += delta;
        const tickMs = 1000 / META_TIME_SCALE;
        if (this._timeAccum >= tickMs) {
            const mins = Math.floor(this._timeAccum / tickMs);
            this._timeAccum -= mins * tickMs;
            MetaState.advanceTime(mins);
            this.game.events.emit('metaTimeUpdate');

            // Passive energy drain: -1 per 30 game minutes
            this._energyDecayAccum += mins;
            if (this._energyDecayAccum >= 30) {
                const drain = Math.floor(this._energyDecayAccum / 30);
                this._energyDecayAccum -= drain * 30;
                MetaState.state.energy = Math.max(0, MetaState.state.energy - drain);
            }

            // Auto pass-out at midnight
            if (MetaState.state.timeOfDay >= 1440) {
                this._doPassOut();
                return;
            }
        }

        // Day/night tint
        this.updateDayNightTint();
    }

    updateDayNightTint() {
        if (!this._dayNightOverlay) return;
        const hour = Math.floor(MetaState.state.timeOfDay / 60);
        if (hour >= 6 && hour < 8) {
            // Dawn — warm gold
            this._dayNightOverlay.fillColor = 0xFF8844;
            this._dayNightOverlay.fillAlpha = 0.06;
        } else if (hour >= 8 && hour < 17) {
            // Daytime — clear
            this._dayNightOverlay.fillAlpha = 0;
        } else if (hour >= 17 && hour < 20) {
            // Dusk — orange
            this._dayNightOverlay.fillColor = 0xFF6622;
            this._dayNightOverlay.fillAlpha = 0.1;
        } else {
            // Night — dark blue
            this._dayNightOverlay.fillColor = 0x112244;
            this._dayNightOverlay.fillAlpha = 0.22;
        }
    }

    // ── Weather Overlay ──

    updateWeatherOverlay() {
        // Clear old weather particles
        for (const p of this._weatherParticles) {
            if (p && p.destroy) p.destroy();
        }
        this._weatherParticles = [];

        // Only show weather on outdoor locations
        if (!this.location.outdoor) return;

        const weather = MetaState.state.weather;
        if (weather === 'rainy') {
            this.createRainOverlay();
        } else if (weather === 'snowy') {
            this.createSnowOverlay();
        } else if (weather === 'cloudy') {
            // Subtle dark tint for cloudy
            const cloud = this.add.rectangle(W / 2, H / 2, W, H, 0x334455, 0.08).setDepth(45);
            this._weatherParticles.push(cloud);
        }
        // sunny = no overlay
    }

    createRainOverlay() {
        // Dim overlay
        const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x223344, 0.12).setDepth(45);
        this._weatherParticles.push(overlay);

        // Rain drop sprites falling
        const roomW = this.location.cols * TILE;
        const roomH = this.location.rows * TILE;
        for (let i = 0; i < 30; i++) {
            const x = this.roomX + Math.random() * roomW;
            const y = this.roomY + Math.random() * roomH;
            const drop = this.add.image(x, y, 'particle_rain').setDepth(46).setAlpha(0.5);
            drop._rainSpeed = 100 + Math.random() * 80;
            drop._baseX = x;
            this._weatherParticles.push(drop);
        }
    }

    createSnowOverlay() {
        const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0xCCDDEE, 0.06).setDepth(45);
        this._weatherParticles.push(overlay);

        const roomW = this.location.cols * TILE;
        const roomH = this.location.rows * TILE;
        for (let i = 0; i < 20; i++) {
            const x = this.roomX + Math.random() * roomW;
            const y = this.roomY + Math.random() * roomH;
            const flake = this.add.image(x, y, 'particle_snow').setDepth(46).setAlpha(0.6);
            flake._snowSpeed = 20 + Math.random() * 30;
            flake._wobble = Math.random() * Math.PI * 2;
            flake._baseX = x;
            this._weatherParticles.push(flake);
        }
    }

    animateWeather(delta) {
        if (!this.location.outdoor) return;
        const weather = MetaState.state.weather;
        const roomBottom = this.roomY + this.location.rows * TILE;
        const roomTop = this.roomY;
        const roomW = this.location.cols * TILE;

        for (const p of this._weatherParticles) {
            if (!p || !p.active) continue;

            if (weather === 'rainy' && p._rainSpeed) {
                p.y += p._rainSpeed * (delta / 1000);
                if (p.y > roomBottom) {
                    p.y = roomTop - 10;
                    p.x = this.roomX + Math.random() * roomW;
                }
            } else if (weather === 'snowy' && p._snowSpeed) {
                p.y += p._snowSpeed * (delta / 1000);
                p._wobble += delta * 0.002;
                p.x = p._baseX + Math.sin(p._wobble) * 15;
                if (p.y > roomBottom) {
                    p.y = roomTop - 6;
                    p._baseX = this.roomX + Math.random() * roomW;
                    p.x = p._baseX;
                }
            }
        }
    }

    handleMovement(delta) {
        let dx = 0, dy = 0;
        const left = this.cursors.left.isDown || this.wasd.A.isDown;
        const right = this.cursors.right.isDown || this.wasd.D.isDown;
        const up = this.cursors.up.isDown || this.wasd.W.isDown;
        const down = this.cursors.down.isDown || this.wasd.S.isDown;

        if (left) dx = -1;
        else if (right) dx = 1;
        if (up) dy = -1;
        else if (down) dy = 1;

        if (dx !== 0 || dy !== 0) {
            if (Math.abs(dy) >= Math.abs(dx)) {
                this.charDir = dy < 0 ? 'up' : 'down';
            } else {
                this.charDir = dx < 0 ? 'left' : 'right';
            }
            this.charMoving = true;
        } else {
            this.charMoving = false;
        }

        if (this.charMoving) {
            const len = Math.sqrt(dx * dx + dy * dy);
            dx /= len;
            dy /= len;

            const speed = MOVE_SPEED * (delta / 1000);
            const nx = this.char.x + dx * speed;
            const ny = this.char.y + dy * speed;
            const footX = nx;
            const footY = ny + 6;

            if (this.isWalkable(footX, footY)) {
                this.char.x = nx;
                this.char.y = ny;
            } else {
                if (this.isWalkable(nx, this.char.y + 6)) {
                    this.char.x = nx;
                } else if (this.isWalkable(this.char.x, footY)) {
                    this.char.y = ny;
                }
            }

            this.walkTimer += delta;
            if (this.walkTimer > 200) {
                this.walkTimer = 0;
                this.walkFrame = (this.walkFrame + 1) % 2;
            }
            const walkSuffix = `_walk${this.walkFrame + 1}`;
            const texKey = `char_${this.charDir}${walkSuffix}`;
            if (this.textures.exists(texKey)) {
                this.char.setTexture(texKey);
            }
        } else {
            this.char.setTexture(`char_${this.charDir}`);
            this.walkTimer = 0;
            this.walkFrame = 0;
        }

        // Save player position
        MetaState.state.playerTileX = Math.floor((this.char.x - this.roomX) / TILE);
        MetaState.state.playerTileY = Math.floor((this.char.y + 6 - this.roomY) / TILE);
    }

    handleDoors() {
        const rx = Math.floor((this.char.x - this.roomX) / TILE);
        const ry = Math.floor((this.char.y + 6 - this.roomY) / TILE);
        const onDoor = this.location.doors.some(d => d.gx === rx && d.gy === ry);

        // Clear cooldown once the player has stepped off all door tiles
        if (this._doorCooldown) {
            if (!onDoor) this._doorCooldown = false;
            return;
        }

        if (!onDoor) return;

        // Player stepped onto a door — trigger transition
        const door = this.location.doors.find(d => d.gx === rx && d.gy === ry);
        this._doorCooldown = true;
        this._frozen = true;

        this.cameras.main.fadeOut(200, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.buildLocation(door.targetLocation, door.spawnGx, door.spawnGy);
            this._frozen = false;
            this.cameras.main.fadeIn(200, 0, 0, 0);
            this.updateDayNightTint();
            // Refresh HUD for new location name
            const hud = this.scene.get('MetaHUDScene');
            if (hud && hud.refreshStatusBar) hud.refreshStatusBar();
        });
    }

    handleInteraction() {
        if (this._interactCooldown) return;

        if (Phaser.Input.Keyboard.JustDown(this.interactKey) ||
            Phaser.Input.Keyboard.JustDown(this.spaceKey)) {

            const { fx, fy } = this.getFacingTile();
            const target = this.getInteractableAt(fx, fy);

            if (target) {
                this._interactCooldown = true;
                this.time.delayedCall(300, () => { this._interactCooldown = false; });

                if (target.type === 'npc') {
                    this.interactWithNPC(target.id);
                } else if (target.type === 'interactable') {
                    this.interactWithObject(target.data);
                }
            } else {
                // No target — pull out phone
                this._interactCooldown = true;
                this.time.delayedCall(500, () => { this._interactCooldown = false; });
                this.zoomIntoPhone();
            }
        }
    }

    updateProximityPrompt() {
        const hudScene = this.scene.get('MetaHUDScene');
        if (!hudScene) return;

        const { fx, fy } = this.getFacingTile();
        const target = this.getInteractableAt(fx, fy);

        // Update prompt text
        if (target) {
            if (target.type === 'npc') {
                const npcDef = getNPC(target.id);
                const tier = MetaState.getFriendshipTier(target.id);
                const tierIcons = { stranger: '', acquaintance: ' *', friend: ' **', close: ' ***' };
                const tierSuffix = tierIcons[tier] || '';
                hudScene.updatePrompt(`[E] Talk to ${npcDef ? npcDef.name : 'NPC'}${tierSuffix}`);
            } else if (target.type === 'interactable') {
                const labels = {
                    sleep: 'Sleep', study: 'Study', job: 'Job Board',
                    buy_coffee: 'Order', library_study: 'Study (Library)',
                    vending_machine: 'Vending Machine', couch_rest: 'Rest',
                    park_walk: 'Nature Walk', pick_flowers: 'Pick Flowers',
                    bulletin_board: 'Bulletin Board',
                };
                hudScene.updatePrompt(`[E] ${labels[target.data.action] || target.data.name}`);
            }
        } else {
            hudScene.updatePrompt('[E] Play Havenwood');
        }

        // Highlight the faced target
        const targetKey = target ? `${fx},${fy}` : null;
        if (targetKey !== this._lastHighlightKey) {
            // Remove old highlight
            if (this._highlightRect) {
                this._highlightRect.destroy();
                this._highlightRect = null;
            }
            this._lastHighlightKey = targetKey;

            if (target) {
                const hx = this.roomX + fx * TILE + TILE / 2;
                const hy = this.roomY + fy * TILE + TILE / 2;
                this._highlightRect = this.add.rectangle(hx, hy, TILE, TILE, 0xFFFFFF, 0.15)
                    .setDepth(4);
                // Pulse animation
                this.tweens.add({
                    targets: this._highlightRect,
                    alpha: 0.05,
                    duration: 600,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut',
                });
            }
        }
    }

    interactWithNPC(npcId) {
        const npcDef = getNPC(npcId);
        if (!npcDef) return;

        const dialogue = npcDef.getDialogue();
        const hudScene = this.scene.get('MetaHUDScene');

        MetaDialogue.show(hudScene, {
            speaker: dialogue.speaker,
            lines: dialogue.lines,
            choices: dialogue.choices,
            onChoice: (action) => {
                npcDef.handleAction(action, hudScene);
                // Check quests and friendship milestones after NPC interaction
                this.checkQuests();
                this._checkFriendshipMilestone(npcId, hudScene);
            },
        });
    }

    interactWithObject(ia) {
        const hudScene = this.scene.get('MetaHUDScene');

        if (ia.action === 'sleep') {
            this.doSleep(hudScene);
        } else if (ia.action === 'study') {
            this.doStudy(hudScene);
        } else if (ia.action === 'job') {
            this.doJob(hudScene);
        } else if (ia.action === 'buy_coffee') {
            this.doCafe(hudScene);
        } else if (ia.action === 'library_study') {
            this.doLibraryStudy(hudScene);
        } else if (ia.action === 'vending_machine') {
            this.doVendingMachine(hudScene);
        } else if (ia.action === 'couch_rest') {
            this.doCouchRest(hudScene);
        } else if (ia.action === 'park_walk') {
            this.doParkWalk(hudScene);
        } else if (ia.action === 'pick_flowers') {
            this.doPickFlowers(hudScene);
        } else if (ia.action === 'bulletin_board') {
            this.doBulletinBoard(hudScene);
        } else if (ia.action && ia.action.startsWith('evt_')) {
            MetaEvents.handleEventAction(ia.action, hudScene);
        }
    }

    doSleep(hudScene) {
        if (MetaState.state.timeOfDay < 1080) { // before 6 PM
            MetaDialogue.show(hudScene, {
                speaker: null,
                lines: ['It\'s still early...'],
                choices: [
                    { label: 'Sleep anyway', action: 'sleep' },
                    { label: 'Never mind', action: 'cancel' },
                ],
                onChoice: (action) => {
                    if (action === 'sleep') this.executeSleep();
                },
            });
        } else {
            this.executeSleep();
        }
    }

    executeSleep() {
        this._frozen = true;
        this.cameras.main.fadeOut(800, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            const hudScene = this.scene.get('MetaHUDScene');

            // Show alarm choice dialogue
            this.cameras.main.fadeIn(400, 0, 0, 0);
            MetaDialogue.show(hudScene, {
                speaker: null,
                lines: ['Morning! Your alarm is going off...'],
                choices: [
                    { label: 'Wake early (6 AM, 90 energy)', action: 'early' },
                    { label: 'Sleep in (9 AM, full energy)', action: 'sleepin' },
                ],
                onChoice: (action) => {
                    this._applyMorning(action === 'early' ? 'early' : 'sleepin', hudScene);
                },
            });
        });
    }

    _applyMorning(choice, hudScene) {
        MetaState.state.day++;
        MetaState.state.dayOfWeek = (MetaState.state.dayOfWeek + 1) % 7;
        MetaState.rollWeather();

        if (choice === 'early') {
            MetaState.state.timeOfDay = 360; // 6 AM
            MetaState.state.energy = 90;
        } else {
            MetaState.state.timeOfDay = 540; // 9 AM
            MetaState.state.energy = 100;
        }

        // Mood drift toward 50 overnight
        if (MetaState.state.mood > 50) MetaState.state.mood = Math.max(50, MetaState.state.mood - 5);
        else if (MetaState.state.mood < 50) MetaState.state.mood = Math.min(50, MetaState.state.mood + 5);

        // Apply friendship milestone daily passives
        const passives = MetaFriendshipMilestones.applyDailyPassives();

        // Roll daily campus event
        const evt = MetaEvents.rollDailyEvent(MetaState.state.day);

        // Roll morning micro-event
        const morningEvent = this.rollMorningEvent();

        MetaState.save();
        if (hudScene) hudScene.refreshStatusBar();

        // Rebuild location
        this.buildLocation(MetaState.state.currentLocation,
            MetaState.state.playerTileX, MetaState.state.playerTileY);

        this._frozen = false;
        this.updateDayNightTint();

        const dayLabel = MetaState.state.dayOfWeek >= 5 ? `${MetaState.getDayName()} (Weekend)` : MetaState.getDayName();
        const weatherLabel = MetaState.getWeatherLabel();
        if (hudScene) hudScene.showNotification(`Day ${MetaState.state.day} — ${dayLabel} — ${weatherLabel}`);

        let delay = 1500;
        if (evt && evt.name && hudScene) {
            this.time.delayedCall(delay, () => hudScene.showNotification(`Event: ${evt.name}!`));
            delay += 1500;
        }
        if (morningEvent && hudScene) {
            this.time.delayedCall(delay, () => hudScene.showNotification(morningEvent));
            delay += 1500;
        }
        for (const p of passives) {
            this.time.delayedCall(delay, () => { if (hudScene) hudScene.showNotification(p); });
            delay += 1200;
        }
    }

    rollMorningEvent() {
        const events = [
            { text: 'Found $10 in your pocket!', effect: () => MetaState.addMoney(10) },
            { text: 'Great sleep! +10 Energy', effect: () => MetaState.addEnergy(10) },
            { text: 'Morning sunshine! +5 Mood', effect: () => MetaState.addMood(5) },
            { text: 'Feeling inspired! +3 Knowledge', effect: () => MetaState.addKnowledge(3) },
            { text: 'Restless night... -5 Energy', effect: () => { MetaState.state.energy = Math.max(0, MetaState.state.energy - 5); } },
            null, null, null, null, // ~45% chance nothing happens
        ];
        const pick = events[Math.floor(Math.random() * events.length)];
        if (pick) {
            pick.effect();
            const hudScene = this.scene.get('MetaHUDScene');
            if (hudScene) hudScene.refreshStatusBar();
            return pick.text;
        }
        return null;
    }

    doStudy(hudScene) {
        const studied = MetaState.hasFlag(`study_day_${MetaState.state.day}`);
        if (studied) {
            MetaDialogue.show(hudScene, {
                speaker: null,
                lines: ['You\'ve already studied today.', 'Take a break!'],
            });
            return;
        }
        if (MetaState.state.energy < 10) {
            MetaDialogue.show(hudScene, {
                speaker: null,
                lines: ['Too tired to focus...'],
            });
            return;
        }

        const studyBonus = MetaEvents.isStudyBonusActive() ? 5 : 0;
        const totalKnow = 5 + studyBonus;
        const bonusNote = studyBonus > 0 ? ' (Midterm bonus!)' : '';
        MetaDialogue.show(hudScene, {
            speaker: null,
            lines: ['Textbooks on wildlife conservation...'],
            choices: [
                { label: 'Study (-10 energy, 30min)', action: 'study' },
                { label: 'Not now', action: 'cancel' },
            ],
            onChoice: (action) => {
                if (action !== 'study') return;
                MetaState.spendEnergy(10);
                MetaState.advanceTime(30);
                MetaState.addKnowledge(totalKnow);
                MetaState.addMood(2);
                MetaState.setFlag(`study_day_${MetaState.state.day}`);
                hudScene.refreshStatusBar();
                hudScene.showNotification(`+${totalKnow} Knowledge${bonusNote}`);
            },
        });
    }

    doCafe(hudScene) {
        const choices = [
            { label: 'Coffee ($5, +15 energy)', action: 'coffee' },
            { label: 'Meal ($10, +15 mood)', action: 'meal' },
        ];
        // Can buy a gift coffee if inventory not full
        if (MetaState.state.inventory.length < 8) {
            choices.push({ label: 'Gift Coffee ($5, for a friend)', action: 'buy_gift_coffee' });
        }
        choices.push({ label: 'Never mind', action: 'cancel' });

        MetaDialogue.show(hudScene, {
            speaker: null,
            lines: ['Campus Café — What would you like?'],
            choices,
            onChoice: (action) => {
                if (action === 'coffee') {
                    if (!MetaState.spendMoney(5)) {
                        hudScene.showNotification('Not enough money!');
                        return;
                    }
                    MetaState.addEnergy(15);
                    MetaState.addMood(5);
                    MetaState.advanceTime(15);
                    MetaState.setFlag('bought_coffee');
                    hudScene.refreshStatusBar();
                    hudScene.showNotification('+15 Energy — Coffee time!');
                    this.checkQuests();
                } else if (action === 'meal') {
                    if (!MetaState.spendMoney(10)) {
                        hudScene.showNotification('Not enough money!');
                        return;
                    }
                    MetaState.addEnergy(10);
                    MetaState.addMood(15);
                    MetaState.advanceTime(30);
                    MetaState.setFlag('bought_coffee');
                    hudScene.refreshStatusBar();
                    hudScene.showNotification('+15 Mood — Delicious!');
                    this.checkQuests();
                } else if (action === 'buy_gift_coffee') {
                    if (!MetaState.spendMoney(5)) {
                        hudScene.showNotification('Not enough money!');
                        return;
                    }
                    MetaState.addItem('coffee');
                    hudScene.refreshStatusBar();
                    hudScene.showNotification('Bought a coffee to give as a gift!');
                }
            },
        });
    }

    doLibraryStudy(hudScene) {
        MetaState.setFlag('visited_library');
        // Quest: lost textbook — flag library searched
        if (MetaState.isQuestActive('lost_textbook') && !MetaState.hasFlag('quest_lt_library')) {
            MetaState.setFlag('quest_lt_library');
            hudScene.showNotification('Found a textbook under the desk!');
        }
        // Quest: campus cleanup — count park visits
        if (MetaState.isQuestActive('book_donations') && MetaState.state.inventory.includes('book')) {
            MetaState.removeItem('book');
            MetaState.incrementQuestProgress('book_donations', 'books');
            hudScene.showNotification('Donated a book to the library!');
            this.checkQuests();
        }
        const studied = MetaState.hasFlag(`lib_study_day_${MetaState.state.day}`);
        if (studied) {
            MetaDialogue.show(hudScene, {
                speaker: null,
                lines: ['You\'ve studied enough for today.', 'Come back tomorrow!'],
            });
            return;
        }
        if (MetaState.state.energy < 15) {
            MetaDialogue.show(hudScene, {
                speaker: null,
                lines: ['Too tired to focus on these textbooks...'],
            });
            return;
        }

        const samBonus = MetaState.hasFlag('sam_study_spot') ? 4 : 0;
        const midtermBonus = MetaEvents.isStudyBonusActive() ? 5 : 0;
        const totalKnow = 12 + samBonus + midtermBonus;
        const notes = [];
        if (samBonus > 0) notes.push('Study spot bonus!');
        if (midtermBonus > 0) notes.push('Midterm bonus!');
        const bonusNote = notes.length > 0 ? ` (${notes.join(' ')})` : '';

        MetaDialogue.show(hudScene, {
            speaker: null,
            lines: ['The library has an excellent wildlife section...'],
            choices: [
                { label: 'Deep study (-15 energy, 1hr)', action: 'study' },
                { label: 'Not now', action: 'cancel' },
            ],
            onChoice: (action) => {
                if (action !== 'study') return;
                MetaState.spendEnergy(15);
                MetaState.advanceTime(60);
                MetaState.addKnowledge(totalKnow);
                MetaState.addMood(3);
                MetaState.setFlag(`lib_study_day_${MetaState.state.day}`);
                hudScene.refreshStatusBar();
                hudScene.showNotification(`+${totalKnow} Knowledge — Great session!${bonusNote}`);
            },
        });
    }

    // ── New Phase 5 Interactions ──

    doVendingMachine(hudScene) {
        const choices = [
            { label: 'Soda ($3, +10 energy)', action: 'soda' },
            { label: 'Snack ($3, +5 mood)', action: 'snack' },
        ];
        // Can buy gift treat if inventory not full
        if (MetaState.state.inventory.length < 8) {
            choices.push({ label: 'Treat Box ($5, gift item)', action: 'buy_treat' });
        }
        choices.push({ label: 'Never mind', action: 'cancel' });

        MetaDialogue.show(hudScene, {
            speaker: null,
            lines: ['The vending machine hums invitingly...'],
            choices,
            onChoice: (action) => {
                if (action === 'soda') {
                    if (!MetaState.spendMoney(3)) {
                        hudScene.showNotification('Not enough money!');
                        return;
                    }
                    MetaState.addEnergy(10);
                    MetaState.advanceTime(5);
                    hudScene.refreshStatusBar();
                    hudScene.showNotification('+10 Energy — Refreshing!');
                } else if (action === 'snack') {
                    if (!MetaState.spendMoney(3)) {
                        hudScene.showNotification('Not enough money!');
                        return;
                    }
                    MetaState.addMood(5);
                    MetaState.advanceTime(5);
                    hudScene.refreshStatusBar();
                    hudScene.showNotification('+5 Mood — Tasty snack!');
                } else if (action === 'buy_treat') {
                    if (!MetaState.spendMoney(5)) {
                        hudScene.showNotification('Not enough money!');
                        return;
                    }
                    MetaState.addItem('treat');
                    hudScene.refreshStatusBar();
                    hudScene.showNotification('Got a Treat Box — great for gifting!');
                }
            },
        });
    }

    doCouchRest(hudScene) {
        if (MetaState.state.energy >= 95) {
            MetaDialogue.show(hudScene, {
                speaker: null,
                lines: ['You\'re already well-rested!'],
            });
            return;
        }

        MetaDialogue.show(hudScene, {
            speaker: null,
            lines: ['A comfy couch... perfect for a quick rest.'],
            choices: [
                { label: 'Rest (20min, +15 energy)', action: 'rest' },
                { label: 'Not now', action: 'cancel' },
            ],
            onChoice: (action) => {
                if (action !== 'rest') return;
                MetaState.advanceTime(20);
                MetaState.addEnergy(15);
                MetaState.addMood(3);
                hudScene.refreshStatusBar();
                hudScene.showNotification('+15 Energy, +3 Mood — Nice nap!');
            },
        });
    }

    doParkWalk(hudScene) {
        const walkedToday = MetaState.hasFlag(`walk_day_${MetaState.state.day}`);
        if (walkedToday) {
            MetaDialogue.show(hudScene, {
                speaker: null,
                lines: ['You\'ve already taken a walk today.', 'The park will be here tomorrow!'],
            });
            return;
        }
        if (MetaState.state.energy < 10) {
            MetaDialogue.show(hudScene, {
                speaker: null,
                lines: ['Too tired for a walk right now...'],
            });
            return;
        }

        const weatherBonus = MetaState.state.weather === 'sunny' ? 5 : 0;
        const moodGain = 12 + weatherBonus;
        const weatherNote = weatherBonus > 0 ? ' (Sunny bonus!)' : '';

        MetaDialogue.show(hudScene, {
            speaker: null,
            lines: ['The park is peaceful...', 'A walk among the trees would be nice.'],
            choices: [
                { label: `Walk (-10 energy, 30min, +${moodGain} mood)`, action: 'walk' },
                { label: 'Not now', action: 'cancel' },
            ],
            onChoice: (action) => {
                if (action !== 'walk') return;
                MetaState.spendEnergy(10);
                MetaState.advanceTime(30);
                MetaState.addMood(moodGain);
                MetaState.addKnowledge(2);
                MetaState.setFlag(`walk_day_${MetaState.state.day}`);
                hudScene.refreshStatusBar();
                hudScene.showNotification(`+${moodGain} Mood, +2 Knowledge${weatherNote}`);
            },
        });
    }

    doPickFlowers(hudScene) {
        if (MetaState.state.inventory.length >= 8) {
            MetaDialogue.show(hudScene, {
                speaker: null,
                lines: ['Your inventory is full!', 'Use or gift some items first.'],
            });
            return;
        }

        const pickedToday = MetaState.hasFlag(`flowers_day_${MetaState.state.day}`);
        if (pickedToday) {
            MetaDialogue.show(hudScene, {
                speaker: null,
                lines: ['No more flowers to pick today.', 'Let them grow back!'],
            });
            return;
        }

        MetaDialogue.show(hudScene, {
            speaker: null,
            lines: ['Pretty wildflowers growing here...'],
            choices: [
                { label: 'Pick a flower (gift item)', action: 'pick' },
                { label: 'Leave them', action: 'cancel' },
            ],
            onChoice: (action) => {
                if (action !== 'pick') return;
                MetaState.addItem('flower');
                MetaState.addMood(3);
                MetaState.setFlag(`flowers_day_${MetaState.state.day}`);
                hudScene.refreshStatusBar();
                hudScene.showNotification('Picked a flower! +3 Mood');
            },
        });
    }

    // ── Pass Out ──

    _doPassOut() {
        if (this._frozen) return;
        this._frozen = true;
        const hudScene = this.scene.get('MetaHUDScene');
        if (hudScene) hudScene.showNotification('You passed out from exhaustion!');
        this.cameras.main.fadeOut(600, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            MetaState.passOut();
            MetaEvents.rollDailyEvent(MetaState.state.day);
            MetaFriendshipMilestones.applyDailyPassives();
            MetaState.save();
            if (hudScene) hudScene.refreshStatusBar();
            this.buildLocation(MetaState.state.currentLocation,
                MetaState.state.playerTileX, MetaState.state.playerTileY);
            this.cameras.main.fadeIn(800, 0, 0, 0);
            this._frozen = false;
            this.updateDayNightTint();
            if (hudScene) hudScene.showNotification(`Day ${MetaState.state.day} — Rough night... -10 Mood`);
        });
    }

    // ── Bulletin Board ──

    doBulletinBoard(hudScene) {
        const posts = MetaBulletinBoard.getContent(MetaState.state.day);
        const lines = [];
        let questPost = null;
        for (const post of posts) {
            lines.push(`[${post.title}]`);
            lines.push(post.body);
            lines.push('');
            if (post.type === 'quest' && post.questId) questPost = post;
        }
        // Remove trailing empty line
        if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();

        const choices = [];
        if (questPost) {
            choices.push({ label: `Accept: ${questPost.title}`, action: 'accept_quest' });
        }
        choices.push({ label: 'Walk away', action: 'cancel' });

        MetaDialogue.show(hudScene, {
            speaker: 'Bulletin Board',
            lines,
            choices,
            onChoice: (action) => {
                if (action === 'accept_quest' && questPost) {
                    MetaState.startQuest(questPost.questId);
                    hudScene.showNotification(`New Quest: ${questPost.title}`);
                }
            },
        });
    }

    // ── Job System (expanded) ──

    doJob(hudScene) {
        if (MetaJobs.hasWorkedToday()) {
            MetaDialogue.show(hudScene, {
                speaker: null,
                lines: ['You already worked a shift today.', 'Come back tomorrow.'],
            });
            return;
        }

        const available = MetaJobs.getAvailableJobs();
        const choices = available.map(job => {
            const mult = MetaState.getEnergyCostMultiplier();
            const eCost = job.energyCost * mult;
            const hrs = Math.floor(job.time / 60);
            const mins = job.time % 60;
            const timeLabel = hrs > 0 ? (mins > 0 ? `${hrs}h${mins}m` : `${hrs}h`) : `${mins}m`;
            return {
                label: `${job.name} (-${eCost} EN, ${timeLabel}, ~$${job.basePay})`,
                action: job.id,
            };
        });
        choices.push({ label: 'Not today', action: 'cancel' });

        const level = MetaJobs.getJobLevel();
        const levelLabel = level === 0 ? 'Basic' : level === 1 ? 'Intermediate' : 'Advanced';

        MetaDialogue.show(hudScene, {
            speaker: null,
            lines: [`Campus Job Board — Level: ${levelLabel}`, 'Pick a task:'],
            choices,
            onChoice: (action) => {
                if (action === 'cancel') return;
                const result = MetaJobs.doJob(action);
                if (!result) {
                    hudScene.showNotification('Not enough energy!');
                    return;
                }
                hudScene.refreshStatusBar();
                const bonusLabel = result.hasTanakaBonus ? ' (Tanaka bonus!)' : '';
                hudScene.showNotification(`+$${result.pay} — ${result.performance.label}${bonusLabel}`);
                this.checkQuests();

                // Check Tanaka friendship milestones
                this._checkFriendshipMilestone('shopkeeper', hudScene);
            },
        });
    }

    // ── Friendship Milestone Check ──

    _checkFriendshipMilestone(npcId, hudScene) {
        const val = MetaState.getFriendship(npcId);
        const milestone = MetaFriendshipMilestones.checkMilestones(npcId, val);
        if (milestone) {
            this.time.delayedCall(800, () => {
                MetaDialogue.show(hudScene, milestone.dialogue);
                hudScene.refreshStatusBar();
                this.time.delayedCall(500, () => {
                    hudScene.showNotification(milestone.notification);
                });
            });
        }
    }

    // ── Quest System ──

    checkQuests() {
        const hudScene = this.scene.get('MetaHUDScene');
        // Check for new quests
        const newQuests = MetaQuests.checkForNewQuests();
        for (const n of newQuests) {
            if (hudScene) hudScene.showNotification(n);
        }
        // Check for completions
        const completed = MetaQuests.checkForCompletions();
        for (const n of completed) {
            if (hudScene) hudScene.showNotification(n);
            if (hudScene) hudScene.refreshStatusBar();
        }
    }

    updateQuestChecks(delta) {
        this._questCheckAccum += delta;
        // Check quests every 2 seconds (not every frame)
        if (this._questCheckAccum >= 2000) {
            this._questCheckAccum = 0;
            this.checkQuests();
        }
    }

    // ── Pull out phone → switch to Havenwood ──

    zoomIntoPhone() {
        this._frozen = true;

        // Check cross-mode unlocks (meta -> havenwood)
        const gs = this.scene.get('GameScene');
        if (gs) {
            const notifications = MetaCrossModeUnlocks.checkAndApply('meta->havenwood', gs.state);
            const hudScene = this.scene.get('MetaHUDScene');
            for (const n of notifications) {
                if (hudScene) hudScene.showNotification(n);
            }

            // Apply consumable purchases
            if (MetaState.state.pendingFood > 0) {
                gs.state.food = (gs.state.food || 0) + MetaState.state.pendingFood;
                if (hudScene) hudScene.showNotification(`+${MetaState.state.pendingFood} Food delivered!`);
                MetaState.state.pendingFood = 0;
            }
            if (MetaState.state.pendingTreats > 0) {
                const count = MetaState.state.pendingTreats;
                if (gs.state.animals) {
                    for (const a of gs.state.animals) {
                        a.happiness = Math.min(100, (a.happiness || 50) + 10 * count);
                    }
                }
                if (hudScene) hudScene.showNotification(`Treats delivered! +${10 * count} Happiness`);
                MetaState.state.pendingTreats = 0;
            }
        }

        MetaState.save();

        // Record when we entered Havenwood so meta-time continues
        this._havenwoodEnteredAt = Date.now();

        // Show character holding phone briefly, then switch
        this.charDir = 'down';
        this.char.setTexture('char_phone');

        this.time.delayedCall(350, () => {
            this.char.setTexture('char_down');
            this.scene.sleep('MetaWorldScene');
            this.scene.sleep('MetaHUDScene');
            this.scene.wake('GameScene');
            this.scene.wake('HUDScene');
            const hudScene = this.scene.get('HUDScene');
            if (hudScene && hudScene.syncState) hudScene.syncState();
            this.scene.bringToTop('HUDScene');
        });
    }

    // ── Put away phone (called after arriving from Havenwood) ──

    playPutAwayPhone() {
        this._frozen = true;
        this.charDir = 'down';
        this.char.setTexture('char_phone');

        // Advance meta-time by real seconds spent in Havenwood (1 sec = 1 min)
        if (this._havenwoodEnteredAt) {
            const elapsedMs = Date.now() - this._havenwoodEnteredAt;
            const elapsedMin = Math.floor(elapsedMs / 1000);
            if (elapsedMin > 0) {
                MetaState.advanceTime(elapsedMin);
                this.game.events.emit('metaTimeUpdate');
            }
            this._havenwoodEnteredAt = null;
        }

        // Check cross-mode unlocks (havenwood -> meta)
        const gs = this.scene.get('GameScene');
        if (gs) {
            const notifications = MetaCrossModeUnlocks.checkAndApply('havenwood->meta', gs.state);
            const hudScene = this.scene.get('MetaHUDScene');
            for (const n of notifications) {
                if (hudScene) hudScene.showNotification(n);
            }

            // Snapshot Havenwood stats for NPC dialogue awareness
            MetaState.state.sanctuarySnapshot = {
                animalCount: (gs.state.animals || []).length,
                habitatCount: (gs.state.habitats || []).length,
                rep: gs.state.rep || 0,
                coins: gs.state.coins || 0,
            };

            // Show phone notifications from NPC visits
            const pending = MetaState.state.phoneNotifications;
            if (pending.length > 0) {
                for (const notif of pending) {
                    if (hudScene) hudScene.showNotification(notif.text);
                }
                MetaState.state.phoneNotifications = [];
            }
        }

        // Hold phone briefly, then put it away
        this.char.setTexture('char_phone');

        this.time.delayedCall(400, () => {
            this.char.setTexture('char_down');
            this._startWithPhone = false;
            this._frozen = false;
            this._interactCooldown = true;
            this.time.delayedCall(300, () => { this._interactCooldown = false; });
            // Refresh after time passed in Havenwood
            this.updateDayNightTint();
            this.refreshNPCs();
            const hud = this.scene.get('MetaHUDScene');
            if (hud) hud.refreshStatusBar();
        });
    }
}
