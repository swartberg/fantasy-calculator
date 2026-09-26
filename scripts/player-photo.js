/*
    Player photos: images/players/firstname_lastname.<ext>
    Tried in this order; a placeholder shows if none exist.
    The photo workflow converts uploads to .webp, so that
    comes first; the rest cover photos not yet converted.
*/
const PHOTO_FOLDER = "images/players";
const PHOTO_EXTENSIONS = ["webp", "png", "jpg", "jpeg", "avif"];

// Photo URL found per file name (null = none), so re-renders don't flicker
const photoUrls = new Map();


/*
    Puts the player's photo in `frame`, replacing its
    `.js-photo-placeholder` once one loads. Tries each
    extension in turn; with none, the placeholder stays.
*/
export function loadPlayerPhoto(frame, name, imageClass) {
    const fileName = getPhotoFileName(name);

    if (!frame || !fileName) return;

    const showPhoto = url => {
        const photo = new Image();

        photo.className = imageClass;
        photo.alt = formatName(name);
        photo.src = url;

        frame.querySelector(".js-photo-placeholder")?.remove();
        frame.querySelector(`.${imageClass}`)?.remove();
        frame.prepend(photo);
    };

    if (photoUrls.has(fileName)) {
        const url = photoUrls.get(fileName);

        if (url) showPhoto(url);

        return;
    }

    const tryExtension = index => {
        if (index >= PHOTO_EXTENSIONS.length) {
            photoUrls.set(fileName, null);

            return;
        }

        const photo = new Image();

        photo.onload = () => {
            photoUrls.set(fileName, photo.src);

            // Re-rendered or closed meanwhile
            if (frame.isConnected) {
                showPhoto(photo.src);
            }
        };

        photo.onerror = () => tryExtension(index + 1);

        photo.src = `${PHOTO_FOLDER}/${fileName}.${PHOTO_EXTENSIONS[index]}`;
    };

    tryExtension(0);
}


/*
    "DE COLO, NANDO" → "nando_de_colo"
    Lowercase, accents removed, spaces become "_",
    hyphens are kept ("hayes-davis").
*/
export function getPhotoFileName(name = "") {
    const [last, first] = name.split(",").map(part => part.trim());

    if (!last) return "";

    return [first, last]
        .filter(Boolean)
        .join(" ")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "_");
}


// "LAST, FIRST" → "FIRST LAST"
function formatName(name = "") {
    const [last, first] = name.split(",").map(part => part.trim());

    return first ? `${first} ${last}` : name;
}


// Silhouette shown until (or instead of) a photo
export const PHOTO_PLACEHOLDER = `
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <circle cx="12" cy="8" r="4.5"></circle>
        <path d="M3 22c0-5 4-8.5 9-8.5s9 3.5 9 8.5z"></path>
    </svg>
`;
