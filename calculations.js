export function statsCalculation() {
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
}
