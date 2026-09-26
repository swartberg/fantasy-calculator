import { fetchAndUpdate } from "./api-stats.js?v=14";
import { TEAM_ABB } from "./teams.js?v=14";
import { findCurrentRound } from "./season-games.js?v=14";

const ROUND_COUNT = 38;

/*
    Called with (round, games) whenever a round's games
    load or live scores update, so the round strip and
    status line can show the round's state.
*/
let onRoundGames = null;


export function gameSelect(loadGame) {
    const roundSelector = document.querySelector(".js-select-round");
    const gameSelector = document.querySelector(".game-selector");

    const roundNumber = document.querySelector(".js-round-number");
    const roundStrip = document.querySelector(".js-round-strip");
    const roundStatus = document.querySelector(".js-round-status");
    const roundStatusText = document.querySelector(".js-round-status-text");
    const prevButton = document.querySelector(".js-round-prev");
    const nextButton = document.querySelector(".js-round-next");

    if (!roundSelector || !gameSelector || !roundStrip) return;

    // Set once the user picks a round, so auto-selection won't override it
    let userPickedRound = false;

    // Round the season is on; null until found
    let currentRound = null;

    // Exact states of rounds whose games have loaded
    const knownStates = {};


    /* =========================
       ROUND STRIP
    ========================= */

    roundStrip.innerHTML = Array.from({ length: ROUND_COUNT }, (_, index) => `
        <button
            class="round-chip"
            type="button"
            data-round="${index + 1}"
            aria-label="Round ${index + 1}"
        >
            <span class="round-chip-dot"></span>
            <span>${index + 1}</span>
        </button>
    `).join("");

    const roundChips = roundStrip.querySelectorAll(".round-chip");

    roundChips.forEach(chip => {
        chip.addEventListener("click", () => {
            pickRound(Number(chip.dataset.round));
        });
    });

    prevButton?.addEventListener("click", () => {
        pickRound(Number(roundSelector.value) - 1);
    });

    nextButton?.addEventListener("click", () => {
        pickRound(Number(roundSelector.value) + 1);
    });


    function pickRound(round) {
        if (round < 1 || round > ROUND_COUNT) return;

        userPickedRound = true;

        selectRound(round);
    }


    // Same path for user and automatic picks: the rest of
    // the app listens for the hidden select's change event
    function selectRound(round) {
        roundSelector.value = String(round);

        roundSelector.dispatchEvent(
            new Event("change")
        );
    }


    /*
        Finished / live / in progress / upcoming. Loaded
        rounds use their games; others are inferred from
        the current round.
    */
    function getRoundState(round) {
        if (knownStates[round]) return knownStates[round];

        if (currentRound === null) return "unknown";

        return round < currentRound ? "finished" : "upcoming";
    }


    function updateRoundUI(scroll = true) {
        const round = Number(roundSelector.value);

        // Nothing is selected yet while the current round is being found
        const pending = currentRound === null && !userPickedRound;

        if (roundNumber) {
            roundNumber.textContent = pending ? "–" : round;
        }

        roundChips.forEach(chip => {
            const chipRound = Number(chip.dataset.round);
            const state = getRoundState(chipRound);

            chip.classList.toggle("is-selected", !pending && chipRound === round);

            ["finished", "live", "progress", "upcoming"].forEach(name => {
                chip.classList.toggle(`is-${name}`, state === name);
            });
        });

        if (prevButton) prevButton.disabled = round <= 1;
        if (nextButton) nextButton.disabled = round >= ROUND_COUNT;

        if (scroll) {
            scrollToChip(round);
        }
    }


    // Center the selected chip in the strip
    function scrollToChip(round) {
        const chip = roundStrip.querySelector(`.round-chip[data-round="${round}"]`);

        if (!chip) return;

        roundStrip.scrollTo({
            left: chip.offsetLeft - (roundStrip.clientWidth - chip.offsetWidth) / 2,
            behavior: "smooth"
        });
    }


    function setStatus(state, text) {
        if (!roundStatus || !roundStatusText) return;

        roundStatus.dataset.state = state;
        roundStatusText.textContent = text;
    }


    /* =========================
       ROUND STATE
    ========================= */

    onRoundGames = (round, games) => {
        const live = games.filter(game => game.isLive).length;
        const finished = games.length - live;

        let state = "upcoming";
        let text = "No games played yet";

        if (live) {
            state = "live";
            text = `${live} live now · ${finished} of 10 finished`;
        }
        else if (finished >= 10) {
            state = "finished";
            text = "All 10 games finished";
        }
        else if (finished) {
            state = "progress";
            text = `${finished} of 10 games finished`;
        }

        knownStates[round] = state;

        // Only describe the round that's showing
        if (round === Number(roundSelector.value)) {
            setStatus(state, text);
        }

        updateRoundUI(false);
    };


    // Round selection (user, arrows or automatic)
    roundSelector.addEventListener("change", () => {
        const round = Number(roundSelector.value);

        if (!round) return;

        setStatus("loading", "Loading games…");

        updateRoundUI();

        getRoundGames(
            round,
            gameSelector,
            loadGame
        );
    });


    // Round 1 until the current round is found
    roundSelector.value = "1";

    updateRoundUI(false);

    selectCurrentRound();


    /*
        Pick the round with live or upcoming games
        and load its games, as if the user chose it.
    */
    async function selectCurrentRound() {
        setStatus("loading", "Finding current round…");

        let round = 1;

        try {
            round = await findCurrentRound();
        }
        catch (error) {
            console.error("Error finding current round:", error);
        }

        currentRound = round;

        if (userPickedRound) {
            // Still fill in the other rounds' dots
            updateRoundUI(false);

            return;
        }

        selectRound(round);
    }
}


// How often live scores update on the game cards
const LIVE_REFRESH_INTERVAL = 20000;

let liveRefreshLoop = null;


// Latest round load; older ones that finish late are ignored
let roundLoadToken = 0;


async function getRoundGames(round, wrapper, loadGame) {
    stopLiveRefresh();

    const token = ++roundLoadToken;

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

    // Another round was picked while this one loaded
    if (token !== roundLoadToken) return;

    renderGames(
        games,
        wrapper,
        loadGame
    );

    onRoundGames?.(round, games);

    startLiveRefresh(round, games, wrapper);
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

function startLiveRefresh(round, games, wrapper) {
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

        // Keep the round's state (status line, strip dot) current
        games = games.map(game =>
            updates.find(update => update.gameCode === game.gameCode) || game
        );

        onRoundGames?.(round, games);

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
