import React, { useState, useEffect } from 'react';
import { useAQI } from '../context/AQIContext';

const GlassNavbar = ({ onOpenMap }) => {
    const { theme, locationName } = useAQI();
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    return (
        <nav className="glass-navbar">
            <div className="navbar-logo">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
                <span>ClearSky Predictor</span>
            </div>

            <div className="navbar-status" style={{ color: theme.color }}>
                <span className="pulsing-dot" style={{ backgroundColor: theme.color, boxShadow: `0 0 8px ${theme.color}` }}></span>
                Live Status: {theme.label}
            </div>

            <div className="navbar-time">
                <button className="nav-map-btn" onClick={onOpenMap} title="Open Map to Search Locations">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                        <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                    <span>Open Map</span>
                </button>

                <span className="time-text">
                    {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {locationName}
                </span>
            </div>

        </nav>
    );
};

export default GlassNavbar;

