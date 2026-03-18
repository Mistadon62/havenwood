// UI overlay scene running parallel to GameScene. Has its own camera, unaffected by GameScene zoom.
// Communicates via this.game.events; this.gs = GameScene reference for state and method calls.
// Manages toolbar (hidden during habitat/facility zoom, disabled during rescue, replaced by
// build hint bar during build mode), habitat/animal panels (with close X, back bar, navigation
// arrows to cycle animals, generation display for bred animals), facility back bar (shown when
// zoomed into a garden or other facility), settings/pause menu (gear icon or ESC from sanctuary;
// includes auto-save toggle), rescue popup with time-pause and full modal blocking, two-level
// build menu (categories then items), and management panels (vertically centered).
// Build menu: click Build → category buttons (Habitats, Decorations, Facilities) appear;
// click a category → item sub-menu appears to the right.
// Top bar shows day/season, reputation face, clock with speed controls (graphics-based highlight
// behind active icon to avoid preFX pixel shifts), research points, food count, and coins.
// Speed state (slow/normal/fast) is persisted in the save file and synced on load.
// triggerPhoneTransition() handles switching to meta-world: first time uses TransitionScene
// for a cinematic zoom-out, subsequent times do a quick scene sleep/wake with put-away animation.
// animalDeselected event closes the animal panel when navigating to a habitat with no animals.
// hasOpenPanel() lets GameScene suppress world clicks while a management panel or settings is visible.
import { W, H, HABITATS, SPECIES, RARITY_COLOR, CLR, SEASONS, UPGRADES, STAFF_TYPES,
    TRAITS, ILLNESSES, ENRICHMENTS, MISSIONS, VISITOR_TYPES, ACHIEVEMENTS,
    RESEARCH, RESEARCH_BRANCHES, DECORATIONS, DECOR_CATEGORIES, FACILITIES } from '../GameData.js';

export default class HUDScene extends Phaser.Scene {
    constructor() { super('HUDScene'); }

    create() {
        // IMPORTANT: roundPixels must be set on BOTH GameScene and HUDScene cameras.
        // See GameScene.create() for the full explanation of the sub-pixel rendering glitch.
        this.cameras.main.setRoundPixels(true);
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
        this.createBuildHintBar();
        this.listenEvents();

        this.time.delayedCall(0, () => this.syncState());
    }

    _updateBathroomMeter() {
        if (!this.facilityPanel) return;
        const b = this._facilityPanelBathroom;
        if (!b || !b.fac) return;
        const dirty = b.fac.dirty || 0;
        const cleanliness = Math.max(0, 1 - dirty);
        b.barFill.clear();
        b.barFill.fillStyle(cleanliness > 0.5 ? 0x44AA44 : cleanliness > 0.25 ? 0xAA8844 : 0xAA4444, 0.9);
        b.barFill.fillRoundedRect(8, b.barY, b.barW * cleanliness, b.barH, 3);
        b.barPctTxt.setText(Math.round(cleanliness * 100) + '%');
        if (b.cleanBg && b.cleanBtn && b.cleanY != null) {
            const wasEnabled = b.cleanBtn.input && b.cleanBtn.input.enabled;
            const nowEnabled = dirty > 0;
            if (wasEnabled !== nowEnabled) {
                b.cleanBg.clear();
                b.cleanBg.fillStyle(nowEnabled ? 0x448844 : 0x444444, 0.5);
                b.cleanBg.fillRoundedRect(6, b.cleanY, b.cleanW || 188, 24, 3);
                b.cleanBtn.setText(nowEnabled ? 'Clean' : 'Spotless');
                b.cleanBtn.setColor(nowEnabled ? '#88DD88' : '#888888');
                if (nowEnabled) {
                    b.cleanBtn.setInteractive({ useHandCursor: true });
                    b.cleanBtn.off('pointerdown').on('pointerdown', () => { this.gs.cleanBathroom(b.fac); this.showFacilityBackBar(b.fac); });
                    b.cleanBtn.on('pointerover', () => b.cleanBtn.setColor('#AAFFAA'));
                    b.cleanBtn.on('pointerout', () => b.cleanBtn.setColor('#88DD88'));
                } else {
                    b.cleanBtn.disableInteractive();
                    b.cleanBtn.off('pointerover').off('pointerout').off('pointerdown');
                }
            }
        }
    }

    update() {
        if (this.facilityPanel && this._facilityPanelBathroom) this._updateBathroomMeter();
    }

    // Syncs HUD display from GameScene state (coins, time, research points).
    syncState() {
        const s = this.gs.state;
        this.updateCoins(s.coins);
        this.updateFood(s.food);
        this.updateTime({ time: s.time, day: s.day, season: s.season, rep: s.rep });
        this.rpTxt.setText(s.researchPoints.toString());
        // Sync speed indicator with loaded timeSpeedMult
        const mult = this.gs.timeSpeedMult;
        this._activeSpeed = mult <= 0.5 ? 'slow' : mult >= 3 ? 'fast' : 'normal';
        this._updateSpeedGlow();
    }

    /* ========== TOP BAR ========== */

    // Day, season, reputation face (dynamic expression based on rep 0–100), clock, speed controls
    // (tortoise/hare with graphics-based highlight behind active icon), research points, food count,
    // coins, settings gear. All elements are vertically centered at midY=21 using setOrigin(_, 0.5).
    createTopBar() {
        const bar = this.add.graphics();
        bar.fillStyle(CLR.uiBg, 0.9); bar.fillRect(0, 0, W, 42);
        bar.lineStyle(1, CLR.uiBorder); bar.lineBetween(0, 42, W, 42);

        const midY = 21;
        this.dayTxt = this.txt(12, midY, 'Day 1', 10).setOrigin(0, 0.5);
        this.seasonTxt = this.txt(130, midY, 'Spring', 8, '#88CC88').setOrigin(0, 0.5);

        const clockX = W / 2;
        this.tortoiseBtn = this.add.image(clockX - 75, midY, 'icon_tortoise').setScale(1.3).setInteractive({ useHandCursor: true });
        this.timeTxt = this.txt(clockX, midY, '6:00 AM', 10).setOrigin(0.5, 0.5).setInteractive({ useHandCursor: true });
        this.hareBtn = this.add.image(clockX + 75, midY, 'icon_hare').setScale(1.3).setInteractive({ useHandCursor: true });
        this.tortoiseBtn.on('pointerdown', () => this._setTimeSpeed('slow'));
        this.hareBtn.on('pointerdown', () => this._setTimeSpeed('fast'));
        this.timeTxt.on('pointerdown', () => this._setTimeSpeed('normal'));

        this.add.image(W - 280, midY, 'icon_research').setScale(1.2);
        this.rpTxt = this.txt(W - 268, midY, '0', 9, '#44DDAA').setOrigin(0, 0.5);
        this.repFace = this.add.image(300, midY, 'rep_face_5').setScale(0.9);
        this.add.image(W - 210, midY, 'icon_food').setScale(1.3);
        this.foodTxt = this.txt(W - 196, midY, '100', 9, '#FF9944').setOrigin(0, 0.5);
        this.add.image(W - 120, midY, 'icon_coin').setScale(1.3);
        this.coinTxt = this.txt(W - 106, midY, '', 9, CLR.gold).setOrigin(0, 0.5);

        const settingsBtn = this.txt(W - 28, midY - 3, '\u2699', 18, '#AAAAAA').setOrigin(0.5, 0.5).setInteractive({ useHandCursor: true });
        settingsBtn.on('pointerdown', () => this.toggleSettingsMenu());
        settingsBtn.on('pointerover', () => settingsBtn.setColor('#FFFFFF'));
        settingsBtn.on('pointerout', () => settingsBtn.setColor('#AAAAAA'));
    }

    _setTimeSpeed(mode) {
        const current = this._activeSpeed || 'normal';
        if (mode === current) mode = 'normal';
        this._activeSpeed = mode;
        this.gs.timeSpeedMult = mode === 'slow' ? 0.5 : mode === 'fast' ? 3 : 1;
        this._updateSpeedGlow();
    }

    _updateSpeedGlow() {
        if (this._speedHighlight) { this._speedHighlight.destroy(); this._speedHighlight = null; }
        const mode = this._activeSpeed || 'normal';
        if (mode === 'normal') return;
        const btn = mode === 'slow' ? this.tortoiseBtn : this.hareBtn;
        const g = this.add.graphics().setDepth(btn.depth - 1);
        g.fillStyle(0xffff33, 1);
        g.fillRoundedRect(Math.round(btn.x) - 13, Math.round(btn.y) - 13, 26, 26, 6);
        g.lineStyle(2, 0xffcc00, 1);
        g.strokeRoundedRect(Math.round(btn.x) - 13, Math.round(btn.y) - 13, 26, 26, 6);
        this._speedHighlight = g;
    }

    /* ========== SETTINGS MENU ========== */
    // Opened via ESC from sanctuary view (or during rescue) and gear icon. Save, Exit to Menu,
    // Resume buttons, and an Auto-Save checkbox. Auto-save setting is persisted in the save file.

    toggleSettingsMenu() {
        if (this.settingsPanel) { this.closeSettingsMenu(); return; }
        this.gs.state.settingsPaused = true;

        const pw = 260, ph = 260;
        const px = W / 2 - pw / 2, py = this.centerPanelY(ph);
        const ct = this.add.container(px, py).setDepth(310);

        const overlay = this.add.rectangle(W / 2 - px, H / 2 - py, W, H, 0x000000, 0.45).setInteractive();
        ct.add(overlay);

        const bg = this.add.graphics();
        bg.fillStyle(CLR.uiPanelBg, 0.97); bg.fillRoundedRect(0, 0, pw, ph, 8);
        bg.lineStyle(2, CLR.uiBorder); bg.strokeRoundedRect(0, 0, pw, ph, 8);
        ct.add(bg);

        ct.add(this.txt(pw / 2, 20, 'Settings', 12, CLR.gold).setOrigin(0.5));

        const btnW = 180, btnH = 34;
        const bx = pw / 2 - btnW / 2;

        // Save button
        const saveBg = this.add.graphics();
        saveBg.fillStyle(0x44AA44, 0.6); saveBg.fillRoundedRect(bx, 60, btnW, btnH, 5);
        ct.add(saveBg);
        const saveHit = this.add.rectangle(pw / 2, 60 + btnH / 2, btnW, btnH, 0, 0).setInteractive({ useHandCursor: true });
        ct.add(saveHit);
        ct.add(this.txt(pw / 2, 60 + btnH / 2, 'Save Game', 9, '#FFFFFF').setOrigin(0.5));
        saveHit.on('pointerover', () => { saveBg.clear(); saveBg.fillStyle(0x55CC55, 0.7); saveBg.fillRoundedRect(bx, 60, btnW, btnH, 5); });
        saveHit.on('pointerout', () => { saveBg.clear(); saveBg.fillStyle(0x44AA44, 0.6); saveBg.fillRoundedRect(bx, 60, btnW, btnH, 5); });
        saveHit.on('pointerdown', () => {
            this.gs._saveMode = 'havenwood';
            this.gs.saveGame();
            this.gs._saveMode = null;
            this.notify('Game saved!');
            this.closeSettingsMenu();
        });

        // Exit to Menu button
        const exitBg = this.add.graphics();
        exitBg.fillStyle(0xAA4444, 0.6); exitBg.fillRoundedRect(bx, 110, btnW, btnH, 5);
        ct.add(exitBg);
        const exitHit = this.add.rectangle(pw / 2, 110 + btnH / 2, btnW, btnH, 0, 0).setInteractive({ useHandCursor: true });
        ct.add(exitHit);
        ct.add(this.txt(pw / 2, 110 + btnH / 2, 'Exit to Menu', 9, '#FFFFFF').setOrigin(0.5));
        exitHit.on('pointerover', () => { exitBg.clear(); exitBg.fillStyle(0xCC5555, 0.7); exitBg.fillRoundedRect(bx, 110, btnW, btnH, 5); });
        exitHit.on('pointerout', () => { exitBg.clear(); exitBg.fillStyle(0xAA4444, 0.6); exitBg.fillRoundedRect(bx, 110, btnW, btnH, 5); });
        exitHit.on('pointerdown', () => {
            this.gs._saveMode = 'havenwood';
            this.gs.saveGame();
            this.gs._saveMode = null;
            this.closeSettingsMenu();
            this.scene.stop('HUDScene');
            this.gs.scene.start('MenuScene');
        });

        // Resume button
        const resBg = this.add.graphics();
        resBg.fillStyle(0x555566, 0.6); resBg.fillRoundedRect(bx, 160, btnW, btnH, 5);
        ct.add(resBg);
        const resHit = this.add.rectangle(pw / 2, 160 + btnH / 2, btnW, btnH, 0, 0).setInteractive({ useHandCursor: true });
        ct.add(resHit);
        ct.add(this.txt(pw / 2, 160 + btnH / 2, 'Resume', 9, '#FFFFFF').setOrigin(0.5));
        resHit.on('pointerover', () => { resBg.clear(); resBg.fillStyle(0x666688, 0.7); resBg.fillRoundedRect(bx, 160, btnW, btnH, 5); });
        resHit.on('pointerout', () => { resBg.clear(); resBg.fillStyle(0x555566, 0.6); resBg.fillRoundedRect(bx, 160, btnW, btnH, 5); });
        resHit.on('pointerdown', () => this.closeSettingsMenu());

        const checkSize = 16;
        const checkX = bx, checkY = 210;
        const checkBg = this.add.graphics();
        const drawCheck = () => {
            checkBg.clear();
            checkBg.lineStyle(2, 0xAA8855); checkBg.strokeRect(checkX, checkY, checkSize, checkSize);
            if (this.gs.state.autoSave) {
                checkBg.fillStyle(0x44DD44, 0.9); checkBg.fillRect(checkX + 3, checkY + 3, checkSize - 6, checkSize - 6);
            }
        };
        drawCheck();
        ct.add(checkBg);
        const checkHit = this.add.rectangle(checkX + checkSize / 2, checkY + checkSize / 2, checkSize, checkSize, 0, 0).setInteractive({ useHandCursor: true });
        ct.add(checkHit);
        checkHit.on('pointerdown', () => { this.gs.state.autoSave = !this.gs.state.autoSave; drawCheck(); });
        ct.add(this.txt(checkX + checkSize + 10, checkY + checkSize / 2, 'Auto-Save', 8, '#CCBBAA').setOrigin(0, 0.5));

        this.settingsPanel = ct;
    }

    closeSettingsMenu() {
        if (this.settingsPanel) { this.settingsPanel.destroy(); this.settingsPanel = null; }
        this.gs.state.settingsPaused = false;
    }

    /* ========== TOOLBAR ========== */

    // Bottom bar: Build (opens two-level build menu: categories → items) and management toggles
    // (Missions, Upgrades, Staff, Research, Journal).
    // All elements stored in toolbarElements for hide/show during habitat/facility zoom.
    // Build hint bar (pre-created in createBuildHintBar) replaces toolbar during build mode.
    createToolbar() {
        const barY = H - 62;
        this.toolbarElements = [];
        const bar = this.add.graphics();
        bar.fillStyle(CLR.uiBg, 0.9); bar.fillRect(0, barY, W, 62);
        bar.lineStyle(1, CLR.uiBorder); bar.lineBetween(0, barY, W, barY);
        this.toolbarElements.push(bar);

        const allItems = [
            { key: 'build', label: 'Build', cost: null, color: 0x66BB55 },
            { key: 'missions', label: 'Rescue', cost: null, color: 0x66AA66 },
            { key: 'upgrades', label: 'Upgrades', cost: null, color: 0xCCAA33 },
            { key: 'staff', label: 'Staff', cost: null, color: 0x5588BB },
            { key: 'research', label: 'Research', cost: null, color: 0x44DDAA },
            { key: 'journal', label: 'Journal', cost: null, color: 0xAA77CC },
            { key: 'phone', label: 'Phone', cost: null, color: 0x5577AA },
        ];
        const gap = Math.min(130, (W - 10) / allItems.length);
        this._toolGap = gap;
        const startX = W / 2 - (allItems.length * gap) / 2 + gap / 2;

        this.toolBtns = [];
        allItems.forEach((item, i) => {
            const x = startX + i * gap, y = barY + 31;
            const bg = this.add.graphics();
            this.drawToolBtn(bg, x, y, item.color, false, gap);
            this.toolbarElements.push(bg);
            const hit = this.add.rectangle(x, y, gap - 4, 50, 0, 0).setInteractive({ useHandCursor: true });
            this.toolbarElements.push(hit);
            hit.on('pointerover', () => {
                if (this.gs.state.rescuePaused) { this.game.canvas.style.cursor = 'default'; return; }
                this.drawToolBtn(bg, x, y, item.color, true, gap);
            });
            hit.on('pointerout', () => {
                const isActive = item.key === this.activeBuild ||
                    (item.key === 'build' && this.activeBuild && (HABITATS[this.activeBuild] || this.activeBuild?.startsWith('decor_') || this.activeBuild?.startsWith('facility_'))) ||
                    item.key === this._activePanel;
                this.drawToolBtn(bg, x, y, item.color, isActive, gap);
            });
            hit.on('pointerdown', () => {
                if (this.gs.state.rescuePaused) return;
                if (item.key === 'build') { this.toggleBuildPopup(x, barY); return; }
                if (item.key === 'upgrades') { this.togglePanel('upgradePanel', () => this.showUpgradePanel(), 'upgrades'); return; }
                if (item.key === 'staff') { this.togglePanel('staffPanel', () => this.showStaffPanel(), 'staff'); return; }
                if (item.key === 'missions') { this.togglePanel('missionPanel', () => this.showMissionPanel(), 'missions'); return; }
                if (item.key === 'research') { this.togglePanel('researchPanel', () => this.showResearchPanel(), 'research'); return; }
                if (item.key === 'journal') { this.togglePanel('journalPanel', () => this.showJournalPanel(), 'journal'); return; }
                if (item.key === 'phone') { this.triggerPhoneTransition(); return; }
                this.closeAllPanels();
                this.activeBuild = item.key;
                this.toolBtns.forEach(b => this.drawToolBtn(b.bg, b.x, b.y, b.color, b.key === item.key, gap));
                if (item.key) this.gs.enterBuild(item.key);
                else this.gs.exitBuild();
            });
            const lbl = this.txt(x, item.cost !== null ? y - 6 : y, item.label, 7).setOrigin(0.5);
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

    // Pre-created and toggled via setVisible instead of created/destroyed each time.
    // Creating and destroying Graphics objects on every build mode enter/exit causes
    // display list churn that produces a one-frame pixel jump in the UI. Pre-creating
    // avoids this. Apply the same pattern for any UI bar that toggles frequently.
    createBuildHintBar() {
        const barY = H - 62;
        const bar = this.add.graphics().setDepth(250);
        bar.fillStyle(CLR.uiBg, 0.9); bar.fillRect(0, barY, W, 62);
        bar.lineStyle(1, CLR.uiBorder); bar.lineBetween(0, barY, W, barY);
        const label = this.txt(W / 2, barY + 31, '', 8, '#FFFFFF').setOrigin(0.5).setDepth(250);
        this._buildHintBar = bar;
        this._buildHintLabel = label;
        bar.setVisible(false);
        label.setVisible(false);
    }

    // Draws a single toolbar button with active/hover state.
    drawToolBtn(bg, x, y, color, active, gap = 88) {
        const w = gap - 6;
        bg.clear();
        bg.fillStyle(color, active ? 0.5 : 0.22);
        bg.fillRoundedRect(x - w / 2, y - 23, w, 46, 4);
        bg.lineStyle(active ? 2 : 1, color, active ? 1 : 0.5);
        bg.strokeRoundedRect(x - w / 2, y - 23, w, 46, 4);
    }

    /* ========== BUILD MENU ========== */
    // Two-level build system: vertical category submenu (Habitats / Decorations) with the
    // selected category at the bottom (highlighted, right arrow), and item picker to its right.

    toggleBuildPopup(anchorX, barY) {
        if (this.buildPopup) { this.closeBuildPopup(); return; }
        this.closeAllPanels();
        this._activePanel = 'build';
        this._refreshToolBtns();
        this._buildCategory = null;

        this._buildDismiss = this.add.rectangle(W / 2, barY / 2, W, barY, 0, 0)
            .setInteractive().setDepth(259);
        this._buildDismiss.on('pointerdown', () => { if (!this.gs.state.rescuePaused) this.closeBuildPopup(); });

        this._buildAnchorX = anchorX;
        this._buildBarY = barY;
        this._renderBuildMenu();
    }

    _renderBuildMenu() {
        if (this._buildDecorMaskGraphics) { this._buildDecorMaskGraphics.destroy(); this._buildDecorMaskGraphics = null; }
        if (this._buildDecorWheelCleanup) { this._buildDecorWheelCleanup(); this._buildDecorWheelCleanup = null; }
        this._buildPopupBounds = null;
        if (this.buildPopup) this.buildPopup.destroy();
        if (this._buildItemPopup) { this._buildItemPopup.destroy(); this._buildItemPopup = null; }
        const anchorX = this._buildAnchorX;
        const barY = this._buildBarY;
        const cat = this._buildCategory;
        const categories = ['habitats', 'decorations', 'facilities'];
        const catLabels = { habitats: 'Habitats', decorations: 'Decorations', facilities: 'Facilities' };
        const catColor = { habitats: 0x66BB55, decorations: 0xBB8844, facilities: 0x6699BB };

        const catW = (this._toolGap || 130) - 6, catH = 32, catGap = 4;
        const menuBottom = barY - 10;
        const catX = anchorX - catW / 2;

        const ct = this.add.container(0, 0).setDepth(260);

        categories.forEach((cid, i) => {
            const isActive = cid === cat;
            const cy = menuBottom - (categories.length - i) * (catH + catGap);
            const bg = this.add.graphics();
            const cc = catColor[cid];
            bg.fillStyle(cc, isActive ? 0.7 : 0.55);
            bg.fillRoundedRect(catX, cy, catW, catH, 4);
            bg.lineStyle(isActive ? 2 : 1, cc, isActive ? 1 : 0.85);
            bg.strokeRoundedRect(catX, cy, catW, catH, 4);
            ct.add(bg);

            const label = catLabels[cid] + (isActive ? '  \u25B6' : '');
            ct.add(this.txt(catX + catW / 2, cy + catH / 2, label, 7, isActive ? CLR.uiText : '#DDDDDD').setOrigin(0.5));

            const hit = this.add.rectangle(catX + catW / 2, cy + catH / 2, catW, catH, 0, 0).setInteractive({ useHandCursor: true });
            hit.on('pointerover', () => { if (cid !== this._buildCategory) { bg.clear(); bg.fillStyle(cc, 0.7); bg.fillRoundedRect(catX, cy, catW, catH, 4); bg.lineStyle(1, cc, 1); bg.strokeRoundedRect(catX, cy, catW, catH, 4); } });
            hit.on('pointerout', () => { if (cid !== this._buildCategory) { bg.clear(); bg.fillStyle(cc, 0.55); bg.fillRoundedRect(catX, cy, catW, catH, 4); bg.lineStyle(1, cc, 0.85); bg.strokeRoundedRect(catX, cy, catW, catH, 4); } });
            hit.on('pointerdown', () => {
                if (this.gs.state.rescuePaused) return;
                if (this._buildCategory === cid) {
                    this._buildCategory = null;
                    this._renderBuildMenu();
                } else {
                    this._buildCategory = cid;
                    this._renderBuildMenu();
                }
            });
            ct.add(hit);
        });

        this.buildPopup = ct;
        const catTop = menuBottom - (categories.length - 1) * (catH + catGap) - catH;
        this._buildPopupBounds = { x: catX, y: catTop, w: 400, h: barY - catTop };

        if (cat) this._renderBuildItems(cat, catX, catW, menuBottom, catH, catGap, catColor[cat]);
    }

    _renderBuildItems(cat, catX, catW, menuBottom, catH, catGap, color) {
        const items = cat === 'habitats' ? Object.values(HABITATS) : cat === 'facilities' ? Object.values(FACILITIES) : Object.values(DECORATIONS);
        const cellW = 100, pad = 12;
        const itemPw = items.length * cellW + pad * 2;
        const itemPh = 68;

        const itemX = catX + catW + 8;
        const itemY = menuBottom - itemPh - 10;

        const ct = this.add.container(0, 0).setDepth(260);

        if (cat !== 'decorations') {
            const ibg = this.add.graphics();
            ibg.fillStyle(CLR.uiBg, 0.96);
            ibg.fillRoundedRect(itemX, itemY, itemPw, itemPh, 6);
            ibg.lineStyle(2, color);
            ibg.strokeRoundedRect(itemX, itemY, itemPw, itemPh, 6);
            ct.add(ibg);
        }

        if (cat === 'habitats') {
            items.forEach((h, i) => {
                const bx = itemX + pad + i * cellW + cellW / 2;
                const by = itemY + itemPh / 2;
                const cost = this.gs.getHabitatCost(h.id);
                const canAfford = this.gs.state.coins >= cost;
                const rx = bx - cellW / 2 + 4, ry = by - 26, rw = cellW - 8, rh = 52;

                const btnBg = this.add.graphics();
                btnBg.fillStyle(canAfford ? h.fill : 0x444444, canAfford ? 0.3 : 0.25);
                btnBg.fillRoundedRect(rx, ry, rw, rh, 4);
                ct.add(btnBg);
                ct.add(this.txt(bx, by - 10, h.name, 7, canAfford ? CLR.uiText : '#666666').setOrigin(0.5));
                ct.add(this.txt(bx, by + 6, `${cost}g`, 6, canAfford ? CLR.gold : '#884444').setOrigin(0.5));

                if (canAfford) {
                    const hit = this.add.rectangle(bx, by, rw, rh, 0, 0).setInteractive({ useHandCursor: true });
                    hit.on('pointerover', () => { btnBg.clear(); btnBg.fillStyle(h.fill, 0.55); btnBg.fillRoundedRect(rx, ry, rw, rh, 4); btnBg.lineStyle(1, h.fill, 0.8); btnBg.strokeRoundedRect(rx, ry, rw, rh, 4); });
                    hit.on('pointerout', () => { btnBg.clear(); btnBg.fillStyle(h.fill, 0.3); btnBg.fillRoundedRect(rx, ry, rw, rh, 4); });
                    hit.on('pointerdown', () => { if (this.gs.state.rescuePaused) return; this.closeBuildPopup(); this.gs.enterBuild(h.id); });
                    ct.add(hit);
                }
            });
        } else if (cat === 'facilities') {
            items.forEach((f, i) => {
                const bx = itemX + pad + i * cellW + cellW / 2;
                const by = itemY + itemPh / 2;
                const canAfford = this.gs.state.coins >= f.cost;
                const rx = bx - cellW / 2 + 4, ry = by - 26, rw = cellW - 8, rh = 52;

                const btnBg = this.add.graphics();
                btnBg.fillStyle(canAfford ? f.fill : 0x444444, canAfford ? 0.3 : 0.25);
                btnBg.fillRoundedRect(rx, ry, rw, rh, 4);
                ct.add(btnBg);
                ct.add(this.txt(bx, by - 10, f.name, 7, canAfford ? CLR.uiText : '#666666').setOrigin(0.5));
                ct.add(this.txt(bx, by + 6, `${f.cost}g`, 6, canAfford ? CLR.gold : '#884444').setOrigin(0.5));

                if (canAfford) {
                    const hit = this.add.rectangle(bx, by, rw, rh, 0, 0).setInteractive({ useHandCursor: true });
                    hit.on('pointerover', () => { btnBg.clear(); btnBg.fillStyle(f.fill, 0.55); btnBg.fillRoundedRect(rx, ry, rw, rh, 4); btnBg.lineStyle(1, f.fill, 0.8); btnBg.strokeRoundedRect(rx, ry, rw, rh, 4); });
                    hit.on('pointerout', () => { btnBg.clear(); btnBg.fillStyle(f.fill, 0.3); btnBg.fillRoundedRect(rx, ry, rw, rh, 4); });
                    hit.on('pointerdown', () => { if (this.gs.state.rescuePaused) return; this.closeBuildPopup(); this.gs.enterFacilityBuild(f.id); });
                    ct.add(hit);
                }
            });
        } else {
            // Decorations: filter dropdown + vertical grid (3 cols), scrollable
            const filter = this._buildDecorFilter || 'All';
            const filteredItems = filter === 'All'
                ? Object.values(DECORATIONS)
                : Object.values(DECORATIONS).filter(d => (d.category || 'Greenery') === filter);
            const items = filteredItems;

            const DECOR_COLS = 3;
            const DECOR_CELL_W = 88, DECOR_CELL_H = 56, DECOR_PAD = 10;
            const DECOR_DROPDOWN_H = 28;
            const DECOR_FILTER_OFFSET_Y = 2;
            const DECOR_VISIBLE_ROWS = 3;
            const DECOR_SCROLL_BTN_W = 24;
            const DECOR_PANEL_W = DECOR_COLS * DECOR_CELL_W + DECOR_PAD * 2 + DECOR_SCROLL_BTN_W;
            const DECOR_PANEL_H = DECOR_DROPDOWN_H + DECOR_VISIBLE_ROWS * DECOR_CELL_H + DECOR_PAD * 2;
            const rows = Math.ceil(items.length / DECOR_COLS);
            const contentH = rows * DECOR_CELL_H;
            const maxScroll = Math.max(0, contentH - DECOR_VISIBLE_ROWS * DECOR_CELL_H);

            const decorItemX = itemX;
            const decorItemY = menuBottom - DECOR_PANEL_H - 10;

            const ibgDecor = this.add.graphics();
            ibgDecor.fillStyle(CLR.uiBg, 0.96);
            ibgDecor.fillRoundedRect(decorItemX, decorItemY, DECOR_PANEL_W, DECOR_PANEL_H, 6);
            ibgDecor.lineStyle(2, color);
            ibgDecor.strokeRoundedRect(decorItemX, decorItemY, DECOR_PANEL_W, DECOR_PANEL_H, 6);
            ct.add(ibgDecor);

            const scrollAreaY = decorItemY + DECOR_DROPDOWN_H;
            const scrollAreaH = DECOR_VISIBLE_ROWS * DECOR_CELL_H + DECOR_PAD;

            const filterBarX = decorItemX + DECOR_PAD + 4;
            const filterBarW = DECOR_COLS * DECOR_CELL_W - 8;
            const filterBarY = decorItemY + 4 + DECOR_FILTER_OFFSET_Y;
            const filterBarCenterY = decorItemY + DECOR_DROPDOWN_H / 2 + DECOR_FILTER_OFFSET_Y;

            const dropdownBg = this.add.graphics();
            dropdownBg.fillStyle(0x1a2435, 0.98);
            dropdownBg.lineStyle(1, 0x6a7a8a, 0.9);
            dropdownBg.fillRoundedRect(filterBarX, filterBarY, filterBarW, DECOR_DROPDOWN_H - 8, 3);
            dropdownBg.strokeRoundedRect(filterBarX, filterBarY, filterBarW, DECOR_DROPDOWN_H - 8, 3);
            ct.add(dropdownBg);

            const arrow = this._buildDecorDropdownOpen ? '\u25B2' : '\u25BC';
            const filterLabel = this.txt(filterBarX + 6, filterBarCenterY, `Filter: ${filter} ${arrow}`, 5, '#E8E8E8').setOrigin(0, 0.5);
            ct.add(filterLabel);
            const dropdownHit = this.add.rectangle(filterBarX + filterBarW / 2, filterBarCenterY, filterBarW, DECOR_DROPDOWN_H - 8, 0, 0).setOrigin(0.5).setInteractive({ useHandCursor: true });
            dropdownHit.on('pointerdown', () => {
                this._buildDecorDropdownOpen = !this._buildDecorDropdownOpen;
                this._renderBuildMenu();
            });
            ct.add(dropdownHit);

            const scrollContent = this.add.container(decorItemX + DECOR_PAD, scrollAreaY + DECOR_PAD);
            ct.add(scrollContent);

            const maskW = DECOR_COLS * DECOR_CELL_W + DECOR_PAD;
            const maskH = DECOR_VISIBLE_ROWS * DECOR_CELL_H;
            const maskGraphics = this.make.graphics({ add: false });
            maskGraphics.fillStyle(0xFFFFFF, 1);
            maskGraphics.fillRect(decorItemX + DECOR_PAD, scrollAreaY + DECOR_PAD, maskW, maskH);
            const geomask = maskGraphics.createGeometryMask();
            scrollContent.setMask(geomask);
            this._buildDecorMaskGraphics = maskGraphics;

            let scrollOffset = 0;
            const updateScroll = (delta) => {
                scrollOffset = Phaser.Math.Clamp(scrollOffset + delta, 0, maxScroll);
                scrollContent.setPosition(decorItemX + DECOR_PAD, scrollAreaY + DECOR_PAD - scrollOffset);
            };

            items.forEach((d, i) => {
                const col = i % DECOR_COLS, row = Math.floor(i / DECOR_COLS);
                const lx = col * DECOR_CELL_W + DECOR_CELL_W / 2;
                const ly = row * DECOR_CELL_H + DECOR_CELL_H / 2;
                const canAfford = this.gs.state.coins >= d.cost;
                const rx = lx - DECOR_CELL_W / 2 + 4, ry = ly - DECOR_CELL_H / 2 + 4, rw = DECOR_CELL_W - 8, rh = DECOR_CELL_H - 8;

                const btnBg = this.add.graphics();
                btnBg.fillStyle(canAfford ? d.color : 0x444444, canAfford ? 0.3 : 0.25);
                btnBg.fillRoundedRect(rx, ry, rw, rh, 4);
                scrollContent.add(btnBg);
                scrollContent.add(this.add.image(lx, ly - 8, `decor_${d.id}`).setScale(0.75));
                scrollContent.add(this.txt(lx, ly + 18, `${d.cost}g`, 5, canAfford ? CLR.gold : '#884444').setOrigin(0.5));

                if (canAfford) {
                    const hit = this.add.rectangle(lx, ly, rw, rh, 0, 0).setInteractive({ useHandCursor: true });
                    hit.on('pointerover', () => { btnBg.clear(); btnBg.fillStyle(d.color, 0.55); btnBg.fillRoundedRect(rx, ry, rw, rh, 4); btnBg.lineStyle(1, d.color, 0.8); btnBg.strokeRoundedRect(rx, ry, rw, rh, 4); });
                    hit.on('pointerout', () => { btnBg.clear(); btnBg.fillStyle(d.color, 0.3); btnBg.fillRoundedRect(rx, ry, rw, rh, 4); });
                    hit.on('pointerdown', () => { if (this.gs.state.rescuePaused) return; this.closeBuildPopup(); this.gs.enterDecorBuild(d.id); });
                    scrollContent.add(hit);
                }
            });

            if (maxScroll > 0) {
                const btnX = decorItemX + DECOR_PANEL_W - DECOR_SCROLL_BTN_W / 2 - 4;
                const btnY = decorItemY + DECOR_PANEL_H / 2;
                const scrollAmt = 56;

                const upBtn = this.txt(btnX, btnY - 20, '\u25B2', 10, '#AAAAAA').setOrigin(0.5).setInteractive({ useHandCursor: true });
                upBtn.on('pointerover', () => upBtn.setColor('#FFFFFF'));
                upBtn.on('pointerout', () => upBtn.setColor('#AAAAAA'));
                upBtn.on('pointerdown', () => { updateScroll(-scrollAmt); });
                ct.add(upBtn);

                const downBtn = this.txt(btnX, btnY + 20, '\u25BC', 10, '#AAAAAA').setOrigin(0.5).setInteractive({ useHandCursor: true });
                downBtn.on('pointerover', () => downBtn.setColor('#FFFFFF'));
                downBtn.on('pointerout', () => downBtn.setColor('#AAAAAA'));
                downBtn.on('pointerdown', () => { updateScroll(scrollAmt); });
                ct.add(downBtn);

                this._buildDecorScrollArea = { x: decorItemX, y: scrollAreaY, w: DECOR_PANEL_W - DECOR_SCROLL_BTN_W, h: scrollAreaH };
                this._buildDecorUpdateScroll = updateScroll;
                const wheelHandler = (ptr, dx, dy, dz) => {
                    if (!this._buildItemPopup || this._buildCategory !== 'decorations' || !this._buildDecorScrollArea) return;
                    const px = ptr.x, py = ptr.y;
                    const a = this._buildDecorScrollArea;
                    if (px >= a.x && px <= a.x + a.w && py >= a.y && py <= a.y + a.h) {
                        this._buildDecorUpdateScroll(dy * 0.5);
                    }
                };
                const domWheelHandler = (e) => {
                    if (!this._buildItemPopup || this._buildCategory !== 'decorations' || !this._buildDecorScrollArea) return;
                    const px = this.input.mousePointer.x, py = this.input.mousePointer.y;
                    const a = this._buildDecorScrollArea;
                    if (px >= a.x && px <= a.x + a.w && py >= a.y && py <= a.y + a.h) {
                        this._buildDecorUpdateScroll(e.deltaY * 0.5);
                        e.preventDefault();
                    }
                };
                this.input.on('wheel', wheelHandler);
                this.game.canvas.addEventListener('wheel', domWheelHandler, { passive: false });
                this._buildDecorWheelCleanup = () => {
                    this.input.off('wheel', wheelHandler);
                    this.game.canvas.removeEventListener('wheel', domWheelHandler);
                    this._buildDecorScrollArea = null;
                    this._buildDecorUpdateScroll = null;
                };
            }

            if (this._buildDecorDropdownOpen) {
                const optY = decorItemY + DECOR_DROPDOWN_H + DECOR_FILTER_OFFSET_Y;
                const dropdownOptsBg = this.add.graphics();
                dropdownOptsBg.fillStyle(0x1a2230, 0.98);
                dropdownOptsBg.lineStyle(1, 0x4a5a6a, 0.9);
                dropdownOptsBg.fillRoundedRect(filterBarX, optY, filterBarW, DECOR_CATEGORIES.length * 22 + 4, 4);
                dropdownOptsBg.strokeRoundedRect(filterBarX, optY, filterBarW, DECOR_CATEGORIES.length * 22 + 4, 4);
                ct.add(dropdownOptsBg);
                DECOR_CATEGORIES.forEach((cat, i) => {
                    const oy = optY + 2 + i * 22;
                    const rx = filterBarX + 4, rw = filterBarW - 8, rh = 20;
                    const optBg = this.add.graphics();
                    const baseColor = cat === filter ? 0x3a6a4a : 0x2a3542;
                    const hoverColor = cat === filter ? 0x4a8a5a : 0x3a4555;
                    const drawBg = (color) => {
                        optBg.clear();
                        optBg.fillStyle(color, 0.95);
                        optBg.fillRoundedRect(rx, oy, rw, rh, 2);
                    };
                    drawBg(baseColor);
                    ct.add(optBg);
                    const optTxt = this.txt(rx + 4, oy + 10, cat, 5, '#FFFFFF').setOrigin(0, 0.5);
                    ct.add(optTxt);
                    const optHit = this.add.rectangle(filterBarX + filterBarW / 2, oy + 10, rw, rh, 0, 0).setOrigin(0.5).setInteractive({ useHandCursor: true });
                    optHit.on('pointerover', () => { drawBg(hoverColor); optTxt.setColor('#E8F0FF'); });
                    optHit.on('pointerout', () => { drawBg(baseColor); optTxt.setColor('#FFFFFF'); });
                    optHit.on('pointerdown', () => {
                        this._buildDecorFilter = cat;
                        this._buildDecorDropdownOpen = false;
                        this._renderBuildMenu();
                    });
                    ct.add(optHit);
                });
            }
        }

        this._buildItemPopup = ct;
    }

    closeBuildPopup() {
        if (this._buildDecorMaskGraphics) { this._buildDecorMaskGraphics.destroy(); this._buildDecorMaskGraphics = null; }
        if (this._buildDecorWheelCleanup) { this._buildDecorWheelCleanup(); this._buildDecorWheelCleanup = null; }
        this._buildPopupBounds = null;
        if (this._buildDismiss) { this._buildDismiss.destroy(); this._buildDismiss = null; }
        if (this._buildItemPopup) { this._buildItemPopup.destroy(); this._buildItemPopup = null; }
        if (this.buildPopup) { this.buildPopup.destroy(); this.buildPopup = null; }
        this._buildCategory = null;
        if (this._activePanel === 'build') { this._activePanel = null; this._refreshToolBtns(); }
    }

    /* ========== EVENTS ========== */

    // Subscribes to game events: timeUpdate, coinsUpdate, foodUpdate, rescueEvent, showAnimalInfo,
    // showHabitatInfo, showFacilityView (triggers facility back bar), animalUpdate (auto-refreshes
    // animal panel), animalDeselected (closes animal panel when selection cleared, e.g. navigating
    // to an empty habitat), habitatViewClosed (cleanup on zoom-out from habitat or facility), etc.
    listenEvents() {
        const ev = this.game.events;
        ev.on('timeUpdate', this.updateTime, this);
        ev.on('coinsUpdate', this.updateCoins, this);
        ev.on('foodUpdate', this.updateFood, this);
        ev.on('rescueEvent', this.showRescue, this);
        ev.on('showAnimalInfo', this.showAnimal, this);
        ev.on('showHabitatInfo', this.showHabitatPanel, this);
        ev.on('notification', this.notify, this);
        ev.on('buildModeChanged', mode => {
            this.activeBuild = mode;
            if (!mode) {
                this.closeBuildPopup();
                this.hideBuildHint();
            } else {
                this.showBuildHint();
            }
            this.toolBtns.forEach(b => {
                const isActive = b.key === mode ||
                    (b.key === 'build' && mode && (HABITATS[mode] || (mode && mode.startsWith('decor_')) || (mode && mode.startsWith('facility_'))));
                this.drawToolBtn(b.bg, b.x, b.y, b.color, isActive, b.gap);
            });
        });
        ev.on('habitatViewClosed', () => {
            if (this.habitatPanel) { this.habitatPanel.destroy(); this.habitatPanel = null; }
            if (this.animalPanel) { this.animalPanel.destroy(); this.animalPanel = null; this._viewedAnimal = null; }
        if (this.facilityPanel) { this.facilityPanel.destroy(); this.facilityPanel = null; this._facilityPanelBathroom = null; }
        this.destroyBackBar();
        this.showToolbar();
        });
        ev.on('showFacilityView', fac => this.showFacilityBackBar(fac));
        ev.on('habitatSelectEnter', label => this.showSelectBar(label));
        ev.on('habitatSelectExit', () => this.hideSelectBar());
        ev.on('animalDeselected', () => {
            if (this.animalPanel) { this.animalPanel.destroy(); this.animalPanel = null; this._viewedAnimal = null; }
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

    // Updates day, season, clock, and reputation face texture.
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
        const repLevel = Math.max(0, Math.min(10, Math.floor(Phaser.Math.Clamp(d.rep, 0, 100) / 10)));
        this.repFace.setTexture(`rep_face_${repLevel}`);
    }

    // Updates coin display with brief scale pulse.
    updateCoins(c) {
        this.coinTxt.setText(c.toString());
        this.tweens.add({ targets: this.coinTxt, scaleX: 1.3, scaleY: 1.3, yoyo: true, duration: 150 });
    }

    updateFood(f) {
        this.foodTxt.setText(Math.floor(f).toString());
        this.tweens.add({ targets: this.foodTxt, scaleX: 1.3, scaleY: 1.3, yoyo: true, duration: 150 });
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
        const entry = this._notifQueue.shift();
        const isObj = typeof entry === 'object';
        const text = isObj ? entry.text : entry;
        const icon = isObj ? entry.icon : null;
        const topY = 50;

        const n = this.add.text(W / 2, topY + 8, (icon ? '  ' : '') + text, {
            fontFamily: '"Press Start 2P", monospace', fontSize: '9px', color: CLR.uiText,
            stroke: '#000000', strokeThickness: 2,
            backgroundColor: '#1A2438DD', padding: { x: 10, y: 8 }, wordWrap: { width: 420 }
        }).setOrigin(0.5, 0).setAlpha(0).setDepth(200);

        let iconImg = null;
        if (icon) {
            iconImg = this.add.image(n.x - n.width / 2 + 14, topY + 8 + n.height / 2, icon)
                .setScale(1.2).setTint(0xFFD700).setAlpha(0).setDepth(201);
        }

        const elements = icon ? [n, iconImg] : [n];
        this.tweens.add({ targets: elements, alpha: 1, y: `-=8`, duration: 300 });
        this.tweens.add({
            targets: elements, alpha: 0, y: `-=12`,
            delay: 2400, duration: 400,
            onComplete: () => { elements.forEach(e => e.destroy()); this._showNextNotif(); }
        });
    }

    /* ========== RESCUE POPUP ========== */

    // Modal with rescued animal details. Buttons adapt: Rescue!/Pass if compatible habitats exist,
    // or "Build [Type] (Xg)"/Pass if none available. Pauses game time (rescuePaused),
    // dims the screen with a grey tint, blocks all other interactions (toolbar, habitat clicks,
    // animal selection, panel buttons, ESC), and preserves any open habitat/animal panels.
    // If multiple habitats are compatible, zooms out to sanctuary view for habitat selection.
    showRescue(ev) {
        if (this.rescuePopup) this.rescuePopup.destroy();
        if (this._rescueTint) this._rescueTint.destroy();
        this.closeBuildPopup();
        this.gs.state.rescuePaused = true;

        this._rescueTint = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.45).setDepth(295);
        const tint = this._rescueTint;

        const sp = SPECIES[ev.speciesId], rc = RARITY_COLOR[sp.rarity];
        const compatHabs = this.gs.findAllCompatibleHabitats(sp);
        const cx = W / 2, cy = H / 2, pw = 420, ph = 260;
        const ct = this.add.container(cx, cy).setDepth(300);
        const bg = this.add.graphics();
        bg.fillStyle(CLR.uiPanelBg, 0.96); bg.fillRoundedRect(-pw / 2, -ph / 2, pw, ph, 8);
        bg.lineStyle(2, rc); bg.strokeRoundedRect(-pw / 2, -ph / 2, pw, ph, 8);
        ct.add(bg);
        ct.add(this.txt(0, -ph / 2 + 18, 'RESCUE EVENT!', 12, CLR.gold).setOrigin(0.5));
        const rescueTex = ev.variantIdx != null ? `animal_${ev.speciesId}_${ev.variantIdx}` : `animal_${ev.speciesId}`;
        ct.add(this.add.image(0, -40, rescueTex).setScale(1.5));
        ct.add(this.txt(0, -2, `${ev.name} the ${sp.name}`, 9).setOrigin(0.5));
        const rClr = '#' + rc.toString(16).padStart(6, '0');
        ct.add(this.txt(0, 16, sp.rarity.toUpperCase(), 7, rClr).setOrigin(0.5));
        if (sp.season) ct.add(this.txt(0, 32, `Seasonal: ${sp.season}`, 6, '#AABB99').setOrigin(0.5));
        ct.add(this.txt(0, 46, ev.msg, 6, '#CCBBAA').setOrigin(0.5).setWordWrapWidth(380));

        const dismissRescue = () => {
            tint.destroy(); ct.destroy(); this.rescuePopup = null; this._rescueTint = null;
            this.gs.state.pendingRescue = null;
            this.gs.state.rescuePaused = false;
        };

        const btnW = 120, btnGap = 8;
        if (compatHabs.length >= 1) {
            const totalW = 2 * btnW + btnGap;
            const btnLeft = -totalW / 2;

            const accBg = this.add.graphics();
            accBg.fillStyle(0x228B22, 0.85); accBg.fillRoundedRect(btnLeft, 88, btnW, 30, 4);
            ct.add(accBg);
            const accTxt = this.txt(btnLeft + btnW / 2, 103, 'Rescue!', 8).setOrigin(0.5);
            ct.add(accTxt);
            const accHit = this.add.rectangle(btnLeft + btnW / 2, 103, btnW, 30, 0x000000, 0).setOrigin(0.5).setInteractive({ useHandCursor: true });
            accHit.on('pointerdown', () => {
                if (compatHabs.length === 1) {
                    dismissRescue();
                    this.gs.acceptRescueInto(ev, compatHabs[0]);
                } else {
                    tint.destroy(); ct.destroy(); this.rescuePopup = null; this._rescueTint = null;
                    this._pendingRescue = ev;
                    const needsZoom = this.gs.state.viewingHabitat || this.gs.state.viewingFacility || this.gs.cameras.main.zoom > 1;
                    if (needsZoom) {
                        this.gs.zoomOut();
                        this.time.delayedCall(400, () => this.gs.enterRescueSelect(ev));
                    } else {
                        this.gs.enterRescueSelect(ev);
                    }
                }
            });
            accHit.on('pointerover', () => accTxt.setColor(CLR.gold));
            accHit.on('pointerout', () => accTxt.setColor(CLR.uiText));
            ct.add(accHit);

            const decBg = this.add.graphics();
            decBg.fillStyle(0x8B2222, 0.85); decBg.fillRoundedRect(btnLeft + btnW + btnGap, 88, btnW, 30, 4);
            ct.add(decBg);
            const decTxt = this.txt(btnLeft + btnW + btnGap + btnW / 2, 103, 'Pass', 8).setOrigin(0.5);
            ct.add(decTxt);
            const decHit = this.add.rectangle(btnLeft + btnW + btnGap + btnW / 2, 103, btnW, 30, 0x000000, 0).setOrigin(0.5).setInteractive({ useHandCursor: true });
            decHit.on('pointerdown', () => { dismissRescue(); });
            decHit.on('pointerover', () => decTxt.setColor('#FF8888'));
            decHit.on('pointerout', () => decTxt.setColor(CLR.uiText));
            ct.add(decHit);
        } else {
            const compatType = Object.values(HABITATS).find(h => h.types.includes(sp.type));
            const buildCost = compatType ? this.gs.getHabitatCost(compatType.id) : 0;
            const canBuild = compatType && this.gs.state.coins >= buildCost;
            const bldW = 190, passW = 80;
            const totalW = bldW + btnGap + passW;
            const btnLeft = -totalW / 2;

            const bldBg = this.add.graphics();
            bldBg.fillStyle(canBuild ? 0x1a6090 : 0x555555, 0.85); bldBg.fillRoundedRect(btnLeft, 88, bldW, 30, 4);
            ct.add(bldBg);
            const bldLabel = compatType ? `Build ${compatType.name} (${buildCost}g)` : 'No Habitat';
            const bldTxt = this.txt(btnLeft + bldW / 2, 103, bldLabel, 7).setOrigin(0.5);
            if (canBuild) {
                ct.add(bldTxt);
                const bldHit = this.add.rectangle(btnLeft + bldW / 2, 103, bldW, 30, 0x000000, 0).setOrigin(0.5).setInteractive({ useHandCursor: true });
                bldHit.on('pointerdown', () => {
                    tint.destroy(); ct.destroy(); this.rescuePopup = null; this._rescueTint = null;
                    this.gs.state.rescuePaused = false;
                    this._pendingRescue = ev;
                    this.closeBuildPopup();
                    this.gs.enterBuild(compatType.id);
                });
                bldHit.on('pointerover', () => bldTxt.setColor('#88CCFF'));
                bldHit.on('pointerout', () => bldTxt.setColor(CLR.uiText));
                ct.add(bldHit);
            } else { bldTxt.setColor('#888888'); ct.add(bldTxt); }

            const decBg = this.add.graphics();
            decBg.fillStyle(0x8B2222, 0.85); decBg.fillRoundedRect(btnLeft + bldW + btnGap, 88, passW, 30, 4);
            ct.add(decBg);
            const decTxt2 = this.txt(btnLeft + bldW + btnGap + passW / 2, 103, 'Pass', 8).setOrigin(0.5);
            ct.add(decTxt2);
            const decHit2 = this.add.rectangle(btnLeft + bldW + btnGap + passW / 2, 103, passW, 30, 0x000000, 0).setOrigin(0.5).setInteractive({ useHandCursor: true });
            decHit2.on('pointerdown', () => { dismissRescue(); });
            decHit2.on('pointerover', () => decTxt2.setColor('#FF8888'));
            decHit2.on('pointerout', () => decTxt2.setColor(CLR.uiText));
            ct.add(decHit2);
        }

        ct.setScale(0);
        this.tweens.add({ targets: ct, scaleX: 1, scaleY: 1, duration: 280, ease: 'Back.easeOut' });
        this.rescuePopup = ct;
    }

    /* ========== ANIMAL INFO PANEL ========== */

    // Selected animal: stats, trait, illness, pregnancy/cooldown status, bond level/XP bar, friendships, actions (Feed, Pet, Treat, Heal).
    // Feed consumes food (species foodCost) and is disabled when hunger is full.
    // Treat costs 20g and is disabled when the player can't afford it.
    // Bond is level-based with increasing XP thresholds.
    // Only shown when zoomed into a habitat. Tracks _viewedAnimal for auto-refresh via animalUpdate event.
    // Navigation arrows below the panel cycle through habitat animals, transferring the glow highlight.
    showAnimal(animal) {
        if (this.animalPanel) this.animalPanel.destroy();
        if (this.rescuePopup) return;
        this._viewedAnimal = animal;

        const sp = SPECIES[animal.speciesId], rc = RARITY_COLOR[sp.rarity];
        const pw = 230, px = W - pw - 6, py = 48;
        const hasHeal = this.gs.state.upgrades.has('medical_kit') && animal.illness;

        const ct = this.add.container(px, py).setDepth(250);

        const nameTxt = this.txt(pw / 2, 12, animal.name, 10, CLR.gold).setOrigin(0.5);
        ct.add(nameTxt);
        const genderKey = animal.gender === 'female' ? 'icon_female' : 'icon_male';
        ct.add(this.add.image(pw / 2 + nameTxt.width / 2 + 10, 14, genderKey).setScale(1.2));
        const rClr = '#' + rc.toString(16).padStart(6, '0');
        const genLabel = animal.generation > 1 ? ` \u2022 Gen ${animal.generation}` : '';
        ct.add(this.txt(pw / 2, 28, `${sp.name} (${sp.rarity})${genLabel}`, 6, rClr).setOrigin(0.5));
        const animalTex = animal.variantIdx != null ? `animal_${animal.speciesId}_${animal.variantIdx}` : `animal_${animal.speciesId}`;
        ct.add(this.add.image(pw / 2, 56, animalTex).setScale(1.2));

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
        const hungerFull = animal.hunger >= 100;
        const cantAffordTreat = this.gs.state.coins < 20;
        this.panelBtn(ct, 8, yy, bw, 'Feed', 0x44AA44, () => { this.gs.feedAnimal(animal.id); this.showAnimal(animal); }, hungerFull);
        this.panelBtn(ct, 8 + bw + 4, yy, bw, 'Pet', 0xCC6688, () => { this.gs.petAnimal(animal.id); this.showAnimal(animal); });
        this.panelBtn(ct, 8 + (bw + 4) * 2, yy, bw, 'Treat', 0xCCAA33, () => { this.gs.treatAnimal(animal.id); this.showAnimal(animal); }, cantAffordTreat);
        ct.add(this.txt(8 + (bw + 4) * 2 + bw - 2, yy + 24, '20g', 5, CLR.gold).setOrigin(1, 0));
        yy += 32;

        if (hasHeal) {
            const healLabel = animal.illness ? `Heal (${ILLNESSES[animal.illness.type]?.treatCost || 30}g)` : 'Heal (30g)';
            this.panelBtn(ct, 8, yy, 120, healLabel, 0x44AAAA, () => { this.gs.healAnimal(animal.id); this.showAnimal(animal); });
            yy += 30;
        }

        if (animal.isPregnant) {
            const daysLeft = animal.pregnancyTimer / 720;
            const dueLabel = daysLeft < 1
                ? `Due in ~${Math.max(1, Math.round(daysLeft * 24))} hours`
                : `Due in ~${Math.round(daysLeft)} days`;
            ct.add(this.txt(8, yy + 4, dueLabel, 6, '#FF88CC'));
            yy += 22;
        } else if (animal.breedCooldown > 0) {
            const dLeft = Math.max(0, Math.ceil(animal.breedCooldown / 720));
            ct.add(this.txt(8, yy + 4, `Breed cooldown: ${dLeft}d`, 5, '#888888'));
            yy += 22;
        }

        // Player bond level (XP-based leveling with increasing thresholds)
        yy += 4;
        const bLvl = animal.bondLevel;
        const bXP = animal.bondXP;
        const bNeeded = this.gs.getBondXPForLevel(bLvl);
        const bPct = bNeeded > 0 ? (bXP / bNeeded) * 100 : 0;
        const hearts = bLvl >= 8 ? '\u2665\u2665\u2665' : bLvl >= 5 ? '\u2665\u2665' : bLvl >= 2 ? '\u2665' : '';
        const bondClr = bLvl >= 8 ? '#FFAA44' : bLvl >= 5 ? '#66BBFF' : bLvl >= 2 ? '#88CC88' : '#AAAAAA';
        this.statBar(ct, 10, yy, pw - 20, `Bond Lv${bLvl}`, bPct, 0xDD8866);
        if (hearts) ct.add(this.txt(pw - 6, yy + 1, hearts, 5, bondClr).setOrigin(1, 0));
        ct.add(this.txt(pw / 2, yy + 1, `${Math.floor(bXP)}/${bNeeded} XP`, 4, '#CCBBAA').setOrigin(0.5, 0));
        yy += 18;

        if (animal.bonds.length > 0) {
            const bondNames = animal.bonds.slice(0, 3).map(bid => {
                const b = this.gs.state.animals.find(a => a.id === bid);
                if (!b) return '?';
                return b.generation > 1 ? `${b.name} G${b.generation}` : b.name;
            }).join(', ');
            const friendsTxt = this.txt(8, yy, `Friends: ${bondNames}`, 5, '#66BBFF').setWordWrapWidth(pw - 16);
            ct.add(friendsTxt);
            yy += friendsTxt.height + 4;
        }

        const relocateHabs = this.gs.findAllCompatibleHabitats(sp).filter(h => h.id !== animal.habitatId);
        if (relocateHabs.length > 0) {
            this.panelBtn(ct, 8, yy, 120, 'Relocate', 0x6688BB, () => {
                ct.destroy(); this.animalPanel = null; this._viewedAnimal = null;
                this.gs.clearSelectedAnimal();
                this.gs.zoomOut();
                this.time.delayedCall(400, () => this.gs.enterRelocateSelect(animal));
            });
            yy += 30;
        }

        const ph = yy + 8;
        const bg = this.add.graphics();
        bg.fillStyle(CLR.uiPanelBg, 0.94); bg.fillRoundedRect(0, 0, pw, ph, 6);
        bg.lineStyle(2, CLR.uiBorder); bg.strokeRoundedRect(0, 0, pw, ph, 6);
        ct.addAt(bg, 0);

        const closeBtn = this.txt(pw - 8, 4, 'X', 8, '#FF6666').setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
        closeBtn.on('pointerdown', () => { if (this.gs.state.rescuePaused) return; ct.destroy(); this.animalPanel = null; this._viewedAnimal = null; this.gs.clearSelectedAnimal(); });
        ct.add(closeBtn);

        // Navigation arrows to cycle through habitat animals
        const habId = animal.habitatId;
        const habAnimals = this.gs.state.animals.filter(a => a.habitatId === habId);
        if (habAnimals.length > 1) {
            const curIdx = habAnimals.findIndex(a => a.id === animal.id);
            const navY = ph + 6;
            const navBg = this.add.graphics();
            navBg.fillStyle(CLR.uiPanelBg, 0.9); navBg.fillRoundedRect(pw / 2 - 50, navY, 100, 24, 4);
            navBg.lineStyle(1, CLR.uiBorder, 0.5); navBg.strokeRoundedRect(pw / 2 - 50, navY, 100, 24, 4);
            ct.add(navBg);

            const prevBtn = this.txt(pw / 2 - 36, navY + 12, '<', 10, '#AAAAAA').setOrigin(0.5).setInteractive({ useHandCursor: true });
            prevBtn.on('pointerover', () => prevBtn.setColor('#FFFFFF'));
            prevBtn.on('pointerout', () => prevBtn.setColor('#AAAAAA'));
            prevBtn.on('pointerdown', () => {
                if (this.gs.state.rescuePaused) return;
                const ni = (curIdx - 1 + habAnimals.length) % habAnimals.length;
                this.gs.selectAnimal(habAnimals[ni]);
            });
            ct.add(prevBtn);

            ct.add(this.txt(pw / 2, navY + 12, `${curIdx + 1} / ${habAnimals.length}`, 6, '#888888').setOrigin(0.5));

            const nextBtn = this.txt(pw / 2 + 36, navY + 12, '>', 10, '#AAAAAA').setOrigin(0.5).setInteractive({ useHandCursor: true });
            nextBtn.on('pointerover', () => nextBtn.setColor('#FFFFFF'));
            nextBtn.on('pointerout', () => nextBtn.setColor('#AAAAAA'));
            nextBtn.on('pointerdown', () => {
                if (this.gs.state.rescuePaused) return;
                const ni = (curIdx + 1) % habAnimals.length;
                this.gs.selectAnimal(habAnimals[ni]);
            });
            ct.add(nextBtn);
        }

        this.animalPanel = ct;
        this._animalPanelBounds = { x: px, y: py, w: pw, h: ph };
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

    // Creates a colored action button inside a panel container. Uses an invisible hit zone
    // covering the full button area so clicks register anywhere on the button, not just the label.
    // When disabled is true the button is greyed out and non-interactive.
    panelBtn(ct, x, y, w, label, color, cb, disabled = false) {
        const bg = this.add.graphics();
        const fillColor = disabled ? 0x555555 : color;
        bg.fillStyle(fillColor, disabled ? 0.35 : 0.55); bg.fillRoundedRect(x, y, w, 26, 3);
        ct.add(bg);
        const txtColor = disabled ? '#666666' : CLR.uiText;
        ct.add(this.txt(x + w / 2, y + 13, label, 6, txtColor).setOrigin(0.5));
        if (!disabled) {
            const hit = this.add.rectangle(x + w / 2, y + 13, w, 26, 0x000000, 0).setOrigin(0.5);
            hit.setInteractive({ useHandCursor: true });
            hit.on('pointerdown', () => { if (!this.gs.state.rescuePaused) cb(); });
            hit.on('pointerover', () => { bg.clear(); bg.fillStyle(color, 0.8); bg.fillRoundedRect(x, y, w, 26, 3); });
            hit.on('pointerout', () => { bg.clear(); bg.fillStyle(color, 0.55); bg.fillRoundedRect(x, y, w, 26, 3); });
            ct.add(hit);
        }
    }

    /* ========== HABITAT INFO PANEL ========== */

    // Habitat details, current enrichments, add-enrichment options. Shown when zoomed in.
    // Has a red X close button in the top-right corner that triggers zoomOut.
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
                ct.add(this.txt(pw - 50, yy + 14, `${eCost}g`, 5, canAfford ? CLR.gold : '#884444').setOrigin(1, 0.5));
                if (canAfford) {
                    const buyBtn = this.txt(pw - 10, yy + 14, 'ADD', 5, '#44CC44').setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
                    buyBtn.on('pointerdown', () => { this.gs.addEnrichment(hab.id, en.id); this.showHabitatPanel(hab); });
                    buyBtn.on('pointerover', () => buyBtn.setColor('#88FF88'));
                    buyBtn.on('pointerout', () => buyBtn.setColor('#44CC44'));
                    ct.add(buyBtn);
                }
                yy += 33;
            }
        } else {
            ct.add(this.txt(8, yy, `Enrichment full (${maxEnrich}/${maxEnrich})`, 5, '#888888'));
            yy += 18;
        }

        yy += 4;
        const moveBg = this.add.graphics();
        moveBg.fillStyle(0x335577, 0.5); moveBg.fillRoundedRect(6, yy, pw - 12, 24, 3);
        ct.add(moveBg);
        const moveBtn = this.txt(pw / 2, yy + 12, 'Move Habitat', 5, '#88BBDD').setOrigin(0.5).setInteractive({ useHandCursor: true });
        moveBtn.on('pointerdown', () => { this.gs.enterMoveMode(hab); });
        moveBtn.on('pointerover', () => moveBtn.setColor('#AADDFF'));
        moveBtn.on('pointerout', () => moveBtn.setColor('#88BBDD'));
        ct.add(moveBtn);
        yy += 30;

        const isEmpty = hab.animals.length === 0;
        const canAutoRelocate = this.gs.canAllAnimalsInHabitatBeRelocated(hab.id);
        const canDestroy = isEmpty || canAutoRelocate;
        const destroyLabel = isEmpty ? 'Destroy' : (canAutoRelocate ? 'Destroy (Auto Relocate)' : 'Destroy');
        const destroyBg = this.add.graphics();
        destroyBg.fillStyle(canDestroy ? 0x773333 : 0x333333, 0.5);
        destroyBg.fillRoundedRect(6, yy, pw - 12, 24, 3);
        ct.add(destroyBg);
        const destroyTxt = this.txt(pw / 2, yy + 12, destroyLabel, 5, canDestroy ? '#DD6666' : '#666666').setOrigin(0.5);
        ct.add(destroyTxt);
        if (canDestroy) {
            const destroyHit = this.add.rectangle(pw / 2, yy + 12, pw - 12, 24, 0, 0).setOrigin(0.5).setInteractive({ useHandCursor: true });
            destroyHit.on('pointerdown', () => {
                if (isEmpty) this.gs.destroyHabitat(hab.id);
                else this.gs.destroyHabitatWithAutoRelocate(hab.id);
            });
            destroyHit.on('pointerover', () => destroyTxt.setColor('#FF8888'));
            destroyHit.on('pointerout', () => destroyTxt.setColor('#DD6666'));
            ct.add(destroyHit);
        }
        yy += 30;

        const ph = yy + 8;
        const bg = this.add.graphics();
        bg.fillStyle(CLR.uiPanelBg, 0.94); bg.fillRoundedRect(0, 0, pw, ph, 6);
        bg.lineStyle(2, ht.stroke); bg.strokeRoundedRect(0, 0, pw, ph, 6);
        ct.addAt(bg, 0);

        const closeBtn = this.txt(pw - 8, 6, 'X', 8, '#CC4444').setOrigin(1, 0).setInteractive({ useHandCursor: true });
        closeBtn.on('pointerdown', () => { if (!this.gs.state.rescuePaused) this.gs.zoomOut(); });
        closeBtn.on('pointerover', () => closeBtn.setColor('#FF6666'));
        closeBtn.on('pointerout', () => closeBtn.setColor('#CC4444'));
        ct.add(closeBtn);

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
        bbBtn.on('pointerdown', () => { if (!this.gs.state.rescuePaused) this.gs.zoomOut(); });
        bbBtn.on('pointerover', () => { bbBtn.setColor('#FFEECC'); bbBg.clear(); bbBg.fillStyle(0x886633, 0.85); bbBg.fillRoundedRect(bbX, bbY, bbW, bbH, 6); bbBg.lineStyle(2, 0xCCBB77); bbBg.strokeRoundedRect(bbX, bbY, bbW, bbH, 6); });
        bbBtn.on('pointerout', () => { bbBtn.setColor('#FFCC88'); bbBg.clear(); bbBg.fillStyle(0x664422, 0.75); bbBg.fillRoundedRect(bbX, bbY, bbW, bbH, 6); bbBg.lineStyle(2, 0xAA8855); bbBg.strokeRoundedRect(bbX, bbY, bbW, bbH, 6); });

        this._backBarElements = [backBar, bbBg, bbBtn];
        this.habitatPanel = ct;
        this._habitatPanelBounds = { x: px, y: py, w: pw, h: ph };
    }

    showFacilityBackBar(fac) {
        this.destroyBackBar();
        if (this.facilityPanel) {
            this.facilityPanel.destroy();
            this.facilityPanel = null;
            this._facilityPanelBathroom = null;
        }
        this.hideToolbar();

        const ft = FACILITIES[fac.type];
        const pw = 200, px = 8, py = 48;
        const ct = this.add.container(px, py).setDepth(250);

        ct.add(this.txt(pw / 2, 12, ft.name, 10, CLR.gold).setOrigin(0.5));
        const descTxt = this.txt(8, 30, ft.desc, 5, '#AAAAAA').setWordWrapWidth(pw - 16);
        ct.add(descTxt);

        let yy = 30 + descTxt.height + 10;

        if (fac.type === 'bathroom') {
            const barW = pw - 16, barH = 10;
            const barY = yy + 14 - barH / 2;
            ct.add(this.txt(8, yy, 'Cleanliness', 5, '#CCCCCC').setOrigin(0, 0.5));
            yy += 14;
            const barBg = this.add.graphics();
            barBg.fillStyle(0x333333, 0.8);
            barBg.fillRoundedRect(8, barY, barW, barH, 3);
            ct.add(barBg);
            const barFill = this.add.graphics();
            ct.add(barFill);
            const barBorder = this.add.graphics();
            barBorder.lineStyle(1, 0x555555, 1);
            barBorder.strokeRoundedRect(8, barY, barW, barH, 3);
            ct.add(barBorder);
            const barPctTxt = this.txt(pw - 8, yy, '', 5, '#AAAAAA').setOrigin(1, 0.5);
            ct.add(barPctTxt);
            this._facilityPanelBathroom = { fac, barFill, barPctTxt, barW, barH, barY };
            this._updateBathroomMeter();
            yy += 20;
        } else {
            this._facilityPanelBathroom = null;
        }

        const moveBg = this.add.graphics();
        moveBg.fillStyle(0x335577, 0.5); moveBg.fillRoundedRect(6, yy, pw - 12, 24, 3);
        ct.add(moveBg);
        const moveBtn = this.txt(pw / 2, yy + 12, 'Move Facility', 5, '#88BBDD').setOrigin(0.5).setInteractive({ useHandCursor: true });
        moveBtn.on('pointerdown', () => { this.gs.enterFacilityMoveMode(fac); });
        moveBtn.on('pointerover', () => moveBtn.setColor('#AADDFF'));
        moveBtn.on('pointerout', () => moveBtn.setColor('#88BBDD'));
        ct.add(moveBtn);
        yy += 30;

        if (fac.type === 'bathroom') {
            const dirty = fac.dirty || 0;
            const cleanBg = this.add.graphics();
            cleanBg.fillStyle(dirty > 0 ? 0x448844 : 0x444444, 0.5);
            cleanBg.fillRoundedRect(6, yy, pw - 12, 24, 3);
            ct.add(cleanBg);
            const cleanBtn = this.txt(pw / 2, yy + 12, dirty > 0 ? 'Clean' : 'Spotless', 5, dirty > 0 ? '#88DD88' : '#888888').setOrigin(0.5);
            if (dirty > 0) {
                cleanBtn.setInteractive({ useHandCursor: true });
                cleanBtn.on('pointerdown', () => { this.gs.cleanBathroom(fac); this.showFacilityBackBar(fac); });
                cleanBtn.on('pointerover', () => cleanBtn.setColor('#AAFFAA'));
                cleanBtn.on('pointerout', () => cleanBtn.setColor('#88DD88'));
            }
            ct.add(cleanBtn);
            if (this._facilityPanelBathroom) {
                this._facilityPanelBathroom.cleanBg = cleanBg;
                this._facilityPanelBathroom.cleanBtn = cleanBtn;
                this._facilityPanelBathroom.cleanY = yy;
                this._facilityPanelBathroom.cleanW = pw - 12;
            }
            yy += 30;
        }

        const destroyBg = this.add.graphics();
        destroyBg.fillStyle(0x773333, 0.5);
        destroyBg.fillRoundedRect(6, yy, pw - 12, 24, 3);
        ct.add(destroyBg);
        const destroyBtn = this.txt(pw / 2, yy + 12, 'Destroy', 5, '#DD6666').setOrigin(0.5).setInteractive({ useHandCursor: true });
        destroyBtn.on('pointerdown', () => { this.gs.destroyFacility(fac.id); });
        destroyBtn.on('pointerover', () => destroyBtn.setColor('#FF8888'));
        destroyBtn.on('pointerout', () => destroyBtn.setColor('#DD6666'));
        ct.add(destroyBtn);
        yy += 30;

        const ph = yy + 8;
        const bg = this.add.graphics();
        bg.fillStyle(CLR.uiPanelBg, 0.94); bg.fillRoundedRect(0, 0, pw, ph, 6);
        bg.lineStyle(2, ft.stroke); bg.strokeRoundedRect(0, 0, pw, ph, 6);
        ct.addAt(bg, 0);

        const closeBtn = this.txt(pw - 8, 6, 'X', 8, '#CC4444').setOrigin(1, 0).setInteractive({ useHandCursor: true });
        closeBtn.on('pointerdown', () => { if (!this.gs.state.rescuePaused) this.gs.zoomOut(); });
        closeBtn.on('pointerover', () => closeBtn.setColor('#FF6666'));
        closeBtn.on('pointerout', () => closeBtn.setColor('#CC4444'));
        ct.add(closeBtn);

        this.facilityPanel = ct;
        this._facilityPanelBounds = { x: px, y: py, w: pw, h: ph };

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
        bbBtn.on('pointerdown', () => { if (!this.gs.state.rescuePaused) this.gs.zoomOut(); });
        bbBtn.on('pointerover', () => { bbBtn.setColor('#FFEECC'); bbBg.clear(); bbBg.fillStyle(0x886633, 0.85); bbBg.fillRoundedRect(bbX, bbY, bbW, bbH, 6); bbBg.lineStyle(2, 0xCCBB77); bbBg.strokeRoundedRect(bbX, bbY, bbW, bbH, 6); });
        bbBtn.on('pointerout', () => { bbBtn.setColor('#FFCC88'); bbBg.clear(); bbBg.fillStyle(0x664422, 0.75); bbBg.fillRoundedRect(bbX, bbY, bbW, bbH, 6); bbBg.lineStyle(2, 0xAA8855); bbBg.strokeRoundedRect(bbX, bbY, bbW, bbH, 6); });

        this._backBarElements = [backBar, bbBg, bbBtn];
    }

    showSelectBar(labelText) {
        this.destroySelectBar();
        this.hideToolbar();

        const barY = H - 62;
        const bar = this.add.graphics().setDepth(250);
        bar.fillStyle(CLR.uiBg, 0.9); bar.fillRect(0, barY, W, 62);
        bar.lineStyle(1, CLR.uiBorder); bar.lineBetween(0, barY, W, barY);

        const label = this.txt(W / 2, barY + 31, labelText, 8, '#FFFFFF').setOrigin(0.5).setDepth(250);

        this._selectBarElements = [bar, label];
    }

    hideSelectBar() {
        this.destroySelectBar();
        this.showToolbar();
    }

    destroySelectBar() {
        if (this._selectBarElements) {
            this._selectBarElements.forEach(e => e.destroy());
            this._selectBarElements = null;
        }
    }

    showBuildHint() {
        this.hideToolbar();
        if (this._buildHintBar) this._buildHintBar.setVisible(true);
        if (this._buildHintLabel) {
            this._buildHintLabel.setVisible(true);
            this._buildHintLabel.setText('Left Click to Place • Right Click to Exit');
        }
    }

    hideBuildHint() {
        if (this._buildHintBar) this._buildHintBar.setVisible(false);
        if (this._buildHintLabel) this._buildHintLabel.setVisible(false);
        if (!this.gs.state.viewingHabitat && !this.gs.state.viewingFacility) {
            this.showToolbar();
        }
    }

    /* ========== UPGRADES PANEL ========== */

    // Lists upgrades with buy buttons. Vertically centered between top and bottom bars.
    showUpgradePanel() {
        if (this.upgradePanel) this.upgradePanel.destroy();
        const pw = 380, entries = Object.values(UPGRADES);
        const ph = 42 + entries.length * 44 + 8;
        const px = W / 2 - pw / 2, py = this.centerPanelY(ph);
        const ct = this.add.container(px, py).setDepth(280);
        const bg = this.add.graphics();
        bg.fillStyle(CLR.uiPanelBg, 0.96); bg.fillRoundedRect(0, 0, pw, ph, 8);
        bg.lineStyle(2, 0xCCAA33); bg.strokeRoundedRect(0, 0, pw, ph, 8);
        ct.add(bg);
        ct.add(this.txt(pw / 2, 14, 'UPGRADES', 12, CLR.gold).setOrigin(0.5));
        const closeBtn = this.txt(pw - 10, 6, 'X', 8, '#FF6666').setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
        closeBtn.on('pointerdown', () => { ct.destroy(); this.upgradePanel = null; this._activePanel = null; this._refreshToolBtns(); });
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

    // Hire/fire staff members. Vertically centered between top and bottom bars.
    showStaffPanel() {
        if (this.staffPanel) this.staffPanel.destroy();
        const pw = 380, currentStaff = this.gs.state.staff;
        const hireRows = Object.keys(STAFF_TYPES).length;
        const ph = 66 + hireRows * 38 + (currentStaff.length > 0 ? 34 + currentStaff.length * 32 : 0) + 16;
        const px = W / 2 - pw / 2, py = this.centerPanelY(ph);
        const ct = this.add.container(px, py).setDepth(280);
        const bg = this.add.graphics();
        bg.fillStyle(CLR.uiPanelBg, 0.96); bg.fillRoundedRect(0, 0, pw, ph, 8);
        bg.lineStyle(2, 0x5588BB); bg.strokeRoundedRect(0, 0, pw, ph, 8);
        ct.add(bg);
        ct.add(this.txt(pw / 2, 14, 'STAFF', 12, CLR.gold).setOrigin(0.5));
        const closeBtn = this.txt(pw - 10, 6, 'X', 8, '#FF6666').setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
        closeBtn.on('pointerdown', () => { ct.destroy(); this.staffPanel = null; this._activePanel = null; this._refreshToolBtns(); });
        ct.add(closeBtn);
        ct.add(this.txt(10, 38, 'HIRE:', 7, '#AAAAAA'));
        let yy = 54;
        Object.values(STAFF_TYPES).forEach(st => {
            const currentCount = this.gs.state.staff.filter(s => s.type === st.id).length;
            const atMax = st.maxCount && currentCount >= st.maxCount;
            const canAfford = this.gs.state.coins >= st.hireCost && !atMax;
            const rowBg = this.add.graphics();
            rowBg.fillStyle(0x332211, 0.5); rowBg.fillRoundedRect(8, yy, pw - 16, 34, 3);
            ct.add(rowBg);
            ct.add(this.txt(14, yy + 4, st.name, 7));
            const salaryTxt = st.salary === 0 ? 'FREE' : `${st.salary}g/day`;
            const limitTxt = st.maxCount ? ` (${currentCount}/${st.maxCount})` : '';
            ct.add(this.txt(14, yy + 20, `${st.desc} | ${salaryTxt}${limitTxt}`, 5, '#AAAAAA'));
            const costLabel = st.hireCost === 0 ? 'FREE' : `${st.hireCost}g`;
            ct.add(this.txt(pw - 60, yy + 4, costLabel, 7, atMax ? '#666666' : canAfford ? CLR.gold : '#884444').setOrigin(1, 0));
            if (atMax) {
                ct.add(this.txt(pw - 14, yy + 10, 'MAX', 6, '#666666').setOrigin(1, 0));
            } else if (canAfford) {
                const hireBtn = this.txt(pw - 14, yy + 10, 'HIRE', 6, '#44CC44').setOrigin(1, 0).setInteractive({ useHandCursor: true });
                hireBtn.on('pointerdown', () => {
                    if (st.id === 'guide') {
                        ct.destroy(); this.staffPanel = null; this._activePanel = null;
                        this.gs.hireStaff('guide');
                    } else {
                        this.gs.hireStaff(st.id); this.showStaffPanel();
                    }
                });
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

    // Launch rescue missions, view progress bars. Vertically centered between top and bottom bars.
    showMissionPanel() {
        if (this.missionPanel) this.missionPanel.destroy();
        const pw = 420, missions = Object.values(MISSIONS);
        const active = this.gs.state.activeMissions;
        const ph = 56 + missions.length * 50 + (active.length > 0 ? 24 + active.length * 28 : 0) + 16;
        const px = W / 2 - pw / 2, py = this.centerPanelY(ph);
        const ct = this.add.container(px, py).setDepth(280);
        const bg = this.add.graphics();
        bg.fillStyle(CLR.uiPanelBg, 0.96); bg.fillRoundedRect(0, 0, pw, ph, 8);
        bg.lineStyle(2, 0x66AA66); bg.strokeRoundedRect(0, 0, pw, ph, 8);
        ct.add(bg);
        ct.add(this.txt(pw / 2, 14, 'RESCUE MISSIONS', 11, CLR.gold).setOrigin(0.5));
        const closeBtn = this.txt(pw - 10, 6, 'X', 8, '#FF6666').setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
        closeBtn.on('pointerdown', () => { ct.destroy(); this.missionPanel = null; this._activePanel = null; this._refreshToolBtns(); });
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

    // Tabbed UI: one branch at a time, 4 tiers per branch, unlock buttons. Vertically centered.
    showResearchPanel() {
        if (this.researchPanel) this.researchPanel.destroy();
        if (!this._researchTab) this._researchTab = 'wildlife';

        const branches = Object.keys(RESEARCH_BRANCHES);
        const pw = 560, ph = 430;
        const px = W / 2 - pw / 2, py = this.centerPanelY(ph);
        const ct = this.add.container(px, py).setDepth(290);
        const bg = this.add.graphics();
        bg.fillStyle(CLR.uiPanelBg, 0.97); bg.fillRoundedRect(0, 0, pw, ph, 8);
        bg.lineStyle(2, 0x44DDAA); bg.strokeRoundedRect(0, 0, pw, ph, 8);
        ct.add(bg);

        ct.add(this.txt(pw / 2, 12, 'RESEARCH', 12, CLR.gold).setOrigin(0.5));
        ct.add(this.txt(pw / 2, 30, `Research Points: ${this.gs.state.researchPoints}`, 7, '#44DDAA').setOrigin(0.5));

        const closeBtn = this.txt(pw - 10, 6, 'X', 8, '#FF6666').setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
        closeBtn.on('pointerdown', () => { ct.destroy(); this.researchPanel = null; this._activePanel = null; this._refreshToolBtns(); });
        ct.add(closeBtn);

        const tabW = 126;
        const tabGap = 6;
        const tabStartX = pw / 2 - (branches.length * (tabW + tabGap)) / 2;
        branches.forEach((bId, i) => {
            const branch = RESEARCH_BRANCHES[bId];
            const bClr = '#' + branch.color.toString(16).padStart(6, '0');
            const tx = tabStartX + i * (tabW + tabGap), ty = 46;
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

    // Tabbed: Bestiary, Achievements, Stats. Vertically centered between top and bottom bars.
    showJournalPanel() {
        if (this.journalPanel) this.journalPanel.destroy();

        const pw = 580, ph = 460;
        const px = W / 2 - pw / 2, py = this.centerPanelY(ph);
        const ct = this.add.container(px, py).setDepth(290);
        const bg = this.add.graphics();
        bg.fillStyle(CLR.uiPanelBg, 0.97); bg.fillRoundedRect(0, 0, pw, ph, 8);
        bg.lineStyle(2, 0xAA77CC); bg.strokeRoundedRect(0, 0, pw, ph, 8);
        ct.add(bg);

        ct.add(this.txt(pw / 2, 12, 'JOURNAL', 12, CLR.gold).setOrigin(0.5));
        const closeBtn = this.txt(pw - 10, 6, 'X', 8, '#FF6666').setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
        closeBtn.on('pointerdown', () => { ct.destroy(); this.journalPanel = null; this._activePanel = null; this._refreshToolBtns(); });
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

    // Two-level bestiary: top-level species grid, clickable to open variant sub-page.
    renderBestiary(ct, x, y, w, h) {
        if (this._bestiarySpecies) {
            this.renderBestiaryVariants(ct, x, y, w, h, this._bestiarySpecies);
            return;
        }
        const speciesList = Object.values(SPECIES);
        const cols = 5, cellW = w / cols, cellH = 72;
        const discovered = this.gs.state.discoveries;

        speciesList.forEach((sp, i) => {
            const col = i % cols, row = Math.floor(i / cols);
            const cx = x + col * cellW + cellW / 2;
            const cy = y + row * cellH + 30;
            const isFound = discovered.has(sp.id);

            if (isFound) {
                const img = this.add.image(cx, cy, `animal_${sp.id}`).setScale(0.8)
                    .setInteractive({ useHandCursor: true });
                img.on('pointerdown', () => { this._bestiarySpecies = sp.id; this.showJournalPanel(); });
                ct.add(img);
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

    // Variant sub-page: shows all variants for a species with seen/rescued/unknown states.
    // Breed-only variants are marked with a star and show a "Breed Only" hint when undiscovered.
    renderBestiaryVariants(ct, x, y, w, h, speciesId) {
        const sp = SPECIES[speciesId];
        const seen = this.gs.state.seenVariants;
        const rescued = this.gs.state.rescuedVariants;

        const backBtn = this.txt(x + 4, y + 2, '\u2190 Back', 7, '#AAAAAA')
            .setInteractive({ useHandCursor: true });
        backBtn.on('pointerover', () => backBtn.setColor('#FFFFFF'));
        backBtn.on('pointerout', () => backBtn.setColor('#AAAAAA'));
        backBtn.on('pointerdown', () => { this._bestiarySpecies = null; this.showJournalPanel(); });
        ct.add(backBtn);

        const rClr = '#' + RARITY_COLOR[sp.rarity].toString(16).padStart(6, '0');
        ct.add(this.txt(w / 2 + x, y + 4, sp.name, 10, rClr).setOrigin(0.5, 0));

        const normalVars = sp.variants.filter(v => !v.breedOnly);
        const breedVars = sp.variants.map((v, i) => v.breedOnly ? i : -1).filter(i => i >= 0);
        const cols = 4, cellW = w / cols, cellH = 80;
        const startY = y + 28;

        // Render normal variants first
        normalVars.forEach((v, ni) => {
            const i = sp.variants.indexOf(v);
            const col = ni % cols, row = Math.floor(ni / cols);
            const cx = x + col * cellW + cellW / 2;
            const cy = startY + row * cellH + 30;
            const key = `${speciesId}_${i}`;
            const isRescued = rescued.has(key);
            const isSeen = seen.has(key);

            if (isRescued) {
                ct.add(this.add.image(cx, cy, `animal_${speciesId}_${i}`).setScale(0.9));
                ct.add(this.txt(cx, cy + 20, v.name, 5).setOrigin(0.5));
                const gClr = v.gender === 'm' ? '#5599FF' : '#FF66AA';
                ct.add(this.txt(cx, cy + 30, v.gender === 'm' ? '\u2642' : '\u2640', 6, gClr).setOrigin(0.5));
            } else if (isSeen) {
                ct.add(this.add.image(cx, cy, `animal_${speciesId}_${i}`).setScale(0.9).setAlpha(0.5));
                ct.add(this.txt(cx, cy + 20, '???', 5, '#888888').setOrigin(0.5));
            } else {
                const shadow = this.add.graphics();
                shadow.fillStyle(0x222222, 0.8); shadow.fillCircle(cx, cy, 12);
                ct.add(shadow);
                ct.add(this.txt(cx, cy + 20, '???', 5, '#555555').setOrigin(0.5));
            }
        });

        // Breed-only section header
        const normalRows = Math.ceil(normalVars.length / cols);
        const breedStartY = startY + normalRows * cellH + 15;
        ct.add(this.txt(x + 4, breedStartY - 10, '\u2605 Breed-Only Variants', 6, '#DDAA44'));

        breedVars.forEach((i, bi) => {
            const v = sp.variants[i];
            const col = bi % cols, row = Math.floor(bi / cols);
            const cx = x + col * cellW + cellW / 2;
            const cy = breedStartY + row * cellH + 30;
            const key = `${speciesId}_${i}`;
            const isRescued = rescued.has(key);

            if (isRescued) {
                ct.add(this.add.image(cx, cy, `animal_${speciesId}_${i}`).setScale(0.9));
                ct.add(this.txt(cx, cy - 18, '\u2605', 5, '#DDAA44').setOrigin(0.5));
                ct.add(this.txt(cx, cy + 20, v.name, 5).setOrigin(0.5));
                const gClr = v.gender === 'm' ? '#5599FF' : '#FF66AA';
                ct.add(this.txt(cx, cy + 30, v.gender === 'm' ? '\u2642' : '\u2640', 6, gClr).setOrigin(0.5));
                // Show parent combo hint
                const pNames = v.parents.map(pi => sp.variants[pi].name);
                ct.add(this.txt(cx, cy + 39, `${pNames[0]} + ${pNames[1]}`, 4, '#887744').setOrigin(0.5));
            } else {
                const shadow = this.add.graphics();
                shadow.fillStyle(0x332200, 0.6); shadow.fillCircle(cx, cy, 12);
                ct.add(shadow);
                ct.add(this.txt(cx, cy - 18, '\u2605', 5, '#665522').setOrigin(0.5));
                ct.add(this.txt(cx, cy + 20, '???', 5, '#665522').setOrigin(0.5));
                ct.add(this.txt(cx, cy + 30, 'Breed Only', 4, '#554411').setOrigin(0.5));
            }
        });

        const total = sp.variants.length;
        const found = sp.variants.filter((_, i) => rescued.has(`${speciesId}_${i}`)).length;
        const breedRows = Math.ceil(breedVars.length / cols);
        ct.add(this.txt(x, breedStartY + breedRows * cellH + 10,
            `Collected: ${found}/${total}`, 6, '#AAAAAA'));
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
    togglePanel(panelKey, showFn, btnKey) {
        if (this[panelKey]) {
            this[panelKey].destroy(); this[panelKey] = null;
            this._activePanel = null;
            this._refreshToolBtns();
            return;
        }
        this.closeAllPanels();
        this._activePanel = btnKey || null;
        showFn();
        this._refreshToolBtns();
    }

    reopenPanel(btnKey) {
        const map = {
            upgrades: () => this.togglePanel('upgradePanel', () => this.showUpgradePanel(), 'upgrades'),
            staff:    () => this.togglePanel('staffPanel',    () => this.showStaffPanel(),    'staff'),
            missions: () => this.togglePanel('missionPanel',  () => this.showMissionPanel(),  'missions'),
            research: () => this.togglePanel('researchPanel', () => this.showResearchPanel(), 'research'),
            journal:  () => this.togglePanel('journalPanel',  () => this.showJournalPanel(),  'journal'),
        };
        if (map[btnKey]) map[btnKey]();
    }

    // Launches the transition to the meta-world (room scene).
    // First time: full zoom-out animation via TransitionScene.
    // Subsequent times: quick switch with put-away phone animation.
    triggerPhoneTransition() {
        this.closeAllPanels(true);
        if (this.gs.state.buildMode) this.gs.exitBuild();

        if (!this.game._hasZoomedOut) {
            // First time — cinematic zoom-out
            this.game._hasZoomedOut = true;
            this.scene.launch('TransitionScene');
            this.scene.bringToTop('TransitionScene');
        } else {
            // Subsequent times — quick switch
            this.scene.sleep('GameScene');
            this.scene.sleep('HUDScene');

            const metaScene = this.scene.get('MetaWorldScene');
            if (metaScene && this.scene.isSleeping('MetaWorldScene')) {
                // Scene exists and is sleeping — wake it and trigger put-away
                this.scene.wake('MetaWorldScene');
                this.scene.wake('MetaHUDScene');
                this.scene.bringToTop('MetaHUDScene');
                metaScene._startWithPhone = true;
                metaScene._frozen = true;
                metaScene.char.setTexture('char_phone');
                metaScene.time.delayedCall(100, () => metaScene.playPutAwayPhone());
            } else {
                // Scene was stopped or never launched — full launch with put-away
                this.scene.launch('MetaWorldScene', { startWithPhone: true });
                this.scene.launch('MetaHUDScene');
                // Trigger put-away after scene has initialized
                this.time.delayedCall(150, () => {
                    const ms = this.scene.get('MetaWorldScene');
                    if (ms && ms.playPutAwayPhone) ms.playPutAwayPhone();
                });
            }
        }
    }

    // Returns a y position that vertically centers a panel of given height between the top and bottom bars.
    centerPanelY(ph) { return Math.max(46, 42 + (H - 104 - ph) / 2); }

    // True if any management panel (upgrades, staff, missions, research, journal), build popup, or settings menu is open.
    hasOpenPanel() { return !!(this.upgradePanel || this.staffPanel || this.missionPanel || this.journalPanel || this.researchPanel || this.settingsPanel || this.buildPopup); }

    isPointerOverPanel(screenX, screenY) {
        const barY = H - 62;
        if (screenY >= barY) return true;
        if (this._buildPopupBounds && screenX >= this._buildPopupBounds.x && screenX <= this._buildPopupBounds.x + this._buildPopupBounds.w && screenY >= this._buildPopupBounds.y && screenY <= this._buildPopupBounds.y + this._buildPopupBounds.h) return true;
        const checks = [
            this.animalPanel && this._animalPanelBounds,
            this.habitatPanel && this._habitatPanelBounds,
            this.facilityPanel && this._facilityPanelBounds,
        ];
        for (const b of checks) {
            if (b && screenX >= b.x && screenX <= b.x + b.w && screenY >= b.y && screenY <= b.y + b.h) return true;
        }
        return false;
    }

    // Destroys all open panels and mission refresh timer. keepZoom=true preserves the
    // camera zoom and back bar (used by rescue events so they don't interrupt the zoomed view).
    closeAllPanels(keepZoom = false) {
        if (!keepZoom && (this.gs.state.viewingHabitat || this.gs.state.viewingFacility)) { this.gs.zoomOut(); this.showToolbar(); }
        ['animalPanel', 'upgradePanel', 'staffPanel', 'missionPanel', 'journalPanel', 'habitatPanel', 'researchPanel', 'facilityPanel'].forEach(k => {
            if (this[k]) { this[k].destroy(); this[k] = null; }
        });
        this._facilityPanelBathroom = null;
        if (!keepZoom) this.destroyBackBar();
        this.closeBuildPopup();
        if (this._missionRefresh) { this._missionRefresh.destroy(); this._missionRefresh = null; }
        this._activePanel = null;
        this._refreshToolBtns();
    }

    _refreshToolBtns() {
        if (!this.toolBtns) return;
        this.toolBtns.forEach(b => {
            const isActive = b.key === this.activeBuild ||
                (b.key === 'build' && this.activeBuild && (HABITATS[this.activeBuild] || this.activeBuild?.startsWith('decor_') || this.activeBuild?.startsWith('facility_'))) ||
                b.key === this._activePanel;
            this.drawToolBtn(b.bg, b.x, b.y, b.color, isActive, b.gap);
        });
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
