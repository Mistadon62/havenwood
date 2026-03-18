// MetaJobs — Part-time job system for the meta-world.
// Offers multiple job activities with performance ratings and Tanaka friendship gates.

import MetaState from './MetaStateManager.js';

const JOB_ACTIVITIES = {
    stock_shelves: {
        name: 'Stock Shelves',
        desc: 'Organize the store shelves.',
        energyCost: 20,
        time: 90,
        basePay: 25,
        minLevel: 0,
    },
    sort_mail: {
        name: 'Sort Campus Mail',
        desc: 'Sort and deliver campus mail.',
        energyCost: 15,
        time: 60,
        basePay: 20,
        minLevel: 0,
    },
    assist_animals: {
        name: 'Assist at Clinic',
        desc: 'Help at the campus animal clinic.',
        energyCost: 30,
        time: 120,
        basePay: 40,
        minLevel: 1,
    },
    manage_inventory: {
        name: 'Manage Inventory',
        desc: 'Full inventory management and ordering.',
        energyCost: 25,
        time: 90,
        basePay: 35,
        minLevel: 2,
    },
};

// Friendship thresholds for job levels
const LEVEL_THRESHOLDS = [0, 30, 60]; // Level 0: any, Level 1: 30+ friendship, Level 2: 60+

function getJobLevel() {
    const friendship = MetaState.getFriendship('shopkeeper');
    if (friendship >= LEVEL_THRESHOLDS[2]) return 2;
    if (friendship >= LEVEL_THRESHOLDS[1]) return 1;
    return 0;
}

function rollPerformance() {
    let score = Math.floor(Math.random() * 70) + 15; // 15-84 base
    if (MetaState.state.mood > 60) score += 10;
    if (MetaState.state.knowledge > 30) score += 10;
    if (MetaState.getFriendship('shopkeeper') >= 50) score += 10;

    if (score >= 85) return { rating: 'excellent', mult: 1.5, moodChange: 5, friendChange: 2, label: 'Excellent!' };
    if (score >= 60) return { rating: 'good', mult: 1.2, moodChange: 3, friendChange: 1, label: 'Good job!' };
    if (score >= 30) return { rating: 'ok', mult: 1.0, moodChange: 0, friendChange: 0, label: 'Decent work.' };
    return { rating: 'poor', mult: 0.7, moodChange: -2, friendChange: 0, label: 'Rough day...' };
}

const MetaJobs = {
    // Get available job activities for the player's current level
    getAvailableJobs() {
        const level = getJobLevel();
        const jobs = [];
        for (const [id, job] of Object.entries(JOB_ACTIVITIES)) {
            if (job.minLevel <= level) {
                jobs.push({ id, ...job });
            }
        }
        return jobs;
    },

    // Check if player already worked today
    hasWorkedToday() {
        return MetaState.hasFlag(`job_day_${MetaState.state.day}`);
    },

    // Execute a job and return results (null if can't afford energy)
    doJob(jobId) {
        const job = JOB_ACTIVITIES[jobId];
        if (!job) return null;

        // Check energy before spending
        const energyCost = job.energyCost * MetaState.getEnergyCostMultiplier();
        if (MetaState.state.energy < energyCost) return null;

        const hasTanakaDiscount = MetaState.hasFlag('tanaka_discount');
        const perf = rollPerformance();
        let pay = Math.round(job.basePay * perf.mult);
        if (hasTanakaDiscount) pay = Math.round(pay * 1.2); // 20% bonus from milestone

        MetaState.spendEnergy(job.energyCost);
        MetaState.advanceTime(job.time);
        MetaState.addMoney(pay);
        MetaState.addMood(perf.moodChange);
        if (perf.friendChange > 0) {
            MetaState.addFriendship('shopkeeper', perf.friendChange);
        }

        MetaState.state.shiftsWorked++;
        MetaState.state.totalJobEarnings = (MetaState.state.totalJobEarnings || 0) + pay;
        MetaState.state.lastJobRating = perf.rating;
        MetaState.setFlag(`job_day_${MetaState.state.day}`);

        return {
            jobName: job.name,
            pay,
            performance: perf,
            hasTanakaBonus: hasTanakaDiscount,
        };
    },

    getJobLevel,
};

export default MetaJobs;
