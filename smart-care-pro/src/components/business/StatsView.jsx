import React, { useMemo } from 'react';
import { X, TrendingUp, PieChart, Activity, Wallet, Building2, Stethoscope, AlertCircle } from 'lucide-react';

export default function StatsView({ records, onClose, onSearch }) {
  const stats = useMemo(() => {
    let total = 0;
    const deptMap = {};
    const typeMap = {};
    const hospitalMap = {};
    const diagnosisMap = {};
    const historyData = []; // Can be expanded for charts

    records.forEach(r => {
      // Clean cost
      const cost = parseFloat((r.cost || '').toString().replace(/[^0-9.]/g, '')) || 0;
      total += cost;
      
      // Dept
      const d = (r.department || '未知科室').replace(/科$/, ''); // Remove '科' suffix for cleaner group
      deptMap[d] = (deptMap[d] || 0) + 1;
      
      // Type
      const t = r.type || '其他';
      typeMap[t] = (typeMap[t] || 0) + 1;

      // Hospital
      const h = r.hospital || '未知医院';
      hospitalMap[h] = (hospitalMap[h] || 0) + 1;

      // Diagnosis (Simple extraction)
      if (r.diagnosis && r.diagnosis.length < 20) { // Only count short diagnosis phrases to avoid noise
          const diag = r.diagnosis.trim();
          diagnosisMap[diag] = (diagnosisMap[diag] || 0) + 1;
      }
    });
    
    return {
      total: total.toFixed(2),
      depts: Object.entries(deptMap).sort((a,b) => b[1] - a[1]).slice(0, 5), // Top 5
      types: Object.entries(typeMap).sort((a,b) => b[1] - a[1]),
      hospitals: Object.entries(hospitalMap).sort((a,b) => b[1] - a[1]).slice(0, 5),
      diagnoses: Object.entries(diagnosisMap).sort((a,b) => b[1] - a[1]).slice(0, 8)
    };
  }, [records]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="shrink-0 px-6 pb-4 flex justify-between items-center bg-slate-50 z-10 pt-[calc(env(safe-area-inset-top)+2rem)]">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
                健康罗盘
            </h2>
            <button onClick={onClose} className="w-10 h-10 flex items-center justify-center bg-slate-200/50 rounded-full text-slate-500 hover:bg-slate-200 active:scale-95 transition-all">
                <X size={22} />
            </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 max-w-lg mx-auto w-full space-y-6 pb-20">
            
            {/* 1. Total Spend Card */}
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-6 text-white shadow-xl shadow-blue-200">
                <div className="flex items-center gap-2 opacity-80 mb-1 text-sm font-medium">
                    <Wallet size={16} /> 累计医疗支出
                </div>
                <div className="text-4xl font-bold tracking-tight">
                    <span className="text-2xl mr-1">¥</span>
                    {stats.total}
                </div>
                <div className="mt-4 pt-4 border-t border-white/20 flex gap-4 text-sm opacity-90">
                    <div>
                        <div className="text-xs opacity-60">记录总数</div>
                        <div className="font-bold">{records.length} 次</div>
                    </div>
                    <div>
                        <div className="text-xs opacity-60">最近就诊</div>
                        <div className="font-bold">{records[0]?.date || '--'}</div>
                    </div>
                </div>
            </div>

            {/* 2. Department Ranking */}
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Activity size={18} className="text-orange-500" />
                    高频就诊科室
                </h3>
                <div className="space-y-3">
                    {stats.depts.map(([dept, count], idx) => (
                        <div 
                            key={dept} 
                            className="relative cursor-pointer active:scale-[0.99] transition-transform"
                            onClick={() => onSearch && onSearch(dept)}
                        >
                            <div className="flex justify-between text-sm mb-1 font-medium z-10 relative">
                                <span className="text-slate-700">{idx+1}. {dept}</span>
                                <span className="text-slate-500">{count}次</span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-orange-400 rounded-full" 
                                    style={{ width: `${(count / stats.depts[0][1]) * 100}%` }}
                                ></div>
                            </div>
                        </div>
                    ))}
                    {stats.depts.length === 0 && <div className="text-slate-400 text-sm text-center py-4">暂无数据</div>}
                </div>
            </div>

            {/* 3. Hospital Ranking */}
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Building2 size={18} className="text-indigo-500" />
                    常去医院
                </h3>
                <div className="space-y-3">
                    {stats.hospitals.map(([name, count], idx) => (
                        <div 
                            key={name} 
                            className="relative cursor-pointer active:scale-[0.99] transition-transform"
                            onClick={() => onSearch && onSearch(name)}
                        >
                             <div className="flex justify-between text-sm mb-1 font-medium z-10 relative">
                                <span className="text-slate-700">{idx+1}. {name}</span>
                                <span className="text-slate-500">{count}次</span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-indigo-400 rounded-full" 
                                    style={{ width: `${(count / stats.hospitals[0][1]) * 100}%` }}
                                ></div>
                            </div>
                        </div>
                    ))}
                    {stats.hospitals.length === 0 && <div className="text-slate-400 text-sm text-center py-4">暂无数据</div>}
                </div>
            </div>

            {/* 4. Diagnoses Cloud */}
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Stethoscope size={18} className="text-rose-500" />
                    疾病 / 诊断分布
                </h3>
                <div className="flex flex-wrap gap-2">
                    {stats.diagnoses.map(([diag, count]) => (
                        <div 
                            key={diag} 
                            onClick={() => onSearch && onSearch(diag)}
                            className="bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100 cursor-pointer hover:border-blue-200 active:scale-95 transition-all text-sm font-medium text-slate-700 flex items-center gap-1.5"
                        >
                            {diag}
                            <span className="bg-slate-200 text-slate-600 text-[10px] px-1.5 py-0.5 rounded-full font-bold h-4 min-w-[1rem] flex items-center justify-center">
                                {count}
                            </span>
                        </div>
                    ))}
                    {stats.diagnoses.length === 0 && <div className="w-full text-slate-400 text-sm text-center py-4">暂无诊断数据</div>}
                </div>
            </div>

            {/* 3. Type Breakdown */}
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <TrendingUp size={18} className="text-teal-500" />
                    单据类型分布
                </h3>
                <div className="grid grid-cols-2 gap-3">
                    {stats.types.map(([type, count]) => (
                        <div 
                            key={type} 
                            onClick={() => onSearch && onSearch(type)}
                            className="bg-slate-50 p-3 rounded-xl flex items-center justify-between border border-slate-100 cursor-pointer hover:border-blue-200 active:scale-95 transition-all"
                        >
                            <span className="text-sm font-medium text-slate-600">{type}</span>
                            <span className="font-bold text-slate-800 bg-white px-2 py-0.5 rounded shadow-sm text-xs">{count}</span>
                        </div>
                    ))}
                </div>
            </div>

        </div>
    </div>
  );
}
