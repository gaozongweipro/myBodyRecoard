
import React, { createContext, useContext, useState, useRef } from 'react';
import { getAllRecords, getActiveMedications, getRecentLogs } from '../db';
import { format } from 'date-fns';

const AIContext = createContext();

/**
 * LOCAL LOGIC AGENT ENGINE
 * 
 * Principle: Keyword Matching -> Intent -> DB Query -> Formatted Response
 * Privacy: 100% Local. No network requests.
 * Speed: Instant.
 */

const INTENTS = [
    {
        id: 'STATS_COST',
        patterns: [/多少钱/, /费用/, /花费/, /花了/, /自费/],
        handler: async () => {
            const records = await getAllRecords();
            const total = records.reduce((acc, r) => acc + (parseFloat(r.cost_total) || 0), 0);
            const self = records.reduce((acc, r) => acc + (parseFloat(r.cost_self) || 0), 0);
            return `💰 费用统计：\n您的历史总医疗花费为 ¥${total.toFixed(2)}，其中个人自费 ¥${self.toFixed(2)}。`;
        }
    },
    {
        id: 'STATS_COUNT',
        patterns: [/多少次/, /几次/, /去过几次/, /记录数/, /一共.*记录/],
        handler: async () => {
            const records = await getAllRecords();
            const thisYear = new Date().getFullYear().toString();
            const thisYearCount = records.filter(r => r.date.startsWith(thisYear)).length;
            
            // Get most frequent hospital
            const hospitalCounts = {};
            records.forEach(r => {
                const h = r.hospital || '未知';
                hospitalCounts[h] = (hospitalCounts[h] || 0) + 1;
            });
            const topHospital = Object.entries(hospitalCounts).sort((a,b) => b[1] - a[1])[0];

            return `📊 记录统计：\n您总共有 ${records.length} 条就诊记录。\n今年（${thisYear}年）已有 ${thisYearCount} 次记录。\n去得最多的医院是 ${topHospital ? topHospital[0] : '无'} (${topHospital ? topHospital[1] : 0}次)。`;
        }
    },
    {
        id: 'MEDS_ACTIVE',
        patterns: [/药/, /吃.*什么/, /正在吃/, /服用/],
        handler: async () => {
            const meds = await getActiveMedications();
            if (meds.length === 0) return '💊 用药情况：\n您当前没有正在进行的服药计划。';
            
            const list = meds.map(m => {
                const today = new Date();
                const end = new Date(m.endDate);
                const diff = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
                return `- ${m.name}: ${m.dosage} ${m.frequency || ''} (剩余${diff}天)`;
            }).join('\n');
            
            return `💊 您正在服用 ${meds.length} 种药物：\n${list}`;
        }
    },
    {
        id: 'RECENT_RECORD',
        patterns: [/最近/, /上一次/, /最后一次/],
        handler: async () => {
             const records = await getAllRecords();
             if (records.length === 0) return '此处空空如也，您还没有添加过就诊记录。';
             // Records are sorted date desc by default in getAllRecords usually, but let's conform
             // getAllRecords in db.js returns: orderBy('date').reverse().toArray() -> Yes.
             
             const r = records[0];
             return `🏥 最近一次记录：\n时间：${r.date.slice(0, 16)}\n医院：${r.hospital}\n科室：${r.department}\n诊断：${r.title || '无'}`;
        }
    },
    {
        id: 'SEARCH_SPECIFIC',
        patterns: [
            /(?:上次|最近)(?:一次)?(?:去|在|看|做|检查|咨询)*(.+?)(?:是|什么时候|多久|了|过去|$)/, 
            /(.+?)(?:是|什么时候|多久|了|过去)/
        ],
        handler: async (text) => {
            // 1. Keyword Extraction & Cleaning
            // Remove question words and common prefixes to isolate the core noun
            let keyword = text.replace(/上次|最近|一次|是什么时候|什么时候|时间|是哪天|多久|过去|了|吗|我|的|是/g, '');
            
            // Remove common medical verbs from the start (handling "去看", "去检查" etc)
            // Loop replace to handle stacked verbs like "去看"
            while (/^(去|在|看|做|检查|咨询|配|买|拿)/.test(keyword)) {
                keyword = keyword.replace(/^(去|在|看|做|检查|咨询|配|买|拿)/, '');
            }
            
            keyword = keyword.trim();

            if (!keyword || keyword.length < 1) return '🤔 请问具体的医院、科室或疾病名称？例如：“上次看眼科是什么时候”';

            const records = await getAllRecords();
            // Fuzzy Search
            const targets = records.filter(r => {
                const raw = JSON.stringify(r).toLowerCase();
                return raw.includes(keyword.toLowerCase());
            });

            if (targets.length === 0) {
                return `🔎 没有找到关于“${keyword}”的记录。请确认关键词是否正确。`;
            }

            // Find the most recent one
            targets.sort((a, b) => new Date(b.date) - new Date(a.date));
            const hit = targets[0];
            
            // Calculate Time Diff
            const diffTime = new Date() - new Date(hit.date);
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            let timeAgoStr = '';
            if (diffDays === 0) timeAgoStr = '今天';
            else if (diffDays === 1) timeAgoStr = '昨天';
            else timeAgoStr = `${diffDays} 天前`;

            return `📅 找到了！最近一次关于“${keyword}”的记录：\n` +
                   `时间：${hit.date.slice(0, 10)} (${timeAgoStr})\n` +
                   `地点：${hit.hospital} (${hit.department})\n` +
                   `诊断：${hit.title || '无'}\n` + 
                   `[🔗 点击查看详情](/records/${hit.id})`;
        }
    },
    {
        id: 'GREETING',
        patterns: [/你好/, /hello/, /hi/, /在吗/],
        handler: async () => '👋 您好！我是您的隐私医疗助手。我可以帮您快速查记录、算费用、看药单。所有数据都只保存在您手机本地。'
    },
    {
        id: 'HELP',
        patterns: [/帮助/, /功能/, /你会什么/, /能做什么/],
        handler: async () => '🤖 我能为您做什么：\n1. 统计查询："今年花了多少钱？", "去过几次医院？"\n2. 用药提醒："我正在吃什么药？", "还有几天吃完？"\n3. 记录回顾："最近一次看病是什么时候？"\n\n请直接用自然语言问我即可！'
    }
];

export const AIProvider = ({ children }) => {
    const [messages, setMessages] = useState([
        { role: 'assistant', content: '您好，我是您的本地隐私医疗助手。我可以根据您的病历记录回答问题，数据完全不上云，请放心使用。' }
    ]);
    const [isThinking, setIsThinking] = useState(false);

    // Main entry point for user messages
    const sendMessage = async (text) => {
        // 1. Add User Message
        const userMsg = { role: 'user', content: text };
        setMessages(prev => [...prev, userMsg]);
        setIsThinking(true);

        // Simulate "Network Delay" for realism (optional, but feels better)
        await new Promise(r => setTimeout(r, 600));

        try {
            // 2. Logic Matching
            let responseText = "抱歉，我还在学习中，暂时不太理解这个问题。您可以试着问我'花了多少钱'或'正在吃什么药'。";
            
            // Find matched intent
            const matchedIntent = INTENTS.find(intent => 
                intent.patterns.some(pattern => pattern.test(text))
            );

            if (matchedIntent) {
                console.log(`[AI Logic] Matched Intent: ${matchedIntent.id}`);
                responseText = await matchedIntent.handler(text);
            } else {
                 // Fallback: Simple keyword check if regex failed or too complex
                 if (text.includes('记录')) {
                     // Maybe they want stats?
                     responseText = await INTENTS.find(i => i.id === 'STATS_COUNT').handler();
                 }
            }

            // 3. Add Assistant Message
            setMessages(prev => [...prev, { role: 'assistant', content: responseText }]);

        } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, { role: 'assistant', content: '处理您的请求时出错了，请稍后再试。' }]);
        } finally {
            setIsThinking(false);
        }
    };

    // Compatibility stubs for old UI components using the old context
    // These ensure we don't crash if UI tries to access 'modelState' etc.
    const compatibilityProps = {
        modelState: 'ready', 
        progress: 100,
        progressText: '',
        indexingProgress: 100,
        initModel: () => {}, 
        pauseDownload: () => {}, 
        cancelDownload: () => {}
    };

    return (
        <AIContext.Provider value={{
            messages,
            isThinking,
            sendMessage,
            ...compatibilityProps
        }}>
            {children}
        </AIContext.Provider>
    );
};

export const useAI = () => useContext(AIContext);
