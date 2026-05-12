const axios = require('axios');

async function testML() {
    try {
        const payload = {
            history: Array.from({ length: 7 }).map((_, i) => ({
                pm2_5: 15, pm10: 20, no2: 10, so2: 5, co: 20, o3: 30,
                temperature: 20, humidity: 50, wind_speed: 5, wind_direction: 180,
                pressure: 1013, day_of_week: i, month: 3, aqi: 50
            }))
        };
        const res = await axios.post('http://localhost:8000/predict', payload);
        console.log("Success:", res.data);
    } catch (e) {
        console.error("Error from ML Service:", e.response ? e.response.data : e.message);
    }
}
testML();
