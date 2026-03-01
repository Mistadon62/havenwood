import { TILE, SPECIES, CLR, ENRICHMENTS } from './GameData.js';

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

function tex(scene, key, w, h, fn) {
    const g = scene.make.graphics({ add: false });
    fn(g);
    g.generateTexture(key, w, h);
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
        this.particles(scene);
        this.staff(scene);
        this.enrichments(scene);
    }

    static terrain(scene) {
        const grasses = [CLR.grass1, CLR.grass2, CLR.grass3, CLR.grass4];
        for (let i = 0; i < 4; i++) {
            tex(scene, `grass_${i + 1}`, TILE, TILE, g => {
                g.fillStyle(grasses[i]);
                g.fillRect(0, 0, TILE, TILE);
                g.fillStyle(bright(grasses[i], 18));
                const rng = new Phaser.Math.RandomDataGenerator([`g${i}`]);
                for (let j = 0; j < 5; j++) {
                    g.fillRect(rng.between(2, 28), rng.between(4, 28), 1, 2);
                }
            });
        }

        tex(scene, 'path', TILE, TILE, g => {
            g.fillStyle(CLR.path);
            g.fillRect(0, 0, TILE, TILE);
            g.fillStyle(dark(CLR.path, 15));
            const rng = new Phaser.Math.RandomDataGenerator(['p']);
            for (let j = 0; j < 3; j++) {
                g.fillRect(rng.between(4, 24), rng.between(4, 24), 3, 2);
            }
        });

        tex(scene, 'fence', TILE, TILE, g => {
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
            tex(scene, `animal_${id}`, TILE, TILE, g => {
                this['draw_' + id]?.(g, sp.color) ?? this.drawGeneric(g, sp.color);
            });
        });
    }

    static draw_cat(g, c) {
        const d = dark(c, 30);
        rect(g, 9, 5, 3, 4, c);
        rect(g, 20, 5, 3, 4, c);
        rect(g, 10, 4, 2, 2, d);
        rect(g, 21, 4, 2, 2, d);
        rect(g, 9, 9, 14, 10, c);
        rect(g, 13, 12, 2, 2, 0x44CC44);
        rect(g, 18, 12, 2, 2, 0x44CC44);
        rect(g, 14, 12, 1, 2, 0x111111);
        rect(g, 19, 12, 1, 2, 0x111111);
        rect(g, 15, 15, 2, 1, 0xFFAAAA);
        rect(g, 9, 19, 14, 7, c);
        rect(g, 23, 19, 2, 2, c);
        rect(g, 25, 17, 2, 2, c);
        rect(g, 27, 15, 2, 3, c);
        rect(g, 10, 26, 3, 4, d);
        rect(g, 19, 26, 3, 4, d);
    }

    static draw_dog(g, c) {
        const d = dark(c, 30);
        rect(g, 10, 6, 12, 10, c);
        rect(g, 7, 8, 4, 8, d);
        rect(g, 21, 8, 4, 8, d);
        rect(g, 13, 10, 2, 2, 0x222222);
        rect(g, 18, 10, 2, 2, 0x222222);
        rect(g, 14, 13, 4, 2, 0x333333);
        rect(g, 15, 15, 3, 2, 0xFF8899);
        rect(g, 9, 16, 14, 9, c);
        rect(g, 23, 14, 2, 3, c);
        rect(g, 25, 12, 2, 3, c);
        rect(g, 10, 25, 3, 4, d);
        rect(g, 19, 25, 3, 4, d);
    }

    static draw_rabbit(g, c) {
        const d = dark(c, 25);
        rect(g, 12, 1, 3, 10, c);
        rect(g, 18, 1, 3, 10, c);
        rect(g, 13, 2, 1, 8, 0xFFCCCC);
        rect(g, 19, 2, 1, 8, 0xFFCCCC);
        rect(g, 11, 10, 10, 8, c);
        rect(g, 13, 13, 2, 2, 0x222222);
        rect(g, 18, 13, 2, 2, 0x222222);
        rect(g, 15, 15, 2, 1, 0xFFAAAA);
        rect(g, 10, 18, 12, 8, c);
        g.fillStyle(0xFFFFFF);
        g.fillCircle(23, 21, 3);
        rect(g, 11, 26, 3, 3, d);
        rect(g, 18, 26, 3, 3, d);
    }

    static draw_fox(g, c) {
        const d = dark(c, 40);
        g.fillStyle(c);
        g.fillTriangle(10, 10, 13, 4, 16, 10);
        g.fillTriangle(22, 10, 19, 4, 16, 10);
        rect(g, 10, 10, 12, 8, c);
        rect(g, 8, 14, 5, 4, 0xFFE4C4);
        rect(g, 13, 12, 2, 2, 0xFFAA00);
        rect(g, 18, 12, 2, 2, 0xFFAA00);
        rect(g, 14, 12, 1, 2, 0x111111);
        rect(g, 19, 12, 1, 2, 0x111111);
        rect(g, 9, 18, 14, 8, c);
        rect(g, 13, 20, 6, 6, 0xFFE4C4);
        rect(g, 23, 17, 3, 3, c);
        rect(g, 25, 15, 3, 4, c);
        rect(g, 27, 16, 2, 2, 0xFFFFFF);
        rect(g, 10, 26, 3, 4, d);
        rect(g, 19, 26, 3, 4, d);
    }

    static draw_deer(g, c) {
        const d = dark(c, 30);
        const lt = bright(c, 40);
        rect(g, 9, 1, 2, 4, 0x8B7355);
        rect(g, 7, 1, 2, 2, 0x8B7355);
        rect(g, 21, 1, 2, 4, 0x8B7355);
        rect(g, 23, 1, 2, 2, 0x8B7355);
        rect(g, 10, 4, 12, 8, c);
        rect(g, 13, 7, 2, 2, 0x222222);
        rect(g, 18, 7, 2, 2, 0x222222);
        rect(g, 15, 10, 3, 1, 0x333333);
        rect(g, 12, 12, 8, 5, c);
        rect(g, 8, 14, 16, 9, c);
        rect(g, 12, 17, 2, 2, lt);
        rect(g, 17, 15, 2, 2, lt);
        rect(g, 20, 18, 2, 2, lt);
        rect(g, 9, 23, 2, 6, d);
        rect(g, 14, 23, 2, 6, d);
        rect(g, 18, 23, 2, 6, d);
        rect(g, 22, 23, 2, 5, d);
    }

    static draw_owl(g, c) {
        const d = dark(c, 25);
        rect(g, 7, 5, 4, 4, c);
        rect(g, 21, 5, 4, 4, c);
        rect(g, 9, 8, 14, 12, c);
        g.fillStyle(0xFFFFDD);
        g.fillCircle(13, 13, 4);
        g.fillCircle(19, 13, 4);
        g.fillStyle(0x000000);
        g.fillCircle(13, 13, 2);
        g.fillCircle(19, 13, 2);
        rect(g, 15, 16, 2, 2, 0xDDAA44);
        rect(g, 10, 20, 12, 6, d);
        rect(g, 7, 12, 3, 8, d);
        rect(g, 22, 12, 3, 8, d);
        rect(g, 12, 26, 3, 3, 0x666644);
        rect(g, 17, 26, 3, 3, 0x666644);
    }

    static draw_duck(g, c) {
        rect(g, 10, 8, 12, 10, c);
        rect(g, 12, 4, 8, 6, c);
        rect(g, 14, 6, 2, 2, 0x222222);
        rect(g, 7, 7, 5, 3, 0xEE8822);
        rect(g, 8, 12, 3, 4, dark(c, 20));
        rect(g, 20, 13, 3, 3, bright(c, 15));
        rect(g, 12, 18, 3, 3, 0xEE8822);
        rect(g, 17, 18, 3, 3, 0xEE8822);
        g.fillStyle(0x4A80B4);
        g.fillRect(4, 21, 24, 3);
    }

    static draw_turtle(g, c) {
        const d = dark(c, 30);
        const lt = bright(c, 35);
        rect(g, 10, 10, 14, 12, c);
        rect(g, 11, 11, 12, 10, lt);
        rect(g, 14, 12, 2, 3, d);
        rect(g, 18, 14, 2, 3, d);
        rect(g, 14, 17, 3, 2, d);
        rect(g, 5, 14, 6, 5, 0x7a8a4a);
        rect(g, 5, 16, 2, 2, 0x222222);
        rect(g, 10, 22, 3, 3, d);
        rect(g, 19, 22, 3, 3, d);
        rect(g, 24, 16, 3, 2, d);
    }

    static draw_bear_cub(g, c) {
        const d = dark(c, 25);
        const lt = bright(c, 30);
        g.fillStyle(c);
        g.fillCircle(11, 7, 4);
        g.fillCircle(21, 7, 4);
        g.fillStyle(d);
        g.fillCircle(11, 7, 2);
        g.fillCircle(21, 7, 2);
        rect(g, 8, 8, 16, 12, c);
        rect(g, 13, 10, 2, 2, 0x222222);
        rect(g, 18, 10, 2, 2, 0x222222);
        rect(g, 14, 13, 4, 3, lt);
        rect(g, 15, 13, 2, 1, 0x333333);
        rect(g, 9, 20, 14, 8, c);
        rect(g, 7, 22, 4, 6, d);
        rect(g, 21, 22, 4, 6, d);
        rect(g, 11, 27, 4, 3, d);
        rect(g, 17, 27, 4, 3, d);
    }

    static draw_phoenix_chick(g, c) {
        const flame = 0xFFDD00;
        const red = 0xFF2200;
        rect(g, 13, 2, 2, 3, red);
        rect(g, 11, 3, 2, 3, flame);
        rect(g, 17, 3, 2, 4, flame);
        rect(g, 15, 1, 2, 4, 0xFFFF44);
        rect(g, 10, 7, 12, 10, c);
        rect(g, 12, 5, 8, 5, c);
        rect(g, 14, 7, 2, 2, 0xFFFF00);
        rect(g, 15, 7, 1, 2, 0x000000);
        rect(g, 18, 7, 2, 2, 0xFFFF00);
        rect(g, 19, 7, 1, 2, 0x000000);
        rect(g, 9, 9, 2, 2, 0xEE4400);
        rect(g, 7, 12, 4, 6, dark(c, 20));
        rect(g, 21, 12, 4, 6, dark(c, 20));
        rect(g, 22, 14, 3, 2, flame);
        rect(g, 7, 16, 3, 2, flame);
        rect(g, 12, 17, 3, 3, 0xDD5500);
        rect(g, 17, 17, 3, 3, 0xDD5500);
        rect(g, 14, 15, 4, 2, bright(c, 50));
    }

    static draw_butterfly(g, c) {
        const lt = bright(c, 50);
        g.fillStyle(c);
        g.fillCircle(10, 10, 5);
        g.fillCircle(22, 10, 5);
        g.fillCircle(10, 18, 4);
        g.fillCircle(22, 18, 4);
        g.fillStyle(lt);
        g.fillCircle(10, 10, 3);
        g.fillCircle(22, 10, 3);
        rect(g, 15, 6, 2, 16, 0x333333);
        rect(g, 13, 4, 2, 2, 0x333333);
        rect(g, 17, 4, 2, 2, 0x333333);
        rect(g, 12, 2, 2, 3, 0x333333);
        rect(g, 18, 2, 2, 3, 0x333333);
        g.fillStyle(0xFFFFFF);
        g.fillCircle(10, 10, 1);
        g.fillCircle(22, 10, 1);
    }

    static draw_hedgehog(g, c) {
        const d = dark(c, 30);
        const spk = dark(c, 50);
        for (let i = 0; i < 7; i++) {
            const sx = 8 + i * 3;
            g.fillStyle(spk);
            g.fillTriangle(sx, 10, sx + 1, 3 + (i % 2) * 2, sx + 2, 10);
        }
        rect(g, 8, 10, 18, 12, c);
        rect(g, 4, 14, 6, 6, bright(c, 20));
        rect(g, 4, 16, 2, 2, 0x222222);
        rect(g, 3, 18, 2, 1, 0xFFAAAA);
        rect(g, 9, 22, 3, 3, d);
        rect(g, 16, 22, 3, 3, d);
        rect(g, 21, 22, 3, 3, d);
    }

    static draw_snowy_owl(g, c) {
        const d = dark(c, 15);
        rect(g, 7, 5, 4, 4, c);
        rect(g, 21, 5, 4, 4, c);
        rect(g, 9, 8, 14, 12, c);
        g.fillStyle(0xFFFF88);
        g.fillCircle(13, 13, 4);
        g.fillCircle(19, 13, 4);
        g.fillStyle(0x222222);
        g.fillCircle(13, 13, 2);
        g.fillCircle(19, 13, 2);
        rect(g, 15, 16, 2, 2, 0x444444);
        rect(g, 10, 20, 12, 6, d);
        rect(g, 11, 11, 2, 2, d);
        rect(g, 19, 11, 2, 2, d);
        rect(g, 13, 20, 2, 2, d);
        rect(g, 7, 12, 3, 8, d);
        rect(g, 22, 12, 3, 8, d);
        rect(g, 12, 26, 3, 3, 0x444444);
        rect(g, 17, 26, 3, 3, 0x444444);
    }

    static draw_arctic_fox(g, c) {
        const d = dark(c, 20);
        g.fillStyle(c);
        g.fillTriangle(10, 10, 13, 4, 16, 10);
        g.fillTriangle(22, 10, 19, 4, 16, 10);
        rect(g, 10, 10, 12, 8, c);
        rect(g, 8, 14, 5, 4, 0xFFFFFF);
        rect(g, 13, 12, 2, 2, 0x4488CC);
        rect(g, 18, 12, 2, 2, 0x4488CC);
        rect(g, 14, 12, 1, 2, 0x111111);
        rect(g, 19, 12, 1, 2, 0x111111);
        rect(g, 9, 18, 14, 8, c);
        rect(g, 13, 20, 6, 6, 0xFFFFFF);
        rect(g, 23, 17, 3, 3, c);
        rect(g, 25, 15, 4, 5, c);
        rect(g, 28, 16, 2, 2, 0xFFFFFF);
        rect(g, 10, 26, 3, 4, d);
        rect(g, 19, 26, 3, 4, d);
    }

    static drawGeneric(g, c) {
        rect(g, 10, 8, 12, 12, c);
        rect(g, 13, 10, 2, 2, 0x222222);
        rect(g, 18, 10, 2, 2, 0x222222);
        rect(g, 11, 20, 3, 4, dark(c, 30));
        rect(g, 18, 20, 3, 4, dark(c, 30));
    }

    static ui(scene) {
        tex(scene, 'icon_coin', 16, 16, g => {
            g.fillStyle(0xFFD700);
            g.fillCircle(8, 8, 7);
            g.fillStyle(0xDAA520);
            g.fillCircle(8, 8, 5);
            g.fillStyle(0xFFD700);
            g.fillCircle(8, 8, 3);
        });

        tex(scene, 'particle_heart', 12, 12, g => {
            g.fillStyle(0xFF4466);
            g.fillCircle(4, 4, 3);
            g.fillCircle(8, 4, 3);
            g.fillTriangle(1, 5, 11, 5, 6, 11);
        });

        tex(scene, 'particle_coin', 10, 10, g => {
            g.fillStyle(0xFFD700);
            g.fillCircle(5, 5, 4);
            g.fillStyle(0xDAA520);
            g.fillCircle(5, 5, 2);
        });

        tex(scene, 'particle_star', 12, 12, g => {
            g.fillStyle(0xFFFF44);
            g.fillRect(5, 0, 2, 12);
            g.fillRect(0, 5, 12, 2);
            g.fillRect(2, 2, 2, 2);
            g.fillRect(8, 2, 2, 2);
            g.fillRect(2, 8, 2, 2);
            g.fillRect(8, 8, 2, 2);
        });

        tex(scene, 'particle_zzz', 16, 12, g => {
            g.fillStyle(0xAAAAFF);
            g.fillRect(2, 0, 8, 2);
            g.fillRect(8, 2, 2, 2);
            g.fillRect(4, 4, 6, 2);
            g.fillRect(2, 6, 2, 2);
            g.fillRect(2, 8, 8, 2);
        });
    }

    static visitor(scene) {
        const colors = [0x5566AA, 0xAA5566, 0x55AA66, 0x8866AA];
        colors.forEach((c, i) => {
            tex(scene, `visitor_${i}`, TILE, TILE, g => {
                g.fillStyle(0xFFDDBB);
                g.fillCircle(16, 8, 4);
                rect(g, 12, 12, 8, 10, c);
                rect(g, 10, 14, 3, 7, dark(c, 20));
                rect(g, 19, 14, 3, 7, dark(c, 20));
                rect(g, 12, 22, 3, 5, 0x445566);
                rect(g, 17, 22, 3, 5, 0x445566);
            });
        });
    }

    static particles(scene) {
        tex(scene, 'particle_snow', 6, 6, g => {
            g.fillStyle(0xFFFFFF);
            g.fillCircle(3, 3, 2);
            g.fillStyle(0xDDEEFF);
            g.fillCircle(3, 3, 1);
        });

        tex(scene, 'particle_leaf', 8, 8, g => {
            g.fillStyle(0xCC6622);
            g.fillRect(1, 3, 6, 3);
            g.fillRect(3, 1, 3, 6);
            g.fillStyle(0xDD8833);
            g.fillRect(2, 3, 4, 2);
        });

        tex(scene, 'particle_petal', 6, 6, g => {
            g.fillStyle(0xFFAABB);
            g.fillCircle(3, 3, 3);
            g.fillStyle(0xFFCCDD);
            g.fillCircle(3, 2, 2);
        });

        tex(scene, 'particle_firefly', 6, 6, g => {
            g.fillStyle(0xFFFF44);
            g.fillCircle(3, 3, 2);
            g.fillStyle(0xFFFFAA);
            g.fillCircle(3, 3, 1);
        });
    }

    static enrichments(scene) {
        tex(scene, 'enrich_scratching_post', 16, 16, g => {
            rect(g, 6, 2, 4, 14, 0x8B6A3E);
            rect(g, 3, 0, 10, 3, 0xCBA05A);
            rect(g, 3, 14, 10, 2, 0x8B6A3E);
        });
        tex(scene, 'enrich_bird_bath', 16, 16, g => {
            rect(g, 7, 6, 2, 10, 0x999999);
            rect(g, 3, 14, 10, 2, 0x777777);
            rect(g, 2, 3, 12, 4, 0xAAAAAA);
            rect(g, 4, 4, 8, 2, 0x6699CC);
        });
        tex(scene, 'enrich_log_pile', 16, 16, g => {
            g.fillStyle(0x8B6A3E); g.fillCircle(4, 12, 3);
            g.fillStyle(0x7A5C30); g.fillCircle(10, 12, 3);
            g.fillStyle(0x9B7A4E); g.fillCircle(7, 8, 3);
            g.fillStyle(0x6B4E28); g.fillCircle(4, 12, 1);
            g.fillStyle(0x5A4020); g.fillCircle(10, 12, 1);
            g.fillStyle(0x7B6A3E); g.fillCircle(7, 8, 1);
        });
        tex(scene, 'enrich_rock_garden', 16, 16, g => {
            g.fillStyle(0x888888); g.fillCircle(4, 11, 3);
            g.fillStyle(0x999999); g.fillCircle(10, 10, 4);
            g.fillStyle(0x777777); g.fillCircle(7, 13, 2);
            g.fillStyle(0xAAAAAA); g.fillCircle(10, 9, 2);
        });
        tex(scene, 'enrich_toy_ball', 16, 16, g => {
            g.fillStyle(0xEE4444); g.fillCircle(8, 8, 5);
            g.fillStyle(0xFF8888); g.fillCircle(6, 6, 2);
            g.fillStyle(0xFFFF44);
            g.fillRect(6, 3, 4, 2);
        });
        tex(scene, 'enrich_cozy_bed', 16, 16, g => {
            rect(g, 1, 8, 14, 8, 0x885533);
            rect(g, 2, 9, 12, 6, 0xCC9966);
            rect(g, 0, 6, 4, 4, 0x885533);
            rect(g, 12, 6, 4, 4, 0x885533);
        });
        tex(scene, 'icon_sick', 12, 12, g => {
            g.fillStyle(0xFF3333);
            g.fillRect(4, 0, 4, 12);
            g.fillRect(0, 4, 12, 4);
        });
        tex(scene, 'icon_bond', 10, 10, g => {
            g.fillStyle(0x66BBFF);
            g.fillCircle(3, 3, 2);
            g.fillCircle(7, 3, 2);
            g.fillTriangle(1, 4, 9, 4, 5, 9);
        });
        tex(scene, 'icon_baby', 10, 10, g => {
            g.fillStyle(0xFFCC66);
            g.fillCircle(5, 5, 4);
            g.fillStyle(0xFFEE99);
            g.fillCircle(5, 5, 2);
        });
        tex(scene, 'icon_pregnant', 10, 10, g => {
            g.fillStyle(0xFF88CC);
            g.fillCircle(5, 5, 4);
            g.fillStyle(0xFFAADD);
            g.fillCircle(5, 4, 2);
        });
        tex(scene, 'icon_research', 16, 16, g => {
            g.fillStyle(0x44DDAA);
            g.fillRect(6, 2, 4, 8);
            g.fillRect(2, 4, 12, 4);
            g.fillStyle(0x33BB88);
            g.fillCircle(8, 12, 3);
            g.fillRect(7, 9, 2, 3);
        });
    }

    static staff(scene) {
        const types = {
            volunteer: 0x55AA55,
            caretaker: 0x5566AA,
            vet: 0xAA5555,
            guide: 0xAA8855
        };
        Object.entries(types).forEach(([id, c]) => {
            tex(scene, `staff_${id}`, TILE, TILE, g => {
                g.fillStyle(0xFFDDBB);
                g.fillCircle(16, 7, 4);
                rect(g, 12, 11, 8, 11, c);
                rect(g, 10, 13, 3, 7, dark(c, 20));
                rect(g, 19, 13, 3, 7, dark(c, 20));
                rect(g, 12, 22, 3, 5, 0x445566);
                rect(g, 17, 22, 3, 5, 0x445566);
                if (id === 'vet') {
                    rect(g, 14, 13, 4, 2, 0xFFFFFF);
                    rect(g, 15, 12, 2, 4, 0xFF4444);
                }
                if (id === 'guide') {
                    rect(g, 11, 3, 10, 3, c);
                    rect(g, 12, 2, 8, 2, c);
                }
            });
        });
    }
}
