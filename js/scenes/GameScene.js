import { TILE, COLS, ROWS, W, H, TIME_SCALE, START_COINS, HABITATS, SPECIES, RARITY_WEIGHT, RESCUE_MSG, CLR } from '../GameData.js';

export default class GameScene extends Phaser.Scene {
    constructor() { super('GameScene'); }

    init(data) {
        this.isNewGame = data?.newGame !== false;
    }

    create() {
        this.state = {
            day: 1,
            time: 360,
            coins: START_COINS,
            rep: 0,
            buildMode: null,
            habitats: [],
            animals: [],
            discoveries: new Set(),
            stats: { rescued: 0, visitors: 0, earned: 0 }
        };
        this.visitors = [];
        this.grid = [];

        this.createMap();
        this.overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000033, 0).setDepth(100);
        this.preview = this.add.graphics().setDepth(60).setVisible(false);

        this.setupInput();
        this.scene.launch('HUDScene');

        if (!this.isNewGame) this.loadGame();

        this.time.delayedCall(4000, () => this.triggerRescue('cat'));

        this.time.addEvent({ delay: 50000, callback: () => this.triggerRescue(), loop: true });
        this.time.addEvent({ delay: 7000, callback: () => this.trySpawnVisitor(), loop: true });
        this.time.addEvent({ delay: 60000, callback: () => this.saveGame(), loop: true });

        this.game.events.on('rescueAccepted', this.acceptRescue, this);
    }

    /* ========== MAP ========== */

    createMap() {
        for (let y = 0; y < ROWS; y++) {
            this.grid[y] = [];
            for (let x = 0; x < COLS; x++) {
                const isBorder = y === 0 || y === ROWS - 1 || x === 0 || x === COLS - 1;
                const isEntrance = y === ROWS - 1 && x >= 13 && x <= 16;
                const isPath = !isBorder && y === ROWS - 2 && x >= 13 && x <= 16;
                this.grid[y][x] = isEntrance ? 'entrance' : isBorder ? 'fence' : isPath ? 'path' : null;

                const px = x * TILE + TILE / 2;
                const py = y * TILE + TILE / 2;
                if (isEntrance || isPath) {
                    this.add.image(px, py, 'path').setDepth(0);
                } else if (isBorder) {
                    this.add.image(px, py, 'fence').setDepth(0);
                } else {
                    const v = ((x * 7 + y * 13) % 4) + 1;
                    this.add.image(px, py, `grass_${v}`).setDepth(0);
                }
            }
        }

        this.add.text(W / 2, (ROWS - 1) * TILE + TILE / 2, 'ENTRANCE', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '6px', color: '#8B7355'
        }).setOrigin(0.5).setDepth(1);
    }

    /* ========== INPUT ========== */

    setupInput() {
        this.input.on('pointermove', ptr => {
            if (!this.state.buildMode) { this.preview.setVisible(false); return; }
            const gx = Math.floor(ptr.worldX / TILE);
            const gy = Math.floor(ptr.worldY / TILE);
            const ht = HABITATS[this.state.buildMode];
            const ok = this.canPlace(this.state.buildMode, gx, gy);
            const c = ok ? 0x00ff00 : 0xff0000;
            this.preview.clear().setVisible(true);
            this.preview.fillStyle(c, 0.25);
            this.preview.fillRect(gx * TILE, gy * TILE, ht.w * TILE, ht.h * TILE);
            this.preview.lineStyle(2, c, 0.7);
            this.preview.strokeRect(gx * TILE, gy * TILE, ht.w * TILE, ht.h * TILE);
        });

        this.input.on('pointerdown', ptr => {
            if (ptr.rightButtonDown()) { this.exitBuild(); return; }
            if (!this.state.buildMode) return;
            const gx = Math.floor(ptr.worldX / TILE);
            const gy = Math.floor(ptr.worldY / TILE);
            if (this.canPlace(this.state.buildMode, gx, gy)) {
                this.placeHabitat(this.state.buildMode, gx, gy);
            }
        });

        this.input.keyboard.on('keydown-ESC', () => this.exitBuild());
    }

    /* ========== BUILD ========== */

    enterBuild(type) {
        this.state.buildMode = type;
        this.game.events.emit('buildModeChanged', type);
    }

    exitBuild() {
        this.state.buildMode = null;
        this.preview.setVisible(false);
        this.game.events.emit('buildModeChanged', null);
    }

    canPlace(type, gx, gy) {
        const h = HABITATS[type];
        if (gx < 1 || gy < 1 || gx + h.w > COLS - 1 || gy + h.h > ROWS - 2) return false;
        if (this.state.coins < h.cost) return false;
        for (let dy = 0; dy < h.h; dy++)
            for (let dx = 0; dx < h.w; dx++)
                if (this.grid[gy + dy][gx + dx] !== null) return false;
        return true;
    }

    placeHabitat(type, gx, gy, opts = {}) {
        const ht = HABITATS[type];
        const id = opts.id || `hab_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

        for (let dy = 0; dy < ht.h; dy++)
            for (let dx = 0; dx < ht.w; dx++)
                this.grid[gy + dy][gx + dx] = id;

        const gfx = this.add.graphics().setDepth(10);
        const px = gx * TILE, py = gy * TILE;
        const pw = ht.w * TILE, ph = ht.h * TILE;
        gfx.fillStyle(ht.fill, 0.4);
        gfx.fillRect(px, py, pw, ph);
        gfx.lineStyle(2, ht.stroke, 0.9);
        gfx.strokeRect(px + 1, py + 1, pw - 2, ph - 2);

        this.addHabitatDecor(type, gx, gy, ht);

        const label = this.add.text(px + pw / 2, py + 4, ht.name, {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '7px', color: '#FFFFFF',
            stroke: '#000000', strokeThickness: 2
        }).setOrigin(0.5, 0).setDepth(15);

        const hab = { id, type, gx, gy, w: ht.w, h: ht.h, animals: [], gfx, label };
        this.state.habitats.push(hab);

        if (opts.cost !== false) {
            this.spendCoins(ht.cost);
            this.cameras.main.flash(150, 200, 255, 200, true);
        }

        return hab;
    }

    addHabitatDecor(type, gx, gy, ht) {
        const rng = new Phaser.Math.RandomDataGenerator([`${gx}${gy}`]);
        const base = gx * TILE, top = gy * TILE;
        const g = this.add.graphics().setDepth(12);

        if (type === 'forest') {
            for (let i = 0; i < 4; i++) {
                const tx = base + rng.between(8, ht.w * TILE - 8);
                const ty = top + rng.between(16, ht.h * TILE - 8);
                g.fillStyle(0x2a5a2a);
                g.fillCircle(tx, ty - 10, 8);
                g.fillStyle(0x4a3020);
                g.fillRect(tx - 2, ty - 4, 4, 8);
            }
        } else if (type === 'pond') {
            g.fillStyle(0x3a6a9a, 0.5);
            g.fillCircle(base + ht.w * TILE / 2, top + ht.h * TILE / 2 + 4, ht.w * TILE / 3);
            g.fillStyle(0x5a9aca, 0.3);
            g.fillCircle(base + ht.w * TILE / 2 - 5, top + ht.h * TILE / 2, ht.w * TILE / 5);
        } else if (type === 'meadow') {
            for (let i = 0; i < 6; i++) {
                const fx = base + rng.between(6, ht.w * TILE - 6);
                const fy = top + rng.between(14, ht.h * TILE - 6);
                g.fillStyle(rng.pick([0xFFDD44, 0xFF8899, 0xAABBFF, 0xFFFFFF]));
                g.fillCircle(fx, fy, 2);
            }
        } else if (type === 'barn') {
            const bx = base + ht.w * TILE / 2 - 14;
            const by = top + 14;
            g.fillStyle(0x8B4513);
            g.fillRect(bx, by, 28, 20);
            g.fillStyle(0xA0522D);
            g.fillTriangle(bx - 4, by, bx + 14, by - 10, bx + 32, by);
            g.fillStyle(0x444444);
            g.fillRect(bx + 10, by + 8, 8, 12);
        }
    }

    /* ========== ANIMALS ========== */

    addAnimal(speciesId, name, habitatId) {
        const hab = this.state.habitats.find(h => h.id === habitatId);
        if (!hab) return null;
        const sp = SPECIES[speciesId];

        const ax = (hab.gx + 0.5 + Math.random() * (hab.w - 1)) * TILE;
        const ay = (hab.gy + 0.5 + Math.random() * (hab.h - 1)) * TILE;

        const sprite = this.add.image(ax, ay, `animal_${speciesId}`).setDepth(40);
        sprite.setInteractive({ useHandCursor: true });

        const animal = {
            id: `a_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
            speciesId, name, habitatId,
            hunger: 75, happiness: 60, health: 100,
            sprite, tx: ax, ty: ay,
            wTimer: 0, wInterval: Phaser.Math.Between(2000, 6000)
        };

        sprite.on('pointerdown', (ptr) => {
            ptr.event.stopPropagation();
            this.game.events.emit('showAnimalInfo', animal);
        });

        this.state.animals.push(animal);
        hab.animals.push(animal.id);
        return animal;
    }

    updateAnimals(delta) {
        for (const a of this.state.animals) {
            const sp = SPECIES[a.speciesId];

            a.hunger = Math.max(0, a.hunger - sp.hungerRate * delta / 1000);
            if (a.hunger < 20) a.happiness = Math.max(0, a.happiness - 0.4 * delta / 1000);
            a.happiness = Math.max(0, Math.min(100, a.happiness - 0.03 * delta / 1000));

            a.wTimer += delta;
            if (a.wTimer >= a.wInterval) {
                a.wTimer = 0;
                a.wInterval = Phaser.Math.Between(2000, 6000);
                const hab = this.state.habitats.find(h => h.id === a.habitatId);
                if (hab) {
                    a.tx = (hab.gx + 0.5 + Math.random() * (hab.w - 1)) * TILE;
                    a.ty = (hab.gy + 0.5 + Math.random() * (hab.h - 1)) * TILE;
                }
            }

            const dx = a.tx - a.sprite.x;
            const dy = a.ty - a.sprite.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 2) {
                const spd = 18 * delta / 1000;
                a.sprite.x += (dx / dist) * spd;
                a.sprite.y += (dy / dist) * spd;
                a.sprite.setFlipX(dx < 0);
            }

            if (a.hunger < 15 && !a.hungryIcon) {
                a.hungryIcon = this.add.text(0, 0, '!', {
                    fontFamily: '"Press Start 2P", monospace',
                    fontSize: '10px', color: '#FF4444',
                    stroke: '#000', strokeThickness: 2
                }).setDepth(55);
            }
            if (a.hungryIcon) {
                if (a.hunger >= 15) { a.hungryIcon.destroy(); a.hungryIcon = null; }
                else { a.hungryIcon.setPosition(a.sprite.x + 12, a.sprite.y - 16); }
            }
        }
    }

    feedAnimal(id) {
        const a = this.state.animals.find(x => x.id === id);
        if (!a) return;
        a.hunger = Math.min(100, a.hunger + 30);
        a.happiness = Math.min(100, a.happiness + 5);
        this.heartEffect(a.sprite.x, a.sprite.y);
        this.tweens.add({
            targets: a.sprite, y: a.sprite.y - 6,
            yoyo: true, duration: 180, ease: 'Quad.easeOut'
        });
    }

    petAnimal(id) {
        const a = this.state.animals.find(x => x.id === id);
        if (!a) return;
        a.happiness = Math.min(100, a.happiness + 15);
        this.heartEffect(a.sprite.x, a.sprite.y);
        this.tweens.add({
            targets: a.sprite, scaleX: 1.15, scaleY: 0.9,
            yoyo: true, duration: 150
        });
    }

    treatAnimal(id) {
        const a = this.state.animals.find(x => x.id === id);
        if (!a || this.state.coins < 20) return;
        this.spendCoins(20);
        a.hunger = Math.min(100, a.hunger + 15);
        a.happiness = Math.min(100, a.happiness + 25);
        a.health = Math.min(100, a.health + 10);
        this.heartEffect(a.sprite.x, a.sprite.y);
        this.starEffect(a.sprite.x, a.sprite.y);
    }

    heartEffect(x, y) {
        for (let i = 0; i < 3; i++) {
            const h = this.add.image(x + Phaser.Math.Between(-8, 8), y, 'particle_heart')
                .setDepth(55).setScale(0.5).setAlpha(1);
            this.tweens.add({
                targets: h, y: y - 25 - i * 8, alpha: 0, scale: 1.2,
                duration: 700, delay: i * 120, onComplete: () => h.destroy()
            });
        }
    }

    starEffect(x, y) {
        for (let i = 0; i < 2; i++) {
            const s = this.add.image(x + Phaser.Math.Between(-12, 12), y - 5, 'particle_star')
                .setDepth(55).setScale(0.4).setAlpha(1);
            this.tweens.add({
                targets: s, y: y - 30, alpha: 0, scale: 1, angle: 180,
                duration: 600, delay: i * 100, onComplete: () => s.destroy()
            });
        }
    }

    /* ========== TIME ========== */

    updateTime(delta) {
        this.state.time += TIME_SCALE * delta / 1000;
        if (this.state.time >= 1440) {
            this.state.time -= 1440;
            this.state.day++;
            this.game.events.emit('notification', `Day ${this.state.day} begins!`);
        }

        const t = this.state.time;
        let color = 0x000033, alpha = 0;

        if (t >= 300 && t < 420) {
            const p = (t - 300) / 120;
            alpha = 0.18 * (1 - p);
            color = Phaser.Display.Color.GetColor(40 + p * 20 | 0, 20 + p * 30 | 0, 55 - p * 40 | 0);
        } else if (t >= 420 && t < 720) {
            alpha = 0;
        } else if (t >= 720 && t < 1020) {
            alpha = 0.03;
            color = 0x332200;
        } else if (t >= 1020 && t < 1200) {
            const p = (t - 1020) / 180;
            alpha = 0.08 + p * 0.2;
            color = Phaser.Display.Color.GetColor(50 * p | 0, 15 * p | 0, 35 * p | 0);
        } else {
            color = 0x000033;
            alpha = 0.32;
        }

        this.overlay.setFillStyle(color, alpha);
        this.game.events.emit('timeUpdate', { time: this.state.time, day: this.state.day });
    }

    /* ========== VISITORS ========== */

    trySpawnVisitor() {
        const t = this.state.time;
        if (t < 480 || t > 1080) return;
        if (this.state.habitats.length === 0) return;
        if (this.visitors.length >= 8) return;

        const vi = Phaser.Math.Between(0, 3);
        const sprite = this.add.image(15 * TILE, (ROWS - 1) * TILE, `visitor_${vi}`).setDepth(30).setAlpha(0.85);

        const visitor = {
            sprite,
            tx: Phaser.Math.Between(3, COLS - 4) * TILE,
            ty: Phaser.Math.Between(3, ROWS - 4) * TILE,
            speed: Phaser.Math.Between(25, 40),
            timer: 0,
            maxTime: Phaser.Math.Between(12000, 25000),
            phase: 'entering'
        };
        this.visitors.push(visitor);
    }

    updateVisitors(delta) {
        for (let i = this.visitors.length - 1; i >= 0; i--) {
            const v = this.visitors[i];
            v.timer += delta;

            const dx = v.tx - v.sprite.x;
            const dy = v.ty - v.sprite.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 3) {
                const spd = v.speed * delta / 1000;
                v.sprite.x += (dx / dist) * spd;
                v.sprite.y += (dy / dist) * spd;
                v.sprite.setFlipX(dx < 0);
            } else if (v.phase === 'entering') {
                v.phase = 'wandering';
                v.tx = Phaser.Math.Between(3, COLS - 4) * TILE;
                v.ty = Phaser.Math.Between(3, ROWS - 4) * TILE;
            } else if (v.phase === 'wandering') {
                if (v.timer >= v.maxTime) {
                    v.phase = 'leaving';
                    v.tx = 15 * TILE;
                    v.ty = (ROWS - 1) * TILE;
                } else {
                    v.tx = Phaser.Math.Between(3, COLS - 4) * TILE;
                    v.ty = Phaser.Math.Between(3, ROWS - 4) * TILE;
                }
            } else if (v.phase === 'leaving') {
                this.visitorIncome(v);
                v.sprite.destroy();
                this.visitors.splice(i, 1);
            }
        }
    }

    visitorIncome(v) {
        let income = 5;
        const avgHappy = this.state.animals.length > 0
            ? this.state.animals.reduce((s, a) => s + a.happiness, 0) / this.state.animals.length
            : 50;
        income *= (0.5 + avgHappy / 100);

        for (const a of this.state.animals) {
            const sp = SPECIES[a.speciesId];
            income += sp.appeal * 0.5;
        }

        income = Math.round(Math.max(1, income));
        this.addCoins(income);
        this.state.stats.visitors++;

        const txt = this.add.text(v.sprite.x, v.sprite.y - 10, `+${income}`, {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '8px', color: CLR.gold,
            stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5).setDepth(55);
        this.tweens.add({
            targets: txt, y: txt.y - 20, alpha: 0,
            duration: 800, onComplete: () => txt.destroy()
        });
    }

    /* ========== RESCUE ========== */

    triggerRescue(forceSpecies) {
        const sp = forceSpecies ? SPECIES[forceSpecies] : this.pickSpecies();
        const name = Phaser.Utils.Array.GetRandom(sp.names);
        const hab = this.findCompatibleHabitat(sp);

        const tmpl = Phaser.Utils.Array.GetRandom(RESCUE_MSG);
        const msg = tmpl.replace('{name}', name).replace('{species}', sp.name);

        this.game.events.emit('rescueEvent', { speciesId: sp.id, name, habitat: hab, msg });
    }

    pickSpecies() {
        const list = Object.values(SPECIES);
        const weights = list.map(s => RARITY_WEIGHT[s.rarity]);
        const total = weights.reduce((a, b) => a + b, 0);
        let r = Math.random() * total;
        for (let i = 0; i < list.length; i++) {
            r -= weights[i];
            if (r <= 0) return list[i];
        }
        return list[0];
    }

    findCompatibleHabitat(sp) {
        return this.state.habitats.find(h => {
            const ht = HABITATS[h.type];
            return ht.types.includes(sp.type) && h.animals.length < ht.capacity;
        }) || null;
    }

    acceptRescue(ev) {
        const hab = this.findCompatibleHabitat(SPECIES[ev.speciesId]);
        if (!hab) {
            this.game.events.emit('notification', 'No compatible habitat! Build one first.');
            return;
        }

        const animal = this.addAnimal(ev.speciesId, ev.name, hab.id);
        this.state.stats.rescued++;

        if (!this.state.discoveries.has(ev.speciesId)) {
            this.state.discoveries.add(ev.speciesId);
            this.game.events.emit('notification', `New species discovered: ${SPECIES[ev.speciesId].name}!`);
        }

        this.game.events.emit('notification', `${ev.name} the ${SPECIES[ev.speciesId].name} has been rescued!`);
    }

    /* ========== ECONOMY ========== */

    addCoins(n) {
        this.state.coins += n;
        this.state.stats.earned += n;
        this.game.events.emit('coinsUpdate', this.state.coins);
    }

    spendCoins(n) {
        this.state.coins -= n;
        this.game.events.emit('coinsUpdate', this.state.coins);
    }

    /* ========== SAVE / LOAD ========== */

    saveGame() {
        const data = {
            v: 1,
            day: this.state.day,
            time: this.state.time,
            coins: this.state.coins,
            rep: this.state.rep,
            habitats: this.state.habitats.map(h => ({ id: h.id, type: h.type, gx: h.gx, gy: h.gy })),
            animals: this.state.animals.map(a => ({
                id: a.id, speciesId: a.speciesId, name: a.name,
                habitatId: a.habitatId, hunger: a.hunger,
                happiness: a.happiness, health: a.health
            })),
            discoveries: [...this.state.discoveries],
            stats: { ...this.state.stats }
        };
        localStorage.setItem('havenwood_save', JSON.stringify(data));
    }

    loadGame() {
        const raw = localStorage.getItem('havenwood_save');
        if (!raw) return;
        try {
            const d = JSON.parse(raw);
            this.state.day = d.day;
            this.state.time = d.time;
            this.state.coins = d.coins;
            this.state.rep = d.rep || 0;
            this.state.discoveries = new Set(d.discoveries || []);
            this.state.stats = d.stats || { rescued: 0, visitors: 0, earned: 0 };

            for (const h of d.habitats) {
                this.placeHabitat(h.type, h.gx, h.gy, { id: h.id, cost: false });
            }

            for (const a of d.animals) {
                const hab = this.state.habitats.find(h => h.id === a.habitatId);
                if (!hab) continue;
                const animal = this.addAnimal(a.speciesId, a.name, hab.id);
                if (animal) {
                    animal.id = a.id;
                    animal.hunger = a.hunger;
                    animal.happiness = a.happiness;
                    animal.health = a.health;
                }
            }

            this.game.events.emit('coinsUpdate', this.state.coins);
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
        a.href = url;
        a.download = `havenwood_day${this.state.day}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /* ========== UPDATE ========== */

    update(time, delta) {
        this.updateTime(delta);
        this.updateAnimals(delta);
        this.updateVisitors(delta);
    }
}
