// Dev script: npx ts-node src/scripts/fetch-once.ts
import { validateAndResolve } from '../config/validate';
import { config } from '../config/weather.config';
import { fetchWeather } from '../fetcher/providers/open-meteo';

// The same resolution the fetcher will do: deduped locations and a depth that
// covers the deepest page. Throws synchronously on an invalid config, before
// any request, so this script doubles as a config check.
const { locations, forecastDays } = validateAndResolve(config);

fetchWeather(locations, forecastDays)
  .then((snapshot) => console.log(JSON.stringify(snapshot, null, 2)))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
