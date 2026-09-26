/*
    Injury warnings from the BasketNews EuroLeague report,
    saved to data/injuries.json every 2 hours by the
    "Injury report" GitHub Action.

    Read from GitHub directly (updated as soon as the job
    commits), falling back to the site's own copy. If the
    file is missing, unreadable or marked unavailable,
    nothing injury-related is shown.
*/
const SOURCES = [
    "https://raw.githubusercontent.com/swartberg/fantasy-calculator/main/data/injuries.json",
    "data/injuries.json"
];

// Statuses that get a warning; "expected" and "ready" players should play
const WARNINGS = {
    out: { className: "is-out", label: "OUT" },
    doubtful: { className: "is-doubtful", label: "DOUBTFUL" },
    questionable: { className: "is-questionable" }
};

/*
    Where players appear: the row, its name element, and
    (if not on the row) the element holding the player's
    data-player-name / data-player-team.
*/
const TARGETS = [
    { row: ".player-tab", name: ".js-player-name" },
    { row: ".my-team-player", name: ".my-team-player-name" },
    { row: ".player-search-result", name: ".player-search-name", data: ".player-search-add" },
    // Profile window: a full note below the header
    { row: ".player-profile-header", detail: true }
];

const ROW_SELECTOR = TARGETS.map(target => target.row).join(", ");

let index = null;


/* =========================
   SETUP
========================= */

export async function setupInjuries() {
    const report = await loadReport();

    if (!report) return;

    index = buildIndex(report.players);

    markInjuries(document);

    // Rows are re-rendered often; mark new ones as they appear
    let pending = false;

    new MutationObserver(() => {
        if (pending) return;

        pending = true;

        requestAnimationFrame(() => {
            pending = false;

            markInjuries(document);
        });
    }).observe(document.body, { childList: true, subtree: true });
}


async function loadReport() {
    for (const url of SOURCES) {
        try {
            const response = await fetch(url, { cache: "no-cache" });

            if (!response.ok) continue;

            const report = await response.json();

            if (report?.available === true && Array.isArray(report.players)) {
                return report;
            }

            // A readable file saying "unavailable" means: show nothing
            return null;
        }
        catch (error) {
            // Try the next source
        }
    }

    return null;
}


/* =========================
   MATCHING
========================= */

// "Codi Miller-McIntyre" / "MILLER-MCINTYRE, CODI" → "codi miller-mcintyre"
function normalizeName(text) {
    return text
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z\s-]/g, " ")
        .split(/\s+/)
        .filter(word => word && !["jr", "sr", "ii", "iii", "iv"].includes(word))
        .join(" ");
}


const lastWord = text => text.split(" ").pop();


function buildIndex(players) {
    const byName = new Map();
    const byTeamLast = new Map();

    players
        .filter(player => WARNINGS[player.status])
        .forEach(player => {
            const name = normalizeName(player.name);

            byName.set(name, player);

            if (player.team) {
                const key = `${player.team}|${lastWord(name)}`;

                byTeamLast.set(key, [...(byTeamLast.get(key) || []), player]);
            }
        });

    return { byName, byTeamLast };
}


/*
    Feed names are "LAST, FIRST". Matches the full name,
    or else the last name within the player's team (only
    when that's unambiguous).
*/
export function getInjury(feedName = "", team = "") {
    if (!index || !feedName) return null;

    const [last, first = ""] = feedName.split(",").map(part => part.trim());

    const fullName = normalizeName(`${first} ${last}`);

    const exact = index.byName.get(fullName);

    if (exact) return exact;

    const sameTeam = index.byTeamLast.get(`${team}|${lastWord(normalizeName(last))}`);

    return sameTeam?.length === 1 ? sameTeam[0] : null;
}


/* =========================
   MARKING
========================= */

function markInjuries(root) {
    root.querySelectorAll(ROW_SELECTOR).forEach(row => {
        if (row.dataset.injuryChecked) return;

        row.dataset.injuryChecked = "true";

        const target = TARGETS.find(target => row.matches(target.row));

        const dataElement = target.data ? row.querySelector(target.data) : row;

        const injury = getInjury(
            dataElement?.dataset.playerName,
            dataElement?.dataset.playerTeam
        );

        if (!injury) return;

        const nameElement = target.name ? row.querySelector(target.name) : row;

        if (!nameElement) return;

        nameElement.insertAdjacentHTML(
            "afterend",
            target.detail ? renderNote(injury) : renderBadge(injury)
        );
    });
}


function describe(injury) {
    return [injury.label, injury.round, injury.comment].filter(Boolean).join(" · ");
}


const WARNING_ICON = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"
        stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M12 3 2 21h20z"></path>
        <path d="M12 10v5"></path>
        <path d="M12 18h.01"></path>
    </svg>
`;


function renderBadge(injury) {
    const warning = WARNINGS[injury.status];

    return `
        <span class="injury-badge ${warning.className}" title="Injury report: ${escapeHtml(describe(injury))}">
            ${WARNING_ICON}
            <span>${escapeHtml(warning.label || injury.label.toUpperCase())}</span>
        </span>
    `;
}


// Full details in the profile window
function renderNote(injury) {
    const warning = WARNINGS[injury.status];

    return `
        <div class="injury-note ${warning.className}">
            ${WARNING_ICON}
            <span>${escapeHtml(describe(injury))}</span>
        </div>
    `;
}


function escapeHtml(text = "") {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
