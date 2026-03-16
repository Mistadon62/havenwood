// MetaSpriteGenerator.js — Havenwood meta-world
// Generates textures for the real-world layer: phone bezel, character (4-dir),
// room tiles (floor, walls), furniture, and interaction prompts.
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
        this.furniture(scene);
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
            // Screen (will show a tiny color to suggest the game is running)
            g.fillStyle(0x3a5a3a);
            g.fillRect(2, 3, 8, 13);
            // Home button
            g.fillStyle(0x333344);
            g.fillCircle(6, 18, 1);
        });
    }
}
