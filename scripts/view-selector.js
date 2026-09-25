document.addEventListener("DOMContentLoaded", () => {

    const tabs = document.querySelectorAll(".js-view-tab");

    const gameView = document.querySelector(".js-view-game");
    const myTeamView = document.querySelector(".js-view-my-team");

    const gameSelector = document.querySelector(".game-selector");

    if (
        !tabs.length ||
        !gameView ||
        !myTeamView ||
        !gameSelector
    ) {
        return;
    }


    tabs.forEach(tab => {

        tab.addEventListener("click", () => {

            const view = tab.dataset.view;


            // Update active tab
            tabs.forEach(otherTab => {
                otherTab.classList.remove("is-active");
            });

            tab.classList.add("is-active");


            // =========================
            // SELECTED GAME
            // =========================

            if (view === "game") {

                gameView.style.display = "block";

                myTeamView.style.display = "none";

                gameSelector.style.display = "flex";

            }


            // =========================
            // MY TEAM
            // =========================

            else if (view === "my-team") {

                gameView.style.display = "none";

                myTeamView.style.display = "block";

                gameSelector.style.display = "none";

            }

        });

    });

});