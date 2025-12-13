import React, { useEffect, useState } from 'react';
import { db, saveMedicalRecord } from '../../services/db';
import { X, Trash2, Eye, EyeOff, Calendar, MapPin, Stethoscope, Edit2, Save, Undo2, ZoomIn, Maximize2, Plus, ChevronLeft, ChevronRight } from 'lucide-react';

export default function RecordDetail({ recordId, initialData, stagingImages, onClose, onDelete, onSave, isEmbedded = false }) {
    const [record, setRecord] = useState(null);
    const [formData, setFormData] = useState(null); // Editing buffer
    const [imageUrl, setImageUrl] = useState(null);
    const [showOriginal, setShowOriginal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(!!initialData); // Default edit mode for new records
    
    const [pages, setPages] = useState([]);
    const [activeIndex, setActiveIndex] = useState(0);
    
    // Zoom State
    const [isZooming, setIsZooming] = useState(false);
    const [zoomScale, setZoomScale] = useState(1);
    const [dragPos, setDragPos] = useState({ x: 0, y: 0 });

    // Swipe & Animation Logic
    const [touchStart, setTouchStart] = useState(null);
    const [touchEnd, setTouchEnd] = useState(null);
    const [animDirection, setAnimDirection] = useState('next');

    // Helper to change page with animation direction
    const changePage = (newIndex) => {
        if (newIndex === activeIndex) return;
        setAnimDirection(newIndex > activeIndex ? 'next' : 'prev');
        setActiveIndex(newIndex);
    };

    const onTouchStart = (e) => {
        setTouchEnd(null); 
        setTouchStart(e.targetTouches[0].clientX);
    };

    const onTouchMove = (e) => setTouchEnd(e.targetTouches[0].clientX);

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > 50;
        const isRightSwipe = distance < -50;

        if (isLeftSwipe && activeIndex < pages.length - 1) {
            changePage(activeIndex + 1);
        }
        if (isRightSwipe && activeIndex > 0) {
            changePage(activeIndex - 1);
        }
    };

    useEffect(() => {
        const loadData = async () => {
            try {
                if (recordId) {
                    const rec = await db.records.get(recordId);
                    setRecord(rec);
                    setFormData({
                        ...rec,
                        medications: rec.fullData?.medications || [],
                        inspections: rec.fullData?.inspections || [],
                        diagnosis: rec.diagnosis || ''
                    });
                    
                    // Load all associated files
                    const files = await db.files.where({ recordId: recordId }).toArray();
                    
                    // Group by page index
                    const pageMap = {};
                    files.forEach(f => {
                        let kind = 'masked';
                        let idx = 0;
                        
                        if (f.type === 'original') { kind = 'original'; idx = 0; }
                        else if (f.type === 'masked') { kind = 'masked'; idx = 0; }
                        else {
                            const parts = f.type.split('_');
                            kind = parts[0];
                            idx = parseInt(parts[1] || '0');
                        }
                        
                        if (!pageMap[idx]) pageMap[idx] = {};
                        pageMap[idx][kind] = f.blob;
                    });
                    
                    const sorted = Object.keys(pageMap).sort((a,b) => parseInt(a)-parseInt(b)).map(k => pageMap[k]);
                    setPages(sorted);
                } else if (initialData && stagingImages) {
                    // New Record Mode
                    const mockRecord = {
                         ...initialData,
                         hospital: initialData.hospital || '未命名医院',
                         date: initialData.date || new Date().toISOString().split('T')[0],
                         fullData: initialData
                    };
                    setRecord(mockRecord);
                    setFormData({
                        ...mockRecord,
                        medications: initialData.medications || [],
                        inspections: initialData.inspections || [],
                        diagnosis: initialData.diagnosis || ''
                    });
                    
                    // Use staging images directly
                    // stagingImages structure: [{ original: blob, masked: blob }]
                    setPages(stagingImages);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        loadData();
        
        return () => {
             if (imageUrl) URL.revokeObjectURL(imageUrl);
        };
    }, [recordId, initialData]);

    // Update Image when page or toggle changes
    useEffect(() => {
        if (pages.length === 0) return;
        
        const page = pages[activeIndex];
        if (!page) return;
        
        const blob = showOriginal ? (page.original || page.masked) : (page.masked || page.original);
        if (blob) {
            const url = URL.createObjectURL(blob);
            setImageUrl(url);
            return () => URL.revokeObjectURL(url);
        }
    }, [pages, activeIndex, showOriginal]);

    const toggleImage = () => setShowOriginal(!showOriginal);

    const handleDelete = async () => {
        if (window.confirm('确定要永久删除这条记录吗？相关的原图也将被销毁，无法恢复。')) {
            await db.transaction('rw', db.records, db.files, async () => {
                await db.records.delete(recordId);
                await db.files.where({ recordId: recordId }).delete();
            });
            onDelete();
        }
    };

    const handleSave = async () => {
        try {
            const finalData = {
                ...formData,
                fullData: {
                    ...formData,
                    medications: formData.medications,
                    inspections: formData.inspections
                }
            };

            if (recordId) {
                // Update existing
                 const updatedFullData = {
                    ...record.fullData,
                    hospital: formData.hospital,
                    department: formData.department,
                    doctor: formData.doctor,
                    date: formData.date,
                    cost: formData.cost,
                    diagnosis: formData.diagnosis,
                    medications: formData.medications,
                    inspections: formData.inspections
                };
    
                const updatedRecord = {
                    ...record,
                    ...formData,
                    fullData: updatedFullData
                };
    
                await db.records.put(updatedRecord);
                setRecord(updatedRecord);
                setIsEditing(false);
                alert("修改保存成功！");
            } else {
                // Create New
                // saveMedicalRecord expects (data, pages)
                // We construct 'data' from formData
                
                // Prepare pages for DB helper (expects {original, masked})
                // stagingImages prop has this structure.
                await saveMedicalRecord(finalData, stagingImages);
                alert("✅ 归档成功！");
                if (onSave) onSave(); // Notify parent to close and refresh
            }
        } catch (e) {
            alert("保存失败: " + e.message);
        }
    };

    // Form Updaters
    const updateField = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const updateArrayItem = (arrayName, index, field, value) => {
        setFormData(prev => {
            const newArray = [...prev[arrayName]];
            newArray[index] = { ...newArray[index], [field]: value };
            return { ...prev, [arrayName]: newArray };
        });
    };

    const addArrayItem = (arrayName) => {
        setFormData(prev => ({
            ...prev,
            [arrayName]: [...(prev[arrayName] || []), { name: '', result: '', unit: '', flag: '' }]
        }));
    };
    
    const removeArrayItem = (arrayName, index) => {
        setFormData(prev => ({
            ...prev,
            [arrayName]: prev[arrayName].filter((_, i) => i !== index)
        }));
    };

    // Determine visual mode based on Type
    const isReceipt = formData?.type?.includes('收据') || formData?.type?.includes('缴费');

    if (!record || !formData) return null;

    return (
        <div className={`${isEmbedded ? 'w-full pb-20' : 'fixed inset-0 z-[60] bg-slate-50 flex flex-col h-[100dvh] animate-in slide-in-from-bottom duration-300'}`}>
            {/* Image Viewer (Full Screen) - Keep global */}
            {isZooming && imageUrl && (
                <div 
                    className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col animate-in fade-in duration-300" 
                    // ... existing zoom viewer code ...
                >
                  {/* ... */}
                </div>
            )}

            {/* Navbar (Only if NOT embedded) */}
            {!isEmbedded && (
                <div className="sticky top-0 bg-white/80 backdrop-blur-xl border-b border-slate-100 px-4 py-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] flex items-center justify-between z-10 transition-colors duration-300" 
                     style={{ backgroundColor: isEditing ? 'rgba(239, 246, 255, 0.8)' : 'rgba(255,255,255,0.8)' }}>
                    {/* ... existing navbar buttons ... */}
                </div>
            )}

            <div className={`${isEmbedded ? 'space-y-6' : 'p-5 pb-20 max-w-lg mx-auto'}`}>
                
                {/* Image Section */}
                <div className={`relative mb-8 group transition-all duration-500 ${isEditing ? 'opacity-60 scale-95 origin-top' : ''}`}>
                    <div 
                        className="rounded-2xl overflow-hidden shadow-lg border border-slate-100 bg-slate-100 min-h-[200px] flex items-center justify-center relative cursor-zoom-in touch-pan-y"
                        onClick={() => !isEditing && setIsZooming(true)}
                        onTouchStart={onTouchStart}
                        onTouchMove={onTouchMove}
                        onTouchEnd={onTouchEnd}
                    >
                        {loading ? (
                            <div className="animate-pulse text-slate-400 text-sm">加载影像中...</div>
                        ) : imageUrl ? (
                            <img 
                                key={activeIndex} // Key change triggers animation
                                src={imageUrl} 
                                alt="Record" 
                                className={`w-full h-auto object-cover animate-in fade-in duration-300 ${animDirection === 'next' ? 'slide-in-from-right-12' : 'slide-in-from-left-12'}`} 
                            />
                        ) : (
                            <div className="text-slate-400">无图像</div>
                        )}
                        
                        {!isEditing && (
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/10">
                                <span className="bg-black/50 text-white px-3 py-1.5 rounded-full text-xs font-bold backdrop-blur flex items-center gap-2">
                                    <Maximize2 size={12} /> 点击看大图
                                </span>
                            </div>
                        )}
                        
                        {/* Pagination Controls */}
                        {pages.length > 1 && (
                             <>
                                {/* Left Arrow */}
                                {activeIndex > 0 && (
                                    <button 
                                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 p-1.5 rounded-full text-slate-700 hover:bg-white shadow-sm z-20 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={(e) => { e.stopPropagation(); changePage(activeIndex - 1); }}
                                    >
                                        <ChevronLeft size={20} />
                                    </button>
                                )}
                                
                                {/* Right Arrow */}
                                {activeIndex < pages.length - 1 && (
                                    <button 
                                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 p-1.5 rounded-full text-slate-700 hover:bg-white shadow-sm z-20 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={(e) => { e.stopPropagation(); changePage(activeIndex + 1); }}
                                    >
                                        <ChevronRight size={20} />
                                    </button>
                                )}

                                {/* Dots */}
                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-20" onClick={e => e.stopPropagation()}>
                                    {pages.map((_, idx) => (
                                        <button 
                                            key={idx}
                                            onClick={() => changePage(idx)}
                                            className={`w-2 h-2 rounded-full transition-all shadow-sm ${idx === activeIndex ? 'bg-blue-600 w-4' : 'bg-slate-300 hover:bg-slate-400'}`}
                                        />
                                    ))}
                                </div>
                             </>
                        )}
                    </div>
                    
                     {!isEditing && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); toggleImage(); }}
                            className="absolute top-4 right-4 bg-white/90 backdrop-blur text-slate-700 px-3 py-1.5 rounded-full text-xs font-bold shadow-md flex items-center gap-1.5 active:scale-95 transition-transform"
                        >
                            {showOriginal ? <Eye size={14} /> : <EyeOff size={14} />}
                            {showOriginal ? '原图' : '脱敏'}
                        </button>
                     )}
                </div>

                {/* Edit Form */}
                <div className="space-y-6">
                     {/* Meta Card */}
                     <div className={`bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-4 ${isEditing ? 'ring-2 ring-blue-500/20' : ''}`}>
                          {isEditing ? (
                               <div className="space-y-3">
                                   <div>
                                       <label className="text-xs font-bold text-slate-400 uppercase">医院</label>
                                       <input className="w-full text-lg font-bold text-slate-900 border-b border-slate-200 focus:border-blue-500 outline-none py-1" value={formData.hospital||''} onChange={e=>updateField('hospital', e.target.value)} />
                                   </div>
                                   <div className="grid grid-cols-2 gap-4">
                                       <div>
                                           <label className="text-xs font-bold text-slate-400 uppercase">日期</label>
                                           <input className="w-full text-sm border-b border-slate-200 py-1 focus:border-blue-500 outline-none" value={formData.date||''} onChange={e=>updateField('date',e.target.value)} placeholder="YYYY-MM-DD" />
                                       </div>
                                       <div>
                                           <label className="text-xs font-bold text-slate-400 uppercase">科室</label>
                                           <input className="w-full text-sm border-b border-slate-200 py-1 focus:border-blue-500 outline-none" value={formData.department||''} onChange={e=>updateField('department',e.target.value)} placeholder="科室" />
                                       </div>
                                       <div>
                                           <label className="text-xs font-bold text-slate-400 uppercase">医生</label>
                                           <input className="w-full text-sm border-b border-slate-200 py-1 focus:border-blue-500 outline-none" value={formData.doctor||''} onChange={e=>updateField('doctor',e.target.value)} placeholder="医生姓名" />
                                       </div>
                                       <div>
                                           <label className="text-xs font-bold text-slate-400 uppercase">类型</label>
                                           <select className="w-full text-sm border-b border-slate-200 py-1 bg-transparent focus:border-blue-500 outline-none" value={formData.type||''} onChange={e=>updateField('type',e.target.value)}>
                                               {['挂号单', '病历', '检验报告', '处方', '收据/缴费单', '其他'].map(t=><option key={t} value={t}>{t}</option>)}
                                           </select>
                                       </div>
                                   </div>
                                   
                                   <div>
                                        <label className="text-xs font-bold text-slate-400 uppercase">诊断 / 结论</label>
                                        <textarea 
                                            className="w-full text-sm border border-slate-200 rounded-lg p-2 focus:border-blue-500 outline-none mt-1 min-h-[60px]" 
                                            value={formData.diagnosis||''} 
                                            onChange={e=>updateField('diagnosis',e.target.value)}
                                            placeholder="填写诊断结果、主诉或医嘱..."
                                        />
                                   </div>

                                   <div>
                                        <label className="text-xs font-bold text-slate-400 uppercase">总金额</label>
                                        <div className="flex items-center border-b border-slate-200 focus-within:border-blue-500">
                                            <span className="text-slate-400 text-sm mr-1">¥</span>
                                            <input 
                                                type="number"
                                                className="w-full text-sm font-bold text-orange-500 focus:outline-none py-1 bg-transparent"
                                                value={formData.cost || ''}
                                                onChange={e => updateField('cost', e.target.value)}
                                                placeholder="0.00"
                                            />
                                        </div>
                                   </div>
                               </div>
                          ) : (
                               <div className="space-y-4">
                                   <div>
                                       <h1 className="text-xl font-bold text-slate-900">{record.hospital}</h1>
                                       <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-500 mt-1">
                                           <span className="flex items-center gap-1"><Calendar size={14}/> {record.date}</span>
                                           <span className="flex items-center gap-1"><MapPin size={14}/> {record.department || '未详科室'}</span>
                                           {record.doctor && <span className="flex items-center gap-1"><Stethoscope size={14}/> {record.doctor}</span>}
                                           <span className="bg-slate-100 px-2 py-0.5 rounded text-xs font-bold text-slate-600">{record.type}</span>
                                       </div>
                                   </div>
                                   
                                   {/* Diagnosis / Conclusion Display */}
                                   {(record.diagnosis || record.type === '挂号单') && (
                                        <div className="bg-blue-50/50 rounded-xl p-3 border border-blue-100">
                                            <div className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-1">
                                                {(record.type && record.type.includes('挂号')) ? '排号信息' : '诊断 / 结论'}
                                            </div>
                                            <div className="text-slate-800 font-medium leading-relaxed whitespace-pre-wrap">
                                                {record.diagnosis || '无诊断信息'}
                                            </div>
                                        </div>
                                    )}
                               </div>
                          )}
                     </div>

                    {/* Medications / Items Logic - Only show if has data OR is editing */}
                    {((formData.medications?.length > 0) || isEditing) && (
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 mb-2 flex justify-between items-center">
                                <span>{isReceipt ? '费用明细' : '处方药品'}</span>
                                {isReceipt && <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 rounded">收据模式</span>}
                            </h3>
                            <div className="bg-white p-2 rounded-2xl border border-slate-100 space-y-1">
                                {formData.medications.map((m, i) => (
                                    <div key={i} className="p-3 flex justify-between items-center hover:bg-slate-50 rounded-xl transition-colors">
                                        {isEditing ? (
                                            <div className="flex flex-col gap-2 w-full">
                                                <div className="flex gap-2">
                                                    <input className="font-medium bg-slate-50 px-2 py-1 rounded w-full border-transparent focus:bg-white focus:border-blue-300 border outline-none"
                                                        value={m.name} onChange={e => updateArrayItem('medications', i, 'name', e.target.value)} placeholder="名称" />
                                                    {/* Price needed for receipts */}
                                                    <input className="font-mono text-orange-500 bg-slate-50 px-2 py-1 rounded w-20 border-transparent focus:bg-white focus:border-blue-300 border outline-none text-right"
                                                        value={m.price || ''} onChange={e => updateArrayItem('medications', i, 'price', e.target.value)} placeholder="¥" />
                                                </div>
                                                <div className="flex gap-2">
                                                    {/* Dosage only for Prescriptions */}
                                                    <input className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded flex-1 border-transparent focus:bg-white focus:border-blue-300 outline-none"
                                                        value={m.dosage || ''} onChange={e => updateArrayItem('medications', i, 'dosage', e.target.value)} placeholder={isReceipt ? '备注' : '用法用量'} />
                                                    <input className="text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded w-16 border-transparent focus:bg-white focus:border-blue-300 outline-none"
                                                        value={m.quantity || ''} onChange={e => updateArrayItem('medications', i, 'quantity', e.target.value)} placeholder="Qty" />
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div>
                                                    <div className="font-medium text-slate-800">{m.name}</div>
                                                    <div className="text-xs text-slate-400">
                                                        {m.dosage} 
                                                        {isReceipt && m.price && <span className="ml-2 text-orange-500 font-bold">¥ {m.price}</span>}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    {m.quantity && <div className="text-xs text-slate-400">x{m.quantity}</div>}
                                                    {/* If it's a receipt and has price * qty, maybe show total? Keep simple for now */}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    {/* Inspections Table - Only show if has data OR is editing */}
                    {((formData.inspections?.length > 0) || isEditing) && (
                         <div className="mt-4">
                            <h3 className="text-sm font-bold text-slate-900 mb-2 flex justify-between items-center">
                                检验指标
                                {isEditing && (
                                    <button 
                                        onClick={() => addArrayItem('inspections')} 
                                        className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-full font-bold flex items-center gap-1 hover:bg-blue-100"
                                    >
                                        <Plus size={12} /> 添加指标
                                    </button>
                                )}
                            </h3>
                            
                            {formData.inspection_headers ? (
                                <div className="bg-white rounded-2xl border border-slate-100 text-sm overflow-hidden flex flex-col">
                                    <div className="overflow-x-auto w-full">
                                        <table className="w-full min-w-max">
                                            <thead className="bg-slate-50 text-xs text-slate-400 border-b border-slate-100">
                                                <tr>
                                                    {formData.inspection_headers.map((h, hi) => (
                                                        <th key={hi} className="p-3 font-normal text-left whitespace-nowrap bg-slate-50">{h}</th>
                                                    ))}
                                                    {isEditing && <th className="p-2 w-10 bg-slate-50"></th>}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {formData.inspections.map((item, i) => (
                                                    <tr key={i} className="hover:bg-slate-50/50">
                                                        {formData.inspection_headers.map((h, hi) => (
                                                            <td key={hi} className="p-2 min-w-[100px]">
                                                                {isEditing ? (
                                                                    <input 
                                                                        className="w-full bg-transparent border-b border-transparent focus:border-blue-300 outline-none py-1 px-1 transition-colors"
                                                                        value={item[h] || ''}
                                                                        onChange={e => updateArrayItem('inspections', i, h, e.target.value)}
                                                                        placeholder={h}
                                                                    />
                                                                ) : (
                                                                    <span className={`font-medium ${(h.includes('异常')||h.includes('提示')||item[h]==='↑'||item[h]==='↓') ? 'text-red-500 font-bold' : 'text-slate-700'}`}>
                                                                        {item[h]}
                                                                    </span>
                                                                )}
                                                            </td>
                                                        ))}
                                                        {isEditing && (
                                                            <td className="p-2 text-right">
                                                                 <button onClick={() => removeArrayItem('inspections', i)} className="p-1.5 text-slate-400 hover:text-red-500 rounded-full hover:bg-red-50">
                                                                    <Trash2 size={16} />
                                                                 </button>
                                                            </td>
                                                        )}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    {isEditing && formData.inspections.length === 0 && <div className="text-center text-xs text-slate-300 py-4">点击上方添加录入指标</div>}
                                </div>
                            ) : (
                                isEditing ? (
                                    <div className="space-y-2">
                                        {formData.inspections.map((item, i) => (
                                            <div key={i} className="flex gap-2 items-center bg-slate-50 p-2 rounded-xl border border-slate-100">
                                                <div className="grid grid-cols-4 gap-2 flex-1">
                                                    <input className="col-span-1 text-sm bg-white px-2 py-1.5 rounded border border-slate-200 outline-blue-400" 
                                                        placeholder="项目" value={item.name||''} onChange={e => updateArrayItem('inspections', i, 'name', e.target.value)} />
                                                    <input className="col-span-1 text-sm bg-white px-2 py-1.5 rounded border border-slate-200 outline-blue-400 font-bold" 
                                                        placeholder="结果" value={item.result||''} onChange={e => updateArrayItem('inspections', i, 'result', e.target.value)} />
                                                    <input className="col-span-1 text-xs bg-white px-2 py-1.5 rounded border border-slate-200 outline-blue-400 text-slate-400" 
                                                        placeholder="单位" value={item.unit||''} onChange={e => updateArrayItem('inspections', i, 'unit', e.target.value)} />
                                                    <input className="col-span-1 text-xs bg-white px-2 py-1.5 rounded border border-slate-200 outline-blue-400 text-red-500 font-bold text-center" 
                                                        placeholder="异常标" value={item.flag||''} onChange={e => updateArrayItem('inspections', i, 'flag', e.target.value)} />
                                                </div>
                                                <button onClick={() => removeArrayItem('inspections', i)} className="p-1.5 text-slate-400 hover:text-red-500 rounded-full hover:bg-red-50">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        ))}
                                        {formData.inspections.length === 0 && <div className="text-center text-xs text-slate-300 py-2">点击添加录入指标</div>}
                                    </div>
                                ) : (
                                    <div className="bg-white rounded-2xl overflow-hidden border border-slate-100 text-sm">
                                        <table className="w-full">
                                            <thead className="bg-slate-50 text-xs text-slate-400 border-b border-slate-100">
                                                <tr>
                                                    <th className="p-2 font-normal text-left pl-3">项目</th>
                                                    <th className="p-2 font-normal text-left">结果</th>
                                                    <th className="p-2 font-normal text-right pr-3">提示</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {formData.inspections.map((item, i) => (
                                                    <tr key={i}>
                                                        <td className="p-3 text-slate-700 font-medium">{item.name}</td>
                                                        <td className="p-3 font-bold text-slate-900">{item.result}<span className="text-xs font-normal text-slate-400 ml-1 scale-90 inline-block">{item.unit}</span></td>
                                                        <td className="p-3 text-right text-red-500 font-bold">{item.flag}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )
                            )}
                        </div>
                    )}

                </div>

            </div>
        </div>
    );
}
