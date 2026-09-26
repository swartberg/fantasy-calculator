import {
    fetchGameResult,
    SEASON_CODE,
    ROUNDS_PER_SEASON,
    SCORING_VERSION
} from "./api-stats.js?v=25";

// Includes the scoring version, so a rules change recalculates cached games
const CACHE_PREFIX = `fantasyGame_s${SCORING_VERSION}_`;

removeOutdatedGames();

// Parallel requests when loading many games at once
const BATCH_SIZE = 10;


/* =========================
   GAME SUMMARY
========================= */

/*
    Players and fantasy points for one game, or null
    when it has no data yet. Throws when the game
    couldn't be loaded, so callers can tell that
    apart from "not played".

    Finished games never change, so they're kept
    in localStorage and only fetched once.
*/
export async function getGameSummary(gameCode, season = SEASON_CODE) {
    const cacheKey = `${CACHE_PREFIX}${season}_${gameCode}`;

    const cached = readCache(cacheKey);

    if (cached) return cached;

    const { ok, result } = await fetchGameResult(gameCode, season);

    if (!ok) {
        throw new Error(`Game ${gameCode} (${season}) could not be loaded`);
    }

    if (!result || !result.players || !result.players.length) {
        return null;
    }

    const summary = {
        season,
        gameCode,
        live: result.Live === true,
        quarter: result.ActualQuarter,
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
    Games with no data are left out. Throws if any
    game couldn't be loaded.
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

    if (!(await isRoundPlayed(round))) {
        // Season hadn't started last time and still hasn't
        if (start < 1) return 0;

        // Season data went away (e.g. new season) — search again
        return searchLastPlayedRound();
    }

    while (
        round < ROUNDS_PER_SEASON &&
        (await isRoundPlayed(round + 1))
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

        if (await isRoundPlayed(middle)) {
            found = middle;
            low = middle + 1;
        }
        else {
            high = middle - 1;
        }
    }

    return found;
}


/*
    Quick check whether a round has started. Game codes
    follow the schedule, so a started round has its
    first games played. Checks up to 3 games instead of
    loading all 10 of every round searched.
*/
async function isRoundPlayed(round) {
    const games = getRoundGames(round);

    for (const game of [games[0], games[1], games[9]]) {
        if (await getGameSummary(game.gameCode)) return true;
    }

    return false;
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

// Drop games cached under older scoring rules
function removeOutdatedGames() {
    try {
        Object.keys(localStorage)
            .filter(key => key.startsWith("fantasyGame_") && !key.startsWith(CACHE_PREFIX))
            .forEach(key => localStorage.removeItem(key));
    }
    catch (error) {
        // Storage unavailable
    }
}


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
