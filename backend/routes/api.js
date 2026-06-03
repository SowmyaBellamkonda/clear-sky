const express = require('express');
const router = express.Router();
const axios = require('axios');
const AQIData = require('../models/AQIData');
const dotenv = require('dotenv');
const path = require('path');

// We try to use the backend .env, but if it doesn't have the API key,
// we'll instruct the user or fallback
dotenv.config({ path: path.join(__dirname, '../../.env') }); // try to read from root if possible

const rawOwmKey = process.env.OPENWEATHER_API_KEY || process.env.VITE_OWM_API_KEY || '';
const OPENWEATHER_API_KEY = rawOwmKey.trim().substring(0, 32);
let rawMlUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';
if (rawMlUrl && !rawMlUrl.startsWith('http://') && !rawMlUrl.startsWith('https://')) {
    rawMlUrl = `http://${rawMlUrl}`;
}
const ML_SERVICE_URL = rawMlUrl;

const requireOpenWeatherKey = (res) => {
    if (!OPENWEATHER_API_KEY) {
        res.status(503).json({ error: 'Server missing OPENWEATHER_API_KEY configuration' });
        return false;
    }
    return true;
};

router.get('/predict', async (req, res) => {
    const { lat, lon, save } = req.query;

    if (!lat || !lon) {
        return res.status(400).json({ error: 'Latitude and Longitude are required' });
    }
    if (!requireOpenWeatherKey(res)) return;

    try {
        // 1. Fetch current weather and pollution from OpenWeatherMap
        const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=metric`;
        const pollutionUrl = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}`;
        const forecastUrl = `https://api.openweathermap.org/data/2.5/air_pollution/forecast?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}`;

        const [weatherRes, pollutionRes, forecastRes] = await Promise.all([
            axios.get(weatherUrl),
            axios.get(pollutionUrl),
            axios.get(forecastUrl)
        ]);

        const weatherData = weatherRes.data;
        const pollutionData = pollutionRes.data.list[0];

        // --- India NAQI (National Air Quality Index — CPCB) ---
        // All breakpoints in µg/m³ (same as OWM, no conversion needed)
        // Fixed: Breakpoints adjusted to be continuous so fractional concentrations do not fall in gaps and return 500.
        // Fixed: Cp values are capped at the highest Ch breakpoint to handle overflows.
        const naqiCalc = (Cp, breakpoints) => {
            const maxBp = breakpoints[breakpoints.length - 1];
            const cappedCp = Math.min(Cp, maxBp.Ch);
            
            for (const bp of breakpoints) {
                if (cappedCp >= bp.Cl && cappedCp <= bp.Ch) {
                    return Math.round(((bp.Ih - bp.Il) / (bp.Ch - bp.Cl)) * (cappedCp - bp.Cl) + bp.Il);
                }
            }
            return maxBp.Ih;
        };

        const pm25Bp = [
            { Cl: 0, Ch: 30, Il: 0, Ih: 50 },
            { Cl: 30, Ch: 60, Il: 50, Ih: 100 },
            { Cl: 60, Ch: 90, Il: 100, Ih: 200 },
            { Cl: 90, Ch: 120, Il: 200, Ih: 300 },
            { Cl: 120, Ch: 250, Il: 300, Ih: 400 },
            { Cl: 250, Ch: 500, Il: 400, Ih: 500 },
        ];
        const pm10Bp = [
            { Cl: 0, Ch: 50, Il: 0, Ih: 50 },
            { Cl: 50, Ch: 100, Il: 50, Ih: 100 },
            { Cl: 100, Ch: 250, Il: 100, Ih: 200 },
            { Cl: 250, Ch: 350, Il: 200, Ih: 300 },
            { Cl: 350, Ch: 430, Il: 300, Ih: 400 },
            { Cl: 430, Ch: 600, Il: 400, Ih: 500 },
        ];
        const no2Bp = [
            { Cl: 0, Ch: 40, Il: 0, Ih: 50 },
            { Cl: 40, Ch: 80, Il: 50, Ih: 100 },
            { Cl: 80, Ch: 180, Il: 100, Ih: 200 },
            { Cl: 180, Ch: 280, Il: 200, Ih: 300 },
            { Cl: 280, Ch: 400, Il: 300, Ih: 400 },
            { Cl: 400, Ch: 800, Il: 400, Ih: 500 },
        ];
        const so2Bp = [
            { Cl: 0, Ch: 40, Il: 0, Ih: 50 },
            { Cl: 40, Ch: 80, Il: 50, Ih: 100 },
            { Cl: 80, Ch: 380, Il: 100, Ih: 200 },
            { Cl: 380, Ch: 800, Il: 200, Ih: 300 },
            { Cl: 800, Ch: 1600, Il: 300, Ih: 400 },
            { Cl: 1600, Ch: 2400, Il: 400, Ih: 500 },
        ];
        const o3Bp = [
            { Cl: 0, Ch: 50, Il: 0, Ih: 50 },
            { Cl: 50, Ch: 100, Il: 50, Ih: 100 },
            { Cl: 100, Ch: 168, Il: 100, Ih: 200 },
            { Cl: 168, Ch: 208, Il: 200, Ih: 300 },
            { Cl: 208, Ch: 748, Il: 300, Ih: 400 },
            { Cl: 748, Ch: 1000, Il: 400, Ih: 500 },
        ];
        const coBp = [
            { Cl: 0, Ch: 1.0, Il: 0, Ih: 50 },
            { Cl: 1.0, Ch: 2.0, Il: 50, Ih: 100 },
            { Cl: 2.0, Ch: 10.0, Il: 100, Ih: 200 },
            { Cl: 10.0, Ch: 17.0, Il: 200, Ih: 300 },
            { Cl: 17.0, Ch: 34.0, Il: 300, Ih: 400 },
            { Cl: 34.0, Ch: 50.0, Il: 400, Ih: 500 },
        ];

        const comp = pollutionData.components;
        const subIndices = [
            naqiCalc(comp.pm2_5 || 0, pm25Bp),
            naqiCalc(comp.pm10 || 0, pm10Bp),
            naqiCalc(comp.no2 || 0, no2Bp),
            naqiCalc(comp.so2 || 0, so2Bp),
            naqiCalc(comp.o3 || 0, o3Bp),
            naqiCalc((comp.co || 0) / 1000, coBp),  // OWM µg/m³ → NAQI mg/m³
        ];
        const usEpaAqi = Math.max(...subIndices);

        // 2. Fetch historical AQI data from our MongoDB for lag features
        // We need 7 days total (6 days history + 1 current day) for LSTM
        // Fix: Use aggregation to group by day and avoid race condition of multiple records per day
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Start of today

        const historyRecords = await AQIData.aggregate([
            {
                $match: {
                    'location.lat': parseFloat(lat),
                    'location.lon': parseFloat(lon),
                    timestamp: { $lt: today } // Only records from STRICTLY before today
                }
            },
            {
                $sort: { timestamp: -1 } // Sort newest first
            },
            {
                $group: {
                    _id: {
                        year: { $year: "$timestamp" },
                        month: { $month: "$timestamp" },
                        day: { $dayOfMonth: "$timestamp" }
                    },
                    doc: { $first: "$$ROOT" } // grab the most recent record for that unique day
                }
            },
            {
                $sort: { 'doc.timestamp': -1 } // Re-sort the grouped days newest first
            },
            {
                $limit: 6 // We want the last 6 distinct days
            }
        ]);

        // Unpack the docs from the aggregation
        const historyUniqueDays = historyRecords.map(r => r.doc);

        // Prepare sequence for ML Model (We need exactly 6 days of history, oldest first)
        const historyPayload = [];

        // Reverse them so they represent T-6 to T-1 chronologically
        historyUniqueDays.reverse();

        // 2b. Implement intelligent Cold Start Backfill
        // If we don't have 6 days in the DB, we shouldn't copy today's exact values 6 times.
        // Instead, we use the Open-Meteo API to gather actual historical weather and air quality for the last 6 days.
        const missingDaysCount = 6 - historyUniqueDays.length;

        if (missingDaysCount > 0) {
            let backfillSuccess = false;
            try {
                const t6 = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
                const t1 = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
                const t6Str = t6.toISOString().substring(0, 10);
                const t1Str = t1.toISOString().substring(0, 10);

                const aqUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&start_date=${t6Str}&end_date=${t1Str}&hourly=pm2_5,pm10,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone`;
                const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&start_date=${t6Str}&end_date=${t1Str}&hourly=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,wind_direction_10m&wind_speed_unit=ms`;

                const [aqRes, weatherRes] = await Promise.all([
                    axios.get(aqUrl),
                    axios.get(weatherUrl)
                ]);

                const aqHourly = aqRes.data.hourly;
                const weatherHourly = weatherRes.data.hourly;

                if (aqHourly && weatherHourly && aqHourly.time.length >= 144 && weatherHourly.time.length >= 144) {
                    const tempPayload = [];
                    for (let dayOffset = 0; dayOffset < 6; dayOffset++) {
                        const startIdx = dayOffset * 24;
                        let pm25Sum = 0, pm10Sum = 0, no2Sum = 0, so2Sum = 0, coSum = 0, o3Sum = 0;
                        let tempSum = 0, humSum = 0, pressSum = 0, windSpeedSum = 0, windDirSum = 0;

                        for (let h = 0; h < 24; h++) {
                            const idx = startIdx + h;
                            pm25Sum += aqHourly.pm2_5[idx] || 0;
                            pm10Sum += aqHourly.pm10[idx] || 0;
                            coSum += aqHourly.carbon_monoxide[idx] || 0;
                            no2Sum += aqHourly.nitrogen_dioxide[idx] || 0;
                            so2Sum += aqHourly.sulphur_dioxide[idx] || 0;
                            o3Sum += aqHourly.ozone[idx] || 0;

                            tempSum += weatherHourly.temperature_2m[idx] || 0;
                            humSum += weatherHourly.relative_humidity_2m[idx] || 0;
                            pressSum += weatherHourly.surface_pressure[idx] || 0;
                            windSpeedSum += weatherHourly.wind_speed_10m[idx] || 0;
                            windDirSum += weatherHourly.wind_direction_10m[idx] || 0;
                        }

                        const pm25Avg = pm25Sum / 24;
                        const pm10Avg = pm10Sum / 24;
                        const coAvg = coSum / 24;
                        const no2Avg = no2Sum / 24;
                        const so2Avg = so2Sum / 24;
                        const o3Avg = o3Sum / 24;

                        const tempAvg = tempSum / 24;
                        const humAvg = humSum / 24;
                        const pressAvg = pressSum / 24;
                        const windSpeedAvg = windSpeedSum / 24;
                        const windDirAvg = windDirSum / 24;

                        const dailyAqi = Math.max(
                            naqiCalc(pm25Avg, pm25Bp),
                            naqiCalc(pm10Avg, pm10Bp),
                            naqiCalc(no2Avg, no2Bp),
                            naqiCalc(so2Avg, so2Bp),
                            naqiCalc(o3Avg, o3Bp),
                            naqiCalc(coAvg / 1000, coBp)
                        );

                        const currentDayDate = new Date(Date.now() - (6 - dayOffset) * 24 * 60 * 60 * 1000);

                        tempPayload.push({
                            pm2_5: pm25Avg,
                            pm10: pm10Avg,
                            no2: no2Avg,
                            so2: so2Avg,
                            co: coAvg,
                            o3: o3Avg,
                            temperature: tempAvg,
                            humidity: humAvg,
                            wind_speed: windSpeedAvg,
                            wind_direction: windDirAvg,
                            pressure: pressAvg,
                            day_of_week: currentDayDate.getDay(),
                            month: currentDayDate.getMonth() + 1,
                            aqi: dailyAqi
                        });
                    }

                    // Push these Open-Meteo days as the first parts of our sequence.
                    for (let i = 0; i < missingDaysCount; i++) {
                        const item = tempPayload[i];
                        historyPayload.push({
                            pm2_5: item.pm2_5,
                            pm10: item.pm10,
                            no2: item.no2,
                            so2: item.so2,
                            co: item.co / 10, // ML model scale
                            o3: item.o3,
                            temperature: item.temperature,
                            humidity: item.humidity,
                            wind_speed: item.wind_speed,
                            wind_direction: item.wind_direction,
                            pressure: item.pressure,
                            day_of_week: item.day_of_week,
                            month: item.month,
                            aqi: item.aqi
                        });
                    }
                    backfillSuccess = true;
                    console.log(`[Backfill] Successfully backfilled ${missingDaysCount} missing days via Open-Meteo API.`);
                }
            } catch (openMeteoError) {
                console.error("[Backfill] Open-Meteo API backfill failed. Falling back to naive method.", openMeteoError.message);
            }

            // Naive noise-based fallback if Open-Meteo failed
            if (!backfillSuccess) {
                // General reasonable fallbacks if the DB is completely empty for this location
                let fallbackData = {
                    pm2_5: pollutionData.components.pm2_5 || 15,
                    pm10: pollutionData.components.pm10 || 20,
                    no2: pollutionData.components.no2 || 10,
                    so2: pollutionData.components.so2 || 5,
                    co: pollutionData.components.co || 200, // unscaled fallback CO
                    o3: pollutionData.components.o3 || 30,
                    temperature: weatherData.main.temp || 20,
                    humidity: weatherData.main.humidity || 50,
                    wind_speed: weatherData.wind.speed || 5,
                    wind_direction: weatherData.wind.deg || 180,
                    pressure: weatherData.main.pressure || 1013,
                    aqi: usEpaAqi || 50
                };

                // If we have at least 1 historical record, use the oldest one as our baseline to backfill
                if (historyUniqueDays.length > 0) {
                    const oldestKnown = historyUniqueDays[0];
                    fallbackData = {
                        pm2_5: oldestKnown.pollution.pm2_5 || fallbackData.pm2_5,
                        pm10: oldestKnown.pollution.pm10 || fallbackData.pm10,
                        no2: oldestKnown.pollution.no2 || fallbackData.no2,
                        so2: oldestKnown.pollution.so2 || fallbackData.so2,
                        co: oldestKnown.pollution.co || fallbackData.co,
                        o3: oldestKnown.pollution.o3 || fallbackData.o3,
                        temperature: oldestKnown.weather.temp || fallbackData.temperature,
                        humidity: oldestKnown.weather.humidity || fallbackData.humidity,
                        wind_speed: oldestKnown.weather.wind_speed || fallbackData.wind_speed,
                        wind_direction: oldestKnown.weather.wind_deg || fallbackData.wind_direction,
                        pressure: oldestKnown.weather.pressure || fallbackData.pressure,
                        aqi: oldestKnown.pollution.aqi || fallbackData.aqi
                    };
                }

                // Fill the missing days (pushing to the start of the array basically)
                for (let i = missingDaysCount; i > 0; i--) {
                    const backfillDate = new Date(Date.now() - (i + historyUniqueDays.length) * 86400000);

                    // Add minor random noise (±5%) so the LSTM doesn't see a completely flat line which breaks scaling
                    const addNoise = (val) => val * (1 + (Math.random() * 0.1 - 0.05));

                    historyPayload.push({
                        pm2_5: Math.max(0, addNoise(fallbackData.pm2_5)),
                        pm10: Math.max(0, addNoise(fallbackData.pm10)),
                        no2: Math.max(0, addNoise(fallbackData.no2)),
                        so2: Math.max(0, addNoise(fallbackData.so2)),
                        co: Math.max(0, addNoise(fallbackData.co)) / 10, // ML model scale
                        o3: Math.max(0, addNoise(fallbackData.o3)),
                        temperature: fallbackData.temperature, // keep weather somewhat stable
                        humidity: Math.max(0, Math.min(100, addNoise(fallbackData.humidity))),
                        wind_speed: Math.max(0, fallbackData.wind_speed),
                        wind_direction: fallbackData.wind_direction,
                        pressure: fallbackData.pressure,
                        day_of_week: backfillDate.getDay(),
                        month: backfillDate.getMonth() + 1,
                        aqi: Math.max(1, addNoise(fallbackData.aqi))
                    });
                }
            }
        }

        // Now push the actual historical days we found in the DB
        for (const h of historyUniqueDays) {
            historyPayload.push({
                pm2_5: h.pollution.pm2_5 || 15,
                pm10: h.pollution.pm10 || 20,
                no2: h.pollution.no2 || 10,
                so2: h.pollution.so2 || 5,
                co: (h.pollution.co != null && !isNaN(h.pollution.co)) ? (h.pollution.co / 10) : 20,
                o3: h.pollution.o3 || 30,
                temperature: h.weather.temp || 20,
                humidity: h.weather.humidity || 50,
                wind_speed: h.weather.wind_speed || 5,
                wind_direction: h.weather.wind_deg || 180,
                pressure: h.weather.pressure || 1013,
                day_of_week: new Date(h.timestamp).getDay(),
                month: new Date(h.timestamp).getMonth() + 1,
                aqi: h.pollution.aqi || 50
            });
        }

        // Append Current Day (Day 7)
        historyPayload.push({
            pm2_5: pollutionData.components.pm2_5,
            pm10: pollutionData.components.pm10,
            no2: pollutionData.components.no2,
            so2: pollutionData.components.so2,
            co: pollutionData.components.co / 10,
            o3: pollutionData.components.o3,
            temperature: weatherData.main.temp,
            humidity: weatherData.main.humidity,
            wind_speed: weatherData.wind.speed,
            wind_direction: weatherData.wind.deg,
            pressure: weatherData.main.pressure,
            day_of_week: new Date().getDay(),
            month: new Date().getMonth() + 1,
            aqi: usEpaAqi
        });

        const mlFeatures = { history: historyPayload };

        // 3. Call Python ML Microservice
        let mlPrediction = null;
        try {
            const mlRes = await axios.post(`${ML_SERVICE_URL}/predict`, mlFeatures);
            mlPrediction = mlRes.data;
        } catch (mlError) {
            console.error('Error calling ML service:', mlError.message);
        }

        // 4. Save this data point to MongoDB for future lag features
        const newRecord = new AQIData({
            location: { lat, lon },
            weather: {
                temp: weatherData.main.temp,
                humidity: weatherData.main.humidity,
                pressure: weatherData.main.pressure,
                wind_speed: weatherData.wind.speed,
                wind_deg: weatherData.wind.deg,
            },
            pollution: {
                aqi: usEpaAqi, // Storing our converted US EPA scale
                co: pollutionData.components.co,
                no: pollutionData.components.no,
                no2: pollutionData.components.no2,
                o3: pollutionData.components.o3,
                so2: pollutionData.components.so2,
                pm2_5: pollutionData.components.pm2_5,
                pm10: pollutionData.components.pm10,
                nh3: pollutionData.components.nh3,
            },
            ml_prediction: mlPrediction ? {
                aqi_tomorrow: mlPrediction.predicted_aqi,
                confidence_lower: mlPrediction.confidence_interval[0],
                confidence_upper: mlPrediction.confidence_interval[1],
            } : null
        });

        // Only save to MongoDB if save param is not explicitly false
        if (save !== 'false') {
            await newRecord.save();
        }

        // 5. Build hourly forecast intervals from OWM forecast data
        // OWM air_pollution/forecast returns hourly data points
        const forecastList = forecastRes.data.list || [];
        const nowEpoch = Math.floor(Date.now() / 1000);

        // Helper: convert OWM AQI (1-5) to US EPA
        const toUsEpa = (owm) => {
            if (owm === 1) return 25;
            if (owm === 2) return 75;
            if (owm === 3) return 125;
            if (owm === 4) return 175;
            if (owm === 5) return 250;
            return 50;
        };

        // Target offsets in seconds
        const targetIntervals = [
            { label: '+3h', offsetSec: 3 * 3600 },
            { label: '+6h', offsetSec: 6 * 3600 },
            { label: '+12h', offsetSec: 12 * 3600 },
            { label: '+48h', offsetSec: 48 * 3600 },
        ];

        // Find the closest forecast entry to each target offset
        const forecastIntervals = targetIntervals.map(({ label, offsetSec }) => {
            const targetTime = nowEpoch + offsetSec;
            let closest = forecastList[0];
            let minDiff = Math.abs(forecastList[0]?.dt - targetTime);

            for (const entry of forecastList) {
                const diff = Math.abs(entry.dt - targetTime);
                if (diff < minDiff) {
                    minDiff = diff;
                    closest = entry;
                }
            }

            return {
                label,
                aqi: closest ? toUsEpa(closest.main.aqi) : null,
                source: 'owm',
                components: closest ? closest.components : null,
                dt: closest ? closest.dt : null,
            };
        });

        // Insert the LSTM +24h prediction at position 3 (after +12h, before +48h)
        const lstmInterval = {
            label: '+24h',
            aqi: mlPrediction ? mlPrediction.predicted_aqi : null,
            source: 'lstm',
            confidence: mlPrediction ? mlPrediction.confidence_interval : null,
            dt: nowEpoch + 24 * 3600,
        };
        forecastIntervals.splice(3, 0, lstmInterval);

        // 6. Return aggregated response to Frontend
        res.json({
            location: weatherData.name,
            current: {
                owm_data: pollutionData,
                weather: weatherData,
                us_epa_aqi_simulated: usEpaAqi
            },
            forecast_intervals: forecastIntervals,
            ml_prediction: mlPrediction
        });

    } catch (error) {
        console.error('Error in /predict endpoint:', error.message);
        res.status(500).json({ error: 'Failed to fetch AQI data or predictions' });
    }
});

// --- Heatmap endpoint: returns recent AQI data points ---
router.get('/heatmap', async (req, res) => {
    try {
        const since = new Date(Date.now() - 48 * 60 * 60 * 1000); // Last 48 hours
        const records = await AQIData.find({ timestamp: { $gte: since } })
            .select('location pollution.aqi timestamp')
            .sort({ timestamp: -1 })
            .limit(500);

        const points = records.map(r => ({
            lat: r.location.lat,
            lon: r.location.lon,
            aqi: r.pollution.aqi || 0,
            timestamp: r.timestamp,
        }));

        res.json({ points });
    } catch (error) {
        console.error('Error in /heatmap endpoint:', error.message);
        res.status(500).json({ error: 'Failed to fetch heatmap data' });
    }
});

// --- Real-time AQI for major world cities (for heatmap) ---
const MAJOR_CITIES = [
    { name: 'New Delhi', lat: 28.6139, lon: 77.2090 },
    { name: 'Mumbai', lat: 19.0760, lon: 72.8777 },
    { name: 'Beijing', lat: 39.9042, lon: 116.4074 },
    { name: 'Shanghai', lat: 31.2304, lon: 121.4737 },
    { name: 'Tokyo', lat: 35.6762, lon: 139.6503 },
    { name: 'Seoul', lat: 37.5665, lon: 126.9780 },
    { name: 'Jakarta', lat: -6.2088, lon: 106.8456 },
    { name: 'Bangkok', lat: 13.7563, lon: 100.5018 },
    { name: 'Cairo', lat: 30.0444, lon: 31.2357 },
    { name: 'Lagos', lat: 6.5244, lon: 3.3792 },
    { name: 'London', lat: 51.5074, lon: -0.1278 },
    { name: 'Paris', lat: 48.8566, lon: 2.3522 },
    { name: 'Moscow', lat: 55.7558, lon: 37.6173 },
    { name: 'New York', lat: 40.7128, lon: -74.0060 },
    { name: 'Los Angeles', lat: 34.0522, lon: -118.2437 },
    { name: 'São Paulo', lat: -23.5505, lon: -46.6333 },
    { name: 'Mexico City', lat: 19.4326, lon: -99.1332 },
    { name: 'Dubai', lat: 25.2048, lon: 55.2708 },
    { name: 'Sydney', lat: -33.8688, lon: 151.2093 },
    { name: 'Kolkata', lat: 22.5726, lon: 88.3639 },
];

let worldAqiCache = null;
let worldAqiCacheTime = 0;
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

router.get('/world-aqi', async (req, res) => {
    try {
        if (!requireOpenWeatherKey(res)) return;

        // Return cached data if fresh
        if (worldAqiCache && (Date.now() - worldAqiCacheTime) < CACHE_DURATION) {
            return res.json({ cities: worldAqiCache });
        }

        // Fetch AQI for all cities in parallel
        const toUsEpa = (owm) => {
            if (owm === 1) return 25;
            if (owm === 2) return 75;
            if (owm === 3) return 125;
            if (owm === 4) return 175;
            if (owm === 5) return 250;
            return 50;
        };

        const results = await Promise.allSettled(
            MAJOR_CITIES.map(async (city) => {
                const url = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${city.lat}&lon=${city.lon}&appid=${OPENWEATHER_API_KEY}`;
                const response = await axios.get(url);
                return {
                    name: city.name,
                    lat: city.lat,
                    lon: city.lon,
                    aqi: toUsEpa(response.data.list[0].main.aqi),
                };
            })
        );

        const cities = results
            .filter(r => r.status === 'fulfilled')
            .map(r => r.value);

        // Cache
        worldAqiCache = cities;
        worldAqiCacheTime = Date.now();

        res.json({ cities });
    } catch (error) {
        console.error('Error in /world-aqi endpoint:', error.message);
        res.status(500).json({ error: 'Failed to fetch world AQI data' });
    }
});

// --- Eco-Health Score (proxied to ML service) ---
router.get('/eco-score', async (req, res) => {
    const { lat, lon } = req.query;
    if (!lat || !lon) {
        return res.status(400).json({ error: 'lat and lon are required' });
    }
    if (!requireOpenWeatherKey(res)) return;

    try {
        // Get current AQI from OWM first
        const pollutionRes = await axios.get(
            `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}`
        );
        const weatherRes = await axios.get(
            `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=metric`
        );

        const owmAqi = pollutionRes.data.list[0].main.aqi;
        const usAqi = owmAqi === 1 ? 25 : owmAqi === 2 ? 75 : owmAqi === 3 ? 125 : owmAqi === 4 ? 175 : 250;
        const temp = weatherRes.data?.main?.temp;
        const humidity = weatherRes.data?.main?.humidity;

        // Call ML service for eco-score
        let ecoData;
        try {
            const ecoRes = await axios.get(
                `${ML_SERVICE_URL}/eco-score?lat=${lat}&lon=${lon}&aqi=${usAqi}${temp != null ? `&temp=${temp}` : ''}${humidity != null ? `&humidity=${humidity}` : ''}`
            );
            ecoData = ecoRes.data;
        } catch (mlError) {
            console.error('Error calling ML service for eco-score, calculating fallback locally:', mlError.message);
            
            // Local fallback calculation matching ML service compute_eco_score logic
            const ndvi = 0.3; // Default fallback greenness
            const ndvi_score = Math.max(0, Math.min(100, (ndvi / 0.7) * 100));
            const aqi_score = Math.max(0, Math.min(100, ((500 - usAqi) / 500) * 100));
            
            let temp_score = 100;
            if (temp != null) {
                if (temp < 15) temp_score = Math.max(0, 100 - (15 - temp) * 5);
                else if (temp > 30) temp_score = Math.max(0, 100 - (temp - 30) * 5);
            }
            
            let humidity_score = 100;
            if (humidity != null) {
                if (humidity < 40) humidity_score = Math.max(0, 100 - (40 - humidity) * 3);
                else if (humidity > 70) humidity_score = Math.max(0, 100 - (humidity - 70) * 3);
            }
            
            const eco_score = Math.max(0, Math.min(100, Math.round(
                ndvi_score * 0.40 +
                aqi_score * 0.35 +
                temp_score * 0.15 +
                (humidity != null ? humidity_score * 0.10 : 0)
            )));
            
            let label = "Moderate";
            let recommendation = "Some environmental stress. Limit strenuous outdoor activity.";
            if (eco_score >= 80) {
                label = "Thriving";
                recommendation = "Rich vegetation and clean air. Ideal for outdoor activities.";
            } else if (eco_score >= 60) {
                label = "Healthy";
                recommendation = "Good green cover and acceptable air quality. Enjoy the outdoors.";
            } else if (eco_score >= 20) {
                label = "Degraded";
                recommendation = "Low vegetation and/or poor air quality. Stay indoors if sensitive.";
            } else if (eco_score < 20) {
                label = "Critical";
                recommendation = "Severe environmental degradation. Avoid outdoor exposure.";
            }
            
            ecoData = {
                eco_score,
                label,
                recommendation,
                sources: {
                    ndvi: "fallback:error",
                    ndvi_error: mlError.message,
                    weather: "backend-local",
                },
                breakdown: {
                    ndvi,
                    ndvi_score,
                    aqi_score,
                    temp: temp != null ? temp : 25,
                    temp_score,
                    humidity: humidity != null ? humidity : 50,
                    humidity_score,
                }
            };
        }

        res.json({
            ...ecoData,
            sources: {
                ...(ecoData.sources || {}),
                aqi: {
                    source: 'openweathermap-air-pollution',
                    raw_owm_aqi: owmAqi,
                    us_epa_aqi: usAqi,
                },
            },
        });
    } catch (error) {
        console.error('Error in /eco-score endpoint:', error.message);
        res.status(500).json({ error: 'Failed to fetch eco-health score' });
    }
});

// --- LLaMA Chatbot Endpoint (via HF Router) ---
router.post('/chat', express.json(), async (req, res) => {
    const { message, context } = req.body;
    
    if (!message) {
        return res.status(400).json({ error: 'Message is required' });
    }

    const HF_API_KEY = process.env.HUGGINGFACE_API_KEY;
    if (!HF_API_KEY) {
        return res.status(500).json({ error: 'Hugging Face API key not configured on server' });
    }

    // Default to LLaMA-3 which is supported on the new free Hugging Face Inference Router
    const HF_MODEL = process.env.HF_MODEL || 'meta-llama/Meta-Llama-3-8B-Instruct';
    const HF_URL = `https://router.huggingface.co/v1/chat/completions`;

    try {
        const locationStr = context?.locationName 
            ? `Location: ${context.locationName} (${context.coords?.[0]}, ${context.coords?.[1]}).`
            : '';

        // Construct a contextual prompt
        const systemPrompt = `You are a helpful AI assistant for ClearSky, an environmental app. 
Current conditions: Air Quality Index is ${context?.aqiValue || 'unknown'} (Category: ${context?.theme || 'unknown'}). ${locationStr}
CRITICAL INSTRUCTION: Your responses must be extremely concise. Provide a maximum of 2 sentences. Do not generate long paragraphs. Provide helpful, friendly advice about health, outdoor activities, or air quality based on the current AQI and location.`;

        // Using standard Hugging Face Inference Router format
        const response = await axios.post(
            HF_URL,
            { 
                model: HF_MODEL,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: message }
                ],
                max_tokens: 80,
                temperature: 0.7
            },
            {
                headers: {
                    'Authorization': `Bearer ${HF_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        let replyText = "I'm having trouble understanding right now.";
        
        if (response.data?.choices && response.data.choices.length > 0) {
             replyText = response.data.choices[0].message.content.trim();
        } else if (response.data?.error) {
             throw new Error(response.data.error);
        }

        res.json({ reply: replyText });
    } catch (error) {
        console.error('Error in /chat endpoint:', error.message);
        if (error.response && error.response.data) {
             console.error('Hugging Face API Error details:', error.response.data);
             // HF often returns 503 while models are loading into memory
             if (error.response.status === 503) {
                 return res.status(503).json({ 
                     error: 'The AI model is currently warming up. Please try again in about 20 seconds.', 
                     details: error.response.data 
                 });
             }
        }
        res.status(500).json({ error: 'Failed to communicate with AI chat service' });
    }
});

// New historical AQI data endpoint using Open-Meteo
router.get('/historical', async (req, res) => {
    try {
        const { lat, lon, period } = req.query;

        if (!lat || !lon) {
            return res.status(400).json({ error: 'Latitude and longitude are required' });
        }

        let days = 7;
        if (period === '30days') days = 30;
        if (period === '12months') days = 365;

        const dateTo = new Date();
        const dateFrom = new Date();
        dateFrom.setDate(dateFrom.getDate() - days);

        const dateToStr = dateTo.toISOString().substring(0, 10);
        const dateFromStr = dateFrom.toISOString().substring(0, 10);

        const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&start_date=${dateFromStr}&end_date=${dateToStr}&hourly=pm2_5,pm10,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone`;

        console.log(`[Historical] Fetching Open-Meteo AQ data from ${dateFromStr} to ${dateToStr} for lat=${lat}, lon=${lon}`);
        const response = await axios.get(url);
        const hourly = response.data.hourly;
        const results = [];

        if (hourly && hourly.time) {
            for (let i = 0; i < hourly.time.length; i++) {
                const time = hourly.time[i]; // e.g. "2026-06-03T12:00"
                const localTime = `${time}:00`; // Format to look like local ISO string for splitting by 'T'

                if (hourly.pm2_5 && hourly.pm2_5[i] != null) {
                    results.push({ date: { local: localTime }, parameter: 'pm25', value: hourly.pm2_5[i] });
                }
                if (hourly.pm10 && hourly.pm10[i] != null) {
                    results.push({ date: { local: localTime }, parameter: 'pm10', value: hourly.pm10[i] });
                }
                if (hourly.carbon_monoxide && hourly.carbon_monoxide[i] != null) {
                    results.push({ date: { local: localTime }, parameter: 'co', value: hourly.carbon_monoxide[i] });
                }
                if (hourly.nitrogen_dioxide && hourly.nitrogen_dioxide[i] != null) {
                    results.push({ date: { local: localTime }, parameter: 'no2', value: hourly.nitrogen_dioxide[i] });
                }
                if (hourly.sulphur_dioxide && hourly.sulphur_dioxide[i] != null) {
                    results.push({ date: { local: localTime }, parameter: 'so2', value: hourly.sulphur_dioxide[i] });
                }
                if (hourly.ozone && hourly.ozone[i] != null) {
                    results.push({ date: { local: localTime }, parameter: 'o3', value: hourly.ozone[i] });
                }
            }
        }

        return res.json({ results });

    } catch (error) {
        console.error('[Historical] Error fetching data:', error.message);
        res.status(500).json({ error: 'Failed to fetch historical data from Open-Meteo.' });
    }
});

module.exports = router;
