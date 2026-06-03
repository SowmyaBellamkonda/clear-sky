import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { useAQI } from '../context/AQIContext';
import { fetchHistoricalData } from '../services/aqiService';

const HistoricalAnalysis = () => {
  const { weatherData, isLoadingData } = useAQI();
  const [historyData, setHistoryData] = useState([]);
  const [timeframe, setTimeframe] = useState('7days');
  const [isFetching, setIsFetching] = useState(false);
  const [stats, setStats] = useState({});

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
      // Group and process the data for the chart by date
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
              pm25: groupedByDate[k].pm25_count > 0 ? (groupedByDate[k].pm25 / groupedByDate[k].pm25_count).toFixed(2) : null,
              pm10: groupedByDate[k].pm10_count > 0 ? (groupedByDate[k].pm10 / groupedByDate[k].pm10_count).toFixed(2) : null,
              no2: groupedByDate[k].no2_count > 0 ? (groupedByDate[k].no2 / groupedByDate[k].no2_count).toFixed(2) : null,
              so2: groupedByDate[k].so2_count > 0 ? (groupedByDate[k].so2 / groupedByDate[k].so2_count).toFixed(2) : null,
              co: groupedByDate[k].co_count > 0 ? (groupedByDate[k].co / groupedByDate[k].co_count).toFixed(2) : null,
              o3: groupedByDate[k].o3_count > 0 ? (groupedByDate[k].o3 / groupedByDate[k].o3_count).toFixed(2) : null,
          });
      }

      processed.sort((a,b) => new Date(a.date) - new Date(b.date));
      setHistoryData(processed);

      // calculate averages
      for(const p in newStats) {
          newStats[p].avg = newStats[p].count > 0 ? (newStats[p].sum / newStats[p].count).toFixed(2) : 0;
      }
      setStats(newStats);
  };

  if (isLoadingData) {
    return (
      <div className="historical-analysis" style={{ background: 'rgba(255, 255, 255, 0.1)', padding: '20px', borderRadius: '15px', color: 'white', marginTop: '20px', minHeight: '150px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <h2>Historical Air Quality Analysis</h2>
        <div style={{ marginTop: '20px', fontSize: '1.2rem', color: '#ccc' }}>Loading historical data...</div>
      </div>
    );
  }

  if (!weatherData) return null;

  return (
    <div className="historical-analysis" style={{ background: 'rgba(255, 255, 255, 0.1)', padding: '20px', borderRadius: '15px', color: 'white', marginTop: '20px' }}>
      <h2>Historical Air Quality Analysis</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <button onClick={() => setTimeframe('7days')} style={{ marginRight: '10px', padding: '8px 15px', background: timeframe === '7days' ? '#4CAF50' : '#444', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>7 Days</button>
        <button onClick={() => setTimeframe('30days')} style={{ marginRight: '10px', padding: '8px 15px', background: timeframe === '30days' ? '#4CAF50' : '#444', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>30 Days</button>
        <button onClick={() => setTimeframe('12months')} style={{ padding: '8px 15px', background: timeframe === '12months' ? '#4CAF50' : '#444', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>12 Months</button>
      </div>

      {isFetching ? (
        <p>Loading historical data...</p>
      ) : historyData.length > 0 ? (
        <>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '30px' }}>
                <div style={{ flex: '1 1 500px', height: '400px', background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '10px' }}>
                    <h3 style={{marginTop: 0}}>Pollutant Trends</h3>
                    <ResponsiveContainer width="100%" height="85%">
                        <LineChart data={historyData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#555" />
                            <XAxis dataKey="date" stroke="#ddd" />
                            <YAxis stroke="#ddd" />
                            <Tooltip contentStyle={{ backgroundColor: '#333', border: 'none', borderRadius: '5px' }} />
                            <Legend />
                            <Line type="monotone" dataKey="pm25" stroke="#ff7300" activeDot={{ r: 8 }} name="PM2.5" />
                            <Line type="monotone" dataKey="pm10" stroke="#387908" name="PM10" />
                            <Line type="monotone" dataKey="no2" stroke="#8884d8" name="NO2" />
                            <Line type="monotone" dataKey="o3" stroke="#ff0000" name="O3" />
                         </LineChart>
                    </ResponsiveContainer>
                </div>
                <div style={{ flex: '1 1 500px', height: '400px', background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '10px' }}>
                    <h3 style={{marginTop: 0}}>Average Pollutant Levels</h3>
                    <ResponsiveContainer width="100%" height="85%">
                        <BarChart data={historyData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#555" />
                            <XAxis dataKey="date" stroke="#ddd" />
                            <YAxis stroke="#ddd" />
                            <Tooltip contentStyle={{ backgroundColor: '#333', border: 'none', borderRadius: '5px' }} />
                            <Legend />
                            <Bar dataKey="pm25" fill="#ff7300" name="PM2.5" />
                            <Bar dataKey="pm10" fill="#387908" name="PM10" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
               {['pm25', 'pm10', 'no2', 'so2', 'co', 'o3'].map(pollutant => (
                   stats[pollutant] && stats[pollutant].count > 0 && (
                       <div key={pollutant} style={{ background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '10px' }}>
                           <h4 style={{ margin: '0 0 10px 0', textTransform: 'uppercase' }}>{pollutant} Data</h4>
                           <p style={{ margin: '5px 0' }}>Avg: <strong>{stats[pollutant].avg}</strong> µg/m³</p>
                           <p style={{ margin: '5px 0', color: '#ffb3b3' }}>Max: <strong>{stats[pollutant].max !== -Infinity ? stats[pollutant].max : 'N/A'}</strong></p>
                           <p style={{ margin: '5px 0', color: '#b3ffb3' }}>Min: <strong>{stats[pollutant].min !== Infinity ? stats[pollutant].min : 'N/A'}</strong></p>
                       </div>
                   )
               ))}
            </div>
        </>
      ) : (
        <p>No historical data available for this location yet. (Needs an OpenAQ API Key)</p>
      )}
    </div>
  );
};

export default HistoricalAnalysis;
