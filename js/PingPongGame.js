// PingPongGame — Ping pong minigame for the meta-world.
// Top-down view: player controls left paddle, Riley controls right paddle.
// First to 5 points wins. Ball bounces off top/bottom walls.
// Mobile: RN overlay owns chrome; Phaser renders table + ball only.
const MOBILE_PINGPONG_V3 = true;
void MOBILE_PINGPONG_V3;

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

const DESKTOP_TOP = 42;
const DESKTOP_BOT = H - 62;

const TABLE_W = 540;
const TABLE_H = 340;
const PADDLE_W = 10;
const PADDLE_H = 56;
const BALL_SIZE = 8;
const BALL_SPEED_BASE = 280;
const BALL_SPEED_INC = 15;
const PADDLE_SPEED = 260;
const AI_SPEED = 220;
const WIN_SCORE = 5;

const PingPongGame = {
    start(hudScene, onFinish) {
        const metaScene = hudScene.scene.get('MetaWorldScene');
        if (metaScene) metaScene._frozen = true;
        hudScene._minigameActive = true;
        hudScene._minigamePaused = false;
        if (window.__havenwoodReportSnapshot) window.__havenwoodReportSnapshot(true);
        this._run(hudScene, onFinish);
    },

    _run(hudScene, onFinish) {
        const objs = [];
        const track = (obj) => { objs.push(obj); return obj; };
        const destroyAll = () => { objs.forEach(o => { if (o && o.scene) o.destroy(); }); };

        const playPongSfx = (key) => {
            try {
                const gs = hudScene.scene.get('GameScene');
                const sfx = gs && gs.sfx;
                if (sfx) {
                    if (key === 'pong-hit' || key === 'pong-paddle') sfx.pongHit && sfx.pongHit();
                    else if (key === 'pong-bounce') sfx.pongWall && sfx.pongWall();
                    else if (key === 'pong-score') sfx.pongScore && sfx.pongScore();
                    else if (key === 'pong-serve') sfx.pongServe && sfx.pongServe();
                    else if (key === 'pong-win') sfx.pongWin && sfx.pongWin();
                    else if (key === 'pong-lose') sfx.pongLose && sfx.pongLose();
                }
            } catch (_) {}
            try {
                if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'playSfx', key }));
                }
            } catch (_) {}
        };

        const mobile = !!window.__havenwoodMobileMode;
        const canvasW = hudScene.scale.width;
        const canvasH = hudScene.scale.height;
        const layoutW = mobile ? canvasW : W;
        const layoutH = mobile ? canvasH : H;

        const topPad = mobile ? 8 : DESKTOP_TOP;
        const botPad = mobile ? layoutH - 8 : DESKTOP_BOT;
        const areaH = botPad - topPad;
        const headerH = mobile ? 0 : 48;
        const footerH = mobile ? 0 : 24;
        const availH = Math.max(160, areaH - headerH - footerH);
        const availW = Math.max(240, layoutW - (mobile ? 16 : 40));
        const tableScale = Math.min(1, availW / TABLE_W, availH / TABLE_H);
        const tableW = Math.round(TABLE_W * tableScale);
        const tableH = Math.round(TABLE_H * tableScale);
        const paddleW = Math.max(8, Math.round(PADDLE_W * tableScale));
        const paddleH = Math.max(36, Math.round(PADDLE_H * tableScale));
        const ballR = Math.max(3, Math.round((BALL_SIZE / 2) * tableScale));

        const bg = track(hudScene.add.rectangle(layoutW / 2, topPad + areaH / 2, layoutW, areaH, 0x0E1620, 1).setDepth(500));
        if (!mobile) bg.setInteractive();

        const tx = (layoutW - tableW) / 2;
        const ty = topPad + headerH + Math.max(0, (availH - tableH) / 2);

        const tableBg = track(hudScene.add.graphics().setDepth(501));
        tableBg.fillStyle(0x1A6B1A, 1);
        tableBg.fillRect(tx, ty, tableW, tableH);
        tableBg.lineStyle(3, 0xFFFFFF, 0.9);
        tableBg.strokeRect(tx, ty, tableW, tableH);
        tableBg.lineStyle(3, 0xDDDDDD, 0.8);
        tableBg.lineBetween(tx + tableW / 2, ty, tx + tableW / 2, ty + tableH);
        tableBg.fillStyle(0x888888, 1);
        tableBg.fillRect(tx + tableW / 2 - 3, ty - 4, 6, 4);
        tableBg.fillRect(tx + tableW / 2 - 3, ty + tableH, 6, 4);
        tableBg.lineStyle(1, 0xFFFFFF, 0.3);
        tableBg.lineBetween(tx + tableW / 4, ty, tx + tableW / 4, ty + tableH);
        tableBg.lineBetween(tx + 3 * tableW / 4, ty, tx + 3 * tableW / 4, ty + tableH);

        let playerScoreText = null;
        let rileyScoreText = null;
        if (!mobile) {
            const titleSize = 14;
            const scoreSize = 14;
            track(_txt(hudScene, layoutW / 2, topPad + 6, 'PING PONG', titleSize, CLR.gold).setOrigin(0.5, 0).setDepth(502));
            playerScoreText = track(_txt(hudScene, tx + tableW / 4, topPad + 6, '0', scoreSize, '#88DD88').setOrigin(0.5, 0).setDepth(502));
            rileyScoreText = track(_txt(hudScene, tx + 3 * tableW / 4, topPad + 6, '0', scoreSize, '#DD8888').setOrigin(0.5, 0).setDepth(502));
            track(_txt(hudScene, tx + tableW / 4, topPad + 24, 'You', 8, '#88CC88').setOrigin(0.5, 0).setDepth(502));
            track(_txt(hudScene, tx + 3 * tableW / 4, topPad + 24, 'Riley', 8, '#CC8888').setOrigin(0.5, 0).setDepth(502));
            track(_txt(hudScene, layoutW / 2, topPad + 24, `First to ${WIN_SCORE}`, 8, '#778899').setOrigin(0.5, 0).setDepth(502));
            track(_txt(hudScene, layoutW / 2, botPad - 16, 'W/S or Up/Down to move paddle', 8, '#8899AA').setOrigin(0.5, 0).setDepth(502));
        }

        const paddleLeft = track(hudScene.add.rectangle(
            tx + Math.max(12, Math.round(16 * tableScale)), ty + tableH / 2,
            paddleW, paddleH, 0x4488DD
        ).setDepth(503));
        const paddleRight = track(hudScene.add.rectangle(
            tx + tableW - Math.max(12, Math.round(16 * tableScale)), ty + tableH / 2,
            paddleW, paddleH, 0xDD4444
        ).setDepth(503));

        let mobilePaddleTargetY = null;
        const tableTop = ty + paddleH / 2;
        const tableBot = ty + tableH - paddleH / 2;
        const syncMobilePaddle = (pointer) => {
            if (gameOver || hudScene._minigamePaused || !pointer) return;
            mobilePaddleTargetY = Phaser.Math.Clamp(pointer.y, tableTop, tableBot);
        };
        let mobileInputCleanup = null;
        if (mobile) {
            mobilePaddleTargetY = paddleLeft.y;
            const onDown = (pointer) => { syncMobilePaddle(pointer); };
            const onMove = (pointer) => {
                if (!pointer.isDown) return;
                syncMobilePaddle(pointer);
            };
            hudScene.input.on('pointerdown', onDown);
            hudScene.input.on('pointermove', onMove);
            bg.setInteractive();
            bg.on('pointerdown', onDown);
            bg.on('pointermove', onMove);
            mobileInputCleanup = () => {
                hudScene.input.off('pointerdown', onDown);
                hudScene.input.off('pointermove', onMove);
                bg.off('pointerdown', onDown);
                bg.off('pointermove', onMove);
            };
        }

        const ball = track(hudScene.add.circle(
            tx + tableW / 2, ty + tableH / 2,
            ballR, 0xFFAA33
        ).setDepth(504));
        const trail = track(hudScene.add.circle(0, 0, Math.max(2, ballR - 1), 0xFFAA33, 0.15).setDepth(502));

        const dotSpacing = 24;
        const dotY = ty + tableH / 2;
        const dot1 = track(hudScene.add.circle(layoutW / 2 - dotSpacing, dotY, 8, 0xFFDD66).setDepth(505).setAlpha(0));
        const dot2 = track(hudScene.add.circle(layoutW / 2, dotY, 8, 0xFFDD66).setDepth(505).setAlpha(0));
        const dot3 = track(hudScene.add.circle(layoutW / 2 + dotSpacing, dotY, 8, 0xFFDD66).setDepth(505).setAlpha(0));

        let playerScore = 0;
        let rileyScore = 0;
        let ballVx = 0;
        let ballVy = 0;
        let ballSpeed = BALL_SPEED_BASE;
        let volleyCount = 0;
        let serving = true;
        let serveDots = 3;
        let serverIsPlayer = true;
        let gameOver = false;
        let resultShown = false;
        let serveTimer = null;
        let finished = false;

        const kb = hudScene.input.keyboard;
        const inertKey = () => ({ isDown: false, reset() {} });
        const wKey = kb ? kb.addKey(Phaser.Input.Keyboard.KeyCodes.W) : inertKey();
        const sKey = kb ? kb.addKey(Phaser.Input.Keyboard.KeyCodes.S) : inertKey();
        const upKey = kb ? kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP) : inertKey();
        const downKey = kb ? kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN) : inertKey();

        const reportPong = () => {
            if (window.__havenwoodReportSnapshot) window.__havenwoodReportSnapshot(true);
        };

        const cleanup = (applyFinish) => {
            if (finished) return;
            finished = true;
            updateEvent.destroy();
            if (kb) {
                kb.off('keydown-E', onPressE);
                kb.off('keydown-SPACE', onPressE);
            }
            if (mobileInputCleanup) mobileInputCleanup();
            wKey.reset(); sKey.reset(); upKey.reset(); downKey.reset();
            hudScene._minigameActive = false;
            hudScene._minigamePaused = false;
            hudScene._pongApi = null;
            window.__havenwoodPongApi = null;
            destroyAll();
            const metaScene = hudScene.scene.get('MetaWorldScene');
            if (metaScene) metaScene._frozen = false;
            reportPong();
            if (applyFinish && onFinish) {
                const won = playerScore >= WIN_SCORE;
                onFinish({ playerScore, rileyScore, won });
            }
        };

        const pongApi = {
            getSnapshot() {
                const won = playerScore >= WIN_SCORE;
                const lost = rileyScore >= WIN_SCORE;
                return {
                    active: true,
                    playerScore,
                    rileyScore,
                    winTarget: WIN_SCORE,
                    serving,
                    serveDots,
                    gameOver,
                    result: gameOver ? (won ? 'won' : lost ? 'lost' : null) : null,
                    rewardLabel: won ? '+15 Mood, +10 Friendship' : '+5 Mood, +6 Friendship',
                    opponentName: 'Riley',
                };
            },
            setPaddleNorm(norm) {
                if (gameOver || hudScene._minigamePaused) return;
                const n = Phaser.Math.Clamp(Number(norm) || 0, 0, 1);
                mobilePaddleTargetY = tableTop + n * (tableBot - tableTop);
            },
            exit() {
                cleanup(false);
            },
            done() {
                if (!gameOver) return;
                cleanup(true);
            },
        };
        hudScene._pongApi = pongApi;
        window.__havenwoodPongApi = pongApi;

        const serve = () => {
            if (gameOver) return;
            ball.x = tx + tableW / 2;
            ball.y = ty + tableH / 2;
            ballSpeed = BALL_SPEED_BASE;
            volleyCount = 0;
            serving = true;
            serveDots = 3;

            let count = 3;
            dot1.setAlpha(1); dot2.setAlpha(1); dot3.setAlpha(1);

            const tick = () => {
                if (gameOver) return;
                if (hudScene._minigamePaused) {
                    serveTimer = hudScene.time.delayedCall(200, tick);
                    return;
                }
                serveDots = count;
                reportPong();
                if (count === 3) { dot1.setAlpha(1); dot2.setAlpha(1); dot3.setAlpha(1); playPongSfx('pong-serve'); }
                else if (count === 2) { dot1.setAlpha(0); playPongSfx('pong-serve'); }
                else if (count === 1) { dot2.setAlpha(0); playPongSfx('pong-serve'); }
                else {
                    dot3.setAlpha(0);
                    serving = false;
                    serveDots = 0;
                    reportPong();
                    const dir = serverIsPlayer ? 1 : -1;
                    const angle = (Math.random() * 0.6 - 0.3);
                    ballVx = Math.cos(angle) * ballSpeed * dir;
                    ballVy = Math.sin(angle) * ballSpeed;
                    return;
                }
                count--;
                serveTimer = hudScene.time.delayedCall(500, tick);
            };
            tick();
        };

        const scorePoint = (playerScored) => {
            if (gameOver) return;
            if (playerScored) {
                playerScore++;
                if (playerScoreText) playerScoreText.setText(String(playerScore));
                serverIsPlayer = false;
            } else {
                rileyScore++;
                if (rileyScoreText) rileyScoreText.setText(String(rileyScore));
                serverIsPlayer = true;
            }
            ballVx = 0; ballVy = 0;
            ball.x = tx + tableW / 2;
            ball.y = ty + tableH / 2;
            trail.setPosition(ball.x, ball.y);
            playPongSfx('pong-score');
            reportPong();

            if (playerScore >= WIN_SCORE || rileyScore >= WIN_SCORE) {
                gameOver = true;
                showResult();
                return;
            }
            serveTimer = hudScene.time.delayedCall(800, serve);
        };

        const showResult = () => {
            if (resultShown) return;
            resultShown = true;
            const won = playerScore >= WIN_SCORE;
            playPongSfx(won ? 'pong-win' : 'pong-lose');
            reportPong();

            if (mobile) return;

            track(hudScene.add.rectangle(layoutW / 2, topPad + areaH / 2, layoutW, areaH, 0x000000, 0.55).setDepth(510).setInteractive());
            const titleText = won ? 'YOU WIN!' : 'RILEY WINS!';
            const titleColor = won ? '#88EE88' : '#EE8888';
            track(_txt(hudScene, layoutW / 2, topPad + areaH / 2 - 60, titleText, 18, titleColor).setOrigin(0.5).setDepth(511));
            track(_txt(hudScene, layoutW / 2, topPad + areaH / 2 - 25, `${playerScore} - ${rileyScore}`, 14, '#CCDDEE').setOrigin(0.5).setDepth(511));
            const rewardText = won ? '+15 Mood, +10 Friendship' : '+5 Mood, +6 Friendship';
            track(_txt(hudScene, layoutW / 2, topPad + areaH / 2 + 10, rewardText, 9, '#AABB88').setOrigin(0.5).setDepth(511));

            const closeY = topPad + areaH / 2 + 50;
            const closeBg = track(hudScene.add.graphics().setDepth(511));
            closeBg.fillStyle(0x2A4A5A, 0.95);
            closeBg.fillRoundedRect(layoutW / 2 - 110, closeY, 220, 40, 8);
            closeBg.lineStyle(1, 0x5A8AAA, 0.8);
            closeBg.strokeRoundedRect(layoutW / 2 - 110, closeY, 220, 40, 8);
            track(_txt(hudScene, layoutW / 2, closeY + 20, '[E] Done', 10, '#CCEEEE').setOrigin(0.5).setDepth(511));
            const closeHit = track(hudScene.add.rectangle(layoutW / 2, closeY + 20, 220, 40, 0, 0).setDepth(511).setInteractive({ useHandCursor: true }));

            closeHit.on('pointerdown', () => { if (!hudScene._minigamePaused) cleanup(true); });
        };

        const onPressE = () => { if (!hudScene._minigamePaused && gameOver) cleanup(true); };
        if (kb) {
            kb.on('keydown-E', onPressE);
            kb.on('keydown-SPACE', onPressE);
        }

        const updateEvent = hudScene.time.addEvent({
            delay: 16,
            loop: true,
            callback: () => {
                if (hudScene._minigamePaused) {
                    if (serveTimer && !serveTimer.paused) serveTimer.paused = true;
                    return;
                }
                if (serveTimer && serveTimer.paused) serveTimer.paused = false;
                if (gameOver || serving) return;

                const dt = 1 / 60;

                if (mobile && mobilePaddleTargetY != null) {
                    const diff = mobilePaddleTargetY - paddleLeft.y;
                    if (Math.abs(diff) > 1) {
                        paddleLeft.y += Phaser.Math.Clamp(diff, -PADDLE_SPEED * dt, PADDLE_SPEED * dt);
                    }
                } else {
                    let playerDir = 0;
                    if (wKey.isDown || upKey.isDown) playerDir = -1;
                    if (sKey.isDown || downKey.isDown) playerDir = 1;
                    paddleLeft.y += playerDir * PADDLE_SPEED * dt;
                }
                paddleLeft.y = Phaser.Math.Clamp(paddleLeft.y, tableTop, tableBot);

                const aiTarget = ball.y + (ballVy > 0 ? 8 : -8);
                const aiDiff = aiTarget - paddleRight.y;
                if (Math.abs(aiDiff) > 4) {
                    const aiReact = AI_SPEED * dt * (0.75 + Math.min(0.35, volleyCount * 0.02));
                    paddleRight.y += Math.sign(aiDiff) * Math.min(Math.abs(aiDiff), aiReact);
                }
                paddleRight.y = Phaser.Math.Clamp(paddleRight.y, tableTop, tableBot);

                ball.x += ballVx * dt;
                ball.y += ballVy * dt;
                trail.setPosition(ball.x - ballVx * dt * 0.35, ball.y - ballVy * dt * 0.35);

                if (ball.y - ballR <= ty) {
                    ball.y = ty + ballR;
                    ballVy = Math.abs(ballVy);
                    playPongSfx('pong-bounce');
                } else if (ball.y + ballR >= ty + tableH) {
                    ball.y = ty + tableH - ballR;
                    ballVy = -Math.abs(ballVy);
                    playPongSfx('pong-bounce');
                }

                if (
                    ballVx < 0 &&
                    ball.x - ballR <= paddleLeft.x + paddleW / 2 &&
                    ball.x - ballR >= paddleLeft.x - paddleW / 2 - 4 &&
                    ball.y >= paddleLeft.y - paddleH / 2 &&
                    ball.y <= paddleLeft.y + paddleH / 2
                ) {
                    ball.x = paddleLeft.x + paddleW / 2 + ballR;
                    volleyCount++;
                    ballSpeed = BALL_SPEED_BASE + volleyCount * BALL_SPEED_INC;
                    const hitPos = (ball.y - paddleLeft.y) / (paddleH / 2);
                    ballVx = Math.abs(Math.cos(hitPos * 0.55)) * ballSpeed;
                    ballVy = hitPos * ballSpeed * 0.75;
                    paddleLeft.fillColor = 0x88CCFF;
                    playPongSfx('pong-hit');
                    hudScene.time.delayedCall(100, () => { paddleLeft.fillColor = 0x4488DD; });
                }

                if (
                    ballVx > 0 &&
                    ball.x + ballR >= paddleRight.x - paddleW / 2 &&
                    ball.x + ballR <= paddleRight.x + paddleW / 2 + 4 &&
                    ball.y >= paddleRight.y - paddleH / 2 &&
                    ball.y <= paddleRight.y + paddleH / 2
                ) {
                    ball.x = paddleRight.x - paddleW / 2 - ballR;
                    volleyCount++;
                    ballSpeed = BALL_SPEED_BASE + volleyCount * BALL_SPEED_INC;
                    const hitPos = (ball.y - paddleRight.y) / (paddleH / 2);
                    ballVx = -Math.abs(Math.cos(hitPos * 0.55)) * ballSpeed;
                    ballVy = hitPos * ballSpeed * 0.75;
                    paddleRight.fillColor = 0xFF8888;
                    playPongSfx('pong-paddle');
                    hudScene.time.delayedCall(100, () => { paddleRight.fillColor = 0xDD4444; });
                }

                if (ball.x + ballR < tx - 8) scorePoint(false);
                else if (ball.x - ballR > tx + tableW + 8) scorePoint(true);
            },
        });

        serve();
    },
};

export default PingPongGame;
