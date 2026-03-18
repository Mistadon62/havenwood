// MetaDialogue — Lightweight dialogue box system for the meta-world.
// Drawn by MetaHUDScene as an overlay. Supports sequential lines,
// branching choices, and callbacks.
//
// Usage:
//   MetaDialogue.show(hudScene, {
//       speaker: 'Prof. Elara',
//       lines: ['Hello!', 'Ready for class?'],
//       choices: [{ label: 'Yes (-15 energy)', action: 'attend' }, { label: 'No', action: 'cancel' }],
//       onChoice: (action) => { ... },
//       onClose: () => { ... },
//   });

import { W, H, CLR } from './GameData.js';

let activeDialogue = null;

function txt(scene, x, y, str, size, color) {
    return scene.add.text(x, y, str, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: `${size}px`,
        color: color || '#FFFFFF',
        stroke: '#000000',
        strokeThickness: 2,
        wordWrap: { width: 360 },
    });
}

const MetaDialogue = {
    isActive() { return activeDialogue !== null; },

    show(hudScene, config) {
        if (activeDialogue) this.close(hudScene);

        const { speaker, lines, choices, onChoice, onClose } = config;

        // Freeze meta-world
        const metaScene = hudScene.scene.get('MetaWorldScene');
        if (metaScene) metaScene._frozen = true;

        const lineIdx = { current: 0 };
        const container = hudScene.add.container(0, 0).setDepth(400);

        // Dark overlay behind dialogue
        const overlay = hudScene.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.3);
        container.add(overlay);

        // Dialogue box at bottom of screen
        const boxW = 420, boxH = 120;
        const boxX = (W - boxW) / 2, boxY = H - boxH - 20;

        const bg = hudScene.add.graphics();
        bg.fillStyle(0x1A2438, 0.95);
        bg.fillRoundedRect(boxX, boxY, boxW, boxH, 8);
        bg.lineStyle(2, 0x3D4F6B, 0.9);
        bg.strokeRoundedRect(boxX, boxY, boxW, boxH, 8);
        container.add(bg);

        // Speaker name
        if (speaker) {
            const nameText = txt(hudScene, boxX + 14, boxY + 10, speaker, 10, CLR.gold);
            container.add(nameText);
        }

        // Line text
        const textY = speaker ? boxY + 28 : boxY + 14;
        const lineText = txt(hudScene, boxX + 14, textY, lines[0] || '', 9, '#DDDDEE');
        container.add(lineText);

        // Hint
        const hint = txt(hudScene, boxX + boxW - 14, boxY + boxH - 16, '[E] Continue', 8, '#666688');
        hint.setOrigin(1, 0.5);
        container.add(hint);

        // Choices container (hidden until all lines are shown)
        let choiceContainer = null;

        const showChoices = () => {
            if (!choices || choices.length === 0) {
                // No choices — next E press closes
                hint.setText('[E] Close');
                lineIdx.current = -1; // sentinel for "close on next press"
                return;
            }
            hint.setVisible(false);
            choiceContainer = hudScene.add.container(0, 0);
            container.add(choiceContainer);

            choices.forEach((c, i) => {
                const cy = boxY - (choices.length - i) * 30 - 8;
                const cbg = hudScene.add.graphics();
                cbg.fillStyle(0x2A3A52, 0.9);
                cbg.fillRoundedRect(boxX + 20, cy, boxW - 40, 26, 5);
                choiceContainer.add(cbg);

                const cHit = hudScene.add.rectangle(W / 2, cy + 13, boxW - 40, 26, 0, 0)
                    .setInteractive({ useHandCursor: true });
                choiceContainer.add(cHit);

                const cText = txt(hudScene, boxX + 34, cy + 13, `${i + 1}. ${c.label}`, 9, '#88DD88');
                cText.setOrigin(0, 0.5);
                choiceContainer.add(cText);

                cHit.on('pointerover', () => {
                    cbg.clear();
                    cbg.fillStyle(0x3A4F6B, 0.95);
                    cbg.fillRoundedRect(boxX + 20, cy, boxW - 40, 26, 5);
                });
                cHit.on('pointerout', () => {
                    cbg.clear();
                    cbg.fillStyle(0x2A3A52, 0.9);
                    cbg.fillRoundedRect(boxX + 20, cy, boxW - 40, 26, 5);
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
            if (lineIdx.current === -1) {
                // Close
                MetaDialogue.close(hudScene);
                if (onClose) onClose();
                return;
            }
            lineIdx.current++;
            if (lineIdx.current >= lines.length) {
                showChoices();
            } else {
                lineText.setText(lines[lineIdx.current]);
            }
        };

        activeDialogue = { container, advance, _choiceKeys: null, onChoice, onClose };
    },

    advance(hudScene) {
        if (!activeDialogue) return;

        // Check choice key presses
        if (activeDialogue._choiceKeys) {
            for (const ck of activeDialogue._choiceKeys) {
                if (Phaser.Input.Keyboard.JustDown(ck.key)) {
                    const action = ck.action;
                    const onChoice = activeDialogue.onChoice;
                    MetaDialogue.close(hudScene);
                    if (onChoice) onChoice(action);
                    return;
                }
            }
        }

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
