import { fetchAndUpdate, SEASON_CODE } from "./api-stats.js?v=6";

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
