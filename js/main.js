// Havenwood entry point. Configures and creates the Phaser game instance.
// Loads scenes in order: Boot -> Menu -> Game -> HUD.
// Meta-world scenes (TransitionScene, MetaWorldScene, MetaHUDScene) are registered
// but only launched on demand when the player exits/enters the phone game.
import { W, H } from './GameData.js';
import BootScene from './scenes/BootScene.js';
import MenuScene from './scenes/MenuScene.js';
import GameScene from './scenes/GameScene.js';
import HUDScene from './scenes/HUDScene.js';
import TransitionScene from './scenes/TransitionScene.js';
import MetaWorldScene from './scenes/MetaWorldScene.js';
import MetaHUDScene from './scenes/MetaHUDScene.js';

const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: W,
    height: H,
    pixelArt: true,
    backgroundColor: '#1a1a2e',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene, MenuScene, GameScene, HUDScene, TransitionScene, MetaWorldScene, MetaHUDScene],
    input: {
        mouse: { preventDefaultWheel: false }
    }
};

new Phaser.Game(config);
