// MetaNPCs — NPC definitions for the meta-world.
// Each NPC has a sprite key, schedule, dialogue branches, and action handlers.
// Schedule: array of { days: [0-6], start, end (minutes), location, gx, gy }
// days: 0=Mon..4=Fri, 5=Sat, 6=Sun

import MetaState from './MetaStateManager.js';

const WEEKDAYS = [0, 1, 2, 3, 4];
const WEEKEND = [5, 6];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

const NPCS = {
    prof_elara: {
        id: 'prof_elara',
        name: 'Prof. Elara',
        spriteKey: 'npc_elara',
        facing: 'down',

        // Weekdays 8am-5pm on campus quad
        schedule: [
            { days: WEEKDAYS, start: 480, end: 1020, location: 'campus_quad', gx: 7, gy: 6 },
        ],

        getDialogue() {
            const s = MetaState.state;

            // Weekend — no classes
            if (s.dayOfWeek >= 5) {
                return {
                    speaker: 'Prof. Elara',
                    lines: ['No classes on weekends!', 'Enjoy your time off.', 'Try the café — their weekend specials are great.'],
                };
            }

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

    sam: {
        id: 'sam',
        name: 'Sam',
        spriteKey: 'npc_sam',
        facing: 'down',

        // Weekdays: library mornings, quad afternoons
        // Weekends: café
        schedule: [
            { days: WEEKDAYS, start: 540, end: 720, location: 'library', gx: 8, gy: 4 },
            { days: WEEKDAYS, start: 840, end: 1080, location: 'campus_quad', gx: 6, gy: 2 },
            { days: WEEKEND, start: 600, end: 960, location: 'cafe', gx: 4, gy: 3 },
        ],

        getDialogue() {
            const s = MetaState.state;
            const hungOut = MetaState.hasFlag(`hangout_day_${s.day}`);

            if (s.energy < 10) {
                return {
                    speaker: 'Sam',
                    lines: ['Whoa, you look beat!', 'Go get some rest, we can hang later.'],
                };
            }

            if (hungOut) {
                return {
                    speaker: 'Sam',
                    lines: ['Had fun earlier!', 'See you tomorrow?'],
                };
            }

            if (!MetaState.hasMetNPC('sam')) {
                return {
                    speaker: 'Sam',
                    lines: [
                        'Hey! I\'m Sam.',
                        'I\'m studying wildlife conservation too.',
                        'We should hang out sometime!',
                    ],
                    choices: [
                        { label: 'Hang out (-10 energy, 30min)', action: 'hangout' },
                        { label: 'Nice to meet you!', action: 'cancel' },
                    ],
                };
            }

            // Weekend flavor
            if (s.dayOfWeek >= 5) {
                return {
                    speaker: 'Sam',
                    lines: ['Weekend vibes!', 'Want to hang out?'],
                    choices: [
                        { label: 'Hang out (-10 energy, 30min)', action: 'hangout' },
                        { label: 'Just chilling', action: 'cancel' },
                    ],
                };
            }

            return {
                speaker: 'Sam',
                lines: ['Hey! Want to hang out?'],
                choices: [
                    { label: 'Hang out (-10 energy, 30min)', action: 'hangout' },
                    { label: 'Just passing through', action: 'cancel' },
                ],
            };
        },

        handleAction(action, hudScene) {
            if (action === 'cancel') return;
            if (action === 'hangout') {
                if (!MetaState.spendEnergy(10)) {
                    hudScene.showNotification('Too tired!');
                    return;
                }
                MetaState.meetNPC('sam');
                MetaState.advanceTime(30);
                MetaState.addMood(15);
                MetaState.setFlag(`hangout_day_${MetaState.state.day}`);
                hudScene.refreshStatusBar();
                hudScene.showNotification('+15 Mood — Good times!');
            }
        },
    },

    shopkeeper: {
        id: 'shopkeeper',
        name: 'Mr. Tanaka',
        spriteKey: 'npc_shopkeeper',
        facing: 'down',

        // Every day 8am-8pm
        schedule: [
            { days: ALL_DAYS, start: 480, end: 1200, location: 'pet_store', gx: 9, gy: 3 },
        ],

        getDialogue() {
            if (!MetaState.hasMetNPC('shopkeeper')) {
                return {
                    speaker: 'Mr. Tanaka',
                    lines: [
                        'Welcome to Paws & Claws!',
                        'I\'m Tanaka. We sell supplies for animal sanctuaries.',
                        'What can I get you?',
                    ],
                    choices: [
                        { label: 'Food Supplies ($20)', action: 'buy_food_supplies' },
                        { label: 'Treats ($15)', action: 'buy_treats' },
                        { label: 'Just browsing', action: 'cancel' },
                    ],
                };
            }

            return {
                speaker: 'Mr. Tanaka',
                lines: ['What can I get you today?'],
                choices: [
                    { label: 'Food Supplies ($20)', action: 'buy_food_supplies' },
                    { label: 'Treats ($15)', action: 'buy_treats' },
                    { label: 'Just looking', action: 'cancel' },
                ],
            };
        },

        handleAction(action, hudScene) {
            if (action === 'cancel') return;
            MetaState.meetNPC('shopkeeper');

            if (action === 'buy_food_supplies') {
                if (!MetaState.spendMoney(20)) {
                    hudScene.showNotification('Not enough money!');
                    return;
                }
                MetaState.state.pendingFood = (MetaState.state.pendingFood || 0) + 50;
                hudScene.refreshStatusBar();
                hudScene.showNotification('Bought food supplies for your sanctuary!');
            }

            if (action === 'buy_treats') {
                if (!MetaState.spendMoney(15)) {
                    hudScene.showNotification('Not enough money!');
                    return;
                }
                MetaState.state.pendingTreats = (MetaState.state.pendingTreats || 0) + 1;
                hudScene.refreshStatusBar();
                hudScene.showNotification('Bought treats for your animals!');
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

// Returns NPCs that should be at a given location right now based on schedules
export function getNPCsAtLocation(locationId) {
    const s = MetaState.state;
    const results = [];
    for (const npc of Object.values(NPCS)) {
        if (!npc.schedule) continue;
        for (const slot of npc.schedule) {
            if (slot.location === locationId &&
                slot.days.includes(s.dayOfWeek) &&
                s.timeOfDay >= slot.start && s.timeOfDay < slot.end) {
                results.push({ id: npc.id, gx: slot.gx, gy: slot.gy });
                break;
            }
        }
    }
    return results;
}
