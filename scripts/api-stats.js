export async function fetchAndUpdate(gameCode) {
    try {
        const response = await fetch(
            `https://live.euroleague.net/api/PlaybyPlay?gamecode=${gameCode}&seasoncode=E2025`
        );

        const data = await response.json();

        const players = {};

        let gameTime = data.ActualQuarter;

        const allPlays = [
            ...(data.FirstQuarter || []),
            ...(data.SecondQuarter || []),
            ...(data.ThirdQuarter || []),
            ...(data.ForthQuarter || []),
            ...(data.ExtraTime || []),
        ];


        // =========================
        // CREATE PLAYER OBJECTS
        // =========================

        allPlays.forEach(play => {
            const id = play.PLAYER_ID;
            const name = play.PLAYER;
            const team = play.CODETEAM?.trim();

            if (!id || !name) return;

            if (!players[id]) {
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
                };
            }
        });


        // =========================
        // STATS CALCULATION
        // =========================

        allPlays.forEach(play => {
            const player = players[play.PLAYER_ID];

            if (!player) return;

            const action = play.PLAYTYPE;

            if (!action) return;


            // 2 POINTS
            if (action === "2FGM") {
                player.stats.made_2pt += 1;
                player.stats.points += 2;
                player.fantasy += 2;
            }

            else if (action === "2FGA") {
                player.stats.missed_2pt += 1;
                player.fantasy -= 1;
            }


            // 3 POINTS
            else if (action === "3FGM") {
                player.stats.made_3pt += 1;
                player.stats.points += 3;
                player.fantasy += 3;
            }

            else if (action === "3FGA") {
                player.stats.missed_3pt += 1;
                player.fantasy -= 1;
            }


            // FREE THROWS
            else if (action === "FTM") {
                player.stats.made_fts += 1;
                player.stats.points += 1;
                player.fantasy += 1;
            }

            else if (action === "FTA") {
                player.stats.missed_fts += 1;
                player.fantasy -= 1;
            }


            // DEFENSIVE REBOUND
            else if (action === "D") {
                player.stats.def_rebounds += 1;
                player.fantasy += 1;
                player.stats.total_rebounds += 1;
            }


            // OFFENSIVE REBOUND
            else if (action === "O") {
                player.stats.off_rebounds += 1;
                player.fantasy += 1.5;
                player.stats.total_rebounds += 1;
            }


            // ASSIST
            else if (action === "AS") {
                player.stats.assists += 1;
                player.fantasy += 1.5;
            }


            // STEAL
            else if (action === "ST") {
                player.stats.steals += 1;
                player.fantasy += 1.5;
            }


            // BLOCK
            else if (action === "FV") {
                player.stats.blocks += 1;
                player.fantasy += 1;
            }


            // DRAWN FOUL
            else if (action === "RV") {
                player.stats.draw_fouls += 1;
                player.fantasy += 1;
            }


            // TURNOVER
            else if (action === "TO") {
                player.stats.turnovers += 1;
                player.fantasy -= 1.5;
            }


            // BLOCK RECEIVED
            else if (action === "AG") {
                player.stats.get_blocks += 1;
                player.fantasy -= 0.5;
            }


            // FOUL
            else if (action === "CM") {
                player.stats.fouls += 1;

                if (player.stats.fouls >= 5) {
                    player.fantasy -= 5;
                }
            }
        });


        // =========================
        // END GAME CALCULATIONS
        // =========================

        if (data.Live === false) {
            const teamTotal = {};


            // Team total points
            for (const id in players) {
                const player = players[id];
                const team = player.team;

                if (!teamTotal[team]) {
                    teamTotal[team] = {
                        points: 0
                    };
                }

                teamTotal[team].points +=
                    player.stats.points;
            }


            // Winning team
            const teamsPlayed =
                Object.keys(teamTotal);

            const teamOneScore =
                teamTotal[teamsPlayed[0]].points;

            const teamTwoScore =
                teamTotal[teamsPlayed[1]].points;

            let winningTeam;

            if (teamOneScore > teamTwoScore) {
                winningTeam = teamsPlayed[0];
            }
            else {
                winningTeam = teamsPlayed[1];
            }


            console.log(
                "ActualQuarter:",
                data.ActualQuarter
            );


            // End-game fantasy calculations
            for (const id in players) {
                const player = players[id];
                const team = player.team;


                // QUADRUPLE DOUBLE
                if (
                    (
                        player.stats.points >= 10 &&
                        player.stats.total_rebounds >= 10 &&
                        player.stats.assists >= 10 &&
                        player.stats.steals >= 10
                    )
                    ||
                    (
                        player.stats.points >= 10 &&
                        player.stats.total_rebounds >= 10 &&
                        player.stats.assists >= 10 &&
                        player.stats.blocks >= 10
                    )
                ) {
                    player.fantasy += 100;
                }


                // TRIPLE DOUBLE
                else if (
                    (
                        player.stats.points >= 10 &&
                        player.stats.total_rebounds >= 10 &&
                        player.stats.assists >= 10
                    )
                    ||
                    (
                        player.stats.points >= 10 &&
                        player.stats.total_rebounds >= 10 &&
                        player.stats.blocks >= 10
                    )
                    ||
                    (
                        player.stats.points >= 10 &&
                        player.stats.assists >= 10 &&
                        player.stats.steals >= 10
                    )
                    ||
                    (
                        player.stats.total_rebounds >= 10 &&
                        player.stats.assists >= 10 &&
                        player.stats.blocks >= 10
                    )
                ) {
                    player.fantasy += 30;
                }


                // DOUBLE DOUBLE
                else if (
                    (
                        player.stats.points >= 10 &&
                        player.stats.total_rebounds >= 10
                    )
                    ||
                    (
                        player.stats.points >= 10 &&
                        player.stats.assists >= 10
                    )
                    ||
                    (
                        player.stats.total_rebounds >= 10 &&
                        player.stats.assists >= 10
                    )
                ) {
                    player.fantasy += 10;
                }


                // WIN / LOSS
                if (team === winningTeam) {
                    player.fantasy += 1.5;
                }
                else {
                    player.fantasy -= 1.5;
                }
            }
        }


        // =========================
        // RETURN PLAYER DATA
        // =========================

        return {
            players: Object.values(players).map(p => ({
                id: p.id,
                Name: p.name,
                Team: p.team,

                Points: p.stats.points,
                Rebounds: p.stats.total_rebounds,
                Assists: p.stats.assists,
                Turnovers: p.stats.turnovers,

                Fantasy_Points: p.fantasy
            })),

            Live: data.Live === true,

            ActualQuarter: data.ActualQuarter,
        };
    }

    catch (error) {
        console.error(
            "Error fetching API:",
            error
        );

        return [];
    }
}


window.fetchAndUpdate = fetchAndUpdate;