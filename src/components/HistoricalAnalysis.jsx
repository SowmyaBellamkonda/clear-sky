import React, { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { useAQI } from '../context/AQIContext';
import { fetchHistoricalData } from '../services/aqiService';

// Helper to determine pollutant level status and HSL colors
const getPollutantStatus = (pollutant, value) => {
  const num = parseFloat(value);
  if (isNaN(num)) return { label: 'Unknown', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)' };

  if (pollutant === 'pm25') {
    if (num <= 12) return { label: 'Good', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' };
    if (num <= 35) return { label: 'Moderate', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.15)' };
    if (num <= 55) return { label: 'Sensitive', color: '#f97316', bg: 'rgba(249, 115, 22, 0.15)' };
    return { label: 'Unhealthy', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' };
  }
  if (pollutant === 'pm10') {
    if (num <= 54) return { label: 'Good', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' };
    if (num <= 154) return { label: 'Moderate', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.15)' };
    return { label: 'Unhealthy', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' };
  }
  if (pollutant === 'no2') {
    if (num <= 40) return { label: 'Good', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' };
    if (num <= 80) return { label: 'Moderate', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.15)' };
    return { label: 'Unhealthy', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' };
  }
  if (pollutant === 'o3') {
    if (num <= 50) return { label: 'Good', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' };
    if (num <= 100) return { label: 'Moderate', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.15)' };
    return { label: 'Unhealthy', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' };
  }
  if (pollutant === 'co') {
    if (num <= 4000) return { label: 'Good', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' };
    if (num <= 9000) return { label: 'Moderate', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.15)' };
    return { label: 'Unhealthy', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' };
  }
  if (pollutant === 'so2') {
    if (num <= 20) return { label: 'Good', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' };
    if (num <= 80) return { label: 'Moderate', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.15)' };
    return { label: 'Unhealthy', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' };
  }
  return { label: 'Normal', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' };
};

const pollutantColors = {
  pm25: '#f97316', // Orange
  pm10: '#10b981', // Green
  no2: '#8b5cf6', // Purple
  o3: '#ef4444', // Red
  co: '#06b6d4', // Cyan
  so2: '#eab308'  // Yellow
};

const pollutantLabels = {
  pm25: 'PM2.5',
  pm10: 'PM10',
  no2: 'NO2',
  o3: 'O3',
  co: 'CO',
  so2: 'SO2'
};

const pollutantFullNames = {
  pm25: 'Fine Particulates (PM2.5)',
  pm10: 'Coarse Dust (PM10)',
  no2: 'Nitrogen Dioxide (NO2)',
  o3: 'Ground-level Ozone (O3)',
  co: 'Carbon Monoxide (CO)',
  so2: 'Sulfur Dioxide (SO2)'
};

const CustomTooltip = ({ active, payload, label, activePollutant }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: '12px',
        padding: '12px 16px',
        color: 'white',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.7)',
        fontFamily: 'Inter, sans-serif'
      }}>
        <p style={{ margin: '0 0 8px 0', fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>{label}</p>
        {payload.map((pld, index) => {
          const currentKey = activePollutant || pld.dataKey;
          const status = getPollutantStatus(currentKey, pld.value);
          const isCo = currentKey === 'co';
          const valDisplay = isCo ? parseFloat(pld.value).toFixed(0) : parseFloat(pld.value).toFixed(1);
          const unit = isCo ? 'µg/m³' : 'µg/m³';
          return (
            <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: pld.color || pollutantColors[currentKey] }}></span>
                  <span style={{ fontWeight: 500, fontSize: '0.9rem', color: '#f8fafc' }}>{pollutantLabels[currentKey]}</span>
                </span>
                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f8fafc' }}>
                  {valDisplay} <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#94a3b8' }}>{unit}</span>
                </span>
              </div>
              <span style={{ fontSize: '0.75rem', color: status.color, alignSelf: 'flex-start', marginLeft: '16px', fontWeight: 600 }}>
                {status.label} Level
              </span>
            </div>
          );
        })}
      </div>
    );
  }
  return null;
};

const HistoricalAnalysis = () => {
  const { weatherData, isLoadingData } = useAQI();
  const [historyData, setHistoryData] = useState([]);
  const [timeframe, setTimeframe] = useState('7days');
  const [isFetching, setIsFetching] = useState(false);
  const [stats, setStats] = useState({});
  const [activePollutant, setActivePollutant] = useState('pm25');

  useEffect(() => {
    if (weatherData && weatherData.coord) {
      loadHistory(weatherData.coord.lat, weatherData.coord.lon, timeframe);
    }
  }, [weatherData, timeframe]);

  const loadHistory = async (lat, lon, period) => {
    setIsFetching(true);
    try {
      const data = await fetchHistoricalData(lat, lon, period);
      if (data && data.results) {
        processHistoricalData(data.results);
      }
    } catch (error) {
      console.error('Error fetching historical data:', error);
    } finally {
      setIsFetching(false);
    }
  };

  const processHistoricalData = (data) => {
      const processed = [];
      const newStats = {
          pm25: { sum: 0, count: 0, min: Infinity, max: -Infinity },
          pm10: { sum: 0, count: 0, min: Infinity, max: -Infinity },
          no2: { sum: 0, count: 0, min: Infinity, max: -Infinity },
          so2: { sum: 0, count: 0, min: Infinity, max: -Infinity },
          co: { sum: 0, count: 0, min: Infinity, max: -Infinity },
          o3: { sum: 0, count: 0, min: Infinity, max: -Infinity }
      };

      const groupedByDate = data.reduce((acc, curr) => {
          if(!curr.date) return acc;
          const dateStr = curr.date.local.split('T')[0];
          if (!acc[dateStr]) {
            acc[dateStr] = {
                date: dateStr,
                pm25: 0, pm25_count: 0,
                pm10: 0, pm10_count: 0,
                no2: 0, no2_count: 0,
                so2: 0, so2_count: 0,
                co: 0, co_count: 0,
                o3: 0, o3_count: 0
            };
          }

          const param = curr.parameter;
          const value = curr.value;
          
          if(param === 'pm25') {
            acc[dateStr].pm25 += value;
            acc[dateStr].pm25_count += 1;
            newStats.pm25.sum += value;
            newStats.pm25.count += 1;
            newStats.pm25.min = Math.min(newStats.pm25.min, value);
            newStats.pm25.max = Math.max(newStats.pm25.max, value);
          } else if(param === 'pm10') {
              acc[dateStr].pm10 += value;
              acc[dateStr].pm10_count += 1;
              newStats.pm10.sum += value;
              newStats.pm10.count += 1;
              newStats.pm10.min = Math.min(newStats.pm10.min, value);
              newStats.pm10.max = Math.max(newStats.pm10.max, value);
          } else if(param === 'no2') {
                acc[dateStr].no2 += value;
                acc[dateStr].no2_count += 1;
                newStats.no2.sum += value;
                newStats.no2.count += 1;
                newStats.no2.min = Math.min(newStats.no2.min, value);
                newStats.no2.max = Math.max(newStats.no2.max, value);
          } else if(param === 'so2') {
                acc[dateStr].so2 += value;
                acc[dateStr].so2_count += 1;
                newStats.so2.sum += value;
                newStats.so2.count += 1;
                newStats.so2.min = Math.min(newStats.so2.min, value);
                newStats.so2.max = Math.max(newStats.so2.max, value);
          } else if(param === 'co') {
                acc[dateStr].co += value;
                acc[dateStr].co_count += 1;
                newStats.co.sum += value;
                newStats.co.count += 1;
                newStats.co.min = Math.min(newStats.co.min, value);
                newStats.co.max = Math.max(newStats.co.max, value);
          } else if(param === 'o3') {
                acc[dateStr].o3 += value;
                acc[dateStr].o3_count += 1;
                newStats.o3.sum += value;
                newStats.o3.count += 1;
                newStats.o3.min = Math.min(newStats.o3.min, value);
                newStats.o3.max = Math.max(newStats.o3.max, value);
          }

          return acc;
      }, {});

      for(const k in groupedByDate) {
          processed.push({
              date: groupedByDate[k].date,
              pm25: groupedByDate[k].pm25_count > 0 ? (groupedByDate[k].pm25 / groupedByDate[k].pm25_count) : null,
              pm10: groupedByDate[k].pm10_count > 0 ? (groupedByDate[k].pm10 / groupedByDate[k].pm10_count) : null,
              no2: groupedByDate[k].no2_count > 0 ? (groupedByDate[k].no2 / groupedByDate[k].no2_count) : null,
              so2: groupedByDate[k].so2_count > 0 ? (groupedByDate[k].so2 / groupedByDate[k].so2_count) : null,
              co: groupedByDate[k].co_count > 0 ? (groupedByDate[k].co / groupedByDate[k].co_count) : null,
              o3: groupedByDate[k].o3_count > 0 ? (groupedByDate[k].o3 / groupedByDate[k].o3_count) : null,
          });
      }

      processed.sort((a,b) => new Date(a.date) - new Date(b.date));
      setHistoryData(processed);

      for(const p in newStats) {
          newStats[p].avg = newStats[p].count > 0 ? (newStats[p].sum / newStats[p].count).toFixed(1) : 0;
      }
      setStats(newStats);
  };

  const getInsight = () => {
    if (!historyData.length || !stats[activePollutant]) return null;
    const item = stats[activePollutant];
    const avg = parseFloat(item.avg);
    const maxVal = item.max !== -Infinity ? parseFloat(item.max).toFixed(1) : 'N/A';
    const minVal = item.min !== Infinity ? parseFloat(item.min).toFixed(1) : 'N/A';
    
    // Find min and max days
    const maxDayObj = historyData.find(d => d[activePollutant] != null && parseFloat(d[activePollutant]).toFixed(1) === maxVal);
    const minDayObj = historyData.find(d => d[activePollutant] != null && parseFloat(d[activePollutant]).toFixed(1) === minVal);

    const formatDay = (dateStr) => {
      if(!dateStr) return 'N/A';
      return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    };

    const maxDay = maxDayObj ? formatDay(maxDayObj.date) : 'N/A';
    const minDay = minDayObj ? formatDay(minDayObj.date) : 'N/A';
    
    const status = getPollutantStatus(activePollutant, avg);

    const insights = {
      pm25: {
        good: "PM2.5 concentrations are low and healthy. Outdoor sports, window ventilation, and jogs are fully safe.",
        moderate: "PM2.5 is moderate. People with asthma or respiratory sensitivity should watch out for dry coughs.",
        unhealthy: "High PM2.5 levels detected. Close windows, run air purifiers, and wear mask filters outdoors."
      },
      pm10: {
        good: "PM10 dust is within safe parameters. Perfect air quality for running or outdoor tasks.",
        moderate: "Dust levels (PM10) are moderate. You might notice dry eyes in dusty traffic sections.",
        unhealthy: "Dust PM10 is high. Avoid long exposure to heavy winds, and consider cleaning indoor vents."
      },
      no2: {
        good: "NO2 exhaust is clean. Standard traffic emissions are having almost zero impact on you.",
        moderate: "NO2 level is moderate. Normal urban background environment.",
        unhealthy: "Vehicular exhaust (NO2) is heavy. Sensitive groups should stay away from congested freeways."
      },
      o3: {
        good: "Ozone levels are low. Photochemical smog is minimal, breathing is perfectly comfortable.",
        moderate: "Ozone levels are moderate. Tends to peak under hot solar afternoons.",
        unhealthy: "Ozone levels are elevated. High ozone causes lung irritation. Prefer staying inside during late afternoons."
      },
      co: {
        good: "Carbon monoxide is completely safe.",
        moderate: "CO is moderate. Ensure indoor kitchens and ventilation are working properly.",
        unhealthy: "Elevated carbon monoxide levels. Open windows to circulate fresh indoor air."
      },
      so2: {
        good: "Sulfur dioxide is low and clean.",
        moderate: "SO2 is moderate. Minor background industrial components.",
        unhealthy: "High SO2 detected. Industrial fuel exhaust has risen. Restrict outdoor workouts."
      }
    };

    const statusMap = {
      'Good': { text: 'Good (Healthy)', color: '#10b981' },
      'Moderate': { text: 'Moderate (Acceptable)', color: '#fbbf24' },
      'Sensitive': { text: 'Sensitive Groups Risk', color: '#f97316' },
      'Unhealthy': { text: 'Unhealthy Alert', color: '#ef4444' }
    };

    const currentInsight = insights[activePollutant]?.[status.label.toLowerCase() === 'good' ? 'good' : status.label.toLowerCase() === 'moderate' ? 'moderate' : 'unhealthy'];

    return {
      avg: avg.toFixed(1),
      max: maxVal,
      min: minVal,
      maxDay,
      minDay,
      label: pollutantLabels[activePollutant],
      fullName: pollutantFullNames[activePollutant],
      statusColor: status.color,
      statusLabel: statusMap[status.label]?.text || status.label,
      insightText: currentInsight
    };
  };

  if (isLoadingData) {
    return (
      <div className="glass-panel flex-center" style={{ minHeight: '350px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '20px', padding: '30px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <div style={{ textAlign: 'center', color: '#94a3b8' }}>
          <div className="spinner" style={{ border: '4px solid rgba(255,255,255,0.1)', borderTop: '4px solid #10b981', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite', margin: '0 auto 20px auto' }}></div>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          <h3>Analyzing historical data trends...</h3>
        </div>
      </div>
    );
  }

  if (!weatherData) return null;

  const currentInsight = getInsight();

  return (
    <div className="historical-analysis-panel glass-panel" style={{
      background: 'rgba(15, 23, 42, 0.4)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '24px',
      padding: '30px',
      color: 'white',
      marginTop: '30px',
      boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.5)',
      fontFamily: 'Inter, sans-serif'
    }}>
      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px', marginBottom: '25px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 700, margin: '0 0 5px 0', background: 'linear-gradient(135deg, #f8fafc 0%, #cbd5e1 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Historical Analysis Dashboard
          </h2>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.95rem' }}>
            Explore air pollutant data trends and timeline profiles for <strong>{weatherData.name || "selected coordinates"}</strong>.
          </p>
        </div>
        
        {/* Timeframe Pill Selectors */}
        <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.05)', padding: '4px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
          {['7days', '30days', '12months'].map((t) => (
            <button
              key={t}
              onClick={() => setTimeframe(t)}
              style={{
                padding: '8px 18px',
                background: timeframe === t ? '#10b981' : 'transparent',
                color: timeframe === t ? '#ffffff' : '#94a3b8',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: timeframe === t ? '0 4px 12px rgba(16, 185, 129, 0.3)' : 'none'
              }}
            >
              {t === '7days' ? 'Last 7 Days' : t === '30days' ? '30 Days' : '1 Year'}
            </button>
          ))}
        </div>
      </div>

      {isFetching ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
          <div className="spinner" style={{ border: '4px solid rgba(255,255,255,0.1)', borderTop: '4px solid #10b981', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite', marginBottom: '15px' }}></div>
          <p style={{ color: '#94a3b8', fontSize: '0.95rem' }}>Fetching historical database records...</p>
        </div>
      ) : historyData.length > 0 ? (
        <>
          {/* Pollutant Tabs Picker Row */}
          <div style={{ display: 'flex', overflowX: 'auto', gap: '14px', marginBottom: '28px', paddingBottom: '6px' }} className="pollutant-tabs-scroll">
            {['pm25', 'pm10', 'no2', 'o3', 'co', 'so2'].map((pollutant) => {
              const active = activePollutant === pollutant;
              const col = pollutantColors[pollutant];
              const value = stats[pollutant]?.avg || 0;
              const status = getPollutantStatus(pollutant, value);
              return (
                <div
                  key={pollutant}
                  onClick={() => setActivePollutant(pollutant)}
                  style={{
                    flex: '1 1 140px',
                    minWidth: '130px',
                    background: active ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                    border: active ? `2px solid ${col}` : '2px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: '16px',
                    padding: '12px 16px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    textAlign: 'center',
                    boxShadow: active ? `0 0 15px ${col}26` : 'none',
                    transform: active ? 'translateY(-2px)' : 'none'
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.borderColor = `${col}80`;
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)';
                  }}
                >
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>
                    {pollutantLabels[pollutant]}
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, margin: '2px 0', display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: '4px' }}>
                    {parseFloat(value).toFixed(0)}
                    <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#64748b' }}>µg/m³</span>
                  </div>
                  <span style={{
                    display: 'inline-block',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color: status.color,
                    background: status.bg,
                    padding: '2px 8px',
                    borderRadius: '6px',
                    marginTop: '4px'
                  }}>
                    {status.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Core Dashboard Visualizers - Side-by-Side Flex Layout */}
          <div style={{ display: 'flex', gap: '28px', flexWrap: 'wrap' }}>
            
            {/* LEFT COLUMN: Main Selected Pollutant Area Curve Chart */}
            <div style={{
              flex: '1 1 550px',
              height: '420px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              padding: '22px',
              borderRadius: '20px',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#f1f5f9' }}>
                  {pollutantFullNames[activePollutant]} Trend Profile
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#64748b', background: 'rgba(255,255,255,0.04)', padding: '3px 8px', borderRadius: '6px' }}>
                  Daily Averages
                </span>
              </div>
              <div style={{ flexGrow: 1, width: '100%', height: '80%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={historyData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                    <defs>
                      <linearGradient id={`colorGrad-${activePollutant}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={pollutantColors[activePollutant]} stopOpacity={0.4}/>
                        <stop offset="95%" stopColor={pollutantColors[activePollutant]} stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                      tickFormatter={(d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    />
                    <YAxis
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => val.toFixed(0)}
                    />
                    <Tooltip content={<CustomTooltip activePollutant={activePollutant} />} />
                    <Area
                      type="monotone"
                      dataKey={activePollutant}
                      stroke={pollutantColors[activePollutant]}
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill={`url(#colorGrad-${activePollutant})`}
                      name={pollutantLabels[activePollutant]}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* RIGHT COLUMN: Comparative PM2.5/PM10 Bar Chart + Insights Card */}
            <div style={{
              flex: '1 1 380px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}>
              
              {/* Insight Card */}
              {currentInsight && (
                <div style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  padding: '20px',
                  borderRadius: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.2rem' }}>💡</span>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f1f5f9' }}>
                      Air Quality Analyst Insight
                    </span>
                  </div>

                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.5', minHeight: '40px' }}>
                    {currentInsight.insightText}
                  </p>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '10px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                    paddingTop: '12px',
                    marginTop: '4px'
                  }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '2px' }}>Average</div>
                      <div style={{ fontSize: '1rem', fontWeight: 700, color: currentInsight.statusColor }}>
                        {currentInsight.avg}
                      </div>
                    </div>
                    <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(255, 255, 255, 0.06)', borderRight: '1px solid rgba(255, 255, 255, 0.06)' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '2px' }}>Cleanest</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#10b981' }}>{currentInsight.min}</div>
                      <div style={{ fontSize: '0.65rem', color: '#64748b' }}>{currentInsight.minDay}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '2px' }}>Peak</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ef4444' }}>{currentInsight.max}</div>
                      <div style={{ fontSize: '0.65rem', color: '#64748b' }}>{currentInsight.maxDay}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Multi-pollutant Bar Chart for PM2.5 vs PM10 Comparison */}
              <div style={{
                flexGrow: 1,
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                padding: '20px',
                borderRadius: '20px',
                height: '210px',
                display: 'flex',
                flexDirection: 'column'
              }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', fontWeight: 600, color: '#cbd5e1' }}>
                  Particulate Matter Distribution (PM2.5 vs PM10)
                </h4>
                <div style={{ flexGrow: 1, width: '100%', height: '80%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={historyData} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
                      <XAxis
                        dataKey="date"
                        stroke="#64748b"
                        fontSize={9}
                        tickLine={false}
                        tickFormatter={(d) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                      />
                      <YAxis
                        stroke="#64748b"
                        fontSize={9}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="pm25" fill={pollutantColors.pm25} name="PM2.5" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="pm10" fill={pollutantColors.pm10} name="PM10" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>

          </div>
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '50px 20px', color: '#94a3b8' }}>
          <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '15px' }}>📭</span>
          <h3>No historical records available</h3>
          <p style={{ margin: '10px 0 0 0', fontSize: '0.9rem', color: '#64748b' }}>
            Run a prediction search on coordinates using the map or search bar to generate historical cache logs.
          </p>
        </div>
      )}
    </div>
  );
};

export default HistoricalAnalysis;
