// MetaNPCs — NPC definitions for the meta-world.
// Each NPC has a sprite key, dialogue branches, and action handlers.

import MetaState from './MetaStateManager.js';

const NPCS = {
    prof_elara: {
        id: 'prof_elara',
        name: 'Prof. Elara',
        spriteKey: 'npc_elara',
        facing: 'down',

        getDialogue() {
            const s = MetaState.state;
            const attendedToday = MetaState.hasFlag(`class_day_${s.day}`);

            if (s.energy < 15) {
                return {
                    speaker: 'Prof. Elara',
                    lines: ['You look exhausted.', 'Get some rest before coming to class.'],
                };
            }

            if (attendedToday) {
                return {
                    speaker: 'Prof. Elara',
                    lines: ['Great work today!', 'Come back tomorrow for the next lecture.'],
                };
            }

            if (!MetaState.hasMetNPC('prof_elara')) {
                return {
                    speaker: 'Prof. Elara',
                    lines: [
                        'Welcome! I\'m Professor Elara.',
                        'I teach Wildlife Biology here.',
                        'Ready for your first lesson?',
                    ],
                    choices: [
                        { label: 'Attend class (-15 energy, 1hr)', action: 'attend_class' },
                        { label: 'Maybe later', action: 'cancel' },
                    ],
                };
            }

            return {
                speaker: 'Prof. Elara',
                lines: ['Good to see you again!', 'Ready for today\'s lecture?'],
                choices: [
                    { label: 'Attend class (-15 energy, 1hr)', action: 'attend_class' },
                    { label: 'Just saying hi', action: 'cancel' },
                ],
            };
        },

        handleAction(action, hudScene) {
            if (action === 'cancel') return;
            if (action === 'attend_class') {
                if (!MetaState.spendEnergy(15)) {
                    hudScene.showNotification('Too tired!');
                    return;
                }
                MetaState.meetNPC('prof_elara');
                MetaState.advanceTime(60);
                MetaState.addKnowledge(10);
                MetaState.addMood(5);
                MetaState.state.classesAttended++;
                MetaState.setFlag(`class_day_${MetaState.state.day}`);
                hudScene.refreshStatusBar();
                hudScene.showNotification('+10 Knowledge, +5 Mood');
            }
        },
    },
};

export function getNPC(id) {
    return NPCS[id] || null;
}

export function getAllNPCIds() {
    return Object.keys(NPCS);
}
