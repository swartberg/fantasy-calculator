import { fetchAndUpdate } from "./api-stats.js";
import { TEAM_NAMES } from "./teams.js";
import { gameSelect } from "./game-selector.js";

let updateLoop = null;
let statsContainer = null;

document.addEventListener("DOMContentLoaded", () => {
    statsContainer = document.querySelector(".stats-container");

    statsContainer.classList.remove("is-active");

    gameSelect(loadGame);
});

async function loadGame(gameCode) {
    if (updateLoop) {
        clearInterval(updateLoop);
        updateLoop = null;
    }

    await getStats(gameCode);
}

gameSelect(loadGame);

async function getStats(gameCode) {
    statsContainer.classList.remove("is-active");

    const result = await fetchAndUpdate(gameCode);
    if(!result || result.players.length === 0) return;

    const players = result.players;
    const isLive = result.Live;

    const teams = [...new Set(players.map(p => p.Team))];
    const homeTeamCode = teams[0];
    const awayTeamCode = teams[1];

    document.querySelector(".js-home-team-name").textContent = TEAM_NAMES[homeTeamCode] || homeTeamCode;
    document.querySelector(".js-away-team-name").textContent = TEAM_NAMES[awayTeamCode] || awayTeamCode;

    const homeContainer = document.querySelector(".home-team");
    const awayContainer = document.querySelector(".away-team");

    homeContainer.innerHTML = "";
    awayContainer.innerHTML = "";

    players.forEach(player => {
        const playerName = (player.Name).split(",");
        // console.log(playerName)
        const playerTab = document.createElement("div");
        playerTab.className = "player-tab";

        playerTab.innerHTML = `
            <div class="player-info">
                <div class="player-name">
                    <span class="js-player-name">${playerName[1][1]}. ${playerName[0]}</span>
                </div>
            </div>
            <div class="player-stats">
                <div class="player-pts stat-pair">
                    <span class="stat-label">PTS</span>
                    <span class="js-stat">${player.Points}</span>
                </div>
                <div class="player-reb stat-pair">
                    <span class="stat-label">REB</span>
                    <span class="js-stat">${player.Rebounds}</span>
                </div>
                <div class="player-ast stat-pair">
                    <span class="stat-label">AST</span>
                    <span class="js-stat">${player.Assists}</span>
                </div>
                <div class="player-to stat-pair">
                    <span class="stat-label">TO</span>
                    <span class="js-stat">${player.Turnovers}</span>
                </div>
            </div>
            <div class="player-fpts stat-pair">
                <span class="stat-label">FPTS</span>
                <span class="js-stat js-fpts">${player.Fantasy_Points}</span>
            </div>
        `;
            
        if (player.Team === homeTeamCode) {
            homeContainer.appendChild(playerTab);
        }
        else if (player.Team === awayTeamCode) {
            awayContainer.appendChild(playerTab);
        }
    });
    statsContainer.classList.add("is-active");

    if (isLive && !updateLoop) {
        updateLoop = setInterval(() => {
            getStats(gameCode);
        }, 5000);
    }

    if (!isLive && updateLoop) {
        clearInterval(updateLoop);
        updateLoop = null;
    }
}

const savedGame = localStorage.getItem("gameCode");
if(savedGame) {
    loadGame(savedGame);
}
