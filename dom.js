import { fetchAndUpdate } from "./api-stats.js";

const selectGameBtn = document.querySelector(".js-select-game");
let updateLoop = null;

selectGameBtn.addEventListener("click", () => {
    const gameCode = prompt("Enter game number:");

    if (!gameCode) return;

    console.log("Selected game:", gameCode);

    localStorage.setItem("gameCode", gameCode);

    loadGame(gameCode);
});

async function loadGame(gameCode) {
    if (updateLoop) {
        clearInterval(updateLoop);
        updateLoop = null;
    }

    await getStats(gameCode);
}

const TEAM_NAMES = {
    MCO: "AS Monaco",
    RED: "Crvena Zvezda Belgrade",
    ZAL: "Žalgiris Kaunas",
    PAN: "Panathinaikos Athens",
    MAD: "Real Madrid",
    PRS: "Paris Basketball",
    PAM: "Valencia Basket",
    TEL: "Maccabi Tel Aviv",
    BAS: "Baskonia Vitoria-Gasteiz",
    ULK: "Fenerbahce Istanbul",
    HTA: "Hapoel Tel Aviv",
    OLY: "Olympiacos Piraeus",
    IST: "Anadolu Efes Istanbul",
    MUN: "Bayern Munich",
    DUB: "Dubai Basketball",
    MIL: "Emporio Armani Milan",
    BAR: "FC Barcelona",
    VIR: "Virtus Bologna",
    ASV: "ASVEL Villeurbanne",
    PAR: "Partizan Belgrade",
}

async function getStats(gameCode) {
    const result = await fetchAndUpdate(gameCode);
    if(!result || result.players.length === 0) return;

    const players = result.players;
    const isLive = result.Live;

    const teams = [...new Set(players.map(p => p.Team))];
    const homeTeamCode = teams[0];
    const awayTeamCode = teams[1];

    document.querySelector(".js-home-team-name").textContent = TEAM_NAMES[homeTeamCode] || homeTeamCode;
    document.querySelector(".js-away-team-name").textContent = TEAM_NAMES[awayTeamCode] || awayTeamCode;

    const homeContainer = document.querySelector(".home-team");
    const awayContainer = document.querySelector(".away-team");

    homeContainer.innerHTML = "";
    awayContainer.innerHTML = "";

    players.forEach(player => {
        const playerName = (player.Name).split(",");
        console.log(playerName)
        const playerTab = document.createElement("div");
        playerTab.className = "player-tab";

        playerTab.innerHTML = `
            <div class="player-info">
                <div class="player-name">
                    <span class="js-player-name">${playerName[1][1]}. ${playerName[0]}</span>
                </div>
            </div>
            <div class="player-stats">
                <div class="player-pts stat-pair">
                    <span class="stat-label">PTS</span>
                    <span class="js-stat">${player.Points}</span>
                </div>
                <div class="player-reb stat-pair">
                    <span class="stat-label">REB</span>
                    <span class="js-stat">${player.Rebounds}</span>
                </div>
                <div class="player-ast stat-pair">
                    <span class="stat-label">AST</span>
                    <span class="js-stat">${player.Assists}</span>
                </div>
                <div class="player-to stat-pair">
                    <span class="stat-label">TO</span>
                    <span class="js-stat">${player.Turnovers}</span>
                </div>
            </div>
            <div class="player-fpts stat-pair">
                <span class="stat-label">FPTS</span>
                <span class="js-stat js-fpts">${player.Fantasy_Points}</span>
            </div>
        `;
            
        if (player.Team === homeTeamCode) {
            homeContainer.appendChild(playerTab);
        }
        else if (player.Team === awayTeamCode) {
            awayContainer.appendChild(playerTab);
        }
    });

    if (isLive && !updateLoop) {
        updateLoop = setInterval(() => {
            getStats(gameCode);
        }, 20000);
    }

    if (!isLive && updateLoop) {
        clearInterval(updateLoop);
        updateLoop = null;
    }
}

const savedGame = localStorage.getItem("gameCode");
if(savedGame) {
    loadGame(savedGame);
}
