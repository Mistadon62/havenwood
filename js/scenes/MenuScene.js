// Title screen with gradient sky, tree silhouettes, wildflowers. New Game / Continue buttons. Fade-in on text.
import { W, H, CLR } from '../GameData.js';

export default class MenuScene extends Phaser.Scene {
    constructor() { super('MenuScene'); }

    create() {
        const bg = this.add.graphics();

        for (let y = 0; y < H; y++) {
            const t = y / H;
            const r = Math.round(15 + t * 25);
            const g = Math.round(20 + t * 55);
            const b = Math.round(35 - t * 15);
            bg.fillStyle(Phaser.Display.Color.GetColor(r, g, b));
            bg.fillRect(0, y, W, 1);
        }

        bg.fillStyle(CLR.grass2);
        bg.fillRect(0, H * 0.62, W, H * 0.38);
        bg.fillStyle(CLR.grass1);
        bg.fillRect(0, H * 0.65, W, H * 0.35);

        const rng = new Phaser.Math.RandomDataGenerator(['menu']);
        for (let i = 0; i < 18; i++) {
            const tx = rng.between(0, W);
            const ty = H * 0.45 + rng.between(0, 80);
            const th = rng.between(50, 110);
            const tw = rng.between(25, 50);
            bg.fillStyle(0x1a3a1a, 0.8);
            bg.fillTriangle(tx, ty - th, tx - tw / 2, ty, tx + tw / 2, ty);
            bg.fillStyle(0x254a25, 0.5);
            bg.fillTriangle(tx, ty - th + 15, tx - tw / 2 + 8, ty, tx + tw / 2 - 8, ty);
        }

        for (let i = 0; i < 8; i++) {
            const fx = rng.between(50, W - 50);
            const fy = H * 0.7 + rng.between(0, 60);
            bg.fillStyle(rng.pick([0xFFDD44, 0xFF8899, 0xAABBFF, 0xFFFFFF]));
            bg.fillCircle(fx, fy, 2);
        }

        this.add.text(W / 2, 140, 'HAVENWOOD', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '44px',
            color: CLR.gold,
            stroke: '#1a0e04',
            strokeThickness: 6
        }).setOrigin(0.5);

        this.add.text(W / 2, 200, 'Animal Sanctuary', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '14px',
            color: CLR.uiText,
            stroke: '#1a0e04',
            strokeThickness: 3
        }).setOrigin(0.5);

        this.btn(W / 2, 320, 'New Game', () => {
            this.scene.start('GameScene', { newGame: true });
        });

        if (localStorage.getItem('havenwood_save')) {
            this.btn(W / 2, 380, 'Continue', () => {
                this.scene.start('GameScene', { newGame: false });
            });
        }

        this.add.text(W / 2, H - 30, 'v0.1 MVP', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '8px',
            color: '#556644'
        }).setOrigin(0.5);

        this.children.list
            .filter(c => c.type === 'Text')
            .forEach((c, i) => {
                c.setAlpha(0);
                this.tweens.add({
                    targets: c, alpha: 1,
                    duration: 600,
                    delay: i * 150
                });
            });
    }

    // Creates interactive text button with hover (gold) and click callback.
    btn(x, y, label, cb) {
        const t = this.add.text(x, y, label, {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '16px',
            color: CLR.uiText,
            stroke: '#1a0e04',
            strokeThickness: 3,
            padding: { x: 16, y: 8 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        t.on('pointerover', () => t.setColor(CLR.gold));
        t.on('pointerout', () => t.setColor(CLR.uiText));
        t.on('pointerdown', cb);
    }
}
