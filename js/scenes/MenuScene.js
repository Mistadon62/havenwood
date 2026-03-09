// Title screen with gradient sky, tree silhouettes, wildflowers, and hopping bunnies on the meadow.
// New Game / Continue buttons. Fade-in on text. Clicking a bunny shows hearts (purely decorative).
import { W, H, CLR } from '../GameData.js';

export default class MenuScene extends Phaser.Scene {
    constructor() { super('MenuScene'); }

    create() {
        this.game.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 2) {
                if (this.scene.isActive('GameScene')) return;
                e.stopImmediatePropagation();
            }
        }, true);

        const bg = this.add.graphics();

        for (let y = 0; y < H; y++) {
            const t = y / H;
            const r = Math.round(15 + t * 25);
            const g = Math.round(20 + t * 55);
            const b = Math.round(35 - t * 15);
            bg.fillStyle(Phaser.Display.Color.GetColor(r, g, b));
            bg.fillRect(0, y, W, 1);
        }

        const rng = new Phaser.Math.RandomDataGenerator(['menu']);

        // Forest floor — solid ground so trees don't look floating
        const floorTop = H * 0.30, floorBottom = H * 0.68;
        for (let y = Math.floor(floorTop); y <= floorBottom; y++) {
            const t = (y - floorTop) / (floorBottom - floorTop);
            const r = Math.round(12 + t * 18);
            const g = Math.round(28 + t * 25);
            const b = Math.round(18 + t * 12);
            bg.fillStyle(Phaser.Display.Color.GetColor(r, g, b));
            bg.fillRect(0, y, W, 1);
        }

        // Hills — rolling terrain the trees sit on
        const hillShades = [0x1a3020, 0x152818, 0x1e3825];
        for (let h = 0; h < 3; h++) {
            const hillY = H * (0.52 + h * 0.05);
            const hillW = W * (0.7 + rng.frac() * 0.4);
            const hillH = 50 + rng.between(10, 25);
            const hillX = (h % 2 === 0 ? -hillW * 0.2 : W - hillW * 0.8) + rng.between(-20, 20);
            bg.fillStyle(hillShades[h], 0.85);
            bg.fillEllipse(hillX + hillW / 2, hillY, hillW, hillH);
        }

        bg.fillStyle(CLR.grass2);
        bg.fillRect(0, H * 0.64, W, H * 0.36);
        bg.fillStyle(CLR.grass1);
        bg.fillRect(0, H * 0.67, W, H * 0.33);

        // Ground texture — subtle variation on the meadow
        const shift = (c, n) => (Math.min(255, Math.max(0, ((c >> 16) & 0xff) + n)) << 16) |
            (Math.min(255, Math.max(0, ((c >> 8) & 0xff) + n)) << 8) |
            Math.min(255, Math.max(0, (c & 0xff) + n));
        for (let i = 0; i < 35; i++) {
            const gx = rng.between(0, W);
            const gy = H * 0.7 + rng.between(0, H * 0.28);
            const sz = rng.realInRange(1, 2.5);
            bg.fillStyle(shift(CLR.grass1, rng.between(-6, 10)), 0.3);
            bg.fillCircle(gx, gy, sz);
        }

        // Stars in the sky
        for (let i = 0; i < 50; i++) {
            const sx = rng.between(5, W - 5);
            const sy = rng.between(8, H * 0.30);
            const sr = rng.realInRange(0.5, 1.5);
            bg.fillStyle(0xffffff, rng.realInRange(0.3, 0.8));
            bg.fillCircle(sx, sy, sr);
        }

        const tintColor = (base, offset) => {
            const r = Math.min(255, Math.max(0, ((base >> 16) & 0xff) + offset));
            const g = Math.min(255, Math.max(0, ((base >> 8) & 0xff) + offset));
            const b = Math.min(255, Math.max(0, (base & 0xff) + offset));
            return (r << 16) | (g << 8) | b;
        };

        const drawTree = (x, baseY, scale, dark) => {
            const v = rng.between(-15, 15);
            const trunkW = Math.round(6 * scale), trunkH = Math.round(24 * scale);
            bg.fillStyle(dark ? 0x2a1a0a : 0x3d2510);
            bg.fillRect(x - trunkW / 2, baseY - trunkH, trunkW, trunkH);

            const layers = 3;
            for (let l = 0; l < layers; l++) {
                const ly = baseY - trunkH + 4 * scale - l * 22 * scale;
                const lw = (44 - l * 10) * scale;
                const lh = (32 + l * 4) * scale;
                bg.fillStyle(tintColor(dark ? 0x12301a : 0x1d4a24, v), dark ? 0.9 : 0.95);
                bg.fillTriangle(x, ly - lh, x - lw / 2, ly, x + lw / 2, ly);
                bg.fillStyle(tintColor(dark ? 0x1a3d22 : 0x2a5e30, v), 0.7);
                bg.fillTriangle(x, ly - lh + 6 * scale, x - lw / 2 + 5 * scale, ly, x + lw / 2 - 5 * scale, ly);
            }
        };

        const fireX = W / 2, fireY = H * 0.65;
        const tentX = fireX - 90, tentY = fireY + 2;
        const inCampZone = (tx, ty) => {
            const dx = tx - (tentX + fireX) / 2;
            const dy = ty - fireY;
            return dx * dx + dy * dy < 75 * 75;
        };

        const layers = [
            { y: 0.26, spacing: 14, jitterX: 8, jitterY: 6, scaleMin: 0.15, scaleMax: 0.28, dark: true, wave: true },
            { y: 0.33, spacing: 22, jitterX: 10, jitterY: 12, scaleMin: 0.3,  scaleMax: 0.45, dark: true, wave: true },
            { y: 0.38, spacing: 20, jitterX: 10, jitterY: 12, scaleMin: 0.4,  scaleMax: 0.55, dark: true, wave: true },
            { y: 0.43, spacing: 18, jitterX: 9,  jitterY: 10, scaleMin: 0.5,  scaleMax: 0.7,  dark: true, wave: true },
            { y: 0.48, spacing: 20, jitterX: 10, jitterY: 10, scaleMin: 0.6,  scaleMax: 0.8,  dark: true, wave: false },
            { y: 0.53, spacing: 22, jitterX: 10, jitterY: 8,  scaleMin: 0.7,  scaleMax: 0.95, dark: false, wave: false },
            { y: 0.58, spacing: 24, jitterX: 12, jitterY: 8,  scaleMin: 0.8,  scaleMax: 1.05, dark: false, wave: false },
            { y: 0.63, spacing: 28, jitterX: 14, jitterY: 6,  scaleMin: 0.9,  scaleMax: 1.15, dark: false, wave: false },
        ];
        for (const l of layers) {
            for (let x = -30; x < W + 30; x += l.spacing) {
                const tx = x + rng.between(-l.jitterX, l.jitterX);
                let ty = H * l.y + rng.between(-l.jitterY, l.jitterY);
                if (l.wave) {
                    ty += 14 * Math.sin(tx / 70) + 6 * Math.sin(tx / 28);
                }
                if (inCampZone(tx, ty)) continue;
                drawTree(tx, ty, rng.realInRange(l.scaleMin, l.scaleMax), l.dark);
            }
        }
        // Transition trees — sparse, trailing into the meadow
        for (let x = -20; x < W + 20; x += 60) {
            if (rng.frac() > 0.6) continue;
            const tx = x + rng.between(-20, 20);
            const ty = H * 0.67 + rng.between(0, 10);
            if (inCampZone(tx, ty)) continue;
            drawTree(tx, ty, rng.realInRange(0.7, 0.95), false);
        }

        // Lake in the gap behind the campsite
        const lakeX = (tentX + fireX) / 2;
        const lakeY = fireY - 45;
        bg.fillStyle(0x1a3045, 0.95);
        bg.fillEllipse(lakeX, lakeY, 95, 52);
        bg.fillStyle(0x2a4060, 0.6);
        bg.fillEllipse(lakeX - 6, lakeY - 4, 68, 36);
        bg.fillStyle(0x3a5080, 0.4);
        bg.fillEllipse(lakeX - 12, lakeY - 10, 34, 20);

        for (let i = 0; i < 24; i++) {
            const fx = rng.between(30, W - 30);
            const fy = H * 0.68 + rng.between(0, H * 0.25);
            const size = rng.realInRange(1.5, 3);
            bg.fillStyle(rng.pick([0xFFDD44, 0xFF8899, 0xAABBFF, 0xFFFFFF, 0xFF6688, 0xFFAA55, 0xDDAAFF]));
            bg.fillCircle(fx, fy, size);
        }

        // Crescent moon
        const moonX = W - 100, moonY = 65, moonR = 28;
        bg.fillStyle(0xEEEECC, 0.9);
        bg.fillCircle(moonX, moonY, moonR);
        bg.fillStyle(Phaser.Display.Color.GetColor(15 + (moonY / H) * 25, 20 + (moonY / H) * 55, 35 - (moonY / H) * 15));
        bg.fillCircle(moonX + 12, moonY - 6, moonR - 2);

        // Twinkling star sprites
        for (let i = 0; i < 30; i++) {
            const sx = rng.between(10, W - 10);
            const sy = rng.between(10, H * 0.28);
            const star = this.add.circle(sx, sy, rng.realInRange(0.8, 1.8), 0xffffff).setAlpha(rng.realInRange(0.2, 0.7)).setDepth(1);
            this.tweens.add({
                targets: star, alpha: rng.realInRange(0.05, 0.2),
                duration: rng.between(1500, 4000), yoyo: true, repeat: -1,
                delay: rng.between(0, 3000), ease: 'Sine.easeInOut'
            });
        }

        // Campfire at the forest edge
        const stones = [[-10, 3], [10, 3], [-7, -5], [7, -5], [0, 6], [-12, 0], [12, 0]];
        for (const [ox, oy] of stones) {
            bg.fillStyle(rng.pick([0x666666, 0x777777, 0x555555, 0x606060]));
            bg.fillCircle(fireX + ox, fireY + oy, rng.between(3, 5));
        }
        bg.fillStyle(0x331100); bg.fillCircle(fireX, fireY, 6);

        // Wooden benches
        const drawBench = (bx, by) => {
            bg.fillStyle(0x5C3A1E); bg.fillRect(bx - 16, by, 32, 4);
            bg.fillStyle(0x4A2E16); bg.fillRect(bx - 13, by + 4, 4, 6);
            bg.fillStyle(0x4A2E16); bg.fillRect(bx + 9, by + 4, 4, 6);
        };
        drawBench(fireX - 30, fireY + 8);
        drawBench(fireX + 30, fireY + 6);

        // Orange tent to the left
        bg.fillStyle(0xCC6622);
        bg.fillTriangle(tentX, tentY - 30, tentX - 22, tentY + 8, tentX + 22, tentY + 8);
        bg.fillStyle(0xDD7733, 0.7);
        bg.fillTriangle(tentX, tentY - 30, tentX - 4, tentY + 8, tentX + 18, tentY + 8);
        bg.fillStyle(0x332211);
        bg.fillTriangle(tentX - 2, tentY + 8, tentX + 6, tentY + 8, tentX + 2, tentY - 6);
        bg.fillStyle(0x8B4513); bg.fillRect(tentX - 22, tentY + 7, 44, 3);

        const fireColors = [0xFF4400, 0xFF6600, 0xFFAA00, 0xFFCC33];
        for (let i = 0; i < 4; i++) {
            const flame = this.add.circle(fireX + rng.between(-3, 3), fireY - 4, rng.between(3, 5), fireColors[i]).setAlpha(0.8).setDepth(5);
            this.tweens.add({
                targets: flame, y: fireY - rng.between(8, 16), alpha: 0.2,
                scaleX: rng.realInRange(0.5, 0.8), scaleY: rng.realInRange(1.2, 1.8),
                duration: rng.between(400, 800), yoyo: true, repeat: -1,
                delay: rng.between(0, 400), ease: 'Sine.easeInOut'
            });
        }
        const glowG = this.add.circle(fireX, fireY - 5, 20, 0xFF6600, 0.12).setDepth(4);
        this.tweens.add({ targets: glowG, alpha: 0.06, scaleX: 1.2, scaleY: 1.2, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

        // Smoke particles rising behind the text
        this.time.addEvent({
            delay: 300, loop: true,
            callback: () => {
                const sx = fireX + Phaser.Math.Between(-4, 4);
                const smoke = this.add.circle(sx, fireY - 14, Phaser.Math.Between(2, 4), 0x888888, 0.3).setDepth(2);
                this.tweens.add({
                    targets: smoke,
                    x: sx + Phaser.Math.Between(-20, 20),
                    y: fireY - Phaser.Math.Between(100, 180),
                    alpha: 0, scaleX: 2.5, scaleY: 2.5,
                    duration: Phaser.Math.Between(2500, 4000),
                    ease: 'Quad.easeOut',
                    onComplete: () => smoke.destroy()
                });
            }
        });

        // Title screen text — do not change; color (CLR.gold) and stroke (#2A1A0E) are intentional.
        this.add.text(W / 2, 140, 'HAVENWOOD', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '44px',
            color: CLR.gold,
            stroke: '#2A1A0E',
            strokeThickness: 6
        }).setOrigin(0.5);

        this.btn(W / 2, 280, 'New Game', () => {
            this.scene.start('GameScene', { newGame: true });
        });

        if (localStorage.getItem('havenwood_save')) {
            this.btn(W / 2, 340, 'Continue', () => {
                this.scene.start('GameScene', { newGame: false });
            });
        }

        this.add.text(W / 2, H - 30, 'v0.1 MVP', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '8px',
            color: '#556644'
        }).setOrigin(0.5);

        this.children.list
            .filter(c => c.type === 'Text')
            .forEach((c, i) => {
                c.setAlpha(0);
                this.tweens.add({
                    targets: c, alpha: 1,
                    duration: 600,
                    delay: i * 150
                });
            });

        this.spawnMenuBunnies();
    }

    spawnMenuBunnies() {
        const meadowY = H * 0.65;
        const bunnies = [];

        for (let i = 0; i < 4; i++) {
            const bx = Phaser.Math.Between(60, W - 60);
            const by = meadowY + Phaser.Math.Between(20, H * 0.28);
            const bunny = this.add.image(bx, by, 'animal_rabbit').setDepth(10).setScale(0.8).setAlpha(0.9);
            bunny.setInteractive({ useHandCursor: true });

            bunny.on('pointerdown', () => {
                for (let j = 0; j < 3; j++) {
                    const h = this.add.image(
                        bunny.x + Phaser.Math.Between(-8, 8), bunny.y, 'particle_heart'
                    ).setDepth(55).setScale(0.5);
                    this.tweens.add({
                        targets: h, y: bunny.y - 25 - j * 8, alpha: 0, scale: 1.2,
                        duration: 700, delay: j * 120, onComplete: () => h.destroy()
                    });
                }
                this.tweens.add({
                    targets: bunny, scaleX: 0.95, scaleY: 0.65, yoyo: true,
                    duration: 150, ease: 'Quad.easeOut',
                    onComplete: () => { bunny.scaleX = 0.8; bunny.scaleY = 0.8; }
                });
            });

            bunnies.push({ sprite: bunny, baseY: by, hopTimer: Phaser.Math.Between(0, 4000) });
        }

        this.time.addEvent({
            delay: 100, loop: true,
            callback: () => {
                for (const b of bunnies) {
                    b.hopTimer += 100;
                    if (b.hopTimer >= Phaser.Math.Between(3000, 7000)) {
                        b.hopTimer = 0;
                        const dir = Phaser.Math.Between(0, 1) ? 1 : -1;
                        const hopDist = Phaser.Math.Between(20, 50);
                        const tx = Phaser.Math.Clamp(b.sprite.x + dir * hopDist, 30, W - 30);
                        b.sprite.setFlipX(dir < 0);
                        this.tweens.add({
                            targets: b.sprite,
                            x: tx,
                            y: b.sprite.y - 12,
                            duration: 200,
                            ease: 'Quad.easeOut',
                            onComplete: () => {
                                this.tweens.add({
                                    targets: b.sprite,
                                    y: b.baseY,
                                    duration: 200,
                                    ease: 'Quad.easeIn'
                                });
                            }
                        });
                    }
                }
            }
        });
    }

    // Creates interactive text button with hover (gold) and click callback.
    btn(x, y, label, cb) {
        const t = this.add.text(x, y, label, {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '16px',
            color: CLR.uiText,
            stroke: '#2A1A0E',
            strokeThickness: 3,
            padding: { x: 16, y: 8 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        t.on('pointerover', () => t.setColor(CLR.gold));
        t.on('pointerout', () => t.setColor(CLR.uiText));
        t.on('pointerdown', cb);
    }
}
