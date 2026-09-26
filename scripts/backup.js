import { exportTeams, importTeams, getSavedRounds } from "./my-team.js?v=26";


/* =========================
   SETUP
========================= */

/*
    Export / import buttons under My Team. Teams live
    only in this browser, so a backup file is the way
    to keep them safe or move them to another device.
*/
export function setupBackup({ onImport }) {
    const exportButton = document.querySelector(".js-export-teams");
    const importButton = document.querySelector(".js-import-teams");
    const fileInput = document.querySelector(".js-import-file");

    if (!exportButton || !importButton || !fileInput) return;

    exportButton.addEventListener("click", () => {
        if (!getSavedRounds().length) {
            window.alert("There are no teams to back up yet.");

            return;
        }

        downloadBackup();
    });

    importButton.addEventListener("click", () => {
        fileInput.value = "";
        fileInput.click();
    });

    fileInput.addEventListener("change", async () => {
        const file = fileInput.files?.[0];

        // Clear the picker so choosing the same file again still works
        fileInput.value = "";

        if (!file) return;

        let backup;

        try {
            backup = JSON.parse(await file.text());
        }
        catch (error) {
            window.alert("This file couldn't be read. Choose a backup exported from this app.");

            return;
        }

        const rounds = Object.keys(backup?.teams || {}).length;

        if (!window.confirm(
            `Replace your saved teams with this backup (${rounds} ${rounds === 1 ? "round" : "rounds"})? ` +
            "Teams you have now will be overwritten."
        )) return;

        try {
            const restored = importTeams(backup);

            window.alert(`Restored ${restored} ${restored === 1 ? "round" : "rounds"}.`);

            onImport();
        }
        catch (error) {
            window.alert(error.message);
        }
    });
}


/* =========================
   EXPORT
========================= */

function downloadBackup() {
    const backup = exportTeams();

    const date = new Date().toISOString().slice(0, 10);

    const blob = new Blob(
        [JSON.stringify(backup, null, 2)],
        { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download = `fantasy-teams-${date}.json`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    // Give the download time to start before freeing the file
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
