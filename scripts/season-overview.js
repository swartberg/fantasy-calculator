import { getSavedRounds } from "./my-team.js?v=27";
import { getMyRoundScore } from "./round-scores.js?v=27";

// Ignore results of a render that a newer one replaced
let renderToken = 0;

// My Team re-renders on every change; wait for a pause before reloading
const RENDER_DELAY = 600;

let renderTimer = null;


/* =========================
   SETUP
========================= */

/*
    Season overview under My Team: total, average,
    best and worst round, and a score per round.
    Re-renders whenever My Team renders.
*/
export function setupSeasonOverview() {
    document.addEventListener("myteam:rendered", () => {
        clearTimeout(renderTimer);

        renderTimer = setTimeout(renderSeasonOverview, RENDER_DELAY);
    });

    document.querySelector(".js-season-overview")?.addEventListener("click", event => {
        const chip = event.target.closest(".season-round");

        if (!chip) return;

        // Same as picking the round in the round strip
        document.querySelector(`.round-chip[data-round="${chip.dataset.round}"]`)?.click();

        document.querySelector(".round-panel")?.scrollIntoView({ behavior: "smooth" });
    });
}


/* =========================
   RENDER
========================= */

async function renderSeasonOverview() {
    const container = document.querySelector(".js-season-overview");

    if (!container) return;

    const token = ++renderToken;

    const rounds = getSavedRounds();

    if (!rounds.length) {
        container.innerHTML = "";

        return;
    }

    // Keep the old numbers on screen while refreshing
    if (!container.innerHTML.trim()) {
        container.innerHTML = `
            <div class="my-team-loading">Loading season…</div>
        `;
    }

    let scores;

    try {
        scores = (await Promise.all(rounds.map(getMyRoundScore))).filter(Boolean);
    }
    catch (error) {
        console.error("Error loading season overview:", error);

        if (token !== renderToken) return;

        container.innerHTML = `
            <div class="my-team-loading">
                Couldn't load your season.
                <button class="retry-button js-season-retry" type="button">Retry</button>
            </div>
        `;

        container.querySelector(".js-season-retry").addEventListener("click", renderSeasonOverview);

        return;
    }

    if (token !== renderToken) return;

    // Only rounds with games played count toward the stats
    const played = scores.filter(round => round.games > 0);

    const total = played.reduce((sum, round) => sum + round.score, 0);

    const finished = played.filter(round => !round.liveGames);

    const best = finished.reduce((top, round) => (!top || round.score > top.score ? round : top), null);
    const worst = finished.reduce((low, round) => (!low || round.score < low.score ? round : low), null);

    container.innerHTML = `
        <div class="my-team-section-title season-title">SEASON</div>

        <div class="season-summary">
            <div class="season-total">
                <span class="season-label">TOTAL</span>
                <strong>${formatPoints(total)}</strong>
            </div>

            <div class="season-stats">
                ${renderStat("ROUNDS", played.length)}
                ${renderStat("AVERAGE", played.length ? formatPoints(total / played.length) : "–")}
                ${renderStat("BEST", best ? `R${best.round} · ${formatPoints(best.score)}` : "–", "is-best")}
                ${renderStat("WORST", worst ? `R${worst.round} · ${formatPoints(worst.score)}` : "–", "is-worst")}
            </div>
        </div>

        <div class="season-rounds">
            ${scores.map(renderRound).join("")}
        </div>
    `;
}


function renderStat(label, value, className = "") {
    return `
        <div class="season-stat ${className}">
            <span class="season-label">${label}</span>
            <span class="season-stat-value">${value}</span>
        </div>
    `;
}


// One chip per saved round; unsaved and live rounds are marked
function renderRound(round) {
    const classes = [
        "season-round",
        round.saved ? "" : "is-unsaved",
        round.liveGames ? "is-live" : ""
    ].join(" ");

    const title = !round.games
        ? "Not played yet"
        : `${round.saved ? "Saved" : "Not saved"}${round.liveGames ? " · live" : ""}`;

    return `
        <button class="${classes}" type="button" data-round="${round.round}" title="${title}">
            <span class="season-round-number">R${round.round}</span>
            <span class="season-round-score">${round.games ? formatPoints(round.score) : "–"}</span>
        </button>
    `;
}


function formatPoints(points) {
    const value = Number(points) || 0;

    return Number.isInteger(value)
        ? value.toString()
        : value.toFixed(1);
}
