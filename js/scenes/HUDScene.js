import { W, H, HABITATS, SPECIES, RARITY_COLOR, CLR } from '../GameData.js';

export default class HUDScene extends Phaser.Scene {
    constructor() { super('HUDScene'); }

    create() {
        this.gs = this.scene.get('GameScene');
        this.animalPanel = null;
        this.rescuePopup = null;
        this.activeBuild = null;

        this.createTopBar();
        this.createToolbar();
        this.listenEvents();
    }

    /* ========== TOP BAR ========== */

    createTopBar() {
        const bar = this.add.graphics();
        bar.fillStyle(CLR.uiBg, 0.88);
        bar.fillRect(0, 0, W, 34);
        bar.lineStyle(1, CLR.uiBorder);
        bar.lineBetween(0, 34, W, 34);

        this.dayTxt = this.txt(12, 10, 'Day 1', 11);
        this.timeTxt = this.txt(W / 2, 10, '6:00 AM', 11).setOrigin(0.5, 0);
        this.add.image(W - 130, 17, 'icon_coin').setScale(1.2);
        this.coinTxt = this.txt(W - 116, 10, '500', 11, CLR.gold);

        this.add.text(W - 40, 10, 'SAVE', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '7px', color: '#88AA88'
        }).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.gs.saveGame();
                this.notify('Game saved!');
            })
            .on('pointerover', function () { this.setColor('#AAFFAA'); })
            .on('pointerout', function () { this.setColor('#88AA88'); });
    }

    /* ========== TOOLBAR ========== */

    createToolbar() {
        const barY = H - 54;
        const bar = this.add.graphics();
        bar.fillStyle(CLR.uiBg, 0.88);
        bar.fillRect(0, barY, W, 54);
        bar.lineStyle(1, CLR.uiBorder);
        bar.lineBetween(0, barY, W, barY);

        const items = [
            { key: null, label: 'Select', cost: null, color: 0xAAAAAA },
            ...Object.values(HABITATS).map(h => ({
                key: h.id, label: h.name, cost: h.cost, color: h.fill
            }))
        ];

        const gap = 100;
        const startX = W / 2 - (items.length * gap) / 2 + gap / 2;

        this.toolBtns = [];

        items.forEach((item, i) => {
            const x = startX + i * gap;
            const y = barY + 27;

            const bg = this.add.graphics();
            this.drawToolBtn(bg, x, y, item.color, false);

            const hit = this.add.rectangle(x, y, 88, 42, 0, 0).setInteractive({ useHandCursor: true });

            hit.on('pointerover', () => this.drawToolBtn(bg, x, y, item.color, true));
            hit.on('pointerout', () => this.drawToolBtn(bg, x, y, item.color, this.activeBuild === item.key));
            hit.on('pointerdown', () => {
                this.activeBuild = item.key;
                this.toolBtns.forEach(b => this.drawToolBtn(b.bg, b.x, b.y, b.color, b.key === item.key));
                if (item.key) this.gs.enterBuild(item.key);
                else this.gs.exitBuild();
            });

            this.txt(x, y - 8, item.label, 7).setOrigin(0.5);
            if (item.cost !== null) {
                this.txt(x, y + 6, `${item.cost}g`, 7, CLR.gold).setOrigin(0.5);
            }

            this.toolBtns.push({ bg, x, y, color: item.color, key: item.key });
        });
    }

    drawToolBtn(bg, x, y, color, active) {
        bg.clear();
        bg.fillStyle(color, active ? 0.5 : 0.25);
        bg.fillRoundedRect(x - 44, y - 21, 88, 42, 4);
        bg.lineStyle(active ? 2 : 1, color, active ? 1 : 0.6);
        bg.strokeRoundedRect(x - 44, y - 21, 88, 42, 4);
    }

    /* ========== EVENTS ========== */

    listenEvents() {
        const ev = this.game.events;
        ev.on('timeUpdate', this.updateTime, this);
        ev.on('coinsUpdate', this.updateCoins, this);
        ev.on('rescueEvent', this.showRescue, this);
        ev.on('showAnimalInfo', this.showAnimal, this);
        ev.on('notification', this.notify, this);
        ev.on('buildModeChanged', mode => {
            this.activeBuild = mode;
            this.toolBtns.forEach(b => this.drawToolBtn(b.bg, b.x, b.y, b.color, b.key === mode));
        });
    }

    updateTime(d) {
        this.dayTxt.setText(`Day ${d.day}`);
        const hr = Math.floor(d.time / 60);
        const mn = Math.floor(d.time % 60);
        const ap = hr >= 12 ? 'PM' : 'AM';
        const dh = hr > 12 ? hr - 12 : (hr === 0 ? 12 : hr);
        this.timeTxt.setText(`${dh}:${mn.toString().padStart(2, '0')} ${ap}`);
    }

    updateCoins(c) {
        this.coinTxt.setText(c.toString());
        this.tweens.add({
            targets: this.coinTxt, scaleX: 1.3, scaleY: 1.3,
            yoyo: true, duration: 150
        });
    }

    /* ========== NOTIFICATIONS ========== */

    notify(text) {
        const n = this.add.text(W / 2, 50, text, {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '9px', color: CLR.uiText,
            backgroundColor: '#2D1B0EDD',
            padding: { x: 12, y: 8 },
            wordWrap: { width: 500 }
        }).setOrigin(0.5).setAlpha(0).setDepth(200);

        this.tweens.add({ targets: n, alpha: 1, y: n.y - 8, duration: 300 });
        this.tweens.add({
            targets: n, alpha: 0, y: n.y - 30,
            delay: 3500, duration: 500, onComplete: () => n.destroy()
        });
    }

    /* ========== RESCUE POPUP ========== */

    showRescue(ev) {
        if (this.rescuePopup) this.rescuePopup.destroy();

        const sp = SPECIES[ev.speciesId];
        const rc = RARITY_COLOR[sp.rarity];
        const cx = W / 2, cy = H / 2;
        const pw = 380, ph = 220;
        const ct = this.add.container(cx, cy).setDepth(300);

        const bg = this.add.graphics();
        bg.fillStyle(0x1a0e04, 0.96);
        bg.fillRoundedRect(-pw / 2, -ph / 2, pw, ph, 8);
        bg.lineStyle(2, rc);
        bg.strokeRoundedRect(-pw / 2, -ph / 2, pw, ph, 8);
        ct.add(bg);

        ct.add(this.txt(0, -ph / 2 + 16, 'RESCUE EVENT!', 12, CLR.gold).setOrigin(0.5));
        ct.add(this.add.image(0, -20, `animal_${ev.speciesId}`).setScale(1.5));
        ct.add(this.txt(0, 20, `${ev.name} the ${sp.name}`, 9).setOrigin(0.5));

        const rarTxt = sp.rarity.toUpperCase();
        const rLabel = this.txt(0, 35, rarTxt, 7, '#' + rc.toString(16).padStart(6, '0')).setOrigin(0.5);
        ct.add(rLabel);

        ct.add(this.txt(0, 52, ev.msg, 7, '#CCBBAA').setOrigin(0.5).setWordWrapWidth(340));

        const hasSpace = ev.habitat !== null;

        const accBg = this.add.graphics();
        accBg.fillStyle(hasSpace ? 0x228B22 : 0x555555, 0.85);
        accBg.fillRoundedRect(-75, 75, 70, 26, 4);
        ct.add(accBg);

        const accBtn = this.txt(-40, 88, hasSpace ? 'Rescue!' : 'No Room', 8)
            .setOrigin(0.5);
        if (hasSpace) {
            accBtn.setInteractive({ useHandCursor: true });
            accBtn.on('pointerdown', () => {
                this.game.events.emit('rescueAccepted', ev);
                ct.destroy();
                this.rescuePopup = null;
            });
            accBtn.on('pointerover', () => accBtn.setColor(CLR.gold));
            accBtn.on('pointerout', () => accBtn.setColor(CLR.uiText));
        } else {
            accBtn.setColor('#888888');
        }
        ct.add(accBtn);

        const decBg = this.add.graphics();
        decBg.fillStyle(0x8B2222, 0.85);
        decBg.fillRoundedRect(5, 75, 70, 26, 4);
        ct.add(decBg);

        const decBtn = this.txt(40, 88, 'Pass', 8).setOrigin(0.5)
            .setInteractive({ useHandCursor: true });
        decBtn.on('pointerdown', () => { ct.destroy(); this.rescuePopup = null; });
        decBtn.on('pointerover', () => decBtn.setColor('#FF8888'));
        decBtn.on('pointerout', () => decBtn.setColor(CLR.uiText));
        ct.add(decBtn);

        ct.setScale(0);
        this.tweens.add({ targets: ct, scaleX: 1, scaleY: 1, duration: 280, ease: 'Back.easeOut' });
        this.rescuePopup = ct;
    }

    /* ========== ANIMAL INFO PANEL ========== */

    showAnimal(animal) {
        if (this.animalPanel) this.animalPanel.destroy();
        if (this.rescuePopup) return;

        const sp = SPECIES[animal.speciesId];
        const rc = RARITY_COLOR[sp.rarity];
        const px = W - 190, py = 44;
        const pw = 180, ph = 260;
        const ct = this.add.container(px, py).setDepth(250);

        const bg = this.add.graphics();
        bg.fillStyle(0x1a0e04, 0.94);
        bg.fillRoundedRect(0, 0, pw, ph, 6);
        bg.lineStyle(2, CLR.uiBorder);
        bg.strokeRoundedRect(0, 0, pw, ph, 6);
        ct.add(bg);

        ct.add(this.txt(pw / 2, 12, animal.name, 10, CLR.gold).setOrigin(0.5));
        ct.add(this.txt(pw / 2, 28, sp.name, 7, '#' + rc.toString(16).padStart(6, '0')).setOrigin(0.5));
        ct.add(this.add.image(pw / 2, 60, `animal_${animal.speciesId}`).setScale(1.3));

        this.statBar(ct, 10, 90, pw - 20, 'Hunger', animal.hunger, 0xFF9944);
        this.statBar(ct, 10, 112, pw - 20, 'Happy', animal.happiness, 0xFF6B8A);
        this.statBar(ct, 10, 134, pw - 20, 'Health', animal.health, 0x66CC66);

        this.panelBtn(ct, 8, 160, 50, 'Feed', 0x44AA44, () => {
            this.gs.feedAnimal(animal.id);
            this.showAnimal(animal);
        });
        this.panelBtn(ct, 64, 160, 50, 'Pet', 0xCC6688, () => {
            this.gs.petAnimal(animal.id);
            this.showAnimal(animal);
        });
        this.panelBtn(ct, 120, 160, 50, 'Treat', 0xCCAA33, () => {
            this.gs.treatAnimal(animal.id);
            this.showAnimal(animal);
        });

        ct.add(this.txt(120, 188, '20g', 6, CLR.gold));

        const closeBtn = this.txt(pw - 8, 4, 'X', 8, '#FF6666')
            .setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
        closeBtn.on('pointerdown', () => { ct.destroy(); this.animalPanel = null; });
        ct.add(closeBtn);

        const rarLabel = sp.rarity.charAt(0).toUpperCase() + sp.rarity.slice(1);
        ct.add(this.txt(pw / 2, 200, rarLabel, 7, '#' + rc.toString(16).padStart(6, '0')).setOrigin(0.5));

        ct.add(this.txt(pw / 2, 220, `Appeal: ${sp.appeal}`, 7, '#AAAAAA').setOrigin(0.5));
        ct.add(this.txt(pw / 2, 238, `Habitat: ${animal.habitatId.slice(0, 12)}...`, 5, '#777777').setOrigin(0.5));

        this.animalPanel = ct;
    }

    statBar(ct, x, y, w, label, val, color) {
        ct.add(this.txt(x, y, label, 7));
        const bg = this.add.graphics();
        bg.fillStyle(0x000000, 0.5);
        bg.fillRect(x + 44, y + 2, w - 44, 8);
        bg.fillStyle(color);
        bg.fillRect(x + 44, y + 2, (w - 44) * Math.max(0, Math.min(1, val / 100)), 8);
        ct.add(bg);
        ct.add(this.txt(x + w - 2, y, Math.round(val).toString(), 7).setOrigin(1, 0));
    }

    panelBtn(ct, x, y, w, label, color, cb) {
        const bg = this.add.graphics();
        bg.fillStyle(color, 0.55);
        bg.fillRoundedRect(x, y, w, 22, 3);
        ct.add(bg);

        const btn = this.txt(x + w / 2, y + 11, label, 7)
            .setOrigin(0.5).setInteractive({ useHandCursor: true });
        btn.on('pointerdown', cb);
        btn.on('pointerover', () => {
            bg.clear(); bg.fillStyle(color, 0.8); bg.fillRoundedRect(x, y, w, 22, 3);
        });
        btn.on('pointerout', () => {
            bg.clear(); bg.fillStyle(color, 0.55); bg.fillRoundedRect(x, y, w, 22, 3);
        });
        ct.add(btn);
    }

    /* ========== HELPERS ========== */

    txt(x, y, text, size, color) {
        return this.add.text(x, y, text, {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: `${size}px`,
            color: color || CLR.uiText,
            stroke: '#000000',
            strokeThickness: size > 9 ? 2 : 1
        });
    }
}
