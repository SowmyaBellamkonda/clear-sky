
const express = require('express');
const router = express.Router();
const axios = require('axios');
const AQIData = require('../models/AQIData');
const dotenv = require('dotenv');

// We try to use the backend .env, but if it doesn't have the API key,
// we'll instruct the user or fallback
dotenv.config({ path: '../.env' });

const OPENWEATHER_API_KEY = process.env.VITE_OWM_API_KEY || 'YOUR_OPENWEATHER_API_KEY';
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

router.get('/predict', async (req, res) => {
    const { lat, lon, save } = req.query;

    if (!lat || !lon) {
        return res.status(400).json({ error: 'Latitude and Longitude are required' });
    }

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

        // --- AQI Calculation ---
        const naqiCalc = (Cp, breakpoints) => {
            for (const bp of breakpoints) {
                if (Cp >= bp.Cl && Cp <= bp.Ch) {
                    return Math.round(((bp.Ih - bp.Il) / (bp.Ch - bp.Cl)) * (Cp - bp.Cl) + bp.Il);
                }
            }
            return breakpoints[breakpoints.length - 1].Ih;
        };

        const pm25Bp = [
            { Cl: 0, Ch: 30, Il: 0, Ih: 50 },
            { Cl: 31, Ch: 60, Il: 51, Ih: 100 },
            { Cl: 61, Ch: 90, Il: 101, Ih: 200 },
            { Cl: 91, Ch: 120, Il: 201, Ih: 300 },
            { Cl: 121, Ch: 250, Il: 301, Ih: 400 },
            { Cl: 251, Ch: 500, Il: 401, Ih: 500 },
        ];

        const pm10Bp = [
            { Cl: 0, Ch: 50, Il: 0, Ih: 50 },
            { Cl: 51, Ch: 100, Il: 51, Ih: 100 },
            { Cl: 101, Ch: 250, Il: 101, Ih: 200 },
            { Cl: 251, Ch: 350, Il: 201, Ih: 300 },
            { Cl: 351, Ch: 430, Il: 301, Ih: 400 },
            { Cl: 431, Ch: 600, Il: 401, Ih: 500 },
        ];

        const no2Bp = [
            { Cl: 0, Ch: 40, Il: 0, Ih: 50 },
            { Cl: 41, Ch: 80, Il: 51, Ih: 100 },
            { Cl: 81, Ch: 180, Il: 101, Ih: 200 },
            { Cl: 181, Ch: 280, Il: 201, Ih: 300 },
            { Cl: 281, Ch: 400, Il: 301, Ih: 400 },
            { Cl: 401, Ch: 800, Il: 401, Ih: 500 },
        ];

        const so2Bp = [
            { Cl: 0, Ch: 40, Il: 0, Ih: 50 },
            { Cl: 41, Ch: 80, Il: 51, Ih: 100 },
            { Cl: 81, Ch: 380, Il: 101, Ih: 200 },
            { Cl: 381, Ch: 800, Il: 201, Ih: 300 },
            { Cl: 801, Ch: 1600, Il: 301, Ih: 400 },
            { Cl: 1601, Ch: 2400, Il: 401, Ih: 500 },
        ];

        const o3Bp = [
            { Cl: 0, Ch: 50, Il: 0, Ih: 50 },
            { Cl: 51, Ch: 100, Il: 51, Ih: 100 },
            { Cl: 101, Ch: 168, Il: 101, Ih: 200 },
            { Cl: 169, Ch: 208, Il: 201, Ih: 300 },
            { Cl: 209, Ch: 748, Il: 301, Ih: 400 },
            { Cl: 749, Ch: 1000, Il: 401, Ih: 500 },
        ];

        const coBp = [
            { Cl: 0, Ch: 1.0, Il: 0, Ih: 50 },
            { Cl: 1.1, Ch: 2.0, Il: 51, Ih: 100 },
            { Cl: 2.1, Ch: 10, Il: 101, Ih: 200 },
            { Cl: 10.1, Ch: 17, Il: 201, Ih: 300 },
            { Cl: 17.1, Ch: 34, Il: 301, Ih: 400 },
            { Cl: 34.1, Ch: 50, Il: 401, Ih: 500 },
        ];

        const comp = pollutionData.components;

        const subIndices = [
            naqiCalc(comp.pm2_5 || 0, pm25Bp),
            naqiCalc(comp.pm10 || 0, pm10Bp),
            naqiCalc(comp.no2 || 0, no2Bp),
            naqiCalc(comp.so2 || 0, so2Bp),
            naqiCalc(comp.o3 || 0, o3Bp),
            naqiCalc((comp.co || 0) / 1000, coBp),
        ];

        const usEpaAqi = Math.max(...subIndices);

        // =========================
        // HISTORY FETCH
        // =========================

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const historyRecords = await AQIData.aggregate([
            {
                $match: {
                    'location.lat': parseFloat(lat),
                    'location.lon': parseFloat(lon),
                    timestamp: { $lt: today }
                }
            },
            {
                $sort: { timestamp: -1 }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$timestamp' },
                        month: { $month: '$timestamp' },
                        day: { $dayOfMonth: '$timestamp' }
                    },
                    doc: { $first: '$$ROOT' }
                }
            },
            {
                $sort: { 'doc.timestamp': -1 }
            },
            {
                $limit: 6
            }
        ]);

        const historyUniqueDays = historyRecords.map(r => r.doc);

        const historyPayload = [];

        historyUniqueDays.reverse();

        // Backfill missing days
        const missingDaysCount = 6 - historyUniqueDays.length;

        if (missingDaysCount > 0) {
            let fallbackData = {
                pm2_5: pollutionData.components.pm2_5 || 15,
                pm10: pollutionData.components.pm10 || 20,
                no2: pollutionData.components.no2 || 10,
                so2: pollutionData.components.so2 || 5,
                co: (pollutionData.components.co / 10) || 20,
                o3: pollutionData.components.o3 || 30,
                temperature: weatherData.main.temp || 20,
                humidity: weatherData.main.humidity || 50,
                wind_speed: weatherData.wind.speed || 5,
                wind_direction: weatherData.wind.deg || 180,
                pressure: weatherData.main.pressure || 1013,
                aqi: usEpaAqi || 50
            };

            const addNoise = (val) => val * (1 + (Math.random() * 0.1 - 0.05));

            for (let i = missingDaysCount; i > 0; i--) {
                const backfillDate = new Date(Date.now() - (i + historyUniqueDays.length) * 86400000);

                historyPayload.push({
                    pm2_5: Math.max(0, addNoise(fallbackData.pm2_5)),
                    pm10: Math.max(0, addNoise(fallbackData.pm10)),
                    no2: Math.max(0, addNoise(fallbackData.no2)),
                    so2: Math.max(0, addNoise(fallbackData.so2)),
                    co: Math.max(0, addNoise(fallbackData.co)),
                    o3: Math.max(0, addNoise(fallbackData.o3)),
                    temperature: fallbackData.temperature,
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

        // Real history
        for (const h of historyUniqueDays) {
            historyPayload.push({
                pm2_5: h.pollution.pm2_5 || 15,
                pm10: h.pollution.pm10 || 20,
                no2: h.pollution.no2 || 10,
                so2: h.pollution.so2 || 5,
                co: h.pollution.co || 20,
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

        // Current day
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

        // =========================
        // FIXED LSTM INPUT
        // =========================

        const fixedHistory = historyPayload.slice(-7);

        console.log('Final History Length:', fixedHistory.length);
        console.log('History Payload:', fixedHistory);

        const mlFeatures = {
            history: fixedHistory
        };

        // =========================
        // ML SERVICE CALL
        // =========================

        let mlPrediction = null;

        try {
            const mlRes = await axios.post(`${ML_SERVICE_URL}/predict`, mlFeatures);

            mlPrediction = mlRes.data;

            console.log('ML Prediction Success:', mlPrediction);
        } catch (mlError) {
            console.error(
                'Error calling ML service:',
                mlError.response?.data || mlError.message
            );
        }

        // =========================
        // SAVE RECORD
        // =========================

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
                aqi: usEpaAqi,
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

        if (save !== 'false') {
            await newRecord.save();
        }

        // =========================
        // FORECAST BUILDING
        // =========================

        const forecastList = forecastRes.data.list || [];
        const nowEpoch = Math.floor(Date.now() / 1000);

        const toUsEpa = (owm) => {
            if (owm === 1) return 25;
            if (owm === 2) return 75;
            if (owm === 3) return 125;
            if (owm === 4) return 175;
            if (owm === 5) return 250;
            return 50;
        };

        const targetIntervals = [
            { label: '+3h', offsetSec: 3 * 3600 },
            { label: '+6h', offsetSec: 6 * 3600 },
            { label: '+12h', offsetSec: 12 * 3600 },
            { label: '+48h', offsetSec: 48 * 3600 },
        ];

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
                aqi: closest ? toUsEpa(closest.main.aqi) : usEpaAqi,
                source: 'owm',
                components: closest ? closest.components : null,
                dt: closest ? closest.dt : null,
            };
        });

        // =========================
        // +24h LSTM INTERVAL FIX
        // =========================

        const lstmInterval = {
            label: '+24h',

            // fallback if ML fails
            aqi: mlPrediction?.predicted_aqi ?? usEpaAqi,

            source: mlPrediction ? 'lstm' : 'fallback',

            confidence: mlPrediction?.confidence_interval ?? null,

            dt: nowEpoch + 24 * 3600,
        };

        forecastIntervals.splice(3, 0, lstmInterval);

        console.log('Forecast Intervals:', forecastIntervals);

        // =========================
        // FINAL RESPONSE
        // =========================

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
router.get('/eco-score', async (req, res) => {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
        return res.status(400).json({
            error: 'lat and lon are required'
        });
    }

    try {
        // Fetch live weather + AQI
        const weatherUrl =
            `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=metric`;

        const pollutionUrl =
            `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}`;

        const [weatherRes, pollutionRes] = await Promise.all([
            axios.get(weatherUrl),
            axios.get(pollutionUrl)
        ]);

        const weather = weatherRes.data;
        const pollution = pollutionRes.data.list[0];

        const temp = weather.main.temp;
        const humidity = weather.main.humidity;

        const pm25 = pollution.components.pm2_5 || 0;

        // =========================
        // DYNAMIC AQI SCORE
        // =========================

       let airQualityScore;

if (pm25 <= 30) {
    airQualityScore = 90;
} else if (pm25 <= 60) {
    airQualityScore = 70;
} else if (pm25 <= 90) {
    airQualityScore = 50;
} else if (pm25 <= 120) {
    airQualityScore = 30;
} else {
    airQualityScore = 10;
}
        // =========================
        // DYNAMIC NDVI ESTIMATION
        // =========================

        // Simulated vegetation score based on pollution
       let ndvi = 0.7 - (pm25 / 200);

// Clamp realistic range
ndvi = Math.max(0.1, Math.min(0.9, ndvi));

        // =========================
        // WEATHER SCORE
        // =========================

        let weatherScore = 100;

        // Temperature comfort
       if (temp > 42) {
    weatherScore -= 25;
} else if (temp > 36) {
    weatherScore -= 10;
} else if (temp < 10) {
    weatherScore -= 20;
}
        // Humidity comfort
        if (humidity > 85 || humidity < 20) {
            weatherScore -= 15;
        }

        weatherScore = Math.max(0, weatherScore);

        // =========================
        // FINAL ECO SCORE
        // =========================

        const ecoScore = Math.round(
            airQualityScore * 0.45 +
            weatherScore * 0.30 +
            (ndvi * 100) * 0.25
        );

        // =========================
        // CATEGORY
        // =========================

        let category = 'Poor';

        if (ecoScore >= 80) category = 'Excellent';
        else if (ecoScore >= 60) category = 'Good';
        else if (ecoScore >= 40) category = 'Moderate';
        else if (ecoScore >= 20) category = 'Poor';
        else category = 'Hazardous';

        // =========================
        // RECOMMENDATIONS
        // =========================

        const recommendations = [];

        if (pm25 > 60) {
            recommendations.push(
                'Avoid prolonged outdoor exposure'
            );
        }

        if (temp > 35) {
            recommendations.push(
                'High temperature detected'
            );
        }

        if (ndvi < 0.3) {
            recommendations.push(
                'Low vegetation density nearby'
            );
        }

        if (recommendations.length === 0) {
            recommendations.push(
                'Environmental conditions are favorable'
            );
        }

        // =========================
        // RESPONSE
        // =========================

        res.json({
            score: ecoScore,
            category,
            ndvi: Number((ndvi * 100).toFixed(1)),
            temperature: temp,
            humidity,
            air_quality: Math.round(airQualityScore),
            recommendations
        });

    } catch (error) {
        console.error('Eco-score error:', error.message);

        res.status(500).json({
            error: 'Failed to compute eco-score'
        });
    }
});

module.exports = router;