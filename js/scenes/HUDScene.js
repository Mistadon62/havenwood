import { W, H, HABITATS, SPECIES, RARITY_COLOR, CLR, SEASONS, UPGRADES, STAFF_TYPES } from '../GameData.js';

export default class HUDScene extends Phaser.Scene {
    constructor() { super('HUDScene'); }

    create() {
        this.gs = this.scene.get('GameScene');
        this.animalPanel = null;
        this.rescuePopup = null;
        this.upgradePanel = null;
        this.staffPanel = null;
        this.activeBuild = null;

        this.createTopBar();
        this.createToolbar();
        this.listenEvents();
    }

    /* ========== TOP BAR ========== */

    createTopBar() {
        const bar = this.add.graphics();
        bar.fillStyle(CLR.uiBg, 0.9);
        bar.fillRect(0, 0, W, 36);
        bar.lineStyle(1, CLR.uiBorder);
        bar.lineBetween(0, 36, W, 36);

        this.dayTxt = this.txt(12, 11, 'Day 1', 10);
        this.seasonTxt = this.txt(110, 11, 'Spring', 8, '#88CC88');
        this.timeTxt = this.txt(W / 2, 11, '6:00 AM', 10).setOrigin(0.5, 0);

        this.add.text(W / 2 + 80, 20, '', { fontSize: '1px' });

        this.repTxt = this.txt(W - 210, 11, '0', 9, CLR.gold);
        this.repLabel = this.txt(W - 225, 13, '\u2605', 10, CLR.gold);

        this.add.image(W - 145, 18, 'icon_coin').setScale(1.2);
        this.coinTxt = this.txt(W - 130, 11, '500', 10, CLR.gold);

        const saveBtn = this.add.text(W - 42, 12, 'SAVE', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '7px', color: '#88AA88'
        }).setInteractive({ useHandCursor: true });
        saveBtn.on('pointerdown', () => {
            this.gs.saveGame();
            this.notify('Game saved!');
        });
        saveBtn.on('pointerover', function () { this.setColor('#AAFFAA'); });
        saveBtn.on('pointerout', function () { this.setColor('#88AA88'); });
    }

    /* ========== TOOLBAR ========== */

    createToolbar() {
        const barY = H - 56;
        const bar = this.add.graphics();
        bar.fillStyle(CLR.uiBg, 0.9);
        bar.fillRect(0, barY, W, 56);
        bar.lineStyle(1, CLR.uiBorder);
        bar.lineBetween(0, barY, W, barY);

        const buildItems = [
            { key: null, label: 'Select', cost: null, color: 0xAAAAAA },
            ...Object.values(HABITATS).map(h => ({ key: h.id, label: h.name, cost: h.cost, color: h.fill }))
        ];

        const mgmtItems = [
            { key: 'upgrades', label: 'Upgrades', cost: null, color: 0xCCAA33 },
            { key: 'staff', label: 'Staff', cost: null, color: 0x5588BB },
        ];

        const allItems = [...buildItems, ...mgmtItems];
        const gap = Math.min(92, (W - 20) / allItems.length);
        const startX = W / 2 - (allItems.length * gap) / 2 + gap / 2;

        this.toolBtns = [];

        allItems.forEach((item, i) => {
            const x = startX + i * gap;
            const y = barY + 28;

            const bg = this.add.graphics();
            this.drawToolBtn(bg, x, y, item.color, false, gap);

            const hit = this.add.rectangle(x, y, gap - 4, 44, 0, 0).setInteractive({ useHandCursor: true });

            hit.on('pointerover', () => this.drawToolBtn(bg, x, y, item.color, true, gap));
            hit.on('pointerout', () => this.drawToolBtn(bg, x, y, item.color, this.activeBuild === item.key, gap));
            hit.on('pointerdown', () => {
                if (item.key === 'upgrades') { this.toggleUpgradePanel(); return; }
                if (item.key === 'staff') { this.toggleStaffPanel(); return; }
                this.closeAllPanels();
                this.activeBuild = item.key;
                this.toolBtns.forEach(b => this.drawToolBtn(b.bg, b.x, b.y, b.color, b.key === item.key, gap));
                if (item.key) this.gs.enterBuild(item.key);
                else this.gs.exitBuild();
            });

            this.txt(x, y - 8, item.label, 7).setOrigin(0.5);
            if (item.cost !== null) {
                this.txt(x, y + 6, `${item.cost}g`, 6, CLR.gold).setOrigin(0.5);
            }

            this.toolBtns.push({ bg, x, y, color: item.color, key: item.key, gap });
        });
    }

    drawToolBtn(bg, x, y, color, active, gap = 88) {
        const w = gap - 6;
        bg.clear();
        bg.fillStyle(color, active ? 0.5 : 0.22);
        bg.fillRoundedRect(x - w / 2, y - 21, w, 42, 4);
        bg.lineStyle(active ? 2 : 1, color, active ? 1 : 0.5);
        bg.strokeRoundedRect(x - w / 2, y - 21, w, 42, 4);
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
            this.toolBtns.forEach(b => this.drawToolBtn(b.bg, b.x, b.y, b.color, b.key === mode, b.gap));
        });
        ev.on('seasonChanged', () => {});
        ev.on('upgradesUpdate', () => { if (this.upgradePanel) this.showUpgradePanel(); });
        ev.on('staffUpdate', () => { if (this.staffPanel) this.showStaffPanel(); });
    }

    updateTime(d) {
        this.dayTxt.setText(`Day ${d.day}`);
        const sn = SEASONS[d.season];
        this.seasonTxt.setText(sn.name);
        const seasonColors = { spring: '#88CC88', summer: '#CCAA44', autumn: '#CC8844', winter: '#88AACC' };
        this.seasonTxt.setColor(seasonColors[d.season] || '#AAAAAA');

        const hr = Math.floor(d.time / 60);
        const mn = Math.floor(d.time % 60);
        const ap = hr >= 12 ? 'PM' : 'AM';
        const dh = hr > 12 ? hr - 12 : (hr === 0 ? 12 : hr);
        this.timeTxt.setText(`${dh}:${mn.toString().padStart(2, '0')} ${ap}`);

        this.repTxt.setText(d.rep.toString());
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
        const n = this.add.text(W / 2, 52, text, {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '8px', color: CLR.uiText,
            backgroundColor: '#2D1B0EDD',
            padding: { x: 12, y: 7 },
            wordWrap: { width: 550 }
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
        this.closeAllPanels();

        const sp = SPECIES[ev.speciesId];
        const rc = RARITY_COLOR[sp.rarity];
        const cx = W / 2, cy = H / 2;
        const pw = 380, ph = 230;
        const ct = this.add.container(cx, cy).setDepth(300);

        const bg = this.add.graphics();
        bg.fillStyle(0x1a0e04, 0.96);
        bg.fillRoundedRect(-pw / 2, -ph / 2, pw, ph, 8);
        bg.lineStyle(2, rc);
        bg.strokeRoundedRect(-pw / 2, -ph / 2, pw, ph, 8);
        ct.add(bg);

        ct.add(this.txt(0, -ph / 2 + 16, 'RESCUE EVENT!', 12, CLR.gold).setOrigin(0.5));
        ct.add(this.add.image(0, -20, `animal_${ev.speciesId}`).setScale(1.5));
        ct.add(this.txt(0, 18, `${ev.name} the ${sp.name}`, 9).setOrigin(0.5));

        const rClr = '#' + rc.toString(16).padStart(6, '0');
        ct.add(this.txt(0, 34, sp.rarity.toUpperCase(), 7, rClr).setOrigin(0.5));
        if (sp.season) {
            ct.add(this.txt(0, 46, `Seasonal: ${sp.season}`, 6, '#AABB99').setOrigin(0.5));
        }
        ct.add(this.txt(0, 58, ev.msg, 6, '#CCBBAA').setOrigin(0.5).setWordWrapWidth(340));

        const hasSpace = ev.habitat !== null;

        const accBg = this.add.graphics();
        accBg.fillStyle(hasSpace ? 0x228B22 : 0x555555, 0.85);
        accBg.fillRoundedRect(-80, 78, 75, 26, 4);
        ct.add(accBg);

        const accLabel = hasSpace ? 'Rescue!' : 'No Room';
        const accBtn = this.txt(-42, 91, accLabel, 8).setOrigin(0.5);
        if (hasSpace) {
            accBtn.setInteractive({ useHandCursor: true });
            accBtn.on('pointerdown', () => {
                this.game.events.emit('rescueAccepted', ev);
                ct.destroy(); this.rescuePopup = null;
            });
            accBtn.on('pointerover', () => accBtn.setColor(CLR.gold));
            accBtn.on('pointerout', () => accBtn.setColor(CLR.uiText));
        } else {
            accBtn.setColor('#888888');
        }
        ct.add(accBtn);

        const decBg = this.add.graphics();
        decBg.fillStyle(0x8B2222, 0.85);
        decBg.fillRoundedRect(5, 78, 75, 26, 4);
        ct.add(decBg);

        const decBtn = this.txt(42, 91, 'Pass', 8).setOrigin(0.5)
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
        const px = W - 195, py = 44;
        const pw = 185, ph = this.gs.state.upgrades.has('medical_kit') ? 290 : 260;
        const ct = this.add.container(px, py).setDepth(250);

        const bg = this.add.graphics();
        bg.fillStyle(0x1a0e04, 0.94);
        bg.fillRoundedRect(0, 0, pw, ph, 6);
        bg.lineStyle(2, CLR.uiBorder);
        bg.strokeRoundedRect(0, 0, pw, ph, 6);
        ct.add(bg);

        ct.add(this.txt(pw / 2, 12, animal.name, 10, CLR.gold).setOrigin(0.5));

        const rClr = '#' + rc.toString(16).padStart(6, '0');
        ct.add(this.txt(pw / 2, 27, `${sp.name} (${sp.rarity})`, 7, rClr).setOrigin(0.5));
        ct.add(this.add.image(pw / 2, 58, `animal_${animal.speciesId}`).setScale(1.3));

        this.statBar(ct, 10, 88, pw - 20, 'Hunger', animal.hunger, 0xFF9944);
        this.statBar(ct, 10, 108, pw - 20, 'Happy', animal.happiness, 0xFF6B8A);
        this.statBar(ct, 10, 128, pw - 20, 'Health', animal.health, 0x66CC66);

        let btnY = 152;
        this.panelBtn(ct, 8, btnY, 52, 'Feed', 0x44AA44, () => {
            this.gs.feedAnimal(animal.id);
            this.showAnimal(animal);
        });
        this.panelBtn(ct, 66, btnY, 52, 'Pet', 0xCC6688, () => {
            this.gs.petAnimal(animal.id);
            this.showAnimal(animal);
        });
        this.panelBtn(ct, 124, btnY, 52, 'Treat', 0xCCAA33, () => {
            this.gs.treatAnimal(animal.id);
            this.showAnimal(animal);
        });
        ct.add(this.txt(148, btnY + 22, '20g', 5, CLR.gold));

        if (this.gs.state.upgrades.has('medical_kit')) {
            btnY += 30;
            this.panelBtn(ct, 8, btnY, 110, 'Heal (30g)', 0x44AAAA, () => {
                this.gs.healAnimal(animal.id);
                this.showAnimal(animal);
            });
        }

        const closeBtn = this.txt(pw - 8, 4, 'X', 8, '#FF6666')
            .setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
        closeBtn.on('pointerdown', () => { ct.destroy(); this.animalPanel = null; });
        ct.add(closeBtn);

        ct.add(this.txt(pw / 2, ph - 18, `Appeal: ${sp.appeal}`, 6, '#AAAAAA').setOrigin(0.5));

        this.animalPanel = ct;
    }

    statBar(ct, x, y, w, label, val, color) {
        ct.add(this.txt(x, y + 1, label, 6));
        const bg = this.add.graphics();
        bg.fillStyle(0x000000, 0.5);
        bg.fillRect(x + 44, y + 2, w - 56, 8);
        bg.fillStyle(color);
        bg.fillRect(x + 44, y + 2, (w - 56) * Math.max(0, Math.min(1, val / 100)), 8);
        ct.add(bg);
        ct.add(this.txt(x + w - 2, y + 1, Math.round(val).toString(), 6).setOrigin(1, 0));
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

    /* ========== UPGRADES PANEL ========== */

    toggleUpgradePanel() {
        if (this.upgradePanel) { this.upgradePanel.destroy(); this.upgradePanel = null; return; }
        this.closeAllPanels();
        this.showUpgradePanel();
    }

    showUpgradePanel() {
        if (this.upgradePanel) this.upgradePanel.destroy();

        const pw = 320, ph = 360;
        const px = W / 2 - pw / 2, py = 44;
        const ct = this.add.container(px, py).setDepth(280);

        const bg = this.add.graphics();
        bg.fillStyle(0x1a0e04, 0.96);
        bg.fillRoundedRect(0, 0, pw, ph, 8);
        bg.lineStyle(2, 0xCCAA33);
        bg.strokeRoundedRect(0, 0, pw, ph, 8);
        ct.add(bg);

        ct.add(this.txt(pw / 2, 14, 'UPGRADES', 12, CLR.gold).setOrigin(0.5));

        const closeBtn = this.txt(pw - 10, 6, 'X', 8, '#FF6666')
            .setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
        closeBtn.on('pointerdown', () => { ct.destroy(); this.upgradePanel = null; });
        ct.add(closeBtn);

        const entries = Object.values(UPGRADES);
        const owned = this.gs.state.upgrades;
        let yy = 38;

        entries.forEach(up => {
            const isOwned = owned.has(up.id);
            const canBuy = !isOwned && this.gs.state.coins >= up.cost;

            const rowBg = this.add.graphics();
            rowBg.fillStyle(isOwned ? 0x224422 : (canBuy ? 0x332211 : 0x1a1a1a), 0.6);
            rowBg.fillRoundedRect(8, yy, pw - 16, 34, 3);
            ct.add(rowBg);

            ct.add(this.txt(14, yy + 4, up.name, 7, isOwned ? '#66AA66' : CLR.uiText));
            ct.add(this.txt(14, yy + 18, up.desc, 5, '#AAAAAA'));

            if (isOwned) {
                ct.add(this.txt(pw - 18, yy + 10, 'OWNED', 6, '#66AA66').setOrigin(1, 0));
            } else {
                const costTxt = this.txt(pw - 18, yy + 4, `${up.cost}g`, 7, canBuy ? CLR.gold : '#884444').setOrigin(1, 0);
                ct.add(costTxt);

                if (canBuy) {
                    const buyBtn = this.txt(pw - 18, yy + 18, 'BUY', 6, '#44CC44')
                        .setOrigin(1, 0).setInteractive({ useHandCursor: true });
                    buyBtn.on('pointerdown', () => {
                        if (this.gs.buyUpgrade(up.id)) this.showUpgradePanel();
                    });
                    buyBtn.on('pointerover', () => buyBtn.setColor('#88FF88'));
                    buyBtn.on('pointerout', () => buyBtn.setColor('#44CC44'));
                    ct.add(buyBtn);
                }
            }

            yy += 38;
        });

        this.upgradePanel = ct;
    }

    /* ========== STAFF PANEL ========== */

    toggleStaffPanel() {
        if (this.staffPanel) { this.staffPanel.destroy(); this.staffPanel = null; return; }
        this.closeAllPanels();
        this.showStaffPanel();
    }

    showStaffPanel() {
        if (this.staffPanel) this.staffPanel.destroy();

        const pw = 340, currentStaff = this.gs.state.staff;
        const hireRows = Object.keys(STAFF_TYPES).length;
        const ph = 60 + hireRows * 32 + (currentStaff.length > 0 ? 30 + currentStaff.length * 28 : 0) + 16;
        const px = W / 2 - pw / 2, py = 44;
        const ct = this.add.container(px, py).setDepth(280);

        const bg = this.add.graphics();
        bg.fillStyle(0x1a0e04, 0.96);
        bg.fillRoundedRect(0, 0, pw, ph, 8);
        bg.lineStyle(2, 0x5588BB);
        bg.strokeRoundedRect(0, 0, pw, ph, 8);
        ct.add(bg);

        ct.add(this.txt(pw / 2, 14, 'STAFF', 12, CLR.gold).setOrigin(0.5));

        const closeBtn = this.txt(pw - 10, 6, 'X', 8, '#FF6666')
            .setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
        closeBtn.on('pointerdown', () => { ct.destroy(); this.staffPanel = null; });
        ct.add(closeBtn);

        ct.add(this.txt(10, 34, 'HIRE:', 7, '#AAAAAA'));

        let yy = 48;
        Object.values(STAFF_TYPES).forEach(st => {
            const canAfford = this.gs.state.coins >= st.hireCost;

            const rowBg = this.add.graphics();
            rowBg.fillStyle(0x332211, 0.5);
            rowBg.fillRoundedRect(8, yy, pw - 16, 28, 3);
            ct.add(rowBg);

            ct.add(this.txt(14, yy + 4, st.name, 7));
            ct.add(this.txt(14, yy + 16, `${st.desc} | ${st.salary}g/day`, 5, '#AAAAAA'));
            ct.add(this.txt(pw - 60, yy + 4, `${st.hireCost}g`, 7, canAfford ? CLR.gold : '#884444').setOrigin(1, 0));

            if (canAfford) {
                const hireBtn = this.txt(pw - 14, yy + 8, 'HIRE', 6, '#44CC44')
                    .setOrigin(1, 0).setInteractive({ useHandCursor: true });
                hireBtn.on('pointerdown', () => {
                    this.gs.hireStaff(st.id);
                    this.showStaffPanel();
                });
                hireBtn.on('pointerover', () => hireBtn.setColor('#88FF88'));
                hireBtn.on('pointerout', () => hireBtn.setColor('#44CC44'));
                ct.add(hireBtn);
            }

            yy += 32;
        });

        if (currentStaff.length > 0) {
            yy += 6;
            ct.add(this.txt(10, yy, 'CURRENT STAFF:', 7, '#AAAAAA'));
            yy += 16;

            currentStaff.forEach(s => {
                const st = STAFF_TYPES[s.type];
                ct.add(this.txt(14, yy, `${st.name}`, 7, '#CCCCCC'));
                ct.add(this.txt(14, yy + 12, `${st.salary}g/day`, 5, '#AAAAAA'));

                const fireBtn = this.txt(pw - 14, yy + 4, 'FIRE', 6, '#CC4444')
                    .setOrigin(1, 0).setInteractive({ useHandCursor: true });
                fireBtn.on('pointerdown', () => {
                    this.gs.fireStaff(s.id);
                    this.showStaffPanel();
                });
                fireBtn.on('pointerover', () => fireBtn.setColor('#FF6666'));
                fireBtn.on('pointerout', () => fireBtn.setColor('#CC4444'));
                ct.add(fireBtn);

                yy += 26;
            });
        }

        this.staffPanel = ct;
    }

    /* ========== HELPERS ========== */

    closeAllPanels() {
        if (this.animalPanel) { this.animalPanel.destroy(); this.animalPanel = null; }
        if (this.upgradePanel) { this.upgradePanel.destroy(); this.upgradePanel = null; }
        if (this.staffPanel) { this.staffPanel.destroy(); this.staffPanel = null; }
    }

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
