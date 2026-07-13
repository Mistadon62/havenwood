// MetaClassQuiz — Wildlife Biology class quiz minigame.
// Full-screen 10-question multiple-choice quiz. Player competes against Sam.
// Launched when attending Prof. Elara's class.

import { W, H, CLR } from './GameData.js';
import { QUESTION_SETS } from './QuizQuestions.js';

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// Sam's AI: picks correct answer with some probability, else random wrong answer
function samAnswer(correctIdx) {
    const smart = Math.random() < 0.6;
    if (smart) return correctIdx;
    const wrong = [0, 1, 2, 3].filter(i => i !== correctIdx);
    return wrong[Math.floor(Math.random() * wrong.length)];
}

function _txt(scene, x, y, str, size, color, wrapWidth) {
    return scene.add.text(x, y, str, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: `${size}px`,
        color: color || '#FFFFFF',
        stroke: '#000000',
        strokeThickness: 2,
        wordWrap: { width: wrapWidth || 800 },
    });
}

// Play area bounds (between top bar and bottom bar)
const TOP = 42;
const BOT = H - 62;
const AREA_H = BOT - TOP;

const MetaClassQuiz = {
    start(hudScene, onFinish) {
        const metaScene = hudScene.scene.get('MetaWorldScene');
        if (metaScene) metaScene._frozen = true;
        hudScene._minigameActive = true;
        hudScene._minigamePaused = false;

        if (window.__havenwoodMobileMode) {
            this._runMobile(hudScene, onFinish);
            return;
        }

        this._showCategorySelect(hudScene, onFinish);
    },

    _runMobile(hudScene, onFinish) {
        const report = () => { if (window.__havenwoodReportSnapshot) window.__havenwoodReportSnapshot(true); };
        const categoryKeys = Object.keys(QUESTION_SETS);
        const state = {
            phase: 'category',
            setKey: null,
            setName: null,
            setColor: '#66CC88',
            questions: [],
            qIdx: 0,
            playerScore: 0,
            samScore: 0,
            results: [],
            selectedIndex: null,
            samIndex: null,
            correctIndex: null,
            revealMessage: null,
            grade: null,
            bonusKnowledge: 0,
            finished: false,
        };

        const categories = categoryKeys.map(key => ({
            key,
            name: QUESTION_SETS[key].name,
            color: QUESTION_SETS[key].color,
            questionCount: QUESTION_SETS[key].questions.length,
        }));

        const cleanup = (applyFinish) => {
            hudScene._classQuizApi = null;
            window.__havenwoodClassQuizApi = null;
            hudScene._minigameActive = false;
            hudScene._minigamePaused = false;
            const metaScene = hudScene.scene.get('MetaWorldScene');
            if (metaScene && !metaScene._startWithPhone) metaScene._frozen = false;
            report();
            if (applyFinish && onFinish) {
                onFinish({
                    playerScore: state.playerScore,
                    samScore: state.samScore,
                    bonusKnowledge: state.bonusKnowledge,
                    grade: state.grade || 'F',
                });
            }
        };

        const currentQuestion = () => state.questions[state.qIdx] || null;
        const setGrade = () => {
            let grade = 'F';
            if (state.playerScore >= 9) grade = 'A+';
            else if (state.playerScore >= 8) grade = 'A';
            else if (state.playerScore >= 7) grade = 'B+';
            else if (state.playerScore >= 6) grade = 'B';
            else if (state.playerScore >= 5) grade = 'C';
            else if (state.playerScore >= 4) grade = 'D';
            state.grade = grade;
            state.bonusKnowledge = Math.floor(state.playerScore * 1.5);
        };

        const api = {
            getSnapshot() {
                const q = currentQuestion();
                return {
                    active: true,
                    phase: state.phase,
                    categories,
                    setKey: state.setKey,
                    setName: state.setName,
                    setColor: state.setColor,
                    questionIndex: state.qIdx,
                    questionTotal: state.questions.length || 10,
                    playerScore: state.playerScore,
                    samScore: state.samScore,
                    question: q ? q.q : null,
                    answers: q ? q.answers : [],
                    selectedIndex: state.selectedIndex,
                    samIndex: state.samIndex,
                    correctIndex: state.correctIndex,
                    revealMessage: state.revealMessage,
                    grade: state.grade,
                    bonusKnowledge: state.bonusKnowledge,
                    results: state.results.map((r, i) => ({
                        index: i + 1,
                        question: r.question,
                        playerCorrect: r.playerAns === r.correct,
                        samCorrect: r.samAns === r.correct,
                    })),
                };
            },
            chooseCategory(key) {
                if (state.phase !== 'category') return;
                const set = QUESTION_SETS[key];
                if (!set) return;
                state.setKey = key;
                state.setName = set.name;
                state.setColor = set.color;
                state.questions = shuffle([...set.questions]).slice(0, 10);
                state.qIdx = 0;
                state.phase = 'question';
                report();
            },
            answer(index) {
                if (state.phase !== 'question') return;
                const q = currentQuestion();
                if (!q || index < 0 || index >= q.answers.length) return;
                const sAns = samAnswer(q.correct);
                if (index === q.correct) state.playerScore++;
                if (sAns === q.correct) state.samScore++;
                state.selectedIndex = index;
                state.samIndex = sAns;
                state.correctIndex = q.correct;
                state.results.push({ question: q.q, playerAns: index, samAns: sAns, correct: q.correct });
                const playerCorrect = index === q.correct;
                const samCorrect = sAns === q.correct;
                if (playerCorrect && samCorrect) state.revealMessage = 'You both got it right!';
                else if (playerCorrect) state.revealMessage = 'You got it! Sam missed this one.';
                else if (samCorrect) state.revealMessage = 'Sam got it right. Better luck next time!';
                else state.revealMessage = 'Nobody got this one right!';
                state.phase = 'reveal';
                report();
            },
            next() {
                if (state.phase !== 'reveal') return;
                if (state.qIdx >= state.questions.length - 1) {
                    setGrade();
                    state.phase = 'result';
                } else {
                    state.qIdx++;
                    state.phase = 'question';
                    state.selectedIndex = null;
                    state.samIndex = null;
                    state.correctIndex = null;
                    state.revealMessage = null;
                }
                report();
            },
            finish() {
                if (state.phase !== 'result' || state.finished) return;
                state.finished = true;
                cleanup(true);
            },
        };

        hudScene._classQuizApi = api;
        window.__havenwoodClassQuizApi = api;
        report();
    },

    // ── Category Selection Screen ──
    _showCategorySelect(hudScene, onFinish) {
        const ct = hudScene.add.container(0, 0).setDepth(500);

        const bg = hudScene.add.rectangle(W / 2, TOP + AREA_H / 2, W, AREA_H, 0x0E1620, 1).setInteractive();
        ct.add(bg);

        ct.add(_txt(hudScene, W / 2, TOP + 30, 'Choose a Subject', 14, CLR.gold).setOrigin(0.5, 0));
        ct.add(_txt(hudScene, W / 2, TOP + 56, 'Prof. Elara\'s Pop Quiz — 10 Questions', 8, '#778899').setOrigin(0.5, 0));

        const setKeys = Object.keys(QUESTION_SETS);
        const btnW = 400, btnH = 70, gap = 16;
        const totalH = setKeys.length * (btnH + gap) - gap;
        const startY = TOP + (AREA_H - totalH) / 2 + 20;

        setKeys.forEach((key, i) => {
            const set = QUESTION_SETS[key];
            const bx = (W - btnW) / 2;
            const by = startY + i * (btnH + gap);

            const abg = hudScene.add.graphics();
            abg.fillStyle(0x2A3A52, 0.95);
            abg.fillRoundedRect(bx, by, btnW, btnH, 8);
            abg.lineStyle(2, 0x4A5F7B, 0.6);
            abg.strokeRoundedRect(bx, by, btnW, btnH, 8);
            ct.add(abg);

            const numLabel = _txt(hudScene, bx + 16, by + btnH / 2 - 8, `${i + 1}.`, 10, '#667788');
            ct.add(numLabel);

            const nameLabel = _txt(hudScene, bx + 50, by + btnH / 2 - 8, set.name, 11, set.color);
            ct.add(nameLabel);

            const countLabel = _txt(hudScene, bx + btnW - 16, by + btnH / 2 - 8, `${set.questions.length} questions`, 7, '#556677');
            countLabel.setOrigin(1, 0);
            ct.add(countLabel);

            const hit = hudScene.add.rectangle(bx + btnW / 2, by + btnH / 2, btnW, btnH, 0, 0)
                .setInteractive({ useHandCursor: true });
            ct.add(hit);

            hit.on('pointerover', () => {
                abg.clear();
                abg.fillStyle(0x3A5070, 0.95);
                abg.fillRoundedRect(bx, by, btnW, btnH, 8);
                abg.lineStyle(2, 0x6A8FAB, 0.8);
                abg.strokeRoundedRect(bx, by, btnW, btnH, 8);
            });
            hit.on('pointerout', () => {
                abg.clear();
                abg.fillStyle(0x2A3A52, 0.95);
                abg.fillRoundedRect(bx, by, btnW, btnH, 8);
                abg.lineStyle(2, 0x4A5F7B, 0.6);
                abg.strokeRoundedRect(bx, by, btnW, btnH, 8);
            });
            hit.on('pointerdown', () => {
                if (hudScene._minigamePaused) return;
                ct.destroy();
                keyPoll.destroy();
                numKeys.forEach(k => k.destroy());
                this._startQuiz(hudScene, onFinish, key);
            });
        });

        // Number keys 1-4
        const numKeys = setKeys.map((_, i) =>
            hudScene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE + i)
        );
        const keyPoll = hudScene.time.addEvent({
            delay: 50, loop: true,
            callback: () => {
                if (hudScene._minigamePaused) return;
                for (let i = 0; i < numKeys.length; i++) {
                    if (Phaser.Input.Keyboard.JustDown(numKeys[i])) {
                        ct.destroy();
                        keyPoll.destroy();
                        numKeys.forEach(k => k.destroy());
                        this._startQuiz(hudScene, onFinish, setKeys[i]);
                        return;
                    }
                }
            }
        });
    },

    // ── Quiz Flow ──
    _startQuiz(hudScene, onFinish, setKey) {
        const set = QUESTION_SETS[setKey];
        const questions = shuffle([...set.questions]).slice(0, 10);
        let qIdx = 0;
        let playerScore = 0;
        let samScore = 0;
        const results = [];

        const ct = hudScene.add.container(0, 0).setDepth(500);

        const bg = hudScene.add.rectangle(W / 2, TOP + AREA_H / 2, W, AREA_H, 0x0E1620, 1).setInteractive();
        ct.add(bg);

        // Header
        const headerBg = hudScene.add.graphics();
        headerBg.fillStyle(0x1A2438, 0.95);
        headerBg.fillRoundedRect(20, TOP + 8, W - 40, 50, 8);
        ct.add(headerBg);
        ct.add(_txt(hudScene, W / 2, TOP + 18, set.name, 13, set.color).setOrigin(0.5, 0));
        const scoreText = _txt(hudScene, W / 2, TOP + 38, 'You: 0  |  Sam: 0', 9, '#AABBCC').setOrigin(0.5, 0);
        ct.add(scoreText);
        const counterText = _txt(hudScene, W - 40, TOP + 14, '1/10', 9, '#667788').setOrigin(1, 0);
        ct.add(counterText);

        // Question box
        const qBoxY = TOP + 70;
        const qBoxH = 90;
        const qBg = hudScene.add.graphics();
        qBg.fillStyle(0x1A2438, 0.9);
        qBg.fillRoundedRect(40, qBoxY, W - 80, qBoxH, 8);
        qBg.lineStyle(2, 0x3D4F6B, 0.8);
        qBg.strokeRoundedRect(40, qBoxY, W - 80, qBoxH, 8);
        ct.add(qBg);
        const qText = _txt(hudScene, 60, qBoxY + 14, '', 10, '#EEEEFF', W - 140);
        ct.add(qText);

        let ansContainer = hudScene.add.container(0, 0);
        ct.add(ansContainer);
        let revealContainer = hudScene.add.container(0, 0);
        ct.add(revealContainer);

        // Shared keys
        const eKey = hudScene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
        let pendingAction = null;

        const renderQuestion = () => {
            const q = questions[qIdx];
            counterText.setText(`${qIdx + 1}/10`);
            qText.setText(q.q);
            scoreText.setText(`You: ${playerScore}  |  Sam: ${samScore}`);
            ansContainer.removeAll(true);
            revealContainer.removeAll(true);
            pendingAction = null;

            const btnW = (W - 120) / 2;
            const btnH = 50;
            const startY = TOP + 174;
            const gapX = 16, gapY = 12;

            q.answers.forEach((ans, i) => {
                const col = i % 2;
                const row = Math.floor(i / 2);
                const bx = 40 + col * (btnW + gapX);
                const by = startY + row * (btnH + gapY);

                const abg = hudScene.add.graphics();
                abg.fillStyle(0x2A3A52, 0.95);
                abg.fillRoundedRect(bx, by, btnW, btnH, 6);
                abg.lineStyle(1, 0x4A5F7B, 0.6);
                abg.strokeRoundedRect(bx, by, btnW, btnH, 6);
                ansContainer.add(abg);

                const label = ['A', 'B', 'C', 'D'][i];
                const aText = _txt(hudScene, bx + 14, by + btnH / 2, `${label}. ${ans}`, 9, '#CCDDEE', btnW - 28);
                aText.setOrigin(0, 0.5);
                ansContainer.add(aText);

                const hit = hudScene.add.rectangle(bx + btnW / 2, by + btnH / 2, btnW, btnH, 0, 0)
                    .setInteractive({ useHandCursor: true });
                ansContainer.add(hit);

                hit.on('pointerover', () => {
                    abg.clear();
                    abg.fillStyle(0x3A5070, 0.95);
                    abg.fillRoundedRect(bx, by, btnW, btnH, 6);
                    abg.lineStyle(1, 0x6A8FAB, 0.8);
                    abg.strokeRoundedRect(bx, by, btnW, btnH, 6);
                });
                hit.on('pointerout', () => {
                    abg.clear();
                    abg.fillStyle(0x2A3A52, 0.95);
                    abg.fillRoundedRect(bx, by, btnW, btnH, 6);
                    abg.lineStyle(1, 0x4A5F7B, 0.6);
                    abg.strokeRoundedRect(bx, by, btnW, btnH, 6);
                });
                hit.on('pointerdown', () => { if (!hudScene._minigamePaused) handleAnswer(i); });
            });

            if (!ct.getData('keys')) {
                const keys = [
                    hudScene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
                    hudScene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
                    hudScene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE),
                    hudScene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FOUR),
                ];
                ct.setData('keys', keys);
            }
            ct.setData('keysActive', true);
        };

        const keyPoll = hudScene.time.addEvent({
            delay: 50, loop: true,
            callback: () => {
                if (hudScene._minigamePaused) return;
                if (pendingAction && Phaser.Input.Keyboard.JustDown(eKey)) {
                    const action = pendingAction;
                    pendingAction = null;
                    action();
                    return;
                }
                if (!ct.getData('keysActive')) return;
                const keys = ct.getData('keys');
                if (!keys) return;
                for (let i = 0; i < 4; i++) {
                    if (Phaser.Input.Keyboard.JustDown(keys[i])) {
                        handleAnswer(i);
                        return;
                    }
                }
            }
        });

        const handleAnswer = (playerAns) => {
            ct.setData('keysActive', false);
            const q = questions[qIdx];
            const sAns = samAnswer(q.correct);
            if (playerAns === q.correct) playerScore++;
            if (sAns === q.correct) samScore++;
            results.push({ playerAns, samAns: sAns, correct: q.correct });
            showReveal(q, playerAns, sAns);
        };

        const showReveal = (q, playerAns, sAns) => {
            revealContainer.removeAll(true);
            ansContainer.list.forEach(obj => { if (obj.input) obj.removeInteractive(); });

            const btnW = (W - 120) / 2;
            const btnH = 50;
            const startY = TOP + 174;
            const gapX = 16, gapY = 12;

            q.answers.forEach((ans, i) => {
                const col = i % 2;
                const row = Math.floor(i / 2);
                const bx = 40 + col * (btnW + gapX);
                const by = startY + row * (btnH + gapY);

                const isCorrect = i === q.correct;
                const isPlayer = i === playerAns;
                const isSam = i === sAns;

                let fillColor = 0x222838;
                let borderColor = 0x3A4A5A;
                if (isCorrect) { fillColor = 0x2A5A2A; borderColor = 0x44AA44; }
                else if (isPlayer) { fillColor = 0x5A2A2A; borderColor = 0xAA4444; }

                const overlay = hudScene.add.graphics();
                overlay.fillStyle(fillColor, 0.95);
                overlay.fillRoundedRect(bx, by, btnW, btnH, 6);
                overlay.lineStyle(2, borderColor, 0.9);
                overlay.strokeRoundedRect(bx, by, btnW, btnH, 6);
                revealContainer.add(overlay);

                const indicators = [];
                if (isPlayer) indicators.push('You');
                if (isSam) indicators.push('Sam');
                if (indicators.length > 0) {
                    const indText = _txt(hudScene, bx + btnW - 8, by + 6, indicators.join(' & '), 7, isCorrect ? '#88EE88' : '#EE8888');
                    indText.setOrigin(1, 0);
                    revealContainer.add(indText);
                }
                if (isCorrect) {
                    const checkmark = _txt(hudScene, bx + btnW - 8, by + btnH - 8, 'Correct', 7, '#66DD66');
                    checkmark.setOrigin(1, 1);
                    revealContainer.add(checkmark);
                }
            });

            scoreText.setText(`You: ${playerScore}  |  Sam: ${samScore}`);

            const playerCorrect = playerAns === q.correct;
            const samCorrect = sAns === q.correct;
            let msg = '', msgColor = '#AABBCC';
            if (playerCorrect && samCorrect) { msg = 'You both got it right!'; msgColor = '#88CCAA'; }
            else if (playerCorrect) { msg = 'You got it! Sam missed this one.'; msgColor = '#88DD88'; }
            else if (samCorrect) { msg = 'Sam got it right. Better luck next time!'; msgColor = '#DDAA88'; }
            else { msg = 'Nobody got this one right!'; msgColor = '#CC8888'; }

            revealContainer.add(_txt(hudScene, W / 2, TOP + 310, msg, 9, msgColor).setOrigin(0.5, 0));

            const isLast = qIdx >= 9;
            const contY = TOP + 345;
            const contBg = hudScene.add.graphics();
            contBg.fillStyle(0x2A4A5A, 0.9);
            contBg.fillRoundedRect(W / 2 - 100, contY, 200, 36, 6);
            contBg.lineStyle(1, 0x5A8AAA, 0.7);
            contBg.strokeRoundedRect(W / 2 - 100, contY, 200, 36, 6);
            revealContainer.add(contBg);
            revealContainer.add(_txt(hudScene, W / 2, contY + 18, isLast
                ? (window.__havenwoodMobileMode ? 'Tap See Results' : '[E] See Results')
                : (window.__havenwoodMobileMode ? 'Tap Next Question' : '[E] Next Question'), 9, '#CCEEEE').setOrigin(0.5, 0.5));
            const contHit = hudScene.add.rectangle(W / 2, contY + 18, 200, 36, 0, 0).setInteractive({ useHandCursor: true });
            revealContainer.add(contHit);

            const contAction = () => {
                if (isLast) showFinalResults();
                else { qIdx++; renderQuestion(); }
            };
            contHit.on('pointerdown', () => { if (!hudScene._minigamePaused) contAction(); });
            pendingAction = contAction;
        };

        const showFinalResults = () => {
            ansContainer.removeAll(true);
            revealContainer.removeAll(true);
            qText.setText('');
            qBg.clear();

            const resultTitle = playerScore > samScore ? 'You Win!' :
                                samScore > playerScore ? 'Sam Wins!' : 'It\'s a Tie!';
            const resultColor = playerScore > samScore ? '#88EE88' :
                                samScore > playerScore ? '#EE8888' : '#EEDD88';

            revealContainer.add(_txt(hudScene, W / 2, TOP + 50, resultTitle, 16, resultColor).setOrigin(0.5, 0));
            revealContainer.add(_txt(hudScene, W / 2, TOP + 80, `You: ${playerScore}/10  |  Sam: ${samScore}/10`, 11, '#CCDDEE').setOrigin(0.5, 0));

            let grade = 'F';
            if (playerScore >= 9) grade = 'A+';
            else if (playerScore >= 8) grade = 'A';
            else if (playerScore >= 7) grade = 'B+';
            else if (playerScore >= 6) grade = 'B';
            else if (playerScore >= 5) grade = 'C';
            else if (playerScore >= 4) grade = 'D';

            revealContainer.add(_txt(hudScene, W / 2, TOP + 106, `Grade: ${grade}`, 12, CLR.gold).setOrigin(0.5, 0));

            const listY = TOP + 136;
            const rowH = 24;
            results.forEach((r, i) => {
                const q = questions[i];
                const y = listY + i * rowH;
                if (y > BOT - 60) return;

                const playerRight = r.playerAns === r.correct;
                const samRight = r.samAns === r.correct;
                const shortQ = q.q.length > 50 ? q.q.slice(0, 47) + '...' : q.q;

                revealContainer.add(_txt(hudScene, 40, y, `${i + 1}.`, 8, '#667788'));
                revealContainer.add(_txt(hudScene, 68, y, shortQ, 8, '#AABBCC', W - 280));
                revealContainer.add(_txt(hudScene, W - 130, y, `You ${playerRight ? '[O]' : '[X]'}`, 8, playerRight ? '#66DD66' : '#DD6666'));
                revealContainer.add(_txt(hudScene, W - 60, y, `Sam ${samRight ? '[O]' : '[X]'}`, 8, samRight ? '#66DD66' : '#DD6666'));
            });

            const bonusKnowledge = Math.floor(playerScore * 1.5);
            revealContainer.add(_txt(hudScene, W / 2, BOT - 56, `+${bonusKnowledge} Knowledge earned!`, 9, '#88CCAA').setOrigin(0.5, 0));

            const closeY = BOT - 34;
            const closeBg = hudScene.add.graphics();
            closeBg.fillStyle(0x2A4A5A, 0.9);
            closeBg.fillRoundedRect(W / 2 - 100, closeY, 200, 34, 6);
            closeBg.lineStyle(1, 0x5A8AAA, 0.7);
            closeBg.strokeRoundedRect(W / 2 - 100, closeY, 200, 34, 6);
            revealContainer.add(closeBg);
            revealContainer.add(_txt(hudScene, W / 2, closeY + 17, window.__havenwoodMobileMode ? 'Tap Finish Class' : '[E] Finish Class', 9, '#CCEEEE').setOrigin(0.5, 0.5));
            const closeHit = hudScene.add.rectangle(W / 2, closeY + 17, 200, 34, 0, 0).setInteractive({ useHandCursor: true });
            revealContainer.add(closeHit);

            const finishAction = () => {
                pendingAction = null;
                keyPoll.destroy();
                eKey.destroy();
                const keys = ct.getData('keys');
                if (keys) keys.forEach(k => k.destroy());
                hudScene._minigameActive = false;
                hudScene._minigamePaused = false;
                ct.destroy();
                if (onFinish) onFinish({ playerScore, samScore, bonusKnowledge, grade });
            };
            closeHit.on('pointerdown', () => { if (!hudScene._minigamePaused) finishAction(); });
            pendingAction = finishAction;
        };

        renderQuestion();
    },
};

export default MetaClassQuiz;
