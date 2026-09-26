import { getGameSummaries, getRoundGames } from "./season-games.js?v=18";
import { getMyTeam, getPointsMultiplier } from "./my-team.js?v=18";

// Best lineup shape: captain + 4 starters, 6th man, 4 bench
const LINEUP = [
    { role: "starter", captain: true },
    { role: "starter" },
    { role: "starter" },
    { role: "starter" },
    { role: "starter" },
    { role: "sixth" },
    { role: "bench" },
    { role: "bench" },
    { role: "bench" },
    { role: "bench" }
];


/* =========================
   ROUND DATA
========================= */

/*
    Every player's fantasy points in a round, keyed by
    id, and how many of its games are live. Finished
    games come from the cache. Throws if loading fails.
*/
export async function getRoundPoints(round) {
    const summaries = await getGameSummaries(getRoundGames(round));

    const points = new Map();

    summaries.forEach(summary => {
        summary.players.forEach(player => {
            points.set(String(player.id), Number(player.fpts) || 0);
        });
    });

    return {
        points,
        games: summaries.length,
        liveGames: summaries.filter(summary => summary.live).length
    };
}


/* =========================
   TEAM SCORE
========================= */

// Same rules as the My Team total: captain 2x, starters and 6th man 1x, bench 0.5x
export function scoreTeam(players, points) {
    return players.reduce((total, player) =>
        total +
        (points.get(String(player.id)) || 0) *
        getPointsMultiplier(player.role, player.captain === true),
        0
    );
}


// A saved round's score, or null when the round has no team
export async function getMyRoundScore(round) {
    const team = getMyTeam(round);

    if (!team.players?.length) return null;

    const { points, games, liveGames } = await getRoundPoints(round);

    return {
        round,
        score: scoreTeam(team.players, points),
        players: team.players.length,
        saved: team.finalized === true,
        games,
        liveGames
    };
}


/* =========================
   BEST LINEUP
========================= */

/*
    The highest-scoring team possible from a round's
    players. Higher multipliers go to higher scorers:
    top scorer as captain (2x), the next five at 1x
    (4 starters + 6th man), the next four on the bench.
    Players are { id, fpts, ... }.
*/
export function getBestLineup(players) {
    const ranked = [...players].sort((a, b) => b.fpts - a.fpts);

    const lineup = LINEUP
        .map((slot, index) => ranked[index] && { ...ranked[index], ...slot })
        .filter(Boolean);

    const total = lineup.reduce((sum, player) =>
        sum + player.fpts * getPointsMultiplier(player.role, player.captain === true),
        0
    );

    return { lineup, total };
}
