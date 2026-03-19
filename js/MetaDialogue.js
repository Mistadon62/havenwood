// MetaDialogue — Lightweight dialogue box system for the meta-world.
// Drawn by MetaHUDScene as an overlay. Supports sequential lines,
// branching choices, and callbacks.
//
// Usage:
//   MetaDialogue.show(hudScene, {
//       speaker: 'Prof. Elara',
//       spriteKey: 'npc_elara',          // optional — shows portrait on left
//       lines: ['Hello!', 'Ready for class?'],
//       choices: [{ label: 'Yes (-15 energy)', action: 'attend' }, { label: 'No', action: 'cancel' }],
//       onChoice: (action) => { ... },
//       onClose: () => { ... },
//   });

import { W, H, CLR } from './GameData.js';

let activeDialogue = null;

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

const MetaDialogue = {
    isActive() { return activeDialogue !== null; },

    show(hudScene, config) {
        if (activeDialogue) this.close(hudScene);

        const { speaker, spriteKey, lines, choices, onChoice, onClose } = config;

        // Freeze meta-world
        const metaScene = hudScene.scene.get('MetaWorldScene');
        if (metaScene) metaScene._frozen = true;

        const lineIdx = { current: 0 };
        const container = hudScene.add.container(0, 0).setDepth(400);

        // Dark overlay behind dialogue
        const overlay = hudScene.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.3);
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
            const nameText = txt(hudScene, textAreaX, boxY + 12, speaker, 10, CLR.gold, textAreaW);
            container.add(nameText);
        }

        // Line text
        const textY = speaker ? boxY + 32 : boxY + 14;
        const lineText = txt(hudScene, textAreaX, textY, lines[0] || '', 9, '#DDDDEE', textAreaW);
        container.add(lineText);

        // Hint
        const isFinalLine = lines.length <= 1 && (!choices || choices.length === 0);
        const hint = txt(hudScene, boxX + boxW - 14, boxY + boxH - 16,
            isFinalLine ? '[E] Close' : '[E] Continue', 8, '#666688', 200);
        hint.setOrigin(1, 0.5);
        container.add(hint);

        // Choices container (hidden until all lines are shown)
        let choiceContainer = null;

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
                cbg.fillStyle(0x2A3A52, 0.9);
                cbg.fillRoundedRect(choiceX, cy, choiceW, choiceH, 5);
                choiceContainer.add(cbg);

                const cHit = hudScene.add.rectangle(choiceX + choiceW / 2, cy + choiceH / 2, choiceW, choiceH, 0, 0)
                    .setInteractive({ useHandCursor: true });
                choiceContainer.add(cHit);

                const cText = txt(hudScene, choiceX + 14, cy + choiceH / 2, `${i + 1}. ${c.label}`, 9, '#88DD88', choiceW - 28);
                cText.setOrigin(0, 0.5);
                choiceContainer.add(cText);

                cHit.on('pointerover', () => {
                    cbg.clear();
                    cbg.fillStyle(0x3A4F6B, 0.95);
                    cbg.fillRoundedRect(choiceX, cy, choiceW, choiceH, 5);
                });
                cHit.on('pointerout', () => {
                    cbg.clear();
                    cbg.fillStyle(0x2A3A52, 0.9);
                    cbg.fillRoundedRect(choiceX, cy, choiceW, choiceH, 5);
                });
                cHit.on('pointerdown', () => {
                    MetaDialogue.close(hudScene);
                    if (onChoice) onChoice(c.action);
                });
            });

            // Also handle number key presses for choices
            activeDialogue._choiceKeys = [];
            choices.forEach((c, i) => {
                const key = hudScene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE + i);
                activeDialogue._choiceKeys.push({ key, action: c.action });
            });
        };

        const advance = () => {
            if (choiceContainer) return; // choices visible, ignore E
            // If we're on the last line with no choices, close immediately
            if (lineIdx.current === lines.length - 1 && (!choices || choices.length === 0)) {
                MetaDialogue.close(hudScene);
                if (onClose) onClose();
                return;
            }
            lineIdx.current++;
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

        activeDialogue = { container, advance, _choiceKeys: null, onChoice, onClose };
    },

    // Check number key presses for choice selection (called every frame during dialogue)
    checkChoiceKeys(hudScene) {
        if (!activeDialogue || !activeDialogue._choiceKeys) return;
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
        if (!activeDialogue) return;
        activeDialogue.advance();
    },

    close(hudScene) {
        if (!activeDialogue) return;
        if (activeDialogue._choiceKeys) {
            for (const ck of activeDialogue._choiceKeys) {
                ck.key.destroy();
            }
        }
        activeDialogue.container.destroy();
        activeDialogue = null;

        // Unfreeze meta-world
        const metaScene = hudScene.scene.get('MetaWorldScene');
        if (metaScene && !metaScene._startWithPhone) metaScene._frozen = false;
    },
};

export default MetaDialogue;
