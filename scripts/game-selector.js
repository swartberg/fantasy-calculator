import { fetchAndUpdate } from "./api-stats.js";

export function gameSelect(loadGame) {
    const roundSelector = document.querySelector(".js-select-round");
    const gameSelector = document.querySelector(".game-selector");

    if (!roundSelector || !gameSelector) return;

    roundSelector.addEventListener("change", () => {
        const round = Number(roundSelector.value);
        if (!round) return;

        getRoundGames(round, gameSelector, loadGame);
    });
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

    for (let gameCode = firstGame; gameCode <= lastGame; gameCode++) {
        requests.push(getGameTeams(gameCode));
    }

    const games = (await Promise.all(requests)).filter(Boolean);

    wrapper.innerHTML = "";

    games.forEach(game => {
        const gameTab = document.createElement("div");
        let gameStatus = "-";
        gameTab.className = "game-tab";
        const quarter = game.actualQuarter;

        if (game.isLive === true) {
            gameTab.classList.add("is-live");
            if (quarter === 7){
                gameStatus = "OT 3"
            }
            else if (quarter === 6) {
                gameStatus = "OT 2"
            }
            else if (quarter === 5) {
                gameStatus = "OT"
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
                <img class="home-logo" src="images/teams/${game.homeTeam}.svg" alt="${game.homeTeam}">
            </div>
            <div class="game-info">
                <div class="game-time">${gameStatus}</div>
                <div class="game-names">
                    <h2 class="home-name">${game.homeTeam}</h2>
                    <h4 class="game-vs">vs</h4>
                    <h2 class="away-name">${game.awayTeam}</h2>
                </div>
            </div>

            <div class="team-logo">
                <img class="away-logo" src="images/teams/${game.awayTeam}.svg" alt="${game.awayTeam}">
            </div>
        `;

        gameTab.addEventListener("click", () => {
            document
                .querySelectorAll(".game-tab")
                .forEach(tab => tab.classList.remove("active"));

            gameTab.classList.add("active");

            localStorage.setItem("gameCode", game.gameCode);
            loadGame(game.gameCode);
        });

        wrapper.appendChild(gameTab);

        gameTab.offsetHeight;
        gameTab.classList.add("is-visible");
    });
}

async function getGameTeams(gameCode) {
    const result = await fetchAndUpdate(gameCode);

    if (!result || !result.players || result.players.length === 0) {
        return null;
    }

    const teams = [...new Set(result.players.map(p => p.Team))];

    if (teams.length < 2) return null;

    return {
        gameCode,
        homeTeam: teams[0],
        awayTeam: teams[1],
        isLive: result.Live === true,
        actualQuarter: result.ActualQuarter,
    };
}