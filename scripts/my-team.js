const STORAGE_KEY = "fantasyMyTeams";

const MAX_STARTERS = 5;
const MAX_BENCH = 7;


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
            player =>
                player.role === "starter"
        ).length;


    const bench =
        teams[round].players.filter(
            player =>
                player.role === "bench"
        ).length;


    let role = "starter";


    /*
        New players become starters
        until the five starter slots
        are full.

        After that they automatically
        become bench players.
    */

    if (starters >= MAX_STARTERS) {

        if (bench >= MAX_BENCH) {
            return false;
        }

        role = "bench";
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

export function removePlayer(
    round,
    playerId
) {

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

export function setPlayerRole(
    round,
    playerId,
    role
) {

    if (
        role !== "starter" &&
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
            player =>
                String(player.id) ===
                String(playerId)
        );


    if (!player) {
        return false;
    }


    if (player.role === role) {
        return true;
    }


    /*
        Check destination limit.
    */

    if (role === "starter") {

        const starterCount =
            teams[round].players.filter(
                player =>
                    player.role === "starter"
            ).length;


        if (starterCount >= MAX_STARTERS) {
            return false;
        }

    }


    if (role === "bench") {

        const benchCount =
            teams[round].players.filter(
                player =>
                    player.role === "bench"
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

export function swapPlayerRoles(
    round,
    playerIdA,
    playerIdB
) {

    const teams = getAllTeams();

    if (!teams[round]) {
        return false;
    }


    /*
        Never allow changes after
        the team has been saved.
    */

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


    /*
        Dropping a player onto himself
        does nothing.
    */

    if (
        String(playerA.id) ===
        String(playerB.id)
    ) {
        return false;
    }


    /*
        If both players already have
        the same role, there is nothing
        to swap.
    */

    if (
        playerA.role ===
        playerB.role
    ) {
        return false;
    }


    /*
        Exchange roles.

        Because one is a starter and
        the other is a bench player,
        the limits remain valid.
    */

    const temporaryRole =
        playerA.role;


    playerA.role =
        playerB.role;


    playerB.role =
        temporaryRole;


    saveAllTeams(teams);

    return true;
}


/* =========================
   PLAYER SELECTED?
========================= */

export function isPlayerSelected(
    round,
    playerId
) {

    const team =
        getMyTeam(round);


    return team.players.some(
        player =>
            String(player.id) ===
            String(playerId)
    );
}


/* =========================
   PLAYER ROLE
========================= */

export function getPlayerRole(
    round,
    playerId
) {

    const team =
        getMyTeam(round);


    const player =
        team.players.find(
            player =>
                String(player.id) ===
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

    const team =
        getMyTeam(round);


    const starters =
        team.players.filter(
            player =>
                player.role === "starter"
        ).length;


    const bench =
        team.players.filter(
            player =>
                player.role === "bench"
        ).length;


    return {
        starters,
        bench,
        total:
            starters + bench
    };
}


/* =========================
   TEAM VALID?
========================= */

export function isTeamValid(round) {

    const counts =
        getTeamCounts(round);


    return (
        counts.starters === MAX_STARTERS &&
        counts.bench <= MAX_BENCH
    );
}


/* =========================
   CALCULATE TEAM POINTS
========================= */

export function calculateMyTeamPoints(
    round,
    currentPlayers = []
) {

    const team =
        getMyTeam(round);


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
                savedPlayer.role === "bench"
            ) {

                total +=
                    fantasyPoints / 2;

            } else {

                total +=
                    fantasyPoints;

            }

        }
    );


    return total;
}


/* =========================
   FINALIZE ROUND
========================= */

export function finalizeRound(round) {

    const teams =
        getAllTeams();


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


    const bench =
        teams[round].players.filter(
            player =>
                player.role === "bench"
        ).length;


    /*
        Exactly five starters are
        required to save the team.
    */

    if (
        starters !== MAX_STARTERS
    ) {
        return false;
    }


    if (
        bench > MAX_BENCH
    ) {
        return false;
    }


    teams[round].finalized =
        true;


    saveAllTeams(teams);

    return true;
}


/* =========================
   CHECK LOCKED
========================= */

export function isRoundFinalized(round) {

    const team =
        getMyTeam(round);


    return (
        team.finalized === true
    );
}


/* =========================
   LIMITS
========================= */

export {
    MAX_STARTERS,
    MAX_BENCH
};