// TransitionScene — Orchestrates the first-time zoom-out (Havenwood → phone → room).
// Runs as an overlay scene. Captures GameScene+HUDScene, launches MetaWorldScene
// behind so the room is visible as the phone shrinks, then triggers a "put phone away"
// animation. Only used once; subsequent transitions skip the zoom.

import { W, H } from '../GameData.js';

const BEZEL = 16;
const CORNER = 8;
const DURATION = 1800;

export default class TransitionScene extends Phaser.Scene {
    constructor() { super('TransitionScene'); }

    init(data) {
    }

    create() {
        this.cameras.main.setRoundPixels(true);
        this.doZoomOut();
    }

    // ── Zoom Out: Havenwood → Phone → Room ──

    doZoomOut() {
        this.game._hasZoomedOut = true;
        const gameScene = this.scene.get('GameScene');
        const hudScene = this.scene.get('HUDScene');

        if (gameScene.state.viewingHabitat || gameScene.state.viewingFacility) {
            gameScene.zoomOut();
        }
        if (hudScene.closeAllPanels) hudScene.closeAllPanels(true);

        this.time.delayedCall(gameScene.cameras.main.zoom !== 1 ? 400 : 50, () => {
            const cam = gameScene.cameras.main;
            cam.scrollX = 0;
            cam.scrollY = 0;
            cam.zoom = 1;
            this.captureAndAnimate(gameScene, hudScene);
        });
    }

    captureAndAnimate(gameScene, hudScene) {
        this.game.renderer.snapshot(image => {
            if (this.textures.exists('phone_screen_snap')) {
                this.textures.remove('phone_screen_snap');
            }
            this.textures.addImage('phone_screen_snap', image);

            // Build phone container FIRST so it covers the screen before we swap scenes
            const container = this.buildPhoneContainer();
            this.phoneContainer = container;
            container.setScale(1);
            container.setPosition(W / 2, H / 2);

            // Now safe to sleep game scenes — container covers everything
            this.scene.sleep('GameScene');
            this.scene.sleep('HUDScene');

            // Launch MetaWorldScene behind us so it renders during the zoom
            this.scene.launch('MetaWorldScene', { startWithPhone: true });
            this.scene.launch('MetaHUDScene');
            this.scene.bringToTop('TransitionScene');

            // Wait one frame for MetaWorldScene to render, then get character position
            this.time.delayedCall(50, () => {
                const metaScene = this.scene.get('MetaWorldScene');
                const charX = metaScene.char ? metaScene.char.x : W / 2;
                const charY = metaScene.char ? metaScene.char.y : H / 2;
                const phoneY = charY - 6;

                const phoneSpriteH = 1;
                const containerH = H + BEZEL * 2;
                const targetScale = phoneSpriteH / containerH;

                // Animate zoom-out — phone shrinks to character's hands
                let putAwayTriggered = false;
                this.tweens.add({
                    targets: container,
                    scaleX: targetScale,
                    scaleY: targetScale,
                    x: charX,
                    y: phoneY,
                    duration: DURATION,
                    ease: 'Cubic.easeInOut',
                    onUpdate: (tween) => {
                        if (!putAwayTriggered && tween.progress >= 0.85) {
                            putAwayTriggered = true;
                            const ms = this.scene.get('MetaWorldScene');
                            if (ms && ms.playPutAwayPhone) ms.playPutAwayPhone();
                        }
                    },
                    onComplete: () => {
                        this.finishZoomOut();
                    }
                });
            });
        });
    }

    finishZoomOut() {
        // Fade out the phone container (put-away animation already started at 70%)
        this.tweens.add({
            targets: this.phoneContainer,
            alpha: 0,
            duration: 200,
            onComplete: () => {
                this.scene.stop('TransitionScene');
            }
        });
    }

    // ── Phone Container ──

    buildPhoneContainer() {
        const container = this.add.container(W / 2, H / 2).setDepth(10);

        const phoneW = W + BEZEL * 2;
        const phoneH = H + BEZEL * 2;

        // 1) Phone body (behind screen)
        const body = this.add.graphics();
        body.fillStyle(0x1a1a2a, 1);
        body.fillRoundedRect(-phoneW / 2, -phoneH / 2, phoneW, phoneH, CORNER + 4);
        body.fillStyle(0x2a2a3a, 1);
        body.fillRoundedRect(-phoneW / 2 + 2, -phoneH / 2 + 2, phoneW - 4, phoneH - 4, CORNER + 2);
        body.fillStyle(0x111118, 1);
        body.fillRoundedRect(-W / 2 - 2, -H / 2 - 2, W + 4, H + 4, CORNER);
        body.fillCircle(0, -H / 2 - BEZEL / 2, 3);
        body.fillStyle(0x333344, 1);
        body.fillRoundedRect(-12, H / 2 + BEZEL / 2 - 4, 24, 8, 4);
        container.add(body);

        // 2) Game screen image
        const screen = this.add.image(0, 0, 'phone_screen_snap');
        screen.setDisplaySize(W, H);
        container.add(screen);

        // 3) Frame overlay
        const frame = this.add.graphics();
        frame.lineStyle(2, 0x2a2a3a, 0.6);
        frame.strokeRoundedRect(-W / 2, -H / 2, W, H, CORNER);
        container.add(frame);

        // 4) Screen glow
        const glow = this.add.graphics();
        glow.lineStyle(1, 0x3a5a8a, 0.3);
        glow.strokeRoundedRect(-W / 2 + 1, -H / 2 + 1, W - 2, H - 2, CORNER - 1);
        container.add(glow);

        return container;
    }
}
