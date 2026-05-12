import React, { useState } from 'react';
import GlassLayout from './GlassLayout';
import { useAQI } from '../context/AQIContext';
import AQIInfoModal from './AQIInfoModal';

const AQICard = () => {
    const { theme, aqiValue, currentComponents } = useAQI();
    const [isInfoOpen, setIsInfoOpen] = useState(false);

    return (
        <GlassLayout className="aqi-main-card flex-col-center">
            <div className="aqi-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h2 className="aqi-title">Current Air Quality</h2>
                    <button 
                        className="interactive-info-btn" 
                        onClick={() => setIsInfoOpen(true)}
                        title="Click for detailed pollutant breakdown, AI predictions, and safety recommendations"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="16" x2="12" y2="12"></line>
                            <line x1="12" y1="8" x2="12.01" y2="8"></line>
                        </svg>
                    </button>
                </div>
                <div className="aqi-badge flex-center" style={{ backgroundColor: theme.color, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                    {theme.label}
                </div>
            </div>

            <div className="aqi-value-container">
                <span
                    className="aqi-number"
                    style={{
                        color: theme.color,
                        textShadow: `0 0 30px ${theme.glowColor}, 0 4px 10px rgba(0,0,0,0.3)`
                    }}
                >
                    {aqiValue}
                </span>
                <span className="aqi-unit">AQI US</span>
            </div>

            <div className="aqi-message">
                <p>{theme.message}</p>
            </div>

            {currentComponents ? (
                <div className="aqi-metrics grid-2">
                    <div className="metric-item">
                        <span className="metric-label">PM2.5</span>
                        <span className="metric-value">{currentComponents.pm2_5.toFixed(1)} µg/m³</span>
                    </div>
                    <div className="metric-item">
                        <span className="metric-label">PM10</span>
                        <span className="metric-value">{currentComponents.pm10.toFixed(1)} µg/m³</span>
                    </div>
                    <div className="metric-item">
                        <span className="metric-label">O3</span>
                        <span className="metric-value">{currentComponents.o3.toFixed(1)} µg/m³</span>
                    </div>
                    <div className="metric-item">
                        <span className="metric-label">NO2</span>
                        <span className="metric-value">{currentComponents.no2.toFixed(1)} µg/m³</span>
                    </div>
                </div>
            ) : (
                <div className="aqi-metrics grid-2">
                    <div className="metric-item"><span className="metric-label">PM2.5</span><span className="metric-value">-- µg/m³</span></div>
                    <div className="metric-item"><span className="metric-label">PM10</span><span className="metric-value">-- µg/m³</span></div>
                    <div className="metric-item"><span className="metric-label">O3</span><span className="metric-value">-- µg/m³</span></div>
                    <div className="metric-item"><span className="metric-label">NO2</span><span className="metric-value">-- µg/m³</span></div>
                </div>
            )}
            
            <AQIInfoModal isOpen={isInfoOpen} onClose={() => setIsInfoOpen(false)} />
        </GlassLayout>
    );
};

export default AQICard;

