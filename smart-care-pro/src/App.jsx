import React, { useState, useEffect, useRef } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import PrivacyCanvas from './components/business/PrivacyCanvas';
import RecordDetail from './components/business/RecordDetail';
import { Camera, Upload, Plus, Loader2, FileJson, CheckCircle2, Search, Calendar, PieChart, X, Settings, ChevronRight, RefreshCw, RotateCcw } from 'lucide-react';
import { parseMedicalRecord } from './services/ai/qwen';
import { saveMedicalRecord, getMyRecords, searchRecords } from './services/db';
import StatsView from './components/business/StatsView';
import SettingsView from './components/business/SettingsView';
import RecordsExplorer from './components/business/RecordsExplorer';
import SplashScreen from './components/startup/SplashScreen';
import ScanCardBackground from './components/ui/ScanCardBackground';
import AILoadingOverlay from './components/ui/AILoadingOverlay';

// Helper: Blob to Base64 (Keep existing)
const blobToBase64 = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

function App() {
  const [currentImage, setCurrentImage] = useState(null);
  const [originalFile, setOriginalFile] = useState(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [records, setRecords] = useState([]);
  const [batchPages, setBatchPages] = useState([]); // { id, original, masked, previewUrl }
  const [selectedRecordId, setSelectedRecordId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showStats, setShowStats] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showExplorer, setShowExplorer] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  /* Existing state */
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [showImageSourceSelection, setShowImageSourceSelection] = useState(false);
  
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  const loadRecords = async (query = '') => {
      try {
          const data = query ? await searchRecords(query) : await getMyRecords();
          setRecords(data);
      } catch (e) {
          console.error("Failed to load records", e);
      }
  };

  const stateRef = useRef({
      currentImage, selectedRecordId, analysisResult, showStats
  });

  useEffect(() => {
      stateRef.current = { currentImage, selectedRecordId, analysisResult, showStats };
  }, [currentImage, selectedRecordId, analysisResult, showStats]);

  useEffect(() => {
      loadRecords();

      const backListener = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
          const { currentImage, selectedRecordId, analysisResult, showStats, showSettings, showExplorer } = stateRef.current;
          
          if (showStats) {
              setShowStats(false);
          } else if (showSettings) {
              setShowSettings(false);
          } else if (showExplorer) {
              setShowExplorer(false);
          } else if (currentImage) {
              setCurrentImage(null);
          } else if (selectedRecordId) {
              setSelectedRecordId(null);
          } else if (analysisResult) {
               // If editing new record, back button returns to Staging Area
              setAnalysisResult(null);
          } else {
              if (canGoBack) {
                  window.history.back();
              } else {
                  CapacitorApp.exitApp();
              }
          }
      });
      
      return () => {
          backListener.then(f => f.remove());
      };
  }, []); // Initial load & Listener setup

  const handleSearch = (e) => {
      const val = e.target.value;
      setSearchQuery(val);
      loadRecords(val);
  };


  
  // Real implementation for handleFileChange replacement:
  // Real implementation for handleFileChange replacement:
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsProcessingFile(true);
      // Small delay to render loader before heavy canvas init
      setTimeout(() => {
          setAnalysisResult(null);
          setOriginalFile(file);
          setCurrentImage(file);
          setIsProcessingFile(false);
          // Note: resetting input value is good practice
          e.target.value = ''; 
      }, 500);
    }
  };

  const handleCanvasConfirm = (maskedBlob) => {
    const newPage = {
        id: Date.now(),
        original: originalFile,
        masked: maskedBlob,
        previewUrl: URL.createObjectURL(maskedBlob)
    };
    setBatchPages(prev => [...prev, newPage]);
    setCurrentImage(null);
    setOriginalFile(null);
  };

  const handleBatchAnalyze = async () => {
    if (batchPages.length === 0) return;

    let key = localStorage.getItem('DASHSCOPE_API_KEY');
    key = 'sk-71f3b8f8d50b4f8ca9425bb48c61afd6'
    if (!key) {
        key = prompt("需要通义千问 API Key 才能进行解析。\n请输入您的 sk-xxxxxx:");
        if (key) localStorage.setItem('DASHSCOPE_API_KEY', key);
        else return;
    }

    setIsAnalyzing(true);
    try {
        // Convert all masked blobs to base64
        const base64List = await Promise.all(batchPages.map(async (p) => {
            return await blobToBase64(p.masked);
        }));
        
        const model = localStorage.getItem('DASHSCOPE_MODEL') || 'qwen-vl-max';
        const result = await parseMedicalRecord(base64List, key, model);
        setAnalysisResult(result);
    } catch (e) {
        console.error(e);
        alert("解析失败: " + e.message);
        if (e.message.includes('401')) localStorage.removeItem('DASHSCOPE_API_KEY');
    } finally {
        setIsAnalyzing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-50 overflow-hidden flex flex-col">
      
      {/* Splash Screen */}
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
      
      {/* Privacy Canvas Overlay */}
      {currentImage && (
        <PrivacyCanvas 
          imageFile={currentImage} 
          onConfirm={handleCanvasConfirm}
          onCancel={() => setCurrentImage(null)}
        />
      )}

      {/* Record Detail Modal (View/Edit Existing OR Create New) */}
      {(selectedRecordId || (analysisResult && batchPages.length > 0)) && (
        <RecordDetail 
           recordId={selectedRecordId} 
           initialData={!selectedRecordId ? analysisResult : null}
           stagingImages={!selectedRecordId ? batchPages : null}
           onClose={() => {
               setSelectedRecordId(null);
               if (!selectedRecordId) {
                   setAnalysisResult(null);
               }
           }} 
           onSave={() => {
               loadRecords();
               setSelectedRecordId(null);
               setAnalysisResult(null);
               setBatchPages([]);
               setCurrentImage(null);
               setOriginalFile(null);
           }}
           onDelete={async () => {
               await loadRecords();
               setSelectedRecordId(null);
           }}
        />

      )}

      {/* Main UI */}
      {!currentImage && (
        <div className="max-w-md mx-auto w-full h-full flex flex-col p-6 animate-in fade-in zoom-in-95 duration-500">
          
           {/* Overlays (Rendered conditionally on top of main content) */}
           {showStats && <StatsView 
              records={records} 
              onClose={() => setShowStats(false)} 
              onSearch={(keyword) => {
                  setSearchQuery(keyword);
                  loadRecords(keyword);
                  setShowStats(false);
              }}
          />}
          
          {showSettings && <SettingsView onClose={() => setShowSettings(false)} />}
          
          {showExplorer && (
              <RecordsExplorer 
                  records={records} 
                  onClose={() => setShowExplorer(false)}
                  onSelectRecord={(id) => {
                      setSelectedRecordId(id);
                  }} 
              />
          )}

          {/* VIEW 1: HOME DASHBOARD (When no batch pages) */}
          {!batchPages.length && (
              <div className="flex flex-col h-full space-y-6 pt-[calc(env(safe-area-inset-top)+1.5rem)]">
                  
                  {/* Header */}
                  <header className="flex items-center justify-between px-4">
                      <div className="flex items-center gap-2">
                          <h1 className="text-3xl font-black text-slate-900 tracking-tight">SmartCare</h1>
                          <div className="w-2.5 h-2.5 rounded-full bg-blue-500 mt-2" />
                      </div>
                      <div className="flex items-center gap-3">
                          <button 
                              onClick={() => setShowSettings(true)}
                              className="w-10 h-10 flex items-center justify-center bg-white rounded-full border border-slate-100 shadow-sm text-slate-600 hover:bg-slate-50 active:scale-95 transition-all"
                          >
                              <Settings size={20} />
                          </button>
                          <div className="w-10 h-10 rounded-full bg-yellow-100 border border-white shadow-sm overflow-hidden">
                              {/* Avatar placeholder - simple emoji or image */}
                              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="User" />
                          </div>
                      </div>
                  </header>

                  {/* Main Scan Card */}
                  <div 
                      onClick={() => setShowImageSourceSelection(true)}
                      className="flex-1 bg-[#0f172a] rounded-[2.5rem] relative overflow-hidden group shadow-2xl shadow-slate-200 cursor-pointer transition-all active:scale-[0.98] flex flex-col items-center justify-center text-center p-8 gap-6 min-h-0"
                  >
                        {/* Dynamic Particle Background */}
                        <ScanCardBackground />
                        <div className="absolute inset-0 bg-gradient-to-b from-blue-500/10 via-transparent to-blue-900/20 pointer-events-none" />

                        {/* Icon */}
                        <div className="w-20 h-20 rounded-[2rem] bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center text-white mb-2 group-hover:scale-110 transition-transform duration-500">
                             <Camera size={36} strokeWidth={1.5} />
                        </div>

                        {/* Text */}
                        <div className="relative z-10 space-y-2">
                            <h2 className="text-3xl font-bold text-white tracking-wide">扫描录入</h2>
                            <p className="text-blue-200/80 text-sm font-medium leading-relaxed">
                                支持病历、处方、检查报告<br/>
                                AI 自动结构化识别
                            </p>
                        </div>

                        {/* Bottom Badge */}
                        <div className="mt-auto pt-8">
                             <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/50 border border-white/5 text-[10px] text-slate-400 backdrop-blur">
                                 <CheckCircle2 size={10} className="text-emerald-500" />
                                 端到端隐私加密保护
                             </div>
                        </div>
                  </div>

                  {/* Search Bar */}
                  <div 
                    onClick={() => setShowExplorer(true)} 
                    className="bg-white p-2 pl-5 rounded-full shadow-lg shadow-slate-100 border border-slate-50 flex items-center gap-3 cursor-pointer hover:shadow-xl transition-all active:scale-[0.99] group"
                  >
                      <Search size={20} className="text-slate-400 group-hover:text-blue-500 transition-colors" />
                      <span className="flex-1 text-slate-400 font-medium truncate">
                        检索档案或咨询 AI 助手...
                      </span>
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-500 text-white flex items-center justify-center shadow-md shadow-purple-200">
                          <Plus size={20} className="rotate-45" /> {/* Use Plus rotated as 'Sparkles' lookalike or plain */}
                      </div>
                  </div>

                  {/* Bottom Grid */}
                  <div className="grid grid-cols-2 gap-4">
                      {/* Health Compass */}
                      <button 
                          onClick={() => setShowStats(true)}
                          className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 flex items-center justify-between group hover:border-green-200 hover:shadow-md transition-all active:scale-[0.98]"
                      >
                          <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-green-50 text-green-600 flex items-center justify-center">
                                  <PieChart size={20} />
                              </div>
                              <span className="font-bold text-slate-800">健康罗盘</span>
                          </div>
                          <ChevronRight size={16} className="text-slate-300 group-hover:text-green-500 group-hover:translate-x-1 transition-all" />
                      </button>

                      {/* History Archives */}
                      <button 
                          onClick={() => setShowExplorer(true)}
                          className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 flex items-center justify-between group hover:border-blue-200 hover:shadow-md transition-all active:scale-[0.98]"
                      >
                          <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                                  <Calendar size={20} />
                              </div>
                              <span className="font-bold text-slate-800">历史档案</span>
                          </div>
                          {records.length > 0 && (
                            <span className="w-6 h-6 rounded-full bg-slate-100 text-[10px] font-bold text-slate-500 flex items-center justify-center">
                                {records.length}
                            </span>
                          )}
                      </button>
                  </div>

              </div>
          )}

          {/* VIEW 2: BATCH STAGING / ANALYSIS RESULT AREA */}
          {batchPages.length > 0 && (
            <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500 pt-[calc(env(safe-area-inset-top))]">
               
               {/* MODE A: STAGING (PRE-ANALYSIS) */}
               {!analysisResult && (
                   <div className="flex flex-col h-full">
                       <div className="flex items-center justify-between mb-4 px-1 shrink-0">
                           <h3 className="font-bold text-slate-900 text-lg">
                               待处理单据 ({batchPages.length})
                           </h3>
                           <button 
                               onClick={() => {
                                   setBatchPages([]);
                                   setAnalysisResult(null);
                                   setCurrentImage(null);
                                   setOriginalFile(null);
                               }} 
                               className="text-xs text-slate-500 font-medium px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                           >
                               取消
                           </button>
                       </div>

                       <div className="bg-white p-4 rounded-[2rem] shadow-sm border border-slate-200 flex-1 flex flex-col min-h-0">
                            {/* Large Cards Scroller */}
                            <div className="flex-1 overflow-y-auto mb-4 min-h-0">
                                <div className="grid grid-cols-2 gap-3 pb-2">
                                    {batchPages.map((page, idx) => (
                                        <div key={page.id} className="relative aspect-[3/4] group">
                                            <img src={page.previewUrl} className="w-full h-full object-cover rounded-2xl border border-slate-100 shadow-sm" alt={`Page ${idx+1}`} />
                                            <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] font-bold px-2 py-1 rounded-full backdrop-blur">P{idx + 1}</div>
                                            <div className="absolute bottom-2 left-2 text-[10px] font-bold text-green-600 bg-green-50/90 px-2 py-1 rounded-full backdrop-blur border border-green-100 flex items-center gap-1">
                                                <CheckCircle2 size={10} /> 已脱敏
                                            </div>
                                            <button 
                                                onClick={() => setBatchPages(batchPages.filter(p => p.id !== page.id))}
                                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 shadow-md z-20 active:scale-90 transition-transform"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}
                                    
                                    {/* Add Page Button */}
                                    <label className="aspect-[3/4] rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 gap-3 cursor-pointer hover:bg-slate-50 hover:border-blue-300 hover:text-blue-500 transition-all active:scale-95 bg-slate-50/50">
                                        <div className="w-12 h-12 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                                            <Plus size={24} />
                                        </div>
                                        <span className="text-sm font-bold">添加单据</span>
                                        <input type="file" onChange={handleFileChange} className="hidden" capture="environment" accept="image/*" />
                                    </label>
                                </div>
                            </div>

                            <div className="shrink-0 pt-2">
                                <button 
                                    onClick={handleBatchAnalyze}
                                    disabled={isAnalyzing}
                                    className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 shadow-xl shadow-slate-200 hover:bg-slate-800 disabled:opacity-70 active:scale-[0.98] transition-all"
                                >
                                    {isAnalyzing ? (
                                        <>
                                            <Loader2 size={22} className="animate-spin" />
                                            正在分析 {batchPages.length} 页单据...
                                        </>
                                    ) : (
                                        <>
                                            <FileJson size={22} />
                                            开始智能分析
                                        </>
                                    )}
                                </button>
                                <p className="text-center text-xs text-slate-400 mt-3">
                                    AI 将自动提取所有的医疗关键信息
                                </p>
                            </div>
                       </div>
                   </div>
               )}

               {/* MODE B: ANALYSIS RESULT */}
               {analysisResult && (
                   <div className="flex flex-col h-full relative">
                        {/* 1. Thumbnails Bar (Sticky Top) */}
                        <div className="shrink-0 mb-4 bg-white/50 backdrop-blur rounded-2xl border border-slate-100 p-2 z-10 mx-1">
                            <div className="flex gap-2 overflow-x-auto scrollbar-hide snap-x">
                                {batchPages.map((page, idx) => (
                                    <div key={page.id} className="relative flex-shrink-0 snap-start">
                                        <img src={page.previewUrl} className="h-16 w-12 object-cover rounded-lg border border-slate-200" alt={`Page ${idx+1}`} />
                                        <div className="absolute bottom-0 right-0 bg-black/50 text-white text-[8px] px-1 rounded-tl-lg font-bold">P{idx + 1}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 2. Scrollable Result Content - Fixed Scrolling */}
                        <div className="flex-1 h-0 overflow-y-auto touch-pan-y min-h-0 -mx-6 px-6 pb-40">
                             <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 min-h-full">
                                <RecordDetail 
                                    recordId={null} 
                                    initialData={analysisResult}
                                    stagingImages={batchPages}
                                    isEmbedded={true} 
                                    onClose={() => {}} 
                                    onSave={() => {}} 
                                    onDelete={() => {}} 
                                />
                             </div>
                        </div>

                        {/* 3. Floating Footer */}
                        <div className="absolute bottom-4 left-0 right-0 z-[80] flex items-center gap-3 px-2">
                              <button 
                                 onClick={() => setAnalysisResult(null)}
                                 className="flex-[1] bg-white border border-slate-200 text-slate-600 py-3.5 rounded-2xl font-bold shadow-xl shadow-slate-200/50 flex items-center justify-center gap-2 active:scale-95 transition-all text-sm"
                              >
                                  <RotateCcw size={16} />
                                  上一步
                              </button>
                              <button 
                                 onClick={handleBatchAnalyze}
                                 className="w-14 bg-white border border-slate-200 text-blue-600 py-3.5 rounded-2xl font-bold shadow-xl shadow-slate-200/50 flex items-center justify-center active:scale-95 transition-all"
                              >
                                  <RefreshCw size={20} />
                              </button>
                              <button 
                                 onClick={async () => {
                                      try {
                                          const finalData = {
                                              ...analysisResult,
                                              fullData: analysisResult
                                          };
                                          await saveMedicalRecord(finalData, batchPages);
                                          alert("✅ 归档成功！");
                                          loadRecords();
                                          setAnalysisResult(null);
                                          setBatchPages([]);
                                          setCurrentImage(null);
                                      } catch(e) {
                                          alert("保存失败: " + e.message);
                                      }
                                 }}
                                 className="flex-[2] bg-blue-600 text-white py-3.5 rounded-2xl font-bold shadow-xl shadow-blue-500/30 flex items-center justify-center gap-2 active:scale-95 transition-all text-sm"
                              >
                                  <CheckCircle2 size={16} />
                                  确认归档
                              </button>
                        </div>
                   </div>
               )}

            </div>
          )}

        </div>
      )}
      {/* Global Loading Overlay */}
      {(isAnalyzing || isProcessingFile) && (
          <AILoadingOverlay isProcessingFile={isProcessingFile} />
      )}

      {/* Hidden Inputs for Action Sheet */}
      <input 
          type="file" 
          accept="image/*" 
          capture="environment"
          className="hidden" 
          ref={cameraInputRef}
          onChange={handleFileChange}
      />
      <input 
          type="file" 
          accept="image/*" 
          className="hidden" 
          ref={galleryInputRef}
          onChange={handleFileChange}
      />

      {/* Image Source Selection Action Sheet */}
      {showImageSourceSelection && (
        <>
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] transition-opacity" onClick={() => setShowImageSourceSelection(false)} />
            <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl rounded-t-[2rem] z-[61] p-4 animate-in slide-in-from-bottom duration-300 pb-8 safe-bottom shadow-2xl ring-1 ring-black/5">
                <div className="w-12 h-1 bg-slate-300 rounded-full mx-auto mb-6 opacity-50" />
                
                <h3 className="text-center font-bold text-slate-900 mb-6 text-lg">添加单据</h3>
                
                <div className="space-y-3 px-2">
                    <button 
                        onClick={() => {
                            cameraInputRef.current?.click();
                            setShowImageSourceSelection(false);
                        }}
                        className="w-full py-4 bg-white/50 hover:bg-white text-blue-600 rounded-2xl font-bold flex items-center justify-center gap-3 text-lg active:scale-95 transition-all border border-slate-100 shadow-sm"
                    >
                        <Camera size={24} strokeWidth={2.5} />
                        拍摄照片
                    </button>
                    <button 
                        onClick={() => {
                            galleryInputRef.current?.click();
                            setShowImageSourceSelection(false);
                        }}
                        className="w-full py-4 bg-white/50 hover:bg-white text-blue-600 rounded-2xl font-bold flex items-center justify-center gap-3 text-lg active:scale-95 transition-all border border-slate-100 shadow-sm"
                    >
                        <Upload size={24} strokeWidth={2.5} />
                        从相册选择
                    </button>
                </div>
                <button 
                    onClick={() => setShowImageSourceSelection(false)}
                    className="w-full mt-4 py-3.5 text-slate-500 font-bold active:text-slate-800 rounded-2xl hover:bg-slate-50 transition-colors"
                >
                    取消
                </button>
            </div>
        </>
      )}
    </div>
  );
}

export default App;
