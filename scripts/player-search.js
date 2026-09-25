import { SEASON_CODE } from "./api-stats.js";
import { TEAM_NAMES, TEAM_ABB } from "./teams.js";
import { addPlayer, isPlayerSelected, isRoundFinalized } from "./my-team.js";

const ROSTER_CACHE_KEY = `fantasyRoster_${SEASON_CODE}`;
const ROSTER_CACHE_HOURS = 12;
const MAX_RESULTS = 8;

let rosterPromise = null;


/* =========================
   SETUP
========================= */

/*
    Search box on the My Team tab. Lets players be
    added before they have played (and so before
    they appear in any game's stats table).
*/
export function setupPlayerSearch({ getRound, onAdd }) {
    const input = document.querySelector(".js-player-search-input");
    const results = document.querySelector(".js-player-search-results");

    if (!input || !results) return;

    input.addEventListener("focus", () => {
        loadRoster().catch(() => {});
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

    let roster;

    try {
        roster = await loadRoster();
    }
    catch (error) {
        console.error("Error loading rosters:", error);

        showMessage(results, "Could not load player list. Try again later.");

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
                <span class="player-search-position">${player.position}</span>
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
    All players registered with the season's
    clubs, cached so the 20 club requests only
    run once in a while.
*/
function loadRoster() {
    if (!rosterPromise) {
        rosterPromise = fetchRoster().catch(error => {
            // Allow a retry on the next search
            rosterPromise = null;

            throw error;
        });
    }

    return rosterPromise;
}


async function fetchRoster() {
    const cached = readCache();

    if (cached) return cached;

    const clubCodes = Object.keys(TEAM_NAMES);
    const players = [];

    // A few clubs at a time — the API rate-limits bursts
    for (let i = 0; i < clubCodes.length; i += 5) {
        const batch = clubCodes.slice(i, i + 5);
        const rosters = await Promise.all(batch.map(fetchClubRoster));

        rosters.forEach(roster => players.push(...roster));
    }

    if (!players.length) {
        throw new Error("No roster data returned");
    }

    writeCache(players);

    return players;
}


async function fetchClubRoster(clubCode) {
    try {
        const response = await fetch(
            `https://api-live.euroleague.net/v2/competitions/E/seasons/${SEASON_CODE}/clubs/${clubCode}/people`
        );

        if (!response.ok) return [];

        const people = await response.json();

        if (!Array.isArray(people)) return [];

        return people
            .filter(entry => entry.type === "J" && entry.active !== false && entry.person?.code)
            .map(entry => {
                const team = entry.club?.code || clubCode;

                return {
                    // Same format as PLAYER_ID in the play-by-play feed
                    id: `P${entry.person.code}`,
                    name: entry.person.name,
                    team,
                    position: entry.positionName || "",
                    search: normalize(`${entry.person.name} ${team} ${TEAM_NAMES[team] || ""}`)
                };
            });
    }
    catch (error) {
        console.error(`Error loading roster for ${clubCode}:`, error);

        return [];
    }
}


function readCache() {
    try {
        const cached = JSON.parse(localStorage.getItem(ROSTER_CACHE_KEY));

        if (
            cached &&
            Date.now() - cached.savedAt < ROSTER_CACHE_HOURS * 60 * 60 * 1000 &&
            cached.players?.length
        ) {
            return cached.players;
        }
    }
    catch (error) {
        // Ignore broken cache
    }

    return null;
}


function writeCache(players) {
    try {
        localStorage.setItem(
            ROSTER_CACHE_KEY,
            JSON.stringify({ savedAt: Date.now(), players })
        );
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
