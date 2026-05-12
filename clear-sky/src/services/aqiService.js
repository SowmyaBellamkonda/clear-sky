// Local Node.js API Service

// Base URL for the new Node.js backend
const BACKEND_URL = 'http://localhost:5000/api';

// Base URL for the Geocoding API (still needed for search functionality standalone)
const GEO_URL = 'https://api.openweathermap.org/geo/1.0';
const API_KEY = import.meta.env.VITE_OWM_API_KEY; // Only needed for standalone search now

// Single endpoint that gets everything: current, forecast intervals, ml_prediction, and location name
export const fetchAqiData = async (lat, lon) => {
    try {
        const response = await fetch(`${BACKEND_URL}/predict?lat=${lat}&lon=${lon}`);
        const data = await response.json();

        if (data.error) throw new Error(data.error);

        console.log("Backend Aggregated Response:", data);

        // Parse the new interval-based forecast structure
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
            mlPrediction: data.ml_prediction
        };

    } catch (error) {
        console.error("Error fetching data from local backend:", error);
        throw error;
    }
};

// Same as fetchAqiData but does NOT save to MongoDB (for map double-clicks)
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
        console.error("Error fetching readonly data:", error);
        throw error;
    }
};

// Helper: get an icon based on AQI value
const getIconForAqi = (aqi) => {
    if (aqi == null) return '❓';
    if (aqi <= 50) return '☀️';
    if (aqi <= 100) return '🌤️';
    if (aqi <= 150) return '⛅';
    if (aqi <= 200) return '🌥️';
    return '🌫️';
};

export const searchLocation = async (query) => {
    if (!API_KEY) throw new Error("Missing API Key");

    try {
        const response = await fetch(`${GEO_URL}/direct?q=${query}&limit=5&appid=${API_KEY}`);
        const data = await response.json();
        return data.map(item => ({
            name: item.name,
            state: item.state,
            country: item.country,
            lat: item.lat,
            lon: item.lon
        }));
    } catch (error) {
        console.error("Error searching location:", error);
        throw error;
    }
};

// Fetch real city/landmark names based on coordinates using reverse geocoding
export const reverseGeocode = async (lat, lon) => {
    if (!API_KEY) throw new Error("Missing API Key");

    try {
        const response = await fetch(`${GEO_URL}/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${API_KEY}`);
        const data = await response.json();
        if (data && data.length > 0) {
            return `${data[0].name}${data[0].state ? `, ${data[0].state}` : ''}`;
        }
        return "Unknown Location";
    } catch (error) {
        console.error("Error reverse geocoding:", error);
        return "Unknown Location";
    }
};
