export const SEASON_CODE = "E2026";

export const PREVIOUS_SEASON_CODE =
    `E${Number(SEASON_CODE.slice(1)) - 1}`;

// Regular season: 38 rounds of 10 games
export const ROUNDS_PER_SEASON = 38;

/*
    Bump when the fantasy point rules change, so games
    cached with the old rules are recalculated.
*/
export const SCORING_VERSION = 2;


/* =========================
   PLAY TYPES
========================= */

/*
    Fouls that count toward five personal fouls:
    personal, offensive, unsportsmanlike, technical
    and disqualifying.
*/
const FOUL_TYPES = new Set(["CM", "OF", "CMU", "CMT", "CMTI", "CMD"]);

// Play types that don't affect fantasy points
const NON_SCORING_TYPES = new Set([
    "BP", "EP", "EG", "IN", "OUT", "TOUT", "TOUT_TV", "JB"
]);

const reportedPlayTypes = new Set();

/*
    Logs each unknown play type once, so new foul or
    stat codes in the feed can be spotted in the console.
*/
function reportUnscoredPlayType(action) {
    if (NON_SCORING_TYPES.has(action) || reportedPlayTypes.has(action)) return;

    reportedPlayTypes.add(action);

    console.info(`Play type "${action}" is not used for fantasy points.`);
}

/* =========================
   REQUESTS
========================= */

/*
    The live feed rate-limits (HTTP 429), and its 429
    replies lack CORS headers, so the browser reports
    them as blocked network errors. To stay under the
    limit, requests go through one paced queue: a
    couple at a time, a short gap between starts, and
    a pause for everyone after the feed pushes back.
*/
const MAX_PARALLEL_REQUESTS = 2;
const RATE_LIMIT_PAUSE = 2000;
const RETRY_DELAYS = [1500, 4000, 8000];

/*
    Gap between request starts. Starts at the pace the
    open-source EuroLeague client uses, widens when the
    feed pushes back and narrows again on success.
*/
const START_REQUEST_GAP = 250;
const MIN_REQUEST_GAP = 150;
const MAX_REQUEST_GAP = 1500;

let requestGap = START_REQUEST_GAP;

let activeRequests = 0;
let nextRequestAt = 0;
let queueTimer = null;
const requestQueue = [];


function queueRequest(task) {
    return new Promise((resolve, reject) => {
        requestQueue.push({ task, resolve, reject });

        runQueue();
    });
}


function runQueue() {
    if (queueTimer) return;

    while (activeRequests < MAX_PARALLEL_REQUESTS && requestQueue.length) {
        const delay = nextRequestAt - Date.now();

        // Too soon after the last start (or during a pause): come back later
        if (delay > 0) {
            queueTimer = setTimeout(() => {
                queueTimer = null;

                runQueue();
            }, delay);

            return;
        }

        const { task, resolve, reject } = requestQueue.shift();

        activeRequests++;

        nextRequestAt = Date.now() + requestGap;

        task()
            .then(resolve, reject)
            .finally(() => {
                activeRequests--;

                runQueue();
            });
    }
}


// Hold every queued request for a while after the feed pushes back, and slow down
function pauseRequests() {
    requestGap = Math.min(requestGap * 2, MAX_REQUEST_GAP);

    nextRequestAt = Math.max(nextRequestAt, Date.now() + RATE_LIMIT_PAUSE);
}


// Speed back up gradually while requests succeed
function requestSucceeded() {
    requestGap = Math.max(MIN_REQUEST_GAP, requestGap * 0.95);
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
                pauseRequests();

                continue;
            }

            requestSucceeded();

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
            // Network error, usually a 429 hidden by CORS: try again
            pauseRequests();

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
/*
    Several parts of the app ask for the same games at
    once (game cards, My Team, season overview, top
    players). They share one request, and a recent
    answer is reused for a while:
    - live games: a few seconds (refreshes stay current)
    - games with no data yet: 20 seconds (a tip-off shows up quickly)
    - finished games: ten minutes
*/
const RESULT_TTL = {
    live: 8000,
    empty: 20000,
    finished: 600000
};

const recentResults = new Map();


export function fetchGameResult(gameCode, seasonCode = SEASON_CODE) {
    const key = `${seasonCode}_${gameCode}`;

    const recent = recentResults.get(key);

    if (recent && recent.expires > Date.now()) {
        return recent.promise;
    }

    const promise = loadGameResult(gameCode, seasonCode);

    // Share the request while it runs
    recentResults.set(key, { promise, expires: Infinity });

    promise.then(({ ok, result }) => {
        if (!ok) {
            // Failures aren't kept: the next ask tries again
            recentResults.delete(key);

            return;
        }

        const ttl = !result
            ? RESULT_TTL.empty
            : result.Live
                ? RESULT_TTL.live
                : RESULT_TTL.finished;

        recentResults.set(key, { promise, expires: Date.now() + ttl });
    });

    return promise;
}


async function loadGameResult(gameCode, seasonCode) {
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
        else if (FOUL_TYPES.has(action)) {
            player.stats.fouls += 1;

            // Five personal fouls: -5, once
            if (player.stats.fouls === 5) {
                player.fantasy -= 5;
            }
        }

        else {
            reportUnscoredPlayType(action);
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


            // DOUBLE / TRIPLE / QUADRUPLE DOUBLE
            // Any of the five categories at 10 or more count
            const doubleDigits = [
                player.stats.points,
                player.stats.total_rebounds,
                player.stats.assists,
                player.stats.steals,
                player.stats.blocks
            ].filter(value => value >= 10).length;

            if (doubleDigits >= 4) {
                player.fantasy += 100;
            }
            else if (doubleDigits === 3) {
                player.fantasy += 30;
            }
            else if (doubleDigits === 2) {
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
