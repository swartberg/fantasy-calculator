import { fetchAndUpdate } from "./api-stats.js?v=4";

import { TEAM_NAMES } from "./teams.js?v=4";

import { gameSelect } from "./game-selector.js?v=4";

import { setupPlayerSearch } from "./player-search.js?v=4";



import {

    addPlayer,

    removePlayer,

    isPlayerSelected,

    getMyTeam,

    setPlayerRole,

    swapPlayerRoles,

    finalizeRound,

    isRoundFinalized,

    getTeamCounts,

    setCaptain,

    getPointsMultiplier,

    setPlayerGameCode,

    MAX_STARTERS,

    MAX_SIXTH,

    MAX_BENCH

} from "./my-team.js?v=4";





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



    setupPlayerSearch({

        getRound: getCurrentRound,

        onAdd: () => {

            renderMyTeam();

            syncGameTableSelection();

        }

    });





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

            // Highlight rows already in My Team
            playerTab.classList.toggle(
                "is-in-my-team",
                selected
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





                    playerTab.classList.toggle(
                        "is-in-my-team",
                        isPlayerSelected(
                            currentRound,
                            player.id
                        )
                    );


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





    const allPlayers =

        await fetchMyTeamPlayers(

            round,

            myTeam.players

        );





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





                    /*
                        Keep players whose stats
                        couldn't be loaded (0 FPTS),
                        so the UI always matches
                        what's saved.
                    */

                    return {



                        ...savedPlayer,



                        team:

                            currentPlayer?.Team ||

                            savedPlayer.team,



                        fantasyPoints:

                            Number(

                                currentPlayer

                                    ?.Fantasy_Points

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

   FETCH MY TEAM STATS

========================= */

/*
    Latest stats for the saved players' games.

    Players added from search have no game yet,
    so while any are unresolved, fetch the whole
    round and remember the game each one is in.
*/

async function fetchMyTeamPlayers(round, savedPlayers) {

    const unresolved =
        savedPlayers.filter(player => !player.gameCode);

    const gameCodes = new Set(
        savedPlayers
            .map(player => player.gameCode)
            .filter(Boolean)
    );

    if (unresolved.length) {
        getRoundGameCodes(round)
            .forEach(gameCode => gameCodes.add(gameCode));
    }

    const results = await Promise.all(
        [...gameCodes].map(async gameCode => ({
            gameCode,
            result: await fetchAndUpdate(gameCode)
        }))
    );

    const allPlayers = [];

    results.forEach(({ gameCode, result }) => {
        if (!result || !result.players) return;

        result.players.forEach(player => {
            if (
                allPlayers.some(existing => String(existing.id) === String(player.id))
            ) return;

            allPlayers.push(player);

            if (
                unresolved.some(saved => String(saved.id) === String(player.id))
            ) {
                setPlayerGameCode(round, player.id, gameCode, player.Team);
            }
        });
    });

    return allPlayers;
}


function getRoundGameCodes(round) {

    const firstGame = (round - 1) * 10 + 1;

    return Array.from(
        { length: 10 },
        (_, index) => firstGame + index
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



    const starters = teamPlayers.filter(player => player.role === "starter");

    const sixthMan = teamPlayers.filter(player => player.role === "sixth");

    const bench = teamPlayers.filter(player => player.role === "bench");



    const starterPoints = starters.reduce((total, player) => total + player.fantasyPoints * getPointsMultiplier("starter", player.captain), 0);

    const sixthPoints = sixthMan.reduce((total, player) => total + player.fantasyPoints, 0);

    const benchPoints = bench.reduce((total, player) => total + player.fantasyPoints / 2, 0);

    const totalPoints = starterPoints + sixthPoints + benchPoints;



    container.innerHTML = `

        <div class="my-team-header">

            <span>MY TEAM</span>

            <strong>ROUND ${round}</strong>

        </div>



        ${locked ? `<div class="my-team-locked-banner">TEAM LOCKED</div>` : ""}



        <div class="my-team-section">

            <div class="my-team-section-title">

                STARTERS

                <span>${starters.length} / 5</span>

            </div>

            <div class="my-team-player-list">

                ${starters.map(player => createMyTeamPlayer(player, "starter", locked)).join("")}
                    ${createEmptySlots("starter", MAX_STARTERS - starters.length)}

            </div>

        </div>



        <div class="my-team-section my-team-bench-section">

            <div class="my-team-section-title">

                BENCH

                <span>${sixthMan.length + bench.length} / 5</span>

            </div>



            <div class="my-team-sixth-slot">

                <div

                    class="my-team-subsection-title"

                    style="font-size: 10px; padding-bottom: 5px; color: #fff; font-weight: 300;"

                >

                    6th MAN

                </div>

                <div class="my-team-player-list my-team-sixth-list" style="margin-bottom: 10px;">

                    ${sixthMan.map(player => createMyTeamPlayer(player, "sixth", locked)).join("")}
                        ${createEmptySlots("sixth", MAX_SIXTH - sixthMan.length)}

                </div>

            </div>



            <div class="my-team-regular-bench">

                <div

                    class="my-team-subsection-title"

                    style="font-size: 12px; padding-bottom: 5px; color: #fff; font-weight: 300;"

                >

                    Bench

                </div>

                <div class="my-team-player-list my-team-bench-list">

                    ${bench.map(player => createMyTeamPlayer(player, "bench", locked)).join("")}
                        ${createEmptySlots("bench", MAX_BENCH - bench.length)}

                </div>

            </div>

        </div>



        <div class="my-team-total">

            <span>TOTAL</span>

            <strong class="js-my-team-total">${formatFantasyPoints(totalPoints)}</strong>

        </div>



        ${locked

            ? `<div class="my-team-save-status">Your team is locked for this round.</div>`

            : `<button class="save-team-button" type="button">SAVE TEAM</button>`

        }

    `;



    setupMyTeamPlayerEvents(round, locked);



    const saveButton = container.querySelector(".save-team-button");

    if (saveButton) {

        saveButton.addEventListener("click", () => {

            if (starters.length !== 5) {

                window.alert(`You need exactly 5 starters before saving your team. You currently have ${starters.length}.`);

                return;

            }

            if (sixthMan.length !== 1) {

                window.alert(`You need exactly 1 sixth man before saving your team. You currently have ${sixthMan.length}.`);

                return;

            }

            if (bench.length !== 4) {

                window.alert(`You need exactly 4 regular bench players before saving your team. You currently have ${bench.length}.`);

                return;

            }

            if (!window.confirm("Save your team for this round? You will not be able to change it afterwards.")) return;

            if (!finalizeRound(round)) {

                window.alert("Your team could not be saved.");

                return;

            }

            renderMyTeam();

        });

    }

}



/* =========================

   CREATE PLAYER CARD

========================= */



function createMyTeamPlayer(

    player,

    role,

    locked

) {



    const captain =

        role === "starter" &&

        player.captain === true;



    const contribution =

        player.fantasyPoints *

        getPointsMultiplier(role, captain);



    return `

        <div

            class="my-team-player ${locked ? "is-locked" : ""}"

            data-player-id="${player.id}"

            data-fantasy-points="${player.fantasyPoints}"

            data-role="${role}"

            data-captain="${captain}"

            draggable="${!locked}"

        >

            <div class="my-team-player-info">

                ${!locked ? `<span class="my-team-drag-handle" title="Drag to swap">⋮⋮</span>` : ""}

                <span class="my-team-player-name">${formatPlayerName(player.name)}</span>

                <span class="my-team-player-team">${player.team}</span>

                ${captain ? `<span class="my-team-captain-badge">C</span>` : ""}

            </div>

            <div class="my-team-player-score">

                ${role !== "starter" || captain ? `<span class="my-team-actual-fpts">${formatFantasyPoints(player.fantasyPoints)}</span>` : ""}

                <span class="my-team-contribution">${formatFantasyPoints(contribution)}</span>

            </div>

            ${!locked ? `

                <div class="my-team-player-actions">

                    <button class="my-team-role-button my-team-captain-button ${captain ? "is-active" : ""}" type="button" title="Captain (2x points)">C</button>

                    <button class="my-team-role-button ${role === "starter" ? "is-active" : ""}" data-role="starter" type="button">S</button>

                    <button class="my-team-role-button ${role === "sixth" ? "is-active" : ""}" data-role="sixth" type="button">6</button>

                    <button class="my-team-role-button ${role === "bench" ? "is-active" : ""}" data-role="bench" type="button">B</button>

                    <button class="my-team-remove-button" type="button">×</button>

                </div>

            ` : ""}

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
        document.querySelectorAll(".my-team-player");

    const playerLists =
        document.querySelectorAll(".my-team-player-list");

    let draggedPlayerId = null;


    function getRoleList(role) {

        if (role === "starter") {
            return document.querySelector(
                ".my-team-section:not(.my-team-bench-section) .my-team-player-list"
            );
        }

        if (role === "sixth") {
            return document.querySelector(".my-team-sixth-list");
        }

        if (role === "bench") {
            return document.querySelector(".my-team-bench-list");
        }

        return null;
    }


    function getListRole(list) {

        if (!list) {
            return null;
        }

        if (list.classList.contains("my-team-sixth-list")) {
            return "sixth";
        }

        if (list.classList.contains("my-team-bench-list")) {
            return "bench";
        }

        if (list.closest(".my-team-bench-section")) {
            return null;
        }

        return "starter";
    }


    function getRoleMax(role) {

        if (role === "starter") return MAX_STARTERS;

        if (role === "sixth") return MAX_SIXTH;

        if (role === "bench") return MAX_BENCH;

        return 0;
    }


    function getRoleCount(role) {

        const counts = getTeamCounts(round);

        if (role === "starter") return counts.starters;

        if (role === "sixth") return counts.sixth;

        if (role === "bench") return counts.bench;

        return 0;
    }


    /*
        Whether `role` can accept one more player right now.

        Used to decide between moving a dragged player into a
        role (room available) and swapping it with an existing
        occupant (role is already at its limit, so swapping is
        the only way to place it there without exceeding the
        roster size).
    */

    function hasRoomForRole(role) {

        return getRoleCount(role) < getRoleMax(role);
    }


    function clearDragState() {

        draggedPlayerId = null;

        document.querySelectorAll(".my-team-player").forEach(
            element => {
                element.classList.remove("is-dragging");
                element.classList.remove("is-drag-over");
            }
        );

        document.querySelectorAll(".my-team-player-list").forEach(
            list => {
                list.classList.remove("is-drag-over");
            }
        );
    }


    function updateAfterRoleChange(
        playerElement,
        role
    ) {

        playerElement.dataset.role = role;

        const targetList = getRoleList(role);

        if (
            targetList &&
            !targetList.contains(playerElement)
        ) {
            targetList.appendChild(playerElement);
        }

        updatePlayerRoleUI(playerElement);
        updateTeamCounters();
        updateMyTeamTotal();
        syncEmptySlots();
    }


    /* =========================
       DROP ACTIONS
    ========================= */

    function getPlayerElement(playerId) {

        return document.querySelector(
            `.my-team-player[data-player-id="${playerId}"]`
        );
    }


    /*
        Dropping a player onto another player's card.
    */

    function dropOnPlayer(
        sourcePlayerId,
        playerElement
    ) {

        const targetPlayerId =
            playerElement.dataset.playerId;

        if (
            !sourcePlayerId ||
            !targetPlayerId
        ) {
            return;
        }

        if (
            String(sourcePlayerId) ===
            String(targetPlayerId)
        ) {
            return;
        }

        const sourceElement =
            getPlayerElement(sourcePlayerId);

        if (!sourceElement) {
            return;
        }

        const sourceRole =
            sourceElement.dataset.role;

        const targetRole =
            playerElement.dataset.role;

        if (
            sourceRole ===
            targetRole
        ) {
            return;
        }

        /*
            If the target role still has room, just
            move the dragged player into it and leave
            the card it was dropped on alone. Only
            swap roles once the target role is already
            full — that's the only way to place the
            dragged player there without exceeding the
            roster limit.
        */

        if (hasRoomForRole(targetRole)) {

            const moved =
                setPlayerRole(
                    round,
                    sourcePlayerId,
                    targetRole
                );

            if (!moved) {
                return;
            }

            updateAfterRoleChange(
                sourceElement,
                targetRole
            );

        } else {

            const swapped =
                swapPlayerRoles(
                    round,
                    sourcePlayerId,
                    targetPlayerId
                );

            if (!swapped) {
                return;
            }

            /*
                The source player takes the
                target player's role, and vice
                versa.
            */

            updateAfterRoleChange(
                sourceElement,
                targetRole
            );

            updateAfterRoleChange(
                playerElement,
                sourceRole
            );
        }

        sourceElement.classList.remove(
            "is-dragging"
        );
    }


    /*
        Dropping on empty space within a list works
        as long as that role still has room. Once it's
        full, the user needs to drop directly onto a
        player card to trigger a swap.
    */

    function canDropOnList(
        sourcePlayerId,
        list
    ) {

        const targetRole =
            getListRole(list);

        if (!targetRole) {
            return false;
        }

        const sourceElement =
            sourcePlayerId
                ? getPlayerElement(sourcePlayerId)
                : null;

        if (!sourceElement) {
            return false;
        }

        if (
            sourceElement.dataset.role ===
            targetRole
        ) {
            return false;
        }

        return hasRoomForRole(targetRole);
    }


    function dropOnList(
        sourcePlayerId,
        list
    ) {

        if (
            !canDropOnList(
                sourcePlayerId,
                list
            )
        ) {
            return;
        }

        const targetRole =
            getListRole(list);

        const sourceElement =
            getPlayerElement(sourcePlayerId);

        const changed =
            setPlayerRole(
                round,
                sourcePlayerId,
                targetRole
            );

        if (!changed) {
            return;
        }

        updateAfterRoleChange(
            sourceElement,
            targetRole
        );

        sourceElement.classList.remove(
            "is-dragging"
        );
    }


    /* =========================
       PLAYER DRAG EVENTS
    ========================= */

    players.forEach(
        playerElement => {

            playerElement.addEventListener(
                "dragstart",
                event => {

                    draggedPlayerId =
                        playerElement.dataset.playerId;

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


            playerElement.addEventListener(
                "dragend",
                clearDragState
            );


            playerElement.addEventListener(
                "dragover",
                event => {

                    event.preventDefault();
                    event.stopPropagation();

                    const targetPlayerId =
                        playerElement.dataset.playerId;

                    if (
                        String(targetPlayerId) ===
                        String(draggedPlayerId)
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


            playerElement.addEventListener(
                "drop",
                event => {

                    event.preventDefault();
                    event.stopPropagation();

                    playerElement.classList.remove(
                        "is-drag-over"
                    );

                    dropOnPlayer(
                        event.dataTransfer.getData(
                            "text/plain"
                        ),
                        playerElement
                    );
                }
            );
        }
    );


    /* =========================
       EMPTY LIST DROP ZONES
    ========================= */

    playerLists.forEach(
        list => {

            list.addEventListener(
                "dragover",
                event => {

                    event.preventDefault();

                    if (
                        !canDropOnList(
                            draggedPlayerId,
                            list
                        )
                    ) {
                        return;
                    }

                    list.classList.add(
                        "is-drag-over"
                    );

                    event.dataTransfer.dropEffect =
                        "move";
                }
            );


            list.addEventListener(
                "dragleave",
                event => {

                    if (
                        !list.contains(
                            event.relatedTarget
                        )
                    ) {
                        list.classList.remove(
                            "is-drag-over"
                        );
                    }
                }
            );


            list.addEventListener(
                "drop",
                event => {

                    event.preventDefault();

                    list.classList.remove(
                        "is-drag-over"
                    );

                    /*
                        If the drop happened directly
                        on a player card, that card's
                        drop handler performs the swap.
                    */

                    if (
                        event.target.closest(
                            ".my-team-player"
                        )
                    ) {
                        return;
                    }

                    dropOnList(
                        event.dataTransfer.getData(
                            "text/plain"
                        ),
                        list
                    );
                }
            );
        }
    );


    /* =========================
       TOUCH DRAG (MOBILE)
    ========================= */

    /*
        Mobile browsers don't fire HTML5 drag events
        from touch, so touch gets its own path.

        A drag starts after a short long-press, so a
        normal swipe still scrolls the page. While
        dragging, the card follows the finger and the
        element under the finger is the drop target.
    */

    const TOUCH_HOLD_MS = 250;
    const TOUCH_MOVE_TOLERANCE = 10;

    players.forEach(
        playerElement => {

            let holdTimer = null;
            let touchDragging = false;
            let startX = 0;
            let startY = 0;
            let dropTarget = null;


            function getDropTargetAt(x, y) {

                const element =
                    document.elementFromPoint(x, y);

                if (!element) {
                    return null;
                }

                const targetPlayer =
                    element.closest(".my-team-player");

                if (
                    targetPlayer &&
                    targetPlayer !== playerElement
                ) {
                    return targetPlayer;
                }

                const targetList =
                    element.closest(".my-team-player-list");

                if (
                    targetList &&
                    canDropOnList(
                        draggedPlayerId,
                        targetList
                    )
                ) {
                    return targetList;
                }

                return null;
            }


            function setDropTarget(target) {

                if (dropTarget === target) {
                    return;
                }

                if (dropTarget) {
                    dropTarget.classList.remove(
                        "is-drag-over"
                    );
                }

                dropTarget = target;

                if (dropTarget) {
                    dropTarget.classList.add(
                        "is-drag-over"
                    );
                }
            }


            function endTouchDrag() {

                clearTimeout(holdTimer);
                holdTimer = null;

                if (!touchDragging) {
                    return;
                }

                touchDragging = false;

                playerElement.style.transform = "";
                playerElement.classList.remove(
                    "is-touch-dragging"
                );

                const target = dropTarget;
                const sourcePlayerId = draggedPlayerId;

                setDropTarget(null);

                if (target) {

                    if (
                        target.classList.contains(
                            "my-team-player"
                        )
                    ) {
                        dropOnPlayer(
                            sourcePlayerId,
                            target
                        );
                    } else {
                        dropOnList(
                            sourcePlayerId,
                            target
                        );
                    }
                }

                clearDragState();
            }


            playerElement.addEventListener(
                "touchstart",
                event => {

                    if (
                        event.touches.length !== 1 ||
                        event.target.closest("button")
                    ) {
                        return;
                    }

                    const touch = event.touches[0];

                    startX = touch.clientX;
                    startY = touch.clientY;

                    holdTimer = setTimeout(
                        () => {

                            holdTimer = null;
                            touchDragging = true;

                            draggedPlayerId =
                                playerElement.dataset.playerId;

                            playerElement.classList.add(
                                "is-dragging",
                                "is-touch-dragging"
                            );

                            if (navigator.vibrate) {
                                navigator.vibrate(15);
                            }
                        },
                        TOUCH_HOLD_MS
                    );
                },
                { passive: true }
            );


            playerElement.addEventListener(
                "touchmove",
                event => {

                    const touch = event.touches[0];

                    const dx = touch.clientX - startX;
                    const dy = touch.clientY - startY;

                    if (!touchDragging) {

                        /*
                            Finger moved before the hold
                            finished — treat it as a scroll.
                        */

                        if (
                            Math.abs(dx) > TOUCH_MOVE_TOLERANCE ||
                            Math.abs(dy) > TOUCH_MOVE_TOLERANCE
                        ) {
                            clearTimeout(holdTimer);
                            holdTimer = null;
                        }

                        return;
                    }

                    event.preventDefault();

                    playerElement.style.transform =
                        `translate(${dx}px, ${dy}px)`;

                    setDropTarget(
                        getDropTargetAt(
                            touch.clientX,
                            touch.clientY
                        )
                    );
                },
                { passive: false }
            );


            playerElement.addEventListener(
                "touchend",
                endTouchDrag
            );


            playerElement.addEventListener(
                "touchcancel",
                () => {
                    setDropTarget(null);
                    touchDragging = false;
                    playerElement.style.transform = "";
                    playerElement.classList.remove(
                        "is-touch-dragging"
                    );
                    clearTimeout(holdTimer);
                    holdTimer = null;
                    clearDragState();
                }
            );


            /*
                Stop the long-press context menu /
                text selection from hijacking the drag.
            */

            playerElement.addEventListener(
                "contextmenu",
                event => {
                    if (touchDragging || holdTimer) {
                        event.preventDefault();
                    }
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
                playerElement.dataset.playerId;

            const roleButtons =
                playerElement.querySelectorAll(
                    ".my-team-role-button[data-role]"
                );

            roleButtons.forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () => {

                            const role =
                                button.dataset.role;

                            const changed =
                                setPlayerRole(
                                    round,
                                    playerId,
                                    role
                                );

                            if (!changed) {
                                return;
                            }

                            updateAfterRoleChange(
                                playerElement,
                                role
                            );
                        }
                    );
                }
            );


            /* =====================
               CAPTAIN
            ===================== */

            const captainButton =
                playerElement.querySelector(
                    ".my-team-captain-button"
                );

            if (captainButton) {

                captainButton.addEventListener(
                    "click",
                    () => {

                        const changed =
                            setCaptain(
                                round,
                                playerId
                            );

                        if (!changed) {
                            return;
                        }

                        /*
                            Setting a captain can clear
                            the previous one, so sync
                            every card from storage.
                        */

                        const savedPlayers =
                            getMyTeam(round).players;

                        document.querySelectorAll(
                            ".my-team-player"
                        ).forEach(
                            element => {

                                const savedPlayer =
                                    savedPlayers.find(
                                        player =>
                                            String(player.id) ===
                                            String(element.dataset.playerId)
                                    );

                                element.dataset.captain =
                                    String(
                                        savedPlayer?.captain === true
                                    );

                                updatePlayerRoleUI(element);
                            }
                        );

                        updateMyTeamTotal();
                    }
                );
            }


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

                        syncEmptySlots();

                        syncGameTableSelection();
                    }
                );
            }
        }
    );
}


/* =========================

   UPDATE ROLE UI

========================= */



function updatePlayerRoleUI(playerElement) {



    if (!playerElement) return;



    const role = playerElement.dataset.role;



    const starterButton = playerElement.querySelector('[data-role="starter"]');

    const sixthButton = playerElement.querySelector('[data-role="sixth"]');

    const benchButton = playerElement.querySelector('[data-role="bench"]');



    if (starterButton) starterButton.classList.toggle("is-active", role === "starter");

    if (sixthButton) sixthButton.classList.toggle("is-active", role === "sixth");

    if (benchButton) benchButton.classList.toggle("is-active", role === "bench");



    // Only starters can captain
    if (role !== "starter") {

        playerElement.dataset.captain = "false";

    }

    const captain = playerElement.dataset.captain === "true";



    const captainButton = playerElement.querySelector(".my-team-captain-button");

    if (captainButton) captainButton.classList.toggle("is-active", captain);



    let captainBadge = playerElement.querySelector(".my-team-captain-badge");

    if (captain && !captainBadge) {

        const info = playerElement.querySelector(".my-team-player-info");

        if (info) {

            captainBadge = document.createElement("span");

            captainBadge.className = "my-team-captain-badge";

            captainBadge.textContent = "C";

            info.appendChild(captainBadge);

        }

    } else if (!captain && captainBadge) {

        captainBadge.remove();

    }



    const fantasyPoints = Number(playerElement.dataset.fantasyPoints) || 0;

    const contribution = fantasyPoints * getPointsMultiplier(role, captain);



    const contributionElement = playerElement.querySelector(".my-team-contribution");

    if (contributionElement) {

        contributionElement.textContent = formatFantasyPoints(contribution);

    }



    let actualFpts = playerElement.querySelector(".my-team-actual-fpts");



    if (role === "starter" && !captain) {

        if (actualFpts) actualFpts.remove();

        return;

    }



    if (!actualFpts) {

        const score = playerElement.querySelector(".my-team-player-score");

        if (score) {

            actualFpts = document.createElement("span");

            actualFpts.className = "my-team-actual-fpts";

            score.insertBefore(actualFpts, contributionElement);

        }

    }



    if (actualFpts) {

        actualFpts.textContent = formatFantasyPoints(fantasyPoints);

    }

}



/* =========================

   UPDATE COUNTERS

========================= */



function updateTeamCounters() {



    const starterList = document.querySelector(

        ".my-team-section:not(.my-team-bench-section) .my-team-player-list"

    );

    const sixthList = document.querySelector(".my-team-sixth-list");

    const benchList = document.querySelector(".my-team-bench-list");



    const starterCount = starterList ? starterList.querySelectorAll(".my-team-player").length : 0;

    const sixthCount = sixthList ? sixthList.querySelectorAll(".my-team-player").length : 0;

    const benchCount = benchList ? benchList.querySelectorAll(".my-team-player").length : 0;



    const starterTitle = document.querySelector(

        ".my-team-section:not(.my-team-bench-section) .my-team-section-title"

    );

    const benchTitle = document.querySelector(

        ".my-team-bench-section .my-team-section-title"

    );



    if (starterTitle) {

        starterTitle.innerHTML = `STARTERS <span>${starterCount} / 5</span>`;

    }



    if (benchTitle) {

        benchTitle.innerHTML = `BENCH <span>${sixthCount + benchCount} / 5</span>`;

    }

}



/* =========================

   UPDATE TOTAL

========================= */



function updateMyTeamTotal() {



    const container = document.querySelector(".my-team-container");

    if (!container) return;



    const players = container.querySelectorAll(".my-team-player");

    let total = 0;



    players.forEach(player => {

        const fantasyPoints = Number(player.dataset.fantasyPoints) || 0;

        const role = player.dataset.role;

        const captain = player.dataset.captain === "true";



        total += fantasyPoints * getPointsMultiplier(role, captain);

    });



    const totalElement = container.querySelector(".js-my-team-total");

    if (totalElement) {

        totalElement.textContent = formatFantasyPoints(total);

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



        const allPlayers =

            await fetchMyTeamPlayers(

                round,

                myTeam.players

            );





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

                   TEAM

                ===================== */



                const teamElement =

                    playerElement.querySelector(

                        ".my-team-player-team"

                    );



                if (teamElement && currentPlayer.Team) {

                    teamElement.textContent =

                        currentPlayer.Team;

                }





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

                        fantasyPoints *

                        getPointsMultiplier(

                            role,

                            playerElement.dataset.captain === "true"

                        );





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

   GAME TABLE SELECTION

========================= */

/*
    Re-sync the game stat table with My Team, for
    changes made from the My Team view (the table
    isn't re-rendered when switching views).
*/

function syncGameTableSelection() {

    const round = getCurrentRound();

    document.querySelectorAll(".player-tab").forEach(playerTab => {

        const selected = isPlayerSelected(
            round,
            playerTab.dataset.playerId
        );

        playerTab.classList.toggle("is-in-my-team", selected);

        const button = playerTab.querySelector(".my-team-button");

        if (button) {
            button.classList.toggle("is-selected", selected);
            button.textContent = selected ? "✓" : "+";
        }
    });
}


/* =========================

   EMPTY SLOTS

========================= */

/*
    Placeholder rows for each open spot in a
    role, so the user can see where players can
    be dragged. They sit inside the player list,
    so dropping on one drops on that list.
*/

const EMPTY_SLOT_LABELS = {
    starter: "Starter",
    sixth: "6th man",
    bench: "Bench"
};


function createEmptySlots(role, count) {

    return Array.from(
        { length: Math.max(0, count) },
        () => `<div class="my-team-empty-slot">${EMPTY_SLOT_LABELS[role]} slot</div>`
    ).join("");
}


function syncEmptySlots() {

    const lists = [
        ["starter", ".my-team-section:not(.my-team-bench-section) .my-team-player-list", MAX_STARTERS],
        ["sixth", ".my-team-sixth-list", MAX_SIXTH],
        ["bench", ".my-team-bench-list", MAX_BENCH]
    ];

    lists.forEach(([role, selector, max]) => {

        const list = document.querySelector(selector);

        if (!list) return;

        list.querySelectorAll(".my-team-empty-slot, .my-team-no-players")
            .forEach(element => element.remove());

        const count = list.querySelectorAll(".my-team-player").length;

        list.insertAdjacentHTML(
            "beforeend",
            createEmptySlots(role, max - count)
        );
    });
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