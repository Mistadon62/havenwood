// MetaHUDScene — Minimal UI overlay for the meta-world (room scene).
// Shows controls hint, a persistent prompt to pull out the phone, and a
// settings/pause menu (ESC) with Save, Exit to Menu, and Resume.

import { W, H, CLR } from '../GameData.js';

export default class MetaHUDScene extends Phaser.Scene {
    constructor() { super('MetaHUDScene'); }

    create() {
        this.cameras.main.setRoundPixels(true);
        this.settingsPanel = null;

        // Controls hint (bottom of screen, subtle)
        this.controlsHint = this.add.text(W / 2, H - 20, 'WASD to move', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '8px',
            color: '#666677',
            stroke: '#000000',
            strokeThickness: 2,
        }).setOrigin(0.5).setAlpha(0.7);

        // Phone prompt — always visible
        this.interactPrompt = this.add.container(W / 2, H - 60).setAlpha(0.8);

        const promptBg = this.add.graphics();
        promptBg.fillStyle(0x252F40, 0.85);
        promptBg.fillRoundedRect(-100, -14, 200, 28, 6);
        promptBg.lineStyle(1, 0x3D4F6B, 0.8);
        promptBg.strokeRoundedRect(-100, -14, 200, 28, 6);
        this.interactPrompt.add(promptBg);

        const promptTxt = this.add.text(0, 0, '[E] Play Havenwood', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '9px',
            color: '#88DD88',
            stroke: '#000000',
            strokeThickness: 2,
        }).setOrigin(0.5);
        this.interactPrompt.add(promptTxt);

        // Gentle float animation
        this.tweens.add({
            targets: this.interactPrompt,
            y: H - 65,
            duration: 1200,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // ESC key
        this.input.keyboard.on('keydown-ESC', () => {
            this.toggleSettingsMenu();
        });
    }

    txt(x, y, str, size, color) {
        return this.add.text(x, y, str, {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: `${size}px`,
            color: color || CLR.uiText,
            stroke: '#000000',
            strokeThickness: 2,
        });
    }

    toggleSettingsMenu() {
        if (this.settingsPanel) { this.closeSettingsMenu(); return; }

        // Freeze the meta-world
        const metaScene = this.scene.get('MetaWorldScene');
        if (metaScene) metaScene._frozen = true;

        const pw = 260, ph = 260;
        const px = W / 2 - pw / 2, py = Math.max(46, (H - ph) / 2);
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
            const gs = this.scene.get('GameScene');
            if (gs) {
                gs._saveMode = 'meta';
                gs.saveGame();
                gs._saveMode = null;
            }
            this.showNotification('Game saved!');
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
            const gs = this.scene.get('GameScene');
            if (gs) {
                gs._saveMode = 'meta';
                gs.saveGame();
                gs._saveMode = null;
            }
            this.closeSettingsMenu();
            this.scene.stop('MetaHUDScene');
            this.scene.stop('MetaWorldScene');
            this.scene.stop('HUDScene');
            this.scene.get('GameScene').scene.start('MenuScene');
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

        // Auto-Save checkbox
        const gs = this.scene.get('GameScene');
        const checkSize = 16;
        const checkX = bx, checkY = 210;
        const checkBg = this.add.graphics();
        const drawCheck = () => {
            checkBg.clear();
            checkBg.lineStyle(2, 0xAA8855); checkBg.strokeRect(checkX, checkY, checkSize, checkSize);
            if (gs && gs.state.autoSave) {
                checkBg.fillStyle(0x44DD44, 0.9); checkBg.fillRect(checkX + 3, checkY + 3, checkSize - 6, checkSize - 6);
            }
        };
        drawCheck();
        ct.add(checkBg);
        const checkHit = this.add.rectangle(checkX + checkSize / 2, checkY + checkSize / 2, checkSize, checkSize, 0, 0).setInteractive({ useHandCursor: true });
        ct.add(checkHit);
        checkHit.on('pointerdown', () => { if (gs) gs.state.autoSave = !gs.state.autoSave; drawCheck(); });
        ct.add(this.txt(checkX + checkSize + 10, checkY + checkSize / 2, 'Auto-Save', 8, '#CCBBAA').setOrigin(0, 0.5));

        this.settingsPanel = ct;
    }

    closeSettingsMenu() {
        if (this.settingsPanel) { this.settingsPanel.destroy(); this.settingsPanel = null; }
        // Unfreeze the meta-world (only if not in a phone animation)
        const metaScene = this.scene.get('MetaWorldScene');
        if (metaScene && !metaScene._startWithPhone) metaScene._frozen = false;
    }

    showNotification(text) {
        const n = this.add.text(W / 2, 50, text, {
            fontFamily: '"Press Start 2P", monospace', fontSize: '9px', color: CLR.uiText,
            stroke: '#000000', strokeThickness: 2,
            backgroundColor: '#1A2438DD', padding: { x: 10, y: 8 }
        }).setOrigin(0.5).setAlpha(0).setDepth(200);

        this.tweens.add({ targets: n, alpha: 1, y: 42, duration: 300 });
        this.tweens.add({
            targets: n, alpha: 0, y: 30,
            delay: 2000, duration: 400,
            onComplete: () => n.destroy()
        });
    }
}
