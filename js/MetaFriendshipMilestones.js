// MetaFriendshipMilestones — Friendship milestone events and passive effects.
// Triggers special one-time dialogue scenes when friendship thresholds are crossed.
// Returns dialogue configs for the scene layer to display.

import MetaState from './MetaStateManager.js';

const MILESTONES = {
    sam: [
        {
            threshold: 50,
            id: 'sam_50',
            flag: 'sam_study_spot',
            dialogue: {
                speaker: 'Sam',
                lines: [
                    'Hey... I want to show you something.',
                    'There\'s this secret study spot behind the library.',
                    'It\'s my favorite place on campus — super quiet.',
                    'Now it can be ours. You\'ll get a bonus when studying at the library!',
                ],
            },
            reward: { mood: 15 },
            notification: 'Sam shared a secret study spot! +15 Mood',
        },
        {
            threshold: 80,
            id: 'sam_80',
            flag: 'sam_best_friend',
            dialogue: {
                speaker: 'Sam',
                lines: [
                    'You know... you\'re like my best friend here.',
                    'College would have been so different without you.',
                    'Let\'s keep doing great things — together!',
                ],
            },
            reward: { mood: 20, money: 25 },
            notification: 'Best friends with Sam! +20 Mood, +$25',
        },
    ],
    prof_elara: [
        {
            threshold: 50,
            id: 'elara_50',
            flag: 'elara_extra_credit',
            dialogue: {
                speaker: 'Prof. Elara',
                lines: [
                    'Your performance has been outstanding.',
                    'I\'m giving you extra credit — your studies will be more effective from now on!',
                ],
            },
            reward: { knowledge: 10 },
            notification: 'Extra credit from Prof. Elara! +10 Knowledge',
        },
        {
            threshold: 80,
            id: 'elara_80',
            flag: 'elara_research_partner',
            dialogue: {
                speaker: 'Prof. Elara',
                lines: [
                    'I\'ve been watching your progress closely.',
                    'I\'d like to offer you a research partnership.',
                    'You\'ll gain passive knowledge each day from our collaboration.',
                    'Welcome to the team!',
                ],
            },
            reward: { knowledge: 5, mood: 10 },
            notification: 'Research partnership with Prof. Elara! +5 Knowledge/day',
        },
    ],
    shopkeeper: [
        {
            threshold: 50,
            id: 'tanaka_50',
            flag: 'tanaka_insider',
            dialogue: {
                speaker: 'Mr. Tanaka',
                lines: [
                    'You\'re one of my most loyal customers.',
                    'Tell you what — I\'ll let you know when special stock comes in.',
                    'Consider yourself an insider!',
                ],
            },
            reward: { money: 15, mood: 10 },
            notification: 'Tanaka\'s insider! +$15, +10 Mood',
        },
        {
            threshold: 80,
            id: 'tanaka_80',
            flag: 'tanaka_discount',
            dialogue: {
                speaker: 'Mr. Tanaka',
                lines: [
                    'You\'ve been such a loyal customer and friend.',
                    'From now on, everything in the shop is 20% off for you.',
                    'And your work shifts pay 20% more too.',
                    'Consider it a friendship discount!',
                ],
            },
            reward: { money: 30 },
            notification: 'Tanaka\'s Friendship Discount! 20% off & 20% more pay',
        },
    ],
};

const MetaFriendshipMilestones = {
    // Check if any milestones should trigger for the given NPC.
    // Returns a milestone dialogue config if one should fire, or null.
    checkMilestones(npcId, newValue) {
        const npcMilestones = MILESTONES[npcId];
        if (!npcMilestones) return null;

        const triggered = MetaState.state.friendshipMilestones || {};

        for (const ms of npcMilestones) {
            if (newValue >= ms.threshold && !triggered[ms.id]) {
                // Mark as triggered
                if (!MetaState.state.friendshipMilestones) MetaState.state.friendshipMilestones = {};
                MetaState.state.friendshipMilestones[ms.id] = true;

                // Set flag
                if (ms.flag) MetaState.setFlag(ms.flag);

                // Apply immediate rewards
                if (ms.reward) {
                    if (ms.reward.mood) MetaState.addMood(ms.reward.mood);
                    if (ms.reward.money) MetaState.addMoney(ms.reward.money);
                    if (ms.reward.knowledge) MetaState.addKnowledge(ms.reward.knowledge);
                    if (ms.reward.energy) MetaState.addEnergy(ms.reward.energy);
                }

                return {
                    dialogue: ms.dialogue,
                    notification: ms.notification,
                };
            }
        }
        return null;
    },

    // Get daily passive effects from active milestone flags.
    // Called during nextDay processing.
    applyDailyPassives() {
        const effects = [];

        // Elara research partnership: +5 knowledge/day
        if (MetaState.hasFlag('elara_research_partner')) {
            MetaState.addKnowledge(5);
            effects.push('+5 Knowledge (Research Partnership)');
        }

        return effects;
    },
};

export default MetaFriendshipMilestones;
