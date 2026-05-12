import React, { useState, useEffect, useRef } from 'react';
import { searchLocation } from '../services/aqiService';
import { useAQI } from '../context/AQIContext';

const SearchBar = ({ onSelect }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const { loadDataForLocation, theme } = useAQI();
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleInputChange = async (e) => {
        const val = e.target.value;
        setQuery(val);
        if (val.length > 2) {
            try {
                const data = await searchLocation(val);
                setResults(data);
                setIsDropdownOpen(true);
            } catch (err) {
                console.error(err);
            }
        } else {
            setResults([]);
            setIsDropdownOpen(false);
        }
    };

    const handleSelect = (lat, lon, name) => {
        if (onSelect) {
            onSelect(lat, lon, name);
        } else {
            // Fallback to global behavior if used outside MapOverlay
            loadDataForLocation(lat, lon);
        }
        setQuery('');
        setResults([]);
        setIsDropdownOpen(false);
    };


    return (
        <div className="search-container" ref={dropdownRef}>
            <div className="search-input-wrapper">
                <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input
                    type="text"
                    placeholder="Search location..."
                    value={query}
                    onChange={handleInputChange}
                    className="search-input"
                    style={{ '--focus-color': theme.color }}
                />
            </div>
            {isDropdownOpen && results.length > 0 && (
                <div className="search-dropdown glass-panel">
                    {results.map((res, idx) => (
                        <div
                            key={idx}
                            className="search-item"
                            onClick={() => handleSelect(res.lat, res.lon, res.name)}
                        >
                            <span className="item-name">{res.name}</span>
                            <span className="item-details">{res.state ? `${res.state}, ` : ''}{res.country}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SearchBar;
