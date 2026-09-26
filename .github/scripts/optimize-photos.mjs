/*
    Shrinks player photos in images/players/:
    - fits each photo inside 320x320 (never enlarges)
    - saves it as WebP (keeps transparency, much smaller)
    - removes the original if it was another format

    Names stay firstname_lastname, so the app still finds
    them (it looks for .webp first). Already-small WebP
    files are left alone, so running it again is safe.

    Run: node .github/scripts/optimize-photos.mjs
*/
import sharp from "sharp";
import { readdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const PHOTO_DIR = "images/players";
const MAX_SIZE = 320;
const SOURCE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".avif"];

// WebP files this small and no larger than MAX_SIZE are already optimized
const OPTIMIZED_BYTES = 80 * 1024;


const files = (await readdir(PHOTO_DIR))
    .filter(file => SOURCE_EXTENSIONS.includes(path.extname(file).toLowerCase()))
    // Other formats first: a new upload replaces an older .webp of the same player
    .sort((a, b) => Number(a.endsWith(".webp")) - Number(b.endsWith(".webp")));

const done = new Set();
let savedBytes = 0;

for (const file of files) {
    const extension = path.extname(file).toLowerCase();
    const name = path.basename(file, path.extname(file));
    const source = path.join(PHOTO_DIR, file);
    const target = path.join(PHOTO_DIR, `${name}.webp`);

    // Newer upload for this player already handled
    if (done.has(name)) continue;

    done.add(name);

    const before = (await stat(source)).size;
    const { width, height } = await sharp(source).metadata();

    if (
        extension === ".webp" &&
        before <= OPTIMIZED_BYTES &&
        Math.max(width, height) <= MAX_SIZE
    ) {
        continue;
    }

    const output = await sharp(source)
        .rotate()
        .resize(MAX_SIZE, MAX_SIZE, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 82, alphaQuality: 90, effort: 6 })
        .toBuffer();

    // Keep an existing WebP if re-encoding wouldn't make it smaller
    if (extension === ".webp" && output.length >= before) continue;

    await writeFile(target, output);

    if (extension !== ".webp") {
        await unlink(source);
    }

    savedBytes += before - output.length;

    console.log(
        `${file} → ${name}.webp: ${Math.round(before / 1024)} KB → ${Math.round(output.length / 1024)} KB`
    );
}

console.log(`Saved ${Math.round(savedBytes / 1024)} KB in total.`);
