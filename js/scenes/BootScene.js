// First scene. Waits for "Press Start 2P" font, generates sprite textures via SpriteGenerator, then transitions to MenuScene.
import { W, H } from '../GameData.js';
import { SpriteGenerator } from '../SpriteGenerator.js';
import { MetaSpriteGenerator } from '../MetaSpriteGenerator.js';

export default class BootScene extends Phaser.Scene {
    constructor() { super('BootScene'); }

    create() {
        const txt = this.add.text(W / 2, H / 2, 'Loading...', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '14px',
            color: '#FFF8DC'
        }).setOrigin(0.5);

        Promise.race([document.fonts.ready, new Promise(function(r){ setTimeout(r, 700); })]).then(() => {
            SpriteGenerator.generate(this);
            MetaSpriteGenerator.generate(this);
            this.time.delayedCall(400, () => this.scene.start('MenuScene'));
        });
    }
}
