// MetaWorldScene — The "real world" top-down scene where the character lives.
// Data-driven: loads room layout, furniture, NPCs, and interactables from MetaLocations.
// Supports door transitions between locations, proximity-based interaction,
// time progression, and cross-mode unlocks.

import { W, H, TILE, CLR } from '../GameData.js';
import { getLocation } from '../MetaLocations.js';
import { getNPC } from '../MetaNPCs.js';
import MetaState from '../MetaStateManager.js';
import MetaDialogue from '../MetaDialogue.js';
import MetaCrossModeUnlocks from '../MetaCrossModeUnlocks.js';

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

        this.setupInput();
        this.buildLocation(this._locationId, this._spawnGx, this._spawnGy);

        this._interactCooldown = false;
        this._frozen = this._startWithPhone;
        this._timeAccum = 0;
        this._doorCooldown = true;

        if (this._startWithPhone) {
            this.char.setTexture('char_phone');
        }
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

        this.roomX = Math.floor((W - this.location.cols * TILE) / 2);
        this.roomY = Math.floor((H - this.location.rows * TILE) / 2);

        this.drawRoom();
        this.placeFurniture();
        this.placeNPCs();
        this.createCharacter(spawnGx, spawnGy);

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
            9: loc.floorTile || 'floor_wood',
        };

        for (let ry = 0; ry < loc.rows; ry++) {
            for (let rx = 0; rx < loc.cols; rx++) {
                const tile = loc.tileMap[ry][rx];
                const px = this.roomX + rx * TILE + TILE / 2;
                const py = this.roomY + ry * TILE + TILE / 2;
                const texKey = tileTextures[tile] || 'floor_wood';
                this._track(this.add.image(px, py, texKey).setDepth(1));
            }
        }
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
            } else if (f.type === 'job_board') {
                const jb = this._track(this.add.image(px + TILE / 2, py + TILE / 2, 'furniture_job_board').setDepth(5));
                this.furnitureSprites.push(jb);
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
    }

    placeNPCs() {
        this.npcSprites = [];
        for (const npcRef of this.location.npcs) {
            const npcDef = getNPC(npcRef.id);
            if (!npcDef) continue;
            const px = this.roomX + npcRef.gx * TILE + TILE / 2;
            const py = this.roomY + npcRef.gy * TILE + TILE / 2;
            const sprite = this._track(this.add.image(px, py, npcDef.spriteKey).setDepth(10));
            this.npcSprites.push({ id: npcRef.id, gx: npcRef.gx, gy: npcRef.gy, sprite, def: npcDef });
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
    }

    isWalkable(wx, wy) {
        const rx = Math.floor((wx - this.roomX) / TILE);
        const ry = Math.floor((wy - this.roomY) / TILE);
        if (rx < 0 || rx >= this.location.cols || ry < 0 || ry >= this.location.rows) return false;
        const tile = this.location.tileMap[ry][rx];
        if (tile === 1 || tile === 2 || tile === 5) return false;

        // Furniture collision
        for (const f of this.location.furniture) {
            if (f.type === 'rug' || f.type === 'lamp') continue;
            let fw = 1, fh = 1;
            if (f.type === 'desk' || f.type === 'bench') { fw = 2; fh = 1; }
            if (f.type === 'bed') { fw = 2; fh = 3; }
            if (rx >= f.gx && rx < f.gx + fw && ry >= f.gy && ry < f.gy + fh) return false;
        }

        // NPC collision
        for (const npcRef of this.location.npcs) {
            if (rx === npcRef.gx && ry === npcRef.gy) return false;
        }

        // Interactable collision (job board etc.)
        for (const ia of this.location.interactables) {
            if (ia.action === 'job' && rx >= ia.gx && rx < ia.gx + (ia.w || 1) && ry >= ia.gy && ry < ia.gy + (ia.h || 1)) return false;
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
        // Check NPCs
        for (const npcRef of this.location.npcs) {
            if (npcRef.gx === fx && npcRef.gy === fy) {
                return { type: 'npc', id: npcRef.id };
            }
        }
        // Check interactables
        for (const ia of this.location.interactables) {
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
    }

    updateTime(delta) {
        this._timeAccum += delta;
        const tickMs = 1000 / META_TIME_SCALE;
        if (this._timeAccum >= tickMs) {
            const mins = Math.floor(this._timeAccum / tickMs);
            this._timeAccum -= mins * tickMs;
            MetaState.advanceTime(mins);
            this.game.events.emit('metaTimeUpdate');

            // Late-night dimming
            if (MetaState.isLate()) {
                this.cameras.main.setAlpha(0.85);
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
                hudScene.updatePrompt(`[E] Talk to ${npcDef ? npcDef.name : 'NPC'}`);
            } else if (target.type === 'interactable') {
                const labels = { sleep: 'Sleep', study: 'Study', job: 'Job Board' };
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
            MetaState.nextDay();
            MetaState.save();
            const hudScene = this.scene.get('MetaHUDScene');
            if (hudScene) hudScene.refreshStatusBar();

            this.cameras.main.fadeIn(800, 0, 0, 0);
            this.cameras.main.setAlpha(1);
            this._frozen = false;

            if (hudScene) hudScene.showNotification(`Day ${MetaState.state.day} — ${MetaState.getDayName()}`);
        });
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
                MetaState.addKnowledge(5);
                MetaState.addMood(2);
                MetaState.setFlag(`study_day_${MetaState.state.day}`);
                hudScene.refreshStatusBar();
                hudScene.showNotification('+5 Knowledge');
            },
        });
    }

    doJob(hudScene) {
        const workedToday = MetaState.hasFlag(`job_day_${MetaState.state.day}`);
        if (workedToday) {
            MetaDialogue.show(hudScene, {
                speaker: null,
                lines: ['You already worked a shift today.', 'Come back tomorrow.'],
            });
            return;
        }
        if (MetaState.state.energy < 25) {
            MetaDialogue.show(hudScene, {
                speaker: null,
                lines: ['You\'re too tired to work right now.'],
            });
            return;
        }

        MetaDialogue.show(hudScene, {
            speaker: null,
            lines: ['Campus Pet Store — Help Wanted', 'Part-time position available.'],
            choices: [
                { label: 'Work shift (-25 energy, 2hrs)', action: 'work' },
                { label: 'Not today', action: 'cancel' },
            ],
            onChoice: (action) => {
                if (action !== 'work') return;
                MetaState.spendEnergy(25);
                MetaState.advanceTime(120);
                MetaState.addMoney(30);
                MetaState.addMood(-5);
                MetaState.state.shiftsWorked++;
                MetaState.setFlag(`job_day_${MetaState.state.day}`);
                hudScene.refreshStatusBar();
                hudScene.showNotification('+$30 — Hard work pays off!');
            },
        });
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
        }

        MetaState.save();

        this.charDir = 'down';
        this.char.setTexture('char_down');

        const phoneX = this.char.x;
        const phoneStartY = this.char.y + 4;
        const phoneEndY = this.char.y - 6;
        const phoneSpr = this.add.image(phoneX, phoneStartY, 'furniture_phone')
            .setDepth(11).setScale(0.5).setAlpha(0);

        this.tweens.add({
            targets: phoneSpr,
            y: phoneEndY,
            alpha: 1,
            scaleX: 1,
            scaleY: 1,
            duration: 300,
            ease: 'Quad.easeOut',
            onComplete: () => {
                this.char.setTexture('char_phone');
                phoneSpr.destroy();

                const glow = this.add.circle(this.char.x, this.char.y - 2, 6, 0x55AA55, 0)
                    .setDepth(12);
                this.tweens.add({
                    targets: glow,
                    alpha: 0.3,
                    scaleX: 2.5,
                    scaleY: 2.5,
                    duration: 400,
                    ease: 'Quad.easeIn',
                    onComplete: () => {
                        glow.destroy();
                        const flash = this.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 0)
                            .setDepth(100);
                        this.tweens.add({
                            targets: flash,
                            alpha: 0.8,
                            duration: 150,
                            onComplete: () => {
                                this.scene.sleep('MetaWorldScene');
                                this.scene.sleep('MetaHUDScene');
                                this.scene.wake('GameScene');
                                this.scene.wake('HUDScene');
                                const hudScene = this.scene.get('HUDScene');
                                if (hudScene && hudScene.syncState) hudScene.syncState();
                                this.scene.bringToTop('HUDScene');
                                flash.destroy();
                            }
                        });
                    }
                });
            }
        });
    }

    // ── Put away phone (called after arriving from Havenwood) ──

    playPutAwayPhone() {
        this._frozen = true;
        this.charDir = 'down';
        this.char.setTexture('char_phone');

        // Check cross-mode unlocks (havenwood -> meta)
        const gs = this.scene.get('GameScene');
        if (gs) {
            const notifications = MetaCrossModeUnlocks.checkAndApply('havenwood->meta', gs.state);
            const hudScene = this.scene.get('MetaHUDScene');
            for (const n of notifications) {
                if (hudScene) hudScene.showNotification(n);
            }
        }

        const phoneX = this.char.x;
        const phoneStartY = this.char.y - 6;
        const phoneEndY = this.char.y + 4;
        const phoneSpr = this.add.image(phoneX, phoneStartY, 'furniture_phone')
            .setDepth(11).setAlpha(1);

        this.char.setTexture('char_down');

        this.tweens.add({
            targets: phoneSpr,
            y: phoneEndY,
            alpha: 0,
            scaleX: 0.5,
            scaleY: 0.5,
            duration: 350,
            ease: 'Quad.easeIn',
            onComplete: () => {
                phoneSpr.destroy();
                this._startWithPhone = false;
                this._frozen = false;
                this._interactCooldown = true;
                this.time.delayedCall(300, () => { this._interactCooldown = false; });
            }
        });
    }
}
