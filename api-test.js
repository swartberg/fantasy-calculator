function fetchAndUpdate() {
    fetch("https://live.euroleague.net/api/PlaybyPlay?gamecode=83&seasoncode=E2025")
        .then(response => response.json())
        .then(data => {
            const players = {};
            const allPlays = [
                ...(data.FirstQuarter || []),
                ...(data.SecondQuarter || []),
                ...(data.ThirdQuarter || []),
                ...(data.ForthQuarter || []),
                ...(data.ExtraTime || []),
            ];
            
            allPlays.forEach(play => {
                const id = play.PLAYER_ID;
                const name = play.PLAYER;
                const team = play.CODETEAM?.trim();

                if (!id || !name) return;

                if(!players[id]) {
                    players[id] = {
                        id: id,
                        name: name,
                        team: team,
                        stats: {
                            points: 0,
                            made_2pt: 0,
                            made_3pt: 0,
                            made_fts: 0,
                            def_rebounds: 0,
                            off_rebounds: 0,
                            total_rebounds: 0,
                            assists: 0,
                            steals: 0,
                            blocks: 0,
                            draw_fouls: 0,
                            missed_2pt: 0,
                            missed_3pt: 0,
                            missed_fts: 0,
                            get_blocks: 0,
                            turnovers: 0,
                            fouls: 0
                        },
                        fantasy: 0
                    }
                }
            });
            console.log(players);

            allPlays.forEach(play => {
                const player = players[play.PLAYER_ID];
                if (!player) return;

                const action = play.PLAYTYPE;
                if (!action) return;

                // Stats and fantasy points calculation
                if (action === "2FGM") {
                    player.stats.made_2pt += 1;
                    player.stats.points += 2;
                    player.fantasy += 2;
                }
                else if (action === "2FGA") {
                    player.stats.missed_2pt += 1;
                    player.fantasy -= 1;
                }
                else if (action === "3FGM") {
                    player.stats.made_3pt += 1;
                    player.stats.points += 3;
                    player.fantasy += 3;
                }
                else if (action === "3FGA") {
                    player.stats.missed_3pt += 1;
                    player.fantasy -= 1;
                }
                else if (action === "FTM") {
                    player.stats.made_fts += 1;
                    player.stats.points += 1;
                    player.fantasy += 1;
                }
                else if (action === "FTA") {
                    player.stats.missed_fts += 1;
                    player.fantasy -= 1;
                }
                // def reb
                else if (action === "D") {
                    player.stats.def_rebounds += 1;
                    player.fantasy += 1;
                    player.stats.total_rebounds += 1;
                }
                // off reb
                else if (action === "O") {
                    player.stats.off_rebounds += 1;
                    player.fantasy += 1.5;
                    player.stats.total_rebounds += 1;
                }
                // assist
                else if (action === "AS") {
                    player.stats.assists += 1;
                    player.fantasy += 1.5;
                }
                // steal
                else if (action === "ST") {
                    player.stats.steals += 1;
                    player.fantasy += 1.5;
                }
                // block
                else if (action === "FV") {
                    player.stats.blocks += 1;
                    player.fantasy += 1;
                }
                // drawn fouls
                else if (action === "RV") {
                    player.stats.draw_fouls += 1;
                    player.fantasy += 1;
                }
                else if (action === "TO") {
                    player.stats.turnovers += 1;
                    player.fantasy -= 1.5;
                }
                // blocks received
                else if (action === "AG") {
                    player.stats.get_blocks += 1;
                    player.fantasy -= 0.5;
                }
                // fouls
                else if (action === "CM") {
                    player.stats.fouls += 1;
                    if (player.stats.fouls >= 5){
                        player.fantasy -= 5;
                    }
                }
            })

            console.clear();
            console.table(Object.values(players).map(p => ({
                Name: p.name,
                Team: p.team,
                Points: p.stats.points,
                Rebounds: p.stats.total_rebounds,
                Assists: p.stats.assists,
                Fantasy_Points: p.fantasy
            })));

            if (data.Live === false) {
                clearInterval(updateLoop);
                const teamTotal = {};

                for (const id in players) {
                    const player = players[id];
                    const team = player.team;

                    if (!teamTotal[team]) {
                        teamTotal[team] = { points: 0}
                    }
                    
                    teamTotal[team].points += player.stats.points;
                }
                console.table(teamTotal);

                const teamCodes = Object.keys(teamTotal);
                const [team1, team2] = teamCodes;
                
                if (teamCodes.length === 2) {
                    let winnerTeam;

                    if (teamTotal[team1].points > teamTotal[team2].points) {
                        winnerTeam = team1;
                    }
                    else {
                        winnerTeam = team2;
                    }

                    for (const id in players) {
                        if (players[id].team === winnerTeam) {
                            players[id].fantasy += 1.5;
                        }
                    }
                    console.clear();
                    console.log("GAME FINISHED")
                    console.table(Object.values(players).map(p => ({
                        Name: p.name,
                        Team: p.team,
                        Points: p.stats.points,
                        Rebounds: p.stats.total_rebounds,
                        Assists: p.stats.assists,
                        Fantasy_Points: p.fantasy
                    })));
                }
            }
        })
        .catch(error => {
            console.error("Error fetching API:", error);
        });
}

fetchAndUpdate();

const updateLoop = setInterval(fetchAndUpdate, 15000);