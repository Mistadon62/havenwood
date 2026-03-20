// PingPongGame — Ping pong minigame for the meta-world.
// Top-down view: player controls left paddle with W/S, Riley controls right paddle.
// First to 5 points wins. Ball bounces off top/bottom walls.
// Launched when interacting with Riley near the ping pong table.

import { W, H, CLR } from './GameData.js';

function _txt(scene, x, y, str, size, color) {
    return scene.add.text(x, y, str, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: `${size}px`,
        color: color || '#FFFFFF',
        stroke: '#000000',
        strokeThickness: 2,
    });
}

// Play area bounds (between top bar and bottom bar)
const TOP = 42;
const BOT = H - 62;
const AREA_H = BOT - TOP;

// Game constants
const TABLE_W = 540;
const TABLE_H = 340;
const PADDLE_W = 10;
const PADDLE_H = 56;
const BALL_SIZE = 8;
const BALL_SPEED_BASE = 280;
const BALL_SPEED_INC = 15;      // speed up each volley
const PADDLE_SPEED = 260;
const AI_SPEED = 220;
const WIN_SCORE = 5;

const PingPongGame = {
    start(hudScene, onFinish) {
        const metaScene = hudScene.scene.get('MetaWorldScene');
        if (metaScene) metaScene._frozen = true;
        hudScene._minigameActive = true;
        hudScene._minigamePaused = false;

        this._run(hudScene, onFinish);
    },

    _run(hudScene, onFinish) {
        // Track all game objects for cleanup (no container — avoids Phaser jitter)
        const objs = [];
        const track = (obj) => { objs.push(obj); return obj; };
        const destroyAll = () => { objs.forEach(o => { if (o && o.scene) o.destroy(); }); };

        // Background
        const bg = track(hudScene.add.rectangle(W / 2, TOP + AREA_H / 2, W, AREA_H, 0x0E1620, 1).setDepth(500).setInteractive());

        // Table position (centered)
        const tx = (W - TABLE_W) / 2;
        const ty = TOP + (AREA_H - TABLE_H) / 2 + 10;

        // Draw table
        const tableBg = track(hudScene.add.graphics().setDepth(501));
        // Table surface
        tableBg.fillStyle(0x1A6B1A, 1);
        tableBg.fillRect(tx, ty, TABLE_W, TABLE_H);
        // Border
        tableBg.lineStyle(3, 0xFFFFFF, 0.9);
        tableBg.strokeRect(tx, ty, TABLE_W, TABLE_H);
        // Center line (net)
        tableBg.lineStyle(3, 0xDDDDDD, 0.8);
        tableBg.lineBetween(tx + TABLE_W / 2, ty, tx + TABLE_W / 2, ty + TABLE_H);
        // Net posts
        tableBg.fillStyle(0x888888, 1);
        tableBg.fillRect(tx + TABLE_W / 2 - 3, ty - 4, 6, 4);
        tableBg.fillRect(tx + TABLE_W / 2 - 3, ty + TABLE_H, 6, 4);
        // Center dots
        tableBg.lineStyle(1, 0xFFFFFF, 0.3);
        tableBg.lineBetween(tx + TABLE_W / 4, ty, tx + TABLE_W / 4, ty + TABLE_H);
        tableBg.lineBetween(tx + 3 * TABLE_W / 4, ty, tx + 3 * TABLE_W / 4, ty + TABLE_H);

        // Header
        track(_txt(hudScene, W / 2, TOP + 8, 'PING PONG', 14, CLR.gold).setOrigin(0.5, 0).setDepth(502));

        // Score display
        const playerScoreText = track(_txt(hudScene, tx + TABLE_W / 4, TOP + 8, '0', 14, '#88DD88').setOrigin(0.5, 0).setDepth(502));
        const rileyScoreText = track(_txt(hudScene, tx + 3 * TABLE_W / 4, TOP + 8, '0', 14, '#DD8888').setOrigin(0.5, 0).setDepth(502));

        // Player labels
        track(_txt(hudScene, tx + TABLE_W / 4, TOP + 28, 'You', 8, '#88CC88').setOrigin(0.5, 0).setDepth(502));
        track(_txt(hudScene, tx + 3 * TABLE_W / 4, TOP + 28, 'Riley', 8, '#CC8888').setOrigin(0.5, 0).setDepth(502));

        // "First to 5" label
        track(_txt(hudScene, W / 2, TOP + 28, `First to ${WIN_SCORE}`, 8, '#778899').setOrigin(0.5, 0).setDepth(502));

        // Controls hint
        track(_txt(hudScene, W / 2, BOT - 18, 'W/S or Up/Down to move paddle', 8, '#556677').setOrigin(0.5, 0).setDepth(502));

        // Paddles
        const paddleLeft = track(hudScene.add.rectangle(
            tx + 16, ty + TABLE_H / 2,
            PADDLE_W, PADDLE_H, 0x4488DD
        ).setDepth(503));

        const paddleRight = track(hudScene.add.rectangle(
            tx + TABLE_W - 16, ty + TABLE_H / 2,
            PADDLE_W, PADDLE_H, 0xDD4444
        ).setDepth(503));

        // Ball
        const ball = track(hudScene.add.circle(
            tx + TABLE_W / 2, ty + TABLE_H / 2,
            BALL_SIZE / 2, 0xFFAA33
        ).setDepth(504));

        // Ball trail — uses a pre-created Circle instead of a Graphics object.
        // Graphics.clear()+fill() every frame rebuilds the WebGL texture, causing
        // sub-pixel jitter on all other scene objects. (See GameScene.create() comment.)
        const trail = track(hudScene.add.circle(0, 0, BALL_SIZE / 2 - 1, 0xFFAA33, 0.15).setDepth(502));

        // Countdown dots (3 pre-created circles — avoids text/canvas texture changes that cause render jitter)
        const dotSpacing = 24;
        const dotY = ty + TABLE_H / 2;
        const dot1 = track(hudScene.add.circle(W / 2 - dotSpacing, dotY, 8, 0xFFDD66).setDepth(505).setAlpha(0));
        const dot2 = track(hudScene.add.circle(W / 2, dotY, 8, 0xFFDD66).setDepth(505).setAlpha(0));
        const dot3 = track(hudScene.add.circle(W / 2 + dotSpacing, dotY, 8, 0xFFDD66).setDepth(505).setAlpha(0));

        // Game state
        let playerScore = 0;
        let rileyScore = 0;
        let ballVx = 0;
        let ballVy = 0;
        let ballSpeed = BALL_SPEED_BASE;
        let volleyCount = 0;
        let serving = true;
        let serverIsPlayer = true;
        let gameOver = false;
        let resultShown = false;

        // Serve timer ref for pause support
        let serveTimer = null;

        // Input — grab key references but do NOT destroy them on cleanup,
        // since Phaser reuses the same Key object across scenes.
        const wKey = hudScene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
        const sKey = hudScene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
        const upKey = hudScene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
        const downKey = hudScene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);

        // Serve the ball
        const serve = () => {
            if (gameOver) return;
            ball.x = tx + TABLE_W / 2;
            ball.y = ty + TABLE_H / 2;
            ballSpeed = BALL_SPEED_BASE;
            volleyCount = 0;
            serving = true;

            // Countdown using dots (no text changes — avoids canvas texture render jitter)
            let count = 3;
            dot1.setAlpha(1); dot2.setAlpha(1); dot3.setAlpha(1);

            serveTimer = hudScene.time.addEvent({
                delay: 600,
                repeat: 2,
                callback: () => {
                    if (gameOver) return;
                    count--;
                    if (count === 2) {
                        dot1.setAlpha(0);
                    } else if (count === 1) {
                        dot2.setAlpha(0);
                    } else {
                        dot3.setAlpha(0);
                        serving = false;

                        // Launch ball toward the non-server
                        const angle = (Math.random() * 0.8 - 0.4); // -0.4 to 0.4 radians
                        if (serverIsPlayer) {
                            ballVx = Math.cos(angle) * ballSpeed;
                            ballVy = Math.sin(angle) * ballSpeed;
                        } else {
                            ballVx = -Math.cos(angle) * ballSpeed;
                            ballVy = Math.sin(angle) * ballSpeed;
                        }
                    }
                }
            });
        };

        // Score a point
        const scorePoint = (scorer) => {
            // Stop ball immediately to prevent multi-scoring
            serving = true;
            ballVx = 0;
            ballVy = 0;
            ball.x = tx + TABLE_W / 2;
            ball.y = ty + TABLE_H / 2;
            trail.x = ball.x;
            trail.y = ball.y;

            if (scorer === 'player') {
                playerScore++;
                playerScoreText.setText(`${playerScore}`);
                serverIsPlayer = true;
            } else {
                rileyScore++;
                rileyScoreText.setText(`${rileyScore}`);
                serverIsPlayer = false;
            }

            // Flash the scorer's text to indicate the point
            const scoreText = scorer === 'player' ? playerScoreText : rileyScoreText;
            scoreText.setScale(1.5);
            hudScene.tweens.add({ targets: scoreText, scaleX: 1, scaleY: 1, duration: 300, ease: 'Back.easeOut' });

            // Check win
            if (playerScore >= WIN_SCORE || rileyScore >= WIN_SCORE) {
                gameOver = true;
                showResult();
            } else {
                // Next serve after brief pause
                serveTimer = hudScene.time.delayedCall(800, serve);
            }
        };

        // Show final result
        const showResult = () => {
            if (resultShown) return;
            resultShown = true;
            const won = playerScore >= WIN_SCORE;

            const overlay = track(hudScene.add.rectangle(W / 2, TOP + AREA_H / 2, W, AREA_H, 0x000000, 0.5).setDepth(510).setInteractive());

            const titleText = won ? 'YOU WIN!' : 'RILEY WINS!';
            const titleColor = won ? '#88EE88' : '#EE8888';
            track(_txt(hudScene, W / 2, TOP + AREA_H / 2 - 60, titleText, 18, titleColor).setOrigin(0.5).setDepth(511));
            track(_txt(hudScene, W / 2, TOP + AREA_H / 2 - 25, `${playerScore} - ${rileyScore}`, 14, '#CCDDEE').setOrigin(0.5).setDepth(511));

            const rewardText = won ? '+15 Mood, +10 Friendship' : '+5 Mood, +6 Friendship';
            track(_txt(hudScene, W / 2, TOP + AREA_H / 2 + 10, rewardText, 9, '#AABB88').setOrigin(0.5).setDepth(511));

            // Close button
            const closeY = TOP + AREA_H / 2 + 50;
            const closeBg = track(hudScene.add.graphics().setDepth(511));
            closeBg.fillStyle(0x2A4A5A, 0.9);
            closeBg.fillRoundedRect(W / 2 - 100, closeY, 200, 36, 6);
            closeBg.lineStyle(1, 0x5A8AAA, 0.7);
            closeBg.strokeRoundedRect(W / 2 - 100, closeY, 200, 36, 6);
            track(_txt(hudScene, W / 2, closeY + 18, '[E] Done', 10, '#CCEEEE').setOrigin(0.5).setDepth(511));

            const closeHit = track(hudScene.add.rectangle(W / 2, closeY + 18, 200, 36, 0, 0).setDepth(511).setInteractive({ useHandCursor: true }));

            let finished = false;
            const finish = () => {
                if (finished) return;
                finished = true;
                updateEvent.destroy();
                // Remove keyboard listeners
                hudScene.input.keyboard.off('keydown-E', onPressE);
                hudScene.input.keyboard.off('keydown-SPACE', onPressE);
                // Reset key states but do NOT destroy — they're shared with MetaWorldScene
                wKey.reset();
                sKey.reset();
                upKey.reset();
                downKey.reset();
                hudScene._minigameActive = false;
                hudScene._minigamePaused = false;
                destroyAll();
                if (onFinish) onFinish({ playerScore, rileyScore, won });
            };

            closeHit.on('pointerdown', () => { if (!hudScene._minigamePaused) finish(); });

            // Allow E / Space key to close (event-driven — more reliable than JustDown polling)
            const onPressE = () => { if (!hudScene._minigamePaused) finish(); };
            hudScene.input.keyboard.on('keydown-E', onPressE);
            hudScene.input.keyboard.on('keydown-SPACE', onPressE);
        };

        // Main update loop
        const updateEvent = hudScene.time.addEvent({
            delay: 16, // ~60fps
            loop: true,
            callback: () => {
                // Sync pause state — pause/unpause serve timer too
                if (hudScene._minigamePaused) {
                    if (serveTimer && !serveTimer.paused) serveTimer.paused = true;
                    return;
                }
                if (serveTimer && serveTimer.paused) serveTimer.paused = false;

                if (gameOver || serving) return;

                const dt = 1 / 60;

                // Player paddle movement (W/S or Up/Down)
                let playerDir = 0;
                if (wKey.isDown || upKey.isDown) playerDir = -1;
                if (sKey.isDown || downKey.isDown) playerDir = 1;
                paddleLeft.y += playerDir * PADDLE_SPEED * dt;
                paddleLeft.y = Phaser.Math.Clamp(paddleLeft.y, ty + PADDLE_H / 2, ty + TABLE_H - PADDLE_H / 2);

                // AI paddle movement (Riley)
                const aiTarget = ball.y;
                const aiDiff = aiTarget - paddleRight.y;
                // Add some imperfection — Riley can't react perfectly
                const aiReact = Math.min(Math.abs(aiDiff), AI_SPEED * dt);
                if (Math.abs(aiDiff) > 4) {
                    paddleRight.y += Math.sign(aiDiff) * aiReact;
                }
                paddleRight.y = Phaser.Math.Clamp(paddleRight.y, ty + PADDLE_H / 2, ty + TABLE_H - PADDLE_H / 2);

                // Move ball
                ball.x += ballVx * dt;
                ball.y += ballVy * dt;

                // Ball trail
                trail.x = ball.x - ballVx * dt * 0.5;
                trail.y = ball.y - ballVy * dt * 0.5;

                // Top/bottom wall bounce
                if (ball.y - BALL_SIZE / 2 <= ty) {
                    ball.y = ty + BALL_SIZE / 2;
                    ballVy = Math.abs(ballVy);
                }
                if (ball.y + BALL_SIZE / 2 >= ty + TABLE_H) {
                    ball.y = ty + TABLE_H - BALL_SIZE / 2;
                    ballVy = -Math.abs(ballVy);
                }

                // Left paddle collision (player)
                if (ballVx < 0 &&
                    ball.x - BALL_SIZE / 2 <= paddleLeft.x + PADDLE_W / 2 &&
                    ball.x - BALL_SIZE / 2 >= paddleLeft.x - PADDLE_W / 2 - 4 &&
                    ball.y >= paddleLeft.y - PADDLE_H / 2 &&
                    ball.y <= paddleLeft.y + PADDLE_H / 2) {

                    ball.x = paddleLeft.x + PADDLE_W / 2 + BALL_SIZE / 2;
                    volleyCount++;
                    ballSpeed = BALL_SPEED_BASE + volleyCount * BALL_SPEED_INC;

                    // Reflect with angle based on hit position
                    const hitPos = (ball.y - paddleLeft.y) / (PADDLE_H / 2); // -1 to 1
                    const angle = hitPos * 0.7; // max ~40 degrees
                    ballVx = Math.cos(angle) * ballSpeed;
                    ballVy = Math.sin(angle) * ballSpeed;

                    // Paddle flash
                    paddleLeft.fillColor = 0x88CCFF;
                    hudScene.time.delayedCall(100, () => { paddleLeft.fillColor = 0x4488DD; });
                }

                // Right paddle collision (Riley)
                if (ballVx > 0 &&
                    ball.x + BALL_SIZE / 2 >= paddleRight.x - PADDLE_W / 2 &&
                    ball.x + BALL_SIZE / 2 <= paddleRight.x + PADDLE_W / 2 + 4 &&
                    ball.y >= paddleRight.y - PADDLE_H / 2 &&
                    ball.y <= paddleRight.y + PADDLE_H / 2) {

                    ball.x = paddleRight.x - PADDLE_W / 2 - BALL_SIZE / 2;
                    volleyCount++;
                    ballSpeed = BALL_SPEED_BASE + volleyCount * BALL_SPEED_INC;

                    const hitPos = (ball.y - paddleRight.y) / (PADDLE_H / 2);
                    const angle = Math.PI - hitPos * 0.7;
                    ballVx = Math.cos(angle) * ballSpeed;
                    ballVy = Math.sin(angle) * ballSpeed;

                    paddleRight.fillColor = 0xFF8888;
                    hudScene.time.delayedCall(100, () => { paddleRight.fillColor = 0xDD4444; });
                }

                // Score detection (ball past paddles)
                if (ball.x < tx - 20) {
                    scorePoint('riley');
                }
                if (ball.x > tx + TABLE_W + 20) {
                    scorePoint('player');
                }
            }
        });

        // Start first serve
        serve();
    },
};

export default PingPongGame;
