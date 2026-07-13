import { W, H, CLR } from './GameData.js';

let activeDialogue = null;

function havenwoodPortraitDataUrl(hudScene, spriteKey) {
    if (!spriteKey || !hudScene || !hudScene.textures.exists(spriteKey)) return null;
    try {
        var src = hudScene.textures.get(spriteKey).getSourceImage();
        var w = src.width || src.naturalWidth || 32;
        var h = src.height || src.naturalHeight || 32;
        var canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(src, 0, 0, w, h);
        return canvas.toDataURL('image/png');
    } catch (_) {
        return null;
    }
}

function txt(scene, x, y, str, size, color, wrapWidth) {
    return scene.add.text(x, y, str, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: `${size}px`,
        color: color || '#FFFFFF',
        stroke: '#000000',
        strokeThickness: 2,
        wordWrap: { width: wrapWidth || 360 },
    });
}
let lastMobileAdvanceAt = 0;
const MOBILE_ADVANCE_GUARD_MS = 650;

function takeMobileDialogueAdvance() {
    if (!window.__havenwoodMobileMode) return true;
    const now = Date.now();
    if (now - lastMobileAdvanceAt < MOBILE_ADVANCE_GUARD_MS) return false;
    lastMobileAdvanceAt = now;
    return true;
}

const MetaDialogue = {
    isActive() { return activeDialogue !== null; },

    show(hudScene, config) {
        if (activeDialogue) this.close(hudScene);

        const { speaker, spriteKey, lines, choices, onChoice, onClose, startLine, onAdvanceLine } = config;

        // Freeze the active world scene
        const metaScene = hudScene.scene.get('MetaWorldScene');
        if (metaScene && !hudScene.scene.isSleeping('MetaWorldScene') && !window.__havenwoodMobileMode) metaScene._frozen = true;
        const gameScene = hudScene.scene.get('GameScene');
        // Native RN dialogue sheet handles input — keep sanctuary sim + map pan alive on mobile.
        if (gameScene && !hudScene.scene.isSleeping('GameScene') && !window.__havenwoodMobileMode) {
            gameScene._dialoguePaused = true;
        }

        const lineIdx = { current: startLine || 0 };

        if (window.__havenwoodMobileMode) {
            const portraitDataUrl = spriteKey ? havenwoodPortraitDataUrl(hudScene, spriteKey) : null;
            const advance = () => {
                if (lineIdx.current >= lines.length) {
                    if (choices && choices.length > 0) return;
                    MetaDialogue.close(hudScene);
                    if (onClose) onClose();
                    return;
                }
                if (lineIdx.current === lines.length - 1 && (!choices || choices.length === 0)) {
                    MetaDialogue.close(hudScene);
                    if (onClose) onClose();
                    return;
                }
                lineIdx.current++;
                if (onAdvanceLine) onAdvanceLine(lineIdx.current);
                if (lineIdx.current >= lines.length && choices && choices.length) return;
                if (lineIdx.current >= lines.length) {
                    MetaDialogue.close(hudScene);
                    if (onClose) onClose();
                }
            };
            activeDialogue = {
                hudScene, speaker, spriteKey: spriteKey || null, portraitDataUrl, lines, choices, onChoice, onClose, lineIdx, advance,
                _choiceKeys: null, _navKeys: null,
                _getHighlightIdx: () => 0,
                _setHighlight: () => {},
                _choiceCount: () => (choices ? choices.length : 0),
                container: null,
            };
            if (window.__havenwoodReportSnapshot) window.__havenwoodReportSnapshot(true);
            return;
        }

        const container = hudScene.add.container(0, 0).setDepth(400);

        // Dark overlay behind dialogue — interactive to block clicks on background
        const overlay = hudScene.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.3)
            .setInteractive();
        container.add(overlay);

        // --- Full-width dialogue box ---
        const margin = 16;
        const boxW = W - margin * 2;
        const boxH = 168;
        const boxX = margin;
        const boxY = H - boxH - 12;

        const bg = hudScene.add.graphics();
        bg.fillStyle(0x1A2438, 0.95);
        bg.fillRoundedRect(boxX, boxY, boxW, boxH, 8);
        bg.lineStyle(2, 0x3D4F6B, 0.9);
        bg.strokeRoundedRect(boxX, boxY, boxW, boxH, 8);
        container.add(bg);

        // --- Portrait area (left 20%) ---
        const portraitW = Math.floor(boxW * 0.20);
        const portraitX = boxX;
        const portraitCenterX = portraitX + portraitW / 2;
        const portraitCenterY = boxY + boxH / 2;

        // Divider line between portrait and text
        const divider = hudScene.add.graphics();
        divider.lineStyle(1, 0x3D4F6B, 0.6);
        divider.beginPath();
        divider.moveTo(boxX + portraitW, boxY + 8);
        divider.lineTo(boxX + portraitW, boxY + boxH - 8);
        divider.strokePath();
        container.add(divider);

        // Portrait sprite (scaled up)
        if (spriteKey && hudScene.textures.exists(spriteKey)) {
            const portrait = hudScene.add.image(portraitCenterX, portraitCenterY, spriteKey);
            const scale = Math.min((portraitW - 24) / portrait.width, (boxH - 24) / portrait.height);
            portrait.setScale(scale);
            container.add(portrait);
        }

        // --- Text area (right 80%) ---
        const textAreaX = boxX + portraitW + 14;
        const textAreaW = boxW - portraitW - 28;

        // Speaker name
        if (speaker) {
            const nameText = txt(hudScene, textAreaX, boxY + 12, speaker, 12, CLR.gold, textAreaW);
            container.add(nameText);
        }

        // Line text
        const textY = speaker ? boxY + 32 : boxY + 14;
        const lineText = txt(hudScene, textAreaX, textY, lines[lineIdx.current] || '', 11, '#DDDDEE', textAreaW);
        container.add(lineText);

        // Hint
        const isFinalLine = lineIdx.current >= lines.length - 1 && (!choices || choices.length === 0);
        const hint = txt(hudScene, boxX + boxW - 14, boxY + boxH - 16,
            isFinalLine ? '[E] Close' : '[E] Continue', 10, '#666688', 200);
        hint.setOrigin(1, 0.5);
        container.add(hint);

        // Choices container (hidden until all lines are shown)
        let choiceContainer = null;
        let choiceItems = [];   // { bg, text, cy } per choice
        let highlightIdx = 0;

        const CHOICE_NORMAL = 0x2A3A52;
        const CHOICE_HIGHLIGHT = 0x3A4F6B;
        const TEXT_NORMAL = '#88DD88';
        const TEXT_HIGHLIGHT = '#CCFFCC';

        const drawChoiceBg = (item, highlighted) => {
            item.bg.clear();
            item.bg.fillStyle(highlighted ? CHOICE_HIGHLIGHT : CHOICE_NORMAL, highlighted ? 0.95 : 0.9);
            item.bg.fillRoundedRect(item.x, item.cy, item.w, item.h, 5);
            if (highlighted) {
                item.bg.lineStyle(1, 0x88AACC, 0.7);
                item.bg.strokeRoundedRect(item.x, item.cy, item.w, item.h, 5);
            }
            item.text.setColor(highlighted ? TEXT_HIGHLIGHT : TEXT_NORMAL);
        };

        const setHighlight = (idx) => {
            if (choiceItems.length === 0) return;
            idx = ((idx % choiceItems.length) + choiceItems.length) % choiceItems.length;
            if (idx === highlightIdx && choiceItems[idx]) return;
            if (choiceItems[highlightIdx]) drawChoiceBg(choiceItems[highlightIdx], false);
            highlightIdx = idx;
            drawChoiceBg(choiceItems[highlightIdx], true);
        };

        const confirmChoice = () => {
            if (choiceItems.length === 0) return;
            const action = choices[highlightIdx].action;
            MetaDialogue.close(hudScene);
            if (onChoice) onChoice(action);
        };

        const showChoices = () => {
            if (!choices || choices.length === 0) {
                hint.setText('[E] Close');
                lineIdx.current = -1;
                return;
            }
            hint.setVisible(false);
            choiceContainer = hudScene.add.container(0, 0);
            container.add(choiceContainer);

            const choiceW = textAreaW;
            const choiceX = textAreaX;
            const choiceH = 26;
            const choiceGap = 4;

            choices.forEach((c, i) => {
                // Stack choices upward from bottom of box
                const cy = boxY + boxH - 12 - (choices.length - i) * (choiceH + choiceGap);
                const cbg = hudScene.add.graphics();
                choiceContainer.add(cbg);

                const cHit = hudScene.add.rectangle(choiceX + choiceW / 2, cy + choiceH / 2, choiceW, choiceH, 0, 0)
                    .setInteractive({ useHandCursor: true });
                choiceContainer.add(cHit);

                const cText = txt(hudScene, choiceX + 14, cy + choiceH / 2, `${i + 1}. ${c.label}`, 11, TEXT_NORMAL, choiceW - 28);
                cText.setOrigin(0, 0.5);
                choiceContainer.add(cText);

                const item = { bg: cbg, text: cText, cy, x: choiceX, w: choiceW, h: choiceH };
                choiceItems.push(item);

                // Draw initial state
                drawChoiceBg(item, i === 0);

                cHit.on('pointerover', () => setHighlight(i));
                cHit.on('pointerdown', () => {
                    highlightIdx = i;
                    confirmChoice();
                });
            });

            highlightIdx = 0;

            // Number key presses for choices
            activeDialogue._choiceKeys = [];
            choices.forEach((c, i) => {
                const key = hudScene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE + i);
                activeDialogue._choiceKeys.push({ key, action: c.action });
            });

            // Navigation keys (W/S and Up/Down)
            activeDialogue._navKeys = {
                up: hudScene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
                down: hudScene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
                arrowUp: hudScene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
                arrowDown: hudScene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
            };
        };

        const advance = () => {
            // Choices visible — E confirms the highlighted choice
            if (choiceContainer) {
                confirmChoice();
                return;
            }
            // If we're on the last line with no choices, close immediately
            if (lineIdx.current === lines.length - 1 && (!choices || choices.length === 0)) {
                MetaDialogue.close(hudScene);
                if (onClose) onClose();
                return;
            }
            lineIdx.current++;
            if (onAdvanceLine) onAdvanceLine(lineIdx.current);
            if (lineIdx.current >= lines.length) {
                showChoices();
            } else {
                lineText.setText(lines[lineIdx.current]);
                // Show "[E] Close" on the last line if there are no choices
                if (lineIdx.current === lines.length - 1 && (!choices || choices.length === 0)) {
                    hint.setText('[E] Close');
                }
            }
        };

        activeDialogue = { container, advance, _choiceKeys: null, _navKeys: null, onChoice, onClose,
            _setHighlight: (idx) => setHighlight(idx), _getHighlightIdx: () => highlightIdx,
            _choiceCount: () => choiceItems.length };
    },

    // Check key presses for choice navigation and selection (called every frame during dialogue)
    checkChoiceKeys(hudScene) {
        if (!activeDialogue) return;

        // Navigation keys (W/S, Up/Down)
        if (activeDialogue._navKeys) {
            const nav = activeDialogue._navKeys;
            if (Phaser.Input.Keyboard.JustDown(nav.up) || Phaser.Input.Keyboard.JustDown(nav.arrowUp)) {
                activeDialogue._setHighlight(activeDialogue._getHighlightIdx() - 1);
            }
            if (Phaser.Input.Keyboard.JustDown(nav.down) || Phaser.Input.Keyboard.JustDown(nav.arrowDown)) {
                activeDialogue._setHighlight(activeDialogue._getHighlightIdx() + 1);
            }
        }

        // Number keys for direct selection
        if (!activeDialogue._choiceKeys) return;
        for (const ck of activeDialogue._choiceKeys) {
            if (Phaser.Input.Keyboard.JustDown(ck.key)) {
                const action = ck.action;
                const onChoice = activeDialogue.onChoice;
                MetaDialogue.close(hudScene);
                if (onChoice) onChoice(action);
                return;
            }
        }
    },

    advance(hudScene) {
        if (!activeDialogue) return false;
        if (!takeMobileDialogueAdvance()) return false;
        activeDialogue.advance();
        if (window.__havenwoodMobileMode && window.__havenwoodReportSnapshot) window.__havenwoodReportSnapshot(true);
        return true;
    },

    getSnapshot() {
        if (!activeDialogue) return null;
        const d = activeDialogue;
        /* MOBILE_CHOICES_ON_LAST_LINE_V1 — show buy/rest choices with the final line (no extra Close tap). */
        if (typeof window !== 'undefined') window.__havenwoodChoicesOnLastLine = true;
        const hasChoiceList = !!(d.choices && d.choices.length);
        const pastLines = d.lineIdx.current >= d.lines.length;
        const onLastLine = d.lineIdx.current >= Math.max(0, d.lines.length - 1);
        const atChoices = hasChoiceList && (pastLines || onLastLine);
        const lineIdx = pastLines ? Math.max(0, d.lines.length - 1) : d.lineIdx.current;
        return {
            speaker: d.speaker || null,
            spriteKey: d.spriteKey || null,
            portraitDataUrl: d.portraitDataUrl || null,
            line: d.lines[lineIdx] || '',
            lineIndex: d.lineIdx.current,
            lineCount: d.lines.length,
            hasChoices: !!atChoices,
            choices: atChoices ? d.choices.map(c => ({ label: c.label, action: c.action })) : [],
            canAdvance: !atChoices,
        };
    },

    choose(hudScene, index) {
        if (!activeDialogue || !activeDialogue.choices || !activeDialogue.choices.length) return;
        const choice = activeDialogue.choices[index];
        if (!choice) return;
        const onChoice = activeDialogue.onChoice;
        MetaDialogue.close(hudScene);
        if (onChoice) onChoice(choice.action);
    },

    close(hudScene) {
        if (!activeDialogue) return;
        if (activeDialogue._choiceKeys) {
            for (const ck of activeDialogue._choiceKeys) {
                ck.key.destroy();
            }
        }
        if (activeDialogue._navKeys) {
            for (const nk of Object.values(activeDialogue._navKeys)) {
                nk.destroy();
            }
        }
        if (activeDialogue.container) activeDialogue.container.destroy();
        activeDialogue = null;

        // Unfreeze the active world scene
        const metaScene = hudScene.scene.get('MetaWorldScene');
        if (metaScene && (!metaScene._startWithPhone || window.__havenwoodMobileMode)) metaScene._frozen = false;
        const gameScene = hudScene.scene.get('GameScene');
        if (gameScene) gameScene._dialoguePaused = false;
        if (window.__havenwoodMobileMode && window.__havenwoodReportSnapshot) window.__havenwoodReportSnapshot(true);
    },
};

window.__havenwoodDialogueApi = MetaDialogue;

export default MetaDialogue;
