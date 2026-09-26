import { TEAM_ABB } from "./teams.js?v=18";
import { isPlayerSelected, getMyTeam } from "./my-team.js?v=18";
import { getGameSummaries, getRoundGames } from "./season-games.js?v=18";
import { getBestLineup, scoreTeam } from "./round-scores.js?v=18";

// Role tags for the best possible lineup
const ROLE_TAGS = {
    captain: { label: "C", title: "Captain (2x)" },
    starter: { label: "S", title: "Starter" },
    sixth: { label: "6", title: "6th man" },
    bench: { label: "B", title: "Bench (0.5x)" }
};

const TOP_COUNT = 10;

// Live games update this often while the tab is open
const REFRESH_INTERVAL = 20000;

let refreshLoop = null;

// Ignore results of a render that a newer one replaced
let renderToken = 0;


/* =========================
   SETUP
========================= */

/*
    Top Players tab: the round's 10 best fantasy
    scorers and its worst one, for the selected round.
*/
export function setupTopPlayers({ getRound }) {
    const view = document.querySelector(".js-view-top-players");
    const roundSelector = document.querySelector(".js-select-round");

    if (!view) return;

    const isOpen = () => view.style.display === "block";

    document.addEventListener("click", event => {
        const tab = event.target.closest(".js-view-tab");

        if (!tab) return;

        if (tab.dataset.view === "top-players") {
            renderTopPlayers(getRound(), true);
        }
        else {
            stopRefresh();
        }
    });

    roundSelector?.addEventListener("change", () => {
        if (isOpen()) {
            renderTopPlayers(getRound(), true);
        }
    });
}


function stopRefresh() {
    if (refreshLoop) {
        clearInterval(refreshLoop);

        refreshLoop = null;
    }
}


/* =========================
   RENDER
========================= */

/*
    showLoading is true for the first render of a
    round; live refreshes update in place.
*/
async function renderTopPlayers(round, showLoading) {
    const container = document.querySelector(".top-players-container");

    if (!container) return;

    const token = ++renderToken;

    stopRefresh();

    if (showLoading) {
        container.innerHTML = `
            <div class="my-team-loading">
                Loading round ${round}…
            </div>
        `;
    }

    let summaries;

    try {
        summaries = await getGameSummaries(getRoundGames(round));
    }
    catch (error) {
        console.error("Error loading top players:", error);

        if (token !== renderToken) return;

        container.innerHTML = `
            <div class="my-team-empty">
                <span>TOP PLAYERS</span>
                <p>
                    Couldn't load this round.
                    <button class="retry-button js-top-retry" type="button">Retry</button>
                </p>
            </div>
        `;

        container.querySelector(".js-top-retry").addEventListener("click", () => {
            renderTopPlayers(round, true);
        });

        return;
    }

    if (token !== renderToken) return;

    const players = getRoundPlayers(summaries);

    if (!players.length) {
        container.innerHTML = `
            <div class="my-team-empty">
                <span>TOP PLAYERS</span>
                <p>No games in round ${round} have been played yet.</p>
            </div>
        `;

        return;
    }

    const ranked = [...players].sort(byBest);

    const top = ranked.slice(0, TOP_COUNT);

    const worst = ranked[ranked.length - 1];

    const liveGames = summaries.filter(summary => summary.live).length;

    // Ranked order already puts the best lineup first: the top 10
    const best = getBestLineup(ranked);

    const lineupRoles = new Map(best.lineup.map(player => [
        String(player.id),
        player.captain ? "captain" : player.role
    ]));

    container.innerHTML = `
        ${renderBestLineup(best, players, round, liveGames)}

        <div class="my-team-header">
            <span>TOP ${TOP_COUNT}</span>
            <strong>ROUND ${round}${liveGames ? ` · <em class="top-players-live">${liveGames} LIVE</em>` : ""}</strong>
        </div>

        <div class="my-team-player-list">
            ${top.map((player, index) =>
                createPlayerRow(player, index + 1, round, false, lineupRoles.get(String(player.id)))
            ).join("")}
        </div>

        <div class="top-players-worst">
            <div class="my-team-section-title top-players-worst-title">
                WORST OF THE ROUND
            </div>

            <div class="my-team-player-list">
                ${createPlayerRow(worst, ranked.length, round, true)}
            </div>
        </div>
    `;

    // Keep live rounds current while the tab stays open
    if (liveGames) {
        refreshLoop = setInterval(() => {
            renderTopPlayers(round, false);
        }, REFRESH_INTERVAL);
    }
}


/*
    Best possible lineup total, and the user's team
    score for the round next to it.
*/
function renderBestLineup(best, players, round, liveGames) {
    const myTeam = getMyTeam(round);

    let comparison = `<span class="best-lineup-note">Pick a team for round ${round} to compare.</span>`;

    if (myTeam.players?.length) {
        const points = new Map(players.map(player => [String(player.id), player.fpts]));

        const myScore = scoreTeam(myTeam.players, points);

        const share = best.total > 0 ? Math.round(myScore / best.total * 100) : 0;

        comparison = `
            <span class="best-lineup-mine">
                Your team <strong>${formatFantasyPoints(myScore)}</strong>
                <em>${share}% of best</em>
            </span>
        `;
    }

    return `
        <div class="best-lineup">
            <div class="best-lineup-main">
                <span class="best-lineup-label">BEST POSSIBLE LINEUP</span>
                <strong class="best-lineup-total">${formatFantasyPoints(best.total)}</strong>
                <span class="best-lineup-note">
                    Top scorer as captain, next five at full points, next four on the bench${liveGames ? " · so far" : ""}
                </span>
            </div>

            ${comparison}
        </div>
    `;
}


function createPlayerRow(player, rank, round, worst = false, lineupRole = null) {
    const inMyTeam = isPlayerSelected(round, player.id);

    const tag = lineupRole && ROLE_TAGS[lineupRole];

    return `
        <div
            class="my-team-player top-player js-open-profile ${worst ? "is-worst" : ""} ${inMyTeam ? "is-in-my-team" : ""}"
            data-player-id="${player.id}"
            data-player-name="${player.name}"
            data-player-team="${player.team}"
        >
            <div class="my-team-player-info">
                <span class="top-player-rank ${rank === 1 && !worst ? "is-first" : ""}">${rank}</span>

                <img
                    class="top-player-logo"
                    src="images/teams/${player.team}.svg"
                    alt="${player.team}"
                >

                <span class="my-team-player-name">${formatPlayerName(player.name)}</span>
                <span class="my-team-player-team">${TEAM_ABB[player.team] || player.team}</span>

                ${tag ? `<span class="lineup-tag is-${lineupRole}" title="${tag.title}">${tag.label}</span>` : ""}
            </div>

            <div class="top-player-stats">
                ${player.opponent ? `<span>vs ${TEAM_ABB[player.opponent] || player.opponent}</span>` : ""}
                <span>${player.points} PTS</span>
                ${player.live ? `<span class="top-players-live">LIVE</span>` : ""}
            </div>

            <div class="my-team-player-score">
                <span class="my-team-contribution">${formatFantasyPoints(player.fpts)}</span>
            </div>
        </div>
    `;
}


/* =========================
   DATA
========================= */

// Every player in the round's games, with their opponent
function getRoundPlayers(summaries) {
    return summaries.flatMap(summary =>
        summary.players.map(player => ({
            ...player,
            fpts: Number(player.fpts) || 0,
            points: Number(player.points) || 0,
            live: summary.live,
            opponent: summary.players.find(other => other.team !== player.team)?.team
        }))
    );
}


// Highest fantasy points first; ties go to more points scored
function byBest(a, b) {
    return b.fpts - a.fpts || b.points - a.points;
}


/* =========================
   HELPERS
========================= */

// "LAST, FIRST" → "F Last"-style, same as the rest of the app
function formatPlayerName(name = "") {
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
