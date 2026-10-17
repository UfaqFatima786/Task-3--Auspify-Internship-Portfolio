const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
const WEATHER_URL = "https://api.open-meteo.com/v1/forecast";
const form = document.getElementById("searchForm");
const cityInput = document.getElementById("cityInput");
const unitBtn = document.getElementById("unitBtn");
const messageEl = document.getElementById("message");
const loaderEl = document.getElementById("loader");
const currentEl = document.getElementById("current");
const forecastSection = document.getElementById("forecastSection");
const forecastEl = document.getElementById("forecast");
const recentSection = document.getElementById("recentSection");
const recentEl = document.getElementById("recent");

let unit = "C";
let lastData = null; 
function describeWeather(code, isDay = 1) {
  if (code === 0) return { text: "Clear sky", icon: isDay ? "☀️" : "🌙" };
  if (code === 1) return { text: "Mainly clear", icon: isDay ? "🌤️" : "🌙" };
  if (code === 2) return { text: "Partly cloudy", icon: "⛅" };
  if (code === 3) return { text: "Overcast", icon: "☁️" };
  if (code === 45 || code === 48) return { text: "Fog", icon: "🌫️" };
  if (code >= 51 && code <= 57) return { text: "Drizzle", icon: "🌦️" };
  if (code >= 61 && code <= 67) return { text: "Rain", icon: "🌧️" };
  if (code >= 71 && code <= 77) return { text: "Snow", icon: "❄️" };
  if (code >= 80 && code <= 82) return { text: "Rain showers", icon: "🌧️" };
  if (code === 85 || code === 86) return { text: "Snow showers", icon: "🌨️" };
  if (code === 95) return { text: "Thunderstorm", icon: "⛈️" };
  if (code === 96 || code === 99) return { text: "Thunderstorm with hail", icon: "⛈️" };
  return { text: "Unknown", icon: "🌡️" };
}

function showMessage(text) {
  messageEl.textContent = text;
  messageEl.hidden = false;
}
function clearMessage() {
  messageEl.hidden = true;
  messageEl.textContent = "";
}
function setLoading(isLoading) {
  loaderEl.hidden = !isLoading;
}
function convertTemp(c) {
  return unit === "C" ? Math.round(c) : Math.round((c * 9) / 5 + 32);
}
function tempText(c) {
  return `${convertTemp(c)}°${unit}`;
}

function validateCity(value) {
  const city = value.trim();
  if (!city) return { ok: false, error: "Write your city name." };
  if (city.length < 2) return { ok: false, error: "City ka naam kam az kam 2 characters ka hona chahiye." };
  if (!/^[\p{L}\s.'-]+$/u.test(city)) {
    return { ok: false, error: "City ke naam mein sirf letters allowed hain (numbers/symbols nahi)." };
  }
  return { ok: true, city };
}
async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Server error (${res.status}). Dobara try karein.`);
  return res.json();
}

async function getCoordinates(city) {
  const url = `${GEO_URL}?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
  const data = await fetchJSON(url);
  if (!data.results || data.results.length === 0) {
    throw new Error(`"${city}" naam ki city nahi mili. Spelling check karein.`);
  }
  const r = data.results[0];
  return { name: r.name, country: r.country || "", lat: r.latitude, lon: r.longitude };
}

async function getWeather(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,surface_pressure,wind_speed_10m",
    daily: "weather_code,temperature_2m_max,temperature_2m_min",
    timezone: "auto",
    forecast_days: 5,
  });
  return fetchJSON(`${WEATHER_URL}?${params.toString()}`);
}

function render() {
  if (!lastData) return;
  const { place, weather } = lastData;
  const cur = weather.current;
  const info = describeWeather(cur.weather_code, cur.is_day);

  document.getElementById("cityName").textContent = place.country ? `${place.name}, ${place.country}` : place.name;
  document.getElementById("dateText").textContent = new Date(cur.time).toLocaleString("en-US", {
    weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
  });
  document.getElementById("condition").textContent = info.text;
  document.getElementById("icon").textContent = info.icon;
  document.getElementById("temp").textContent = tempText(cur.temperature_2m);
  document.getElementById("feels").textContent = tempText(cur.apparent_temperature);
  document.getElementById("humidity").textContent = `${cur.relative_humidity_2m}%`;
  document.getElementById("wind").textContent = `${Math.round(cur.wind_speed_10m)} km/h`;
  document.getElementById("pressure").textContent = `${Math.round(cur.surface_pressure)} hPa`;

  forecastEl.innerHTML = "";
  const d = weather.daily;
  d.time.forEach((dateStr, i) => {
    const dayInfo = describeWeather(d.weather_code[i]);
    const card = document.createElement("div");
    card.className = "day";

    const name = document.createElement("div");
    name.className = "d-name";
    name.textContent = i === 0 ? "Today" : new Date(dateStr + "T00:00").toLocaleDateString("en-US", { weekday: "short" });

    const icon = document.createElement("div");
    icon.className = "d-icon";
    icon.textContent = dayInfo.icon;
    icon.title = dayInfo.text;

    const temps = document.createElement("div");
    temps.className = "d-temps";
    temps.innerHTML = `<strong>${convertTemp(d.temperature_2m_max[i])}°</strong> / ${convertTemp(d.temperature_2m_min[i])}°`;

    card.append(name, icon, temps);
    forecastEl.appendChild(card);
  });

  currentEl.hidden = false;
  forecastSection.hidden = false;
}
function getRecent() {
  try { return JSON.parse(localStorage.getItem("recentCities")) || []; }
  catch { return []; }
}
function saveRecent(name) {
  let list = getRecent().filter((c) => c.toLowerCase() !== name.toLowerCase());
  list.unshift(name);
  list = list.slice(0, 5);
  try { localStorage.setItem("recentCities", JSON.stringify(list)); } catch {}
  renderRecent();
}
function renderRecent() {
  const list = getRecent();
  recentEl.innerHTML = "";
  list.forEach((city) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.textContent = city;
    chip.addEventListener("click", () => {
      cityInput.value = city;
      searchCity(city);
    });
    recentEl.appendChild(chip);
  });
  recentSection.hidden = list.length === 0;
}
async function searchCity(city) {
  clearMessage();
  setLoading(true);
  try {
    const place = await getCoordinates(city);
    const weather = await getWeather(place.lat, place.lon);
    lastData = { place, weather };
    render();
    saveRecent(place.name);
  } catch (err) {
    currentEl.hidden = true;
    forecastSection.hidden = true;
    if (err instanceof TypeError) {
      showMessage("Internet connection ka masla hai. Connection check karke dobara try karein.");
    } else {
      showMessage(err.message || "Kuch ghalat ho gaya. Dobara try karein.");
    }
  } finally {
    setLoading(false);
  }
}
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const result = validateCity(cityInput.value);
  if (!result.ok) {
    showMessage(result.error);
    return;
  }
  searchCity(result.city);
});

unitBtn.addEventListener("click", () => {
  unit = unit === "C" ? "F" : "C";
  unitBtn.textContent = `°${unit}`;
  render();
});

// ====== Init ======
renderRecent();
searchCity("Karachi");