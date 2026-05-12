import { useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { useAQI } from '../context/AQIContext';

const ALERT_THRESHOLD = 175;

const useAQIAlerts = () => {
    const { aqiValue, forecastIntervals, locationName } = useAQI();
    const lastAlertedAqi = useRef(null);
    const lastAlertedForecast = useRef(null);

    // Alert for current hazardous AQI
    useEffect(() => {
        if (aqiValue == null || aqiValue === lastAlertedAqi.current) return;

        if (aqiValue >= ALERT_THRESHOLD) {
            toast.error(
                `⚠️ Air Quality Alert! AQI is ${aqiValue} in ${locationName}. Limit outdoor activity and wear a mask.`,
                { toastId: `current-aqi-${locationName}` }
            );
            lastAlertedAqi.current = aqiValue;
        }
    }, [aqiValue, locationName]);

    // Alert for predicted dangerous future AQI
    useEffect(() => {
        if (!forecastIntervals || forecastIntervals.length === 0) return;

        const dangerousIntervals = forecastIntervals.filter(
            (item) => item.aqi >= ALERT_THRESHOLD
        );

        if (dangerousIntervals.length === 0) return;

        // Create a fingerprint to avoid duplicate alerts for the same forecast
        const fingerprint = dangerousIntervals.map(d => `${d.label}:${d.aqi}`).join(',');
        if (fingerprint === lastAlertedForecast.current) return;

        const worst = dangerousIntervals.reduce((max, item) =>
            item.aqi > max.aqi ? item : max
        );

        toast.warn(
            `🔮 Forecast Alert! AQI predicted to reach ${worst.aqi} in ${worst.label}. Plan ahead and stay safe.`,
            { toastId: `forecast-aqi-${locationName}` }
        );

        lastAlertedForecast.current = fingerprint;
    }, [forecastIntervals, locationName]);
};

export default useAQIAlerts;
