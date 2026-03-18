// MetaCrossModeUnlocks — Bidirectional unlock system between meta-world and Havenwood.
// Checked at mode transitions (phone pull-out / put-away).

import MetaState from './MetaStateManager.js';

const UNLOCKS = [
    {
        id: 'wildlife_101',
        name: 'Wildlife 101',
        desc: 'Your first class grants research points in Havenwood',
        direction: 'meta->havenwood',
        condition: () => MetaState.state.classesAttended >= 1,
        apply: (gameState) => { gameState.researchPoints = (gameState.researchPoints || 0) + 2; },
        notification: '+2 Research Points from studying!',
    },
    {
        id: 'job_premium',
        name: 'Part-Time Pay',
        desc: 'Your first shift converts to sanctuary coins',
        direction: 'meta->havenwood',
        condition: () => MetaState.state.shiftsWorked >= 1,
        apply: (gameState) => { gameState.coins += 50; },
        notification: '+50 Coins from your paycheck!',
    },
    {
        id: 'sanctuary_rep',
        name: 'Campus Celebrity',
        desc: 'Havenwood reputation boosts your mood',
        direction: 'havenwood->meta',
        condition: (gameState) => (gameState.rep || 0) >= 100,
        apply: () => { MetaState.addMood(20); },
        notification: 'Your sanctuary fame boosts your mood!',
    },
    {
        id: 'study_grant',
        name: 'Research Grant',
        desc: 'Attending 3+ classes earns research points',
        direction: 'meta->havenwood',
        condition: () => MetaState.state.classesAttended >= 3,
        apply: (gameState) => { gameState.researchPoints = (gameState.researchPoints || 0) + 5; },
        notification: '+5 Research Points from your studies!',
    },
    {
        id: 'employee_perks',
        name: 'Employee Perks',
        desc: 'Working 3+ shifts earns bonus food',
        direction: 'meta->havenwood',
        condition: () => MetaState.state.shiftsWorked >= 3,
        apply: (gameState) => { gameState.food = (gameState.food || 0) + 100; },
        notification: '+100 Food from employee perks!',
    },
    {
        id: 'social_network',
        name: 'Social Network',
        desc: 'Knowing all NPCs boosts sanctuary visitors',
        direction: 'meta->havenwood',
        condition: () => MetaState.state.npcsMetSet.length >= 3,
        apply: (gameState) => { gameState.rep = (gameState.rep || 0) + 50; },
        notification: '+50 Reputation from campus connections!',
    },
    {
        id: 'animal_lover',
        name: 'Animal Lover',
        desc: 'Having 5+ animals boosts your mood',
        direction: 'havenwood->meta',
        condition: (gameState) => (gameState.animals || []).length >= 5,
        apply: () => { MetaState.addMood(15); MetaState.addMoney(25); },
        notification: 'Your animals inspire you! +15 Mood, +$25',
    },
    {
        id: 'knowledge_mastery',
        name: 'Wildlife Expert',
        desc: 'High knowledge unlocks advanced research',
        direction: 'meta->havenwood',
        condition: () => MetaState.state.knowledge >= 50,
        apply: (gameState) => { gameState.researchPoints = (gameState.researchPoints || 0) + 10; },
        notification: '+10 Research Points — Your expertise pays off!',
    },
    {
        id: 'close_friends',
        name: 'Inner Circle',
        desc: 'Having close friends boosts everything',
        direction: 'meta->havenwood',
        condition: () => {
            let closeFriends = 0;
            for (const id of MetaState.state.npcsMetSet) {
                if (MetaState.getFriendship(id) >= 80) closeFriends++;
            }
            return closeFriends >= 2;
        },
        apply: (gameState) => {
            gameState.researchPoints = (gameState.researchPoints || 0) + 8;
            gameState.coins += 100;
        },
        notification: '+8 Research, +100 Coins — Your friends help out!',
    },
    {
        id: 'quest_master',
        name: 'Quest Master',
        desc: 'Completing quests earns sanctuary rewards',
        direction: 'meta->havenwood',
        condition: () => MetaState.state.questsCompleted >= 3,
        apply: (gameState) => {
            gameState.rep = (gameState.rep || 0) + 100;
            gameState.food = (gameState.food || 0) + 200;
        },
        notification: '+100 Rep, +200 Food — Quest mastery!',
    },
    {
        id: 'park_naturalist',
        name: 'Park Naturalist',
        desc: 'Picking flowers in the park earns treats for your animals',
        direction: 'meta->havenwood',
        condition: () => MetaState.state.inventory.filter(i => i === 'flower').length >= 3,
        apply: (gameState) => { gameState.food = (gameState.food || 0) + 75; },
        notification: '+75 Food — Your nature skills help your animals!',
    },
    {
        id: 'campus_cook',
        name: 'Campus Cook',
        desc: 'Buying lots of food supplies earns bonus coins',
        direction: 'meta->havenwood',
        condition: () => MetaState.state.pendingFood >= 100,
        apply: (gameState) => { gameState.coins += 75; },
        notification: '+75 Coins — Bulk buyer bonus!',
    },
    {
        id: 'sanctuary_scholar',
        name: 'Sanctuary Scholar',
        desc: 'A thriving sanctuary with 10+ animals boosts knowledge',
        direction: 'havenwood->meta',
        condition: (gameState) => (gameState.animals || []).length >= 10,
        apply: () => { MetaState.addKnowledge(15); MetaState.addMoney(40); },
        notification: '+15 Knowledge, +$40 — Your sanctuary inspires your studies!',
    },
    {
        id: 'npc_ambassador',
        name: 'NPC Ambassador',
        desc: 'NPC visitors to your sanctuary boost reputation',
        direction: 'havenwood->meta',
        condition: () => MetaState.state.npcVisitsTotal >= 3,
        apply: () => { MetaState.addMood(10); MetaState.addMoney(30); },
        notification: '+10 Mood, +$30 — Your friends love visiting!',
    },
    {
        id: 'happy_animals',
        name: 'Happy Animals',
        desc: 'High sanctuary reputation means happier animals and happier you',
        direction: 'havenwood->meta',
        condition: (gameState) => (gameState.rep || 0) >= 300,
        apply: () => { MetaState.addMood(25); MetaState.addEnergy(20); },
        notification: '+25 Mood, +20 Energy — Your sanctuary thrives!',
    },
];

const MetaCrossModeUnlocks = {
    // Check and apply unlocks for a given direction.
    // Returns array of notification strings for newly applied unlocks.
    checkAndApply(direction, gameState) {
        const notifications = [];
        for (const unlock of UNLOCKS) {
            if (unlock.direction !== direction) continue;
            if (MetaState.hasUnlock(unlock.id)) continue;

            const conditionMet = direction === 'meta->havenwood'
                ? unlock.condition()
                : unlock.condition(gameState);

            if (conditionMet) {
                if (direction === 'meta->havenwood') {
                    unlock.apply(gameState);
                } else {
                    unlock.apply();
                }
                MetaState.grantUnlock(unlock.id);
                notifications.push(unlock.notification);
            }
        }
        return notifications;
    },
};

export default MetaCrossModeUnlocks;
