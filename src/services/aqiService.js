// Local Node.js API Service

const API_BASE = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000').replace(/\/$/, '');
const BACKEND_URL = `${API_BASE}/api`;
const GEO_URL = 'https://api.openweathermap.org/geo/1.0';
const API_KEY = import.meta.env.VITE_OWM_API_KEY;


// MAIN FUNCTION
export const fetchAqiData = async (lat, lon) => {
    try {
        const [predictionResponse, ecoResponse] = await Promise.all([
            fetch(`${BACKEND_URL}/predict?lat=${lat}&lon=${lon}`),
            fetch(`${BACKEND_URL}/eco-score?lat=${lat}&lon=${lon}`),
        ]);

        const data = await predictionResponse.json();
        const ecoScore = ecoResponse.ok ? await ecoResponse.json() : null;

        if (data.error) throw new Error(data.error);
        if (ecoScore?.error) {
            console.error("Eco-score fetch error:", ecoScore.error);
        }

        console.log("Backend Response:", data);

        const forecastIntervals = (data.forecast_intervals || []).map((item) => ({
            label: item.label,
            aqi: item.aqi,
            source: item.source,
            confidence: item.confidence || null,
            icon: getIconForAqi(item.aqi),
        }));

        return {
            usAqi: data.current.us_epa_aqi_simulated,
            components: data.current.owm_data.components,
            locationName: data.location || "Unknown Location",
            forecastIntervals,
            mlPrediction: data.ml_prediction,
            ecoScore,
            weatherData: data.current.weather
        };

    } catch (error) {
        console.error("Error fetching data:", error);
        throw error;
    }
};


// Readonly version
export const fetchAqiDataReadonly = async (lat, lon) => {
    try {
        const response = await fetch(`${BACKEND_URL}/predict?lat=${lat}&lon=${lon}&save=false`);
        const data = await response.json();

        if (data.error) throw new Error(data.error);

        return {
            usAqi: data.current.us_epa_aqi_simulated,
            locationName: data.location || "Unknown Location",
        };

    } catch (error) {
        console.error("Readonly fetch error:", error);
        throw error;
    }
};


// AQI icon helper
const getIconForAqi = (aqi) => {
    if (aqi == null) return '❓';
    if (aqi <= 50) return '☀️';
    if (aqi <= 100) return '🌤️';
    if (aqi <= 150) return '⛅';
    if (aqi <= 200) return '🌥️';
    return '🌫️';
};


// Search location
export const searchLocation = async (query) => {
    if (!API_KEY) throw new Error("Missing API Key");

    const response = await fetch(`${GEO_URL}/direct?q=${query}&limit=5&appid=${API_KEY}`);
    const data = await response.json();

    return data.map(item => ({
        name: item.name,
        state: item.state,
        country: item.country,
        lat: item.lat,
        lon: item.lon
    }));
};


// Reverse geocode
export const reverseGeocode = async (lat, lon) => {
    if (!API_KEY) throw new Error("Missing API Key");

    const response = await fetch(`${GEO_URL}/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${API_KEY}`);
    const data = await response.json();

    if (data && data.length > 0) {
        return `${data[0].name}${data[0].state ? `, ${data[0].state}` : ''}`;
    }

    return "Unknown Location";
};


// Fetch historical measurements
export const fetchHistoricalData = async (lat, lon, period) => {
    const response = await fetch(`${BACKEND_URL}/historical?lat=${lat}&lon=${lon}&period=${period}`);
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch historical data");
    }
    return response.json();
};