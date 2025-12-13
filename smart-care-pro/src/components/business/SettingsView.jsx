import React, { useState, useEffect } from 'react';
import { X, Settings, Database, Key, Save, Download, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import { exportDatabase, importDatabase } from '../../services/db';

export default function SettingsView({ onClose }) {
    const [apiKey, setApiKey] = useState('');
    const [model, setModel] = useState('qwen-vl-max');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const storedKey = localStorage.getItem('DASHSCOPE_API_KEY') || 'sk-71f3b8f8d50b4f8ca9425bb48c61afd6';
        const storedModel = localStorage.getItem('DASHSCOPE_MODEL') || 'qwen-vl-max';
        setApiKey(storedKey);
        setModel(storedModel);
    }, []);

    const handleSave = () => {
        localStorage.setItem('DASHSCOPE_API_KEY', apiKey);
        localStorage.setItem('DASHSCOPE_MODEL', model);
        alert('配置已保存');
        onClose();
    };

    const handleExport = async () => {
        try {
            setIsLoading(true);
            const jsonString = await exportDatabase();
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `SmartCare_Backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            alert('备份文件已生成并开始下载');
        } catch (e) {
            alert('导出失败: ' + e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleImport = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!window.confirm('警告：导入将覆盖当前所有数据！\n确定要继续吗？')) {
            e.target.value = '';
            return;
        }

        try {
            setIsLoading(true);
            const text = await file.text();
            await importDatabase(text);
            alert('数据恢复成功！请重启应用或刷新页面。');
            window.location.reload();
        } catch (e) {
            alert('导入失败: ' + e.message);
        } finally {
            setIsLoading(false);
            e.target.value = '';
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-50 flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Header */}
            <div className="shrink-0 px-6 pb-4 flex justify-between items-center bg-slate-50 z-10 pt-[calc(env(safe-area-inset-top)+2rem)]">
                <h2 className="text-3xl font-black text-slate-800 tracking-tight">
                    设置
                </h2>
                <button onClick={onClose} className="w-10 h-10 flex items-center justify-center bg-slate-200/50 rounded-full text-slate-500 hover:bg-slate-200 active:scale-90 transition-all">
                    <X size={22} />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 max-w-lg mx-auto w-full space-y-8 pb-20">
                
                {/* AI Configuration */}
                <section className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        <Key size={14} /> 模型服务配置
                    </h3>
                    <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">通义千问 API Key</label>
                            <input 
                                type="password" 
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:border-blue-500 focus:outline-none transition-colors font-mono"
                                value={apiKey}
                                onChange={e => setApiKey(e.target.value)}
                                placeholder="sk-..."
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">模型名称</label>
                            <select 
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:border-blue-500 focus:outline-none transition-colors"
                                value={model}
                                onChange={e => setModel(e.target.value)}
                            >
                                <option value="qwen-vl-max">qwen-vl-max (推荐)</option>
                                <option value="qwen-vl-plus">qwen-vl-plus</option>
                            </select>
                        </div>
                        <button 
                            onClick={handleSave}
                            className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
                        >
                            <Save size={16} /> 保存配置
                        </button>
                    </div>
                </section>

                {/* Data Management */}
                <section className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        <Database size={14} /> 数据管理
                    </h3>
                    <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-3">
                        <button 
                            onClick={handleExport}
                            disabled={isLoading}
                            className="w-full bg-blue-50 text-blue-600 hover:bg-blue-100 py-4 rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-all"
                        >
                            <Download size={20} />
                            导出备份 (.json)
                        </button>
                        
                        <div className="relative">
                            <button 
                                disabled={isLoading}
                                className="w-full bg-slate-50 text-slate-600 hover:bg-slate-100 py-4 rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-all"
                            >
                                <Upload size={20} />
                                恢复数据
                            </button>
                            <input 
                                type="file" 
                                accept=".json"
                                onChange={handleImport}
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                disabled={isLoading}
                            />
                        </div>

                        <div className="bg-amber-50 text-amber-600 text-xs p-3 rounded-xl flex items-start gap-2 leading-relaxed">
                            <AlertCircle size={14} className="shrink-0 mt-0.5" />
                            <span>
                                恢复数据将<b>完全覆盖</b>现有记录，请确保已备份当前数据。
                                仅支持本应用导出的 JSON 格式。
                            </span>
                        </div>
                    </div>
                </section>

                {/* About */}
                <div className="text-center pt-8 text-slate-300 text-xs">
                    <p>SmartCare Pro v1.0.0</p>
                    <p className="mt-1">由 Google DeepMind 设计</p>
                </div>
            </div>
            
            {isLoading && (
                <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-black/80 text-white px-6 py-4 rounded-2xl font-bold">
                        正在处理数据...
                    </div>
                </div>
            )}
        </div>
    );
}
