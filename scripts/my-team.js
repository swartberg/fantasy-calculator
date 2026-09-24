const STORAGE_KEY = "fantasyMyTeams";

const MAX_STARTERS = 5;
const MAX_SIXTH = 1;
const MAX_BENCH = 4;


/* =========================
   STORAGE
========================= */

function getAllTeams() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);

        if (!saved) {
            return {};
        }

        return JSON.parse(saved);

    } catch (error) {
        console.error("Error loading My Team:", error);
        return {};
    }
}


function saveAllTeams(teams) {
    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(teams)
    );
}


/* =========================
   GET TEAM
========================= */

export function getMyTeam(round) {

    const teams = getAllTeams();

    if (!teams[round]) {
        return {
            players: [],
            finalized: false
        };
    }

    return teams[round];
}


/* =========================
   ADD PLAYER
========================= */

export function addPlayer(round, player) {

    const teams = getAllTeams();

    if (!teams[round]) {
        teams[round] = {
            players: [],
            finalized: false
        };
    }

    if (teams[round].finalized) {
        return false;
    }

    const alreadySelected =
        teams[round].players.some(
            savedPlayer =>
                String(savedPlayer.id) ===
                String(player.id)
        );

    if (alreadySelected) {
        return false;
    }

    const starters =
        teams[round].players.filter(
            savedPlayer =>
                savedPlayer.role === "starter"
        ).length;

    const sixth =
        teams[round].players.filter(
            savedPlayer =>
                savedPlayer.role === "sixth"
        ).length;

    const bench =
        teams[round].players.filter(
            savedPlayer =>
                savedPlayer.role === "bench"
        ).length;

    let role = null;

    /*
        Fill the roster in this order:

        1. 5 starters
        2. 1 sixth man
        3. 4 regular bench players
    */

    if (starters < MAX_STARTERS) {
        role = "starter";

    } else if (sixth < MAX_SIXTH) {
        role = "sixth";

    } else if (bench < MAX_BENCH) {
        role = "bench";

    } else {
        return false;
    }

    teams[round].players.push({
        id: player.id,
        name: player.name,
        team: player.team,
        gameCode: player.gameCode,
        role: role
    });

    saveAllTeams(teams);

    return true;
}


/* =========================
   REMOVE PLAYER
========================= */

export function removePlayer(round, playerId) {

    const teams = getAllTeams();

    if (!teams[round]) {
        return false;
    }

    if (teams[round].finalized) {
        return false;
    }

    teams[round].players =
        teams[round].players.filter(
            player =>
                String(player.id) !==
                String(playerId)
        );

    saveAllTeams(teams);

    return true;
}


/* =========================
   CHANGE ROLE
========================= */

export function setPlayerRole(round, playerId, role) {

    if (
        role !== "starter" &&
        role !== "sixth" &&
        role !== "bench"
    ) {
        return false;
    }

    const teams = getAllTeams();

    if (!teams[round]) {
        return false;
    }

    if (teams[round].finalized) {
        return false;
    }

    const player =
        teams[round].players.find(
            savedPlayer =>
                String(savedPlayer.id) ===
                String(playerId)
        );

    if (!player) {
        return false;
    }

    if (player.role === role) {
        return true;
    }

    if (role === "starter") {

        const starterCount =
            teams[round].players.filter(
                savedPlayer =>
                    savedPlayer.role === "starter"
            ).length;

        if (starterCount >= MAX_STARTERS) {
            return false;
        }
    }

    if (role === "sixth") {

        const sixthCount =
            teams[round].players.filter(
                savedPlayer =>
                    savedPlayer.role === "sixth"
            ).length;

        if (sixthCount >= MAX_SIXTH) {
            return false;
        }
    }

    if (role === "bench") {

        const benchCount =
            teams[round].players.filter(
                savedPlayer =>
                    savedPlayer.role === "bench"
            ).length;

        if (benchCount >= MAX_BENCH) {
            return false;
        }
    }

    player.role = role;

    saveAllTeams(teams);

    return true;
}


/* =========================
   SWAP PLAYERS
========================= */

export function swapPlayerRoles(round, playerIdA, playerIdB) {

    const teams = getAllTeams();

    if (!teams[round]) {
        return false;
    }

    if (teams[round].finalized) {
        return false;
    }

    const playerA =
        teams[round].players.find(
            player =>
                String(player.id) ===
                String(playerIdA)
        );

    const playerB =
        teams[round].players.find(
            player =>
                String(player.id) ===
                String(playerIdB)
        );

    if (!playerA || !playerB) {
        return false;
    }

    if (
        String(playerA.id) ===
        String(playerB.id)
    ) {
        return false;
    }

    if (playerA.role === playerB.role) {
        return false;
    }

    const temporaryRole = playerA.role;

    playerA.role = playerB.role;
    playerB.role = temporaryRole;

    saveAllTeams(teams);

    return true;
}


/* =========================
   PLAYER SELECTED?
========================= */

export function isPlayerSelected(round, playerId) {

    const team = getMyTeam(round);

    return team.players.some(
        player =>
            String(player.id) ===
            String(playerId)
    );
}


/* =========================
   PLAYER ROLE
========================= */

export function getPlayerRole(round, playerId) {

    const team = getMyTeam(round);

    const player =
        team.players.find(
            savedPlayer =>
                String(savedPlayer.id) ===
                String(playerId)
        );

    if (!player) {
        return null;
    }

    return player.role || "starter";
}


/* =========================
   TEAM COUNTS
========================= */

export function getTeamCounts(round) {

    const team = getMyTeam(round);

    const starters =
        team.players.filter(
            player =>
                player.role === "starter"
        ).length;

    const sixth =
        team.players.filter(
            player =>
                player.role === "sixth"
        ).length;

    const bench =
        team.players.filter(
            player =>
                player.role === "bench"
        ).length;

    return {
        starters,
        sixth,
        bench,
        total:
            starters +
            sixth +
            bench
    };
}


/* =========================
   TEAM VALID?
========================= */

export function isTeamValid(round) {

    const counts = getTeamCounts(round);

    return (
        counts.starters === MAX_STARTERS &&
        counts.sixth === MAX_SIXTH &&
        counts.bench === MAX_BENCH
    );
}


/* =========================
   CALCULATE TEAM POINTS
========================= */

export function calculateMyTeamPoints(
    round,
    currentPlayers = []
) {

    const team = getMyTeam(round);

    if (!team.players.length) {
        return 0;
    }

    let total = 0;

    team.players.forEach(
        savedPlayer => {

            const currentPlayer =
                currentPlayers.find(
                    player =>
                        String(player.id) ===
                        String(savedPlayer.id)
                );

            if (!currentPlayer) {
                return;
            }

            const fantasyPoints =
                Number(
                    currentPlayer.Fantasy_Points
                ) || 0;

            if (
                savedPlayer.role === "starter" ||
                savedPlayer.role === "sixth"
            ) {

                total += fantasyPoints;

            } else if (
                savedPlayer.role === "bench"
            ) {

                total += fantasyPoints / 2;
            }
        }
    );

    return total;
}


/* =========================
   FINALIZE ROUND
========================= */

export function finalizeRound(round) {

    const teams = getAllTeams();

    if (!teams[round]) {
        return false;
    }

    if (!teams[round].players.length) {
        return false;
    }

    const starters =
        teams[round].players.filter(
            player =>
                player.role === "starter"
        ).length;

    const sixth =
        teams[round].players.filter(
            player =>
                player.role === "sixth"
        ).length;

    const bench =
        teams[round].players.filter(
            player =>
                player.role === "bench"
        ).length;

    if (starters !== MAX_STARTERS) {
        return false;
    }

    if (sixth !== MAX_SIXTH) {
        return false;
    }

    if (bench !== MAX_BENCH) {
        return false;
    }

    teams[round].finalized = true;

    saveAllTeams(teams);

    return true;
}


/* =========================
   CHECK LOCKED
========================= */

export function isRoundFinalized(round) {

    const team = getMyTeam(round);

    return team.finalized === true;
}


/* =========================
   LIMITS
========================= */

export {
    MAX_STARTERS,
    MAX_SIXTH,
    MAX_BENCH
};
