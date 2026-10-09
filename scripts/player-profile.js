import { TEAM_NAMES, TEAM_ABB } from "./teams.js?v=28";
import { getGameSummaries, getRoundGames, getGameRound } from "./season-games.js?v=28";
import { loadPlayerPhoto, PHOTO_PLACEHOLDER } from "./player-photo.js?v=28";

const RECENT_GAMES = 5;

let modal = null;

// Ignore results of a profile that was closed or replaced
let openToken = 0;


/* =========================
   SETUP
========================= */

/*
    Tapping a player row in the game stats opens
    their profile: season average and last 5 games,
    up to the selected round.
*/
export function setupPlayerProfile({ getRound }) {
    document.addEventListener("click", event => {
        // Stat rows and any other element marked to open a profile
        const playerTab = event.target.closest(".player-tab, .js-open-profile");

        // Buttons (add, roles, remove) and the drag handle do their own thing
        if (!playerTab || event.target.closest("button, .my-team-drag-handle")) return;

        openPlayerProfile(
            {
                id: playerTab.dataset.playerId,
                name: playerTab.dataset.playerName,
                team: playerTab.dataset.playerTeam
            },
            getRound()
        );
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            closePlayerProfile();
        }
    });
}


/* =========================
   OPEN / CLOSE
========================= */

async function openPlayerProfile(player, round) {
    const token = ++openToken;

    const content = showModal();

    content.innerHTML = `
        ${renderHeader(player)}

        <div class="player-profile-loading js-profile-loading">
            Loading season…
        </div>
    `;

    loadPlayerPhoto(content.querySelector(".player-profile-photo"), player.name, "player-profile-photo-img");

    const games = Array.from(
        { length: round },
        (_, index) => getRoundGames(index + 1)
    ).flat();

    let summaries;

    try {
        summaries = await getGameSummaries(games, (loaded, total) => {
            const loading = content.querySelector(".js-profile-loading");

            if (token === openToken && loading) {
                loading.textContent = `Loading season… ${Math.round(loaded / total * 100)}%`;
            }
        });
    }
    catch (error) {
        console.error("Error loading player profile:", error);

        if (token !== openToken) return;

        const loading = content.querySelector(".js-profile-loading");

        if (loading) {
            loading.innerHTML = `
                Couldn't load the season.
                <button class="retry-button" type="button">Retry</button>
            `;

            // Finished games loaded so far are cached, so a retry is quicker
            loading.querySelector(".retry-button").addEventListener("click", () => {
                openPlayerProfile(player, round);
            });
        }

        return;
    }

    if (token !== openToken) return;

    const playerGames = getPlayerGames(player, summaries);

    // Show the team from their latest game, in case they moved
    const latest = playerGames[0];

    content.innerHTML = `
        ${renderHeader({ ...player, team: latest?.team || player.team })}

        ${renderStats(playerGames, round)}
    `;

    loadPlayerPhoto(content.querySelector(".player-profile-photo"), player.name, "player-profile-photo-img");
}


function closePlayerProfile() {
    if (!modal || !modal.classList.contains("is-open")) return;

    openToken++;

    modal.classList.remove("is-open");

    document.body.classList.remove("has-player-profile");
}


function showModal() {
    if (!modal) {
        modal = document.createElement("div");

        modal.className = "player-profile-overlay";

        modal.innerHTML = `
            <div
                class="player-profile"
                role="dialog"
                aria-modal="true"
                aria-label="Player profile"
            >
                <button
                    class="player-profile-close"
                    type="button"
                    aria-label="Close"
                >×</button>

                <div class="js-profile-content"></div>
            </div>
        `;

        // Close on the × or a tap outside the window
        modal.addEventListener("click", event => {
            if (
                event.target === modal ||
                event.target.closest(".player-profile-close")
            ) {
                closePlayerProfile();
            }
        });

        document.body.appendChild(modal);
    }

    modal.classList.add("is-open");

    document.body.classList.add("has-player-profile");

    return modal.querySelector(".js-profile-content");
}


/* =========================
   DATA
========================= */

// The player's games, newest first
function getPlayerGames(player, summaries) {
    return summaries
        .map(summary => {
            const stats = summary.players.find(
                gamePlayer => String(gamePlayer.id) === String(player.id)
            );

            if (!stats) return null;

            const opponent = summary.players.find(
                gamePlayer => gamePlayer.team !== stats.team
            )?.team;

            return {
                round: getGameRound(summary.gameCode),
                gameCode: summary.gameCode,
                live: summary.live,
                team: stats.team,
                opponent,
                fpts: Number(stats.fpts) || 0
            };
        })
        .filter(Boolean)
        .sort((a, b) => b.gameCode - a.gameCode);
}


/* =========================
   RENDER
========================= */

function renderHeader(player) {
    return `
        <div
            class="player-profile-header"
            data-player-name="${player.name}"
            data-player-team="${player.team}"
        >
            <div class="player-profile-photo">
                <div class="player-profile-photo-placeholder js-photo-placeholder">
                    ${PHOTO_PLACEHOLDER}
                </div>

                <img
                    class="player-profile-logo"
                    src="images/teams/${player.team}.svg"
                    alt="${player.team}"
                >
            </div>

            <div class="player-profile-title">
                <span class="player-profile-name">${formatName(player.name)}</span>
                <span class="player-profile-team">${TEAM_NAMES[player.team] || player.team}</span>
            </div>
        </div>
    `;
}


function renderStats(playerGames, round) {
    const played = playerGames.length;

    const average = played
        ? playerGames.reduce((total, game) => total + game.fpts, 0) / played
        : null;

    const recent = playerGames.slice(0, RECENT_GAMES);

    // Bars are scaled to the best of the recent games
    const best = Math.max(1, ...recent.map(game => game.fpts));

    const slots = Array.from({ length: RECENT_GAMES }, (_, index) => {
        const game = recent[index];

        if (!game) {
            return `
                <div class="player-profile-game is-empty">
                    <span class="player-profile-game-fpts">–</span>
                </div>
            `;
        }

        const height = Math.max(0, game.fpts) / best * 100;

        return `
            <div class="player-profile-game ${game.live ? "is-live" : ""}">
                <div class="player-profile-bar">
                    <div
                        class="player-profile-bar-fill ${game.fpts < 0 ? "is-negative" : ""}"
                        style="height: ${height}%"
                    ></div>
                </div>

                <span class="player-profile-game-fpts ${getGameClass(game.fpts, average)}">${formatFantasyPoints(game.fpts)}</span>

                <span class="player-profile-game-info">
                    ${game.live ? "LIVE" : `R${game.round}`}
                    ·
                    ${TEAM_ABB[game.opponent] || game.opponent || ""}
                </span>
            </div>
        `;
    }).join("");

    return `
        <div class="player-profile-average">
            <span class="player-profile-label">AVG FPTS</span>

            <strong>${average === null ? "–" : formatFantasyPoints(average)}</strong>

            <span class="player-profile-sub">
                ${played} ${played === 1 ? "game" : "games"} · through round ${round}
            </span>
        </div>

        <div class="player-profile-label player-profile-recent-title">
            LAST ${RECENT_GAMES} GAMES
        </div>

        <div class="player-profile-games">
            ${slots}
        </div>
    `;
}


// Green when at or above the player's average, red when negative
function getGameClass(fpts, average) {
    if (fpts < 0) return "is-bad";

    if (fpts > 0 && fpts >= average) return "is-good";

    return "";
}


/* =========================
   HELPERS
========================= */

// "LAST, FIRST" → "FIRST LAST"
function formatName(name = "") {
    const [last, first] = name.split(",").map(part => part.trim());

    return first ? `${first} ${last}` : name;
}


function formatFantasyPoints(points) {
    const value = Number(points) || 0;

    return Number.isInteger(value)
        ? value.toString()
        : value.toFixed(1);
}
