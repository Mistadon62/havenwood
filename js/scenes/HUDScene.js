// UI overlay scene running parallel to GameScene. Has its own camera, unaffected by GameScene zoom.
// Communicates via this.game.events; this.gs = GameScene reference for state and method calls.
// Manages toolbar (hidden during habitat zoom), habitat/animal panels, rescue popup with time-pause,
// build popup, and management panels (upgrades, staff, missions, research, journal).
import { W, H, HABITATS, SPECIES, RARITY_COLOR, CLR, SEASONS, UPGRADES, STAFF_TYPES,
    TRAITS, ILLNESSES, ENRICHMENTS, MISSIONS, VISITOR_TYPES, ACHIEVEMENTS,
    RESEARCH, RESEARCH_BRANCHES } from '../GameData.js';

export default class HUDScene extends Phaser.Scene {
    constructor() { super('HUDScene'); }

    create() {
        this.gs = this.scene.get('GameScene');
        this.animalPanel = null;
        this.rescuePopup = null;
        this.upgradePanel = null;
        this.staffPanel = null;
        this.missionPanel = null;
        this.journalPanel = null;
        this.habitatPanel = null;
        this.researchPanel = null;
        this.buildPopup = null;
        this.activeBuild = null;

        this.createTopBar();
        this.createToolbar();
        this.listenEvents();

        this.time.delayedCall(0, () => this.syncState());
    }

    // Syncs HUD display from GameScene state (coins, time, research points).
    syncState() {
        const s = this.gs.state;
        this.updateCoins(s.coins);
        this.updateTime({ time: s.time, day: s.day, season: s.season, rep: s.rep });
        this.rpTxt.setText(s.researchPoints.toString());
    }

    /* ========== TOP BAR ========== */

    // Day, season, clock, reputation star, research icon, coins, save button.
    createTopBar() {
        const bar = this.add.graphics();
        bar.fillStyle(CLR.uiBg, 0.9); bar.fillRect(0, 0, W, 42);
        bar.lineStyle(1, CLR.uiBorder); bar.lineBetween(0, 42, W, 42);

        this.dayTxt = this.txt(12, 12, 'Day 1', 10);
        this.seasonTxt = this.txt(130, 12, 'Spring', 8, '#88CC88');
        this.timeTxt = this.txt(W / 2, 12, '6:00 AM', 10).setOrigin(0.5, 0);
        this.add.image(W - 280, 21, 'icon_research').setScale(1.2);
        this.rpTxt = this.txt(W - 268, 12, '0', 9, '#44DDAA');
        this.repTxt = this.txt(W - 210, 12, '0', 9, CLR.gold);
        this.repLabel = this.txt(W - 228, 14, '\u2605', 10, CLR.gold);
        this.add.image(W - 140, 21, 'icon_coin').setScale(1.4);
        this.coinTxt = this.txt(W - 124, 12, '', 10, CLR.gold);

        const saveBtn = this.txt(W - 50, 14, 'SAVE', 7, '#88AA88').setInteractive({ useHandCursor: true });
        saveBtn.on('pointerdown', () => { this.gs.saveGame(); this.notify('Game saved!'); });
        saveBtn.on('pointerover', function () { this.setColor('#AAFFAA'); });
        saveBtn.on('pointerout', function () { this.setColor('#88AA88'); });
    }

    /* ========== TOOLBAR ========== */

    // Bottom bar: Build (opens habitat popup) and management toggles (Missions, Upgrades, Staff, Research, Journal).
    // All elements stored in toolbarElements for hide/show during habitat zoom.
    createToolbar() {
        const barY = H - 62;
        this.toolbarElements = [];
        const bar = this.add.graphics();
        bar.fillStyle(CLR.uiBg, 0.9); bar.fillRect(0, barY, W, 62);
        bar.lineStyle(1, CLR.uiBorder); bar.lineBetween(0, barY, W, barY);
        this.toolbarElements.push(bar);

        const allItems = [
            { key: 'build', label: 'Build', cost: null, color: 0x66BB55 },
            { key: 'missions', label: 'Missions', cost: null, color: 0x66AA66 },
            { key: 'upgrades', label: 'Upgrades', cost: null, color: 0xCCAA33 },
            { key: 'staff', label: 'Staff', cost: null, color: 0x5588BB },
            { key: 'research', label: 'Research', cost: null, color: 0x44DDAA },
            { key: 'journal', label: 'Journal', cost: null, color: 0xAA77CC },
        ];
        const gap = Math.min(130, (W - 10) / allItems.length);
        const startX = W / 2 - (allItems.length * gap) / 2 + gap / 2;

        this.toolBtns = [];
        allItems.forEach((item, i) => {
            const x = startX + i * gap, y = barY + 31;
            const bg = this.add.graphics();
            this.drawToolBtn(bg, x, y, item.color, false, gap);
            this.toolbarElements.push(bg);
            const hit = this.add.rectangle(x, y, gap - 4, 50, 0, 0).setInteractive({ useHandCursor: true });
            this.toolbarElements.push(hit);
            hit.on('pointerover', () => this.drawToolBtn(bg, x, y, item.color, true, gap));
            hit.on('pointerout', () => {
                const isActive = item.key === this.activeBuild ||
                    (item.key === 'build' && this.activeBuild && HABITATS[this.activeBuild]);
                this.drawToolBtn(bg, x, y, item.color, isActive, gap);
            });
            hit.on('pointerdown', () => {
                if (item.key === 'build') { this.toggleBuildPopup(x, barY); return; }
                if (item.key === 'upgrades') { this.togglePanel('upgradePanel', () => this.showUpgradePanel()); return; }
                if (item.key === 'staff') { this.togglePanel('staffPanel', () => this.showStaffPanel()); return; }
                if (item.key === 'missions') { this.togglePanel('missionPanel', () => this.showMissionPanel()); return; }
                if (item.key === 'research') { this.togglePanel('researchPanel', () => this.showResearchPanel()); return; }
                if (item.key === 'journal') { this.togglePanel('journalPanel', () => this.showJournalPanel()); return; }
                this.closeAllPanels();
                this.activeBuild = item.key;
                this.toolBtns.forEach(b => this.drawToolBtn(b.bg, b.x, b.y, b.color, b.key === item.key, gap));
                if (item.key) this.gs.enterBuild(item.key);
                else this.gs.exitBuild();
            });
            const lbl = this.txt(x, item.cost !== null ? y - 6 : y, item.label, 6).setOrigin(0.5);
            this.toolbarElements.push(lbl);
            if (item.cost !== null) {
                const costTxt = this.txt(x, y + 8, `${item.cost}g`, 5, CLR.gold).setOrigin(0.5);
                this.toolbarElements.push(costTxt);
            }
            this.toolBtns.push({ bg, x, y, color: item.color, key: item.key, gap });
        });
    }

    hideToolbar() { if (this.toolbarElements) this.toolbarElements.forEach(e => e.setVisible(false)); }
    showToolbar() { if (this.toolbarElements) this.toolbarElements.forEach(e => e.setVisible(true)); }
    destroyBackBar() { if (this._backBarElements) { this._backBarElements.forEach(e => e.destroy()); this._backBarElements = null; } }

    // Draws a single toolbar button with active/hover state.
    drawToolBtn(bg, x, y, color, active, gap = 88) {
        const w = gap - 6;
        bg.clear();
        bg.fillStyle(color, active ? 0.5 : 0.22);
        bg.fillRoundedRect(x - w / 2, y - 23, w, 46, 4);
        bg.lineStyle(active ? 2 : 1, color, active ? 1 : 0.5);
        bg.strokeRoundedRect(x - w / 2, y - 23, w, 46, 4);
    }

    /* ========== BUILD POPUP ========== */
    // Habitat selection popup above toolbar. Unaffordable habitats are greyed out and non-interactive.

    toggleBuildPopup(anchorX, barY) {
        if (this.buildPopup) { this.closeBuildPopup(); return; }
        this.closeAllPanels();

        this._buildDismiss = this.add.rectangle(W / 2, H / 2, W, H, 0, 0)
            .setInteractive().setDepth(259);
        this._buildDismiss.on('pointerdown', () => this.closeBuildPopup());

        const habitats = Object.values(HABITATS);
        const cellW = 105, pad = 16;
        const pw = habitats.length * cellW + pad * 2;
        const ph = 76;
        const px = Math.round((W - pw) / 2);
        const py = barY - ph - 10;

        const ct = this.add.container(px, py).setDepth(260);
        const bg = this.add.graphics();
        bg.fillStyle(CLR.uiBg, 0.96);
        bg.fillRoundedRect(0, 0, pw, ph, 6);
        bg.lineStyle(2, 0x66BB55);
        bg.strokeRoundedRect(0, 0, pw, ph, 6);
        ct.add(bg);

        habitats.forEach((h, i) => {
            const bx = pad + i * cellW + cellW / 2;
            const by = ph / 2;
            const cost = this.gs.getHabitatCost(h.id);
            const canAfford = this.gs.state.coins >= cost;
            const rx = bx - cellW / 2 + 4, ry = by - 30, rw = cellW - 8, rh = 60;

            const btnBg = this.add.graphics();
            btnBg.fillStyle(canAfford ? h.fill : 0x444444, canAfford ? 0.3 : 0.25);
            btnBg.fillRoundedRect(rx, ry, rw, rh, 4);
            ct.add(btnBg);

            ct.add(this.txt(bx, by - 12, h.name, 7, canAfford ? CLR.uiText : '#666666').setOrigin(0.5));
            ct.add(this.txt(bx, by + 6, `${cost}g`, 6, canAfford ? CLR.gold : '#884444').setOrigin(0.5));

            if (canAfford) {
                const hit = this.add.rectangle(bx, by, rw, rh, 0, 0).setInteractive({ useHandCursor: true });
                hit.on('pointerover', () => {
                    btnBg.clear();
                    btnBg.fillStyle(h.fill, 0.55);
                    btnBg.fillRoundedRect(rx, ry, rw, rh, 4);
                    btnBg.lineStyle(1, h.fill, 0.8);
                    btnBg.strokeRoundedRect(rx, ry, rw, rh, 4);
                });
                hit.on('pointerout', () => {
                    btnBg.clear();
                    btnBg.fillStyle(h.fill, 0.3);
                    btnBg.fillRoundedRect(rx, ry, rw, rh, 4);
                });
                hit.on('pointerdown', () => {
                    this.closeBuildPopup();
                    this.gs.enterBuild(h.id);
                });
                ct.add(hit);
            }
        });

        ct.setScale(0.85).setAlpha(0);
        this.tweens.add({ targets: ct, scaleX: 1, scaleY: 1, alpha: 1, duration: 150, ease: 'Back.easeOut' });
        this.buildPopup = ct;
    }

    closeBuildPopup() {
        if (this._buildDismiss) { this._buildDismiss.destroy(); this._buildDismiss = null; }
        if (this.buildPopup) { this.buildPopup.destroy(); this.buildPopup = null; }
    }

    /* ========== EVENTS ========== */

    // Subscribes to game events: timeUpdate, coinsUpdate, rescueEvent, showAnimalInfo, showHabitatInfo,
    // animalUpdate (auto-refreshes animal panel), habitatViewClosed (cleanup on zoom-out), etc.
    listenEvents() {
        const ev = this.game.events;
        ev.on('timeUpdate', this.updateTime, this);
        ev.on('coinsUpdate', this.updateCoins, this);
        ev.on('rescueEvent', this.showRescue, this);
        ev.on('showAnimalInfo', this.showAnimal, this);
        ev.on('showHabitatInfo', this.showHabitatPanel, this);
        ev.on('notification', this.notify, this);
        ev.on('buildModeChanged', mode => {
            this.activeBuild = mode;
            if (!mode) this.closeBuildPopup();
            this.toolBtns.forEach(b => {
                const isActive = b.key === mode ||
                    (b.key === 'build' && mode && HABITATS[mode]);
                this.drawToolBtn(b.bg, b.x, b.y, b.color, isActive, b.gap);
            });
        });
        ev.on('habitatViewClosed', () => {
            if (this.habitatPanel) { this.habitatPanel.destroy(); this.habitatPanel = null; }
            if (this.animalPanel) { this.animalPanel.destroy(); this.animalPanel = null; this._viewedAnimal = null; }
            this.destroyBackBar();
            this.showToolbar();
        });
        ev.on('animalUpdate', () => {
            if (this.animalPanel && this._viewedAnimal) {
                const fresh = this.gs.state.animals.find(a => a.id === this._viewedAnimal.id);
                if (fresh) this.showAnimal(fresh);
            }
        });
        ev.on('seasonChanged', () => {});
        ev.on('upgradesUpdate', () => { if (this.upgradePanel) this.showUpgradePanel(); });
        ev.on('staffUpdate', () => { if (this.staffPanel) this.showStaffPanel(); });
        ev.on('missionsUpdate', () => { if (this.missionPanel) this.showMissionPanel(); });
        ev.on('achievementEarned', () => { if (this.journalPanel) this.showJournalPanel(); });
        ev.on('researchUpdate', () => {
            this.rpTxt.setText(this.gs.state.researchPoints.toString());
            if (this.researchPanel) this.showResearchPanel();
        });
    }

    // Updates day, season, clock, reputation display.
    updateTime(d) {
        this.dayTxt.setText(`Day ${d.day}`);
        const sn = SEASONS[d.season];
        this.seasonTxt.setText(sn.name);
        const seasonColors = { spring: '#88CC88', summer: '#CCAA44', autumn: '#CC8844', winter: '#88AACC' };
        this.seasonTxt.setColor(seasonColors[d.season] || '#AAAAAA');
        const hr = Math.floor(d.time / 60), mn = Math.floor(d.time % 60);
        const ap = hr >= 12 ? 'PM' : 'AM';
        const dh = hr > 12 ? hr - 12 : (hr === 0 ? 12 : hr);
        this.timeTxt.setText(`${dh}:${mn.toString().padStart(2, '0')} ${ap}`);
        this.repTxt.setText(d.rep.toString());
    }

    // Updates coin display with brief scale pulse.
    updateCoins(c) {
        this.coinTxt.setText(c.toString());
        this.tweens.add({ targets: this.coinTxt, scaleX: 1.3, scaleY: 1.3, yoyo: true, duration: 150 });
    }

    /* ========== NOTIFICATIONS ========== */

    // Queued toast notifications; displayed one at a time, auto-dismiss with fade.
    notify(text) {
        if (!this._notifQueue) this._notifQueue = [];
        this._notifQueue.push(text);
        if (!this._notifActive) this._showNextNotif();
    }

    _showNextNotif() {
        if (!this._notifQueue || this._notifQueue.length === 0) { this._notifActive = false; return; }
        this._notifActive = true;
        const text = this._notifQueue.shift();
        const topY = 50;

        const n = this.add.text(W / 2, topY + 8, text, {
            fontFamily: '"Press Start 2P", monospace', fontSize: '9px', color: CLR.uiText,
            stroke: '#000000', strokeThickness: 2,
            backgroundColor: '#2D1B0EDD', padding: { x: 14, y: 8 }, wordWrap: { width: 580 }
        }).setOrigin(0.5, 0).setAlpha(0).setDepth(200);

        this.tweens.add({ targets: n, alpha: 1, y: topY, duration: 300 });
        this.tweens.add({
            targets: n, alpha: 0, y: topY - 12,
            delay: 2400, duration: 400,
            onComplete: () => { n.destroy(); this._showNextNotif(); }
        });
    }

    /* ========== RESCUE POPUP ========== */

    // Modal with rescued animal details; Accept/Pass buttons. Pauses game time (rescuePaused),
    // dims the screen with a grey tint, and preserves any open habitat/animal panels.
    showRescue(ev) {
        if (this.rescuePopup) this.rescuePopup.destroy();
        if (this._rescueTint) this._rescueTint.destroy();
        this.gs.state.rescuePaused = true;
        if (this.gs.rescueTimer) this.gs.rescueTimer.paused = true;

        this._rescueTint = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.45).setDepth(295);
        const tint = this._rescueTint;

        const sp = SPECIES[ev.speciesId], rc = RARITY_COLOR[sp.rarity];
        const cx = W / 2, cy = H / 2, pw = 420, ph = 260;
        const ct = this.add.container(cx, cy).setDepth(300);
        const bg = this.add.graphics();
        bg.fillStyle(0x1a0e04, 0.96); bg.fillRoundedRect(-pw / 2, -ph / 2, pw, ph, 8);
        bg.lineStyle(2, rc); bg.strokeRoundedRect(-pw / 2, -ph / 2, pw, ph, 8);
        ct.add(bg);
        ct.add(this.txt(0, -ph / 2 + 18, 'RESCUE EVENT!', 12, CLR.gold).setOrigin(0.5));
        ct.add(this.add.image(0, -22, `animal_${ev.speciesId}`).setScale(1.5));
        ct.add(this.txt(0, 16, `${ev.name} the ${sp.name}`, 9).setOrigin(0.5));
        const rClr = '#' + rc.toString(16).padStart(6, '0');
        ct.add(this.txt(0, 34, sp.rarity.toUpperCase(), 7, rClr).setOrigin(0.5));
        if (sp.season) ct.add(this.txt(0, 50, `Seasonal: ${sp.season}`, 6, '#AABB99').setOrigin(0.5));
        ct.add(this.txt(0, 64, ev.msg, 6, '#CCBBAA').setOrigin(0.5).setWordWrapWidth(380));
        const hasSpace = ev.habitat !== null;
        const accBg = this.add.graphics();
        accBg.fillStyle(hasSpace ? 0x228B22 : 0x555555, 0.85); accBg.fillRoundedRect(-90, 88, 85, 30, 4);
        ct.add(accBg);
        const accLabel = hasSpace ? 'Rescue!' : 'No Room';
        const accBtn = this.txt(-47, 103, accLabel, 8).setOrigin(0.5);
        const dismissRescue = () => {
            tint.destroy(); ct.destroy(); this.rescuePopup = null; this._rescueTint = null;
            this.gs.state.rescuePaused = false;
            if (this.gs.rescueTimer) this.gs.rescueTimer.paused = false;
        };
        if (hasSpace) {
            accBtn.setInteractive({ useHandCursor: true });
            accBtn.on('pointerdown', () => { dismissRescue(); this.game.events.emit('rescueAccepted', ev); });
            accBtn.on('pointerover', () => accBtn.setColor(CLR.gold));
            accBtn.on('pointerout', () => accBtn.setColor(CLR.uiText));
        } else { accBtn.setColor('#888888'); }
        ct.add(accBtn);
        const decBg = this.add.graphics();
        decBg.fillStyle(0x8B2222, 0.85); decBg.fillRoundedRect(5, 88, 85, 30, 4);
        ct.add(decBg);
        const decBtn = this.txt(47, 103, 'Pass', 8).setOrigin(0.5).setInteractive({ useHandCursor: true });
        decBtn.on('pointerdown', () => { dismissRescue(); });
        decBtn.on('pointerover', () => decBtn.setColor('#FF8888'));
        decBtn.on('pointerout', () => decBtn.setColor(CLR.uiText));
        ct.add(decBtn);
        ct.setScale(0);
        this.tweens.add({ targets: ct, scaleX: 1, scaleY: 1, duration: 280, ease: 'Back.easeOut' });
        this.rescuePopup = ct;
    }

    /* ========== ANIMAL INFO PANEL ========== */

    // Selected animal: stats, trait, illness, breed status, bonds, actions (Feed, Pet, Treat, Heal, Breed).
    // Only shown when zoomed into a habitat. Tracks _viewedAnimal for auto-refresh via animalUpdate event.
    showAnimal(animal) {
        if (this.animalPanel) this.animalPanel.destroy();
        if (this.rescuePopup) return;
        this._viewedAnimal = animal;

        const sp = SPECIES[animal.speciesId], rc = RARITY_COLOR[sp.rarity];
        const pw = 230, px = W - pw - 6, py = 48;
        const hasHeal = this.gs.state.upgrades.has('medical_kit') || animal.illness;
        const canBreed = this.gs.canBreed(animal);

        const ct = this.add.container(px, py).setDepth(250);

        ct.add(this.txt(pw / 2, 12, animal.name, 10, CLR.gold).setOrigin(0.5));
        const rClr = '#' + rc.toString(16).padStart(6, '0');
        ct.add(this.txt(pw / 2, 28, `${sp.name} (${sp.rarity})`, 6, rClr).setOrigin(0.5));
        ct.add(this.add.image(pw / 2, 56, `animal_${animal.speciesId}`).setScale(1.2));

        let yy = 76;
        const tr = TRAITS[animal.trait];
        if (tr) {
            const trTxt = this.txt(8, yy, `${tr.name}: ${tr.desc}`, 5, '#AABB99').setWordWrapWidth(pw - 16);
            ct.add(trTxt);
            yy += trTxt.height + 4;
        }

        const hasStatus = animal.isBaby || animal.isPregnant || animal.illness;
        if (hasStatus) {
            let sx = 8;
            if (animal.isBaby) { ct.add(this.txt(sx, yy, 'BABY', 5, '#FFCC66')); sx += 52; }
            if (animal.isPregnant) { ct.add(this.txt(sx, yy, 'PREGNANT', 5, '#FF88CC')); sx += 80; }
            if (animal.illness) {
                const ill = ILLNESSES[animal.illness.type];
                ct.add(this.txt(sx, yy, ill ? ill.name : 'Sick', 5, '#FF4444'));
            }
            yy += 16;
        }

        yy += 4;
        this.statBar(ct, 10, yy, pw - 20, 'Hunger', animal.hunger, 0xFF9944);
        this.statBar(ct, 10, yy + 20, pw - 20, 'Happy', animal.happiness, 0xFF6B8A);
        this.statBar(ct, 10, yy + 40, pw - 20, 'Health', animal.health, 0x66CC66);
        yy += 64;

        const bw = Math.floor((pw - 24) / 3);
        this.panelBtn(ct, 8, yy, bw, 'Feed', 0x44AA44, () => { this.gs.feedAnimal(animal.id); this.showAnimal(animal); });
        this.panelBtn(ct, 8 + bw + 4, yy, bw, 'Pet', 0xCC6688, () => { this.gs.petAnimal(animal.id); this.showAnimal(animal); });
        this.panelBtn(ct, 8 + (bw + 4) * 2, yy, bw, 'Treat', 0xCCAA33, () => { this.gs.treatAnimal(animal.id); this.showAnimal(animal); });
        ct.add(this.txt(8 + (bw + 4) * 2 + bw - 2, yy + 24, '20g', 5, CLR.gold).setOrigin(1, 0));
        yy += 32;

        if (hasHeal) {
            const healLabel = animal.illness ? `Heal (${ILLNESSES[animal.illness.type]?.treatCost || 30}g)` : 'Heal (30g)';
            this.panelBtn(ct, 8, yy, 120, healLabel, 0x44AAAA, () => { this.gs.healAnimal(animal.id); this.showAnimal(animal); });
            yy += 30;
        }

        if (canBreed) {
            this.panelBtn(ct, 8, yy, 120, 'Breed', 0xCC66AA, () => { this.gs.startBreeding(animal.id); this.showAnimal(animal); });
            yy += 30;
        } else if (animal.isPregnant) {
            const pctLeft = Math.max(0, Math.round(animal.pregnancyTimer / 720));
            ct.add(this.txt(8, yy + 4, `Due in ~${pctLeft} days`, 6, '#FF88CC'));
            yy += 22;
        } else if (animal.breedCooldown > 0) {
            const dLeft = Math.max(0, Math.ceil(animal.breedCooldown / 720));
            ct.add(this.txt(8, yy + 4, `Breed cooldown: ${dLeft}d`, 5, '#888888'));
            yy += 22;
        }

        if (animal.bonds.length > 0) {
            yy += 6;
            const bondNames = animal.bonds.slice(0, 3).map(bid => {
                const b = this.gs.state.animals.find(a => a.id === bid);
                return b ? b.name : '?';
            }).join(', ');
            const bondTxt = this.txt(8, yy, `Friends: ${bondNames}`, 5, '#66BBFF').setWordWrapWidth(pw - 16);
            ct.add(bondTxt);
            yy += bondTxt.height + 4;
        }

        yy += 6;
        ct.add(this.txt(pw / 2, yy, `Appeal: ${sp.appeal}`, 6, '#AAAAAA').setOrigin(0.5, 0));
        yy += 18;

        const ph = yy + 8;
        const bg = this.add.graphics();
        bg.fillStyle(0x1a0e04, 0.94); bg.fillRoundedRect(0, 0, pw, ph, 6);
        bg.lineStyle(2, CLR.uiBorder); bg.strokeRoundedRect(0, 0, pw, ph, 6);
        ct.addAt(bg, 0);

        const closeBtn = this.txt(pw - 8, 4, 'X', 8, '#FF6666').setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
        closeBtn.on('pointerdown', () => { ct.destroy(); this.animalPanel = null; this._viewedAnimal = null; });
        ct.add(closeBtn);

        this.animalPanel = ct;
    }

    // Draws a labeled stat bar (label + fill + value) into container.
    statBar(ct, x, y, w, label, val, color) {
        ct.add(this.txt(x, y + 1, label, 6));
        const bg = this.add.graphics();
        const barX = x + 62, barW = w - 80;
        bg.fillStyle(0x000000, 0.5); bg.fillRect(barX, y + 3, barW, 10);
        bg.fillStyle(color); bg.fillRect(barX, y + 3, barW * Math.max(0, Math.min(1, val / 100)), 10);
        ct.add(bg);
        ct.add(this.txt(x + w - 2, y + 1, Math.round(val).toString(), 6).setOrigin(1, 0));
    }

    // Creates a colored action button inside a panel container.
    panelBtn(ct, x, y, w, label, color, cb) {
        const bg = this.add.graphics();
        bg.fillStyle(color, 0.55); bg.fillRoundedRect(x, y, w, 26, 3);
        ct.add(bg);
        const btn = this.txt(x + w / 2, y + 13, label, 6).setOrigin(0.5).setInteractive({ useHandCursor: true });
        btn.on('pointerdown', cb);
        btn.on('pointerover', () => { bg.clear(); bg.fillStyle(color, 0.8); bg.fillRoundedRect(x, y, w, 26, 3); });
        btn.on('pointerout', () => { bg.clear(); bg.fillStyle(color, 0.55); bg.fillRoundedRect(x, y, w, 26, 3); });
        ct.add(btn);
    }

    /* ========== HABITAT INFO PANEL ========== */

    // Habitat details, current enrichments, add-enrichment options. Shown when zoomed in.
    // Hides the toolbar and creates a centered "< Back" button bar at the bottom of the screen.
    showHabitatPanel(hab) {
        if (this.habitatPanel) this.habitatPanel.destroy();
        this.destroyBackBar();
        if (this.rescuePopup) return;

        const ht = HABITATS[hab.type];
        const cap = this.gs.getHabitatCapacity(hab);
        const enrichList = hab.enrichments || [];
        const maxEnrich = this.gs.hasResearch('enrich_cap_4') ? 4 : 3;
        const pw = 240;

        const compatEnrich = Object.values(ENRICHMENTS).filter(e => !e.habitats || e.habitats.includes(hab.type));

        const px = 8, py = 48;
        const ct = this.add.container(px, py).setDepth(250);

        ct.add(this.txt(pw / 2, 12, ht.name, 10, CLR.gold).setOrigin(0.5));
        ct.add(this.txt(pw / 2, 28, `${hab.animals.length}/${cap} animals`, 7).setOrigin(0.5));
        const descTxt = this.txt(8, 42, ht.desc, 5, '#AAAAAA').setWordWrapWidth(pw - 16);
        ct.add(descTxt);

        let yy = 42 + descTxt.height + 8;
        if (enrichList.length > 0) {
            ct.add(this.txt(8, yy, 'Enrichments:', 6, '#AABB99'));
            yy += 18;
            for (const eId of enrichList) {
                const en = ENRICHMENTS[eId];
                ct.add(this.txt(14, yy, en ? en.name : eId, 5, '#CCCCCC'));
                yy += 18;
            }
        }

        if (enrichList.length < maxEnrich) {
            ct.add(this.txt(8, yy, 'Add Enrichment:', 6, '#CCAA66'));
            yy += 20;
            for (const en of compatEnrich) {
                if (enrichList.includes(en.id) && enrichList.filter(e => e === en.id).length >= 1) continue;
                const eCost = this.gs.hasResearch('cheap_enrich') ? Math.round(en.cost * 0.7) : en.cost;
                const canAfford = this.gs.state.coins >= eCost;
                const rowBg = this.add.graphics();
                rowBg.fillStyle(0x332211, 0.5); rowBg.fillRoundedRect(6, yy, pw - 12, 28, 3);
                ct.add(rowBg);
                ct.add(this.txt(10, yy + 4, en.name, 5));
                ct.add(this.txt(10, yy + 16, `+${en.happyBonus} happy`, 5, '#88CC88'));
                ct.add(this.txt(pw - 50, yy + 4, `${eCost}g`, 5, canAfford ? CLR.gold : '#884444').setOrigin(1, 0));
                if (canAfford) {
                    const buyBtn = this.txt(pw - 10, yy + 9, 'ADD', 5, '#44CC44').setOrigin(1, 0).setInteractive({ useHandCursor: true });
                    buyBtn.on('pointerdown', () => { this.gs.addEnrichment(hab.id, en.id); this.showHabitatPanel(hab); });
                    buyBtn.on('pointerover', () => buyBtn.setColor('#88FF88'));
                    buyBtn.on('pointerout', () => buyBtn.setColor('#44CC44'));
                    ct.add(buyBtn);
                }
                yy += 30;
            }
        } else {
            ct.add(this.txt(8, yy, `Enrichment full (${maxEnrich}/${maxEnrich})`, 5, '#888888'));
            yy += 18;
        }

        const ph = yy + 8;
        const bg = this.add.graphics();
        bg.fillStyle(0x1a0e04, 0.94); bg.fillRoundedRect(0, 0, pw, ph, 6);
        bg.lineStyle(2, ht.stroke); bg.strokeRoundedRect(0, 0, pw, ph, 6);
        ct.addAt(bg, 0);

        this.hideToolbar();

        const barY = H - 62;
        const backBar = this.add.graphics().setDepth(250);
        backBar.fillStyle(CLR.uiBg, 0.9); backBar.fillRect(0, barY, W, 62);
        backBar.lineStyle(1, CLR.uiBorder); backBar.lineBetween(0, barY, W, barY);

        const bbW = 160, bbH = 38;
        const bbX = W / 2 - bbW / 2, bbY = barY + 12;
        const bbBg = this.add.graphics().setDepth(250);
        bbBg.fillStyle(0x664422, 0.75); bbBg.fillRoundedRect(bbX, bbY, bbW, bbH, 6);
        bbBg.lineStyle(2, 0xAA8855); bbBg.strokeRoundedRect(bbX, bbY, bbW, bbH, 6);

        const bbBtn = this.txt(W / 2, bbY + bbH / 2, '< Back', 9, '#FFCC88').setOrigin(0.5).setDepth(250).setInteractive({ useHandCursor: true });
        bbBtn.on('pointerdown', () => { this.gs.zoomOut(); });
        bbBtn.on('pointerover', () => { bbBtn.setColor('#FFEECC'); bbBg.clear(); bbBg.fillStyle(0x886633, 0.85); bbBg.fillRoundedRect(bbX, bbY, bbW, bbH, 6); bbBg.lineStyle(2, 0xCCBB77); bbBg.strokeRoundedRect(bbX, bbY, bbW, bbH, 6); });
        bbBtn.on('pointerout', () => { bbBtn.setColor('#FFCC88'); bbBg.clear(); bbBg.fillStyle(0x664422, 0.75); bbBg.fillRoundedRect(bbX, bbY, bbW, bbH, 6); bbBg.lineStyle(2, 0xAA8855); bbBg.strokeRoundedRect(bbX, bbY, bbW, bbH, 6); });

        this._backBarElements = [backBar, bbBg, bbBtn];
        this.habitatPanel = ct;
    }

    /* ========== UPGRADES PANEL ========== */

    // Lists upgrades with buy buttons.
    showUpgradePanel() {
        if (this.upgradePanel) this.upgradePanel.destroy();
        const pw = 380, entries = Object.values(UPGRADES);
        const ph = 42 + entries.length * 44 + 8;
        const px = W / 2 - pw / 2, py = 48;
        const ct = this.add.container(px, py).setDepth(280);
        const bg = this.add.graphics();
        bg.fillStyle(0x1a0e04, 0.96); bg.fillRoundedRect(0, 0, pw, ph, 8);
        bg.lineStyle(2, 0xCCAA33); bg.strokeRoundedRect(0, 0, pw, ph, 8);
        ct.add(bg);
        ct.add(this.txt(pw / 2, 14, 'UPGRADES', 12, CLR.gold).setOrigin(0.5));
        const closeBtn = this.txt(pw - 10, 6, 'X', 8, '#FF6666').setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
        closeBtn.on('pointerdown', () => { ct.destroy(); this.upgradePanel = null; });
        ct.add(closeBtn);
        const owned = this.gs.state.upgrades;
        let yy = 42;
        entries.forEach(up => {
            const isOwned = owned.has(up.id), canBuy = !isOwned && this.gs.state.coins >= up.cost;
            const rowBg = this.add.graphics();
            rowBg.fillStyle(isOwned ? 0x224422 : (canBuy ? 0x332211 : 0x1a1a1a), 0.6);
            rowBg.fillRoundedRect(8, yy, pw - 16, 40, 3); ct.add(rowBg);
            ct.add(this.txt(14, yy + 4, up.name, 7, isOwned ? '#66AA66' : CLR.uiText));
            ct.add(this.txt(14, yy + 22, up.desc, 5, '#AAAAAA'));
            if (isOwned) {
                ct.add(this.txt(pw - 18, yy + 12, 'OWNED', 6, '#66AA66').setOrigin(1, 0));
            } else {
                ct.add(this.txt(pw - 18, yy + 4, `${up.cost}g`, 7, canBuy ? CLR.gold : '#884444').setOrigin(1, 0));
                if (canBuy) {
                    const buyBtn = this.txt(pw - 18, yy + 22, 'BUY', 6, '#44CC44').setOrigin(1, 0).setInteractive({ useHandCursor: true });
                    buyBtn.on('pointerdown', () => { if (this.gs.buyUpgrade(up.id)) this.showUpgradePanel(); });
                    buyBtn.on('pointerover', () => buyBtn.setColor('#88FF88'));
                    buyBtn.on('pointerout', () => buyBtn.setColor('#44CC44'));
                    ct.add(buyBtn);
                }
            }
            yy += 44;
        });
        this.upgradePanel = ct;
    }

    /* ========== STAFF PANEL ========== */

    // Hire/fire staff members.
    showStaffPanel() {
        if (this.staffPanel) this.staffPanel.destroy();
        const pw = 380, currentStaff = this.gs.state.staff;
        const hireRows = Object.keys(STAFF_TYPES).length;
        const ph = 66 + hireRows * 38 + (currentStaff.length > 0 ? 34 + currentStaff.length * 32 : 0) + 16;
        const px = W / 2 - pw / 2, py = 48;
        const ct = this.add.container(px, py).setDepth(280);
        const bg = this.add.graphics();
        bg.fillStyle(0x1a0e04, 0.96); bg.fillRoundedRect(0, 0, pw, ph, 8);
        bg.lineStyle(2, 0x5588BB); bg.strokeRoundedRect(0, 0, pw, ph, 8);
        ct.add(bg);
        ct.add(this.txt(pw / 2, 14, 'STAFF', 12, CLR.gold).setOrigin(0.5));
        const closeBtn = this.txt(pw - 10, 6, 'X', 8, '#FF6666').setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
        closeBtn.on('pointerdown', () => { ct.destroy(); this.staffPanel = null; });
        ct.add(closeBtn);
        ct.add(this.txt(10, 38, 'HIRE:', 7, '#AAAAAA'));
        let yy = 54;
        Object.values(STAFF_TYPES).forEach(st => {
            const canAfford = this.gs.state.coins >= st.hireCost;
            const rowBg = this.add.graphics();
            rowBg.fillStyle(0x332211, 0.5); rowBg.fillRoundedRect(8, yy, pw - 16, 34, 3);
            ct.add(rowBg);
            ct.add(this.txt(14, yy + 4, st.name, 7));
            ct.add(this.txt(14, yy + 20, `${st.desc} | ${st.salary}g/day`, 5, '#AAAAAA'));
            ct.add(this.txt(pw - 60, yy + 4, `${st.hireCost}g`, 7, canAfford ? CLR.gold : '#884444').setOrigin(1, 0));
            if (canAfford) {
                const hireBtn = this.txt(pw - 14, yy + 10, 'HIRE', 6, '#44CC44').setOrigin(1, 0).setInteractive({ useHandCursor: true });
                hireBtn.on('pointerdown', () => { this.gs.hireStaff(st.id); this.showStaffPanel(); });
                hireBtn.on('pointerover', () => hireBtn.setColor('#88FF88'));
                hireBtn.on('pointerout', () => hireBtn.setColor('#44CC44'));
                ct.add(hireBtn);
            }
            yy += 38;
        });
        if (currentStaff.length > 0) {
            yy += 8;
            ct.add(this.txt(10, yy, 'CURRENT STAFF:', 7, '#AAAAAA'));
            yy += 20;
            currentStaff.forEach(s => {
                const st = STAFF_TYPES[s.type];
                ct.add(this.txt(14, yy, st.name, 7, '#CCCCCC'));
                ct.add(this.txt(14, yy + 16, `${st.salary}g/day`, 5, '#AAAAAA'));
                const fireBtn = this.txt(pw - 14, yy + 6, 'FIRE', 6, '#CC4444').setOrigin(1, 0).setInteractive({ useHandCursor: true });
                fireBtn.on('pointerdown', () => { this.gs.fireStaff(s.id); this.showStaffPanel(); });
                fireBtn.on('pointerover', () => fireBtn.setColor('#FF6666'));
                fireBtn.on('pointerout', () => fireBtn.setColor('#CC4444'));
                ct.add(fireBtn);
                yy += 30;
            });
        }
        this.staffPanel = ct;
    }

    /* ========== MISSION PANEL ========== */

    // Launch rescue missions, view progress bars.
    showMissionPanel() {
        if (this.missionPanel) this.missionPanel.destroy();
        const pw = 420, missions = Object.values(MISSIONS);
        const active = this.gs.state.activeMissions;
        const ph = 56 + missions.length * 50 + (active.length > 0 ? 24 + active.length * 28 : 0) + 16;
        const px = W / 2 - pw / 2, py = 48;
        const ct = this.add.container(px, py).setDepth(280);
        const bg = this.add.graphics();
        bg.fillStyle(0x1a0e04, 0.96); bg.fillRoundedRect(0, 0, pw, ph, 8);
        bg.lineStyle(2, 0x66AA66); bg.strokeRoundedRect(0, 0, pw, ph, 8);
        ct.add(bg);
        ct.add(this.txt(pw / 2, 14, 'RESCUE MISSIONS', 11, CLR.gold).setOrigin(0.5));
        const closeBtn = this.txt(pw - 10, 6, 'X', 8, '#FF6666').setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
        closeBtn.on('pointerdown', () => { ct.destroy(); this.missionPanel = null; });
        ct.add(closeBtn);
        ct.add(this.txt(10, 36, `Active: ${active.length}/2`, 6, active.length >= 2 ? '#CC8844' : '#88CC88'));

        let yy = 52;
        missions.forEach(m => {
            const canLaunch = active.length < 2 && this.gs.state.coins >= m.cost;
            const rowBg = this.add.graphics();
            rowBg.fillStyle(canLaunch ? 0x223322 : 0x1a1a1a, 0.6);
            rowBg.fillRoundedRect(8, yy, pw - 16, 46, 3); ct.add(rowBg);
            ct.add(this.txt(14, yy + 4, m.name, 7));
            ct.add(this.txt(14, yy + 20, m.desc, 5, '#AAAAAA'));
            const speciesNames = m.species.slice(0, 3).map(s => SPECIES[s]?.name || s).join(', ');
            ct.add(this.txt(14, yy + 34, `Possible: ${speciesNames}...`, 5, '#88AACC'));
            ct.add(this.txt(pw - 80, yy + 4, `${m.cost}g`, 7, canLaunch ? CLR.gold : '#884444').setOrigin(1, 0));
            const dur = Math.round(m.duration / 60);
            ct.add(this.txt(pw - 80, yy + 20, `~${dur} hrs`, 5, '#AAAAAA').setOrigin(1, 0));
            if (canLaunch) {
                const btn = this.txt(pw - 14, yy + 12, 'LAUNCH', 6, '#44CC44').setOrigin(1, 0).setInteractive({ useHandCursor: true });
                btn.on('pointerdown', () => { this.gs.launchMission(m.id); this.showMissionPanel(); });
                btn.on('pointerover', () => btn.setColor('#88FF88'));
                btn.on('pointerout', () => btn.setColor('#44CC44'));
                ct.add(btn);
            }
            yy += 50;
        });

        if (active.length > 0) {
            ct.add(this.txt(10, yy, 'IN PROGRESS:', 6, '#CCAA66'));
            yy += 16;
            for (const mis of active) {
                const m = MISSIONS[mis.biome];
                const pct = Math.min(100, Math.round((mis.elapsed / mis.duration) * 100));
                ct.add(this.txt(14, yy + 2, `${m?.name || mis.biome} - ${pct}%`, 6, '#CCCCCC'));
                const barW = 100;
                const barBg = this.add.graphics();
                barBg.fillStyle(0x000000, 0.5); barBg.fillRect(pw - barW - 14, yy + 4, barW, 8);
                barBg.fillStyle(0x66AA66); barBg.fillRect(pw - barW - 14, yy + 4, barW * pct / 100, 8);
                ct.add(barBg);
                yy += 22;
            }
        }
        this.missionPanel = ct;

        if (active.length > 0) {
            if (this._missionRefresh) this._missionRefresh.destroy();
            this._missionRefresh = this.time.addEvent({
                delay: 2000, callback: () => { if (this.missionPanel) this.showMissionPanel(); }, loop: true
            });
        }
    }

    /* ========== RESEARCH PANEL ========== */

    // Tabbed UI: one branch at a time, 4 tiers per branch, unlock buttons.
    showResearchPanel() {
        if (this.researchPanel) this.researchPanel.destroy();
        if (!this._researchTab) this._researchTab = 'wildlife';

        const branches = Object.keys(RESEARCH_BRANCHES);
        const pw = 420, ph = 430;
        const px = W / 2 - pw / 2, py = 42;
        const ct = this.add.container(px, py).setDepth(290);
        const bg = this.add.graphics();
        bg.fillStyle(0x1a0e04, 0.97); bg.fillRoundedRect(0, 0, pw, ph, 8);
        bg.lineStyle(2, 0x44DDAA); bg.strokeRoundedRect(0, 0, pw, ph, 8);
        ct.add(bg);

        ct.add(this.txt(pw / 2, 12, 'RESEARCH', 12, CLR.gold).setOrigin(0.5));
        ct.add(this.txt(pw / 2, 30, `Research Points: ${this.gs.state.researchPoints}`, 7, '#44DDAA').setOrigin(0.5));

        const closeBtn = this.txt(pw - 10, 6, 'X', 8, '#FF6666').setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
        closeBtn.on('pointerdown', () => { ct.destroy(); this.researchPanel = null; });
        ct.add(closeBtn);

        const tabW = 90;
        const tabStartX = pw / 2 - (branches.length * (tabW + 6)) / 2;
        branches.forEach((bId, i) => {
            const branch = RESEARCH_BRANCHES[bId];
            const bClr = '#' + branch.color.toString(16).padStart(6, '0');
            const tx = tabStartX + i * (tabW + 6), ty = 46;
            const isActive = this._researchTab === bId;
            const tbg = this.add.graphics();
            tbg.fillStyle(branch.color, isActive ? 0.4 : 0.12);
            tbg.fillRoundedRect(tx, ty, tabW, 22, 3);
            if (isActive) { tbg.lineStyle(1, branch.color, 0.8); tbg.strokeRoundedRect(tx, ty, tabW, 22, 3); }
            ct.add(tbg);
            const unlockCount = Object.values(RESEARCH).filter(r => r.branch === bId && this.gs.state.researchUnlocked.has(r.id)).length;
            const totalCount = Object.values(RESEARCH).filter(r => r.branch === bId).length;
            const label = this.txt(tx + tabW / 2, ty + 11, `${branch.name.split(' ')[0]} ${unlockCount}/${totalCount}`, 5, isActive ? bClr : '#888888')
                .setOrigin(0.5).setInteractive({ useHandCursor: true });
            label.on('pointerdown', () => { this._researchTab = bId; this.showResearchPanel(); });
            ct.add(label);
        });

        const activeBranch = RESEARCH_BRANCHES[this._researchTab];
        const aClr = '#' + activeBranch.color.toString(16).padStart(6, '0');
        const unlocked = this.gs.state.researchUnlocked;
        const nodes = Object.values(RESEARCH).filter(r => r.branch === this._researchTab).sort((a, b) => a.tier - b.tier);
        const startY = 78;
        const nodeH = 84;
        const gfx = this.add.graphics();
        ct.add(gfx);

        nodes.forEach((node, ni) => {
            const ny = startY + ni * nodeH;
            const nw = pw - 32, nh = 76;
            const nx = 16;

            const isUnlocked = unlocked.has(node.id);
            const canUnlock = this.gs.canUnlockResearch(node.id);
            const parentUnlocked = !node.requires || unlocked.has(node.requires);

            if (ni > 0) {
                gfx.lineStyle(2, isUnlocked || canUnlock ? activeBranch.color : 0x333333, isUnlocked ? 0.8 : 0.3);
                gfx.lineBetween(pw / 2, ny - (nodeH - nh) + 1, pw / 2, ny - 1);
            }

            const nodeBg = this.add.graphics();
            if (isUnlocked) {
                nodeBg.fillStyle(activeBranch.color, 0.25);
                nodeBg.lineStyle(2, activeBranch.color, 0.8);
            } else if (canUnlock) {
                nodeBg.fillStyle(activeBranch.color, 0.1);
                nodeBg.lineStyle(2, activeBranch.color, 0.5);
            } else {
                nodeBg.fillStyle(0x111111, 0.5);
                nodeBg.lineStyle(1, 0x333333, 0.4);
            }
            nodeBg.fillRoundedRect(nx, ny, nw, nh, 5);
            nodeBg.strokeRoundedRect(nx, ny, nw, nh, 5);
            ct.add(nodeBg);

            const tierLabel = this.txt(nx + 10, ny + 6, `Tier ${node.tier}`, 5, '#666666');
            ct.add(tierLabel);

            const nameClr = isUnlocked ? '#FFFFFF' : (parentUnlocked ? '#CCCCCC' : '#777777');
            ct.add(this.txt(nx + 10, ny + 22, node.name, 8, nameClr));
            ct.add(this.txt(nx + 10, ny + 42, node.desc, 5, isUnlocked ? '#AABB99' : '#999999')
                .setWordWrapWidth(nw - 120));

            if (isUnlocked) {
                ct.add(this.txt(nx + nw - 10, ny + 30, 'COMPLETE', 7, '#66CC66').setOrigin(1, 0.5));
            } else if (canUnlock) {
                ct.add(this.txt(nx + nw - 80, ny + 20, `${node.cost} RP`, 6, '#44DDAA').setOrigin(1, 0));
                const btn = this.txt(nx + nw - 12, ny + 20, 'UNLOCK', 7, '#44CC44')
                    .setOrigin(1, 0).setInteractive({ useHandCursor: true });
                btn.on('pointerdown', () => { this.gs.unlockResearch(node.id); });
                btn.on('pointerover', () => btn.setColor('#88FF88'));
                btn.on('pointerout', () => btn.setColor('#44CC44'));
                ct.add(btn);
            } else {
                const reason = !parentUnlocked ? 'Requires: ' + (RESEARCH[node.requires]?.name || '?') : `${node.cost} RP`;
                ct.add(this.txt(nx + nw - 10, ny + 30, reason, 5, '#555555').setOrigin(1, 0.5));
            }
        });

        this.researchPanel = ct;
    }

    /* ========== JOURNAL PANEL ========== */

    // Tabbed: Bestiary, Achievements, Stats.
    showJournalPanel() {
        if (this.journalPanel) this.journalPanel.destroy();

        const pw = 580, ph = 460;
        const px = W / 2 - pw / 2, py = 42;
        const ct = this.add.container(px, py).setDepth(290);
        const bg = this.add.graphics();
        bg.fillStyle(0x1a0e04, 0.97); bg.fillRoundedRect(0, 0, pw, ph, 8);
        bg.lineStyle(2, 0xAA77CC); bg.strokeRoundedRect(0, 0, pw, ph, 8);
        ct.add(bg);

        ct.add(this.txt(pw / 2, 12, 'JOURNAL', 12, CLR.gold).setOrigin(0.5));
        const closeBtn = this.txt(pw - 10, 6, 'X', 8, '#FF6666').setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
        closeBtn.on('pointerdown', () => { ct.destroy(); this.journalPanel = null; });
        ct.add(closeBtn);

        if (!this._journalTab) this._journalTab = 'bestiary';

        const tabs = ['bestiary', 'achievements', 'stats'];
        const tabLabels = ['Bestiary', 'Achievements', 'Stats'];
        const tabW = 120;
        tabs.forEach((tab, i) => {
            const tx = 70 + i * (tabW + 12), ty = 32;
            const isActive = this._journalTab === tab;
            const tbg = this.add.graphics();
            tbg.fillStyle(isActive ? 0x443322 : 0x221100, 0.8);
            tbg.fillRoundedRect(tx, ty, tabW, 24, 3); ct.add(tbg);
            const tbtn = this.txt(tx + tabW / 2, ty + 12, tabLabels[i], 6, isActive ? CLR.gold : '#AAAAAA')
                .setOrigin(0.5).setInteractive({ useHandCursor: true });
            tbtn.on('pointerdown', () => { this._journalTab = tab; this.showJournalPanel(); });
            ct.add(tbtn);
        });

        const contentY = 64;
        if (this._journalTab === 'bestiary') {
            this.renderBestiary(ct, 8, contentY, pw - 16, ph - contentY - 8);
        } else if (this._journalTab === 'achievements') {
            this.renderAchievements(ct, 8, contentY, pw - 16, ph - contentY - 8);
        } else {
            this.renderStats(ct, 8, contentY, pw - 16, ph - contentY - 8);
        }

        this.journalPanel = ct;
    }

    // Grid of discovered/undiscovered species.
    renderBestiary(ct, x, y, w, h) {
        const speciesList = Object.values(SPECIES);
        const cols = 5, cellW = w / cols, cellH = 72;
        const discovered = this.gs.state.discoveries;

        speciesList.forEach((sp, i) => {
            const col = i % cols, row = Math.floor(i / cols);
            const cx = x + col * cellW + cellW / 2;
            const cy = y + row * cellH + 30;
            const isFound = discovered.has(sp.id);

            if (isFound) {
                ct.add(this.add.image(cx, cy, `animal_${sp.id}`).setScale(0.8));
                ct.add(this.txt(cx, cy + 18, sp.name, 5).setOrigin(0.5));
                const rClr = '#' + RARITY_COLOR[sp.rarity].toString(16).padStart(6, '0');
                ct.add(this.txt(cx, cy + 28, sp.rarity, 4, rClr).setOrigin(0.5));
            } else {
                const shadow = this.add.graphics();
                shadow.fillStyle(0x222222, 0.8); shadow.fillCircle(cx, cy, 12);
                ct.add(shadow);
                ct.add(this.txt(cx, cy + 18, '???', 5, '#555555').setOrigin(0.5));
            }
        });

        ct.add(this.txt(x, y + Math.ceil(speciesList.length / cols) * cellH + 10,
            `Discovered: ${discovered.size}/${speciesList.length}`, 6, '#AAAAAA'));
    }

    // List of achievements with earned state.
    renderAchievements(ct, x, y, w, h) {
        const earned = this.gs.state.achievementsEarned;
        let yy = y;
        ACHIEVEMENTS.forEach(ach => {
            const done = earned.has(ach.id);
            const rowBg = this.add.graphics();
            rowBg.fillStyle(done ? 0x223322 : 0x1a1a1a, 0.5);
            rowBg.fillRoundedRect(x, yy, w, 20, 2); ct.add(rowBg);
            ct.add(this.txt(x + 4, yy + 3, done ? '\u2713' : '\u25CB', 6, done ? '#66CC66' : '#555555'));
            ct.add(this.txt(x + 20, yy + 3, ach.name, 6, done ? '#CCCCCC' : '#888888'));
            ct.add(this.txt(x + w - 4, yy + 3, ach.desc, 5, done ? '#AABB99' : '#666666').setOrigin(1, 0));
            yy += 20;
        });
        ct.add(this.txt(x, yy + 6, `${earned.size}/${ACHIEVEMENTS.length} earned`, 6, CLR.gold));
    }

    // Key/value stats (day, season, coins, animals, etc.).
    renderStats(ct, x, y, w, h) {
        const s = this.gs.state;
        const stats = [
            ['Day', s.day],
            ['Season', SEASONS[s.season]?.name || s.season],
            ['Coins', s.coins],
            ['Reputation', s.rep],
            ['Animals', s.animals.length],
            ['Habitats', s.habitats.length],
            ['Staff', s.staff.length],
            ['Species Discovered', s.discoveries.size],
            ['Animals Rescued', s.stats.rescued],
            ['Babies Bred', s.stats.bred],
            ['Visitors Served', s.stats.visitors],
            ['Missions Complete', s.stats.missionsComplete],
            ['Animals Healed', s.stats.healed],
            ['Total Earned', `${s.stats.earned}g`],
            ['Upgrades', `${s.upgrades.size}/${Object.keys(UPGRADES).length}`],
            ['Research', `${s.researchUnlocked.size}/${Object.keys(RESEARCH).length}`],
            ['Research Points', s.researchPoints],
            ['Achievements', `${s.achievementsEarned.size}/${ACHIEVEMENTS.length}`],
        ];
        let yy = y;
        stats.forEach(([label, val]) => {
            ct.add(this.txt(x + 10, yy, label, 6, '#AAAAAA'));
            ct.add(this.txt(x + w - 10, yy, String(val), 7, CLR.gold).setOrigin(1, 0));
            yy += 22;
        });
    }

    /* ========== HELPERS ========== */

    // Toggle panel: close if open, else close others and show.
    togglePanel(panelKey, showFn) {
        if (this[panelKey]) { this[panelKey].destroy(); this[panelKey] = null; return; }
        this.closeAllPanels();
        showFn();
    }

    // Destroys all open panels and mission refresh timer. keepZoom=true preserves the
    // camera zoom and back bar (used by rescue events so they don't interrupt the zoomed view).
    closeAllPanels(keepZoom = false) {
        if (!keepZoom && this.gs.state.viewingHabitat) { this.gs.zoomOut(); this.showToolbar(); }
        ['animalPanel', 'upgradePanel', 'staffPanel', 'missionPanel', 'journalPanel', 'habitatPanel', 'researchPanel'].forEach(k => {
            if (this[k]) { this[k].destroy(); this[k] = null; }
        });
        if (!keepZoom) this.destroyBackBar();
        this.closeBuildPopup();
        if (this._missionRefresh) { this._missionRefresh.destroy(); this._missionRefresh = null; }
    }

    // Styled text with minimum font size enforcement.
    txt(x, y, text, size, color) {
        const s = Math.max(8, Math.round(size * 1.2));
        return this.add.text(x, y, text, {
            fontFamily: '"Press Start 2P", monospace', fontSize: `${s}px`,
            color: color || CLR.uiText, stroke: '#000000', strokeThickness: s > 10 ? 3 : 2,
            lineSpacing: 2,
        });
    }
}
