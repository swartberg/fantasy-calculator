import { fetchAndUpdate } from "./api-stats.js";
import { TEAM_NAMES } from "./teams.js";
import { gameSelect } from "./game-selector.js";

import {
    addPlayer,
    removePlayer,
    isPlayerSelected,
    getMyTeam,
    setPlayerRole,
    swapPlayerRoles,
    finalizeRound,
    isRoundFinalized
} from "./my-team.js";


let updateLoop = null;
let myTeamUpdateLoop = null;

let statsContainer = null;
let currentGameCode = null;
let myTeamRefreshing = false;


/* =========================
   INITIALIZATION
========================= */

document.addEventListener("DOMContentLoaded", () => {

    statsContainer =
        document.querySelector(".stats-container");


    if (statsContainer) {
        statsContainer.classList.remove("is-active");
    }


    gameSelect(loadGame);

    setupMyTeamRefresh();


    const roundSelector =
        document.querySelector(
            ".js-select-round"
        );


    if (roundSelector) {

        roundSelector.addEventListener(
            "change",
            () => {

                const myTeamView =
                    document.querySelector(
                        ".js-view-my-team"
                    );


                if (
                    myTeamView &&
                    isElementVisible(myTeamView)
                ) {

                    renderMyTeam();

                }

            }
        );

    }

});


/* =========================
   LOAD GAME
========================= */

async function loadGame(gameCode) {

    if (updateLoop) {

        clearInterval(updateLoop);

        updateLoop = null;

    }


    currentGameCode =
        gameCode;


    await getStats(gameCode);

}


/* =========================
   GET GAME STATS
========================= */

async function getStats(gameCode) {

    if (!statsContainer) {
        return;
    }


    const result =
        await fetchAndUpdate(
            gameCode
        );


    if (
        !result ||
        !result.players ||
        result.players.length === 0
    ) {

        return;

    }


    const players =
        result.players;


    const isLive =
        result.Live;


    const teams = [
        ...new Set(
            players.map(
                player => player.Team
            )
        )
    ];


    const homeTeamCode =
        teams[0];


    const awayTeamCode =
        teams[1];


    /* =========================
       TEAM NAMES
    ========================= */

    const homeTeamName =
        document.querySelector(
            ".js-home-team-name"
        );


    const awayTeamName =
        document.querySelector(
            ".js-away-team-name"
        );


    if (homeTeamName) {

        homeTeamName.textContent =
            TEAM_NAMES[homeTeamCode] ||
            homeTeamCode;

    }


    if (awayTeamName) {

        awayTeamName.textContent =
            TEAM_NAMES[awayTeamCode] ||
            awayTeamCode;

    }


    /* =========================
       PLAYER CONTAINERS
    ========================= */

    const homeContainer =
        document.querySelector(
            ".home-team"
        );


    const awayContainer =
        document.querySelector(
            ".away-team"
        );


    if (
        !homeContainer ||
        !awayContainer
    ) {

        return;

    }


    homeContainer.innerHTML = "";
    awayContainer.innerHTML = "";


    /* =========================
       CURRENT ROUND
    ========================= */

    const currentRound =
        getCurrentRound();


    const roundLocked =
        isRoundFinalized(
            currentRound
        );


    /* =========================
       RENDER GAME PLAYERS
    ========================= */

    players.forEach(
        player => {

            const playerName =
                player.Name.split(",");


            const playerTab =
                document.createElement(
                    "div"
                );


            playerTab.className =
                "player-tab";


            playerTab.dataset.playerId =
                player.id;


            const selected =
                isPlayerSelected(
                    currentRound,
                    player.id
                );


            playerTab.innerHTML = `

                <div class="player-info">

                    <div class="player-name">

                        <span class="js-player-name">

                            ${
                                playerName[1]?.[1] ||
                                ""
                            }.

                            ${
                                playerName[0]
                            }

                        </span>

                    </div>

                </div>


                <div class="player-stats">

                    <div class="player-pts stat-pair">

                        <span class="stat-label">
                            PTS
                        </span>

                        <span class="js-stat">
                            ${player.Points}
                        </span>

                    </div>


                    <div class="player-reb stat-pair">

                        <span class="stat-label">
                            REB
                        </span>

                        <span class="js-stat">
                            ${player.Rebounds}
                        </span>

                    </div>


                    <div class="player-ast stat-pair">

                        <span class="stat-label">
                            AST
                        </span>

                        <span class="js-stat">
                            ${player.Assists}
                        </span>

                    </div>


                    <div class="player-to stat-pair">

                        <span class="stat-label">
                            TO
                        </span>

                        <span class="js-stat">
                            ${player.Turnovers}
                        </span>

                    </div>

                </div>


                <div class="player-fpts stat-pair">

                    <span class="stat-label">
                        FPTS
                    </span>

                    <span class="js-stat js-fpts">

                        ${
                            formatFantasyPoints(
                                player.Fantasy_Points
                            )
                        }

                    </span>

                </div>


                <button
                    class="my-team-button ${
                        selected
                            ? "is-selected"
                            : ""
                    } ${
                        roundLocked
                            ? "is-locked"
                            : ""
                    }"
                    type="button"
                    ${
                        roundLocked
                            ? "disabled"
                            : ""
                    }
                >

                    ${
                        selected
                            ? "✓"
                            : "+"
                    }

                </button>

            `;


            /* =========================
               MY TEAM BUTTON
            ========================= */

            const myTeamButton =
                playerTab.querySelector(
                    ".my-team-button"
                );


            myTeamButton.addEventListener(
                "click",
                () => {

                    if (
                        isRoundFinalized(
                            currentRound
                        )
                    ) {

                        return;

                    }


                    const currentlySelected =
                        isPlayerSelected(
                            currentRound,
                            player.id
                        );


                    if (currentlySelected) {

                        const removed =
                            removePlayer(
                                currentRound,
                                player.id
                            );


                        if (!removed) {
                            return;
                        }


                        myTeamButton.classList.remove(
                            "is-selected"
                        );


                        myTeamButton.textContent =
                            "+";

                    }
                    else {

                        const added =
                            addPlayer(
                                currentRound,
                                {
                                    id:
                                        player.id,

                                    name:
                                        player.Name,

                                    team:
                                        player.Team,

                                    gameCode:
                                        gameCode
                                }
                            );


                        if (!added) {
                            return;
                        }


                        myTeamButton.classList.add(
                            "is-selected"
                        );


                        myTeamButton.textContent =
                            "✓";

                    }


                    /*
                        Only update My Team when
                        the user is actually looking
                        at it.
                    */

                    const myTeamView =
                        document.querySelector(
                            ".js-view-my-team"
                        );


                    if (
                        myTeamView &&
                        isElementVisible(
                            myTeamView
                        )
                    ) {

                        renderMyTeam();

                    }

                }
            );


            /* =========================
               APPEND PLAYER
            ========================= */

            if (
                player.Team ===
                homeTeamCode
            ) {

                homeContainer.appendChild(
                    playerTab
                );

            }
            else if (
                player.Team ===
                awayTeamCode
            ) {

                awayContainer.appendChild(
                    playerTab
                );

            }

        }
    );


    statsContainer.classList.add(
        "is-active"
    );


    /* =========================
       LIVE GAME LOOP
    ========================= */

    if (
        isLive &&
        !updateLoop
    ) {

        updateLoop =
            setInterval(
                () => {

                    getStats(
                        gameCode
                    );

                },
                10000
            );

    }


    if (
        !isLive &&
        updateLoop
    ) {

        clearInterval(
            updateLoop
        );

        updateLoop = null;

    }

}


/* =========================
   CURRENT ROUND
========================= */

function getCurrentRound() {

    const selector =
        document.querySelector(
            ".js-select-round"
        );


    if (!selector) {
        return 1;
    }


    return (
        Number(
            selector.value
        ) || 1
    );

}


/* =========================
   RENDER MY TEAM
========================= */

async function renderMyTeam() {

    const container =
        document.querySelector(
            ".my-team-container"
        );


    if (!container) {
        return;
    }


    const round =
        getCurrentRound();


    const myTeam =
        getMyTeam(round);


    /* =========================
       EMPTY TEAM
    ========================= */

    if (
        !myTeam.players ||
        !myTeam.players.length
    ) {

        container.innerHTML = `

            <div class="my-team-empty">

                <span>
                    MY TEAM
                </span>

                <p>
                    Select players from a game
                    to build your team.
                </p>

            </div>

        `;

        return;

    }


    /*
        Initial render only.

        Background updates use
        refreshMyTeamStats().
    */

    container.innerHTML = `

        <div class="my-team-loading">
            Loading My Team…
        </div>

    `;


    /* =========================
       GET UNIQUE GAMES
    ========================= */

    const gameCodes = [
        ...new Set(
            myTeam.players
                .map(
                    player =>
                        player.gameCode
                )
                .filter(Boolean)
        )
    ];


    const allPlayers = [];


    /* =========================
       FETCH GAMES
    ========================= */

    for (
        const gameCode of gameCodes
    ) {

        const result =
            await fetchAndUpdate(
                gameCode
            );


        if (
            !result ||
            !result.players
        ) {

            continue;

        }


        result.players.forEach(
            player => {

                const exists =
                    allPlayers.some(
                        existing =>
                            String(
                                existing.id
                            ) ===
                            String(
                                player.id
                            )
                    );


                if (!exists) {

                    allPlayers.push(
                        player
                    );

                }

            }
        );

    }


    /* =========================
       BUILD TEAM PLAYERS
    ========================= */

    const teamPlayers =
        myTeam.players
            .map(
                savedPlayer => {

                    const currentPlayer =
                        allPlayers.find(
                            player =>
                                String(
                                    player.id
                                ) ===
                                String(
                                    savedPlayer.id
                                )
                        );


                    if (!currentPlayer) {
                        return null;
                    }


                    return {

                        ...savedPlayer,

                        fantasyPoints:
                            Number(
                                currentPlayer
                                    .Fantasy_Points
                            ) || 0

                    };

                }
            )
            .filter(Boolean);


    renderMyTeamHTML(
        container,
        round,
        teamPlayers,
        myTeam.finalized === true
    );

}


/* =========================
   RENDER MY TEAM HTML
========================= */

function renderMyTeamHTML(
    container,
    round,
    teamPlayers,
    locked
) {

    const starters =
        teamPlayers.filter(
            player =>
                player.role ===
                "starter"
        );


    const bench =
        teamPlayers.filter(
            player =>
                player.role ===
                "bench"
        );


    const starterPoints =
        starters.reduce(
            (
                total,
                player
            ) =>
                total +
                player.fantasyPoints,
            0
        );


    const benchPoints =
        bench.reduce(
            (
                total,
                player
            ) =>
                total +
                player.fantasyPoints / 2,
            0
        );


    const totalPoints =
        starterPoints +
        benchPoints;


    container.innerHTML = `

        <div class="my-team-header">

            <span>
                MY TEAM
            </span>

            <strong>
                ROUND ${round}
            </strong>

        </div>


        ${
            locked
                ? `

                    <div
                        class="my-team-locked-banner"
                    >
                        TEAM LOCKED
                    </div>

                `
                : ""
        }


        <div class="my-team-section">

            <div class="my-team-section-title">

                STARTERS

                <span>
                    ${starters.length} / 5
                </span>

            </div>


            <div class="my-team-player-list">

                ${
                    starters.length
                        ? starters
                            .map(
                                player =>
                                    createMyTeamPlayer(
                                        player,
                                        false,
                                        locked
                                    )
                            )
                            .join("")
                        : `

                            <div
                                class="my-team-no-players"
                            >
                                No starters
                            </div>

                        `
                }

            </div>

        </div>


        <div class="my-team-section">

            <div class="my-team-section-title">

                BENCH

                <span>
                    ${bench.length} / 7
                </span>

            </div>


            <div class="my-team-player-list">

                ${
                    bench.length
                        ? bench
                            .map(
                                player =>
                                    createMyTeamPlayer(
                                        player,
                                        true,
                                        locked
                                    )
                            )
                            .join("")
                        : `

                            <div
                                class="my-team-no-players"
                            >
                                No bench players
                            </div>

                        `
                }

            </div>

        </div>


        <div class="my-team-total">

            <span>
                TOTAL
            </span>

            <strong
                class="js-my-team-total"
            >
                ${formatFantasyPoints(
                    totalPoints
                )}
            </strong>

        </div>


        ${
            locked
                ? `

                    <div
                        class="my-team-save-status"
                    >
                        Your team is locked
                        for this round.
                    </div>

                `
                : `

                    <button
                        class="save-team-button"
                        type="button"
                    >
                        SAVE TEAM
                    </button>

                `
        }

    `;


    setupMyTeamPlayerEvents(
        round,
        locked
    );


    /* =========================
       SAVE TEAM
    ========================= */

    const saveButton =
        container.querySelector(
            ".save-team-button"
        );


    if (saveButton) {

        saveButton.addEventListener(
            "click",
            () => {

                const starterCount =
                    starters.length;


                const benchCount =
                    bench.length;


                if (
                    starterCount !== 5
                ) {

                    window.alert(
                        `You need exactly 5 starters before saving your team. You currently have ${starterCount}.`
                    );

                    return;

                }


                if (
                    benchCount > 7
                ) {

                    window.alert(
                        "You can have a maximum of 7 bench players."
                    );

                    return;

                }


                const confirmed =
                    window.confirm(
                        "Save your team for this round? You will not be able to change it afterwards."
                    );


                if (!confirmed) {
                    return;
                }


                const saved =
                    finalizeRound(
                        round
                    );


                if (!saved) {

                    window.alert(
                        "Your team could not be saved."
                    );

                    return;

                }


                renderMyTeam();

            }
        );

    }

}


/* =========================
   CREATE PLAYER CARD
========================= */

function createMyTeamPlayer(
    player,
    isBench,
    locked
) {

    const contribution =
        isBench
            ? player.fantasyPoints / 2
            : player.fantasyPoints;


    return `

        <div
            class="my-team-player ${
                locked
                    ? "is-locked"
                    : ""
            }"
            data-player-id="${player.id}"
            data-fantasy-points="${player.fantasyPoints}"
            data-role="${
                isBench
                    ? "bench"
                    : "starter"
            }"
            draggable="${!locked}"
        >

            <div class="my-team-player-info">

                ${
                    !locked
                        ? `

                            <span
                                class="my-team-drag-handle"
                                title="Drag to swap"
                            >
                                ⋮⋮
                            </span>

                        `
                        : ""
                }


                <span
                    class="my-team-player-name"
                >

                    ${formatPlayerName(
                        player.name
                    )}

                </span>


                <span
                    class="my-team-player-team"
                >

                    ${player.team}

                </span>

            </div>


            <div
                class="my-team-player-score"
            >

                ${
                    isBench
                        ? `

                            <span
                                class="my-team-actual-fpts"
                            >
                                ${formatFantasyPoints(
                                    player.fantasyPoints
                                )}
                            </span>

                        `
                        : ""
                }


                <span
                    class="my-team-contribution"
                >

                    ${formatFantasyPoints(
                        contribution
                    )}

                </span>

            </div>


            ${
                locked
                    ? ""
                    : `

                        <div
                            class="my-team-player-actions"
                        >

                            <button
                                class="my-team-role-button ${
                                    isBench
                                        ? ""
                                        : "is-active"
                                }"
                                data-role="starter"
                                type="button"
                            >
                                S
                            </button>


                            <button
                                class="my-team-role-button ${
                                    isBench
                                        ? "is-active"
                                        : ""
                                }"
                                data-role="bench"
                                type="button"
                            >
                                B
                            </button>


                            <button
                                class="my-team-remove-button"
                                type="button"
                            >
                                ×
                            </button>

                        </div>

                    `
            }

        </div>

    `;

}


/* =========================
   PLAYER EVENTS
========================= */

function setupMyTeamPlayerEvents(
    round,
    locked
) {

    if (locked) {
        return;
    }


    const players =
        document.querySelectorAll(
            ".my-team-player"
        );


    let draggedPlayerId = null;


    /* =========================
       DRAG START
    ========================= */

    players.forEach(
        playerElement => {

            playerElement.addEventListener(
                "dragstart",
                event => {

                    draggedPlayerId =
                        playerElement.dataset
                            .playerId;


                    playerElement.classList.add(
                        "is-dragging"
                    );


                    event.dataTransfer.effectAllowed =
                        "move";


                    event.dataTransfer.setData(
                        "text/plain",
                        draggedPlayerId
                    );

                }
            );


            /* =====================
               DRAG END
            ===================== */

            playerElement.addEventListener(
                "dragend",
                () => {

                    draggedPlayerId =
                        null;


                    document
                        .querySelectorAll(
                            ".my-team-player"
                        )
                        .forEach(
                            element => {

                                element.classList.remove(
                                    "is-dragging"
                                );

                                element.classList.remove(
                                    "is-drag-over"
                                );

                            }
                        );

                }
            );


            /* =====================
               DRAG OVER
            ===================== */

            playerElement.addEventListener(
                "dragover",
                event => {

                    event.preventDefault();


                    const targetPlayerId =
                        playerElement.dataset
                            .playerId;


                    if (
                        String(
                            targetPlayerId
                        ) ===
                        String(
                            draggedPlayerId
                        )
                    ) {

                        return;

                    }


                    playerElement.classList.add(
                        "is-drag-over"
                    );


                    event.dataTransfer.dropEffect =
                        "move";

                }
            );


            /* =====================
               DRAG LEAVE
            ===================== */

            playerElement.addEventListener(
                "dragleave",
                event => {

                    if (
                        !playerElement.contains(
                            event.relatedTarget
                        )
                    ) {

                        playerElement.classList.remove(
                            "is-drag-over"
                        );

                    }

                }
            );


            /* =====================
               DROP
            ===================== */

            playerElement.addEventListener(
                "drop",
                event => {

                    event.preventDefault();


                    const targetPlayerId =
                        playerElement.dataset
                            .playerId;


                    const sourcePlayerId =
                        event.dataTransfer.getData(
                            "text/plain"
                        );


                    playerElement.classList.remove(
                        "is-drag-over"
                    );


                    if (
                        !sourcePlayerId ||
                        !targetPlayerId
                    ) {

                        return;

                    }


                    if (
                        String(
                            sourcePlayerId
                        ) ===
                        String(
                            targetPlayerId
                        )
                    ) {

                        return;

                    }


                    const sourceElement =
                        document.querySelector(
                            `.my-team-player[data-player-id="${sourcePlayerId}"]`
                        );


                    if (!sourceElement) {
                        return;
                    }


                    const sourceSection =
                        sourceElement.closest(
                            ".my-team-section"
                        );


                    const targetSection =
                        playerElement.closest(
                            ".my-team-section"
                        );


                    if (
                        !sourceSection ||
                        !targetSection
                    ) {

                        return;

                    }


                    /*
                        Same section doesn't
                        require a role swap.
                    */

                    if (
                        sourceSection ===
                        targetSection
                    ) {

                        return;

                    }


                    /*
                        Persist the swap.
                    */

                    const swapped =
                        swapPlayerRoles(
                            round,
                            sourcePlayerId,
                            targetPlayerId
                        );


                    if (!swapped) {
                        return;
                    }


                    const sourceList =
                        sourceSection.querySelector(
                            ".my-team-player-list"
                        );


                    const targetList =
                        targetSection.querySelector(
                            ".my-team-player-list"
                        );


                    if (
                        !sourceList ||
                        !targetList
                    ) {

                        return;

                    }


                    /*
                        =====================
                        SWAP DOM ELEMENTS
                        =====================
                    */

                    targetList.appendChild(
                        sourceElement
                    );


                    sourceList.appendChild(
                        playerElement
                    );


                    /*
                        =====================
                        UPDATE ROLES
                        =====================
                    */

                    sourceElement.dataset.role =
                        sourceElement.dataset.role ===
                        "starter"
                            ? "bench"
                            : "starter";


                    playerElement.dataset.role =
                        playerElement.dataset.role ===
                        "starter"
                            ? "bench"
                            : "starter";


                    /*
                        =====================
                        UPDATE PLAYER UI
                        =====================
                    */

                    updatePlayerRoleUI(
                        sourceElement
                    );


                    updatePlayerRoleUI(
                        playerElement
                    );


                    /*
                        =====================
                        UPDATE TOTALS
                        =====================
                    */

                    updateTeamCounters();

                    updateMyTeamTotal();

                    removeEmptyMessages();


                    /*
                        Clear drag state.
                    */

                    sourceElement.classList.remove(
                        "is-dragging"
                    );


                    playerElement.classList.remove(
                        "is-drag-over"
                    );

                }
            );

        }
    );


    /* =========================
       ROLE BUTTONS
    ========================= */

    players.forEach(
        playerElement => {

            const playerId =
                playerElement.dataset
                    .playerId;


            const roleButtons =
                playerElement.querySelectorAll(
                    ".my-team-role-button"
                );


            roleButtons.forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () => {

                            const role =
                                button.dataset
                                    .role;


                            const changed =
                                setPlayerRole(
                                    round,
                                    playerId,
                                    role
                                );


                            if (!changed) {
                                return;
                            }


                            const targetSection =
                                role === "starter"
                                    ? document.querySelector(
                                        ".my-team-section:nth-of-type(1)"
                                    )
                                    : document.querySelector(
                                        ".my-team-section:nth-of-type(2)"
                                    );


                            if (!targetSection) {
                                return;
                            }


                            const targetList =
                                targetSection.querySelector(
                                    ".my-team-player-list"
                                );


                            const currentSection =
                                playerElement.closest(
                                    ".my-team-section"
                                );


                            if (
                                currentSection !==
                                targetSection
                            ) {

                                targetList.appendChild(
                                    playerElement
                                );

                            }


                            playerElement.dataset.role =
                                role;


                            updatePlayerRoleUI(
                                playerElement
                            );


                            updateTeamCounters();

                            updateMyTeamTotal();

                            removeEmptyMessages();

                        }
                    );

                }
            );


            /* =====================
               REMOVE
            ===================== */

            const removeButton =
                playerElement.querySelector(
                    ".my-team-remove-button"
                );


            if (removeButton) {

                removeButton.addEventListener(
                    "click",
                    () => {

                        const section =
                            playerElement.closest(
                                ".my-team-section"
                            );


                        const removed =
                            removePlayer(
                                round,
                                playerId
                            );


                        if (!removed) {
                            return;
                        }


                        playerElement.remove();


                        updateTeamCounters();

                        updateMyTeamTotal();


                        restoreEmptySection(
                            section
                        );

                    }
                );

            }

        }
    );

}


/* =========================
   UPDATE ROLE UI
========================= */

function updatePlayerRoleUI(
    playerElement
) {

    if (!playerElement) {
        return;
    }


    const role =
        playerElement.dataset.role;


    /* =========================
       S / B BUTTONS
    ========================= */

    const starterButton =
        playerElement.querySelector(
            '[data-role="starter"]'
        );


    const benchButton =
        playerElement.querySelector(
            '[data-role="bench"]'
        );


    if (starterButton) {

        starterButton.classList.toggle(
            "is-active",
            role === "starter"
        );

    }


    if (benchButton) {

        benchButton.classList.toggle(
            "is-active",
            role === "bench"
        );

    }


    /* =========================
       FANTASY POINTS
    ========================= */

    const fantasyPoints =
        Number(
            playerElement.dataset
                .fantasyPoints
        ) || 0;


    const contribution =
        role === "bench"
            ? fantasyPoints / 2
            : fantasyPoints;


    const contributionElement =
        playerElement.querySelector(
            ".my-team-contribution"
        );


    if (contributionElement) {

        contributionElement.textContent =
            formatFantasyPoints(
                contribution
            );

    }


    /* =========================
       ACTUAL FPTS
    ========================= */

    let actualFpts =
        playerElement.querySelector(
            ".my-team-actual-fpts"
        );


    if (
        role === "bench"
    ) {

        /*
            Bench players display:

            ACTUAL FPTS | CONTRIBUTION
        */

        if (!actualFpts) {

            const score =
                playerElement.querySelector(
                    ".my-team-player-score"
                );


            if (score) {

                actualFpts =
                    document.createElement(
                        "span"
                    );


                actualFpts.className =
                    "my-team-actual-fpts";


                actualFpts.textContent =
                    formatFantasyPoints(
                        fantasyPoints
                    );


                if (contributionElement) {

                    score.insertBefore(
                        actualFpts,
                        contributionElement
                    );

                }
                else {

                    score.appendChild(
                        actualFpts
                    );

                }

            }

        }
        else {

            actualFpts.textContent =
                formatFantasyPoints(
                    fantasyPoints
                );

        }

    }
    else {

        /*
            Starters only need the
            contribution value.
        */

        if (actualFpts) {

            actualFpts.remove();

        }

    }

}


/* =========================
   UPDATE COUNTERS
========================= */

function updateTeamCounters() {

    const sections =
        document.querySelectorAll(
            ".my-team-section"
        );


    if (sections.length < 2) {
        return;
    }


    const starterList =
        sections[0].querySelector(
            ".my-team-player-list"
        );


    const benchList =
        sections[1].querySelector(
            ".my-team-player-list"
        );


    const starterCount =
        starterList
            ? starterList.querySelectorAll(
                ".my-team-player"
            ).length
            : 0;


    const benchCount =
        benchList
            ? benchList.querySelectorAll(
                ".my-team-player"
            ).length
            : 0;


    const starterTitle =
        sections[0].querySelector(
            ".my-team-section-title"
        );


    const benchTitle =
        sections[1].querySelector(
            ".my-team-section-title"
        );


    if (starterTitle) {

        starterTitle.innerHTML = `

            STARTERS

            <span>
                ${starterCount} / 5
            </span>

        `;

    }


    if (benchTitle) {

        benchTitle.innerHTML = `

            BENCH

            <span>
                ${benchCount} / 7
            </span>

        `;

    }

}


/* =========================
   UPDATE TOTAL
========================= */

function updateMyTeamTotal() {

    const container =
        document.querySelector(
            ".my-team-container"
        );


    if (!container) {
        return;
    }


    const players =
        container.querySelectorAll(
            ".my-team-player"
        );


    let total = 0;


    players.forEach(
        player => {

            const fantasyPoints =
                Number(
                    player.dataset
                        .fantasyPoints
                ) || 0;


            const role =
                player.dataset.role;


            if (
                role === "bench"
            ) {

                total +=
                    fantasyPoints / 2;

            }
            else {

                total +=
                    fantasyPoints;

            }

        }
    );


    const totalElement =
        container.querySelector(
            ".js-my-team-total"
        );


    if (totalElement) {

        totalElement.textContent =
            formatFantasyPoints(
                total
            );

    }

}


/* =========================
   REFRESH MY TEAM STATS
========================= */

async function refreshMyTeamStats() {

    if (myTeamRefreshing) {
        return;
    }


    const container =
        document.querySelector(
            ".my-team-container"
        );


    if (!container) {
        return;
    }


    if (
        !isElementVisible(
            container
        )
    ) {

        return;

    }


    const round =
        getCurrentRound();


    const myTeam =
        getMyTeam(round);


    if (
        !myTeam.players ||
        !myTeam.players.length
    ) {

        return;

    }


    myTeamRefreshing = true;


    try {

        const gameCodes = [
            ...new Set(
                myTeam.players
                    .map(
                        player =>
                            player.gameCode
                    )
                    .filter(Boolean)
            )
        ];


        const allPlayers = [];


        /* =========================
           FETCH LATEST STATS
        ========================= */

        for (
            const gameCode of gameCodes
        ) {

            const result =
                await fetchAndUpdate(
                    gameCode
                );


            if (
                !result ||
                !result.players
            ) {

                continue;

            }


            result.players.forEach(
                player => {

                    const exists =
                        allPlayers.some(
                            existing =>
                                String(
                                    existing.id
                                ) ===
                                String(
                                    player.id
                                )
                        );


                    if (!exists) {

                        allPlayers.push(
                            player
                        );

                    }

                }
            );

        }


        /* =========================
           UPDATE EXISTING CARDS
        ========================= */

        myTeam.players.forEach(
            savedPlayer => {

                const currentPlayer =
                    allPlayers.find(
                        player =>
                            String(
                                player.id
                            ) ===
                            String(
                                savedPlayer.id
                            )
                    );


                if (!currentPlayer) {
                    return;
                }


                const playerElement =
                    container.querySelector(
                        `.my-team-player[data-player-id="${savedPlayer.id}"]`
                    );


                if (!playerElement) {
                    return;
                }


                const fantasyPoints =
                    Number(
                        currentPlayer
                            .Fantasy_Points
                    ) || 0;


                /*
                    Update the stored FPTS
                    on the DOM element.
                */

                playerElement.dataset
                    .fantasyPoints =
                    fantasyPoints;


                /* =====================
                   ACTUAL FPTS
                ===================== */

                const actualFpts =
                    playerElement.querySelector(
                        ".my-team-actual-fpts"
                    );


                if (actualFpts) {

                    actualFpts.textContent =
                        formatFantasyPoints(
                            fantasyPoints
                        );

                }


                /* =====================
                   CONTRIBUTION
                ===================== */

                const contributionElement =
                    playerElement.querySelector(
                        ".my-team-contribution"
                    );


                if (contributionElement) {

                    const role =
                        playerElement.dataset
                            .role;


                    const contribution =
                        role === "bench"
                            ? fantasyPoints / 2
                            : fantasyPoints;


                    contributionElement.textContent =
                        formatFantasyPoints(
                            contribution
                        );

                }

            }
        );


        /*
            Update only the total.
        */

        updateMyTeamTotal();

    }
    catch (error) {

        console.error(
            "Error refreshing My Team:",
            error
        );

    }
    finally {

        myTeamRefreshing = false;

    }

}


/* =========================
   MY TEAM TAB
========================= */

function setupMyTeamRefresh() {

    document.addEventListener(
        "click",
        event => {

            const tab =
                event.target.closest(
                    ".js-view-tab"
                );


            if (!tab) {
                return;
            }


            /* =====================
               MY TEAM
            ===================== */

            if (
                tab.dataset.view ===
                "my-team"
            ) {

                renderMyTeam();


                if (!myTeamUpdateLoop) {

                    myTeamUpdateLoop =
                        setInterval(
                            () => {

                                refreshMyTeamStats();

                            },
                            10000
                        );

                }

            }


            /* =====================
               SELECTED GAME
            ===================== */

            else if (
                tab.dataset.view ===
                "game"
            ) {

                if (myTeamUpdateLoop) {

                    clearInterval(
                        myTeamUpdateLoop
                    );

                    myTeamUpdateLoop =
                        null;

                }

            }

        }
    );

}


/* =========================
   EMPTY MESSAGES
========================= */

function removeEmptyMessages() {

    document
        .querySelectorAll(
            ".my-team-player-list .my-team-no-players"
        )
        .forEach(
            element => {

                element.remove();

            }
        );

}


function restoreEmptySection(
    section
) {

    if (!section) {
        return;
    }


    const list =
        section.querySelector(
            ".my-team-player-list"
        );


    if (!list) {
        return;
    }


    const players =
        list.querySelectorAll(
            ".my-team-player"
        );


    if (
        players.length === 0
    ) {

        list.innerHTML = `

            <div class="my-team-no-players">
                No players
            </div>

        `;

    }

}


/* =========================
   VISIBILITY
========================= */

function isElementVisible(
    element
) {

    if (!element) {
        return false;
    }


    const style =
        window.getComputedStyle(
            element
        );


    return (
        style.display !== "none" &&
        style.visibility !== "hidden"
    );

}


/* =========================
   FORMAT PLAYER NAME
========================= */

function formatPlayerName(
    name
) {

    const parts =
        name.split(",");


    if (
        parts.length < 2
    ) {

        return name;

    }


    return `
        ${parts[1]?.trim()?.[0] || ""}
        ${parts[0].trim()}
    `;

}


/* =========================
   FORMAT FPTS
========================= */

function formatFantasyPoints(
    points
) {

    const value =
        Number(points) || 0;


    if (
        Number.isInteger(value)
    ) {

        return value.toString();

    }


    return value.toFixed(1);

}


/* =========================
   RESTORE SAVED GAME
========================= */

const savedGame =
    localStorage.getItem(
        "gameCode"
    );


if (savedGame) {

    loadGame(
        savedGame
    );

}