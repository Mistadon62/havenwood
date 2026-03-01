// Havenwood entry point. Configures and creates the Phaser game instance.
// Loads scenes in order: Boot -> Menu -> Game -> HUD.
import { W, H } from './GameData.js';
import BootScene from './scenes/BootScene.js';
import MenuScene from './scenes/MenuScene.js';
import GameScene from './scenes/GameScene.js';
import HUDScene from './scenes/HUDScene.js';

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
    scene: [BootScene, MenuScene, GameScene, HUDScene],
    input: {
        mouse: { preventDefaultWheel: false }
    }
};

new Phaser.Game(config);
