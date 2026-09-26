import {
    fetchAndUpdate,
    SEASON_CODE,
    PREVIOUS_SEASON_CODE,
    ROUNDS_PER_SEASON
} from "./api-stats.js?v=4";
import { TEAM_NAMES, TEAM_ABB } from "./teams.js?v=4";
import { addPlayer, isPlayerSelected, isRoundFinalized } from "./my-team.js?v=4";

// How many rounds back to collect players from
const ROSTER_ROUNDS = 3;
const MAX_RESULTS = 8;

const GAME_CACHE_KEY = "fantasyRosterGames";

// Roster per round, so switching rounds back and forth is instant
const rosterPromises = {};


/* =========================
   SETUP
========================= */

/*
    Search box on the My Team tab. Lets players be
    added before they have played in the selected
    round, using everyone who played in the rounds
    before it.
*/
export function setupPlayerSearch({ getRound, onAdd }) {
    const input = document.querySelector(".js-player-search-input");
    const results = document.querySelector(".js-player-search-results");

    if (!input || !results) return;

    input.addEventListener("focus", () => {
        loadRoster(getRound()).catch(() => {});
    });

    input.addEventListener("input", () => {
        renderResults(input, results, getRound());
    });

    results.addEventListener("click", event => {
        const button = event.target.closest(".player-search-add");

        if (!button) return;

        const round = getRound();

        const added = addPlayer(round, {
            id: button.dataset.playerId,
            name: button.dataset.playerName,
            team: button.dataset.playerTeam,
            gameCode: null
        });

        if (!added) {
            showMessage(results, "Your team is full. Remove a player to add another.");

            return;
        }

        input.value = "";
        results.innerHTML = "";

        onAdd();
    });

    /*
        Close results when clicking elsewhere. A detached
        target was inside the results before they re-rendered.
    */
    document.addEventListener("click", event => {
        if (
            event.target.isConnected &&
            !event.target.closest(".player-search")
        ) {
            results.innerHTML = "";
        }
    });
}


/* =========================
   RESULTS
========================= */

async function renderResults(input, results, round) {
    const query = normalize(input.value);

    if (query.length < 2) {
        results.innerHTML = "";

        return;
    }

    if (isRoundFinalized(round)) {
        showMessage(results, "Your team is locked for this round.");

        return;
    }

    showMessage(results, "Loading players…");

    let roster;

    try {
        roster = await loadRoster(round);
    }
    catch (error) {
        console.error("Error loading players:", error);

        showMessage(results, "Could not load players from previous rounds.");

        return;
    }

    // Input changed while the roster was loading
    if (normalize(input.value) !== query) return;

    const matches = roster
        .filter(player => player.search.includes(query))
        .slice(0, MAX_RESULTS);

    if (!matches.length) {
        showMessage(results, "No players found.");

        return;
    }

    results.innerHTML = matches.map(player => {
        const selected = isPlayerSelected(round, player.id);

        return `
            <div class="player-search-result">
                <img
                    class="player-search-logo"
                    src="images/teams/${player.team}.svg"
                    alt="${player.team}"
                >
                <span class="player-search-name">${player.name}</span>
                <span class="player-search-team">${TEAM_ABB[player.team] || player.team}</span>
                <button
                    class="my-team-button player-search-add ${selected ? "is-selected" : ""}"
                    type="button"
                    data-player-id="${player.id}"
                    data-player-name="${player.name}"
                    data-player-team="${player.team}"
                    ${selected ? "disabled" : ""}
                >${selected ? "✓" : "+"}</button>
            </div>
        `;
    }).join("");
}


function showMessage(results, message) {
    results.innerHTML = `
        <div class="player-search-message">${message}</div>
    `;
}


/* =========================
   ROSTER DATA
========================= */

/*
    Everyone who played in the last few rounds
    before the selected one. Early rounds reach
    back into the previous season's last rounds.
*/
function loadRoster(round) {
    if (!rosterPromises[round]) {
        rosterPromises[round] = fetchRoster(round).catch(error => {
            // Allow a retry on the next search
            delete rosterPromises[round];

            throw error;
        });
    }

    return rosterPromises[round];
}


async function fetchRoster(round) {
    const games = getPreviousRounds(round).flatMap(getRoundGames);

    const gamePlayers = await Promise.all(
        games.map(game => getGamePlayers(game))
    );

    // Newest games come first, so a player who changed
    // clubs is listed with their latest team
    const players = new Map();

    gamePlayers.flat().forEach(player => {
        if (!players.has(player.id)) {
            players.set(player.id, {
                ...player,
                search: normalize(`${player.name} ${player.team} ${TEAM_NAMES[player.team] || ""}`)
            });
        }
    });

    if (!players.size) {
        throw new Error("No players found in previous rounds");
    }

    return [...players.values()]
        .sort((a, b) => a.name.localeCompare(b.name));
}


// Newest first: [{ season, round }, ...]
function getPreviousRounds(round) {
    return Array.from({ length: ROSTER_ROUNDS }, (_, index) => {
        const previous = round - 1 - index;

        return previous >= 1
            ? { season: SEASON_CODE, round: previous }
            : { season: PREVIOUS_SEASON_CODE, round: ROUNDS_PER_SEASON + previous };
    });
}


function getRoundGames({ season, round }) {
    const firstGame = (round - 1) * 10 + 1;

    return Array.from({ length: 10 }, (_, index) => ({
        season,
        gameCode: firstGame + index
    }));
}


/*
    Players in one game. Finished games never
    change, so they're kept in localStorage.
*/
async function getGamePlayers({ season, gameCode }) {
    const cacheKey = `${season}_${gameCode}`;
    const cache = readGameCache();

    if (cache[cacheKey]) return cache[cacheKey];

    const result = await fetchAndUpdate(gameCode, season);

    if (!result || !result.players) return [];

    const players = result.players.map(player => ({
        id: player.id,
        name: player.Name,
        team: player.Team
    }));

    if (!result.Live) {
        writeGameCache(cacheKey, players);
    }

    return players;
}


function readGameCache() {
    try {
        return JSON.parse(localStorage.getItem(GAME_CACHE_KEY)) || {};
    }
    catch (error) {
        return {};
    }
}


function writeGameCache(cacheKey, players) {
    try {
        const cache = readGameCache();

        cache[cacheKey] = players;

        localStorage.setItem(GAME_CACHE_KEY, JSON.stringify(cache));
    }
    catch (error) {
        // Cache is optional
    }
}


/* =========================
   HELPERS
========================= */

// Lowercase and strip accents, so "zalgiris" finds "Žalgiris"
function normalize(text) {
    return String(text)
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .trim();
}
