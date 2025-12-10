
import React, { useState, useEffect, useRef } from 'react';
import { Download, Send, Bot, BrainCircuit, Loader2, AlertTriangle, XCircle, PlayCircle, PauseCircle } from 'lucide-react';
import { useAI } from '../context/AIContext';
import { getAllRecords } from '../db';

const AskAI = () => {
    const { 
        engine, 
        modelState, 
        progress, 
        progressText,
        indexingProgress, 
        cache, 
        messages, 

        setMessages, 
        initModel,
        pauseDownload,
        cancelDownload
    } = useAI();

    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    
    // Auto-scroll to bottom
    const listRef = useRef(null);
    useEffect(() => {
        if (listRef.current) {
            listRef.current.scrollTop = listRef.current.scrollHeight;
        }
    }, [messages, progress]);

    const handleSend = async () => {
        if (!input.trim()) return;
        if (modelState !== 'ready' || !engine) return;

        const userMsg = input;
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setInput('');
        setLoading(true);

        try {
            // Check if we need to re-index? 
            let contextToUse = cache?.context || "";
            if (!contextToUse) {
                 contextToUse = "（暂无数据或索引未构建）";
            }

            const systemPrompt = `你是一名专业的私人医疗健康助手。你拥有用户的**全部**历史就医记录（见下文）。
你的任务是根据这些记录，准确、逻辑清晰地回答用户的问题。

能力要求：
1. **归纳统计**：如果用户问“几次”、“多少钱”，请遍历记录计数。
2. **提取细节**：如果用户问“血检结果”、“开了什么药”，请仔细查看[附件识别内容]中的文字或表格数据。
3. **时间敏感**：注意记录的“时间”字段，区分“上个月”、“本周”等概念。当前日期是：${new Date().toLocaleDateString()}。

如果记录中找不到相关信息，请直接回答“记录中未找到相关信息”，不要编造。

下面是用户的完整档案归档：
---
${contextToUse}
---
`;
            // 2. Generate
            const chunks = await engine.chat.completions.create({
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userMsg }
                ],
                temperature: 0.3, 
                max_tokens: 1024
            });

            const reply = chunks.choices[0].message.content;
            setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
        } catch (e) {
            setMessages(prev => [...prev, { role: 'assistant', content: "生成出错: " + e.message }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - var(--nav-height) - 40px)' }}>
            <div className="flex-between mb-2">
                <h2 style={{ margin: 0 }}>智能助手</h2>
                <div className="badge" style={{ 
                    background: modelState === 'ready' ? '#dcfce7' : '#f1f5f9', 
                    color: modelState === 'ready' ? '#166534' : '#64748b',
                    padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', display: 'flex', alignItems: 'center'
                }}>
                    {modelState === 'ready' ? <BrainCircuit size={12} style={{marginRight:4}}/> : <Download size={12} style={{marginRight:4}}/>}
                    {modelState === 'ready' ? '模型已就绪' : modelState === 'indexing' ? `构建索引 ${indexingProgress}%` : modelState === 'idle' ? '需下载模型' : '加载中'}
                </div>
            </div>

            {/* Chat Area */}
            <div className="card" ref={listRef} style={{ flex: 1, overflowY: 'auto', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '20px' }}>
                
                {/* Intro / Download CTA */}
                {modelState === 'idle' && (
                    <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                        <Bot size={48} className="text-secondary" style={{ marginBottom: '1rem' }} />
                        <h3>启用本地AI助手</h3>
                        <p className="text-muted text-sm mb-4">
                            首次使用需要下载模型文件（约 1.0 GB）。<br/>
                            全程本地运行，您的隐私数据绝不上传。<br/>
                            <span style={{ fontSize: '0.8rem', color: '#ef4444' }}>
                                注意：下载期间请勿关闭应用后台。切到其他页面下载会自动在后台继续。
                            </span>
                        </p>
                        <button className="btn btn-primary" onClick={initModel} style={{ width: 'auto' }}>
                            <Download size={18} style={{ marginRight: '8px' }} />
                            开始下载并初始化
                        </button>
                    </div>
                )}

                {(modelState === 'downloading' || modelState === 'indexing') && (
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                        <Loader2 size={32} className="spinner" style={{ color: 'var(--primary)', marginBottom: '1rem' }} />
                        <p className="text-sm">{modelState === 'downloading' ? '正在下载模型...' : '正在学习您的全部病历...'}</p>
                        

                        {modelState === 'downloading' && (
                             <div className="flex-center" style={{ gap: '10px', marginTop: '10px' }}>
                                 <button className="btn btn-sm btn-outline-secondary" onClick={pauseDownload} style={{ fontSize: '0.8rem', padding: '4px 8px', width: 'auto' }}>
                                     <PauseCircle size={14} style={{ marginRight: 4 }} />暂停 (保留进度)
                                 </button>
                                 <button className="btn btn-sm btn-outline-danger" onClick={() => { if(confirm('确定取消并删除已下载文件吗？')) cancelDownload() }} style={{ fontSize: '0.8rem', padding: '4px 8px', width: 'auto' }}>
                                     <XCircle size={14} style={{ marginRight: 4 }} />取消 (删除文件)
                                 </button>
                             </div>
                        )}

                        {modelState === 'downloading' && (
                            <p className="text-xs text-muted" style={{ marginTop: '8px', wordBreak: 'break-all' }}>{progressText}</p>
                        )}
                        
                        <div style={{ width: '100%', height: '4px', background: '#e2e8f0', borderRadius: '2px', marginTop: '10px' }}>
                            <div style={{ 
                                width: modelState === 'indexing' ? `${indexingProgress}%` : `${progress}%`, 
                                height: '100%', 
                                background: 'var(--primary)', 
                                transition: 'width 0.3s' 
                            }} />
                        </div>
                    </div>
                )}
                
                {modelState === 'error' && (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--error)' }}>
                        <AlertTriangle size={32} style={{ marginBottom: '1rem' }} />
                        <p>初始化失败</p>
                        <button className="btn btn-secondary mt-2" onClick={initModel}>重试</button>
                    </div>
                )}

                {/* Messages */}
                {messages.map((m, i) => {
                    if (m.role === 'system_notice') {
                        return (
                            <div key={i} style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '10px 0' }}>
                                {m.content}
                            </div>
                        );
                    }
                    return (
                        <div key={i} style={{ 
                            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                            maxWidth: '85%',
                            background: m.role === 'user' ? 'var(--primary)' : 'white',
                            color: m.role === 'user' ? 'white' : 'var(--text-main)',
                            padding: '10px 14px',
                            borderRadius: '12px',
                            borderTopLeftRadius: m.role === 'assistant' ? '2px' : '12px',
                            borderTopRightRadius: m.role === 'user' ? '2px' : '12px',
                            boxShadow: 'var(--shadow)',
                            fontSize: '0.9rem',
                            whiteSpace: 'pre-wrap',
                            lineHeight: 1.6
                        }}>
                            {m.content}
                        </div>
                    );
                })}

                {loading && (
                     <div style={{ alignSelf: 'flex-start', background: 'white', padding: '8px 16px', borderRadius: '12px', boxShadow: 'var(--shadow)' }}>
                         <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px', borderColor: 'rgba(0,0,0,0.1)', borderTopColor: 'var(--primary)' }} />
                     </div>
                )}
            </div>

            {/* Input */}
            <div style={{ marginTop: '10px', display: 'flex', gap: '10px' }}>
                <input 
                    type="text" 
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder={modelState === 'ready' ? "问点什么... (例如: 我上个月去哪儿了?)" : "请先下载模型"}
                    style={{ flex: 1 }}
                    disabled={modelState !== 'ready' || loading}
                    onKeyDown={e => e.key === 'Enter' && !loading && handleSend()}
                />
                <button 
                    className="btn btn-primary" 
                    style={{ width: 'auto', padding: '0 1rem' }} 
                    onClick={handleSend}
                    disabled={modelState !== 'ready' || loading}
                >
                    <Send size={18} />
                </button>
            </div>
        </div>
    );
};

export default AskAI;
