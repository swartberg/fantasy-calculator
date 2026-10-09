/*
    Draws the app icon (an orange basketball) to
    assets/logo.png for @capacitor/assets, which makes
    every Android icon and splash size from it.
*/
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1024" height="1024">
    <g fill="none" stroke="#FF6200" stroke-width="1.5" stroke-linecap="round">
        <circle cx="12" cy="12" r="9"/>
        <path d="M3 12h18"/>
        <path d="M12 3v18"/>
        <path d="M5.6 5.6c3.2 3.4 3.2 9.4 0 12.8"/>
        <path d="M18.4 5.6c-3.2 3.4-3.2 9.4 0 12.8"/>
    </g>
</svg>`;

await mkdir("assets", { recursive: true });

await sharp(Buffer.from(svg)).png().toFile("assets/logo.png");

console.log("Icon written to assets/logo.png");
