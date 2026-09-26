import { fetchAndUpdate, SEASON_CODE, ROUNDS_PER_SEASON } from "./api-stats.js?v=14";

const CACHE_PREFIX = "fantasyGame_";

// Parallel requests when loading many games at once
const BATCH_SIZE = 10;


/* =========================
   GAME SUMMARY
========================= */

/*
    Players and fantasy points for one game.
    Finished games never change, so they're kept
    in localStorage and only fetched once.
*/
export async function getGameSummary(gameCode, season = SEASON_CODE) {
    const cacheKey = `${CACHE_PREFIX}${season}_${gameCode}`;

    const cached = readCache(cacheKey);

    if (cached) return cached;

    const result = await fetchAndUpdate(gameCode, season);

    if (!result || !result.players || !result.players.length) {
        return null;
    }

    const summary = {
        season,
        gameCode,
        live: result.Live === true,
        players: result.players.map(player => ({
            id: player.id,
            name: player.Name,
            team: player.Team,
            fpts: player.Fantasy_Points,
            points: player.Points
        }))
    };

    if (!summary.live) {
        writeCache(cacheKey, summary);
    }

    return summary;
}


/*
    Summaries for many games, a batch at a time.
    Games with no data are left out.
*/
export async function getGameSummaries(games, onProgress) {
    const summaries = [];

    for (let i = 0; i < games.length; i += BATCH_SIZE) {
        const batch = games.slice(i, i + BATCH_SIZE);

        const results = await Promise.all(
            batch.map(({ gameCode, season }) => getGameSummary(gameCode, season))
        );

        summaries.push(...results.filter(Boolean));

        onProgress?.(Math.min(i + BATCH_SIZE, games.length), games.length);
    }

    return summaries;
}


// Regular season rounds have 10 games each
export function getRoundGames(round, season = SEASON_CODE) {
    const firstGame = (round - 1) * 10 + 1;

    return Array.from({ length: 10 }, (_, index) => ({
        season,
        gameCode: firstGame + index
    }));
}


export function getGameRound(gameCode) {
    return Math.ceil(gameCode / 10);
}


/* =========================
   CURRENT ROUND
========================= */

const CURRENT_ROUND_KEY = `fantasyCurrentRound_${SEASON_CODE}`;

/*
    The round to show on page load:
    - the latest round with games played, if any of
      its games are live or still to come
    - the next round, once all of its games are over
    - round 1 before the season starts

    Starts from the round found last time, so a
    normal page load only checks a round or two.
*/
export async function findCurrentRound() {
    roundStates.clear();

    const hint = readCache(CURRENT_ROUND_KEY);

    const lastPlayed = Number.isInteger(hint)
        ? await stepToLastPlayedRound(hint)
        : await searchLastPlayedRound();

    let round = 1;

    if (lastPlayed >= 1) {
        const state = await getRoundState(lastPlayed);

        round =
            state.finished && lastPlayed < ROUNDS_PER_SEASON
                ? lastPlayed + 1
                : lastPlayed;
    }

    writeCache(CURRENT_ROUND_KEY, lastPlayed);

    return round;
}


// Latest round with any game data, walking from a known round
async function stepToLastPlayedRound(start) {
    let round = Math.min(Math.max(start, 1), ROUNDS_PER_SEASON);

    if (!(await getRoundState(round)).played) {
        // Season hadn't started last time and still hasn't
        if (start < 1) return 0;

        // Season data went away (e.g. new season) — search again
        return searchLastPlayedRound();
    }

    while (
        round < ROUNDS_PER_SEASON &&
        (await getRoundState(round + 1)).played
    ) {
        round++;
    }

    return round;
}


// Latest round with any game data, by binary search (0 = none)
async function searchLastPlayedRound() {
    let low = 1;
    let high = ROUNDS_PER_SEASON;
    let found = 0;

    while (low <= high) {
        const middle = Math.floor((low + high) / 2);

        if ((await getRoundState(middle)).played) {
            found = middle;
            low = middle + 1;
        }
        else {
            high = middle - 1;
        }
    }

    return found;
}


// Round states for one findCurrentRound() run, so no round is fetched twice
const roundStates = new Map();

async function getRoundState(round) {
    if (!roundStates.has(round)) {
        roundStates.set(round, getGameSummaries(getRoundGames(round)).then(summaries => ({
            played: summaries.length > 0,
            finished:
                summaries.length === 10 &&
                summaries.every(summary => !summary.live)
        })));
    }

    return roundStates.get(round);
}


/* =========================
   CACHE
========================= */

function readCache(cacheKey) {
    try {
        return JSON.parse(localStorage.getItem(cacheKey));
    }
    catch (error) {
        return null;
    }
}


function writeCache(cacheKey, summary) {
    try {
        localStorage.setItem(cacheKey, JSON.stringify(summary));
    }
    catch (error) {
        // Cache is optional
    }
}
