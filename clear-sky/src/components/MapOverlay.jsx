import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';
import GlassLayout from './GlassLayout';
import SearchBar from './SearchBar';
import { useAQI } from '../context/AQIContext';
import { fetchAqiData, fetchAqiDataReadonly } from '../services/aqiService';

const API_KEY = import.meta.env.VITE_OWM_API_KEY;
const BACKEND_URL = 'http://localhost:5000/api';

const getAqiColor = (aqi) => {
    if (aqi <= 50) return '#10b981';
    if (aqi <= 100) return '#f59e0b';
    if (aqi <= 200) return '#ef4444';
    return '#8b5cf6';
};

// ---- Sub-components ----

function ChangeView({ center, zoom }) {
    const map = useMap();
    useEffect(() => { map.flyTo(center, zoom, { duration: 1.5 }); }, [center, zoom]);
    return null;
}

function MapClickHandler({ onDoubleClick }) {
    useMapEvents({ dblclick(e) { onDoubleClick(e.latlng.lat, e.latlng.lng); } });
    return null;
}

function AQIHeatmapLayer({ points, visible }) {
    const map = useMap();
    const layerRef = useRef(null);

    useEffect(() => {
        if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; }
        if (!visible || points.length === 0) return;

        const heatData = points.map(p => [
            parseFloat(p.lat), parseFloat(p.lon),
            Math.min((p.aqi || 0) / 400, 1.0),
        ]);

        layerRef.current = L.heatLayer(heatData, {
            radius: 40, blur: 30, maxZoom: 14, max: 1.0, minOpacity: 0.3,
            gradient: {
                0.0: '#00e400', 0.15: '#92d050', 0.25: '#ffff00',
                0.4: '#ff7e00', 0.55: '#ff0000', 0.7: '#99004c',
                0.85: '#7e0023', 1.0: '#4c0026',
            },
        }).addTo(map);

        return () => { if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; } };
    }, [points, visible, map]);

    return null;
}

const HeatmapLegend = () => (
    <div style={{
        position: 'absolute', bottom: '60px', left: '12px', zIndex: 1000,
        padding: '10px 12px', borderRadius: '12px', background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(8px)', fontSize: '0.65rem', color: 'white',
        display: 'flex', flexDirection: 'column', gap: '4px',
    }}>
        <span style={{ fontWeight: 600, marginBottom: '2px', fontSize: '0.7rem' }}>AQI Scale</span>
        {[
            { color: '#00e400', label: '0-50 Good' },
            { color: '#ffff00', label: '51-100 Moderate' },
            { color: '#ff7e00', label: '101-150 USG' },
            { color: '#ff0000', label: '151-200 Unhealthy' },
            { color: '#99004c', label: '201-300 V. Unhealthy' },
            { color: '#7e0023', label: '301+ Hazardous' },
        ].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: color, flexShrink: 0 }} />
                <span>{label}</span>
            </div>
        ))}
    </div>
);

// ---- Map base layers ----
const MAP_LAYERS = {
    standard: {
        label: 'Standard',
        url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        attribution: '&copy; OpenStreetMap &copy; CARTO',
    },
    satellite: {
        label: 'Satellite',
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attribution: '&copy; Esri, Maxar',
    },
    dark: {
        label: 'Dark',
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        attribution: '&copy; OpenStreetMap &copy; CARTO',
    },
};

const LayerSwitcher = ({ activeLayer, onChange }) => (
    <div style={{
        position: 'absolute', top: '12px', right: '12px', zIndex: 1000,
        display: 'flex', gap: '4px', borderRadius: '10px',
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', padding: '4px',
    }}>
        {Object.entries(MAP_LAYERS).map(([key, layer]) => (
            <button key={key} onClick={() => onChange(key)} style={{
                padding: '6px 12px', fontSize: '0.7rem', fontWeight: 500,
                border: 'none', borderRadius: '8px', cursor: 'pointer',
                background: activeLayer === key ? 'rgba(255,255,255,0.25)' : 'transparent',
                color: 'white', transition: 'background 0.2s',
            }}>
                {layer.label}
            </button>
        ))}
    </div>
);

// ---- Main Component ----

const MapOverlay = ({ onClose }) => {
    const { theme, aqiValue, coords, locationName, loadDataForLocation, goHome } = useAQI();

    const [mapLocations, setMapLocations] = useState([
        { id: 'user-current', name: locationName || 'My Location', aqi: aqiValue, coords: [coords.lat, coords.lon], isCurrent: true }
    ]);
    const [selectedLocation, setSelectedLocation] = useState(null);
    const [mapCenter, setMapCenter] = useState([coords.lat, coords.lon]);
    const [isSearching, setIsSearching] = useState(false);
    const [showHeatmap, setShowHeatmap] = useState(false);
    const [heatmapPoints, setHeatmapPoints] = useState([]);
    const [activeLayer, setActiveLayer] = useState('standard');

    const customIcon = new L.Icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
    });

    useEffect(() => {
        if (mapLocations.length > 0 && !selectedLocation) setSelectedLocation(mapLocations[0]);
    }, [mapLocations]);

    // Fetch real world city AQI data for heatmap
    useEffect(() => {
        if (!showHeatmap) return;
        fetch(`${BACKEND_URL}/world-aqi`)
            .then(r => r.json())
            .then(data => {
                const cities = (data.cities || []).map(c => ({ lat: c.lat, lon: c.lon, aqi: c.aqi, name: c.name }));
                // Also include sidebar locations
                const sidebarPoints = mapLocations.map(l => ({ lat: l.coords[0], lon: l.coords[1], aqi: l.aqi }));
                setHeatmapPoints([...cities, ...sidebarPoints]);
            })
            .catch((err) => {
                console.error('World AQI fetch error:', err);
                const sidebarPoints = mapLocations.map(l => ({ lat: l.coords[0], lon: l.coords[1], aqi: l.aqi }));
                setHeatmapPoints(sidebarPoints);
            });
    }, [showHeatmap, mapLocations]);

    // Search → saves to MongoDB + updates dashboard
    const handleSearchSelect = async (lat, lon, name) => {
        setIsSearching(true);
        try {
            const data = await fetchAqiData(lat, lon);
            const newLoc = { id: `search-${Date.now()}`, name, aqi: data.usAqi, coords: [lat, lon], isCurrent: false };
            setMapLocations(prev => [newLoc, ...prev]);
            setSelectedLocation(newLoc);
            setMapCenter([lat, lon]);
            loadDataForLocation(lat, lon);
        } catch (error) {
            const fb = { id: `s-${Date.now()}-fail`, name: name + " (Unavailable)", aqi: 0, coords: [lat, lon], isCurrent: false };
            setMapLocations(prev => [fb, ...prev]);
            setSelectedLocation(fb);
            setMapCenter([lat, lon]);
        } finally { setIsSearching(false); }
    };

    // Double-click → readonly (does NOT save to MongoDB)
    const handleMapDoubleClick = async (lat, lon) => {
        setIsSearching(true);
        try {
            const data = await fetchAqiDataReadonly(lat, lon);
            const newLoc = {
                id: `click-${Date.now()}`,
                name: data.locationName || `${lat.toFixed(3)}, ${lon.toFixed(3)}`,
                aqi: data.usAqi,
                coords: [lat, lon],
                isCurrent: false
            };
            setMapLocations(prev => [newLoc, ...prev]);
            setSelectedLocation(newLoc);
            setMapCenter([lat, lon]);
        } catch (error) {
            console.error("Click fetch error:", error);
        } finally { setIsSearching(false); }
    };

    const handleSidebarClick = (loc) => {
        setSelectedLocation(loc);
        setMapCenter(loc.coords);
        loadDataForLocation(loc.coords[0], loc.coords[1]);
    };

    const handleRemoveLocation = (e, locId) => {
        e.stopPropagation();
        setMapLocations(prev => prev.filter(l => l.id !== locId));
        if (selectedLocation?.id === locId) {
            const remaining = mapLocations.filter(l => l.id !== locId);
            if (remaining.length > 0) {
                setSelectedLocation(remaining[0]);
                setMapCenter(remaining[0].coords);
                loadDataForLocation(remaining[0].coords[0], remaining[0].coords[1]);
            }
        }
    };

    const handleGoHome = () => {
        const home = mapLocations.find(l => l.isCurrent);
        if (home) { setSelectedLocation(home); setMapCenter(home.coords); }
        goHome();
    };

    const pollutionTileUrl = `https://tile.openweathermap.org/map/pm2_5_new/{z}/{x}/{y}.png?appid=${API_KEY}`;
    const currentLayer = MAP_LAYERS[activeLayer];

    return (
        <div className="map-overlay-backdrop flex-center">
            <GlassLayout className="map-modal flex-col">
                <div className="modal-header map-modal-header-row">
                    <h2>Interactive Air Quality Map</h2>
                    <div className="map-search-wrapper" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <SearchBar onSelect={handleSearchSelect} />

                        {/* Heatmap toggle */}
                        <button
                            className="glass-btn"
                            onClick={() => setShowHeatmap(!showHeatmap)}
                            title="Toggle AQI Heatmap for Major World Cities"
                            style={{
                                padding: '8px 12px', display: 'flex', gap: '6px', alignItems: 'center',
                                ...(showHeatmap ? { background: 'rgba(239, 68, 68, 0.25)', borderColor: 'rgba(239, 68, 68, 0.5)' } : {}),
                            }}
                        >
                            ▲
                            <span style={{ fontSize: '0.75rem' }}>Heatmap</span>
                        </button>

                        {/* My Location */}
                        <button
                            className="glass-btn locate-me-btn"
                            onClick={handleGoHome}
                            title="Return to My Location"
                            style={{ padding: '8px 12px', display: 'flex', gap: '6px', alignItems: 'center' }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" />
                            </svg>
                            My Location
                        </button>
                    </div>
                    <button className="close-btn" onClick={onClose} title="Close Map">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                <div className="map-content">
                    <div className="map-sidebar">
                        <h3>Locations</h3>
                        {isSearching && <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>Fetching AQI...</p>}
                        <ul className="location-list">
                            {mapLocations.map((loc) => {
                                const isActive = selectedLocation?.id === loc.id;
                                return (
                                    <li
                                        key={loc.id}
                                        className={`location-item ${isActive ? 'active' : ''}`}
                                        style={{ borderLeft: `3px solid ${getAqiColor(loc.aqi)}`, cursor: 'pointer' }}
                                        onClick={() => handleSidebarClick(loc)}
                                    >
                                        <div className="loc-info">
                                            <span className="loc-name">
                                                {loc.isCurrent ? '📍 ' : ''}{loc.name}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span className="loc-badge flex-center" style={{ backgroundColor: getAqiColor(loc.aqi), color: 'white' }}>
                                                {loc.aqi} AQI
                                            </span>
                                            {!loc.isCurrent && (
                                                <button
                                                    onClick={(e) => handleRemoveLocation(e, loc.id)}
                                                    title="Remove location"
                                                    style={{
                                                        background: 'rgba(239, 68, 68, 0.2)',
                                                        border: '1px solid rgba(239, 68, 68, 0.4)',
                                                        borderRadius: '6px', color: '#ef4444',
                                                        cursor: 'pointer', width: '24px', height: '24px',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        padding: 0, fontSize: '14px', lineHeight: 1, flexShrink: 0,
                                                        transition: 'background 0.2s',
                                                    }}
                                                    onMouseEnter={(e) => e.target.style.background = 'rgba(239, 68, 68, 0.4)'}
                                                    onMouseLeave={(e) => e.target.style.background = 'rgba(239, 68, 68, 0.2)'}
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>

                    <div className="map-placeholder" style={{ borderColor: theme.color, position: 'relative' }}>
                        <MapContainer
                            center={mapCenter}
                            zoom={12}
                            doubleClickZoom={false}
                            style={{ height: "100%", width: "100%", borderRadius: '0 0 24px 0' }}
                        >
                            <ChangeView center={mapCenter} zoom={12} />
                            <MapClickHandler onDoubleClick={handleMapDoubleClick} />

                            <TileLayer key={activeLayer} url={currentLayer.url} attribution={currentLayer.attribution} />

                            {/* OWM PM2.5 pollution tile — always on */}
                            <TileLayer url={pollutionTileUrl} opacity={activeLayer === 'dark' ? 0.7 : 0.6} />

                            {/* AQI heatmap from real world city data — toggle */}
                            <AQIHeatmapLayer points={heatmapPoints} visible={showHeatmap} />

                            {mapLocations.map((loc) => {
                                const aqiColor = getAqiColor(loc.aqi);
                                return (
                                    <React.Fragment key={loc.id}>
                                        <Marker position={loc.coords} icon={customIcon}>
                                            <Popup><b>{loc.name}</b><br />AQI: {loc.aqi}</Popup>
                                        </Marker>
                                        <Circle
                                            center={loc.coords}
                                            pathOptions={{ fillColor: aqiColor, color: aqiColor, weight: 1, fillOpacity: 0.3 }}
                                            radius={3000}
                                        />
                                    </React.Fragment>
                                );
                            })}
                        </MapContainer>

                        <LayerSwitcher activeLayer={activeLayer} onChange={setActiveLayer} />
                        {showHeatmap && <HeatmapLegend />}

                        <div className="map-status-overlay glass-panel">
                            <h4>{selectedLocation?.name || 'Select a location'}</h4>
                            <p>AQI: {selectedLocation?.aqi ?? '--'}</p>
                            <p style={{ fontSize: '0.7rem', opacity: 0.6 }}>
                                {currentLayer.label}{showHeatmap ? ' • Heatmap' : ''}
                            </p>
                        </div>
                    </div>
                </div>
            </GlassLayout>
        </div>
    );
};

export default MapOverlay;
