
import React, { createContext, useContext, useState, useEffect } from 'react';
import { CreateMLCEngine } from "@mlc-ai/web-llm";
import { getAllRecords } from '../db';

const MODEL_ID = "Qwen2-1.5B-Instruct-q4f16_1-MLC";

const AIContext = createContext();

export const AIProvider = ({ children }) => {
    const [engine, setEngine] = useState(null);
    const [modelState, setModelState] = useState('idle'); // idle, downloading, ready, error
    const [progress, setProgress] = useState(0); // number 0-100 or text
    const [progressText, setProgressText] = useState('');
    const [indexingProgress, setIndexingProgress] = useState(0);
    const [cache, setCache] = useState(null);
    const [messages, setMessages] = useState([
        { role: 'assistant', content: '您好，我是您的本地医疗助手。我可以根据您的病历记录回答问题。' }
    ]);

    // Handle initial build index
    const buildIndex = async () => {
        setModelState('indexing');
        try {
            const allDocs = await getAllRecords();
            const total = allDocs.length;
            if (total === 0) {
                setCache({ lastUpdated: Date.now(), context: "（用户暂无记录）" });
                setModelState('ready');
                return;
            }

            let contextText = "";
            for (let i = 0; i < total; i++) {
                const r = allDocs[i];
                if (i % 5 === 0) await new Promise(res => setTimeout(res, 10)); // Yield UI
                
                let recordStr = `### 记录 ${i+1}\n`;
                recordStr += `- 时间: ${r.date}\n`;
                recordStr += `- 医院: ${r.hospital} (${r.department})\n`;
                recordStr += `- 类型: ${r.type}\n`;
                recordStr += `- 诊断/标题: ${r.title || '无'}\n`;
                if (r.doctor) recordStr += `- 医生: ${r.doctor}\n`;
                if (r.cost_total) recordStr += `- 费用: ¥${r.cost_total}\n`;
                if (r.notes) recordStr += `- 备注: ${r.notes}\n`;

                if (r.attachments?.length > 0) {
                     const ocr = r.attachments.filter(a => a.ocrText).map(a => a.ocrText).join('; ');
                     if(ocr.length > 0) recordStr += `- 附件内容摘要: ${ocr.slice(0, 200)}${ocr.length>200?'...':''}\n`;
                }
                contextText += recordStr + "\n";
                setIndexingProgress(Math.floor(((i + 1) / total) * 100));
            }

            setCache({ lastUpdated: Date.now(), context: contextText });
            setModelState('ready');
            setMessages(prev => [...prev, { role: 'system_notice', content: '模型已加载，全量记录索引构建完成。' }]);
        } catch(e) {
            console.error(e);
            setModelState('error');
        }
    };

    const initModel = async () => {
        if (!navigator.gpu) {
            alert("您的设备不支持WebGPU");
            return;
        }

        setModelState('downloading');
        try {
            const engineInstance = await CreateMLCEngine(
                MODEL_ID,
                { 
                    initProgressCallback: (info) => {
                        console.log(info);
                        setProgressText(info.text);
                        // Extract percentage
                        if (info.text.includes('%')) {
                            const match = info.text.match(/(\d+)%/);
                            if (match) setProgress(parseInt(match[1]));
                        }
                    }
                }
            );
            setEngine(engineInstance);
            await buildIndex();
        } catch (err) {
            console.error(err);
            setModelState('error');
            setMessages(prev => [...prev, { role: 'system_notice', content: `模型加载失败: ${err.message}` }]);
        }
    };


    const pauseDownload = () => {
        // Just reload page stops the script. Browser keeps cache.
        window.location.reload(); 
    };

    const cancelDownload = async () => {
        // Delete cache
        try {
           const keys = await caches.keys();
           for (const key of keys) {
               if (key.includes('webllm')) {
                   await caches.delete(key);
               }
           }
        } catch(e) { console.error("Cache delete fail", e); }
        window.location.reload();
    };

    return (
        <AIContext.Provider value={{
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
        }}>
            {children}
        </AIContext.Provider>
    );
};

export const useAI = () => useContext(AIContext);
