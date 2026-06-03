import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { getThemeForAQI } from '../utils/theme';
import { fetchAqiData, reverseGeocode } from '../services/aqiService';

const AQIContext = createContext();

export const useAQI = () => useContext(AQIContext);

export const AQIProvider = ({ children }) => {
    const [aqiValue, setAqiValue] = useState(42);
    const [theme, setTheme] = useState(getThemeForAQI(42));
    const [forecastIntervals, setForecastIntervals] = useState(null);
    const [mlPrediction, setMlPrediction] = useState(null);
    const [currentComponents, setCurrentComponents] = useState(null);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [errorData, setErrorData] = useState(null);
    const [locationName, setLocationName] = useState('Unknown Location');
    const [coords, setCoords] = useState({ lat: 0, lon: 0 });
    const [ecoScore, setEcoScore] = useState(null);
    const [weatherData, setWeatherData] = useState(null);

    // Store the user's original geolocation — never changes after first set
    const homeCoords = useRef(null);

    const loadDataForLocation = async (lat, lon) => {
        setIsLoadingData(true);
        setErrorData(null);
        try {
            setCoords({ lat, lon });
            const data = await fetchAqiData(lat, lon);

            setAqiValue(data.usAqi);
            setForecastIntervals(data.forecastIntervals);

            let finalLocationName = data.locationName;
            if (finalLocationName === "Unknown Location") {
                try {
                    finalLocationName = await reverseGeocode(lat, lon);
                } catch (e) {
                    console.error("Geocoding failed", e);
                }
            }
            setLocationName(finalLocationName);

            setMlPrediction(data.mlPrediction);
            setCurrentComponents(data.components);
            setEcoScore(data.ecoScore || null);
            setWeatherData(data.weatherData || null);
        } catch (err) {
            console.error(err);
            setErrorData(err.message);
            setAqiValue(42);
            setMlPrediction(null);
            setCurrentComponents(null);
            setForecastIntervals(null);
            setWeatherData(null);
        } finally {
            setIsLoadingData(false);
        }
    };

    // Set the home coordinates once from geolocation
    const setHomeLocation = (lat, lon) => {
        if (!homeCoords.current) {
            homeCoords.current = { lat, lon };
        }
    };

    // Navigate back to the user's original location
    const goHome = () => {
        if (homeCoords.current) {
            loadDataForLocation(homeCoords.current.lat, homeCoords.current.lon);
        }
    };

    useEffect(() => {
        setTheme(getThemeForAQI(aqiValue));
    }, [aqiValue]);

    const value = {
        aqiValue,
        setAqiValue,
        theme,
        forecastIntervals,
        mlPrediction,
        currentComponents,
        isLoadingData,
        setIsLoadingData,
        errorData,
        setErrorData,
        ecoScore,
        weatherData,
        loadDataForLocation,
        locationName,
        coords,
        homeCoords,
        setHomeLocation,
        goHome,
    };

    return (
        <AQIContext.Provider value={value}>
            {children}
        </AQIContext.Provider>
    );
};
