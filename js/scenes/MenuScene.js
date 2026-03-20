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

        const drawTree = (gfx, x, baseY, scale, dark) => {
            const v = rng.between(-15, 15);
            const trunkW = Math.round(6 * scale), trunkH = Math.round(24 * scale);
            gfx.fillStyle(dark ? 0x2a1a0a : 0x3d2510);
            gfx.fillRect(x - trunkW / 2, baseY - trunkH, trunkW, trunkH);

            const layers = 3;
            for (let l = 0; l < layers; l++) {
                const ly = baseY - trunkH + 4 * scale - l * 22 * scale;
                const lw = (44 - l * 10) * scale;
                const lh = (32 + l * 4) * scale;
                gfx.fillStyle(tintColor(dark ? 0x12301a : 0x1d4a24, v), dark ? 0.9 : 0.95);
                gfx.fillTriangle(x, ly - lh, x - lw / 2, ly, x + lw / 2, ly);
                gfx.fillStyle(tintColor(dark ? 0x1a3d22 : 0x2a5e30, v), 0.7);
                gfx.fillTriangle(x, ly - lh + 6 * scale, x - lw / 2 + 5 * scale, ly, x + lw / 2 - 5 * scale, ly);
            }
        };
        const fireX = W / 2, fireY = H * 0.65;
        const tentX = fireX - 90, tentY = fireY + 2;
        const inCampZone = (tx, ty) => {
            const dx = tx - (tentX + fireX) / 2;
            const dy = ty - fireY;
            return dx * dx + dy * dy < 75 * 75;
        };

        // Two tree layers for Y-sorting with the alien easter egg:
        // Trees rooted above the alien's path render behind him (depth 6),
        // trees rooted at or below render in front (depth 8).
        // Alien runs at depth 7 between them.
        const alienGroundY = fireY + 10;
        const treeGfxBehind = this.add.graphics().setDepth(6);
        const treeGfxFront = this.add.graphics().setDepth(8);
        const pickTreeLayer = (baseY) => baseY >= alienGroundY ? treeGfxFront : treeGfxBehind;

        // Shrubs and undergrowth at forest-meadow edge (drawn before trees so trees render on top)
        const shrubColors = [0x2a5e30, 0x1d4a24, 0x3a6a3a, 0x4a7a4a, 0x5a8a5a, 0x3d6b3d];
        for (let i = 0; i < 45; i++) {
            const sx = rng.between(0, W);
            const sy = H * 0.64 + rng.between(0, H * 0.08);
            if (inCampZone(sx, sy)) continue;
            const sz = rng.realInRange(2, 6);
            const gfx = pickTreeLayer(sy);
            gfx.fillStyle(rng.pick(shrubColors), 0.85);
            gfx.fillCircle(sx, sy, sz);
            if (sz >= 4) {
                gfx.fillStyle(rng.pick(shrubColors), 0.6);
                gfx.fillCircle(sx + rng.between(-2, 2), sy - 1, sz * 0.6);
            }
        }

        const layers = [
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
                drawTree(pickTreeLayer(ty), tx, ty, rng.realInRange(l.scaleMin, l.scaleMax), l.dark);
            }
        }
        // Transition trees — sparse, trailing into the meadow
        for (let x = -20; x < W + 20; x += 60) {
            if (rng.frac() > 0.6) continue;
            const tx = x + rng.between(-20, 20);
            const ty = H * 0.67 + rng.between(0, 10);
            if (inCampZone(tx, ty)) continue;
            drawTree(pickTreeLayer(ty), tx, ty, rng.realInRange(0.7, 0.95), false);
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
        }).setOrigin(0.5).setDepth(8);

        // Pre-Alpha badge (top-left can overlap bottom-right of D)
        const badgeX = W / 2 + 160, badgeY = 180;
        const badge = this.add.container(badgeX, badgeY).setDepth(8);
        const badgeBg = this.add.graphics();
        badgeBg.fillStyle(0x3a4a2a, 0.9);
        badgeBg.lineStyle(1, 0x5a6a4a, 0.8);
        badgeBg.fillRoundedRect(-52, -11, 104, 22, 4);
        badgeBg.strokeRoundedRect(-52, -11, 104, 22, 4);
        const badgeTxt = this.add.text(0, 0, 'Pre-Alpha', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '10px',
            color: '#AACC88'
        }).setOrigin(0.5);
        badge.add([badgeBg, badgeTxt]);
        this.tweens.add({
            targets: badge,
            y: badgeY - 5,
            duration: 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        this.btn(W / 2, 280, 'New Game', () => {
            this.scene.start('GameScene', { newGame: true });
        });

        if (localStorage.getItem('havenwood_save')) {
            this.btn(W / 2, 340, 'Continue', () => {
                this.scene.start('GameScene', { newGame: false });
            });
        }

        this.add.text(W / 2, H - 30, 'v0.1', {
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

        this._initCEAudio();
        this.spawnMenuBunnies();
        this._setupTentEasterEgg(tentX, tentY);
        this._setupMoonEasterEgg(moonX, moonY, moonR);
    }

    // Shared audio helpers for Close Encounters easter eggs
    _initCEAudio() {
        this._ceNotes = [
            { name: 'A#4', freq: 466.16 },
            { name: 'C5',  freq: 523.25 },
            { name: 'G#4', freq: 415.30 },
            { name: 'G#3', freq: 207.65 },
            { name: 'D#4', freq: 311.13 },
        ];
        this._ceOrder = ['A#4', 'C5', 'G#4', 'G#3', 'D#4'];
        this._ceTriggered = false;
        this._ceAudioCtx = null;
    }

    _getAudio() {
        if (!this._ceAudioCtx) this._ceAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (this._ceAudioCtx.state === 'suspended') this._ceAudioCtx.resume();
        return this._ceAudioCtx;
    }

    _playChirp(freq) {
        const ctx = this._getAudio();
        const t = ctx.currentTime;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'sine';
        o.frequency.setValueAtTime(freq, t);
        o.frequency.linearRampToValueAtTime(freq * 1.03, t + 0.04);
        o.frequency.linearRampToValueAtTime(freq, t + 0.12);
        o.frequency.linearRampToValueAtTime(freq * 0.97, t + 0.2);
        g.gain.setValueAtTime(0.18, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
        o.start(t); o.stop(t + 0.28);
    }

    _playFlute(freq, startTime, duration) {
        const ctx = this._getAudio();
        const o1 = ctx.createOscillator();
        const o2 = ctx.createOscillator();
        const g = ctx.createGain();
        const filt = ctx.createBiquadFilter();
        o1.connect(g); o2.connect(g); g.connect(filt); filt.connect(ctx.destination);
        o1.type = 'sine'; o1.frequency.value = freq;
        o2.type = 'triangle'; o2.frequency.value = freq;
        filt.type = 'lowpass'; filt.frequency.value = freq * 3; filt.Q.value = 1;
        const attack = 0.06, release = 0.12;
        g.gain.setValueAtTime(0.001, startTime);
        g.gain.linearRampToValueAtTime(0.13, startTime + attack);
        g.gain.setValueAtTime(0.13, startTime + duration - release);
        g.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        o1.start(startTime); o1.stop(startTime + duration);
        o2.start(startTime); o2.stop(startTime + duration);
        const bufLen = Math.ceil(ctx.sampleRate * duration);
        const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
        const ns = ctx.createBufferSource(); ns.buffer = buf;
        const ng = ctx.createGain();
        const nf = ctx.createBiquadFilter();
        ns.connect(nf); nf.connect(ng); ng.connect(ctx.destination);
        nf.type = 'bandpass'; nf.frequency.value = freq * 2; nf.Q.value = 2;
        ng.gain.setValueAtTime(0.001, startTime);
        ng.gain.linearRampToValueAtTime(0.015, startTime + attack);
        ng.gain.setValueAtTime(0.015, startTime + duration - release);
        ng.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        ns.start(startTime); ns.stop(startTime + duration);
    }

    _playFluteMotif(startTime) {
        const gap = 0.55;
        this._ceOrder.forEach((name, i) => {
            const note = this._ceNotes.find(n => n.name === name);
            const dur = i === this._ceOrder.length - 1 ? 0.9 : 0.5;
            this._playFlute(note.freq, startTime + i * gap, dur);
        });
    }

    spawnMenuBunnies() {
        const meadowY = H * 0.65;
        const bunnies = [];

        const shuffled = Phaser.Utils.Array.Shuffle([...this._ceNotes]);
        const clickSequence = [];

        const triggerEasterEgg = () => {
            this._ceTriggered = true;
            const ctx = this._getAudio();
            this._playFluteMotif(ctx.currentTime + 0.4);
            const gap = 0.55;
            const melodyMs = (0.4 + (this._ceOrder.length - 1) * gap + 0.9) * 1000 + 300;
            this.time.delayedCall(melodyMs, () => this._riseDevilsTower());
        };

        for (let i = 0; i < 5; i++) {
            const bx = Phaser.Math.Between(60, W - 60);
            const by = meadowY + Phaser.Math.Between(20, H * 0.28);
            const bunny = this.add.image(bx, by, 'animal_rabbit').setDepth(10).setScale(0.8).setAlpha(0.9);
            bunny.setInteractive({ useHandCursor: true });
            const noteData = shuffled[i];

            bunny.on('pointerdown', () => {
                this._playChirp(noteData.freq);
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
                if (!this._ceTriggered) {
                    const now = Date.now();
                    clickSequence.push({ name: noteData.name, time: now });
                    while (clickSequence.length > 0 && now - clickSequence[0].time > 5000) clickSequence.shift();
                    if (clickSequence.length >= 5) {
                        const last5 = clickSequence.slice(-5);
                        if (last5[4].time - last5[0].time <= 5000 &&
                            last5.every((c, idx) => c.name === this._ceOrder[idx])) {
                            triggerEasterEgg();
                        }
                    }
                }
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

    _setupTentEasterEgg(tentX, tentY) {
        const tentHit = this.add.rectangle(tentX, tentY - 10, 44, 40, 0, 0)
            .setDepth(9).setInteractive({ useHandCursor: true });
        const tentClicks = [];
        let tentEggActive = false;

        tentHit.on('pointerdown', () => {
            if (tentEggActive) return;
            const now = Date.now();
            tentClicks.push(now);
            while (tentClicks.length > 0 && now - tentClicks[0] > 10000) tentClicks.shift();
            if (tentClicks.length >= 20) {
                tentEggActive = true;
                tentClicks.length = 0;
                this._triggerTentEyes(tentX, tentY, () => { tentEggActive = false; });
            }
        });
    }

    _setupMoonEasterEgg(moonX, moonY, moonR) {
        const hitR = moonR + 4;
        const moonHit = this.add.circle(moonX, moonY, hitR, 0, 0)
            .setDepth(9).setInteractive({ useHandCursor: true });
        let moonEggActive = false;
        let moonEyeRevealed = false;

        moonHit.on('pointerdown', () => {
            if (moonEggActive) return;
            moonEggActive = true;
            if (!moonEyeRevealed) {
                moonEyeRevealed = true;
                this._moonEye = this._createMoonEye(moonX, moonY);
                this._moonEye.gfx.setAlpha(0);
                this._moonEye.drawOpen();
                this.tweens.add({
                    targets: this._moonEye.gfx, alpha: 1, duration: 250,
                    onComplete: () => {
                        this._doMoonBlink(() => { moonEggActive = false; });
                    }
                });
            } else {
                this._doMoonBlink(() => { moonEggActive = false; });
            }
        });
    }

    _createMoonEye(moonX, moonY) {
        const eyeX = moonX - 17, eyeY = moonY;
        const noseX = eyeX + 2, noseY = eyeY + 10;
        const gfx = this.add.graphics().setDepth(10);

        const drawNose = () => {
            const a = -40 * Math.PI / 180;
            const cos = Math.cos(a), sin = Math.sin(a);
            const rot = (x, y) => [noseX + 2 + cos * x - sin * y, noseY - 3 + cos * y + sin * x];
            const [x0, y0] = rot(0, 0);
            const [x1, y1] = rot(5, 7);
            const [x2, y2] = rot(-2, 7);
            gfx.fillStyle(0xEEEECC);
            gfx.beginPath();
            gfx.moveTo(x0, y0);
            gfx.lineTo(x1, y1);
            gfx.lineTo(x2, y2);
            gfx.closePath();
            gfx.fillPath();
            gfx.lineStyle(1.4, 0xccccaa);
            gfx.beginPath();
            gfx.moveTo(x0, y0);
            gfx.lineTo(x1, y1);
            gfx.lineTo(x2, y2);
            gfx.strokePath();
        };

        const drawOpen = () => {
            gfx.clear();
            gfx.fillStyle(0xffffff);
            gfx.fillEllipse(eyeX, eyeY, 11, 7);
            gfx.fillStyle(0x443399);
            gfx.fillCircle(eyeX, eyeY, 3);
            gfx.fillStyle(0x111111);
            gfx.fillCircle(eyeX, eyeY, 1.5);
            gfx.fillStyle(0xffffff, 0.8);
            gfx.fillCircle(eyeX + 1, eyeY - 1, 0.8);
            drawNose();
        };

        const drawHalf = () => {
            gfx.clear();
            gfx.fillStyle(0xffffff);
            gfx.fillEllipse(eyeX, eyeY + 0.5, 11, 3);
            gfx.fillStyle(0x443399);
            gfx.fillCircle(eyeX, eyeY + 0.5, 2);
            gfx.fillStyle(0x111111);
            gfx.fillCircle(eyeX, eyeY + 0.5, 1);
            drawNose();
        };

        const drawClosed = () => {
            gfx.clear();
            gfx.lineStyle(1.5, 0xccccaa);
            gfx.beginPath();
            gfx.arc(eyeX, eyeY, 4.5, 0.15 * Math.PI, 0.85 * Math.PI);
            gfx.strokePath();
            drawNose();
        };

        return { gfx, drawOpen, drawHalf, drawClosed };
    }

    _doMoonBlink(onDone) {
        const { drawOpen, drawHalf, drawClosed } = this._moonEye;
        this.time.delayedCall(500, () => {
            drawHalf();
            this.time.delayedCall(60, () => {
                drawClosed();
                this.time.delayedCall(200, () => {
                    drawHalf();
                    this.time.delayedCall(60, () => {
                        drawOpen();
                        if (onDone) onDone();
                    });
                });
            });
        });
    }

    _triggerTentEyes(tentX, tentY, onDone) {
        const doorX = tentX + 2, doorY = tentY - 2;
        const eyes = this.add.graphics().setDepth(9);

        const drawEyes = (pupilOffX, pupilOffY) => {
            eyes.clear();
            eyes.fillStyle(0xffffff);
            eyes.fillCircle(doorX - 4, doorY, 3);
            eyes.fillCircle(doorX + 4, doorY, 3);
            eyes.fillStyle(0x111111);
            eyes.fillCircle(doorX - 4 + pupilOffX, doorY + pupilOffY, 1.5);
            eyes.fillCircle(doorX + 4 + pupilOffX, doorY + pupilOffY, 1.5);
        };

        eyes.setAlpha(0);
        drawEyes(0, 0);
        this.tweens.add({
            targets: eyes, alpha: 1, duration: 200,
            onComplete: () => {
                this.time.delayedCall(400, () => {
                    drawEyes(-1.5, 0);
                    this.time.delayedCall(600, () => {
                        drawEyes(1.5, 0);
                        this.time.delayedCall(600, () => {
                            if (this._ceTriggered) {
                                this._alienRunOut(tentX, tentY, eyes, onDone);
                            } else {
                                drawEyes(0, 0);
                                this.tweens.add({
                                    targets: eyes, alpha: 0, duration: 200,
                                    onComplete: () => { eyes.destroy(); if (onDone) onDone(); }
                                });
                            }
                        });
                    });
                });
            }
        });
    }

    _alienRunOut(tentX, tentY, eyes, onDone) {
        eyes.destroy();

        const groundY = tentY + 8;
        const alien = this.add.graphics().setDepth(7);
        alien.x = tentX + 2;
        alien.y = groundY;

        const drawAlien = (legFrame) => {
            alien.clear();
            // Body
            alien.fillStyle(0x44CC44);
            alien.fillRect(-4, -16, 8, 10);
            // Head
            alien.fillStyle(0x55DD55);
            alien.fillCircle(0, -20, 6);
            // Eyes
            alien.fillStyle(0xffffff);
            alien.fillCircle(-3, -21, 2.5);
            alien.fillCircle(3, -21, 2.5);
            alien.fillStyle(0x111111);
            alien.fillCircle(-3, -21, 1.2);
            alien.fillCircle(3, -21, 1.2);
            // Legs
            alien.fillStyle(0x339933);
            if (legFrame === 0) {
                alien.fillRect(-4, -6, 3, 6);
                alien.fillRect(1, -6, 3, 6);
            } else {
                alien.fillRect(-5, -6, 3, 5);
                alien.fillRect(2, -6, 3, 5);
            }
            // Arms
            alien.fillStyle(0x44CC44);
            alien.fillRect(-7, -14, 3, 2);
            alien.fillRect(4, -14, 3, 2);
        };

        drawAlien(0);
        let legToggle = 0;

        // Start looping flute at high tempo
        const ctx = this._getAudio();
        const fastGap = 0.22;
        const motifDur = this._ceOrder.length * fastGap;
        let musicStartTime = ctx.currentTime;
        const totalRunDuration = 4.5;
        const loopCount = Math.ceil(totalRunDuration / motifDur) + 1;

        for (let rep = 0; rep < loopCount; rep++) {
            const repStart = musicStartTime + rep * motifDur;
            this._ceOrder.forEach((name, i) => {
                const note = this._ceNotes.find(n => n.name === name);
                const dur = 0.2;
                this._playFlute(note.freq, repStart + i * fastGap, dur);
            });
        }

        // Hop out of tent
        this.tweens.add({
            targets: alien, x: tentX - 15, duration: 300,
            ease: 'Quad.easeOut',
            onComplete: () => {
                // Run left around tent and into forest
                const legTimer = this.time.addEvent({
                    delay: 120, loop: true,
                    callback: () => { legToggle = 1 - legToggle; drawAlien(legToggle); }
                });

                // Hop animation while running
                const hopTimer = this.time.addEvent({
                    delay: 240, loop: true,
                    callback: () => {
                        this.tweens.add({
                            targets: alien, y: groundY - 6, duration: 120,
                            yoyo: true, ease: 'Quad.easeOut'
                        });
                    }
                });

                this.tweens.add({
                    targets: alien, x: -40,
                    duration: 3500, ease: 'Sine.easeIn',
                    onComplete: () => {
                        legTimer.destroy();
                        hopTimer.destroy();
                        alien.destroy();
                        if (onDone) onDone();
                    }
                });
            }
        });
    }

    _riseDevilsTower() {
        const cx = W / 2;
        const titleTopY = 118;
        const towerTopY = Math.round(titleTopY / 2);
        const horizonY = H * 0.30;

        const topW = 110, colTopW = 126, colBottomW = 142;
        const colTopY = towerTopY;
        const colBottomY = horizonY + 200;
        const colH = colBottomY - colTopY;

        // Geometry mask — only show the tower above the horizon
        const maskShape = this.make.graphics({ add: false });
        maskShape.fillStyle(0xffffff);
        maskShape.fillRect(0, 0, W, horizonY);
        const mask = maskShape.createGeometryMask();

        const tower = this.add.graphics().setDepth(6);
        tower.setMask(mask);
        const rng = new Phaser.Math.RandomDataGenerator(['tower']);

        // Columnar section (extends well below horizon — mask hides it)
        tower.fillStyle(0x6b5d4f);
        tower.beginPath();
        tower.moveTo(cx - colTopW / 2, colTopY);
        tower.lineTo(cx + colTopW / 2, colTopY);
        tower.lineTo(cx + colBottomW / 2, colBottomY);
        tower.lineTo(cx - colBottomW / 2, colBottomY);
        tower.closePath();
        tower.fill();

        // Vertical column striations
        const numCols = 18;
        for (let i = 0; i <= numCols; i++) {
            const t = i / numCols;
            const topX = cx - colTopW / 2 + t * colTopW;
            const botX = cx - colBottomW / 2 + t * colBottomW;
            const shade = [0x5a4d40, 0x6b5d4f, 0x7a6b5a, 0x4f4238][i % 4];
            tower.lineStyle(rng.pick([1, 1.5, 2]), shade, rng.realInRange(0.3, 0.55));
            tower.lineBetween(topX, colTopY + 4, botX, colBottomY);
        }

        // Horizontal cracks
        for (let j = 0; j < 6; j++) {
            const cy = colTopY + 12 + j * (colH * 0.14);
            const interp = (cy - colTopY) / colH;
            const halfW = (colTopW + (colBottomW - colTopW) * interp) / 2;
            const cxStart = cx - halfW + rng.between(5, 15);
            const cxEnd = cx + halfW - rng.between(5, 15);
            tower.lineStyle(1, 0x3a2e22, rng.realInRange(0.15, 0.3));
            tower.lineBetween(cxStart, cy, cxEnd, cy + rng.between(-2, 2));
        }

        // Left-side shadow
        tower.fillStyle(0x3a2e22, 0.25);
        tower.beginPath();
        tower.moveTo(cx - colTopW / 2, colTopY);
        tower.lineTo(cx - colTopW / 2 + colTopW * 0.28, colTopY);
        tower.lineTo(cx - colBottomW / 2 + colBottomW * 0.28, colBottomY);
        tower.lineTo(cx - colBottomW / 2, colBottomY);
        tower.closePath();
        tower.fill();

        // Flat top surface
        tower.fillStyle(0x7a6b5a);
        tower.fillRect(cx - topW / 2, colTopY - 3, topW, 7);
        tower.lineStyle(1, 0x5a4d40, 0.4);
        tower.lineBetween(cx - topW / 2, colTopY - 3, cx + topW / 2, colTopY - 3);

        // Animate rise from below the horizon
        const riseFrom = horizonY - towerTopY + 10;
        tower.y = riseFrom;
        this.tweens.add({
            targets: tower, y: 0,
            duration: 3500, ease: 'Quad.easeOut'
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
        }).setOrigin(0.5).setDepth(8).setInteractive({ useHandCursor: true });

        t.on('pointerover', () => t.setColor(CLR.gold));
        t.on('pointerout', () => t.setColor(CLR.uiText));
        t.on('pointerdown', cb);
    }
}
