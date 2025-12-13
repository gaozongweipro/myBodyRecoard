import React, { useEffect, useState } from 'react';
import { Activity, ShieldCheck, HeartPulse, Stethoscope, Sparkles } from 'lucide-react';

export default function SplashScreen({ onFinish }) {
    const [isExiting, setIsExiting] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        // Trigger entrance animations
        setMounted(true);

        // Schedule exit
        const exitTimer = setTimeout(() => {
            setIsExiting(true);
        }, 2200); // Show for 2.2 seconds

        // Notify parent to unmount
        const removeTimer = setTimeout(() => {
            onFinish();
        }, 3000); // 2.2s + 0.8s exit animation

        return () => {
            clearTimeout(exitTimer);
            clearTimeout(removeTimer);
        };
    }, [onFinish]);

    return (
        <div 
            className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-50 transition-all duration-1000 ease-[cubic-bezier(0.87,0,0.13,1)] ${
                isExiting ? 'opacity-0 scale-110 pointer-events-none blur-sm' : 'opacity-100 scale-100'
            }`}
        >
            {/* Background Decoration */}
            <div className={`absolute top-0 right-0 w-96 h-96 bg-blue-100/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 transition-opacity duration-1000 ${mounted ? 'opacity-100' : 'opacity-0'}`} />
            <div className={`absolute bottom-0 left-0 w-64 h-64 bg-teal-100/30 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 transition-opacity duration-1000 ${mounted ? 'opacity-100' : 'opacity-0'}`} />

            {/* Main Content */}
            <div className="relative z-10 flex flex-col items-center">
                
                {/* Logo Container */}
                <div className={`relative mb-6 transition-all duration-1000 ease-out delay-100 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
                    {/* Outer Ring */}
                    <div className="absolute inset-0 bg-blue-500/10 rounded-3xl blur-xl animate-pulse" />
                    
                    {/* Icon Box */}
                    <div className="relative w-24 h-24 bg-white rounded-3xl shadow-xl shadow-blue-100 flex items-center justify-center border border-slate-100 transform transition-transform hover:scale-105 duration-500">
                        <div className="relative">
                            <Activity size={48} className="text-blue-600" strokeWidth={2.5} />
                            {/* Accent Dot */}
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-teal-400 rounded-full border-2 border-white" />
                        </div>
                    </div>
                </div>

                {/* Title */}
                <h1 className={`text-3xl font-bold text-slate-900 tracking-tight transition-all duration-1000 ease-out delay-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                    SmartCare<span className="text-blue-600">Pro</span>
                </h1>

                {/* Slogan */}
                <p className={`mt-3 text-slate-400 text-sm font-medium tracking-wide transition-all duration-1000 ease-out delay-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                    您的专属医疗 AI 助手
                </p>

            </div>

            {/* Footer */}
            <div className={`absolute bottom-10 flex flex-col items-center gap-2 transition-all duration-1000 delay-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-widest">
                    <ShieldCheck size={14} />
                    <span>安全 · 隐私 · 加密</span>
                </div>
                <div className="w-10 h-1 bg-slate-100 rounded-full overflow-hidden">
                    <div className="w-full h-full bg-blue-500 animate-[loading_2s_ease-in-out_infinite] -translate-x-full" />
                </div>
            </div>

            <style>
                {`
                @keyframes loading {
                    0% { transform: translateX(-100%); }
                    50% { transform: translateX(0%); }
                    100% { transform: translateX(100%); }
                }
                `}
            </style>
        </div>
    );
}
