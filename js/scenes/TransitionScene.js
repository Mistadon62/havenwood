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

            // Screenshot covers the screen before we swap scenes
            const snap = this.add.image(W / 2, H / 2, 'phone_screen_snap')
                .setDisplaySize(W, H).setDepth(10);
            this.snapImage = snap;

            // Now safe to sleep game scenes — screenshot covers everything
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

                const targetScale = 1 / H; // shrink to ~1px tall

                // Animate zoom-out — target the phone in the character's hands
                // (slightly left and down from center to match where hands hold the phone)
                let putAwayTriggered = false;
                this.tweens.add({
                    targets: snap,
                    scaleX: targetScale,
                    scaleY: targetScale,
                    x: charX - 5,
                    y: charY + 9,
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
        this.tweens.add({
            targets: this.snapImage,
            alpha: 0,
            duration: 200,
            onComplete: () => {
                this.scene.stop('TransitionScene');
            }
        });
    }
}
