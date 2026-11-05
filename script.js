
// Default location: Mitihanap Ward, Oksapmin LLG, Telefomin District, West Sepik (Sandaun), PNG
// NOTE: coordinates are approximate (Oksapmin area). Adjust if you have the exact GPS point.
const DEFAULT_PLACE = {
  name: "Mitihanap Ward, Oksapmin",
  lat: -5.25,
  lon: 142.23
};

const $ = (id) => document.getElementById(id);

// WMO weather codes -> [description, emoji]
const WEATHER = {
  0: ["Clear sky", "☀️"], 1: ["Mostly clear", "🌤️"], 2: ["Partly cloudy", "⛅"], 3: ["Overcast", "☁️"],
  45: ["Fog", "🌫️"], 48: ["Rime fog", "🌫️"],
  51: ["Light drizzle", "🌦️"], 53: ["Drizzle", "🌦️"], 55: ["Heavy drizzle", "🌧️"],
  61: ["Light rain", "🌦️"], 63: ["Rain", "🌧️"], 65: ["Heavy rain", "🌧️"],
  80: ["Light showers", "🌦️"], 81: ["Showers", "🌧️"], 82: ["Violent showers", "⛈️"],
  95: ["Thunderstorm", "⛈️"], 96: ["Thunderstorm, hail", "⛈️"], 99: ["Severe thunderstorm", "⛈️"]
};
const wx = (code) => WEATHER[code] || ["Unknown", "🌡️"];

// ---------- Map ----------
const map = L.map("map").setView([DEFAULT_PLACE.lat, DEFAULT_PLACE.lon], 8);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 18,
  attribution: "© OpenStreetMap"
}).addTo(map);
let marker = L.marker([DEFAULT_PLACE.lat, DEFAULT_PLACE.lon]).addTo(map);

async function addRadar() {
  try {
    const res = await fetch("https://api.rainviewer.com/public/weather-maps.json");
    const data = await res.json();
    const frames = data.radar.past;
    const last = frames[frames.length - 1];
    L.tileLayer(`${data.host}${last.path}/256/{z}/{x}/{y}/2/1_1.png`, { opacity: 0.6 }).addTo(map);
  } catch (e) {
    console.warn("Radar unavailable", e);
  }
}

// ---------- Weather ----------
async function loadWeather(place) {
  $("status").textContent = "Loading...";
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
      `&timezone=auto&forecast_days=4`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Weather request failed");
    const d = await res.json();

    const c = d.current;
    const [desc, icon] = wx(c.weather_code);
    $("cityName").textContent = place.name;
    $("temperature").textContent = Math.round(c.temperature_2m);
    $("weatherDesc").textContent = desc;
    $("weatherIcon").textContent = icon;
    $("humidity").textContent = c.relative_humidity_2m + "%";
    $("wind").textContent = Math.round(c.wind_speed_10m) + " km/h";
    $("feels").textContent = Math.round(c.apparent_temperature) + "°C";

    // Next 3 days
    for (let i = 1; i <= 3; i++) {
      const day = new Date(d.daily.time[i] + "T00:00:00");
      const [, ic] = wx(d.daily.weather_code[i]);
      $("day" + i).innerHTML =
        `<div class="d">${day.toLocaleDateString("en", { weekday: "short" })}</div>` +
        `<div class="i">${ic}</div>` +
        `<div class="t">${Math.round(d.daily.temperature_2m_max[i])}°C / ${Math.round(d.daily.temperature_2m_min[i])}°C</div>` +
        `<div class="rain">💧 ${d.daily.precipitation_probability_max[i] ?? 0}%</div>`;
    }

    map.setView([place.lat, place.lon], 8);
    marker.setLatLng([place.lat, place.lon]);
    $("status").textContent = "";
  } catch (err) {
    $("status").textContent = "Could not load weather. Check your internet connection.";
    console.error(err);
  }
}

// ---------- Search ----------
async function searchPlace() {
  const q = $("cityInput").value.trim();
  if (!q) return;
  $("status").textContent = "Searching...";
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1`
    );
    const data = await res.json();
    if (!data.results || !data.results.length) {
      $("status").textContent = `No place found for "${q}". Try a nearby town (e.g. Oksapmin, Telefomin, Vanimo).`;
      return;
    }
    const r = data.results[0];
    loadWeather({
      name: [r.name, r.admin1, r.country].filter(Boolean).join(", "),
      lat: r.latitude,
      lon: r.longitude
    });
  } catch (e) {
    $("status").textContent = "Search failed. Try again.";
  }
}

$("searchBtn").addEventListener("click", searchPlace);
$("cityInput").addEventListener("keydown", (e) => { if (e.key === "Enter") searchPlace(); });

// Start
addRadar();
loadWeather(DEFAULT_PLACE);
setInterval(() => loadWeather(DEFAULT_PLACE), 30 * 60 * 1000); // refresh every 30 min

