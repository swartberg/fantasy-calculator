import { fetchAndUpdate }  from "./api-stats.js";

console.log('dom.js is running');

const fPointsDisplay = document.querySelector('.player-fantasy-points');
console.log('element found:', fPointsDisplay);
const fPoints = fetchAndUpdate();
console.log('function result:', fPoints);

console.log(fPoints);

fPointsDisplay.textContent = fPoints[0].fantasy_points;