// Dev script: npx ts-node src/scripts/fetch-once.ts
import { config } from '../config/weather.config';
import { fetchWeather } from '../fetcher/providers/open-meteo';

// Union of every page's locations, deduped by id — one fetch per place.
const locations = [
  ...new Map(
    config.pages.flatMap((p) => p.locations).map((l) => [l.id, l]),
  ).values(),
];
const days = Math.max(...config.pages.map((p) => p.display.forecastDays));

fetchWeather(locations, days)
  .then((snapshot) => console.log(JSON.stringify(snapshot, null, 2)))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
