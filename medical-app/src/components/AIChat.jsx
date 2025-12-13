import React, { useState, useRef, useEffect } from 'react';
import { useAI } from '../context/AIContext';
import { useNavigate } from 'react-router-dom';
import { X, Send, Bot, Sparkles } from 'lucide-react';

const AIChat = () => {
    const { messages, sendMessage, isThinking } = useAI();
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState('');
    const messagesEndRef = useRef(null);
    const navigate = useNavigate();

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if(isOpen) scrollToBottom();
    }, [messages, isOpen]);

    const handleSend = () => {
        if (!input.trim()) return;
        sendMessage(input);
        setInput('');
    };

    const renderContent = (content) => {
        // Split by markdown link pattern [text](url)
        const parts = content.split(/(\[.*?\]\(.*?\))/g);
        
        return parts.map((part, index) => {
            const match = part.match(/\[(.*?)\]\((.*?)\)/);
            if (match) {
                const [_, text, url] = match;
                return (
                    <span 
                        key={index}
                        onClick={() => {
                            setIsOpen(false); 
                            navigate(url);
                        }}
                        style={{ 
                            color: '#F59E0B', 
                            fontWeight: 'bold', 
                            textDecoration: 'underline', 
                            cursor: 'pointer',
                            marginLeft: '4px',
                            marginRight: '4px'
                        }}
                    >
                        {text}
                    </span>
                );
            }
            return part; // Plain text
        });
    };

    return (
        <>
            {/* Floating Button (Always Visible) */}
            <div 
                style={{
                    position: 'fixed',
                    bottom: '160px', // Raised to avoid overlapping with page-specific FABs (e.g. Medications)
                    right: '20px',
                    zIndex: 2000
                }}
            >
               {!isOpen && (
                   <button
                        onClick={() => setIsOpen(true)}
                        style={{
                            width: '56px', height: '56px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #8B5CF6, #6366F1)',
                            border: 'none',
                            boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)',
                            color: 'white',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'transform 0.2s'
                        }}
                   >
                       <Bot size={28} />
                   </button>
               )}
            </div>

            {/* Chat Window Modal */}
            {isOpen && (
                <div style={{
                    position: 'fixed',
                    bottom: '0', left: '0', right: '0', top: '0',
                    zIndex: 2001,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'center',
                    padding: '20px'
                }} onClick={() => setIsOpen(false)}> {/* Click outside to close */}
                    
                    <div 
                        style={{
                            width: '100%', maxWidth: '400px',
                            height: '550px', maxHeight: '80vh',
                            background: 'white',
                            borderRadius: '24px',
                            display: 'flex', flexDirection: 'column',
                            overflow: 'hidden',
                            boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
                            animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                            marginBottom: 'env(safe-area-inset-bottom)'
                        }}
                        onClick={e => e.stopPropagation()} // Prevent close on modal click
                    >
                        {/* Header */}
                        <div className="flex-between" style={{ padding: '16px', background: '#fff', borderBottom: '1px solid #F1F5F9' }}>
                            <div className="flex items-center" style={{ gap: '8px' }}>
                                <div style={{ width: '32px', height: '32px', background: '#F3E8FF', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Sparkles size={18} color="#8B5CF6" />
                                </div>
                                <span style={{ fontWeight: 600, fontSize: '1rem', color: '#1E293B' }}>隐私医疗助手</span>
                            </div>
                            <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', padding: '4px', cursor: 'pointer' }}>
                                <X size={20} color="#64748B" />
                            </button>
                        </div>

                        {/* Messages Area */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', background: '#F8FAFC' }}>
                            {messages.map((msg, idx) => (
                                <div key={idx} style={{ 
                                    display: 'flex', 
                                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                    marginBottom: '16px'
                                }}>
                                    <div style={{
                                        maxWidth: '85%',
                                        padding: '12px 16px',
                                        borderRadius: '18px',
                                        background: msg.role === 'user' ? '#8B5CF6' : 'white',
                                        color: msg.role === 'user' ? 'white' : '#1E293B',
                                        border: msg.role === 'user' ? 'none' : '1px solid #E2E8F0',
                                        borderBottomRightRadius: msg.role === 'user' ? '4px' : '18px',
                                        borderBottomLeftRadius: msg.role === 'user' ? '18px' : '4px',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
                                        whiteSpace: 'pre-wrap',
                                        fontSize: '0.95rem',
                                        lineHeight: 1.5,
                                        wordBreak: 'break-word'
                                    }}>
                                        {renderContent(msg.content)}
                                    </div>
                                </div>
                            ))}
                            {isThinking && (
                                <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '16px' }}>
                                    <div style={{ padding: '12px 16px', borderRadius: '18px', background: 'white', border: '1px solid #E2E8F0', color: '#94A3B8', fontSize: '0.85rem' }}>
                                        <span className="dot-flashing"></span> 思考中...
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div style={{ padding: '12px 16px', borderTop: '1px solid #F1F5F9', background: 'white' }}>
                            {/* Suggestions Hints */}
                            {messages.length < 3 && (
                                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '12px', marginBottom: '4px' }}>
                                    {['今年花了多少钱？', '正在吃什么药？', '去过几次医院？'].map(q => (
                                        <button 
                                            key={q}
                                            onClick={() => sendMessage(q)}
                                            style={{
                                                padding: '6px 12px',
                                                background: '#F3E8FF',
                                                color: '#7C3AED',
                                                border: 'none',
                                                borderRadius: '99px',
                                                fontSize: '0.75rem',
                                                fontWeight: 500,
                                                whiteSpace: 'nowrap',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {q}
                                        </button>
                                    ))}
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <input
                                    style={{
                                        flex: 1,
                                        padding: '12px 16px',
                                        borderRadius: '24px',
                                        border: '1px solid #E2E8F0',
                                        background: '#F8FAFC',
                                        fontSize: '0.95rem',
                                        outline: 'none',
                                        caretColor: '#8B5CF6'
                                    }}
                                    placeholder="输入问题..."
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                                />
                                <button 
                                    onClick={handleSend}
                                    disabled={!input.trim() || isThinking}
                                    style={{
                                        width: '46px', height: '46px',
                                        borderRadius: '50%',
                                        background: input.trim() ? '#8B5CF6' : '#E2E8F0',
                                        border: 'none',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        cursor: input.trim() ? 'pointer' : 'default',
                                        transition: 'all 0.2s',
                                        transform: input.trim() ? 'scale(1)' : 'scale(0.95)'
                                    }}
                                >
                                    <Send size={20} color="white" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
             <style>{`
                @keyframes slideUp {
                    from { transform: translateY(100px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `}</style>
        </>
    );
};

export default AIChat;
