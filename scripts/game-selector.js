import { fetchAndUpdate } from "./api-stats.js?v=7";
import { TEAM_ABB } from "./teams.js?v=7";
import { findCurrentRound } from "./season-games.js?v=7";

export function gameSelect(loadGame) {
    const roundSelector = document.querySelector(".js-select-round");
    const gameSelector = document.querySelector(".game-selector");

    const roundCurrent = document.querySelector(".round-current");
    const roundNumber = document.querySelector(".js-round-number");
    const roundGrid = document.querySelector(".round-grid");
    const roundTiles = document.querySelectorAll(".round-tile");

    if (!roundSelector || !gameSelector) return;

    // Set once the user picks a round, so auto-selection won't override it
    let userPickedRound = false;

    function updateRoundUI() {
        const round = Number(roundSelector.value);

        if (roundNumber) {
            roundNumber.textContent = round;
        }

        roundTiles.forEach(tile => {
            const tileRound = Number(tile.dataset.round);

            tile.classList.toggle(
                "is-selected",
                tileRound === round
            );
        });
    }

    // Open / close round grid
    if (roundCurrent && roundGrid) {
        roundCurrent.addEventListener("click", () => {
            const isOpen =
                roundGrid.classList.toggle("is-open");

            roundCurrent.setAttribute(
                "aria-expanded",
                isOpen
            );
        });
    }

    // Round tile selection
    roundTiles.forEach(tile => {
        tile.addEventListener("click", () => {
            const round = Number(tile.dataset.round);

            if (!round) return;

            userPickedRound = true;

            // Update hidden select
            roundSelector.value = round;

            // Trigger existing round-loading logic
            roundSelector.dispatchEvent(
                new Event("change")
            );

            // Close grid
            if (roundGrid) {
                roundGrid.classList.remove("is-open");
            }

            if (roundCurrent) {
                roundCurrent.setAttribute(
                    "aria-expanded",
                    "false"
                );
            }

            updateRoundUI();
        });
    });

    // Manual round selection
    roundSelector.addEventListener("change", () => {
        const round = Number(roundSelector.value);

        if (!round) return;

        updateRoundUI();

        getRoundGames(
            round,
            gameSelector,
            loadGame
        );
    });

    // Round 1 until the current round is found
    roundSelector.value = "1";

    updateRoundUI();

    selectCurrentRound();


    /*
        Pick the round with live or upcoming games
        and load its games, as if the user chose it.
    */
    async function selectCurrentRound() {
        if (roundNumber) {
            roundNumber.textContent = "…";
        }

        gameSelector.innerHTML = `
            <div class="loading-alert">
                Finding current round…
            </div>
        `;

        let round = 1;

        try {
            round = await findCurrentRound();
        }
        catch (error) {
            console.error("Error finding current round:", error);
        }

        if (userPickedRound) return;

        roundSelector.value = String(round);

        roundSelector.dispatchEvent(
            new Event("change")
        );
    }
}


// How often live scores update on the game cards
const LIVE_REFRESH_INTERVAL = 20000;

let liveRefreshLoop = null;


async function getRoundGames(round, wrapper, loadGame) {
    stopLiveRefresh();

    wrapper.innerHTML = `
        <div class="loading-alert">
            Loading games…
        </div>
    `;

    const firstGame = (round - 1) * 10 + 1;
    const lastGame = round * 10;

    const requests = [];

    for (
        let gameCode = firstGame;
        gameCode <= lastGame;
        gameCode++
    ) {
        requests.push(
            getGameTeams(gameCode)
        );
    }

    const games = (
        await Promise.all(requests)
    ).filter(Boolean);

    renderGames(
        games,
        wrapper,
        loadGame
    );

    startLiveRefresh(games, wrapper);
}


function renderGames(games, wrapper, loadGame) {
    wrapper.innerHTML = "";

    // Unplayed games have no data, so they can't be shown yet
    if (!games.length) {
        wrapper.innerHTML = `
            <div class="loading-alert">
                No games in this round have started yet.
            </div>
        `;

        return;
    }

    games.forEach(game => {
        const gameTab = document.createElement("div");

        gameTab.className = "game-tab";

        gameTab.dataset.gameCode = game.gameCode;

        gameTab.innerHTML = `
            <div class="team-logo">
                <img
                    class="home-logo"
                    src="images/teams/${game.homeTeam}.svg"
                    alt="${game.homeTeam}"
                >
            </div>

            <div class="game-info">
                <div class="game-time js-game-status"></div>

                <div class="game-names">
                    <div class="game-team">
                        <h2 class="home-name">
                            ${game.homeTeamAbb}
                        </h2>

                        <span class="game-score js-home-score"></span>
                    </div>

                    <h4 class="game-vs">
                        vs
                    </h4>

                    <div class="game-team">
                        <h2 class="away-name">
                            ${game.awayTeamAbb}
                        </h2>

                        <span class="game-score js-away-score"></span>
                    </div>
                </div>
            </div>

            <div class="team-logo">
                <img
                    class="away-logo"
                    src="images/teams/${game.awayTeam}.svg"
                    alt="${game.awayTeam}"
                >
            </div>
        `;

        updateGameTab(gameTab, game);

        gameTab.addEventListener("click", () => {
            document
                .querySelectorAll(".game-tab")
                .forEach(tab => {
                    tab.classList.remove("active");
                });

            gameTab.classList.add("active");

            localStorage.setItem(
                "gameCode",
                game.gameCode
            );

            loadGame(game.gameCode);
        });

        wrapper.appendChild(gameTab);

        gameTab.offsetHeight;

        gameTab.classList.add("is-visible");
    });
}


/*
    Status, scores and live styling. Used for the
    first render and for live score updates.
*/
function updateGameTab(gameTab, game) {
    const quarter = game.actualQuarter;

    let gameStatus = "-";

    if (game.isLive === true) {
        if (quarter === 7) {
            gameStatus = "OT 3";
        }
        else if (quarter === 6) {
            gameStatus = "OT 2";
        }
        else if (quarter === 5) {
            gameStatus = "OT";
        }
        else {
            gameStatus = `${quarter}Q`;
        }
    }
    else if (game.isLive === false) {
        gameStatus = "END";
    }

    gameTab.classList.toggle("is-live", game.isLive === true);

    gameTab.querySelector(".js-game-status").textContent = gameStatus;

    const homeScore = gameTab.querySelector(".js-home-score");
    const awayScore = gameTab.querySelector(".js-away-score");

    homeScore.textContent = game.homeScore;
    awayScore.textContent = game.awayScore;

    // Highlight the winner once the game is over
    const finished = game.isLive === false;

    homeScore.classList.toggle(
        "is-winner",
        finished && game.homeScore > game.awayScore
    );

    awayScore.classList.toggle(
        "is-winner",
        finished && game.awayScore > game.homeScore
    );
}


/* =========================
   LIVE SCORES
========================= */

function startLiveRefresh(games, wrapper) {
    let liveGameCodes = games
        .filter(game => game.isLive)
        .map(game => game.gameCode);

    if (!liveGameCodes.length) return;

    liveRefreshLoop = setInterval(async () => {
        const updates = (
            await Promise.all(liveGameCodes.map(getGameTeams))
        ).filter(Boolean);

        // Round changed while fetching
        if (!liveRefreshLoop) return;

        updates.forEach(game => {
            const gameTab = wrapper.querySelector(
                `.game-tab[data-game-code="${game.gameCode}"]`
            );

            if (gameTab) {
                updateGameTab(gameTab, game);
            }
        });

        // Finished games no longer need updates; failed
        // fetches are retried next time
        liveGameCodes = liveGameCodes.filter(gameCode => {
            const game = updates.find(update => update.gameCode === gameCode);

            return !game || game.isLive;
        });

        if (!liveGameCodes.length) {
            stopLiveRefresh();
        }
    }, LIVE_REFRESH_INTERVAL);
}


function stopLiveRefresh() {
    if (liveRefreshLoop) {
        clearInterval(liveRefreshLoop);

        liveRefreshLoop = null;
    }
}


async function getGameTeams(gameCode) {
    const result = await fetchAndUpdate(gameCode);

    if (
        !result ||
        !result.players ||
        result.players.length === 0
    ) {
        return null;
    }

    const teams = [
        ...new Set(
            result.players.map(p => p.Team)
        )
    ];

    if (teams.length < 2) {
        return null;
    }

    // Team score is the sum of its players' points
    const scores = {};

    result.players.forEach(player => {
        scores[player.Team] =
            (scores[player.Team] || 0) + player.Points;
    });

    return {
        gameCode,

        homeTeam: teams[0],
        awayTeam: teams[1],

        homeTeamAbb:
            TEAM_ABB[teams[0]] || teams[0],

        awayTeamAbb:
            TEAM_ABB[teams[1]] || teams[1],

        homeScore: scores[teams[0]],
        awayScore: scores[teams[1]],

        isLive: result.Live === true,

        actualQuarter: result.ActualQuarter,
    };
}
