document.addEventListener("DOMContentLoaded", () => {

    const tabs = document.querySelectorAll(".js-view-tab");

    const views = {
        "game": document.querySelector(".js-view-game"),
        "my-team": document.querySelector(".js-view-my-team"),
        "top-players": document.querySelector(".js-view-top-players")
    };

    const gameSelector = document.querySelector(".game-selector");

    if (
        !tabs.length ||
        Object.values(views).some(view => !view) ||
        !gameSelector
    ) {
        return;
    }


    tabs.forEach(tab => {

        tab.addEventListener("click", () => {

            const activeView = tab.dataset.view;


            // Update active tab
            tabs.forEach(otherTab => {
                otherTab.classList.remove("is-active");
            });

            tab.classList.add("is-active");


            // Show only the selected view
            Object.entries(views).forEach(([name, view]) => {
                view.style.display =
                    name === activeView ? "block" : "none";
            });


            // Game list is only used by the Games view
            gameSelector.style.display =
                activeView === "game" ? "flex" : "none";

        });

    });

});
