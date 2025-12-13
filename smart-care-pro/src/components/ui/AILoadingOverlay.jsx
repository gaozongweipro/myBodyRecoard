import React, { useEffect, useState } from 'react';
import { Brain, Sparkles, FileText, Database, ShieldCheck, Activity } from 'lucide-react';

export default function AILoadingOverlay({ isProcessingFile }) {
    const [step, setStep] = useState(0);

    const steps = isProcessingFile 
        ? [
            { text: '正在优化图像...', icon: <Activity size={24} /> },
            { text: '准备脱敏工具...', icon: <ShieldCheck size={24} /> }
        ]
        : [
            { text: '全域图像扫描中...', icon: <FileText size={24} /> },
            { text: 'AI 引擎正在识别文字...', icon: <Brain size={24} /> },
            { text: '正在提取关键医疗实体...', icon: <Sparkles size={24} /> },
            { text: '构建结构化健康档案...', icon: <Database size={24} /> }
        ];

    useEffect(() => {
        const interval = setInterval(() => {
            setStep((prev) => (prev + 1) % steps.length);
        }, 1500); // Change text every 1.5s
        return () => clearInterval(interval);
    }, [steps.length]);

    const currentStep = steps[Math.min(step, steps.length - 1)];

    return (
        <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in duration-300">
            {/* Tech Ring Animation Container */}
            <div className="relative w-32 h-32 flex items-center justify-center mb-8">
                
                {/* Outer Glow */}
                <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full animate-pulse" />

                {/* Ring 1: Slow Spin */}
                <div className="absolute inset-0 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin duration-[3s]" />
                
                {/* Ring 2: Reverse Spin, Smaller */}
                <div className="absolute inset-2 border-2 border-purple-500/30 border-b-purple-500 rounded-full animate-[spin_2s_linear_infinite_reverse]" />
                
                {/* Ring 3: Inner pulse */}
                <div className="absolute inset-6 border border-cyan-400/50 rounded-full animate-ping opacity-20 duration-[2s]" />

                {/* Center Icon */}
                <div className="relative z-10 text-white drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]">
                    {currentStep.icon}
                </div>

                {/* Orbiting Particles (Simulated with absolute dots) */}
                <div className="absolute inset-0 animate-[spin_4s_linear_infinite]">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-blue-400 rounded-full shadow-[0_0_10px_#60A5FA]" />
                </div>
                 <div className="absolute inset-0 animate-[spin_3s_linear_infinite_reverse]">
                    <div className="absolute bottom-1/2 right-0 translate-y-1/2 w-1.5 h-1.5 bg-purple-400 rounded-full shadow-[0_0_10px_#C084FC]" />
                </div>

            </div>

            {/* Text Content */}
            <div className="flex flex-col items-center gap-2">
                <h3 className="text-xl font-bold text-white tracking-widest uppercase animate-pulse">
                    智能分析中
                </h3>
                <div className="h-6 overflow-hidden flex flex-col items-center w-64 interactive-msg-container">
                    <p key={step} className="text-blue-200/90 font-medium text-sm animate-in slide-in-from-bottom-2 fade-in duration-300">
                        {currentStep.text}
                    </p>
                </div>
            </div>

            {/* Progress Bar (Fake) */}
            <div className="w-48 h-1 bg-slate-800 rounded-full mt-6 overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-500 to-blue-600 animate-[shimmer_2s_infinite_linear]" style={{ backgroundSize: '200% 100%' }} />
            </div>

            <style>{`
                @keyframes shimmer {
                    0% { background-position: 100% 0; }
                    100% { background-position: -100% 0; }
                }
            `}</style>
        </div>
    );
}
