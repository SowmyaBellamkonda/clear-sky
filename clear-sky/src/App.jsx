import React from 'react';
import { AQIProvider, useAQI } from './context/AQIContext';
import Background from './components/Background';
import GlassNavbar from './components/GlassNavbar';
import AQICard from './components/AQICard';
import ForecastCards from './components/ForecastCards';
import AssistantPanel from './components/AssistantPanel';
import MapOverlay from './components/MapOverlay';
import GreenScorePanel from './components/GreenScorePanel';
import useAQIAlerts from './hooks/useAQIAlerts';
import { AQI_LEVELS } from './utils/theme';
import './index.css';

const Dashboard = () => {
  const { loadDataForLocation, isLoadingData, setIsLoadingData, errorData, setErrorData, setHomeLocation, theme } = useAQI();
  const [isMapOpen, setIsMapOpen] = React.useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = React.useState(false);

  // Activate toast alerts for hazardous AQI
  useAQIAlerts();

  React.useEffect(() => {
    setIsLoadingData(true);

    if (!("geolocation" in navigator)) {
      setErrorData("Geolocation not supported. Please use 'Open Map' to search for your city.");
      setIsLoadingData(false);
      return;
    }

    const onSuccess = (position) => {
      const { latitude, longitude, accuracy } = position.coords;
      console.log(`📍 Geolocation: lat=${latitude}, lon=${longitude}, accuracy=${(accuracy / 1000).toFixed(1)}km`);
      setHomeLocation(latitude, longitude);
      loadDataForLocation(latitude, longitude);
    };

    const onFinalError = (error) => {
      console.error("Geolocation failed completely:", error.message);
      setErrorData("Could not detect your location. Please click 'Open Map' and search for your city.");
      setIsLoadingData(false);
    };

    // Step 1: Try high accuracy (GPS/WiFi) — fast timeout
    navigator.geolocation.getCurrentPosition(
      onSuccess,
      (highAccError) => {
        console.warn("High-accuracy geolocation failed:", highAccError.message, "— retrying with low accuracy...");
        // Step 2: Fallback to low accuracy (IP-based) — longer timeout
        navigator.geolocation.getCurrentPosition(
          onSuccess,
          onFinalError,
          { enableHighAccuracy: false, maximumAge: 300000, timeout: 15000 }
        );
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
    );
  }, []);

  return (
    <div className="app-container">
      <Background />
      {/* Search has been moved to map modal, map toggled from Navbar now */}
      <GlassNavbar onOpenMap={() => setIsMapOpen(true)} />

      {isMapOpen && <MapOverlay onClose={() => setIsMapOpen(false)} />}

      <main className="dashboard-main">
        <div className="dashboard-grid fade-in">
          <div className="main-column">
            {isLoadingData ? (
              <div className="glass-panel flex-center" style={{ height: '300px' }}>
                <h3>Loading real-time air quality data...</h3>
              </div>
            ) : errorData ? (
              <div className="glass-panel flex-center" style={{ height: '300px', backgroundColor: 'rgba(239, 68, 68, 0.2)' }}>
                <h3>Error loading data: {errorData}</h3>
              </div>
            ) : (
              <AQICard />
            )}
            <h3 className="section-title">AQI Forecast</h3>
            <ForecastCards />
          </div>
          <div className="side-column fade-in-up" style={{ animationDelay: '0.2s' }}>
            <GreenScorePanel />
          </div>
        </div>
      </main>

      {/* Floating Assistant Panel Component */}
      <AssistantPanel isOpen={isAssistantOpen} onClose={() => setIsAssistantOpen(false)} />

      {/* Floating Action Button */}
      <button 
        className={`floating-assistant-btn ${isAssistantOpen ? 'hidden' : ''}`}
        onClick={() => setIsAssistantOpen(true)}
        title="Open AI Assistant"
        style={{ 
           backgroundColor: theme?.color ? `${theme.color}CC` : 'rgba(255, 255, 255, 0.1)', 
           borderColor: theme?.color || 'rgba(255, 255, 255, 0.2)',
           boxShadow: theme?.glow ? `0 0 15px ${theme.glow}` : '0 4px 15px rgba(0, 0, 0, 0.3)'
        }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="10" rx="2" />
          <circle cx="12" cy="5" r="2" />
          <path d="M12 7v4M8 16h.01M16 16h.01" />
        </svg>
      </button>
    </div>
  );
};


const App = () => {
  return (
    <AQIProvider>
      <Dashboard />
    </AQIProvider>
  );
};

export default App;
