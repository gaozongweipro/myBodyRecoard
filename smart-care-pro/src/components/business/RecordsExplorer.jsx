import React, { useState, useMemo, useRef, useEffect } from 'react';
import { X, Calendar as CalendarIcon, Folder, Search, MapPin, ChevronRight, ChevronLeft, Activity, Layers, MousePointer2, Sparkles, MessageSquare, Loader2 } from 'lucide-react';
import { askHealthAssistant } from '../../services/ai/qwen';

export default function RecordsExplorer({ records, onClose, onSelectRecord }) {
  // Mode: 'timeline' | 'month' | 'year'
  const [viewMode, setViewMode] = useState('timeline');
  const [viewDate, setViewDate] = useState(new Date()); // Tracks focused year/month
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState('keyword'); // 'keyword' | 'ai'
  const [aiAnswer, setAiAnswer] = useState(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  
  // For selecting multiple records on a specific day
  const [selectedDayRecords, setSelectedDayRecords] = useState(null); 
  
  // Dev/PC Check
  const [isPC, setIsPC] = useState(false);
  useEffect(() => {
      // Simple check for mouse interaction or large screen
      const check = window.matchMedia("(pointer: fine)").matches || window.innerWidth > 768;
      setIsPC(check);
  }, []);

  // --- AI Handler ---
  const handleAiSearch = async () => {
      if (!searchQuery.trim()) return;
      
      setIsAiLoading(true);
      setAiAnswer(null);
      
      try {
          const apiKey = localStorage.getItem('DASHSCOPE_API_KEY');
          if (!apiKey) {
              setAiAnswer("请先在设置中配置阿里云 API Key (通义千问)");
              setIsAiLoading(false);
              return;
          }
          
          const answer = await askHealthAssistant(records, searchQuery, apiKey);
          setAiAnswer(answer);
      } catch (err) {
          setAiAnswer("AI 助手暂时无法回答，请检查网络或 Key 设置。");
      } finally {
          setIsAiLoading(false);
      }
  };

  // --- Data Preparation ---
  // 1. Filtered Records (Only apply keyword filter if NOT in AI mode)
  const filteredRecords = useMemo(() => {
    let res = records;
    if (searchQuery && searchMode === 'keyword') {
        const lower = searchQuery.toLowerCase();
        res = res.filter(r => 
            (r.hospital && r.hospital.toLowerCase().includes(lower)) ||
            (r.diagnosis && r.diagnosis.toLowerCase().includes(lower)) ||
            (r.type && r.type.toLowerCase().includes(lower))
        );
    }
    return res;
  }, [records, searchQuery, searchMode]);

  // 2. Data Maps
  const dataMap = useMemo(() => {
     const dateMap = {}; // YYYY-MM-DD -> Record[]
     const monthMap = {}; // YYYY-MM -> Record[]
     const yearMap = {}; // YYYY -> Record[]
     
     // Find range
     let minDate = new Date();
     let maxDate = new Date();

     filteredRecords.forEach(r => {
         if (r.date) {
             const d = r.date; 
             // Date Map
             if (!dateMap[d]) dateMap[d] = [];
             dateMap[d].push(r);

             // Month Map
             const mKey = d.substring(0, 7);
             if (!monthMap[mKey]) monthMap[mKey] = [];
             monthMap[mKey].push(r);

             // Year Map
             const yKey = d.substring(0, 4);
             if (!yearMap[yKey]) yearMap[yKey] = [];
             yearMap[yKey].push(r);

             // Range
             const dateObj = new Date(d);
             if (dateObj < minDate) minDate = dateObj;
             if (dateObj > maxDate) maxDate = dateObj; // Usually records are past, but just in case
         }
     });
     
     // Generate list of Years available
     const startYear = minDate.getFullYear();
     const endYear = new Date().getFullYear(); // Up to now
     const availableYears = [];
     for(let y = endYear; y >= startYear; y--) {
         availableYears.push(y);
     }

     return { dateMap, monthMap, yearMap, availableYears };
  }, [filteredRecords]);

  // --- Navigation Helpers ---
  const switchToMonth = (dateStr) => {
      // dateStr: YYYY-MM or YYYY-MM-DD
      const d = new Date(dateStr);
      setViewDate(d);
      setViewMode('month');
  };

  const switchToYear = (year) => {
      const d = new Date(year, 0, 1);
      setViewDate(d);
      setViewMode('year');
  };

  // --- Gesture Logic (Pinch) ---
  const containerRef = useRef(null);
  const touchState = useRef({ dist: 0 });

  const handleTouchStart = (e) => {
      if (e.touches.length === 2) {
          const dist = Math.hypot(
              e.touches[0].pageX - e.touches[1].pageX,
              e.touches[0].pageY - e.touches[1].pageY
          );
          touchState.current.dist = dist;
      }
  };

  const handleTouchMove = (e) => {
      if (e.touches.length === 2 && viewMode !== 'timeline') {
          // Prevent scroll if pinching
          e.preventDefault();
      }
  };

  const handleTouchEnd = (e) => {
      if (e.touches.length < 2 && touchState.current.dist > 0) {
           // Gesture ended, check delta? 
           // Real pinch usually tracks 'move' continuously. 
           // Start -> Move (track delta) -> End.
           // Simplified: If move happened and scale changed.
           // Let's rely on simple touch move logic if possible, 
           // but `handleTouchMove` is safer place to detect threshold.
      }
      touchState.current.dist = 0;
  };
  
  // Use a simpler approach: Detect pinch in Move and trigger once.
  const handlePinchCheck = (e) => {
    if (e.touches.length === 2) {
        const dist = Math.hypot(
            e.touches[0].pageX - e.touches[1].pageX,
            e.touches[0].pageY - e.touches[1].pageY
        );
        
        if (touchState.current.dist > 0) {
            const scale = dist / touchState.current.dist;
            
            // Pinch In (Zoom Out) -> Go Up a level
            if (scale < 0.7) { 
                if (viewMode === 'month') setViewMode('year');
                if (viewMode === 'year') setViewMode('timeline'); // Optional: Year -> Timeline? Maybe just stay at year.
                touchState.current.dist = 0; // Reset to prevent double trigger
            }
            // Pinch Out (Zoom In) -> Go Down a level
            else if (scale > 1.3) {
                if (viewMode === 'year') {
                    // Zoom into focused month? Or just default center?
                    // Tricky without coordinates. Let's just go to Month view of 'viewDate'
                    setViewMode('month');
                }
                touchState.current.dist = 0;
            }
        }
    }
  };


  return (
    <div 
        className="fixed inset-0 z-50 bg-slate-50 flex flex-col animate-in slide-in-from-right duration-300"
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={(e) => { handleTouchMove(e); handlePinchCheck(e); }}
        onTouchEnd={handleTouchEnd}
    >
        
        {/* Header - Blended & Prominent */}
        <div className="shrink-0 bg-slate-50 pt-[calc(env(safe-area-inset-top)+2rem)] pb-2 px-6 z-20 flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    {viewMode !== 'timeline' && (
                        <button 
                            onClick={() => {
                                if (viewMode === 'month') setViewMode('timeline');
                                else if (viewMode === 'year') setViewMode('month');
                            }}
                            className="w-10 h-10 flex items-center justify-center bg-white rounded-full text-slate-600 shadow-sm border border-slate-100 active:scale-90 transition-all"
                        >
                            <ChevronLeft size={22} />
                        </button>
                    )}
                    <h2 className="text-3xl font-black text-slate-900 flex items-center gap-2 tracking-tight">
                        {viewMode === 'timeline' && '历史档案'}
                        {viewMode === 'month' && `${viewDate.getFullYear()}年 ${viewDate.getMonth()+1}月`}
                        {viewMode === 'year' && `${viewDate.getFullYear()}年 概览`}
                    </h2>
                </div>
                <button 
                    onClick={onClose}
                    className="w-10 h-10 flex items-center justify-center bg-slate-200/50 rounded-full text-slate-500 hover:bg-slate-200 active:scale-95 transition-all"
                >
                    <X size={22} />
                </button>
            </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto bg-slate-50 relative pb-32" id="records-content">
            
            {/* VIEW: TIMELINE */}
            {viewMode === 'timeline' && (
                <div className="p-4 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* If no records */}
                    {records.length === 0 && (
                       <div className="text-center text-slate-400 py-10">暂无记录</div>
                    )}

                    {Object.entries(dataMap.monthMap).sort((a,b) => b[0].localeCompare(a[0])).map(([monthKey, items]) => (
                        <div key={monthKey}>
                            <button 
                                onClick={() => switchToMonth(monthKey)}
                                className="sticky top-0 bg-slate-50/95 backdrop-blur py-2 w-full text-left z-10 flex items-center gap-2 group active:scale-[0.99] transition-transform"
                            >
                                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                                    <CalendarIcon size={16} className="text-blue-500" /> 
                                    {monthKey}
                                </h3>
                                <ChevronRight size={16} className="text-slate-300 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
                            </button>
                            
                            <div className="pl-8 space-y-6 border-l-2 border-slate-200 ml-3 mt-2 pb-6">
                                {items.map(rec => (
                                    <div 
                                        key={rec.id} 
                                        onClick={() => onSelectRecord(rec.id)}
                                        className="relative group cursor-pointer"
                                    >
                                        {/* Dot on the axis - Perfectly centered */}
                                        <div className="absolute -left-[39px] top-5 w-3.5 h-3.5 rounded-full bg-white border-[3px] border-slate-300 group-hover:border-blue-500 group-hover:scale-110 transition-all z-10 box-border" />
                                        
                                        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 hover:shadow-md hover:border-blue-100 transition-all active:scale-[0.99]">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="font-bold text-slate-800 text-base">{rec.hospital}</div>
                                                <div className="text-[11px] text-slate-400 font-mono bg-slate-50 px-2 py-1 rounded-lg shrink-0">
                                                    {rec.date.split('-')[2]}日
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 mb-2 text-xs">
                                                <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 font-medium">{rec.department}</span>
                                                <span className="text-slate-400">•</span>
                                                <span className="text-slate-500">{rec.type}</span>
                                            </div>
                                            {rec.diagnosis && (
                                                <div className="text-sm text-slate-600 leading-relaxed line-clamp-2">
                                                    {rec.diagnosis}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* VIEW: MONTH CALENDAR */}
            {viewMode === 'month' && (
                <div className="h-full flex flex-col px-4 pt-2 pb-6 animate-in zoom-in-95 duration-300 overflow-hidden relative">
                    <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 flex-1 flex flex-col overflow-hidden relative">
                        
                        {/* Days Header */}
                        <div className="grid grid-cols-7 border-b border-slate-50 bg-slate-50/30 py-4 shrink-0">
                             {['日','一','二','三','四','五','六'].map(d => (
                                <div key={d} className="text-xs font-medium text-slate-400 text-center">{d}</div>
                             ))}
                        </div>

                        {/* Calendar Grid Container - Adaptive & Centered */}
                        <div className="flex-1 p-4 flex flex-col justify-center">
                            <div className="grid grid-cols-7 w-full gap-1"> 
                                 {(() => {
                                     const year = viewDate.getFullYear();
                                     const month = viewDate.getMonth();
                                     const daysInMonth = new Date(year, month + 1, 0).getDate();
                                     const startOffset = new Date(year, month, 1).getDay();
                                     
                                     const cells = [];
                                     // Empty start cells
                                     for(let i=0; i<startOffset; i++) {
                                         cells.push(<div key={`empty-start-${i}`} />);
                                     }
                                     
                                     // Days
                                     for(let d=1; d<=daysInMonth; d++) {
                                         const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                                         const records = dataMap.dateMap[dateStr] || [];
                                         const count = records.length;
                                         
                                         // Color Logic (Clean Heatmap)
                                         let bgClass = 'bg-transparent text-slate-700 hover:bg-slate-50'; // Default
                                         let textClass = 'font-medium';
                                         
                                         if(count > 0) {
                                            if (count === 1) bgClass = 'bg-blue-100 text-blue-700';
                                            else if (count <= 3) bgClass = 'bg-blue-500 text-white shadow-md shadow-blue-200';
                                            else bgClass = 'bg-indigo-600 text-white shadow-lg shadow-indigo-300';
                                            textClass = 'font-bold';
                                         }

                                         // Current Day Highlight (optional, if matches today)
                                         const isToday = new Date().toDateString() === new Date(year, month, d).toDateString();
                                         const todayBorder = isToday ? 'ring-2 ring-blue-400 ring-offset-2' : '';

                                         cells.push(
                                             <button 
                                                key={d}
                                                disabled={count === 0 && !isToday}
                                                onClick={() => {
                                                    if (count === 1) onSelectRecord(records[0].id);
                                                    if (count > 1) setSelectedDayRecords({ date: dateStr, items: records });
                                                }}
                                                className={`relative w-full aspect-square rounded-2xl flex flex-col items-center justify-center transition-all active:scale-95 ${bgClass} ${todayBorder}`}
                                             >
                                                 <span className={`text-sm ${textClass}`}>{d}</span>
                                                 {/* Dot indicator instead of text for cleanliness */}
                                                 {count > 0 && (
                                                     <div className={`mt-0.5 h-1 w-1 rounded-full ${count === 1 ? 'bg-blue-400' : 'bg-white/70'}`} />
                                                 )}
                                             </button>
                                         );
                                     }
                                     return cells;
                                 })()}
                            </div>
                        </div>
                    </div>
                    {/* Minimal Hint */}
                    <div className="text-center text-[10px] text-slate-300 mt-3 shrink-0 tracking-widest opacity-60">
                        双指捏合切换至年份视图
                    </div>
                   
                    {/* PC Simulation Controls */}
                    {isPC && (
                        <div className="absolute right-6 bottom-8 flex flex-col gap-2 z-50">
                            <div className="bg-black/80 text-white text-[10px] px-2 py-1 rounded mb-1 text-center backdrop-blur">
                                模拟手势
                            </div>
                            <button 
                                onClick={() => {
                                    // Pinch In (Zoom Out) -> Go to Year
                                    setViewMode('year');
                                }}
                                className="w-12 h-12 bg-white rounded-full shadow-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 active:scale-90 transition-all font-bold text-xs"
                                title="模拟捏合 (Refine/Small)"
                            >
                                捏合
                            </button>
                            <button 
                                onClick={() => {
                                    // Pinch Out (Zoom In) -> Go to Timeline (if allowed) or stay
                                    // Actually user flow: Year -> Month -> Timeline is 'Back'. 
                                    // But typically Pinch Out means 'Expand details'.
                                    // Month Pinch Out -> Timeline? 
                                    // Logic in handlePinchCheck: PinchIn(<0.7): Month->Year. PinchOut(>1.3): Year->Month.
                                    // So in Month view, Pinch Out might strictly be nothing or "Enter Day"?
                                    // Let's assume user wants to traverse UP/DOWN tiers.
                                    // Timeline <-> Month <-> Year
                                    // Pinch In (Contract): Timeline -> Month -> Year
                                    // Pinch Out (Expand): Year -> Month -> Timeline
                                    // Let's implement this flow for simulation.
                                    setViewMode('timeline');
                                }}
                                className="w-12 h-12 bg-white rounded-full shadow-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 active:scale-90 transition-all font-bold text-xs"
                                title="模拟张开 (Expand/Big)"
                            >
                                张开
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* VIEW: YEAR OVERVIEW */}
            {viewMode === 'year' && (
                <div className="p-4 space-y-8 animate-in zoom-out-95 duration-500 relative min-h-full">
                    {dataMap.availableYears.map(year => (
                        <div key={year} className="space-y-4">
                            <h3 className="text-2xl font-bold text-slate-900 ml-2">{year}年</h3>
                            <div className="grid grid-cols-3 gap-4">
                                {Array.from({length: 12}).map((_, mIdx) => {
                                    const monthKey = `${year}-${String(mIdx+1).padStart(2,'0')}`;
                                    const hasData = dataMap.monthMap[monthKey];
                                    
                                    return (
                                        <button 
                                            key={mIdx}
                                            onClick={() => switchToMonth(`${year}-${mIdx+1}-01`)}
                                            className={`bg-white rounded-2xl p-2 border border-slate-100 hover:border-blue-300 active:scale-90 transition-all aspect-square flex flex-col ${hasData ? 'opacity-100 shadow-sm' : 'opacity-50 grayscale'}`}
                                        >
                                            <div className="text-xs font-bold text-slate-500 mb-1">{mIdx+1}月</div>
                                            {/* Mini Heatmap Grid */}
                                            <div className="flex-1 grid grid-cols-7 gap-[1px] content-start">
                                                {Array.from({length: 31}).map((_, dIdx) => {
                                                    // Simple approximation: assuming up to 31 days. Accurate mapping is overkill for "mini" view unless desired.
                                                    // Let's do accurate for visual fidelity.
                                                    const dateStr = `${year}-${String(mIdx+1).padStart(2,'0')}-${String(dIdx+1).padStart(2,'0')}`;
                                                    const count = (dataMap.dateMap[dateStr] || []).length;
                                                    if (count === 0) return <div key={dIdx} className="w-full pt-[100%] rounded-full bg-slate-50" />;
                                                    
                                                    const color = count > 1 ? 'bg-indigo-500' : 'bg-blue-400';
                                                    return <div key={dIdx} className={`w-full pt-[100%] rounded-full ${color}`} />;
                                                })}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                    <div className="text-center text-xs text-slate-400 pt-8 pb-10">
                        双指放大或点击月份查看详情
                    </div>
                     {/* PC Simulation Controls for Year View */}
                    {isPC && (
                        <div className="fixed right-6 bottom-8 flex flex-col gap-2 z-50">
                             <div className="bg-black/80 text-white text-[10px] px-2 py-1 rounded mb-1 text-center backdrop-blur">
                                模拟手势
                            </div>
                            <button 
                                onClick={() => { /* Already at max depth (Year), maybe nothing or collapse? */ }}
                                className="w-12 h-12 bg-white rounded-full shadow-lg border border-slate-200 flex items-center justify-center text-slate-400 cursor-not-allowed font-bold text-xs"
                                disabled
                            >
                                捏合
                            </button>
                            <button 
                                onClick={() => setViewMode('month')}
                                className="w-12 h-12 bg-white rounded-full shadow-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 active:scale-90 transition-all font-bold text-xs"
                            >
                                张开
                            </button>
                        </div>
                    )}
                </div>
            )}
            
        </div>


        {/* Floating Bottom Search / AI Bar */}
        {viewMode === 'timeline' && (
            <div className="absolute bottom-6 left-4 right-4 z-40 flex flex-col gap-2 animate-in slide-in-from-bottom-6 duration-500">
                {/* AI Answer Panel - Pops up ABOVE the bar */}
                {(aiAnswer || isAiLoading) && searchMode === 'ai' && (
                    <div className="bg-white/90 backdrop-blur-xl border border-purple-100 p-4 rounded-3xl shadow-xl animate-in slide-in-from-bottom-2 mb-1 max-h-[40vh] overflow-y-auto">
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center shrink-0 shadow-inner">
                                    {isAiLoading ? <Loader2 className="animate-spin text-purple-600" size={16} /> : <MessageSquare className="text-purple-600" size={16} />}
                                </div>
                                <div className="flex-1 pt-1">
                                    {isAiLoading ? (
                                        <div className="space-y-2">
                                            <div className="h-2 w-24 bg-purple-200/50 rounded animate-pulse" />
                                            <div className="h-2 w-full bg-purple-200/50 rounded animate-pulse" />
                                        </div>
                                    ) : (
                                        <div className="text-sm text-slate-800 leading-relaxed font-medium">
                                            {aiAnswer}
                                        </div>
                                    )}
                                </div>
                                <button onClick={() => setAiAnswer(null)} className="p-1 bg-slate-100 rounded-full text-slate-400 hover:bg-slate-200">
                                    <X size={14} />
                                </button>
                            </div>
                    </div>
                )}

                {/* Floating Search Input Bar */}
                <div className="bg-white/80 backdrop-blur-md border border-slate-200/50 shadow-2xl shadow-slate-200 rounded-full p-2 flex items-center gap-2">
                     <div className={`relative flex-1 group transition-all ${searchMode === 'ai' ? 'ring-2 ring-purple-500/30 rounded-full' : ''}`}>
                        {searchMode === 'keyword' ? (
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        ) : (
                            <Sparkles className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-500 animate-pulse" size={18} />
                        )}
                        
                        <input 
                            type="text" 
                            placeholder={searchMode === 'keyword' ? "搜索记录 (医院、诊断)..." : "向 AI 提问 (如: 上次感冒是什么时候?)..."} 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && searchMode === 'ai') {
                                    handleAiSearch();
                                }
                            }}
                            className={`w-full pl-11 pr-4 py-3 rounded-full text-sm font-medium focus:outline-none transition-all bg-transparent ${
                                searchMode === 'ai' 
                                ? 'text-purple-900 placeholder:text-purple-400' 
                                : 'text-slate-800 placeholder:text-slate-400'
                            }`}
                        />
                        {searchMode === 'ai' && searchQuery && (
                            <button 
                                onClick={handleAiSearch}
                                className="absolute right-2 top-1/2 -translate-y-1/2 bg-purple-600 text-white p-2 rounded-full active:scale-90 transition-all shadow-md shadow-purple-200"
                            >
                                <ChevronRight size={16} />
                            </button>
                        )}
                    </div>
                    
                    <button 
                        onClick={() => {
                            setSearchMode(prev => prev === 'keyword' ? 'ai' : 'keyword');
                            setSearchQuery('');
                            setAiAnswer(null);
                        }}
                        className={`shrink-0 w-12 h-12 flex items-center justify-center rounded-full transition-all active:scale-95 ${
                            searchMode === 'ai' 
                            ? 'bg-purple-600 text-white shadow-lg shadow-purple-300' 
                            : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-100 shadow-sm'
                        }`}
                        title={searchMode === 'ai' ? "切换回普通搜索" : "切换到 AI 问答"}
                    >
                        {searchMode === 'ai' ? <X size={22} /> : <Sparkles size={22} className="text-purple-500" />}
                    </button>
                </div>
            </div>
        )}

        {/* Selected Day List Modal (for Month View multiple items) */}
        {selectedDayRecords && (
            <div className="absolute inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-end animate-in fade-in duration-200">
                <div 
                    className="bg-slate-50 w-full rounded-t-[2rem] p-6 pb-12 max-h-[70vh] overflow-y-auto animate-in slide-in-from-bottom duration-300 shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                             <div className="w-1 h-6 bg-blue-500 rounded-full" />
                             <h3 className="text-lg font-bold text-slate-900">{selectedDayRecords.date}</h3>
                        </div>
                        <button onClick={() => setSelectedDayRecords(null)} className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-slate-500">
                            <X size={16} />
                        </button>
                    </div>
                    
                    <div className="space-y-3">
                        {selectedDayRecords.items.map(rec => (
                            <div 
                                key={rec.id}
                                onClick={() => { onSelectRecord(rec.id); setSelectedDayRecords(null); }}
                                className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 active:scale-95 transition-all flex justify-between items-center"
                            >
                                <div>
                                    <div className="font-bold text-slate-800">{rec.hospital}</div>
                                    <div className="text-xs text-slate-500 mt-1">{rec.department} · {rec.type}</div>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                                    <ChevronRight size={16} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                {/* Backdrop click to close */}
                <div className="absolute inset-0 z-[-1]" onClick={() => setSelectedDayRecords(null)} />
            </div>
        )}

    </div>
  );
}
