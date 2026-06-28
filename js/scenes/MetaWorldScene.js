// MetaWorldScene — The "real world" top-down scene where the character lives.
// Data-driven: loads room layout, furniture, NPCs, and interactables from MetaLocations.
// Supports door transitions between locations, proximity-based interaction,
// time progression, weather overlays, and cross-mode unlocks.
// Outdoor areas use a height-based zoom to fill the space between top/bottom HUD bars,
// with a grass-colored background. Edge columns on outdoor maps block walking to prevent
// going off-screen. Indoor rooms use a fixed 1.35x zoom centered in the canvas.

import { W, H, TILE, CLR } from '../GameData.js';
import { getLocation, findDoorTo, findFullPath } from '../MetaLocations.js';
import { getNPC, getNPCsAtLocation, getTransitioningNPCs, getAllTransitioningNPCs } from '../MetaNPCs.js';
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

// Shared furniture collision sizes — single source of truth for isWalkable() and _findTilePath().
// Types not listed here (rug, lamp, stool, flower) have no collision.
// Format: { w, h } in tiles. Default for unlisted solid furniture is 1×1.
const FURNITURE_SIZE = {
    desk: { w: 2, h: 1 },
    bench: { w: 2, h: 1 },
    counter: { w: 2, h: 1 },
    chalkboard: { w: 2, h: 1 },
    couch: { w: 2, h: 1 },
    bed: { w: 2, h: 3 },
    ping_pong_table: { w: 2, h: 3 },
    pond: { w: 2, h: 2 },
    fair_booth: { w: 2, h: 1 },
};
const NO_COLLIDE = new Set(['rug', 'lamp', 'stool', 'flower']);

// Returns { w, h } for a furniture type, or null if it has no collision.
function furnitureFootprint(type) {
    if (NO_COLLIDE.has(type)) return null;
    return FURNITURE_SIZE[type] || { w: 1, h: 1 };
}

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

        // Global NPC transit tracking (persists across room rebuilds)
        if (!this.game._npcTransits) this.game._npcTransits = {};

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

        // When waking from sleep (returning from Havenwood), hide NPC sprites immediately
        // so they don't render at stale positions before playPutAwayPhone() repositions them.
        this.events.on('wake', () => {
            for (const npc of (this.npcSprites || [])) {
                if (npc.sprite) npc.sprite.setAlpha(0);
            }
        });
    }

    // Build or rebuild a location without restarting the scene (preserves input)
    buildLocation(locationId, spawnGx, spawnGy) {
        // Save transit state for any departing/passing-through NPCs before destroying the room.
        // Uses wall-clock timestamp so re-entering a room doesn't cause position regression.
        for (const npc of (this.npcSprites || [])) {
            if (npc.transitionState === 'departing' && npc.departPath) {
                const idx = npc.departPathIndex;
                const prevLocId = idx > 0 ? npc.departPath[idx - 1] : null;
                const nextLocId = idx < npc.departPath.length - 1 ? npc.departPath[idx + 1] : null;
                const isFinal = idx === npc.departPath.length - 1;

                // Calculate how far the NPC has walked as a proportion of the room
                const entryDoor = prevLocId ? this.location.doors.find(d => d.targetLocation === prevLocId) : null;
                const entryX = entryDoor ? this.roomX + entryDoor.gx * TILE + TILE / 2 : npc.targetX;
                const entryY = entryDoor ? this.roomY + entryDoor.gy * TILE + TILE / 2 : npc.targetY;

                const totalDx = npc.targetX - entryX;
                const totalDy = npc.targetY - entryY;
                const totalDist = Math.sqrt(totalDx * totalDx + totalDy * totalDy);
                const traveledDx = npc.sprite.x - entryX;
                const traveledDy = npc.sprite.y - entryY;
                const traveledDist = Math.sqrt(traveledDx * traveledDx + traveledDy * traveledDy);
                const progress = totalDist > 0 ? Math.min(traveledDist / totalDist, 1) : 0;

                const roomTime = this._calcRoomTransitTime(
                    this.location.id, prevLocId, nextLocId,
                    isFinal ? npc.departDestGx : 0, isFinal ? npc.departDestGy : 0
                );

                this.game._npcTransits[npc.id] = {
                    path: npc.departPath,
                    pathIndex: idx,
                    destGx: npc.departDestGx,
                    destGy: npc.departDestGy,
                    _offScreenTimer: progress * roomTime,
                    _savedAt: Date.now(), // wall-clock anchor for monotonic progress
                };
            }
        }

        // Destroy old room objects
        for (const obj of (this._roomObjects || [])) {
            if (obj && obj.destroy) obj.destroy();
        }
        this._roomObjects = [];
        if (this._highlightSprite && this._highlightSprite.preFX && this._highlightGlow) {
            this._highlightSprite.preFX.remove(this._highlightGlow);
        }
        this._highlightSprite = null;
        this._highlightGlow = null;
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
            const topBar = window.__havenwoodMobileMode ? 0 : 42;
            const bottomBar = window.__havenwoodMobileMode ? 0 : 62;
            const parentH = this.game.scale.parentSize?.height || H;
            const zoom = (parentH - topBar - bottomBar + 2) / (this.location.rows * TILE);
            const mobileZoom = window.__havenwoodMobileMode
                ? Phaser.Math.Clamp(zoom * 1.35, 1.4, 2.4) : zoom;
            this.cameras.main.setZoom(mobileZoom);
            this.cameras.main.centerOn(W / 2, H / 2);
            const scrollY = H / 2 - H / (2 * zoom);
            const topWorldY = (window.__havenwoodMobileMode ? 0 : 42) / zoom + scrollY;
            this.roomX = Math.floor((W - this.location.cols * TILE) / 2);
            this.roomY = Math.round(topWorldY) - 1;
            this._bg.setFillStyle(0x4A8B4A);
        } else {
            const indoorZoom = window.__havenwoodMobileMode ? 1.75 : 1.35;
            this.cameras.main.setZoom(indoorZoom);
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
            } else if (f.type === 'ping_pong_table') {
                const ppt = this._track(this.add.image(px + 32, py + 48, 'furniture_ping_pong_table').setDepth(5));
                this.furnitureSprites.push(ppt);
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
                const jbSpr = this._track(this.add.image(px + TILE / 2, py + TILE / 2, 'furniture_job_board').setDepth(5));
                this.furnitureSprites.push(jbSpr);
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
                this.furnitureSprites.push(sprite);
            }
        }
    }

    placeNPCs() {
        this.npcSprites = [];
        this._activeNPCRefs = getNPCsAtLocation(this.location.id);
        const placedIds = new Set();

        // First, check for NPCs in transit that pass through or arrive at this room
        for (const [npcId, transit] of Object.entries(this.game._npcTransits || {})) {
            const { path, pathIndex, destGx, destGy } = transit;
            if (!path || pathIndex >= path.length) continue;
            const currentPathRoom = path[pathIndex];
            if (currentPathRoom !== this.location.id) continue;

            const npcDef = getNPC(npcId);
            if (!npcDef) continue;
            placedIds.add(npcId);

            // Find the door the NPC enters from (previous room in path)
            const prevRoom = pathIndex > 0 ? path[pathIndex - 1] : null;
            const entryDoor = prevRoom ? this.location.doors.find(d => d.targetLocation === prevRoom) : null;

            const isFinalRoom = pathIndex === path.length - 1;
            const nextRoom = !isFinalRoom ? path[pathIndex + 1] : null;

            // Entry position
            let entryGx, entryGy;
            if (entryDoor) {
                entryGx = entryDoor.gx; entryGy = entryDoor.gy;
            } else {
                const fb = this.location.doors[0];
                entryGx = fb ? fb.gx : 2; entryGy = fb ? fb.gy : 2;
            }

            // Exit/destination position
            let exitGx, exitGy;
            if (!isFinalRoom) {
                const exitDoor = findDoorTo(this.location.id, nextRoom);
                exitGx = exitDoor ? exitDoor.gx : entryGx;
                exitGy = exitDoor ? exitDoor.gy : entryGy;
            } else {
                exitGx = destGx; exitGy = destGy;
            }

            // Interpolate spawn position based on how far through this room the NPC has travelled
            const roomTime = this._calcRoomTransitTime(
                this.location.id, prevRoom, nextRoom,
                isFinalRoom ? destGx : 0, isFinalRoom ? destGy : 0
            );
            // Account for wall-clock time elapsed since transit was saved (prevents
            // NPC appearing to move backward when the player re-enters quickly).
            let timer = transit._offScreenTimer || 0;
            if (transit._savedAt) {
                timer += Date.now() - transit._savedAt;
                delete transit._savedAt; // consumed — don't double-count
            }
            transit._offScreenTimer = timer;
            const progress = Math.min(timer / roomTime, 1);
            const spawnGx = entryGx + (exitGx - entryGx) * progress;
            const spawnGy = entryGy + (exitGy - entryGy) * progress;
            const sx = this.roomX + spawnGx * TILE + TILE / 2;
            const sy = this.roomY + spawnGy * TILE + TILE / 2;

            const sprite = this._track(this.add.image(sx, sy, npcDef.spriteKey).setDepth(10).setAlpha(0));
            this.tweens.add({ targets: sprite, alpha: 1, duration: 300 });
            const startGx = Math.floor((sx - this.roomX) / TILE);
            const startGy = Math.floor((sy - this.roomY) / TILE);

            if (isFinalRoom) {
                // Arriving at destination — walk to target position
                delete this.game._npcTransits[npcId];
                this.npcSprites.push({
                    id: npcId, gx: startGx, gy: startGy,
                    homeGx: destGx, homeGy: destGy, sprite, def: npcDef,
                    targetX: this.roomX + destGx * TILE + TILE / 2,
                    targetY: this.roomY + destGy * TILE + TILE / 2,
                    walking: true, paused: false, wanderTimer: 0,
                    transitionState: 'arriving',
                });
                // Add to active refs if not already there
                if (!this._activeNPCRefs.some(r => r.id === npcId)) {
                    this._activeNPCRefs.push({ id: npcId, gx: startGx, gy: startGy });
                }
            } else {
                // Passing through — walk to the exit door leading to next room
                const tx = this.roomX + exitGx * TILE + TILE / 2;
                const ty = this.roomY + exitGy * TILE + TILE / 2;
                this.npcSprites.push({
                    id: npcId, gx: startGx, gy: startGy,
                    homeGx: startGx, homeGy: startGy, sprite, def: npcDef,
                    targetX: tx, targetY: ty,
                    walking: true, paused: false, wanderTimer: 0,
                    transitionState: 'departing',
                    departPath: path, departPathIndex: pathIndex,
                    departDestGx: destGx, departDestGy: destGy,
                });
                if (!this._activeNPCRefs.some(r => r.id === npcId)) {
                    this._activeNPCRefs.push({ id: npcId, gx: startGx, gy: startGy });
                }
            }
        }

        // Then place scheduled NPCs that aren't already placed from transit
        for (const npcRef of this._activeNPCRefs) {
            if (placedIds.has(npcRef.id)) continue;
            // Skip if this NPC is still traveling to this room — they'll be spawned
            // by _advanceOffScreenTransits or placeNPCs when their pathIndex arrives.
            if (this.game._npcTransits && this.game._npcTransits[npcRef.id]) continue;
            const npcDef = getNPC(npcRef.id);
            if (!npcDef) continue;

            const px = this.roomX + npcRef.gx * TILE + TILE / 2;
            const py = this.roomY + npcRef.gy * TILE + TILE / 2;
            const sprite = this._track(this.add.image(px, py, npcDef.spriteKey).setDepth(10));
            this.npcSprites.push({
                id: npcRef.id, gx: npcRef.gx, gy: npcRef.gy,
                homeGx: npcRef.gx, homeGy: npcRef.gy,
                sprite, def: npcDef,
                targetX: px, targetY: py,
                walking: false, paused: false,
                wanderTimer: 2000 + Math.random() * 3000,
            });
        }
    }

    // A* pathfinding on the tile grid. Returns array of {gx, gy} waypoints, or null if no path.
    _findTilePath(startGx, startGy, endGx, endGy) {
        const cols = this.location.cols, rows = this.location.rows;
        if (startGx === endGx && startGy === endGy) return [{ gx: endGx, gy: endGy }];
        if (endGx < 0 || endGx >= cols || endGy < 0 || endGy >= rows) return null;

        const key = (x, y) => x + y * cols;
        const open = [{ gx: startGx, gy: startGy, g: 0, f: 0 }];
        const gScore = new Map();
        const cameFrom = new Map();
        gScore.set(key(startGx, startGy), 0);
        open[0].f = Math.abs(endGx - startGx) + Math.abs(endGy - startGy);

        const dirs = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]];

        while (open.length > 0) {
            // Find lowest f
            let bestIdx = 0;
            for (let i = 1; i < open.length; i++) {
                if (open[i].f < open[bestIdx].f) bestIdx = i;
            }
            const cur = open.splice(bestIdx, 1)[0];

            if (cur.gx === endGx && cur.gy === endGy) {
                // Reconstruct path
                const path = [];
                let k = key(endGx, endGy);
                while (k !== undefined) {
                    const gy = Math.floor(k / cols), gx = k % cols;
                    path.unshift({ gx, gy });
                    k = cameFrom.get(k);
                }
                return path;
            }

            for (const [ddx, ddy] of dirs) {
                const nx = cur.gx + ddx, ny = cur.gy + ddy;
                if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;

                // Check walkability using tile type (same rules as isWalkable)
                const tile = this.location.tileMap[ny][nx];
                if (tile === 1 || tile === 2 || tile === 5) continue;
                // Allow doors (tile 9) — NPCs need to walk through them
                // Check furniture collision (uses shared FURNITURE_SIZE)
                let blocked = false;
                for (const f of this.location.furniture) {
                    const fp = furnitureFootprint(f.type);
                    if (!fp) continue;
                    if (nx >= f.gx && nx < f.gx + fp.w && ny >= f.gy && ny < f.gy + fp.h) { blocked = true; break; }
                }
                if (blocked) continue;
                // Check interactable collision (job board, bulletin board)
                for (const ia of this.location.interactables) {
                    if ((ia.action === 'job' || ia.action === 'bulletin_board') &&
                        nx >= ia.gx && nx < ia.gx + (ia.w || 1) && ny >= ia.gy && ny < ia.gy + (ia.h || 1)) {
                        blocked = true; break;
                    }
                }
                if (blocked) continue;
                // Check event furniture collision
                for (const ef of MetaEvents.getEventFurniture(this.location.id)) {
                    const efp = furnitureFootprint(ef.type) || { w: 1, h: 1 };
                    if (nx >= ef.gx && nx < ef.gx + efp.w && ny >= ef.gy && ny < ef.gy + efp.h) { blocked = true; break; }
                }
                if (blocked) continue;

                // Prevent diagonal corner-cutting: both adjacent cardinal tiles must be open
                if (ddx !== 0 && ddy !== 0) {
                    const t1 = this.location.tileMap[cur.gy][nx];
                    const t2 = this.location.tileMap[ny][cur.gx];
                    if (t1 === 1 || t1 === 2 || t1 === 5 || t2 === 1 || t2 === 2 || t2 === 5) continue;
                }

                const moveCost = (ddx !== 0 && ddy !== 0) ? 1.41 : 1;
                const tentG = cur.g + moveCost;
                const nk = key(nx, ny);
                if (tentG < (gScore.get(nk) ?? Infinity)) {
                    gScore.set(nk, tentG);
                    cameFrom.set(nk, key(cur.gx, cur.gy));
                    const h = Math.abs(endGx - nx) + Math.abs(endGy - ny);
                    open.push({ gx: nx, gy: ny, g: tentG, f: tentG + h });
                }
            }
        }
        return null; // no path found
    }

    // Set an NPC to follow a tile path to a world-space target.
    // Computes A* path and stores waypoints on the NPC.
    _setNPCPath(npc, targetWorldX, targetWorldY) {
        const startGx = Math.floor((npc.sprite.x - this.roomX) / TILE);
        const startGy = Math.floor((npc.sprite.y - this.roomY) / TILE);
        const endGx = Math.floor((targetWorldX - this.roomX) / TILE);
        const endGy = Math.floor((targetWorldY - this.roomY) / TILE);

        const tilePath = this._findTilePath(startGx, startGy, endGx, endGy);
        if (tilePath && tilePath.length > 1) {
            // Convert to world-space waypoints (skip the first since that's where we are)
            npc._waypoints = tilePath.slice(1).map(p => ({
                x: this.roomX + p.gx * TILE + TILE / 2,
                y: this.roomY + p.gy * TILE + TILE / 2,
            }));
            // Set immediate target to first waypoint
            npc.targetX = npc._waypoints[0].x;
            npc.targetY = npc._waypoints[0].y;
            npc.walking = true;
        } else {
            // A* failed or start === end — stop walking to avoid clipping through walls.
            if (npc.transitionState === 'departing') {
                // Departing NPC can't find path to door — force the transit to avoid getting stuck.
                // Create the transit record as if they reached the door, then fade out.
                npc._waypoints = null;
                npc._pathComputed = false;
                npc.walking = false;
                if (npc.departPath && npc.departPathIndex < npc.departPath.length - 1) {
                    this.game._npcTransits[npc.id] = {
                        path: npc.departPath,
                        pathIndex: npc.departPathIndex + 1,
                        destGx: npc.departDestGx,
                        destGy: npc.departDestGy,
                    };
                }
                this.tweens.add({
                    targets: npc.sprite, alpha: 0, duration: 400,
                    onComplete: () => {
                        const idx2 = this._roomObjects.indexOf(npc.sprite);
                        if (idx2 >= 0) this._roomObjects.splice(idx2, 1);
                        npc.sprite.destroy();
                        const si = this.npcSprites.indexOf(npc);
                        if (si >= 0) this.npcSprites.splice(si, 1);
                        const ri = this._activeNPCRefs.findIndex(r => r.id === npc.id);
                        if (ri >= 0) this._activeNPCRefs.splice(ri, 1);
                    }
                });
            } else {
                // Normal wander — reset target and allow retry after a delay.
                npc._waypoints = null;
                npc._pathComputed = false;
                npc.walking = false;
                npc.targetX = npc.sprite.x;
                npc.targetY = npc.sprite.y;
                npc.wanderTimer = 1000 + Math.random() * 2000;
            }
        }
    }

    // Update NPC movement each frame (wandering + transitions)
    updateNPCs(delta) {
        const NPC_WANDER_SPEED = 40;
        const NPC_TRANSITION_SPEED = 60;

        for (let i = this.npcSprites.length - 1; i >= 0; i--) {
            const npc = this.npcSprites[i];
            if (npc.paused) continue;

            // Initialize walk animation state
            if (npc.walkTimer === undefined) {
                npc.walkTimer = 0;
                npc.walkFrame = 0;
                npc.facing = npc.def?.facing || 'down';
            }

            const isTransitioning = npc.transitionState === 'departing' || npc.transitionState === 'arriving';
            const speed = (isTransitioning ? NPC_TRANSITION_SPEED : NPC_WANDER_SPEED) * (delta / 1000);

            if (npc.walking) {
                // Compute A* path if walking but no waypoints computed yet
                if (!npc._waypoints && !npc._pathComputed) {
                    npc._pathComputed = true;
                    this._setNPCPath(npc, npc.targetX, npc.targetY);
                }

                const dx = npc.targetX - npc.sprite.x;
                const dy = npc.targetY - npc.sprite.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                // Update facing direction from movement vector
                if (dist > 1) {
                    if (Math.abs(dy) >= Math.abs(dx)) npc.facing = dy < 0 ? 'up' : 'down';
                    else npc.facing = dx < 0 ? 'left' : 'right';
                }

                if (dist < 2) {
                    npc.sprite.x = npc.targetX;
                    npc.sprite.y = npc.targetY;

                    // Update grid position
                    npc.gx = Math.floor((npc.sprite.x - this.roomX) / TILE);
                    npc.gy = Math.floor((npc.sprite.y - this.roomY) / TILE);
                    const ref = this._activeNPCRefs.find(r => r.id === npc.id);
                    if (ref) { ref.gx = npc.gx; ref.gy = npc.gy; }

                    // Advance to next waypoint if path has more
                    if (npc._waypoints && npc._waypoints.length > 0) {
                        npc._waypoints.shift();
                        if (npc._waypoints.length > 0) {
                            npc.targetX = npc._waypoints[0].x;
                            npc.targetY = npc._waypoints[0].y;
                            continue; // keep walking
                        }
                    }
                    npc._waypoints = null;
                    npc._pathComputed = false;
                    npc.walking = false;

                    if (npc.transitionState === 'departing') {
                        // Reached exit door — record transit and fade out
                        if (npc.departPath && npc.departPathIndex < npc.departPath.length - 1) {
                            // Advance to next room in path
                            this.game._npcTransits[npc.id] = {
                                path: npc.departPath,
                                pathIndex: npc.departPathIndex + 1,
                                destGx: npc.departDestGx,
                                destGy: npc.departDestGy,
                            };
                        }
                        this.tweens.add({
                            targets: npc.sprite, alpha: 0, duration: 200,
                            onComplete: () => {
                                const idx2 = this._roomObjects.indexOf(npc.sprite);
                                if (idx2 >= 0) this._roomObjects.splice(idx2, 1);
                                npc.sprite.destroy();
                                const si = this.npcSprites.indexOf(npc);
                                if (si >= 0) this.npcSprites.splice(si, 1);
                                const ri = this._activeNPCRefs.findIndex(r => r.id === npc.id);
                                if (ri >= 0) this._activeNPCRefs.splice(ri, 1);
                            }
                        });
                        continue;
                    } else if (npc.transitionState === 'arriving') {
                        // Reached destination — switch to normal wandering
                        npc.transitionState = null;
                        npc.homeGx = npc.gx;
                        npc.homeGy = npc.gy;
                        npc.wanderTimer = 2000 + Math.random() * 4000;
                    } else {
                        npc.wanderTimer = 2000 + Math.random() * 4000;
                    }
                } else {
                    npc.sprite.x += (dx / dist) * speed;
                    npc.sprite.y += (dy / dist) * speed;
                    npc.gx = Math.floor((npc.sprite.x - this.roomX) / TILE);
                    npc.gy = Math.floor((npc.sprite.y - this.roomY) / TILE);
                    const ref = this._activeNPCRefs.find(r => r.id === npc.id);
                    if (ref) { ref.gx = npc.gx; ref.gy = npc.gy; }

                    // Walk animation
                    npc.walkTimer += delta;
                    if (npc.walkTimer > 200) {
                        npc.walkTimer = 0;
                        npc.walkFrame = (npc.walkFrame + 1) % 2;
                    }
                    const wk = `${npc.def.spriteKey}_${npc.facing}_walk${npc.walkFrame + 1}`;
                    if (this.textures.exists(wk)) npc.sprite.setTexture(wk);
                }
            } else if (!isTransitioning) {
                // Set idle texture for current facing direction
                const ik = npc.facing === 'down' ? npc.def.spriteKey : `${npc.def.spriteKey}_${npc.facing}`;
                if (this.textures.exists(ik)) npc.sprite.setTexture(ik);
                npc.walkTimer = 0;
                npc.walkFrame = 0;
                // Normal wander countdown
                npc.wanderTimer -= delta;
                if (npc.wanderTimer <= 0) {
                    const attempts = 8;
                    for (let j = 0; j < attempts; j++) {
                        const ox = npc.homeGx + Math.floor(Math.random() * 7) - 3;
                        const oy = npc.homeGy + Math.floor(Math.random() * 7) - 3;
                        if (ox < 1 || ox >= this.location.cols - 1 || oy < 1 || oy >= this.location.rows - 1) continue;
                        const wx = this.roomX + ox * TILE + TILE / 2;
                        const wy = this.roomY + oy * TILE + TILE / 2;
                        if (this.isWalkable(wx, wy - 6)) {
                            npc.targetX = wx;
                            npc.targetY = wy;
                            npc.walking = true;
                            npc._pathComputed = false;
                            break;
                        }
                    }
                    if (!npc.walking) {
                        npc.wanderTimer = 1000 + Math.random() * 2000;
                    }
                }
            }
        }
    }

    // Check for NPC schedule transitions (called from updateTime)
    _checkNPCTransitions(prevTime, currTime) {
        const s = MetaState.state;
        const { departing } = getTransitioningNPCs(
            this.location.id, prevTime, currTime, s.dayOfWeek, s.weather
        );

        // Handle departing NPCs — walk to exit door
        for (const dep of departing) {
            const npc = this.npcSprites.find(n => n.id === dep.id);
            if (!npc || npc.transitionState || npc.paused) {
                if (npc && npc.paused) npc.pendingTransition = dep;
                continue;
            }
            if (!dep.targetLocation) continue;
            const fullPath = findFullPath(this.location.id, dep.targetLocation);
            if (!fullPath || fullPath.length < 2) continue;
            const door = findDoorTo(this.location.id, fullPath[1]);
            if (!door) continue;
            npc.transitionState = 'departing';
            npc.departPath = fullPath;
            npc.departPathIndex = 0; // currently in first room
            npc.departDestGx = dep.targetGx;
            npc.departDestGy = dep.targetGy;
            npc.targetX = this.roomX + door.gx * TILE + TILE / 2;
            npc.targetY = this.roomY + door.gy * TILE + TILE / 2;
            npc.walking = true;
        }

        // Create transit records for ALL NPCs changing rooms (including ones arriving here).
        // NPCs departing the current room are handled above with walk animations;
        // all others get immediate transit records so they travel through the path.
        const allTransitions = getAllTransitioningNPCs(prevTime, currTime, s.dayOfWeek, s.weather);
        for (const t of allTransitions) {
            if (this.game._npcTransits[t.id]) continue; // already in transit
            // Skip if this NPC is already being handled locally (departing from current room)
            if (t.fromLocation === this.location.id && this.npcSprites.some(n => n.id === t.id && n.transitionState === 'departing')) continue;
            const fullPath = findFullPath(t.fromLocation, t.toLocation);
            if (!fullPath || fullPath.length < 2) continue;
            // Start from the room after their origin (they leave off-screen instantly).
            // If the origin is the player's room, they're handled by the departing loop above,
            // so pathIndex 1 is always the first off-screen room.
            this.game._npcTransits[t.id] = {
                path: fullPath,
                pathIndex: Math.min(1, fullPath.length - 1),
                destGx: t.destGx,
                destGy: t.destGy,
            };
        }
    }

    // Returns the time in ms it takes an NPC to cross a room, based on entry→exit tile distance.
    // Uses NPC_TRANSITION_SPEED (60 px/s) to match actual on-screen walking speed.
    _calcRoomTransitTime(locId, prevLocId, nextLocId, destGx, destGy) {
        const NPC_TRANSITION_SPEED = 60; // px/s — must match updateNPCs
        const loc = getLocation(locId);
        if (!loc) return 4000;

        // Entry position: door from the previous room
        let entryGx, entryGy;
        const entryDoor = prevLocId ? loc.doors.find(d => d.targetLocation === prevLocId) : null;
        if (entryDoor) {
            entryGx = entryDoor.gx; entryGy = entryDoor.gy;
        } else {
            const fb = loc.doors[0];
            entryGx = fb ? fb.gx : 1; entryGy = fb ? fb.gy : 1;
        }

        // Exit position: door toward next room, or the schedule destination if this is the final room
        let exitGx, exitGy;
        if (nextLocId) {
            const exitDoor = findDoorTo(locId, nextLocId);
            exitGx = exitDoor ? exitDoor.gx : entryGx;
            exitGy = exitDoor ? exitDoor.gy : entryGy;
        } else {
            exitGx = destGx; exitGy = destGy;
        }

        const dx = (exitGx - entryGx) * TILE;
        const dy = (exitGy - entryGy) * TILE;
        const dist = Math.sqrt(dx * dx + dy * dy);
        return Math.max(500, (dist / NPC_TRANSITION_SPEED) * 1000);
    }

    // Advance transit records for NPCs in rooms the player isn't in.
    // Transit time per room is calculated from actual tile distances rather than a fixed 4 seconds.
    _advanceOffScreenTransits(delta) {
        for (const [npcId, transit] of Object.entries(this.game._npcTransits || {})) {
            if (!transit.path || transit.pathIndex >= transit.path.length) {
                delete this.game._npcTransits[npcId];
                continue;
            }
            // Skip if NPC is in the current room (being managed by updateNPCs)
            if (transit.path[transit.pathIndex] === this.location.id) continue;
            // Skip if NPC is already rendered as a sprite here
            if (this.npcSprites.some(n => n.id === npcId)) continue;

            const locId = transit.path[transit.pathIndex];
            const prevLocId = transit.pathIndex > 0 ? transit.path[transit.pathIndex - 1] : null;
            const nextLocId = transit.pathIndex < transit.path.length - 1 ? transit.path[transit.pathIndex + 1] : null;
            const isFinal = transit.pathIndex === transit.path.length - 1;
            const roomTime = this._calcRoomTransitTime(
                locId, prevLocId, nextLocId,
                isFinal ? transit.destGx : 0, isFinal ? transit.destGy : 0
            );

            transit._offScreenTimer = (transit._offScreenTimer || 0) + delta;
            if (transit._offScreenTimer >= roomTime) {
                transit._offScreenTimer -= roomTime; // carry remainder into next room
                transit.pathIndex++;
                if (transit.pathIndex >= transit.path.length) {
                    // NPC has left the final room off-screen — transit fully done.
                    delete this.game._npcTransits[npcId];
                } else if (transit.path[transit.pathIndex] === this.location.id) {
                    // NPC just entered the player's current room.
                    const isFinalRoom = transit.pathIndex === transit.path.length - 1;
                    if (isFinalRoom) {
                        // This is their destination — walk from entry door to schedule spot.
                        // Delete transit BEFORE spawning to prevent double-spawn from placeNPCs/syncPresence.
                        delete this.game._npcTransits[npcId];
                        this._spawnArrivingNPC(npcId, transit);
                    } else {
                        // Just passing through — walk from entry door to exit door.
                        this._spawnPassingNPC(npcId, transit);
                    }
                }
            }
        }
    }

    // Spawn an NPC that just arrived at their final destination (the player's room).
    // They appear at the entry door and walk to their schedule position.
    _spawnArrivingNPC(npcId, transit) {
        if (this.npcSprites.some(n => n.id === npcId)) return;
        const npcDef = getNPC(npcId);
        if (!npcDef) return;

        const prevRoom = transit.path.length >= 2 ? transit.path[transit.path.length - 2] : null;
        const entryDoor = prevRoom ? this.location.doors.find(d => d.targetLocation === prevRoom) : this.location.doors[0];
        const spawnGx = entryDoor ? entryDoor.gx : 1;
        const spawnGy = entryDoor ? entryDoor.gy : 1;
        const sx = this.roomX + spawnGx * TILE + TILE / 2;
        const sy = this.roomY + spawnGy * TILE + TILE / 2;

        const sprite = this._track(this.add.image(sx, sy, npcDef.spriteKey).setDepth(10).setAlpha(0));
        this.tweens.add({ targets: sprite, alpha: 1, duration: 300 });

        this.npcSprites.push({
            id: npcId, gx: spawnGx, gy: spawnGy,
            homeGx: transit.destGx, homeGy: transit.destGy, sprite, def: npcDef,
            targetX: this.roomX + transit.destGx * TILE + TILE / 2,
            targetY: this.roomY + transit.destGy * TILE + TILE / 2,
            walking: true, paused: false, wanderTimer: 0,
            transitionState: 'arriving',
        });
        if (!this._activeNPCRefs.some(r => r.id === npcId)) {
            this._activeNPCRefs.push({ id: npcId, gx: spawnGx, gy: spawnGy });
        }
    }

    // Spawn an NPC that is passing through the player's room en route elsewhere.
    // They appear at the entry door and walk toward the exit door.
    _spawnPassingNPC(npcId, transit) {
        if (this.npcSprites.some(n => n.id === npcId)) return;
        const npcDef = getNPC(npcId);
        if (!npcDef) return;

        const idx = transit.pathIndex;
        const prevRoom = idx > 0 ? transit.path[idx - 1] : null;
        const nextRoom = idx < transit.path.length - 1 ? transit.path[idx + 1] : null;

        const entryDoor = prevRoom ? this.location.doors.find(d => d.targetLocation === prevRoom) : this.location.doors[0];
        const exitDoor = nextRoom ? findDoorTo(this.location.id, nextRoom) : null;
        const spawnGx = entryDoor ? entryDoor.gx : 1;
        const spawnGy = entryDoor ? entryDoor.gy : 1;
        const exitGx = exitDoor ? exitDoor.gx : spawnGx;
        const exitGy = exitDoor ? exitDoor.gy : spawnGy;

        const sx = this.roomX + spawnGx * TILE + TILE / 2;
        const sy = this.roomY + spawnGy * TILE + TILE / 2;

        const sprite = this._track(this.add.image(sx, sy, npcDef.spriteKey).setDepth(10).setAlpha(0));
        this.tweens.add({ targets: sprite, alpha: 1, duration: 300 });

        this.npcSprites.push({
            id: npcId, gx: spawnGx, gy: spawnGy,
            homeGx: spawnGx, homeGy: spawnGy, sprite, def: npcDef,
            targetX: this.roomX + exitGx * TILE + TILE / 2,
            targetY: this.roomY + exitGy * TILE + TILE / 2,
            walking: true, paused: false, wanderTimer: 0,
            transitionState: 'departing',
            departPath: transit.path, departPathIndex: idx,
            departDestGx: transit.destGx, departDestGy: transit.destGy,
        });
        if (!this._activeNPCRefs.some(r => r.id === npcId)) {
            this._activeNPCRefs.push({ id: npcId, gx: spawnGx, gy: spawnGy });
        }
        // Remove from global transit — now managed by updateNPCs
        delete this.game._npcTransits[npcId];
    }

    // Periodic check: ensure NPCs in the room match the current schedule.
    // Catches missed transitions (e.g. player entered after a boundary, or tick was skipped).
    _syncNPCPresence(delta) {
        this._npcSyncAccum = (this._npcSyncAccum || 0) + delta;
        if (this._npcSyncAccum < 3000) return; // check every 3 seconds
        this._npcSyncAccum = 0;

        const expected = getNPCsAtLocation(this.location.id);
        const expectedIds = new Set(expected.map(e => e.id));

        // NPCs that are here but shouldn't be — trigger departure
        for (const npc of this.npcSprites) {
            // If NPC is departing but got stuck (walking stopped, no waypoints), restart departure
            if (npc.transitionState === 'departing' && !npc.walking && !npc.paused) {
                npc.walking = true;
                npc._pathComputed = false;
                npc._waypoints = null;
            }
            if (npc.transitionState) continue; // already transitioning / passing through
            if (!expectedIds.has(npc.id)) {
                // Look up their actual current schedule entry (including destination coords)
                const npcDef = getNPC(npc.id);
                const s = MetaState.state;
                let targetLoc = null, targetGx = 0, targetGy = 0;
                if (npcDef && npcDef.schedule) {
                    for (const slot of npcDef.schedule) {
                        if (slot.days && slot.days.includes(s.dayOfWeek) && s.timeOfDay >= slot.start && s.timeOfDay < slot.end) {
                            targetLoc = slot.location;
                            targetGx = slot.gx;
                            targetGy = slot.gy;
                            break;
                        }
                    }
                }
                if (npc.paused) {
                    // Store full destination so resumeNPC can depart correctly after interaction ends
                    npc.pendingTransition = { targetLocation: targetLoc, destGx: targetGx, destGy: targetGy };
                    continue;
                }
                if (targetLoc && targetLoc !== this.location.id) {
                    const fullPath = findFullPath(this.location.id, targetLoc);
                    if (fullPath && fullPath.length >= 2) {
                        const door = findDoorTo(this.location.id, fullPath[1]);
                        if (door) {
                            npc.transitionState = 'departing';
                            npc.departPath = fullPath;
                            npc.departPathIndex = 0;
                            npc.departDestGx = targetGx;
                            npc.departDestGy = targetGy;
                            npc.targetX = this.roomX + door.gx * TILE + TILE / 2;
                            npc.targetY = this.roomY + door.gy * TILE + TILE / 2;
                            npc.walking = true;
                            continue;
                        }
                    }
                }
                // No scheduled location (off-duty) — fade out and remove
                npc.walking = false;
                this.tweens.add({
                    targets: npc.sprite, alpha: 0, duration: 500,
                    onComplete: () => {
                        const idx2 = this._roomObjects.indexOf(npc.sprite);
                        if (idx2 >= 0) this._roomObjects.splice(idx2, 1);
                        npc.sprite.destroy();
                        const si = this.npcSprites.indexOf(npc);
                        if (si >= 0) this.npcSprites.splice(si, 1);
                        const ri = this._activeNPCRefs.findIndex(r => r.id === npc.id);
                        if (ri >= 0) this._activeNPCRefs.splice(ri, 1);
                    }
                });
            }
        }

        // NPCs that should be here but aren't (and not in transit) — trigger arrival
        for (const exp of expected) {
            if (this.npcSprites.some(n => n.id === exp.id)) continue;
            if (this.game._npcTransits && this.game._npcTransits[exp.id]) continue; // in transit
            const npcDef = getNPC(exp.id);
            if (!npcDef) continue;

            const spawnDoor = this.location.doors[0];
            if (spawnDoor) {
                const sx = this.roomX + spawnDoor.gx * TILE + TILE / 2;
                const sy = this.roomY + spawnDoor.gy * TILE + TILE / 2;
                const sprite = this._track(this.add.image(sx, sy, npcDef.spriteKey).setDepth(10).setAlpha(0));
                this.tweens.add({ targets: sprite, alpha: 1, duration: 300 });
                this.npcSprites.push({
                    id: exp.id, gx: spawnDoor.gx, gy: spawnDoor.gy,
                    homeGx: exp.gx, homeGy: exp.gy, sprite, def: npcDef,
                    targetX: this.roomX + exp.gx * TILE + TILE / 2,
                    targetY: this.roomY + exp.gy * TILE + TILE / 2,
                    walking: true, paused: false, wanderTimer: 0,
                    transitionState: 'arriving',
                });
                this._activeNPCRefs.push({ id: exp.id, gx: spawnDoor.gx, gy: spawnDoor.gy });
            }
        }

        // Check for transiting NPCs whose current path step is THIS room
        for (const [npcId, transit] of Object.entries(this.game._npcTransits || {})) {
            const { path, pathIndex, destGx, destGy } = transit;
            if (!path || pathIndex >= path.length) continue;
            if (path[pathIndex] !== this.location.id) continue;
            if (this.npcSprites.some(n => n.id === npcId)) continue; // already spawned

            const npcDef = getNPC(npcId);
            if (!npcDef) continue;

            const prevRoom = pathIndex > 0 ? path[pathIndex - 1] : null;
            const entryDoor = prevRoom ? this.location.doors.find(d => d.targetLocation === prevRoom) : null;
            const isFinalRoom = pathIndex === path.length - 1;

            let sx, sy;
            if (entryDoor) {
                sx = this.roomX + entryDoor.gx * TILE + TILE / 2;
                sy = this.roomY + entryDoor.gy * TILE + TILE / 2;
            } else {
                const fb = this.location.doors[0];
                sx = fb ? this.roomX + fb.gx * TILE + TILE / 2 : this.roomX + TILE * 2;
                sy = fb ? this.roomY + fb.gy * TILE + TILE / 2 : this.roomY + TILE * 2;
            }

            const sprite = this._track(this.add.image(sx, sy, npcDef.spriteKey).setDepth(10).setAlpha(0));
            this.tweens.add({ targets: sprite, alpha: 1, duration: 300 });
            const startGx = Math.floor((sx - this.roomX) / TILE);
            const startGy = Math.floor((sy - this.roomY) / TILE);

            if (isFinalRoom) {
                delete this.game._npcTransits[npcId];
                this.npcSprites.push({
                    id: npcId, gx: startGx, gy: startGy,
                    homeGx: destGx, homeGy: destGy, sprite, def: npcDef,
                    targetX: this.roomX + destGx * TILE + TILE / 2,
                    targetY: this.roomY + destGy * TILE + TILE / 2,
                    walking: true, paused: false, wanderTimer: 0,
                    transitionState: 'arriving',
                });
            } else {
                const nextRoom = path[pathIndex + 1];
                const exitDoor = findDoorTo(this.location.id, nextRoom);
                const tx = exitDoor ? this.roomX + exitDoor.gx * TILE + TILE / 2 : sx;
                const ty = exitDoor ? this.roomY + exitDoor.gy * TILE + TILE / 2 : sy;
                this.npcSprites.push({
                    id: npcId, gx: startGx, gy: startGy,
                    homeGx: startGx, homeGy: startGy, sprite, def: npcDef,
                    targetX: tx, targetY: ty,
                    walking: true, paused: false, wanderTimer: 0,
                    transitionState: 'departing',
                    departPath: path, departPathIndex: pathIndex,
                    departDestGx: destGx, departDestGy: destGy,
                });
                // Remove from global transits since we're now managing it locally
                delete this.game._npcTransits[npcId];
            }
            if (!this._activeNPCRefs.some(r => r.id === npcId)) {
                this._activeNPCRefs.push({ id: npcId, gx: startGx, gy: startGy });
            }
        }
    }

    // Stop an NPC from walking (e.g. when player talks to them)
    pauseNPC(npcId) {
        const npc = this.npcSprites.find(n => n.id === npcId);
        if (npc) {
            npc.paused = true;
            npc._wasTransitioning = npc.transitionState || null;
            npc.transitionState = null;
            npc.walking = false;
            npc._waypoints = null;
            npc._pathComputed = false;
        }
    }

    // Resume NPC wandering (and process any pending transition)
    resumeNPC(npcId) {
        const npc = this.npcSprites.find(n => n.id === npcId);
        if (!npc) return;
        npc.paused = false;

        // Determine where the NPC should be right now according to their schedule.
        // This catches cases where time advanced during dialogue (e.g. hangout/class)
        // and the NPC's scheduled location changed while they were paused.
        const npcDef = getNPC(npcId);
        const s = MetaState.state;
        let scheduledLoc = null, scheduledGx = 0, scheduledGy = 0;
        if (npcDef && npcDef.schedule) {
            for (const slot of npcDef.schedule) {
                if (slot.days && slot.days.includes(s.dayOfWeek) && s.timeOfDay >= slot.start && s.timeOfDay < slot.end) {
                    scheduledLoc = slot.location;
                    scheduledGx = slot.gx;
                    scheduledGy = slot.gy;
                    break;
                }
            }
        }

        // Use pendingTransition if one was queued, otherwise check schedule
        const dep = npc.pendingTransition
            || (scheduledLoc && scheduledLoc !== this.location.id
                ? { targetLocation: scheduledLoc, destGx: scheduledGx, destGy: scheduledGy }
                : null)
            || (npc._wasTransitioning === 'departing' && npc.departPath
                ? { targetLocation: npc.departPath[npc.departPath.length - 1], destGx: npc.departDestGx, destGy: npc.departDestGy }
                : null);
        npc.pendingTransition = null;
        npc._wasTransitioning = null;

        if (dep) {
            const targetLoc = dep.targetLocation;
            if (targetLoc && targetLoc !== this.location.id) {
                const fullPath = findFullPath(this.location.id, targetLoc);
                if (fullPath && fullPath.length >= 2) {
                    const door = findDoorTo(this.location.id, fullPath[1]);
                    if (door) {
                        npc.transitionState = 'departing';
                        npc.departPath = fullPath;
                        npc.departPathIndex = 0;
                        npc.departDestGx = dep.destGx || 0;
                        npc.departDestGy = dep.destGy || 0;
                        npc.targetX = this.roomX + door.gx * TILE + TILE / 2;
                        npc.targetY = this.roomY + door.gy * TILE + TILE / 2;
                        npc.walking = true;
                        npc._pathComputed = false;
                        return;
                    }
                }
            }
            // Target is current room or no valid path — fall through to wander
        }

        npc.wanderTimer = 2000 + Math.random() * 3000;
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

    // After a time skip (e.g. returning from Havenwood), reconcile NPC positions
    // without teleporting. NPCs that need to change rooms get transit records so
    // they walk in naturally; NPCs already in the right room stay put.
    _reconcileNPCsAfterTimeSkip() {
        const expected = getNPCsAtLocation(this.location.id);
        const expectedIds = new Set(expected.map(e => e.id));

        // 1. Remove NPC sprites that shouldn't be here anymore and create transits for them
        for (let i = this.npcSprites.length - 1; i >= 0; i--) {
            const npc = this.npcSprites[i];
            if (npc.transitionState) continue; // already handled
            if (expectedIds.has(npc.id)) continue; // still belongs here

            // NPC moved to a different room — find where they should be now
            const npcDef = getNPC(npc.id);
            const s = MetaState.state;
            let targetLoc = null, targetGx = 0, targetGy = 0;
            if (npcDef && npcDef.schedule) {
                for (const slot of npcDef.schedule) {
                    if (slot.days && slot.days.includes(s.dayOfWeek) && s.timeOfDay >= slot.start && s.timeOfDay < slot.end) {
                        targetLoc = slot.location;
                        targetGx = slot.gx;
                        targetGy = slot.gy;
                        break;
                    }
                }
            }

            // Create an off-screen transit so they walk naturally to their destination
            if (targetLoc && targetLoc !== this.location.id) {
                const fullPath = findFullPath(this.location.id, targetLoc);
                if (fullPath && fullPath.length >= 2) {
                    // They've had time to leave — start them partway through their journey
                    this.game._npcTransits[npc.id] = {
                        path: fullPath,
                        pathIndex: Math.min(1, fullPath.length - 1),
                        destGx: targetGx,
                        destGy: targetGy,
                    };
                }
            }

            // Remove sprite
            const idx = this._roomObjects.indexOf(npc.sprite);
            if (idx >= 0) this._roomObjects.splice(idx, 1);
            if (npc.sprite) npc.sprite.destroy();
            this.npcSprites.splice(i, 1);
            const ri = this._activeNPCRefs.findIndex(r => r.id === npc.id);
            if (ri >= 0) this._activeNPCRefs.splice(ri, 1);
        }

        // 2. NPCs that should be here but aren't — create transits so they walk in
        this._activeNPCRefs = getNPCsAtLocation(this.location.id);
        for (const exp of expected) {
            if (this.npcSprites.some(n => n.id === exp.id)) continue; // already here
            if (this.game._npcTransits && this.game._npcTransits[exp.id]) continue; // already in transit

            // Figure out where this NPC was before (their previous schedule location)
            const npcDef = getNPC(exp.id);
            if (!npcDef) continue;
            let fromLoc = null;
            if (npcDef.schedule) {
                // Check all schedule slots to find where they were previously
                for (const slot of npcDef.schedule) {
                    if (slot.location !== this.location.id) {
                        fromLoc = slot.location;
                    }
                }
            }

            if (fromLoc) {
                // Create transit from their previous location to here
                const fullPath = findFullPath(fromLoc, this.location.id);
                if (fullPath && fullPath.length >= 2) {
                    // They've had time to travel — start them at or near the final room
                    const startIdx = Math.max(1, fullPath.length - 2);
                    this.game._npcTransits[exp.id] = {
                        path: fullPath,
                        pathIndex: startIdx,
                        destGx: exp.gx,
                        destGy: exp.gy,
                    };
                    continue; // _advanceOffScreenTransits will spawn them walking in
                }
            }

            // Fallback: no previous location found — spawn at door walking to position
            const spawnDoor = this.location.doors[0];
            if (spawnDoor) {
                const sx = this.roomX + spawnDoor.gx * TILE + TILE / 2;
                const sy = this.roomY + spawnDoor.gy * TILE + TILE / 2;
                const sprite = this._track(this.add.image(sx, sy, npcDef.spriteKey).setDepth(10));
                this.npcSprites.push({
                    id: exp.id, gx: spawnDoor.gx, gy: spawnDoor.gy,
                    homeGx: exp.gx, homeGy: exp.gy, sprite, def: npcDef,
                    targetX: this.roomX + exp.gx * TILE + TILE / 2,
                    targetY: this.roomY + exp.gy * TILE + TILE / 2,
                    walking: true, paused: false, wanderTimer: 0,
                    transitionState: 'arriving',
                });
                if (!this._activeNPCRefs.some(r => r.id === exp.id)) {
                    this._activeNPCRefs.push({ id: exp.id, gx: spawnDoor.gx, gy: spawnDoor.gy });
                }
            }
        }

        // 3. NPCs that are still here and belong — update their home position to new schedule spot
        for (const npc of this.npcSprites) {
            const exp = expected.find(e => e.id === npc.id);
            if (exp && !npc.transitionState) {
                npc.homeGx = exp.gx;
                npc.homeGy = exp.gy;
            }
        }
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
        this.shiftKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
        this._mobileDir = { left: false, right: false, up: false, down: false };
        this._mobileInteractPulse = false;
    }

    // Returns true if the world position overlaps a wall tile (1, 2, or 5).
    // Out-of-bounds positions return false (not a wall) so this doesn't block
    // movement near room edges or through doors at the map boundary.
    _isWallAt(wx, wy) {
        const rx = Math.floor((wx - this.roomX) / TILE);
        const ry = Math.floor((wy - this.roomY) / TILE);
        if (rx < 0 || rx >= this.location.cols || ry < 0 || ry >= this.location.rows) return false;
        const tile = this.location.tileMap[ry][rx];
        return tile === 1 || tile === 2 || tile === 5;
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

        // Furniture collision (uses shared FURNITURE_SIZE)
        for (const f of this.location.furniture) {
            const fp = furnitureFootprint(f.type);
            if (!fp) continue;
            if (rx >= f.gx && rx < f.gx + fp.w && ry >= f.gy && ry < f.gy + fp.h) return false;
        }


        // Interactable collision (job board, bulletin board, etc.)
        for (const ia of this.location.interactables) {
            if ((ia.action === 'job' || ia.action === 'bulletin_board') &&
                rx >= ia.gx && rx < ia.gx + (ia.w || 1) && ry >= ia.gy && ry < ia.gy + (ia.h || 1)) return false;
        }

        // Event furniture collision (uses shared FURNITURE_SIZE)
        for (const ef of MetaEvents.getEventFurniture(this.location.id)) {
            const efp = furnitureFootprint(ef.type) || { w: 1, h: 1 };
            if (rx >= ef.gx && rx < ef.gx + efp.w && ry >= ef.gy && ry < ef.gy + efp.h) return false;
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

    // Find the nearest interactable within proximity (current tile + all 8 neighbors).
    // Prefers the faced tile, then picks the closest by distance to the character.
    getNearestInteractable() {
        const rx = Math.floor((this.char.x - this.roomX) / TILE);
        const ry = Math.floor((this.char.y + 6 - this.roomY) / TILE);
        const { fx, fy } = this.getFacingTile();

        // Check faced tile first
        const faced = this.getInteractableAt(fx, fy);
        if (faced) return { target: faced, tx: fx, ty: fy };

        // Check current tile and all 8 neighbors
        let best = null, bestDist = Infinity, bx = 0, by = 0;
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const cx = rx + dx, cy = ry + dy;
                if (cx === fx && cy === fy) continue; // already checked
                const t = this.getInteractableAt(cx, cy);
                if (t) {
                    const worldX = this.roomX + cx * TILE + TILE / 2;
                    const worldY = this.roomY + cy * TILE + TILE / 2;
                    const dist = (this.char.x - worldX) ** 2 + (this.char.y - worldY) ** 2;
                    if (dist < bestDist) { bestDist = dist; best = t; bx = cx; by = cy; }
                }
            }
        }
        if (best) return { target: best, tx: bx, ty: by };
        return { target: null, tx: rx, ty: ry };
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

    // Find the Phaser sprite for a given interaction target (NPC or furniture)
    _findTargetSprite(target, fx, fy) {
        if (target.type === 'npc') {
            const npc = this.npcSprites.find(n => n.id === target.id);
            return npc ? npc.sprite : null;
        }
        // For interactables, find the closest furniture sprite to the grid position
        const worldX = this.roomX + fx * TILE + TILE / 2;
        const worldY = this.roomY + fy * TILE + TILE / 2;
        let best = null, bestDist = Infinity;
        for (const spr of this.furnitureSprites) {
            const dx = spr.x - worldX, dy = spr.y - worldY;
            const dist = dx * dx + dy * dy;
            if (dist < bestDist) { bestDist = dist; best = spr; }
        }
        // Only match if within ~1.5 tiles
        if (best && bestDist < (TILE * 1.5) * (TILE * 1.5)) return best;
        return null;
    }

    update(time, delta) {
        // Auto-save every 30s (both worlds). Runs regardless of frozen/dialogue state
        // but skipped during minigames so a refresh returns to pre-minigame state.
        const gs = this.scene.get('GameScene');
        const hudScene = this.scene.get('MetaHUDScene');
        if (gs && gs.state.autoSave && !(hudScene && hudScene._minigameActive)) {
            this._autoSaveAccum = (this._autoSaveAccum || 0) + delta;
            if (this._autoSaveAccum >= 30000) {
                this._autoSaveAccum -= 30000;
                gs._saveMode = 'meta';
                gs.saveGame();
                gs._saveMode = null;
                MetaState.save();
            }
        }

        // Handle dialogue advancement even when frozen
        if (MetaDialogue.isActive()) {
            const hudScene = this.scene.get('MetaHUDScene');
            // Check number keys for choice selection every frame
            MetaDialogue.checkChoiceKeys(hudScene);
            if (Phaser.Input.Keyboard.JustDown(this.interactKey) ||
                Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
                MetaDialogue.advance(hudScene);
            }
            return;
        }

        if (this._frozen) return;

        this.handleMovement(delta);
        this.handleDoors();
        this.handleInteraction();
        this.updateProximityPrompt();
        this.updateNPCs(delta);
        this.updateTime(delta);
        this._advanceOffScreenTransits(delta);
        this._syncNPCPresence(delta);
        this.updateQuestChecks(delta);
        this.animateWeather(delta);
    }

    updateTime(delta) {
        this._timeAccum += delta;
        const tickMs = 1000 / META_TIME_SCALE;
        if (this._timeAccum >= tickMs) {
            const mins = Math.floor(this._timeAccum / tickMs);
            this._timeAccum -= mins * tickMs;
            const prevTime = MetaState.state.timeOfDay;
            MetaState.advanceTime(mins);

            // Check for NPC schedule transitions (small time advances only)
            if (mins <= 5) {
                this._checkNPCTransitions(prevTime, MetaState.state.timeOfDay);
            } else {
                this._reconcileNPCsAfterTimeSkip(); // large jump — reconcile without teleporting
            }
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
        const m = this._mobileDir || {};
        const left = this.cursors.left.isDown || this.wasd.A.isDown || m.left;
        const right = this.cursors.right.isDown || this.wasd.D.isDown || m.right;
        const up = this.cursors.up.isDown || this.wasd.W.isDown || m.up;
        const down = this.cursors.down.isDown || this.wasd.S.isDown || m.down;

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

            const speed = MOVE_SPEED * (this.shiftKey.isDown ? 1.85 : 1) * (delta / 1000);
            const nx = this.char.x + dx * speed;
            const ny = this.char.y + dy * speed;
            const footX = nx;
            const footY = ny + 6;

            // Check both foot and upper-body positions so the sprite
            // doesn't visually overlap wall tiles near doorway corners.
            const canMove = (wx, wy) =>
                this.isWalkable(wx, wy) && !this._isWallAt(wx, wy - 14);

            if (canMove(footX, footY)) {
                this.char.x = nx;
                this.char.y = ny;
            } else {
                if (canMove(nx, this.char.y + 6)) {
                    this.char.x = nx;
                } else if (canMove(this.char.x, footY)) {
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
            Phaser.Input.Keyboard.JustDown(this.spaceKey) ||
            this._mobileInteractPulse) {
            this._mobileInteractPulse = false;

            const { target } = this.getNearestInteractable();

            if (target) {
                this._interactCooldown = true;
                this.time.delayedCall(300, () => { this._interactCooldown = false; });

                if (target.type === 'npc') {
                    this.interactWithNPC(target.id);
                } else if (target.type === 'interactable') {
                    this.interactWithObject(target.data);
                }
            } else {
                // No target — pull out phone (desktop) or hint on mobile
                this._interactCooldown = true;
                this.time.delayedCall(500, () => { this._interactCooldown = false; });
                if (window.__havenwoodMobileMode) {
                    const hudScene = this.scene.get('MetaHUDScene');
                    if (hudScene && hudScene.showNotification) {
                        hudScene.showNotification('Walk closer to an NPC or object, then tap Interact.');
                    }
                } else {
                    this.zoomIntoPhone();
                }
            }
        }
    }

    mobileInteract() {
        if (MetaDialogue.isActive()) {
            const hudScene = this.scene.get('MetaHUDScene');
            MetaDialogue.advance(hudScene);
            return;
        }
        const metaHud = this.scene.get('MetaHUDScene');
        if (window.__havenwoodMobileMode && metaHud && (metaHud._mobileSettingsOpen || metaHud.settingsPanel)) {
            if (metaHud.showNotification) metaHud.showNotification('Close Settings to interact.');
            return;
        }
        this._mobileInteractPulse = true;
        this.handleInteraction();
    }

    getMobileInteractState() {
        if (!window.__havenwoodMobileMode) return { ready: false, label: 'Interact' };
        const metaHud = this.scene.get('MetaHUDScene');
        if (metaHud && (metaHud._mobileSettingsOpen || metaHud.settingsPanel)) {
            return { ready: false, label: 'Interact' };
        }
        const { target } = this.getNearestInteractable();
        if (!target) return { ready: false, label: 'Interact' };
        if (target.type === 'npc') {
            const npcDef = getNPC(target.id);
            return { ready: true, label: `Talk · ${npcDef ? npcDef.name : 'NPC'}` };
        }
        const labels = {
            sleep: 'Sleep', study: 'Study', job: 'Job Board',
            buy_coffee: 'Order', library_study: 'Study',
            vending_machine: 'Vending', couch_rest: 'Rest',
            park_walk: 'Nature Walk', pick_flowers: 'Flowers',
            bulletin_board: 'Bulletin', ping_pong: 'Ping Pong',
        };
        const action = target.data.action;
        const short = labels[action] || target.data.name || 'Use';
        return { ready: true, label: short };
    }

    updateProximityPrompt() {
        const hudScene = this.scene.get('MetaHUDScene');
        if (!hudScene) return;

        const { target, tx, ty } = this.getNearestInteractable();

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
                    ping_pong: 'Ping Pong',
                };
                hudScene.updatePrompt(`[E] ${labels[target.data.action] || target.data.name}`);
            }
        } else {
            hudScene.updatePrompt('[E] Play Havenwood');
        }

        // Highlight the nearest target's sprite with a glow effect
        const targetKey = target ? `${tx},${ty}` : null;
        if (targetKey !== this._lastHighlightKey) {
            // Remove old glow
            if (this._highlightSprite && this._highlightSprite.preFX) {
                if (this._highlightGlow) {
                    this._highlightSprite.preFX.remove(this._highlightGlow);
                    this._highlightGlow = null;
                }
            }
            this._highlightSprite = null;
            this._lastHighlightKey = targetKey;

            if (target) {
                const sprite = this._findTargetSprite(target, tx, ty);
                if (sprite && sprite.preFX) {
                    this._highlightSprite = sprite;
                    this._highlightGlow = sprite.preFX.addGlow(0xffffff, 2, 0, false, 0.15, 10);
                }
            }
        }
    }

    interactWithNPC(npcId) {
        const npcDef = getNPC(npcId);
        if (!npcDef) return;

        // Stop NPC walking while talking
        this.pauseNPC(npcId);

        const hudScene = this.scene.get('MetaHUDScene');

        // If the NPC is mid-transit, strip any choices that advance time — they need to keep moving.
        const npcSprite = this.npcSprites.find(n => n.id === npcId);
        const inTransit = npcSprite && npcSprite.transitionState;
        const dialogue = npcDef.getDialogue(this.location.id);
        if (inTransit && dialogue.choices) {
            const TIME_COSTING = new Set(['hangout', 'attend_class']);
            dialogue.choices = dialogue.choices.filter(c => !TIME_COSTING.has(c.action));
        }

        MetaDialogue.show(hudScene, {
            speaker: dialogue.speaker,
            spriteKey: npcDef.spriteKey,
            lines: dialogue.lines,
            choices: dialogue.choices,
            onChoice: (action) => {
                npcDef.handleAction(action, hudScene);
                // Check quests and friendship milestones after NPC interaction
                this.checkQuests();
                this._checkFriendshipMilestone(npcId, hudScene);
                this.resumeNPC(npcId);
            },
            onClose: () => {
                this.resumeNPC(npcId);
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
        } else if (ia.action === 'ping_pong') {
            this.doPingPong(hudScene);
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

    // ── Ping Pong ──

    doPingPong(hudScene) {
        // Check if Riley is nearby — only playable when Riley is at the table
        const rileyHere = (this._activeNPCRefs || []).some(n => n.id === 'riley');
        if (!rileyHere) {
            MetaDialogue.show(hudScene, {
                speaker: null,
                lines: ['The ping pong table is empty...', 'Maybe someone will show up to play later.'],
            });
            return;
        }

        // Redirect to Riley's NPC interaction so dialogue/choices work naturally
        this.interactWithNPC('riley');
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

        // Reposition NPCs now that time is current. Instead of teleporting them to
        // their new schedule positions, create transit records so they walk naturally.
        // NPCs that were here before and are still here just fade in at their old spot.
        // NPCs that moved to a different room get off-screen transits.
        // NPCs arriving at this room walk in from the correct door.
        this._reconcileNPCsAfterTimeSkip();
        for (const npc of this.npcSprites) {
            if (npc.sprite) {
                npc.sprite.setAlpha(0);
                this.tweens.add({ targets: npc.sprite, alpha: 1, duration: 300, delay: 150 });
            }
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
            this.updateDayNightTint();
            const hud = this.scene.get('MetaHUDScene');
            if (hud) hud.refreshStatusBar();

            // First time entering meta-world — show intro dialogue
            if (!this.game._firstMetaDialogueShown) {
                this.game._firstMetaDialogueShown = true;
                this._frozen = true;
                this.time.delayedCall(500, () => {
                    const metaHud = this.scene.get('MetaHUDScene');
                    if (metaHud) {
                        MetaDialogue.show(metaHud, {
                            speaker: 'Player',
                            spriteKey: 'char_down',
                            lines: [
                                "Good thing I woke up early — that game is awesome!",
                                "I can't wait to play more. I should get to class though...",
                            ],
                            onClose: () => {
                                this._frozen = false;
                            },
                        });
                    }
                });
            }
        });
    }
}
