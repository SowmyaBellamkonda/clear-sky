import React, { useState, useEffect, useRef } from 'react';
import GlassLayout from './GlassLayout';
import { useAQI } from '../context/AQIContext';
import { AQI_LEVELS } from '../utils/theme';

const AssistantPanel = ({ isOpen, onClose }) => {
    const { theme, aqiValue, locationName, coords } = useAQI();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    // Set initial greeting based on AQI
    useEffect(() => {
        let initialMsg = "Hello! Ask me anything about the current air quality.";
        if (theme?.id === AQI_LEVELS.CLEAN) initialMsg = "Perfect weather to go for a run! Open your windows for fresh air.";
        else if (theme?.id === AQI_LEVELS.MODERATE) initialMsg = "It's slightly hazy today. If you're sensitive, you might want to skip the intense outdoor workout.";
        else if (theme?.id === AQI_LEVELS.POOR) initialMsg = "I recommend keeping the windows closed today. Turn on the air purifier if you have one.";
        else if (theme?.id === AQI_LEVELS.HAZARDOUS) initialMsg = "Please stay indoors and keep windows sealed. The air quality is extremely hazardous.";

        setMessages([{ role: 'assistant', content: initialMsg }]);
    }, [theme]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (isOpen) {
            setTimeout(scrollToBottom, 50);
        } else {
            scrollToBottom();
        }
    }, [messages, isLoading, isOpen]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMsg = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setIsLoading(true);

        try {
            const response = await fetch('http://localhost:5000/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: userMsg,
                    context: {
                        aqiValue,
                        theme: theme?.name,
                        locationName,
                        coords
                    }
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to fetch response');
            }

            setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
        } catch (error) {
            console.error('Chat error:', error);
            setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${error.message}` }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleSend();
        }
    };

    return (
        <GlassLayout 
            className={`assistant-panel ${isOpen ? 'open' : 'closed'}`} 
            style={{ 
                display: isOpen ? 'flex' : 'none',
                flexDirection: 'column', 
                height: '500px', 
                maxHeight: '70vh' 
            }}
        >
            <div className="assistant-header" style={{ flexShrink: 0, justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="assistant-avatar" style={{ backgroundColor: theme?.color ? `${theme.color}33` : 'rgba(255, 255, 255, 0.1)', color: theme?.color || '#fff' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="10" rx="2" />
                            <circle cx="12" cy="5" r="2" />
                            <path d="M12 7v4M8 16h.01M16 16h.01" />
                        </svg>
                    </div>
                    <h3 className="assistant-title" style={{ margin: 0 }}>Eco Assistant</h3>
                </div>
                {onClose && (
                    <button 
                        onClick={onClose} 
                        style={{ 
                            background: 'none', border: 'none', color: '#fff', 
                            cursor: 'pointer', padding: '4px', opacity: 0.7,
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
                        onMouseLeave={(e) => e.currentTarget.style.opacity = 0.7}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                )}
            </div>
            
            <div className="assistant-body" style={{ flexGrow: 1, minHeight: 0, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {messages.map((msg, idx) => (
                    <div 
                        key={idx} 
                        style={{
                            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                            backgroundColor: msg.role === 'user' ? (theme?.color || '#007bff') : 'rgba(255,255,255,0.1)',
                            color: msg.role === 'user' ? '#fff' : 'inherit',
                            padding: '8px 12px',
                            borderRadius: '12px',
                            maxWidth: '85%',
                            wordWrap: 'break-word',
                            border: msg.role === 'assistant' ? '1px solid rgba(255,255,255,0.2)' : 'none'
                        }}
                    >
                        <div className="assistant-text" style={{ margin: 0, fontSize: '0.9rem' }}>
                            {msg.content.split('\n').map((line, i) => (
                                <React.Fragment key={i}>
                                    {line}
                                    {i < msg.content.split('\n').length - 1 && <br />}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div style={{ alignSelf: 'flex-start', padding: '8px 12px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}>
                        <p className="assistant-text" style={{ margin: 0, fontSize: '0.9rem', opacity: 0.7 }}>Thinking...</p>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="assistant-input-area" style={{ flexShrink: 0, marginTop: '10px' }}>
                <input 
                    type="text" 
                    placeholder="Ask about air quality..." 
                    className="glass-input" 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isLoading}
                />
                <button 
                    className="glass-btn primary" 
                    style={{ backgroundColor: theme?.color || '#007bff', opacity: isLoading ? 0.5 : 1 }}
                    onClick={handleSend}
                    disabled={isLoading}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                </button>
            </div>
        </GlassLayout>
    );
};

export default AssistantPanel;
