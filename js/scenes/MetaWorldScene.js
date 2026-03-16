// MetaWorldScene — The "real world" top-down room where the character lives.
// The player controls the character with WASD/arrow keys. Pressing E/Space
// anywhere makes the character pull out their phone and switches to Havenwood.
// When arriving from Havenwood, the character starts holding the phone and
// plays a "put away" animation before becoming controllable.

import { W, H, TILE, CLR } from '../GameData.js';

// Room dimensions in tiles
const ROOM_COLS = 14;
const ROOM_ROWS = 10;
// Offset to center the room on the canvas
const ROOM_X = Math.floor((W - ROOM_COLS * TILE) / 2);
const ROOM_Y = Math.floor((H - ROOM_ROWS * TILE) / 2);

// Room layout: 0=floor, 1=wall, 2=wall_window, 9=door
const ROOM_MAP = [
    [1, 1, 1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 9, 9, 1, 1, 1, 1, 1, 1],
];

// Furniture placement: { type, gx, gy } — gx/gy in room-tile coords
const FURNITURE = [
    { type: 'desk', gx: 2, gy: 1 },
    { type: 'chair', gx: 3, gy: 2 },
    { type: 'bed', gx: 10, gy: 1 },
    { type: 'bookshelf', gx: 1, gy: 4 },
    { type: 'bookshelf', gx: 1, gy: 5 },
    { type: 'nightstand', gx: 9, gy: 1 },
    { type: 'lamp', gx: 9, gy: 1 },
    { type: 'rug', gx: 5, gy: 4 },
];

// Character movement speed in pixels per second
const MOVE_SPEED = 120;

export default class MetaWorldScene extends Phaser.Scene {
    constructor() { super('MetaWorldScene'); }

    init(data) {
        // If arriving from Havenwood, character starts holding phone
        this._startWithPhone = data?.startWithPhone || false;
    }

    create() {
        this.cameras.main.setRoundPixels(true);

        // Background fill
        this.add.rectangle(W / 2, H / 2, W, H, 0x1a1a2a).setDepth(0);

        this.drawRoom();
        this.placeFurniture();
        this.createCharacter();
        this.setupInput();

        this._interactCooldown = false;
        this._frozen = this._startWithPhone; // frozen until put-away animation completes

        // If starting with phone, show the phone-holding pose immediately
        if (this._startWithPhone) {
            this.char.setTexture('char_phone');
        }
    }

    drawRoom() {
        for (let ry = 0; ry < ROOM_ROWS; ry++) {
            for (let rx = 0; rx < ROOM_COLS; rx++) {
                const tile = ROOM_MAP[ry][rx];
                const px = ROOM_X + rx * TILE + TILE / 2;
                const py = ROOM_Y + ry * TILE + TILE / 2;
                let texKey = 'floor_wood';
                if (tile === 1) texKey = 'wall';
                else if (tile === 2) texKey = 'wall_window';
                else if (tile === 9) texKey = 'floor_wood'; // door (walkable)
                this.add.image(px, py, texKey).setDepth(1);
            }
        }
    }

    placeFurniture() {
        this.furnitureSprites = [];
        for (const f of FURNITURE) {
            const px = ROOM_X + f.gx * TILE;
            const py = ROOM_Y + f.gy * TILE;

            if (f.type === 'rug') {
                const rug = this.add.image(px + 48, py + 32, 'furniture_rug').setDepth(2);
                this.furnitureSprites.push(rug);
            } else if (f.type === 'desk') {
                const desk = this.add.image(px + 32, py + TILE / 2, 'furniture_desk').setDepth(5);
                this.furnitureSprites.push(desk);
            } else if (f.type === 'bed') {
                const bed = this.add.image(px + 32, py + 48, 'furniture_bed').setDepth(5);
                this.furnitureSprites.push(bed);
            } else if (f.type === 'lamp') {
                const lamp = this.add.image(px + TILE / 2, py + TILE / 2 - 8, 'furniture_lamp').setDepth(7);
                this.furnitureSprites.push(lamp);
                this.add.circle(px + TILE / 2, py + TILE / 2, 40, 0xFFFF88, 0.06).setDepth(3);
            } else {
                const key = `furniture_${f.type}`;
                if (this.textures.exists(key)) {
                    const sprite = this.add.image(px + TILE / 2, py + TILE / 2, key).setDepth(5);
                    this.furnitureSprites.push(sprite);
                }
            }
        }
    }

    createCharacter() {
        const startGx = 6, startGy = 5;
        const px = ROOM_X + startGx * TILE + TILE / 2;
        const py = ROOM_Y + startGy * TILE + TILE / 2;

        this.char = this.add.image(px, py, 'char_down').setDepth(10);
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
        const rx = Math.floor((wx - ROOM_X) / TILE);
        const ry = Math.floor((wy - ROOM_Y) / TILE);
        if (rx < 0 || rx >= ROOM_COLS || ry < 0 || ry >= ROOM_ROWS) return false;
        const tile = ROOM_MAP[ry][rx];
        if (tile === 1 || tile === 2) return false;

        for (const f of FURNITURE) {
            if (f.type === 'rug' || f.type === 'lamp') continue;
            let fw = 1, fh = 1;
            if (f.type === 'desk') { fw = 2; fh = 1; }
            if (f.type === 'bed') { fw = 2; fh = 3; }
            if (rx >= f.gx && rx < f.gx + fw && ry >= f.gy && ry < f.gy + fh) return false;
        }
        return true;
    }

    update(time, delta) {
        if (this._frozen) return;
        this.handleMovement(delta);
        this.handleInteraction();
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
    }

    handleInteraction() {
        if (this._interactCooldown) return;

        if (Phaser.Input.Keyboard.JustDown(this.interactKey) ||
            Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
            this._interactCooldown = true;
            this.time.delayedCall(500, () => { this._interactCooldown = false; });
            this.zoomIntoPhone();
        }
    }

    // ── Pull out phone → switch to Havenwood ──

    zoomIntoPhone() {
        this._frozen = true;

        // Face down and show pull-out animation
        this.charDir = 'down';
        this.char.setTexture('char_down');

        // Phone rises from pocket to hands
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
                // Swap to phone-holding pose
                this.char.setTexture('char_phone');
                phoneSpr.destroy();

                // Screen glow expands then flashes white to cover the scene switch
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
                        // Flash overlay to mask the switch
                        const flash = this.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 0)
                            .setDepth(100);
                        this.tweens.add({
                            targets: flash,
                            alpha: 0.8,
                            duration: 150,
                            onComplete: () => {
                                // Switch scenes
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

    // ── Put away phone (called by TransitionScene after zoom-out completes) ──

    playPutAwayPhone() {
        // Character is currently in char_phone pose. Animate putting it away.
        this._frozen = true;
        this.charDir = 'down';
        this.char.setTexture('char_phone');

        // 1) Phone sprite appears from the character's hands
        const phoneX = this.char.x;
        const phoneStartY = this.char.y - 6;
        const phoneEndY = this.char.y + 4;
        const phoneSpr = this.add.image(phoneX, phoneStartY, 'furniture_phone')
            .setDepth(11).setAlpha(1);

        // Swap character back to normal immediately (phone sprite covers the transition)
        this.char.setTexture('char_down');

        // 2) Phone drops back to pocket and fades
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
                // 3) Clear phone flag and unfreeze — player can now move
                this._startWithPhone = false;
                this._frozen = false;
                this._interactCooldown = true;
                this.time.delayedCall(300, () => { this._interactCooldown = false; });
            }
        });
    }
}
