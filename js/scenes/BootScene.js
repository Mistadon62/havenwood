import { W, H } from '../GameData.js';
import { SpriteGenerator } from '../SpriteGenerator.js';

export default class BootScene extends Phaser.Scene {
    constructor() { super('BootScene'); }

    create() {
        const txt = this.add.text(W / 2, H / 2, 'Loading...', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '14px',
            color: '#FFF8DC'
        }).setOrigin(0.5);

        document.fonts.ready.then(() => {
            SpriteGenerator.generate(this);
            this.time.delayedCall(400, () => this.scene.start('MenuScene'));
        });
    }
}
