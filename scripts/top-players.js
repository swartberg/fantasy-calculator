import { fetchAndUpdate } from "./api-stats.js";
import { TEAM_ABB } from "./teams.js";
import { isPlayerSelected } from "./my-team.js";

const TOP_PLAYERS_COUNT = 10;
const REFRESH_INTERVAL = 15000;

let refreshLoop = null;
let isLoading = false;


/* =========================
   INITIALIZATION
========================= */

document.addEventListener("DOMContentLoaded", () => {
    const view = document.querySelector(".js-view-top-players");
    const roundSelector = document.querySelector(".js-select-round");

    if (!view) return;

    document.addEventListener("click", event => {
        const tab = event.target.closest(".js-view-tab");

        if (!tab) return;

        if (tab.dataset.view === "top-players") {
            renderTopPlayers(true);

            if (!refreshLoop) {
                refreshLoop = setInterval(
                    () => renderTopPlayers(false),
                    REFRESH_INTERVAL
                );
            }
        }
        else if (refreshLoop) {
            clearInterval(refreshLoop);

            refreshLoop = null;
        }
    });

    if (roundSelector) {
        roundSelector.addEventListener("change", () => {
            if (refreshLoop) {
                renderTopPlayers(true);
            }
        });
    }
});


/* =========================
   RENDER TOP PLAYERS
========================= */

/*
    showLoading is true for the first render of a
    round; background refreshes update in place.
*/
async function renderTopPlayers(showLoading) {
    const container = document.querySelector(".top-players-container");

    if (!container) return;

    if (isLoading && !showLoading) return;

    const round = getCurrentRound();

    if (showLoading) {
        container.innerHTML = `
            <div class="my-team-loading">
                Loading top players…
            </div>
        `;
    }

    isLoading = true;

    const players = await getRoundPlayers(round);

    isLoading = false;

    // Round changed while loading — a newer render owns the view
    if (round !== getCurrentRound()) return;

    const topPlayers = players
        .sort((a, b) =>
            b.Fantasy_Points - a.Fantasy_Points ||
            b.Points - a.Points
        )
        .slice(0, TOP_PLAYERS_COUNT);

    if (!topPlayers.length) {
        container.innerHTML = `
            <div class="my-team-empty">
                <span>TOP PLAYERS</span>
                <p>No games have been played in this round yet.</p>
            </div>
        `;

        return;
    }

    container.innerHTML = `
        <div class="my-team-header">
            <span>TOP PLAYERS</span>
            <strong>ROUND ${round}</strong>
        </div>

        <div class="my-team-player-list">
            ${topPlayers.map((player, index) => createTopPlayer(player, index + 1, round)).join("")}
        </div>
    `;
}


function createTopPlayer(player, rank, round) {
    const inMyTeam = isPlayerSelected(round, player.id);

    return `
        <div class="my-team-player top-player ${inMyTeam ? "is-in-my-team" : ""}">
            <div class="my-team-player-info">
                <span class="top-player-rank">${rank}</span>
                <img
                    class="top-player-logo"
                    src="images/teams/${player.Team}.svg"
                    alt="${player.Team}"
                >
                <span class="my-team-player-name">${formatPlayerName(player.Name)}</span>
                <span class="my-team-player-team">${TEAM_ABB[player.Team] || player.Team}</span>
            </div>

            <div class="top-player-stats">
                <span>${player.Points} PTS</span>
                <span>${player.Rebounds} REB</span>
                <span>${player.Assists} AST</span>
            </div>

            <div class="my-team-player-score">
                <span class="my-team-contribution">${formatFantasyPoints(player.Fantasy_Points)}</span>
            </div>
        </div>
    `;
}


/* =========================
   ROUND DATA
========================= */

async function getRoundPlayers(round) {
    const firstGame = (round - 1) * 10 + 1;
    const lastGame = round * 10;

    const requests = [];

    for (let gameCode = firstGame; gameCode <= lastGame; gameCode++) {
        requests.push(fetchAndUpdate(gameCode));
    }

    const games = await Promise.all(requests);

    return games
        .filter(game => game && game.players)
        .flatMap(game => game.players);
}


/* =========================
   HELPERS
========================= */

function getCurrentRound() {
    const selector = document.querySelector(".js-select-round");

    return Number(selector?.value) || 1;
}


function formatPlayerName(name) {
    const parts = name.split(",");

    if (parts.length < 2) return name;

    return `${parts[1]?.trim()?.[0] || ""} ${parts[0].trim()}`;
}


function formatFantasyPoints(points) {
    const value = Number(points) || 0;

    return Number.isInteger(value)
        ? value.toString()
        : value.toFixed(1);
}
