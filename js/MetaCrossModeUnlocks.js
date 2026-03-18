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
