/*
    Reads the BasketNews EuroLeague injury report and saves
    the listed players to data/injuries.json for the app.

    If the report can't be reached or doesn't look like the
    expected table, it saves { available: false } so the app
    shows nothing injury-related instead of stale or wrong data.

    The file is only rewritten when the list changes, so an
    unchanged report doesn't create a commit.

    Run: node .github/scripts/fetch-injuries.mjs
*/
import * as cheerio from "cheerio";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { TEAM_NAMES } from "../../scripts/teams.js";

const OUTPUT = "data/injuries.json";

// Tried in order until one parses
const SOURCES = [
    "https://basketnews.com/news-212393-euroleague-injury-report-updated.html",
    "https://basketnews.com/leagues/25-euroleague/injured.html"
];

// Fewer players than this means the page wasn't read correctly
const MIN_PLAYERS = 5;

// Report status → how serious it is for the app
const STATUSES = {
    "out": "out",
    "doubtful": "doubtful",
    "questionable": "questionable",
    "game-time": "questionable",
    "game time": "questionable",
    "gametime": "questionable",
    "game-time decision": "questionable",
    "uncertain": "questionable",
    "day-to-day": "questionable",
    "expected": "expected",
    "probable": "expected",
    "ready": "ready"
};


/* =========================
   FETCH
========================= */

async function fetchPage(url) {
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            const response = await fetch(url, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (fantasy-calculator injury check; a few requests per day)",
                    "Accept": "text/html"
                },
                signal: AbortSignal.timeout(20000)
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            return await response.text();
        }
        catch (error) {
            console.log(`${url}: attempt ${attempt} failed (${error.message})`);

            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }

    return null;
}


/* =========================
   PARSE
========================= */

const clean = text => text.replace(/\s+/g, " ").trim();

const normalize = text => text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

function statusOf(text) {
    return STATUSES[normalize(clean(text))] || null;
}


/*
    Doesn't depend on BasketNews's CSS classes: in every table
    row, the status cell is found by its word and the player
    is the cell before it. The team comes from a one-cell team
    row, or else the heading just above the table.
*/
function parseReport(html) {
    const $ = cheerio.load(html);

    const players = [];

    $("table").each((_, table) => {
        let teamName = clean(
            $(table).prevAll("h1, h2, h3, h4, h5, h6, p, div").first().text()
        ).slice(0, 80);

        $(table).find("tr").each((_, row) => {
            const cells = $(row)
                .children("td, th")
                .map((_, cell) => clean($(cell).text()))
                .get();

            const filled = cells.filter(Boolean);

            const statusIndex = cells.findIndex(cell => statusOf(cell));

            // Team header row: a single filled cell that isn't a status
            if (statusIndex === -1) {
                if (filled.length === 1 && filled[0].length > 3) {
                    teamName = filled[0];
                }

                return;
            }

            const name = cells[statusIndex - 1];

            if (!name || name.length < 3 || statusOf(name)) return;

            players.push({
                name,
                teamName,
                team: findTeamCode(teamName),
                status: statusOf(cells[statusIndex]),
                label: cells[statusIndex],
                round: cells[statusIndex + 1] || "",
                comment: (cells[statusIndex + 2] || "").slice(0, 160)
            });
        });
    });

    // The page contains the report twice (e.g. desktop and mobile copies)
    const seen = new Set();

    return players.filter(player => {
        const key = `${player.name}|${player.teamName}`;

        if (seen.has(key)) return false;

        seen.add(key);

        return true;
    });
}


/*
    "Crvena Zvezda Meridianbet Belgrade" → RED: the team whose
    app name shares the most distinctive words (4+ letters).
*/
const words = text => normalize(text)
    .split(/[^a-z0-9]+/)
    .filter(word => word.length >= 4);

function findTeamCode(teamName) {
    const reportWords = new Set(words(teamName || ""));

    let best = null;
    let bestScore = 0;

    Object.entries(TEAM_NAMES).forEach(([code, name]) => {
        const score = words(name).filter(word => reportWords.has(word)).length;

        if (score > bestScore) {
            best = code;
            bestScore = score;
        }
    });

    return best;
}


/* =========================
   SAVE
========================= */

async function readExisting() {
    try {
        return JSON.parse(await readFile(OUTPUT, "utf8"));
    }
    catch (error) {
        return null;
    }
}


async function save(report) {
    const existing = await readExisting();

    const sameContent =
        existing &&
        existing.available === report.available &&
        JSON.stringify(existing.players) === JSON.stringify(report.players);

    if (sameContent) {
        console.log("No changes in the report.");

        return;
    }

    await mkdir("data", { recursive: true });

    await writeFile(
        OUTPUT,
        JSON.stringify({ ...report, updatedAt: new Date().toISOString() }, null, 2) + "\n"
    );

    console.log(`Saved ${report.players.length} players (available: ${report.available}).`);
}


let report = null;

for (const url of SOURCES) {
    const html = await fetchPage(url);

    if (!html) continue;

    const players = parseReport(html);

    console.log(`${url}: ${players.length} players found`);

    if (players.length >= MIN_PLAYERS) {
        const unmatched = players.filter(player => !player.team).map(player => player.teamName);

        if (unmatched.length) {
            console.log(`Teams not matched: ${[...new Set(unmatched)].join(", ")}`);
        }

        report = { available: true, source: url, players };

        break;
    }
}

await save(report || {
    available: false,
    reason: "Report unreachable or not in the expected format",
    players: []
});
