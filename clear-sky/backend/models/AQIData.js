const mongoose = require('mongoose');

const aqiDataSchema = new mongoose.Schema({
    location: {
        lat: { type: Number, required: true },
        lon: { type: Number, required: true },
    },
    timestamp: { type: Date, default: Date.now },
    weather: {
        temp: Number,
        humidity: Number,
        pressure: Number,
        wind_speed: Number,
        wind_deg: Number,
    },
    pollution: {
        aqi: Number,
        co: Number,
        no: Number,
        no2: Number,
        o3: Number,
        so2: Number,
        pm2_5: Number,
        pm10: Number,
        nh3: Number,
    },
    ml_prediction: {
        aqi_tomorrow: Number,
        confidence_lower: Number,
        confidence_upper: Number,
    }
});

// Index for efficient temporal and spatial queries
aqiDataSchema.index({ 'location.lat': 1, 'location.lon': 1, timestamp: -1 });

module.exports = mongoose.model('AQIData', aqiDataSchema);
