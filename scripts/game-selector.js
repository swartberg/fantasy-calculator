import { fetchAndUpdate } from "./api-stats.js";
import { TEAM_ABB } from "./teams.js";

export function gameSelect(loadGame) {
    const roundSelector = document.querySelector(".js-select-round");
    const gameSelector = document.querySelector(".game-selector");

    const roundCurrent = document.querySelector(".round-current");
    const roundNumber = document.querySelector(".js-round-number");
    const roundGrid = document.querySelector(".round-grid");
    const roundTiles = document.querySelectorAll(".round-tile");

    if (!roundSelector || !gameSelector) return;

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

    // Default to Round 1
    roundSelector.value = "1";

    updateRoundUI();
}


async function getRoundGames(round, wrapper, loadGame) {
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
}


function renderGames(games, wrapper, loadGame) {
    wrapper.innerHTML = "";

    games.forEach(game => {
        const gameTab = document.createElement("div");

        let gameStatus = "-";

        gameTab.className = "game-tab";

        const quarter = game.actualQuarter;

        if (game.isLive === true) {
            gameTab.classList.add("is-live");

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

        gameTab.innerHTML = `
            <div class="team-logo">
                <img
                    class="home-logo"
                    src="images/teams/${game.homeTeam}.svg"
                    alt="${game.homeTeam}"
                >
            </div>

            <div class="game-info">
                <div class="game-time">
                    ${gameStatus}
                </div>

                <div class="game-names">
                    <h2 class="home-name">
                        ${game.homeTeamAbb}
                    </h2>

                    <h4 class="game-vs">
                        vs
                    </h4>

                    <h2 class="away-name">
                        ${game.awayTeamAbb}
                    </h2>
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

    return {
        gameCode,

        homeTeam: teams[0],
        awayTeam: teams[1],

        homeTeamAbb:
            TEAM_ABB[teams[0]] || teams[0],

        awayTeamAbb:
            TEAM_ABB[teams[1]] || teams[1],

        isLive: result.Live === true,

        actualQuarter: result.ActualQuarter,
    };
}