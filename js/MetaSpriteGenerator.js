// MetaSpriteGenerator.js — Havenwood meta-world
// Generates textures for the real-world layer: character (4-dir + phone-holding),
// room tiles (floor, walls, grass, stone), furniture, NPCs, and weather particles.
// Follows the same procedural pattern as SpriteGenerator.js.

import { TILE } from './GameData.js';

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

export class MetaSpriteGenerator {
    static generate(scene) {
        this.phone(scene);
        this.character(scene);
        this.room(scene);
        this.outdoor(scene);
        this.furniture(scene);
        this.pingpong(scene);
        this.npcs(scene);
    }

    // Phone bezel — drawn large enough to frame a scaled-down game screen.
    // The actual phone object in the transition is built from a container;
    // this texture is just the bezel overlay (transparent center).
    static phone(scene) {
        // Phone icon for HUD toolbar button (small, 16x16)
        tex(scene, 'icon_phone', 16, 16, g => {
            // Body
            g.fillStyle(0x333344);
            g.fillRoundedRect(3, 1, 10, 14, 2);
            // Screen
            g.fillStyle(0x6688AA);
            g.fillRect(5, 3, 6, 8);
            // Home button
            g.fillStyle(0x444455);
            g.fillCircle(8, 13, 1);
        });
    }

    // Character sprites — 4 directions (down, up, left, right), top-down pixel art.
    // Each is TILE x TILE (32x32).
    static character(scene) {
        const bodyColor = 0x4466AA;
        const skinColor = 0xFFDDBB;
        const hairColor = 0x553322;
        const pantColor = 0x445566;

        // Down (facing camera)
        tex(scene, 'char_down', TILE, TILE, g => {
            // Hair
            rect(g, 12, 3, 8, 4, hairColor);
            // Head
            rect(g, 12, 5, 8, 7, skinColor);
            // Eyes
            rect(g, 14, 8, 2, 2, 0x222222);
            rect(g, 18, 8, 2, 2, 0x222222);
            // Torso
            rect(g, 10, 12, 12, 10, bodyColor);
            // Arms
            rect(g, 8, 14, 3, 7, dark(bodyColor, 20));
            rect(g, 21, 14, 3, 7, dark(bodyColor, 20));
            // Legs
            rect(g, 11, 22, 4, 6, pantColor);
            rect(g, 17, 22, 4, 6, pantColor);
            // Shoes
            rect(g, 11, 27, 4, 3, 0x333333);
            rect(g, 17, 27, 4, 3, 0x333333);
        });

        // Up (facing away)
        tex(scene, 'char_up', TILE, TILE, g => {
            rect(g, 12, 3, 8, 9, hairColor);
            rect(g, 10, 12, 12, 10, bodyColor);
            rect(g, 8, 14, 3, 7, dark(bodyColor, 20));
            rect(g, 21, 14, 3, 7, dark(bodyColor, 20));
            rect(g, 11, 22, 4, 6, pantColor);
            rect(g, 17, 22, 4, 6, pantColor);
            rect(g, 11, 27, 4, 3, 0x333333);
            rect(g, 17, 27, 4, 3, 0x333333);
        });

        // Left
        tex(scene, 'char_left', TILE, TILE, g => {
            rect(g, 12, 3, 6, 4, hairColor);
            rect(g, 12, 5, 6, 7, skinColor);
            rect(g, 12, 8, 2, 2, 0x222222);
            rect(g, 10, 12, 10, 10, bodyColor);
            rect(g, 8, 14, 3, 7, dark(bodyColor, 20));
            rect(g, 12, 22, 4, 6, pantColor);
            rect(g, 17, 22, 4, 6, pantColor);
            rect(g, 12, 27, 4, 3, 0x333333);
            rect(g, 17, 27, 4, 3, 0x333333);
        });

        // Right
        tex(scene, 'char_right', TILE, TILE, g => {
            rect(g, 14, 3, 6, 4, hairColor);
            rect(g, 14, 5, 6, 7, skinColor);
            rect(g, 18, 8, 2, 2, 0x222222);
            rect(g, 12, 12, 10, 10, bodyColor);
            rect(g, 21, 14, 3, 7, dark(bodyColor, 20));
            rect(g, 11, 22, 4, 6, pantColor);
            rect(g, 16, 22, 4, 6, pantColor);
            rect(g, 11, 27, 4, 3, 0x333333);
            rect(g, 16, 27, 4, 3, 0x333333);
        });

        // Walk frames (slight leg offset) — down
        tex(scene, 'char_down_walk1', TILE, TILE, g => {
            rect(g, 12, 3, 8, 4, hairColor);
            rect(g, 12, 5, 8, 7, skinColor);
            rect(g, 14, 8, 2, 2, 0x222222);
            rect(g, 18, 8, 2, 2, 0x222222);
            rect(g, 10, 12, 12, 10, bodyColor);
            rect(g, 8, 14, 3, 7, dark(bodyColor, 20));
            rect(g, 21, 14, 3, 7, dark(bodyColor, 20));
            rect(g, 10, 22, 4, 6, pantColor);
            rect(g, 18, 22, 4, 6, pantColor);
            rect(g, 10, 27, 4, 3, 0x333333);
            rect(g, 18, 27, 4, 3, 0x333333);
        });
        tex(scene, 'char_down_walk2', TILE, TILE, g => {
            rect(g, 12, 3, 8, 4, hairColor);
            rect(g, 12, 5, 8, 7, skinColor);
            rect(g, 14, 8, 2, 2, 0x222222);
            rect(g, 18, 8, 2, 2, 0x222222);
            rect(g, 10, 12, 12, 10, bodyColor);
            rect(g, 8, 14, 3, 7, dark(bodyColor, 20));
            rect(g, 21, 14, 3, 7, dark(bodyColor, 20));
            rect(g, 12, 22, 4, 6, pantColor);
            rect(g, 16, 22, 4, 6, pantColor);
            rect(g, 12, 27, 4, 3, 0x333333);
            rect(g, 16, 27, 4, 3, 0x333333);
        });

        // Walk frames — up
        tex(scene, 'char_up_walk1', TILE, TILE, g => {
            rect(g, 12, 3, 8, 9, hairColor);
            rect(g, 10, 12, 12, 10, bodyColor);
            rect(g, 8, 14, 3, 7, dark(bodyColor, 20));
            rect(g, 21, 14, 3, 7, dark(bodyColor, 20));
            rect(g, 10, 22, 4, 6, pantColor);
            rect(g, 18, 22, 4, 6, pantColor);
            rect(g, 10, 27, 4, 3, 0x333333);
            rect(g, 18, 27, 4, 3, 0x333333);
        });
        tex(scene, 'char_up_walk2', TILE, TILE, g => {
            rect(g, 12, 3, 8, 9, hairColor);
            rect(g, 10, 12, 12, 10, bodyColor);
            rect(g, 8, 14, 3, 7, dark(bodyColor, 20));
            rect(g, 21, 14, 3, 7, dark(bodyColor, 20));
            rect(g, 12, 22, 4, 6, pantColor);
            rect(g, 16, 22, 4, 6, pantColor);
            rect(g, 12, 27, 4, 3, 0x333333);
            rect(g, 16, 27, 4, 3, 0x333333);
        });

        // Walk frames — left
        tex(scene, 'char_left_walk1', TILE, TILE, g => {
            rect(g, 12, 3, 6, 4, hairColor);
            rect(g, 12, 5, 6, 7, skinColor);
            rect(g, 12, 8, 2, 2, 0x222222);
            rect(g, 10, 12, 10, 10, bodyColor);
            rect(g, 8, 14, 3, 7, dark(bodyColor, 20));
            rect(g, 11, 22, 4, 6, pantColor);
            rect(g, 17, 22, 4, 7, pantColor);
            rect(g, 11, 27, 4, 3, 0x333333);
            rect(g, 17, 28, 4, 3, 0x333333);
        });
        tex(scene, 'char_left_walk2', TILE, TILE, g => {
            rect(g, 12, 3, 6, 4, hairColor);
            rect(g, 12, 5, 6, 7, skinColor);
            rect(g, 12, 8, 2, 2, 0x222222);
            rect(g, 10, 12, 10, 10, bodyColor);
            rect(g, 8, 14, 3, 7, dark(bodyColor, 20));
            rect(g, 13, 22, 4, 7, pantColor);
            rect(g, 17, 22, 4, 6, pantColor);
            rect(g, 13, 28, 4, 3, 0x333333);
            rect(g, 17, 27, 4, 3, 0x333333);
        });

        // Walk frames — right
        tex(scene, 'char_right_walk1', TILE, TILE, g => {
            rect(g, 14, 3, 6, 4, hairColor);
            rect(g, 14, 5, 6, 7, skinColor);
            rect(g, 18, 8, 2, 2, 0x222222);
            rect(g, 12, 12, 10, 10, bodyColor);
            rect(g, 21, 14, 3, 7, dark(bodyColor, 20));
            rect(g, 11, 22, 4, 7, pantColor);
            rect(g, 17, 22, 4, 6, pantColor);
            rect(g, 11, 28, 4, 3, 0x333333);
            rect(g, 17, 27, 4, 3, 0x333333);
        });
        tex(scene, 'char_right_walk2', TILE, TILE, g => {
            rect(g, 14, 3, 6, 4, hairColor);
            rect(g, 14, 5, 6, 7, skinColor);
            rect(g, 18, 8, 2, 2, 0x222222);
            rect(g, 12, 12, 10, 10, bodyColor);
            rect(g, 21, 14, 3, 7, dark(bodyColor, 20));
            rect(g, 11, 22, 4, 6, pantColor);
            rect(g, 17, 22, 4, 7, pantColor);
            rect(g, 11, 27, 4, 3, 0x333333);
            rect(g, 17, 28, 4, 3, 0x333333);
        });
        // Character holding phone — facing down, arms brought forward holding a small phone
        tex(scene, 'char_phone', TILE, TILE, g => {
            // Hair
            rect(g, 12, 3, 8, 4, hairColor);
            // Head (tilted down slightly — looking at phone)
            rect(g, 12, 6, 8, 7, skinColor);
            // Eyes looking down
            rect(g, 14, 10, 2, 1, 0x222222);
            rect(g, 18, 10, 2, 1, 0x222222);
            // Torso
            rect(g, 10, 13, 12, 9, bodyColor);
            // Arms brought forward (holding phone)
            rect(g, 10, 15, 3, 5, dark(bodyColor, 20));
            rect(g, 19, 15, 3, 5, dark(bodyColor, 20));
            // Hands
            rect(g, 12, 18, 2, 3, skinColor);
            rect(g, 18, 18, 2, 3, skinColor);
            // Phone in hands
            rect(g, 13, 17, 6, 5, 0x222233);
            rect(g, 14, 18, 4, 3, 0x3a5a3a); // screen glow
            // Legs
            rect(g, 11, 22, 4, 6, pantColor);
            rect(g, 17, 22, 4, 6, pantColor);
            // Shoes
            rect(g, 11, 27, 4, 3, 0x333333);
            rect(g, 17, 27, 4, 3, 0x333333);
        });
    }

    // Room tiles — wood floor, walls, carpet.
    static room(scene) {
        const woodBase = 0x8B6B4A;

        tex(scene, 'floor_wood', TILE, TILE, g => {
            g.fillStyle(woodBase);
            g.fillRect(0, 0, TILE, TILE);
            // Plank lines
            g.fillStyle(dark(woodBase, 15));
            g.fillRect(0, 7, TILE, 1);
            g.fillRect(0, 15, TILE, 1);
            g.fillRect(0, 23, TILE, 1);
            // Grain variation
            g.fillStyle(bright(woodBase, 10));
            const rng = new Phaser.Math.RandomDataGenerator(['fw']);
            for (let j = 0; j < 4; j++) {
                g.fillRect(rng.between(2, 28), rng.between(2, 28), 3, 1);
            }
        });

        tex(scene, 'floor_carpet', TILE, TILE, g => {
            g.fillStyle(0x664455);
            g.fillRect(0, 0, TILE, TILE);
            g.fillStyle(0x775566);
            const rng = new Phaser.Math.RandomDataGenerator(['fc']);
            for (let j = 0; j < 6; j++) {
                g.fillRect(rng.between(0, 28), rng.between(0, 28), 3, 2);
            }
        });

        tex(scene, 'wall', TILE, TILE, g => {
            g.fillStyle(0x556677);
            g.fillRect(0, 0, TILE, TILE);
            // Baseboard
            g.fillStyle(0x445566);
            g.fillRect(0, TILE - 4, TILE, 4);
            // Subtle texture
            g.fillStyle(0x5A6B7C);
            const rng = new Phaser.Math.RandomDataGenerator(['wl']);
            for (let j = 0; j < 3; j++) {
                g.fillRect(rng.between(2, 26), rng.between(2, 22), 4, 2);
            }
        });

        tex(scene, 'wall_window', TILE, TILE, g => {
            g.fillStyle(0x556677);
            g.fillRect(0, 0, TILE, TILE);
            // Window frame
            g.fillStyle(0x8B7355);
            g.fillRect(4, 4, 24, 20);
            // Glass
            g.fillStyle(0x88AACC);
            g.fillRect(6, 6, 20, 16);
            // Cross bar
            g.fillStyle(0x8B7355);
            g.fillRect(15, 6, 2, 16);
            g.fillRect(6, 13, 20, 2);
            // Light reflection
            g.fillStyle(0xAADDFF);
            g.fillRect(8, 8, 6, 4);
            // Baseboard
            g.fillStyle(0x445566);
            g.fillRect(0, TILE - 4, TILE, 4);
        });
    }

    // Furniture — desk, chair, bed, bookshelf, lamp, rug.
    static furniture(scene) {
        // Desk (2 tiles wide, 1 tile tall — drawn as 64x32)
        tex(scene, 'furniture_desk', 64, TILE, g => {
            // Desktop surface
            g.fillStyle(0x7A5C3A);
            g.fillRect(2, 8, 60, 16);
            // Front panel
            g.fillStyle(0x6B4E2E);
            g.fillRect(2, 14, 60, 14);
            // Legs
            g.fillStyle(0x5A4228);
            g.fillRect(4, 26, 4, 6);
            g.fillRect(56, 26, 4, 6);
            // Desktop highlight
            g.fillStyle(0x8A6C4A);
            g.fillRect(4, 8, 56, 3);
            // Drawer handles
            g.fillStyle(0xAA9060);
            g.fillRect(18, 20, 4, 2);
            g.fillRect(42, 20, 4, 2);
        });

        // Chair (single tile)
        tex(scene, 'furniture_chair', TILE, TILE, g => {
            // Seat
            g.fillStyle(0x885533);
            g.fillRect(8, 16, 16, 10);
            // Back
            g.fillStyle(0x7A4828);
            g.fillRect(10, 6, 12, 12);
            g.fillStyle(0x885533);
            g.fillRect(12, 8, 8, 8);
            // Legs
            g.fillStyle(0x6B3A1F);
            g.fillRect(8, 26, 3, 4);
            g.fillRect(21, 26, 3, 4);
        });

        // Bed (2 tiles wide, 3 tiles tall — drawn as 64x96)
        tex(scene, 'furniture_bed', 64, 96, g => {
            // Frame
            g.fillStyle(0x6B4E2E);
            g.fillRect(4, 4, 56, 88);
            // Mattress
            g.fillStyle(0xCCBBAA);
            g.fillRect(8, 8, 48, 80);
            // Blanket
            g.fillStyle(0x4466AA);
            g.fillRect(8, 30, 48, 54);
            g.fillStyle(0x3355AA);
            g.fillRect(10, 32, 44, 4);
            // Pillow
            g.fillStyle(0xEEDDCC);
            g.fillRect(12, 12, 18, 14);
            g.fillRect(34, 12, 18, 14);
            g.fillStyle(0xFFEEDD);
            g.fillRect(14, 14, 14, 10);
            g.fillRect(36, 14, 14, 10);
            // Headboard
            g.fillStyle(0x5A4020);
            g.fillRect(2, 0, 60, 8);
            g.fillStyle(0x6B5030);
            g.fillRect(4, 2, 56, 4);
        });

        // Bookshelf (single tile)
        tex(scene, 'furniture_bookshelf', TILE, TILE, g => {
            // Frame
            g.fillStyle(0x6B4E2E);
            g.fillRect(4, 2, 24, 28);
            // Shelves
            g.fillStyle(0x7A5C3A);
            g.fillRect(4, 2, 24, 3);
            g.fillRect(4, 10, 24, 2);
            g.fillRect(4, 18, 24, 2);
            g.fillRect(4, 27, 24, 3);
            // Books (top shelf)
            g.fillStyle(0xCC4444); g.fillRect(6, 5, 3, 5);
            g.fillStyle(0x44AA44); g.fillRect(10, 5, 3, 5);
            g.fillStyle(0x4488CC); g.fillRect(14, 5, 4, 5);
            g.fillStyle(0xCCAA33); g.fillRect(19, 5, 3, 5);
            g.fillStyle(0x8866AA); g.fillRect(23, 5, 3, 5);
            // Books (middle shelf)
            g.fillStyle(0xDD6622); g.fillRect(6, 13, 4, 5);
            g.fillStyle(0x3366BB); g.fillRect(11, 13, 3, 5);
            g.fillStyle(0xAA3355); g.fillRect(15, 13, 3, 5);
            g.fillStyle(0x55AA55); g.fillRect(19, 13, 4, 5);
            // Books (bottom shelf)
            g.fillStyle(0x885533); g.fillRect(6, 21, 5, 6);
            g.fillStyle(0x555555); g.fillRect(12, 21, 3, 6);
            g.fillStyle(0xCC8844); g.fillRect(16, 21, 4, 6);
            g.fillStyle(0x336699); g.fillRect(21, 21, 4, 6);
        });

        // Lamp (single tile)
        tex(scene, 'furniture_lamp', TILE, TILE, g => {
            // Base
            g.fillStyle(0x555555);
            g.fillRect(12, 26, 8, 4);
            // Pole
            g.fillStyle(0x666666);
            g.fillRect(15, 12, 2, 14);
            // Shade
            g.fillStyle(0xDDCC88);
            g.fillRect(9, 6, 14, 8);
            g.fillStyle(0xEEDD99);
            g.fillRect(11, 8, 10, 4);
            // Bulb glow
            g.fillStyle(0xFFFF88);
            g.fillRect(14, 12, 4, 2);
        });

        // Rug (3x2 tiles — drawn as 96x64)
        tex(scene, 'furniture_rug', 96, 64, g => {
            // Outer border
            g.fillStyle(0x884455);
            g.fillRoundedRect(2, 2, 92, 60, 4);
            // Inner
            g.fillStyle(0x996666);
            g.fillRoundedRect(8, 8, 80, 48, 3);
            // Pattern
            g.fillStyle(0xAA7777);
            g.fillRoundedRect(14, 14, 68, 36, 2);
            // Center diamond
            g.fillStyle(0xBB8877);
            const cx = 48, cy = 32;
            g.fillTriangle(cx, cy - 12, cx - 16, cy, cx + 16, cy);
            g.fillTriangle(cx, cy + 12, cx - 16, cy, cx + 16, cy);
        });

        // Nightstand (single tile)
        tex(scene, 'furniture_nightstand', TILE, TILE, g => {
            g.fillStyle(0x6B4E2E);
            g.fillRect(8, 12, 16, 16);
            g.fillStyle(0x7A5C3A);
            g.fillRect(8, 12, 16, 3);
            // Drawer
            g.fillStyle(0x5A4020);
            g.fillRect(10, 18, 12, 6);
            g.fillStyle(0xAA9060);
            g.fillRect(15, 20, 2, 2);
            // Legs
            g.fillStyle(0x5A4020);
            g.fillRect(9, 28, 2, 2);
            g.fillRect(21, 28, 2, 2);
        });

        // Phone on desk — small phone lying flat (top-down view)
        tex(scene, 'furniture_phone', 12, 20, g => {
            g.fillStyle(0x222233);
            g.fillRoundedRect(0, 0, 12, 20, 2);
            g.fillStyle(0x3a5a3a);
            g.fillRect(2, 3, 8, 13);
            g.fillStyle(0x333344);
            g.fillCircle(6, 18, 1);
        });

        // Bench (2 tiles wide, 1 tile tall — outdoor seating)
        tex(scene, 'furniture_bench', 64, TILE, g => {
            // Seat
            g.fillStyle(0x7A5C3A);
            g.fillRect(4, 12, 56, 8);
            // Back
            g.fillStyle(0x6B4E2E);
            g.fillRect(6, 6, 52, 8);
            g.fillStyle(0x7A5C3A);
            g.fillRect(8, 7, 48, 6);
            // Legs
            g.fillStyle(0x444444);
            g.fillRect(8, 20, 3, 8);
            g.fillRect(53, 20, 3, 8);
            g.fillRect(28, 20, 3, 8);
        });

        // Counter (2 tiles wide — for shops/café)
        tex(scene, 'furniture_counter', 64, TILE, g => {
            g.fillStyle(0x8B7355);
            g.fillRect(2, 8, 60, 6);
            g.fillStyle(0x9B8365);
            g.fillRect(4, 8, 56, 3);
            g.fillStyle(0x6B5335);
            g.fillRect(2, 14, 60, 14);
            g.fillStyle(0x5A4228);
            g.fillRect(4, 26, 4, 4);
            g.fillRect(56, 26, 4, 4);
        });

        // Cash register (single tile)
        tex(scene, 'furniture_register', TILE, TILE, g => {
            g.fillStyle(0x666666);
            g.fillRect(8, 12, 16, 12);
            g.fillStyle(0x44AA44);
            g.fillRect(10, 8, 12, 6);
            g.fillStyle(0x888888);
            for (let r = 0; r < 2; r++) {
                for (let c = 0; c < 3; c++) {
                    g.fillRect(10 + c * 4, 16 + r * 4, 3, 2);
                }
            }
            g.fillStyle(0x555555);
            g.fillRect(6, 24, 20, 4);
        });

        // Café table (single tile, round top-down)
        tex(scene, 'furniture_table_cafe', TILE, TILE, g => {
            g.fillStyle(0x7A5C3A);
            g.fillCircle(16, 16, 10);
            g.fillStyle(0x8A6C4A);
            g.fillCircle(14, 14, 4);
            g.fillStyle(0x5A4020);
            g.fillRect(14, 14, 4, 4);
        });

        // Stool (single tile, walkable seating)
        tex(scene, 'furniture_stool', TILE, TILE, g => {
            g.fillStyle(0x885533);
            g.fillCircle(16, 16, 6);
            g.fillStyle(0x996644);
            g.fillCircle(15, 15, 3);
            g.fillStyle(0x555555);
            g.fillRect(10, 20, 2, 4);
            g.fillRect(20, 20, 2, 4);
            g.fillRect(10, 10, 2, 4);
            g.fillRect(20, 10, 2, 4);
        });

        // Store shelf (single tile — products on shelves)
        tex(scene, 'furniture_shelf_store', TILE, TILE, g => {
            g.fillStyle(0x6B4E2E);
            g.fillRect(4, 2, 24, 28);
            g.fillStyle(0x7A5C3A);
            g.fillRect(4, 2, 24, 3);
            g.fillRect(4, 10, 24, 2);
            g.fillRect(4, 18, 24, 2);
            g.fillRect(4, 27, 24, 3);
            g.fillStyle(0xDD6644); g.fillRect(6, 5, 4, 5);
            g.fillStyle(0x44AADD); g.fillRect(11, 5, 4, 5);
            g.fillStyle(0xDDAA44); g.fillRect(16, 5, 4, 5);
            g.fillStyle(0x44DD66); g.fillRect(21, 5, 4, 5);
            g.fillStyle(0xAA8855); g.fillRect(7, 13, 5, 5);
            g.fillStyle(0x8855AA); g.fillRect(14, 13, 5, 5);
            g.fillStyle(0x55AA88); g.fillRect(21, 13, 4, 5);
            g.fillStyle(0xBB9966); g.fillRect(6, 21, 6, 6);
            g.fillStyle(0x6699BB); g.fillRect(14, 21, 6, 6);
            g.fillStyle(0x99BB66); g.fillRect(22, 21, 4, 6);
        });

        // Chalkboard (2 tiles wide, 1 tile tall — classroom)
        tex(scene, 'furniture_chalkboard', 64, TILE, g => {
            // Frame
            g.fillStyle(0x5A4020);
            g.fillRect(2, 2, 60, 28);
            // Board surface (dark green)
            g.fillStyle(0x2A4A2A);
            g.fillRect(5, 4, 54, 24);
            // Chalk writing
            g.fillStyle(0xCCCCBB);
            g.fillRect(10, 8, 20, 2);
            g.fillRect(10, 14, 28, 2);
            g.fillRect(10, 20, 16, 2);
            g.fillStyle(0xAAAA99);
            g.fillRect(38, 8, 12, 2);
            // Chalk tray
            g.fillStyle(0x6B4E2E);
            g.fillRect(8, 27, 48, 3);
            // Chalk pieces
            g.fillStyle(0xEEEEDD);
            g.fillRect(14, 27, 6, 2);
            g.fillStyle(0xFFCC66);
            g.fillRect(24, 27, 4, 2);
        });

        // Podium (single tile)
        tex(scene, 'furniture_podium', TILE, TILE, g => {
            // Top surface
            g.fillStyle(0x7A5C3A);
            g.fillRect(8, 6, 16, 4);
            // Front panel
            g.fillStyle(0x6B4E2E);
            g.fillRect(9, 10, 14, 14);
            // Side shading
            g.fillStyle(0x5A4020);
            g.fillRect(9, 10, 2, 14);
            g.fillRect(21, 10, 2, 14);
            // Legs
            g.fillStyle(0x5A4020);
            g.fillRect(10, 24, 3, 6);
            g.fillRect(19, 24, 3, 6);
            // Book/paper on top
            g.fillStyle(0xEEEEDD);
            g.fillRect(11, 7, 10, 2);
        });

        // Tree (single tile — top-down view)
        tex(scene, 'furniture_tree', TILE, TILE, g => {
            // Trunk
            g.fillStyle(0x6B4E2E);
            g.fillRect(13, 13, 6, 8);
            // Canopy layers (top-down circular)
            g.fillStyle(0x2A6B2A);
            g.fillCircle(16, 14, 12);
            g.fillStyle(0x3A8B3A);
            g.fillCircle(15, 13, 9);
            g.fillStyle(0x4A9B4A);
            g.fillCircle(16, 12, 6);
            // Highlight
            g.fillStyle(0x5AAB5A);
            g.fillCircle(13, 10, 3);
        });

        // Pond (2x2 tiles — top-down water body)
        tex(scene, 'furniture_pond', 64, 64, g => {
            // Water body (irregular oval)
            g.fillStyle(0x3366AA);
            g.fillCircle(32, 32, 26);
            // Lighter inner water
            g.fillStyle(0x4488CC);
            g.fillCircle(30, 30, 20);
            // Ripple highlights
            g.fillStyle(0x66AADD);
            g.fillCircle(26, 28, 8);
            g.fillStyle(0x77BBEE);
            g.fillCircle(24, 26, 4);
            // Edge detail (reeds)
            g.fillStyle(0x3A7B3A);
            g.fillRect(6, 26, 3, 6);
            g.fillRect(8, 24, 2, 4);
            g.fillRect(50, 34, 3, 6);
            g.fillRect(52, 32, 2, 4);
        });

        // Flower (single tile — small colorful plant)
        tex(scene, 'furniture_flower', TILE, TILE, g => {
            // Stem
            g.fillStyle(0x3A7B3A);
            g.fillRect(15, 16, 2, 10);
            // Leaves
            g.fillStyle(0x4A9B4A);
            g.fillRect(12, 20, 4, 2);
            g.fillRect(16, 18, 4, 2);
            // Petals
            g.fillStyle(0xDD6688);
            g.fillCircle(16, 13, 4);
            g.fillStyle(0xFF88AA);
            g.fillCircle(14, 12, 3);
            g.fillCircle(18, 12, 3);
            g.fillCircle(16, 10, 3);
            // Center
            g.fillStyle(0xFFDD44);
            g.fillCircle(16, 12, 2);
        });

        // Vending Machine (single tile)
        tex(scene, 'furniture_vending_machine', TILE, TILE, g => {
            // Body
            g.fillStyle(0x445566);
            g.fillRect(6, 2, 20, 28);
            // Front panel (lighter)
            g.fillStyle(0x556677);
            g.fillRect(8, 4, 16, 18);
            // Display window
            g.fillStyle(0x88CCEE);
            g.fillRect(10, 5, 12, 8);
            // Product rows
            g.fillStyle(0xDD4444);
            g.fillRect(11, 6, 3, 3);
            g.fillStyle(0x44DD44);
            g.fillRect(15, 6, 3, 3);
            g.fillStyle(0x4488DD);
            g.fillRect(19, 6, 3, 3);
            g.fillStyle(0xDDAA44);
            g.fillRect(11, 10, 3, 2);
            g.fillStyle(0xDD66AA);
            g.fillRect(15, 10, 3, 2);
            // Buttons
            g.fillStyle(0x888888);
            g.fillRect(10, 15, 4, 3);
            g.fillRect(16, 15, 4, 3);
            // Dispenser slot
            g.fillStyle(0x333344);
            g.fillRect(10, 20, 12, 4);
            // Coin slot
            g.fillStyle(0xAA9060);
            g.fillRect(22, 14, 2, 4);
        });

        // Couch (2 tiles wide, 1 tile tall)
        tex(scene, 'furniture_couch', 64, TILE, g => {
            // Back rest
            g.fillStyle(0x6B4455);
            g.fillRect(4, 4, 56, 10);
            // Seat cushions
            g.fillStyle(0x885566);
            g.fillRect(4, 12, 56, 12);
            // Cushion divider
            g.fillStyle(0x7A4E5A);
            g.fillRect(31, 12, 2, 12);
            // Arm rests
            g.fillStyle(0x5A3344);
            g.fillRect(2, 6, 4, 20);
            g.fillRect(58, 6, 4, 20);
            // Highlights
            g.fillStyle(0x996677);
            g.fillRect(8, 14, 20, 4);
            g.fillRect(36, 14, 20, 4);
        });

        // TV (single tile — wall-mounted flat screen)
        tex(scene, 'furniture_tv', TILE, TILE, g => {
            // Bezel
            g.fillStyle(0x222233);
            g.fillRect(4, 6, 24, 16);
            // Screen
            g.fillStyle(0x4466AA);
            g.fillRect(6, 8, 20, 12);
            // Screen content (simple gradient)
            g.fillStyle(0x5588CC);
            g.fillRect(8, 10, 16, 4);
            g.fillStyle(0x3355AA);
            g.fillRect(8, 14, 16, 4);
            // Stand
            g.fillStyle(0x333344);
            g.fillRect(14, 22, 4, 4);
            g.fillRect(10, 26, 12, 2);
            // Power LED
            g.fillStyle(0x44DD44);
            g.fillRect(15, 20, 2, 1);
        });

        // Gift item icons (small 16x16 for inventory display)
        tex(scene, 'item_coffee', 16, 16, g => {
            g.fillStyle(0x8B6B4A); g.fillRect(4, 4, 8, 10);
            g.fillStyle(0xFFFFFF); g.fillRect(4, 4, 8, 2);
            g.fillStyle(0x6B4E2E); g.fillRect(12, 6, 2, 4);
            g.fillStyle(0xCCCCCC); g.fillRect(6, 2, 4, 3); // steam
        });
        tex(scene, 'item_book', 16, 16, g => {
            g.fillStyle(0xCC4444); g.fillRect(4, 3, 8, 10);
            g.fillStyle(0xEEEEDD); g.fillRect(5, 4, 6, 8);
            g.fillStyle(0xBB3333); g.fillRect(4, 3, 1, 10);
        });
        tex(scene, 'item_flower', 16, 16, g => {
            g.fillStyle(0x3A7B3A); g.fillRect(7, 9, 2, 5);
            g.fillStyle(0xFF88AA); g.fillCircle(8, 7, 3);
            g.fillStyle(0xFFDD44); g.fillCircle(8, 7, 1);
        });
        tex(scene, 'item_treat', 16, 16, g => {
            g.fillStyle(0xDDAA44); g.fillRect(3, 5, 10, 6);
            g.fillStyle(0xCC9933); g.fillRect(3, 5, 10, 2);
            g.fillStyle(0xDD4444); g.fillRect(6, 4, 4, 2); // bow
        });

        // Weather particle textures
        tex(scene, 'particle_rain', 4, 12, g => {
            g.fillStyle(0x6699CC);
            g.fillRect(1, 0, 2, 12);
            g.fillStyle(0x88BBEE);
            g.fillRect(1, 0, 1, 8);
        });
        tex(scene, 'particle_snow', 6, 6, g => {
            g.fillStyle(0xDDEEFF);
            g.fillCircle(3, 3, 2);
            g.fillStyle(0xFFFFFF);
            g.fillCircle(2, 2, 1);
        });

        // Menu board (single tile — café chalkboard)
        tex(scene, 'furniture_menu_board', TILE, TILE, g => {
            g.fillStyle(0x333333);
            g.fillRect(4, 2, 24, 26);
            g.fillStyle(0x2A4A2A);
            g.fillRect(6, 4, 20, 22);
            g.fillStyle(0xCCCCBB);
            g.fillRect(8, 7, 16, 2);
            g.fillRect(8, 12, 12, 2);
            g.fillRect(8, 17, 14, 2);
            g.fillRect(8, 22, 10, 2);
        });

        // Job board (single tile — bulletin board)
        tex(scene, 'furniture_job_board', TILE, TILE, g => {
            // Board
            g.fillStyle(0x8B7355);
            g.fillRect(4, 4, 24, 24);
            // Cork
            g.fillStyle(0xC4A86B);
            g.fillRect(6, 6, 20, 20);
            // Papers
            g.fillStyle(0xEEEEDD);
            g.fillRect(8, 8, 7, 8);
            g.fillStyle(0xDDDDCC);
            g.fillRect(17, 8, 7, 8);
            g.fillStyle(0xEEEEDD);
            g.fillRect(10, 17, 8, 7);
            // Pins
            g.fillStyle(0xDD4444);
            g.fillCircle(11, 8, 1);
            g.fillStyle(0x4488DD);
            g.fillCircle(20, 8, 1);
            g.fillStyle(0x44DD44);
            g.fillCircle(14, 17, 1);
            // Posts
            g.fillStyle(0x6B4E2E);
            g.fillRect(14, 28, 4, 4);
        });

        // Bulletin board — colorful with header
        tex(scene, 'furniture_bulletin_board', TILE, TILE, g => {
            // Board frame
            g.fillStyle(0x6B4E2E);
            g.fillRect(3, 2, 26, 28);
            // Header strip
            g.fillStyle(0xCC4444);
            g.fillRect(5, 3, 22, 5);
            // Cork background
            g.fillStyle(0xD4B87A);
            g.fillRect(5, 9, 22, 19);
            // Papers (colorful)
            g.fillStyle(0xFFFF99);
            g.fillRect(7, 11, 8, 7);
            g.fillStyle(0x99DDFF);
            g.fillRect(17, 11, 8, 7);
            g.fillStyle(0xFFBB88);
            g.fillRect(9, 19, 8, 7);
            g.fillStyle(0xBBFFBB);
            g.fillRect(19, 19, 5, 7);
            // Pushpins
            g.fillStyle(0xFF2222);
            g.fillCircle(10, 11, 1.5);
            g.fillStyle(0x2222FF);
            g.fillCircle(20, 11, 1.5);
            g.fillStyle(0x22CC22);
            g.fillCircle(13, 19, 1.5);
            g.fillStyle(0xFFAA00);
            g.fillCircle(21, 19, 1.5);
            // Post legs
            g.fillStyle(0x5A3E1E);
            g.fillRect(14, 30, 4, 2);
        });

        // Fair booth / event stall
        tex(scene, 'furniture_fair_booth', TILE, TILE, g => {
            // Canopy frame
            g.fillStyle(0xCC3333);
            g.fillRect(2, 2, 28, 4);
            g.fillStyle(0xFFFFFF);
            g.fillRect(2, 2, 7, 4);
            g.fillRect(16, 2, 7, 4);
            // Counter
            g.fillStyle(0x8B7355);
            g.fillRect(4, 6, 24, 14);
            // Counter top
            g.fillStyle(0xA68B5B);
            g.fillRect(4, 6, 24, 3);
            // Items on counter
            g.fillStyle(0xEEDD88);
            g.fillRect(8, 9, 5, 4);
            g.fillStyle(0x88CCEE);
            g.fillRect(16, 9, 5, 4);
            g.fillStyle(0xDDAA66);
            g.fillRect(23, 9, 3, 3);
            // Legs
            g.fillStyle(0x6B4E2E);
            g.fillRect(5, 20, 3, 8);
            g.fillRect(24, 20, 3, 8);
        });

        // Lost cat sprite
        tex(scene, 'furniture_lost_cat', TILE, TILE, g => {
            // Body
            g.fillStyle(0xFF9944);
            g.fillRect(10, 14, 12, 8);
            // Head
            g.fillStyle(0xFF9944);
            g.fillCircle(16, 12, 5);
            // Ears
            g.fillTriangle(12, 8, 13, 12, 10, 10);
            g.fillTriangle(20, 8, 19, 12, 22, 10);
            // Eyes
            g.fillStyle(0x44AA44);
            g.fillCircle(14, 11, 1.5);
            g.fillCircle(18, 11, 1.5);
            // Nose
            g.fillStyle(0xFF6688);
            g.fillCircle(16, 13, 1);
            // Tail
            g.fillStyle(0xDD7733);
            g.fillRect(21, 14, 3, 2);
            g.fillRect(23, 12, 2, 4);
            g.fillRect(24, 10, 2, 3);
        });
    }

    // Outdoor & commercial tiles
    static outdoor(scene) {
        // Checkered tile floor (shops, café)
        tex(scene, 'floor_tile', TILE, TILE, g => {
            g.fillStyle(0xCCBBAA);
            g.fillRect(0, 0, TILE, TILE);
            g.fillStyle(0xBBAA99);
            g.fillRect(0, 0, 16, 16);
            g.fillRect(16, 16, 16, 16);
            g.fillStyle(0x999888);
            g.fillRect(0, 15, TILE, 2);
            g.fillRect(15, 0, 2, TILE);
        });

        tex(scene, 'floor_grass', TILE, TILE, g => {
            g.fillStyle(0x4A8B4A);
            g.fillRect(0, 0, TILE, TILE);
            const rng = new Phaser.Math.RandomDataGenerator(['fg']);
            // Grass variation
            g.fillStyle(0x5A9B5A);
            for (let j = 0; j < 5; j++) {
                g.fillRect(rng.between(1, 28), rng.between(1, 28), 3, 2);
            }
            g.fillStyle(0x3A7B3A);
            for (let j = 0; j < 3; j++) {
                g.fillRect(rng.between(1, 28), rng.between(1, 28), 2, 2);
            }
        });

        tex(scene, 'floor_stone', TILE, TILE, g => {
            g.fillStyle(0x999988);
            g.fillRect(0, 0, TILE, TILE);
            // Stone borders
            g.fillStyle(0x888877);
            g.fillRect(0, 0, TILE, 1);
            g.fillRect(0, 0, 1, TILE);
            // Variation
            g.fillStyle(0xAAAA99);
            const rng = new Phaser.Math.RandomDataGenerator(['fs']);
            for (let j = 0; j < 3; j++) {
                g.fillRect(rng.between(2, 26), rng.between(2, 26), 4, 2);
            }
        });

        tex(scene, 'wall_exterior', TILE, TILE, g => {
            // Brick-style exterior
            g.fillStyle(0x8B6B55);
            g.fillRect(0, 0, TILE, TILE);
            // Brick lines
            g.fillStyle(0x7A5A44);
            g.fillRect(0, 7, TILE, 1);
            g.fillRect(0, 15, TILE, 1);
            g.fillRect(0, 23, TILE, 1);
            // Offset brick pattern
            g.fillRect(8, 0, 1, 7);
            g.fillRect(24, 0, 1, 7);
            g.fillRect(0, 8, 1, 7);
            g.fillRect(16, 8, 1, 7);
            g.fillRect(8, 16, 1, 7);
            g.fillRect(24, 16, 1, 7);
            g.fillRect(0, 24, 1, 8);
            g.fillRect(16, 24, 1, 8);
        });

        // Door / entrance on exterior wall — dark archway with visible opening
        tex(scene, 'door_exterior', TILE, TILE, g => {
            // Darker opening
            g.fillStyle(0x2A2A2A);
            g.fillRect(0, 0, TILE, TILE);
            // Door frame (lighter wood)
            g.fillStyle(0x8B7355);
            g.fillRect(0, 0, 4, TILE);
            g.fillRect(TILE - 4, 0, 4, TILE);
            g.fillRect(0, 0, TILE, 4);
            // Interior visible (dark floor hint)
            g.fillStyle(0x3A3A3A);
            g.fillRect(4, 4, 24, 24);
            // Arrow/indicator — bright chevron
            g.fillStyle(0xCCDD88);
            g.fillTriangle(16, 10, 10, 20, 22, 20);
            g.fillStyle(0x3A3A3A);
            g.fillTriangle(16, 14, 12, 20, 20, 20);
        });

        // Door tile for indoor walls (hallway-style doorframe)
        tex(scene, 'door_interior', TILE, TILE, g => {
            // Floor base
            g.fillStyle(0x8B6B4A);
            g.fillRect(0, 0, TILE, TILE);
            // Door frame
            g.fillStyle(0x6B4E2E);
            g.fillRect(0, 0, 4, TILE);
            g.fillRect(TILE - 4, 0, 4, TILE);
            g.fillRect(0, 0, TILE, 3);
            // Lighter inner floor
            g.fillStyle(0x9B7B5A);
            g.fillRect(4, 3, 24, 26);
            // Arrow hint
            g.fillStyle(0xAABB88);
            g.fillTriangle(16, 11, 11, 21, 21, 21);
            g.fillStyle(0x9B7B5A);
            g.fillTriangle(16, 15, 13, 21, 19, 21);
        });
    }

    // Ping pong table (2 tiles wide, 3 tiles tall — top-down view)
    static pingpong(scene) {
        tex(scene, 'furniture_ping_pong_table', 64, 96, g => {
            // Table shadow
            rect(g, 6, 10, 52, 80, dark(0x1A6B1A, 30));
            // Table surface (dark green)
            rect(g, 4, 6, 56, 84, 0x1A6B1A);
            // Table border (white lines)
            g.lineStyle(2, 0xFFFFFF, 0.9);
            g.strokeRect(4, 6, 56, 84);
            // Center line (net)
            rect(g, 4, 46, 56, 3, 0xDDDDDD);
            // Net posts
            rect(g, 2, 45, 4, 5, 0x666666);
            rect(g, 58, 45, 4, 5, 0x666666);
            // Net mesh hint
            g.lineStyle(1, 0xBBBBBB, 0.5);
            g.lineBetween(6, 47, 58, 47);
            // Center dashed line
            g.lineStyle(1, 0xFFFFFF, 0.6);
            g.lineBetween(32, 6, 32, 46);
            g.lineBetween(32, 49, 32, 90);
            // Table legs
            rect(g, 6, 86, 4, 6, 0x555555);
            rect(g, 54, 86, 4, 6, 0x555555);
            rect(g, 6, 4, 4, 6, 0x555555);
            rect(g, 54, 4, 4, 6, 0x555555);
            // Highlight
            rect(g, 8, 10, 48, 3, bright(0x1A6B1A, 20));
        });

        // Ping pong paddle (16x16 icon)
        tex(scene, 'pp_paddle', 16, 16, g => {
            // Handle
            rect(g, 7, 10, 3, 6, 0x8B6B4A);
            // Paddle face
            g.fillStyle(0xCC3333);
            g.fillCircle(8, 7, 5);
            g.fillStyle(0xDD4444);
            g.fillCircle(7, 6, 3);
        });

        // Ping pong ball (8x8)
        tex(scene, 'pp_ball', 8, 8, g => {
            g.fillStyle(0xFFAA33);
            g.fillCircle(4, 4, 3);
            g.fillStyle(0xFFCC66);
            g.fillCircle(3, 3, 1);
        });
    }

    // NPC sprites
    static npcs(scene) {
        const skinColor = 0xDDBB99;
        const hairColor = 0x884422;
        const coatColor = 0xEEEEDD; // lab coat
        const shirtColor = 0x4488AA;

        // Sam — fellow student, red hoodie
        tex(scene, 'npc_sam', TILE, TILE, g => {
            const skin = 0xFFDDBB;
            const hair = 0x2A2A3A;
            const hoodie = 0xCC5533;
            const pant = 0x334455;
            rect(g, 12, 2, 8, 5, hair);
            rect(g, 12, 5, 8, 7, skin);
            rect(g, 14, 8, 2, 2, 0x222222);
            rect(g, 18, 8, 2, 2, 0x222222);
            rect(g, 15, 10, 4, 1, 0xCC8888);
            rect(g, 9, 12, 14, 10, hoodie);
            rect(g, 14, 13, 1, 3, 0xEEEEDD);
            rect(g, 17, 13, 1, 3, 0xEEEEDD);
            rect(g, 7, 14, 3, 7, dark(hoodie, 20));
            rect(g, 22, 14, 3, 7, dark(hoodie, 20));
            rect(g, 11, 22, 4, 6, pant);
            rect(g, 17, 22, 4, 6, pant);
            rect(g, 11, 27, 4, 3, 0xEEEEEE);
            rect(g, 17, 27, 4, 3, 0xEEEEEE);
        });

        // Mr. Tanaka — shopkeeper, green apron
        tex(scene, 'npc_shopkeeper', TILE, TILE, g => {
            const skin = 0xDDBB99;
            const hair = 0x666666;
            const apron = 0x44AA44;
            const shirt = 0x5566AA;
            rect(g, 12, 3, 8, 4, hair);
            rect(g, 12, 5, 8, 7, skin);
            rect(g, 14, 8, 2, 2, 0x222222);
            rect(g, 18, 8, 2, 2, 0x222222);
            rect(g, 14, 10, 4, 2, hair);
            rect(g, 10, 12, 12, 10, shirt);
            rect(g, 12, 14, 8, 8, apron);
            rect(g, 11, 14, 10, 2, apron);
            rect(g, 8, 14, 3, 7, dark(shirt, 20));
            rect(g, 21, 14, 3, 7, dark(shirt, 20));
            rect(g, 11, 22, 4, 6, 0x445566);
            rect(g, 17, 22, 4, 6, 0x445566);
            rect(g, 11, 27, 4, 3, 0x444433);
            rect(g, 17, 27, 4, 3, 0x444433);
        });

        // Riley — ping pong player, purple tank top, athletic
        tex(scene, 'npc_riley', TILE, TILE, g => {
            const skin = 0xDDBB99;
            const hair = 0x995522;
            const tank = 0x8855BB;
            const shorts = 0x334455;
            // Hair (short, messy)
            rect(g, 11, 2, 10, 5, hair);
            rect(g, 13, 1, 6, 3, bright(hair, 15));
            // Head
            rect(g, 12, 5, 8, 7, skin);
            // Eyes
            rect(g, 14, 8, 2, 2, 0x222222);
            rect(g, 18, 8, 2, 2, 0x222222);
            // Grin
            rect(g, 15, 10, 4, 1, 0xCC8888);
            // Tank top
            rect(g, 10, 12, 12, 10, tank);
            // Arms (bare skin — tank top)
            rect(g, 8, 13, 3, 7, skin);
            rect(g, 21, 13, 3, 7, skin);
            // Wristband
            rect(g, 8, 18, 3, 2, 0xDD4444);
            rect(g, 21, 18, 3, 2, 0xDD4444);
            // Shorts
            rect(g, 11, 22, 4, 5, shorts);
            rect(g, 17, 22, 4, 5, shorts);
            // Legs
            rect(g, 11, 26, 4, 2, skin);
            rect(g, 17, 26, 4, 2, skin);
            // Sneakers
            rect(g, 10, 27, 5, 3, 0xEEEEEE);
            rect(g, 17, 27, 5, 3, 0xEEEEEE);
            rect(g, 11, 27, 3, 1, 0x4488DD);
            rect(g, 18, 27, 3, 1, 0x4488DD);
        });

        // Professor Elara — facing down, lab coat
        tex(scene, 'npc_elara', TILE, TILE, g => {
            // Hair
            rect(g, 11, 2, 10, 5, hairColor);
            rect(g, 10, 5, 12, 3, hairColor); // wider at sides
            // Head
            rect(g, 12, 5, 8, 7, skinColor);
            // Eyes
            rect(g, 14, 8, 2, 2, 0x222222);
            rect(g, 18, 8, 2, 2, 0x222222);
            // Glasses
            rect(g, 13, 7, 4, 3, 0x666688);
            rect(g, 17, 7, 4, 3, 0x666688);
            rect(g, 14, 8, 2, 1, 0xAABBDD);
            rect(g, 18, 8, 2, 1, 0xAABBDD);
            rect(g, 16, 8, 2, 1, 0x666688); // bridge
            // Lab coat
            rect(g, 9, 12, 14, 10, coatColor);
            // Shirt underneath
            rect(g, 12, 13, 8, 8, shirtColor);
            // Arms (coat sleeves)
            rect(g, 7, 14, 3, 7, coatColor);
            rect(g, 22, 14, 3, 7, coatColor);
            // Legs
            rect(g, 11, 22, 4, 6, 0x445566);
            rect(g, 17, 22, 4, 6, 0x445566);
            // Shoes
            rect(g, 11, 27, 4, 3, 0x333333);
            rect(g, 17, 27, 4, 3, 0x333333);
        });
    }
}
