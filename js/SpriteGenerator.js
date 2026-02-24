import { TILE, SPECIES, CLR } from './GameData.js';

function bright(c, n) {
    const r = Math.min(255, ((c >> 16) & 0xFF) + n);
    const g = Math.min(255, ((c >> 8) & 0xFF) + n);
    const b = Math.min(255, (c & 0xFF) + n);
    return (r << 16) | (g << 8) | b;
}
function dark(c, n) {
    const r = Math.max(0, ((c >> 16) & 0xFF) - n);
    const g = Math.max(0, ((c >> 8) & 0xFF) - n);
    const b = Math.max(0, (c & 0xFF) - n);
    return (r << 16) | (g << 8) | b;
}

function tex(scene, key, size, fn) {
    const g = scene.make.graphics({ add: false });
    fn(g);
    g.generateTexture(key, size, size);
    g.destroy();
}

function rect(g, x, y, w, h, color) {
    g.fillStyle(color);
    g.fillRect(x, y, w, h);
}

export class SpriteGenerator {
    static generate(scene) {
        this.terrain(scene);
        this.animals(scene);
        this.ui(scene);
        this.visitor(scene);
    }

    static terrain(scene) {
        const grasses = [CLR.grass1, CLR.grass2, CLR.grass3, CLR.grass4];
        for (let i = 0; i < 4; i++) {
            tex(scene, `grass_${i + 1}`, TILE, g => {
                g.fillStyle(grasses[i]);
                g.fillRect(0, 0, TILE, TILE);
                const hi = bright(grasses[i], 18);
                g.fillStyle(hi);
                const rng = new Phaser.Math.RandomDataGenerator([`g${i}`]);
                for (let j = 0; j < 5; j++) {
                    g.fillRect(rng.between(2, 28), rng.between(4, 28), 1, 2);
                }
            });
        }

        tex(scene, 'path', TILE, g => {
            g.fillStyle(CLR.path);
            g.fillRect(0, 0, TILE, TILE);
            g.fillStyle(dark(CLR.path, 15));
            const rng = new Phaser.Math.RandomDataGenerator(['p']);
            for (let j = 0; j < 3; j++) {
                g.fillRect(rng.between(4, 24), rng.between(4, 24), 3, 2);
            }
        });

        tex(scene, 'fence', TILE, g => {
            g.fillStyle(CLR.grass2);
            g.fillRect(0, 0, TILE, TILE);
            g.fillStyle(CLR.fence);
            g.fillRect(0, 12, TILE, 6);
            g.fillRect(4, 4, 4, 20);
            g.fillRect(TILE - 8, 4, 4, 20);
            g.fillStyle(CLR.fenceLight);
            g.fillRect(0, 12, TILE, 2);
            g.fillRect(4, 4, 4, 2);
            g.fillRect(TILE - 8, 4, 4, 2);
        });
    }

    static animals(scene) {
        Object.entries(SPECIES).forEach(([id, sp]) => {
            tex(scene, `animal_${id}`, TILE, g => {
                this['draw_' + id]?.(g, sp.color) ?? this.drawGeneric(g, sp.color);
            });
        });
    }

    static draw_cat(g, c) {
        const d = dark(c, 30);
        rect(g, 9, 5, 3, 4, c);   // left ear
        rect(g, 20, 5, 3, 4, c);  // right ear
        rect(g, 10, 4, 2, 2, d);  // ear inner
        rect(g, 21, 4, 2, 2, d);  // ear inner
        rect(g, 9, 9, 14, 10, c); // head
        rect(g, 13, 12, 2, 2, 0x44CC44); // left eye
        rect(g, 18, 12, 2, 2, 0x44CC44); // right eye
        rect(g, 14, 12, 1, 2, 0x111111);
        rect(g, 19, 12, 1, 2, 0x111111);
        rect(g, 15, 15, 2, 1, 0xFFAAAA); // nose
        rect(g, 9, 19, 14, 7, c);  // body
        rect(g, 23, 19, 2, 2, c);  // tail
        rect(g, 25, 17, 2, 2, c);
        rect(g, 27, 15, 2, 3, c);
        rect(g, 10, 26, 3, 4, d);  // legs
        rect(g, 19, 26, 3, 4, d);
    }

    static draw_dog(g, c) {
        const d = dark(c, 30);
        rect(g, 10, 6, 12, 10, c); // head
        rect(g, 7, 8, 4, 8, d);    // left ear
        rect(g, 21, 8, 4, 8, d);   // right ear
        rect(g, 13, 10, 2, 2, 0x222222); // eyes
        rect(g, 18, 10, 2, 2, 0x222222);
        rect(g, 14, 13, 4, 2, 0x333333); // nose
        rect(g, 15, 15, 3, 2, 0xFF8899); // tongue
        rect(g, 9, 16, 14, 9, c);  // body
        rect(g, 23, 14, 2, 3, c);  // tail
        rect(g, 25, 12, 2, 3, c);
        rect(g, 10, 25, 3, 4, d);  // legs
        rect(g, 19, 25, 3, 4, d);
    }

    static draw_rabbit(g, c) {
        const d = dark(c, 25);
        rect(g, 12, 1, 3, 10, c);  // left ear
        rect(g, 18, 1, 3, 10, c);  // right ear
        rect(g, 13, 2, 1, 8, 0xFFCCCC); // inner ear
        rect(g, 19, 2, 1, 8, 0xFFCCCC);
        rect(g, 11, 10, 10, 8, c); // head
        rect(g, 13, 13, 2, 2, 0x222222); // eyes
        rect(g, 18, 13, 2, 2, 0x222222);
        rect(g, 15, 15, 2, 1, 0xFFAAAA);
        rect(g, 10, 18, 12, 8, c); // body
        g.fillStyle(0xFFFFFF);
        g.fillCircle(23, 21, 3);   // fluffy tail
        rect(g, 11, 26, 3, 3, d);  // legs
        rect(g, 18, 26, 3, 3, d);
    }

    static draw_fox(g, c) {
        const d = dark(c, 40);
        g.fillStyle(c);
        g.fillTriangle(10, 10, 13, 4, 16, 10); // left ear
        g.fillTriangle(22, 10, 19, 4, 16, 10); // right ear
        rect(g, 10, 10, 12, 8, c);  // head
        rect(g, 8, 14, 5, 4, 0xFFE4C4); // snout
        rect(g, 13, 12, 2, 2, 0xFFAA00); // eyes
        rect(g, 18, 12, 2, 2, 0xFFAA00);
        rect(g, 14, 12, 1, 2, 0x111111);
        rect(g, 19, 12, 1, 2, 0x111111);
        rect(g, 9, 18, 14, 8, c);   // body
        rect(g, 13, 20, 6, 6, 0xFFE4C4); // white chest
        rect(g, 23, 17, 3, 3, c);   // tail
        rect(g, 25, 15, 3, 4, c);
        rect(g, 27, 16, 2, 2, 0xFFFFFF); // tail tip
        rect(g, 10, 26, 3, 4, d);   // legs
        rect(g, 19, 26, 3, 4, d);
    }

    static draw_deer(g, c) {
        const d = dark(c, 30);
        const lt = bright(c, 40);
        rect(g, 9, 1, 2, 4, 0x8B7355); // left antler
        rect(g, 7, 1, 2, 2, 0x8B7355);
        rect(g, 21, 1, 2, 4, 0x8B7355); // right antler
        rect(g, 23, 1, 2, 2, 0x8B7355);
        rect(g, 10, 4, 12, 8, c);   // head
        rect(g, 13, 7, 2, 2, 0x222222); // eyes
        rect(g, 18, 7, 2, 2, 0x222222);
        rect(g, 15, 10, 3, 1, 0x333333);
        rect(g, 12, 12, 8, 5, c);   // neck
        rect(g, 8, 14, 16, 9, c);   // body
        rect(g, 12, 17, 2, 2, lt);  // spots
        rect(g, 17, 15, 2, 2, lt);
        rect(g, 20, 18, 2, 2, lt);
        rect(g, 9, 23, 2, 6, d);    // legs
        rect(g, 14, 23, 2, 6, d);
        rect(g, 18, 23, 2, 6, d);
        rect(g, 22, 23, 2, 5, d);
    }

    static draw_owl(g, c) {
        const d = dark(c, 25);
        rect(g, 7, 5, 4, 4, c);     // left ear tuft
        rect(g, 21, 5, 4, 4, c);    // right ear tuft
        rect(g, 9, 8, 14, 12, c);   // head/body
        g.fillStyle(0xFFFFDD);
        g.fillCircle(13, 13, 4);    // left eye ring
        g.fillCircle(19, 13, 4);    // right eye ring
        g.fillStyle(0x000000);
        g.fillCircle(13, 13, 2);    // left pupil
        g.fillCircle(19, 13, 2);    // right pupil
        rect(g, 15, 16, 2, 2, 0xDDAA44); // beak
        rect(g, 10, 20, 12, 6, d);  // lower body
        rect(g, 7, 12, 3, 8, d);    // left wing
        rect(g, 22, 12, 3, 8, d);   // right wing
        rect(g, 12, 26, 3, 3, 0x666644); // left talon
        rect(g, 17, 26, 3, 3, 0x666644); // right talon
    }

    static draw_duck(g, c) {
        rect(g, 10, 8, 12, 10, c);  // body
        rect(g, 12, 4, 8, 6, c);    // head
        rect(g, 14, 6, 2, 2, 0x222222); // eye
        rect(g, 7, 7, 5, 3, 0xEE8822); // beak
        rect(g, 8, 12, 3, 4, dark(c, 20)); // wing line
        rect(g, 20, 13, 3, 3, bright(c, 15)); // tail
        rect(g, 12, 18, 3, 3, 0xEE8822); // left foot
        rect(g, 17, 18, 3, 3, 0xEE8822); // right foot
        g.fillStyle(0x4A80B4, 0.4);
        g.fillRect(4, 21, 24, 3);   // water line
    }

    static draw_turtle(g, c) {
        const d = dark(c, 30);
        const lt = bright(c, 35);
        rect(g, 10, 10, 14, 12, c); // shell
        rect(g, 11, 11, 12, 10, lt); // shell highlight
        rect(g, 14, 12, 2, 3, d);   // shell pattern
        rect(g, 18, 14, 2, 3, d);
        rect(g, 14, 17, 3, 2, d);
        rect(g, 5, 14, 6, 5, 0x7a8a4a); // head
        rect(g, 5, 16, 2, 2, 0x222222); // eye
        rect(g, 10, 22, 3, 3, d);   // front leg
        rect(g, 19, 22, 3, 3, d);   // back leg
        rect(g, 24, 16, 3, 2, d);   // tail
    }

    static draw_bear_cub(g, c) {
        const d = dark(c, 25);
        const lt = bright(c, 30);
        g.fillStyle(c);
        g.fillCircle(11, 7, 4);     // left ear
        g.fillCircle(21, 7, 4);     // right ear
        g.fillStyle(d);
        g.fillCircle(11, 7, 2);     // inner ear
        g.fillCircle(21, 7, 2);
        rect(g, 8, 8, 16, 12, c);   // head
        rect(g, 13, 10, 2, 2, 0x222222); // eyes
        rect(g, 18, 10, 2, 2, 0x222222);
        rect(g, 14, 13, 4, 3, lt);  // muzzle
        rect(g, 15, 13, 2, 1, 0x333333); // nose
        rect(g, 9, 20, 14, 8, c);   // body
        rect(g, 7, 22, 4, 6, d);    // arms
        rect(g, 21, 22, 4, 6, d);
        rect(g, 11, 27, 4, 3, d);   // legs
        rect(g, 17, 27, 4, 3, d);
    }

    static draw_phoenix_chick(g, c) {
        const flame = 0xFFDD00;
        const red = 0xFF2200;
        rect(g, 13, 2, 2, 3, red);  // crest
        rect(g, 11, 3, 2, 3, flame);
        rect(g, 17, 3, 2, 4, flame);
        rect(g, 15, 1, 2, 4, 0xFFFF44);
        rect(g, 10, 7, 12, 10, c);  // body
        rect(g, 12, 5, 8, 5, c);    // head
        rect(g, 14, 7, 2, 2, 0xFFFF00); // eyes
        rect(g, 15, 7, 1, 2, 0x000000);
        rect(g, 18, 7, 2, 2, 0xFFFF00);
        rect(g, 19, 7, 1, 2, 0x000000);
        rect(g, 9, 9, 2, 2, 0xEE4400); // beak
        rect(g, 7, 12, 4, 6, dark(c, 20)); // left wing
        rect(g, 21, 12, 4, 6, dark(c, 20));
        rect(g, 22, 14, 3, 2, flame); // wing tips glow
        rect(g, 7, 16, 3, 2, flame);
        rect(g, 12, 17, 3, 3, 0xDD5500); // legs
        rect(g, 17, 17, 3, 3, 0xDD5500);
        rect(g, 14, 15, 4, 2, bright(c, 50)); // belly glow
    }

    static drawGeneric(g, c) {
        rect(g, 10, 8, 12, 12, c);
        rect(g, 13, 10, 2, 2, 0x222222);
        rect(g, 18, 10, 2, 2, 0x222222);
        rect(g, 11, 20, 3, 4, dark(c, 30));
        rect(g, 18, 20, 3, 4, dark(c, 30));
    }

    static ui(scene) {
        tex(scene, 'icon_coin', 16, g => {
            g.fillStyle(0xFFD700);
            g.fillCircle(8, 8, 7);
            g.fillStyle(0xDAA520);
            g.fillCircle(8, 8, 5);
            g.fillStyle(0xFFD700);
            g.fillCircle(8, 8, 3);
        });

        tex(scene, 'particle_heart', 12, g => {
            g.fillStyle(0xFF4466);
            g.fillCircle(4, 4, 3);
            g.fillCircle(8, 4, 3);
            g.fillTriangle(1, 5, 11, 5, 6, 11);
        });

        tex(scene, 'particle_coin', 10, g => {
            g.fillStyle(0xFFD700);
            g.fillCircle(5, 5, 4);
            g.fillStyle(0xDAA520);
            g.fillCircle(5, 5, 2);
        });

        tex(scene, 'particle_star', 12, g => {
            g.fillStyle(0xFFFF44);
            g.fillRect(5, 0, 2, 12);
            g.fillRect(0, 5, 12, 2);
            g.fillRect(2, 2, 2, 2);
            g.fillRect(8, 2, 2, 2);
            g.fillRect(2, 8, 2, 2);
            g.fillRect(8, 8, 2, 2);
        });
    }

    static visitor(scene) {
        const colors = [0x5566AA, 0xAA5566, 0x55AA66, 0x8866AA];
        colors.forEach((c, i) => {
            tex(scene, `visitor_${i}`, TILE, g => {
                g.fillStyle(0xFFDDBB);
                g.fillCircle(16, 8, 4);    // head
                rect(g, 12, 12, 8, 10, c); // body
                rect(g, 10, 14, 3, 7, dark(c, 20)); // left arm
                rect(g, 19, 14, 3, 7, dark(c, 20)); // right arm
                rect(g, 12, 22, 3, 5, 0x445566); // left leg
                rect(g, 17, 22, 3, 5, 0x445566); // right leg
            });
        });
    }
}
