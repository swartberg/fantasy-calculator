export const SEASON_CODE = "E2026";

export const PREVIOUS_SEASON_CODE =
    `E${Number(SEASON_CODE.slice(1)) - 1}`;

// Regular season: 38 rounds of 10 games
export const ROUNDS_PER_SEASON = 38;

/* =========================
   REQUESTS
========================= */

/*
    The live feed rate-limits bursts, and a blocked
    request can show up as a plain network error. So
    requests are queued (a few at a time) and failures
    are retried before giving up.
*/
const MAX_PARALLEL_REQUESTS = 4;
const RETRY_DELAYS = [700, 2000];

let activeRequests = 0;
const requestQueue = [];


function queueRequest(task) {
    return new Promise((resolve, reject) => {
        requestQueue.push({ task, resolve, reject });

        runQueue();
    });
}


function runQueue() {
    while (activeRequests < MAX_PARALLEL_REQUESTS && requestQueue.length) {
        const { task, resolve, reject } = requestQueue.shift();

        activeRequests++;

        task()
            .then(resolve, reject)
            .finally(() => {
                activeRequests--;

                runQueue();
            });
    }
}


const wait = ms => new Promise(resolve => setTimeout(resolve, ms));


/*
    Raw play-by-play JSON for a game.
    { ok: true, data }       — data is null when the game has no data yet
    { ok: false }            — the feed couldn't be reached
*/
async function fetchPlayByPlay(gameCode, seasonCode) {
    const url =
        `https://live.euroleague.net/api/PlaybyPlay?gamecode=${gameCode}&seasoncode=${seasonCode}`;

    for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
        if (attempt > 0) {
            await wait(RETRY_DELAYS[attempt - 1]);
        }

        try {
            const response = await queueRequest(() => fetch(url));

            // Rate limited or server trouble: try again
            if (response.status === 429 || response.status >= 500) {
                continue;
            }

            if (!response.ok) {
                // Other non-OK responses (e.g. an invalid/unplayed game
                // code) are expected — treat them as "no data".
                return { ok: true, data: null };
            }

            const text = await response.text();

            // The EuroLeague API returns an empty body (not valid
            // JSON) for game codes with no data yet.
            if (!text) {
                return { ok: true, data: null };
            }

            return { ok: true, data: JSON.parse(text) };
        }
        catch (error) {
            // Network error (or a blocked request): try again
            if (attempt === RETRY_DELAYS.length) {
                console.error(`Error fetching game ${gameCode} (${seasonCode}):`, error);
            }
        }
    }

    return { ok: false };
}


/* =========================
   GAME DATA
========================= */

/*
    Players, stats and fantasy points for a game.
    { ok: true, result }  — result is null when the game has no data yet
    { ok: false }         — loading failed
*/
export async function fetchGameResult(gameCode, seasonCode = SEASON_CODE) {
    const { ok, data } = await fetchPlayByPlay(gameCode, seasonCode);

    if (!ok) return { ok: false, result: null };

    if (!data) return { ok: true, result: null };

    try {
        return { ok: true, result: parsePlayByPlay(data) };
    }
    catch (error) {
        console.error(`Error reading game ${gameCode} (${seasonCode}):`, error);

        return { ok: false, result: null };
    }
}


// Game data, or null when there's none or loading failed
export async function fetchAndUpdate(gameCode, seasonCode = SEASON_CODE) {
    return (await fetchGameResult(gameCode, seasonCode)).result;
}


function parsePlayByPlay(data) {
    const players = {};

    let gameTime = data.ActualQuarter;

    const allPlays = [
        ...(data.FirstQuarter || []),
        ...(data.SecondQuarter || []),
        ...(data.ThirdQuarter || []),
        ...(data.ForthQuarter || []),
        ...(data.ExtraTime || []),
    ];


    // =========================
    // CREATE PLAYER OBJECTS
    // =========================

    allPlays.forEach(play => {
        // PLAYER_ID comes padded with trailing spaces
        const id = asText(play.PLAYER_ID);
        const name = asText(play.PLAYER);
        const team = asText(play.CODETEAM);

        if (!id || !name) return;

        if (!players[id]) {
            players[id] = {
                id: id,
                name: name,
                team: team,

                stats: {
                    points: 0,

                    made_2pt: 0,
                    made_3pt: 0,
                    made_fts: 0,

                    def_rebounds: 0,
                    off_rebounds: 0,
                    total_rebounds: 0,

                    assists: 0,
                    steals: 0,
                    blocks: 0,

                    draw_fouls: 0,

                    missed_2pt: 0,
                    missed_3pt: 0,
                    missed_fts: 0,

                    get_blocks: 0,
                    turnovers: 0,
                    fouls: 0
                },

                fantasy: 0
            };
        }
    });


    // =========================
    // STATS CALCULATION
    // =========================

    allPlays.forEach(play => {
        const player = players[asText(play.PLAYER_ID)];

        if (!player) return;

        const action = asText(play.PLAYTYPE);

        if (!action) return;


        // 2 POINTS
        if (action === "2FGM") {
            player.stats.made_2pt += 1;
            player.stats.points += 2;
            player.fantasy += 2;
        }

        else if (action === "2FGA") {
            player.stats.missed_2pt += 1;
            player.fantasy -= 1;
        }


        // 3 POINTS
        else if (action === "3FGM") {
            player.stats.made_3pt += 1;
            player.stats.points += 3;
            player.fantasy += 3;
        }

        else if (action === "3FGA") {
            player.stats.missed_3pt += 1;
            player.fantasy -= 1;
        }


        // FREE THROWS
        else if (action === "FTM") {
            player.stats.made_fts += 1;
            player.stats.points += 1;
            player.fantasy += 1;
        }

        else if (action === "FTA") {
            player.stats.missed_fts += 1;
            player.fantasy -= 1;
        }


        // DEFENSIVE REBOUND
        else if (action === "D") {
            player.stats.def_rebounds += 1;
            player.fantasy += 1;
            player.stats.total_rebounds += 1;
        }


        // OFFENSIVE REBOUND
        else if (action === "O") {
            player.stats.off_rebounds += 1;
            player.fantasy += 1.5;
            player.stats.total_rebounds += 1;
        }


        // ASSIST
        else if (action === "AS") {
            player.stats.assists += 1;
            player.fantasy += 1.5;
        }


        // STEAL
        else if (action === "ST") {
            player.stats.steals += 1;
            player.fantasy += 1.5;
        }


        // BLOCK
        else if (action === "FV") {
            player.stats.blocks += 1;
            player.fantasy += 1;
        }


        // DRAWN FOUL
        else if (action === "RV") {
            player.stats.draw_fouls += 1;
            player.fantasy += 1;
        }


        // TURNOVER
        else if (action === "TO") {
            player.stats.turnovers += 1;
            player.fantasy -= 1.5;
        }


        // BLOCK RECEIVED
        else if (action === "AG") {
            player.stats.get_blocks += 1;
            player.fantasy -= 0.5;
        }


        // FOUL
        else if (action === "CM") {
            player.stats.fouls += 1;

            if (player.stats.fouls >= 5) {
                player.fantasy -= 5;
            }
        }
    });


    // =========================
    // END GAME CALCULATIONS
    // =========================

    if (data.Live === false) {
        const teamTotal = {};


        // Team total points
        for (const id in players) {
            const player = players[id];
            const team = player.team;

            if (!teamTotal[team]) {
                teamTotal[team] = {
                    points: 0
                };
            }

            teamTotal[team].points +=
                player.stats.points;
        }


        // Winning team
        const teamsPlayed =
            Object.keys(teamTotal);

        const teamOneScore =
            teamTotal[teamsPlayed[0]]?.points || 0;

        const teamTwoScore =
            teamTotal[teamsPlayed[1]]?.points || 0;

        let winningTeam;

        if (teamOneScore > teamTwoScore) {
            winningTeam = teamsPlayed[0];
        }
        else {
            winningTeam = teamsPlayed[1];
        }


        console.log(
            "ActualQuarter:",
            data.ActualQuarter
        );


        // End-game fantasy calculations
        for (const id in players) {
            const player = players[id];
            const team = player.team;


            // QUADRUPLE DOUBLE
            if (
                (
                    player.stats.points >= 10 &&
                    player.stats.total_rebounds >= 10 &&
                    player.stats.assists >= 10 &&
                    player.stats.steals >= 10
                )
                ||
                (
                    player.stats.points >= 10 &&
                    player.stats.total_rebounds >= 10 &&
                    player.stats.assists >= 10 &&
                    player.stats.blocks >= 10
                )
            ) {
                player.fantasy += 100;
            }


            // TRIPLE DOUBLE
            else if (
                (
                    player.stats.points >= 10 &&
                    player.stats.total_rebounds >= 10 &&
                    player.stats.assists >= 10
                )
                ||
                (
                    player.stats.points >= 10 &&
                    player.stats.total_rebounds >= 10 &&
                    player.stats.blocks >= 10
                )
                ||
                (
                    player.stats.points >= 10 &&
                    player.stats.assists >= 10 &&
                    player.stats.steals >= 10
                )
                ||
                (
                    player.stats.total_rebounds >= 10 &&
                    player.stats.assists >= 10 &&
                    player.stats.blocks >= 10
                )
            ) {
                player.fantasy += 30;
            }


            // DOUBLE DOUBLE
            else if (
                (
                    player.stats.points >= 10 &&
                    player.stats.total_rebounds >= 10
                )
                ||
                (
                    player.stats.points >= 10 &&
                    player.stats.assists >= 10
                )
                ||
                (
                    player.stats.total_rebounds >= 10 &&
                    player.stats.assists >= 10
                )
            ) {
                player.fantasy += 10;
            }


            // WIN / LOSS
            if (team === winningTeam) {
                player.fantasy += 1.5;
            }
            else {
                player.fantasy -= 1.5;
            }
        }
    }


    // =========================
    // RETURN PLAYER DATA
    // =========================

    return {
        players: Object.values(players).map(p => ({
            id: p.id,
            Name: p.name,
            Team: p.team,

            Points: p.stats.points,
            Rebounds: p.stats.total_rebounds,
            Assists: p.stats.assists,
            Turnovers: p.stats.turnovers,

            Fantasy_Points: p.fantasy
        })),

        Live: data.Live === true,

        ActualQuarter: data.ActualQuarter,
    };
}


window.fetchAndUpdate = fetchAndUpdate;


/*
    Feed fields as trimmed text. Not every play has
    every field as a string, and one bad value
    mustn't make the whole game look empty.
*/
function asText(value) {
    if (typeof value === "string") return value.trim();

    return value === undefined || value === null ? "" : String(value);
}
