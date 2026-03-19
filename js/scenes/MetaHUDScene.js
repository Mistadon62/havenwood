// MetaHUDScene — UI overlay for the meta-world.
// Top bar (42px, fully opaque) shows day/time, energy, mood, money, knowledge, quests,
// weather, inventory count, and location name — matches sanctuary HUD height.
// Bottom bar (62px, fully opaque) contains the [E] Play Havenwood prompt and controls hint.
// Also manages settings/pause menu (ESC), quest log (Q/Tab), inventory (I), phone
// notifications (N), and queued toast notifications (displayed one at a time).

import { W, H, CLR } from '../GameData.js';
import MetaState from '../MetaStateManager.js';
import MetaDialogue from '../MetaDialogue.js';
import MetaQuests from '../MetaQuests.js';
import { getNPC, getGiftItemInfo } from '../MetaNPCs.js';

export default class MetaHUDScene extends Phaser.Scene {
    constructor() { super('MetaHUDScene'); }

    create() {
        this.cameras.main.setRoundPixels(true);
        this.settingsPanel = null;
        this.questPanel = null;
        this.inventoryPanel = null;
        this.notifPanel = null;

        this.createStatusBar();
        this.createBottomBar();

        // ESC key
        this.input.keyboard.on('keydown-ESC', () => {
            if (MetaDialogue.isActive()) {
                MetaDialogue.close(this);
                return;
            }
            if (this.notifPanel) {
                this.closeNotifications();
                return;
            }
            if (this.inventoryPanel) {
                this.closeInventory();
                return;
            }
            if (this.questPanel) {
                this.closeQuestLog();
                return;
            }
            this.toggleSettingsMenu();
        });

        // Q / Tab key for quest log (handled here since MetaWorldScene is frozen when panel is open)
        this.input.keyboard.on('keydown-Q', () => {
            if (MetaDialogue.isActive() || this.settingsPanel || this.inventoryPanel || this.notifPanel) return;
            this.toggleQuestLog();
        });
        this.input.keyboard.on('keydown-TAB', (e) => {
            e.preventDefault();
            if (MetaDialogue.isActive() || this.settingsPanel || this.inventoryPanel || this.notifPanel) return;
            this.toggleQuestLog();
        });

        // I key for inventory
        this.input.keyboard.on('keydown-I', () => {
            if (MetaDialogue.isActive() || this.settingsPanel || this.questPanel || this.notifPanel) return;
            this.toggleInventory();
        });

        // N key for phone notifications
        this.input.keyboard.on('keydown-N', () => {
            if (MetaDialogue.isActive() || this.settingsPanel || this.questPanel || this.inventoryPanel) return;
            this.toggleNotifications();
        });

        // Listen for time updates
        this.game.events.on('metaTimeUpdate', this.refreshStatusBar, this);

        this.events.once('shutdown', () => {
            this.game.events.off('metaTimeUpdate', this.refreshStatusBar, this);
        });
    }

    // ── Status Bar ──

    createStatusBar() {
        // Dark bar at top — match sanctuary HUD height (42px)
        const barH = 42;
        const midY = 21;
        this.statusBg = this.add.graphics().setDepth(200);
        this.statusBg.fillStyle(0x0D1520, 1);
        this.statusBg.fillRect(0, 0, W, barH);
        this.statusBg.lineStyle(1, 0x2A3A52, 0.6);
        this.statusBg.lineBetween(0, barH, W, barH);

        // Day & Time
        this.dayTimeText = this.txt(12, midY, '', 10, '#CCDDEE').setOrigin(0, 0.5).setDepth(201);

        // Energy bar
        this.energyLabel = this.txt(270, midY, 'EN', 8, '#88CC88').setOrigin(0, 0.5).setDepth(201);
        this.energyBarBg = this.add.rectangle(304, midY, 60, 10, 0x333344).setOrigin(0, 0.5).setDepth(201);
        this.energyBarFill = this.add.rectangle(304, midY, 60, 10, 0x44CC44).setOrigin(0, 0.5).setDepth(201);

        // Mood
        this.moodText = this.txt(382, midY, '', 9, '#DDBB88').setOrigin(0, 0.5).setDepth(201);

        // Money
        this.moneyText = this.txt(460, midY, '', 9, '#AADDAA').setOrigin(0, 0.5).setDepth(201);

        // Knowledge
        this.knowledgeText = this.txt(540, midY, '', 9, '#AABBDD').setOrigin(0, 0.5).setDepth(201);

        // Quest count
        this.questText = this.txt(640, midY, '', 8, '#BBAA88').setOrigin(0, 0.5).setDepth(201);

        // Weather icon
        this.weatherText = this.txt(710, midY, '', 8, '#AABBCC').setOrigin(0, 0.5).setDepth(201);

        // Inventory count
        this.invText = this.txt(780, midY, '', 8, '#AABB88').setOrigin(0, 0.5).setDepth(201);

        // Event indicator
        this.eventText = this.txt(840, midY, '', 8, '#FFDD66').setOrigin(0, 0.5).setDepth(201);

        // Phone notification badge
        this.phoneBadge = this.txt(920, midY, '', 8, '#FF8866').setOrigin(0, 0.5).setDepth(201);

        // Location name (right side)
        this.locationText = this.txt(W - 10, midY, '', 8, '#667788').setOrigin(1, 0.5).setDepth(201);

        this.refreshStatusBar();
    }

    refreshStatusBar() {
        const s = MetaState.state;
        const weekendTag = s.dayOfWeek >= 5 ? ' *' : '';
        this.dayTimeText.setText(`Day ${s.day} ${MetaState.getDayName()}${weekendTag} ${MetaState.getTimeString()}`);

        // Time-of-day text color
        const hour = Math.floor(s.timeOfDay / 60);
        if (hour >= 6 && hour < 8) this.dayTimeText.setColor('#FFCC88');
        else if (hour >= 8 && hour < 17) this.dayTimeText.setColor('#CCDDEE');
        else if (hour >= 17 && hour < 20) this.dayTimeText.setColor('#FFAA66');
        else this.dayTimeText.setColor('#8899BB');

        // Energy bar
        const energyPct = Math.max(0, s.energy / 100);
        this.energyBarFill.width = 60 * energyPct;
        if (s.energy > 50) this.energyBarFill.fillColor = 0x44CC44;
        else if (s.energy > 25) this.energyBarFill.fillColor = 0xCCAA44;
        else this.energyBarFill.fillColor = 0xCC4444;

        // Mood emoji
        let moodIcon = ':)';
        if (s.mood >= 80) moodIcon = ':D';
        else if (s.mood >= 60) moodIcon = ':)';
        else if (s.mood >= 40) moodIcon = ':|';
        else if (s.mood >= 20) moodIcon = ':(';
        else moodIcon = 'D:';
        this.moodText.setText(`${moodIcon} ${s.mood}`);

        this.moneyText.setText(`$${s.money}`);
        this.knowledgeText.setText(`KN ${s.knowledge}`);

        // Active quest count
        const activeQuests = MetaQuests.getActiveQuestsDisplay();
        if (activeQuests.length > 0) {
            this.questText.setText(`Q:${activeQuests.length}`);
        } else {
            this.questText.setText('');
        }

        // Weather
        const weatherIcons = { sunny: 'Sun', cloudy: 'Cld', rainy: 'Rain', snowy: 'Snow' };
        const weatherColors = { sunny: '#FFDD66', cloudy: '#AABBCC', rainy: '#6699CC', snowy: '#DDEEFF' };
        this.weatherText.setText(weatherIcons[s.weather] || '');
        this.weatherText.setColor(weatherColors[s.weather] || '#AABBCC');

        // Inventory count
        if (s.inventory.length > 0) {
            this.invText.setText(`Inv:${s.inventory.length}/8`);
        } else {
            this.invText.setText('');
        }

        // Event indicator
        const evt = s.currentEvent;
        if (evt && evt.name) {
            this.eventText.setText(`EVT:${evt.name}`);
        } else {
            this.eventText.setText('');
        }

        // Phone notification badge
        const notifCount = (s.phoneNotifications || []).length;
        if (notifCount > 0) {
            this.phoneBadge.setText(`!${notifCount}`);
        } else {
            this.phoneBadge.setText('');
        }

        // Late-night warning
        if (s.timeOfDay >= 1380) {
            this.dayTimeText.setColor('#FF4444');
        } else if (s.timeOfDay >= 1320) {
            this.dayTimeText.setColor('#FF8866');
        }

        // Location
        const metaScene = this.scene.get('MetaWorldScene');
        if (metaScene && metaScene.location) {
            this.locationText.setText(metaScene.location.name);
        }
    }

    // ── Interact Prompt ──

    createBottomBar() {
        const barY = H - 62;
        this.bottomBarBg = this.add.graphics().setDepth(200);
        this.bottomBarBg.fillStyle(0x0D1520, 1);
        this.bottomBarBg.fillRect(0, barY, W, 62);
        this.bottomBarBg.lineStyle(1, 0x2A3A52, 0.6);
        this.bottomBarBg.lineBetween(0, barY, W, barY);

        const midY = barY + 22;

        // Interact prompt
        this.promptText = this.txt(W / 2, midY, '[E] Play Havenwood', 10, '#88DD88')
            .setOrigin(0.5).setDepth(201);

        // Controls hint
        this.controlsHint = this.txt(W / 2, midY + 20, 'WASD move | Q quests | I inventory | N notifs', 8, '#556677')
            .setOrigin(0.5).setDepth(201);
    }

    // Update the prompt text based on what the player is facing
    updatePrompt(text) {
        if (this.promptText) this.promptText.setText(text);
    }

    // ── Settings Menu ──

    txt(x, y, str, size, color) {
        const s = Math.max(8, Math.round(size * 1.2));
        return this.add.text(x, y, str, {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: `${s}px`,
            color: color || CLR.uiText,
            stroke: '#000000',
            strokeThickness: s > 10 ? 3 : 2,
            lineSpacing: 2,
        });
    }

    toggleSettingsMenu() {
        if (this.settingsPanel) { this.closeSettingsMenu(); return; }

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

        ct.add(this.txt(pw / 2, 20, 'Settings', 13, CLR.gold).setOrigin(0.5));

        const btnW = 180, btnH = 34;
        const bx = pw / 2 - btnW / 2;

        // Save button
        const saveBg = this.add.graphics();
        saveBg.fillStyle(0x44AA44, 0.6); saveBg.fillRoundedRect(bx, 60, btnW, btnH, 5);
        ct.add(saveBg);
        const saveHit = this.add.rectangle(pw / 2, 60 + btnH / 2, btnW, btnH, 0, 0).setInteractive({ useHandCursor: true });
        ct.add(saveHit);
        ct.add(this.txt(pw / 2, 60 + btnH / 2, 'Save Game', 10, '#FFFFFF').setOrigin(0.5));
        saveHit.on('pointerover', () => { saveBg.clear(); saveBg.fillStyle(0x55CC55, 0.7); saveBg.fillRoundedRect(bx, 60, btnW, btnH, 5); });
        saveHit.on('pointerout', () => { saveBg.clear(); saveBg.fillStyle(0x44AA44, 0.6); saveBg.fillRoundedRect(bx, 60, btnW, btnH, 5); });
        saveHit.on('pointerdown', () => {
            const gs = this.scene.get('GameScene');
            if (gs) {
                gs._saveMode = 'meta';
                gs.saveGame();
                gs._saveMode = null;
            }
            MetaState.save();
            this.showNotification('Game saved!');
            this.closeSettingsMenu();
        });

        // Exit to Menu button
        const exitBg = this.add.graphics();
        exitBg.fillStyle(0xAA4444, 0.6); exitBg.fillRoundedRect(bx, 110, btnW, btnH, 5);
        ct.add(exitBg);
        const exitHit = this.add.rectangle(pw / 2, 110 + btnH / 2, btnW, btnH, 0, 0).setInteractive({ useHandCursor: true });
        ct.add(exitHit);
        ct.add(this.txt(pw / 2, 110 + btnH / 2, 'Exit to Menu', 10, '#FFFFFF').setOrigin(0.5));
        exitHit.on('pointerover', () => { exitBg.clear(); exitBg.fillStyle(0xCC5555, 0.7); exitBg.fillRoundedRect(bx, 110, btnW, btnH, 5); });
        exitHit.on('pointerout', () => { exitBg.clear(); exitBg.fillStyle(0xAA4444, 0.6); exitBg.fillRoundedRect(bx, 110, btnW, btnH, 5); });
        exitHit.on('pointerdown', () => {
            const gs = this.scene.get('GameScene');
            if (gs) {
                gs._saveMode = 'meta';
                gs.saveGame();
                gs._saveMode = null;
            }
            MetaState.save();
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
        ct.add(this.txt(pw / 2, 160 + btnH / 2, 'Resume', 10, '#FFFFFF').setOrigin(0.5));
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
        ct.add(this.txt(checkX + checkSize + 10, checkY + checkSize / 2, 'Auto-Save', 9, '#CCBBAA').setOrigin(0, 0.5));

        this.settingsPanel = ct;
    }

    closeSettingsMenu() {
        if (this.settingsPanel) { this.settingsPanel.destroy(); this.settingsPanel = null; }
        const metaScene = this.scene.get('MetaWorldScene');
        if (metaScene && !metaScene._startWithPhone) metaScene._frozen = false;
    }

    // ── Quest Log ──

    toggleQuestLog() {
        if (this.questPanel) { this.closeQuestLog(); return; }
        if (this.settingsPanel) return; // settings open, don't overlap
        if (MetaDialogue.isActive()) return;

        const metaScene = this.scene.get('MetaWorldScene');
        if (metaScene) metaScene._frozen = true;

        const pw = 380, ph = 420;
        const px = W / 2 - pw / 2, py = Math.max(36, (H - ph) / 2);
        const ct = this.add.container(px, py).setDepth(310);

        const overlay = this.add.rectangle(W / 2 - px, H / 2 - py, W, H, 0x000000, 0.45).setInteractive();
        ct.add(overlay);

        const bg = this.add.graphics();
        bg.fillStyle(CLR.uiPanelBg, 0.97); bg.fillRoundedRect(0, 0, pw, ph, 8);
        bg.lineStyle(2, CLR.uiBorder); bg.strokeRoundedRect(0, 0, pw, ph, 8);
        ct.add(bg);

        ct.add(this.txt(pw / 2, 18, 'Quest Log', 13, CLR.gold).setOrigin(0.5));
        ct.add(this.txt(pw / 2, 36, '[Q/Tab] Close', 8, '#666688').setOrigin(0.5));

        const activeQuests = MetaQuests.getActiveQuestsDisplay();
        const completedQuests = MetaQuests.getCompletedQuests();

        let yOff = 54;

        if (activeQuests.length === 0 && completedQuests.length === 0) {
            ct.add(this.txt(pw / 2, yOff + 20, 'No quests yet...', 9, '#888899').setOrigin(0.5));
            ct.add(this.txt(pw / 2, yOff + 40, 'Explore campus and talk to people!', 8, '#667788').setOrigin(0.5));
        }

        // Active quests
        for (const quest of activeQuests) {
            if (yOff > ph - 60) break;

            // Quest name with giver
            const giverTag = quest.giver ? ` (${getNPC(quest.giver)?.name || quest.giver})` : '';
            ct.add(this.txt(14, yOff, `${quest.name}${giverTag}`, 9, '#DDCC88').setOrigin(0, 0));
            yOff += 18;

            // Description (with word wrap)
            const descText = this.txt(20, yOff, quest.desc, 8, '#99AABB').setOrigin(0, 0);
            descText.setWordWrapWidth(pw - 40);
            ct.add(descText);
            yOff += descText.height + 4;

            // Steps
            for (const step of quest.steps) {
                const icon = step.done ? '[x]' : '[ ]';
                const color = step.done ? '#66AA66' : '#AABBCC';
                ct.add(this.txt(24, yOff, `${icon} ${step.label}`, 8, color).setOrigin(0, 0));
                yOff += 15;
            }

            // Reward
            ct.add(this.txt(24, yOff, `Reward: ${quest.rewardText}`, 8, '#AABB88').setOrigin(0, 0));
            yOff += 18;

            // Separator
            const sep = this.add.graphics();
            sep.lineStyle(1, 0x3D4F6B, 0.4);
            sep.lineBetween(20, yOff, pw - 20, yOff);
            ct.add(sep);
            yOff += 8;
        }

        // Completed quests
        if (completedQuests.length > 0 && yOff < ph - 40) {
            ct.add(this.txt(14, yOff, 'Completed', 9, '#668866').setOrigin(0, 0));
            yOff += 18;
            for (const quest of completedQuests) {
                if (yOff > ph - 20) break;
                ct.add(this.txt(24, yOff, `[x] ${quest.name}`, 8, '#557755').setOrigin(0, 0));
                yOff += 16;
            }
        }

        // Friendship summary at bottom
        if (yOff < ph - 50 && MetaState.state.npcsMetSet.length > 0) {
            yOff = Math.max(yOff + 10, ph - 80);
            const fsep = this.add.graphics();
            fsep.lineStyle(1, 0x3D4F6B, 0.4);
            fsep.lineBetween(20, yOff, pw - 20, yOff);
            ct.add(fsep);
            yOff += 8;
            ct.add(this.txt(14, yOff, 'Friendships', 9, '#BBAA88').setOrigin(0, 0));
            yOff += 18;
            for (const npcId of MetaState.state.npcsMetSet) {
                if (yOff > ph - 10) break;
                const npcDef = getNPC(npcId);
                const name = npcDef ? npcDef.name : npcId;
                const fp = MetaState.getFriendship(npcId);
                const tier = MetaState.getFriendshipTier(npcId);
                const tierLabels = { stranger: 'Stranger', acquaintance: 'Acquaintance', friend: 'Friend', close: 'Close Friend' };
                const tierColors = { stranger: '#888899', acquaintance: '#AABBCC', friend: '#88CCAA', close: '#FFDD88' };
                ct.add(this.txt(24, yOff, `${name}: ${fp}/100 — ${tierLabels[tier]}`, 8, tierColors[tier]).setOrigin(0, 0));
                yOff += 16;
            }
        }

        this.questPanel = ct;
    }

    closeQuestLog() {
        if (this.questPanel) { this.questPanel.destroy(); this.questPanel = null; }
        const metaScene = this.scene.get('MetaWorldScene');
        if (metaScene && !metaScene._startWithPhone) metaScene._frozen = false;
    }

    // ── Inventory Panel ──

    toggleInventory() {
        if (this.inventoryPanel) { this.closeInventory(); return; }
        if (this.settingsPanel || this.questPanel) return;
        if (MetaDialogue.isActive()) return;

        const metaScene = this.scene.get('MetaWorldScene');
        if (metaScene) metaScene._frozen = true;

        const pw = 320, ph = 280;
        const px = W / 2 - pw / 2, py = Math.max(36, (H - ph) / 2);
        const ct = this.add.container(px, py).setDepth(310);

        const overlay = this.add.rectangle(W / 2 - px, H / 2 - py, W, H, 0x000000, 0.45).setInteractive();
        ct.add(overlay);

        const bg = this.add.graphics();
        bg.fillStyle(CLR.uiPanelBg, 0.97); bg.fillRoundedRect(0, 0, pw, ph, 8);
        bg.lineStyle(2, CLR.uiBorder); bg.strokeRoundedRect(0, 0, pw, ph, 8);
        ct.add(bg);

        ct.add(this.txt(pw / 2, 18, 'Inventory', 13, CLR.gold).setOrigin(0.5));
        ct.add(this.txt(pw / 2, 36, '[I] Close', 8, '#666688').setOrigin(0.5));

        const inv = MetaState.state.inventory;
        const giftItems = getGiftItemInfo();

        if (inv.length === 0) {
            ct.add(this.txt(pw / 2, ph / 2, 'Empty', 10, '#888899').setOrigin(0.5));
            ct.add(this.txt(pw / 2, ph / 2 + 22, 'Buy items at the cafe or', 8, '#667788').setOrigin(0.5));
            ct.add(this.txt(pw / 2, ph / 2 + 38, 'pick flowers in the park!', 8, '#667788').setOrigin(0.5));
        } else {
            // Grid layout: 4 columns, 2 rows of slots
            const slotSize = 48;
            const gap = 12;
            const gridW = 4 * slotSize + 3 * gap;
            const startX = (pw - gridW) / 2;
            const startY = 56;

            // Count items by type
            const counts = {};
            for (const item of inv) {
                counts[item] = (counts[item] || 0) + 1;
            }

            let slotIdx = 0;
            for (const [itemId, count] of Object.entries(counts)) {
                const col = slotIdx % 4;
                const row = Math.floor(slotIdx / 4);
                const sx = startX + col * (slotSize + gap);
                const sy = startY + row * (slotSize + gap + 20);

                // Slot background
                const slotBg = this.add.graphics();
                slotBg.fillStyle(0x2A3444, 0.8);
                slotBg.fillRoundedRect(sx, sy, slotSize, slotSize, 4);
                slotBg.lineStyle(1, 0x3D4F6B, 0.6);
                slotBg.strokeRoundedRect(sx, sy, slotSize, slotSize, 4);
                ct.add(slotBg);

                // Item icon
                const iconKey = giftItems[itemId]?.icon;
                if (iconKey && this.textures.exists(iconKey)) {
                    const icon = this.add.image(sx + slotSize / 2, sy + slotSize / 2, iconKey).setScale(2);
                    ct.add(icon);
                }

                // Item name and count
                const name = giftItems[itemId]?.name || itemId;
                ct.add(this.txt(sx + slotSize / 2, sy + slotSize + 4, name, 7, '#CCBBAA').setOrigin(0.5, 0));
                if (count > 1) {
                    ct.add(this.txt(sx + slotSize - 4, sy + slotSize - 4, `x${count}`, 8, '#DDDD88').setOrigin(1, 1));
                }

                slotIdx++;
            }

            // Capacity
            ct.add(this.txt(pw / 2, ph - 30, `${inv.length}/8 slots used`, 8, '#778899').setOrigin(0.5));
        }

        // Hint
        ct.add(this.txt(pw / 2, ph - 14, 'Give gifts to NPCs to boost friendship!', 8, '#557766').setOrigin(0.5));

        this.inventoryPanel = ct;
    }

    closeInventory() {
        if (this.inventoryPanel) { this.inventoryPanel.destroy(); this.inventoryPanel = null; }
        const metaScene = this.scene.get('MetaWorldScene');
        if (metaScene && !metaScene._startWithPhone) metaScene._frozen = false;
    }

    // ── Phone Notifications Panel ──

    toggleNotifications() {
        if (this.notifPanel) { this.closeNotifications(); return; }
        if (this.settingsPanel || this.questPanel || this.inventoryPanel) return;
        if (MetaDialogue.isActive()) return;

        const metaScene = this.scene.get('MetaWorldScene');
        if (metaScene) metaScene._frozen = true;

        const pw = 340, ph = 320;
        const px = W / 2 - pw / 2, py = Math.max(36, (H - ph) / 2);
        const ct = this.add.container(px, py).setDepth(310);

        const overlay = this.add.rectangle(W / 2 - px, H / 2 - py, W, H, 0x000000, 0.45).setInteractive();
        ct.add(overlay);

        const bg = this.add.graphics();
        bg.fillStyle(CLR.uiPanelBg, 0.97); bg.fillRoundedRect(0, 0, pw, ph, 8);
        bg.lineStyle(2, CLR.uiBorder); bg.strokeRoundedRect(0, 0, pw, ph, 8);
        ct.add(bg);

        ct.add(this.txt(pw / 2, 18, 'Phone Notifications', 12, CLR.gold).setOrigin(0.5));
        ct.add(this.txt(pw / 2, 36, '[N] Close', 8, '#666688').setOrigin(0.5));

        const notifs = MetaState.state.phoneNotifications || [];

        if (notifs.length === 0) {
            ct.add(this.txt(pw / 2, ph / 2, 'No notifications', 9, '#888899').setOrigin(0.5));
            ct.add(this.txt(pw / 2, ph / 2 + 20, 'Play Havenwood to get updates!', 8, '#667788').setOrigin(0.5));
        } else {
            let yOff = 54;
            for (let i = notifs.length - 1; i >= 0 && yOff < ph - 50; i--) {
                const n = notifs[i];
                // Notification icon
                const icon = n.type === 'npc_visit' ? '*' : '>';
                const color = n.type === 'npc_visit' ? '#FFDD88' : '#88CCAA';
                const msgText = this.txt(20, yOff, `${icon} ${n.text}`, 8, color).setOrigin(0, 0);
                msgText.setWordWrapWidth(pw - 40);
                ct.add(msgText);
                yOff += msgText.height + 8;
            }

            // Clear button
            const btnW = 140, btnH = 28;
            const bx = pw / 2 - btnW / 2, by = ph - 42;
            const clearBg = this.add.graphics();
            clearBg.fillStyle(0x445566, 0.6); clearBg.fillRoundedRect(bx, by, btnW, btnH, 4);
            ct.add(clearBg);
            const clearHit = this.add.rectangle(pw / 2, by + btnH / 2, btnW, btnH, 0, 0).setInteractive({ useHandCursor: true });
            ct.add(clearHit);
            ct.add(this.txt(pw / 2, by + btnH / 2, 'Clear All', 9, '#CCDDEE').setOrigin(0.5));
            clearHit.on('pointerover', () => { clearBg.clear(); clearBg.fillStyle(0x556688, 0.7); clearBg.fillRoundedRect(bx, by, btnW, btnH, 4); });
            clearHit.on('pointerout', () => { clearBg.clear(); clearBg.fillStyle(0x445566, 0.6); clearBg.fillRoundedRect(bx, by, btnW, btnH, 4); });
            clearHit.on('pointerdown', () => {
                MetaState.state.phoneNotifications = [];
                this.closeNotifications();
                this.refreshStatusBar();
            });
        }

        this.notifPanel = ct;
    }

    closeNotifications() {
        if (this.notifPanel) { this.notifPanel.destroy(); this.notifPanel = null; }
        const metaScene = this.scene.get('MetaWorldScene');
        if (metaScene && !metaScene._startWithPhone) metaScene._frozen = false;
    }

    // Queued toast notifications; displayed one at a time, auto-dismiss with fade.
    showNotification(text) {
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
            fontFamily: '"Press Start 2P", monospace', fontSize: '10px', color: CLR.uiText,
            stroke: '#000000', strokeThickness: 2,
            backgroundColor: '#1A2438DD', padding: { x: 10, y: 8 }
        }).setOrigin(0.5, 0).setAlpha(0).setDepth(500);

        this.tweens.add({ targets: n, alpha: 1, y: `-=8`, duration: 300 });
        this.tweens.add({
            targets: n, alpha: 0, y: `-=12`,
            delay: 2400, duration: 400,
            onComplete: () => { n.destroy(); this._showNextNotif(); }
        });
    }
}
