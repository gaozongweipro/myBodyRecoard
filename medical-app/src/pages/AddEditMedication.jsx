import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { addMedication, updateMedication, getMedicationById } from '../db';
import { ArrowLeft, Plus, X, Save, Camera, Loader } from 'lucide-react';
import { Camera as CapacitorCamera, CameraResultType } from '@capacitor/camera';
import Tesseract from 'tesseract.js';

const AddEditMedication = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditMode = !!id;

    const [formData, setFormData] = useState({
        name: '',
        dosage: '',
        frequency: '每日1次',
        perDose: '',
        usage: '',
        startDate: new Date().toISOString().slice(0, 10),
        duration: 7,
        times: ['08:00'],
        notes: '',
        reminderEnabled: true,
        linkedRecordId: null
    });

    const [loading, setLoading] = useState(false);
    const [ocrProcessing, setOcrProcessing] = useState(false);
    const [prescriptionImage, setPrescriptionImage] = useState(null); // Store prescription photo
    const [previewImage, setPreviewImage] = useState(null); // For fullscreen preview

    useEffect(() => {
        if (isEditMode) {
            loadMedication();
        }
    }, [id]);

    const loadMedication = async () => {
        try {
            const med = await getMedicationById(parseInt(id));
            if (med) {
                setFormData({
                    ...med,
                    times: med.times || ['08:00']
                });
                // Load prescription image if exists
                if (med.prescriptionImage) {
                    setPrescriptionImage(med.prescriptionImage);
                }
            }
        } catch (e) {
            console.error('Load medication failed', e);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.name.trim()) {
            return alert('请输入药品名称');
        }

        setLoading(true);
        try {
            // Calculate end date
            const start = new Date(formData.startDate);
            const end = new Date(start);
            end.setDate(end.getDate() + parseInt(formData.duration) - 1);
            
            const medicationData = {
                ...formData,
                endDate: end.toISOString().slice(0, 10),
                duration: parseInt(formData.duration),
                prescriptionImage: prescriptionImage // Save prescription image
            };

            if (isEditMode) {
                await updateMedication(parseInt(id), medicationData);
            } else {
                await addMedication(medicationData);
            }

            // TODO: Schedule notifications here

            navigate('/medications');
        } catch (err) {
            console.error(err);
            alert('保存失败: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const addTime = () => {
        setFormData(prev => ({
            ...prev,
            times: [...prev.times, '12:00']
        }));
    };

    const removeTime = (index) => {
        if (formData.times.length === 1) {
            return alert('至少保留一个服药时间');
        }
        setFormData(prev => ({
            ...prev,
            times: prev.times.filter((_, i) => i !== index)
        }));
    };

    const updateTime = (index, value) => {
        const newTimes = [...formData.times];
        newTimes[index] = value;
        setFormData(prev => ({ ...prev, times: newTimes }));
    };

    const handlePrescriptionOCR = async () => {
        try {
            const image = await CapacitorCamera.getPhoto({
                quality: 90,
                allowEditing: false,
                resultType: CameraResultType.Base64,
                promptLabelHeader: '选择图片来源',
                promptLabelCancel: '取消',
                promptLabelPhoto: '从相册选择',
                promptLabelPicture: '拍照'
            });

            const base64Data = `data:image/${image.format};base64,${image.base64String}`;
            
            // Save the prescription image for thumbnail display
            setPrescriptionImage(base64Data);
            
            setOcrProcessing(true);
            
            const result = await Tesseract.recognize(base64Data, 'chi_sim+eng', {
                logger: m => console.log(m)
            });
            
            const text = result.data.text;
            console.log('OCR Result:', text);
            
            // Parse prescription information
            const parsed = parsePrescription(text);
            
            // Update form with parsed data
            setFormData(prev => ({
                ...prev,
                ...parsed
            }));
            
            alert('✓ 处方识别完成！请检查并补充信息');
            
        } catch (e) {
            console.error('OCR failed', e);
            if (e.message !== 'User cancelled photos app') {
                alert('识别失败，请重试或手动输入');
            }
        } finally {
            setOcrProcessing(false);
        }
    };

    const parsePrescription = (text) => {
        const result = {};
        const lines = text.split('\n').map(l => l.trim()).filter(l => l);
        
        // Extract medication name (usually contains 胶囊, 片, 颗粒, etc.)
        const namePattern = /([一-龟\w]+(?:胶囊|片|颗粒|口服液|注射液|软膏|滴眼液|喷雾剂|丸|膏|乳膏|喷雾剂))/;
        const nameMatch = text.match(namePattern);
        if (nameMatch) {
            result.name = nameMatch[1];
        }
        
        // Extract dosage (mg, g, ml, etc.)
        const dosagePattern = /(\d+\.?\d*\s?(?:mg|g|ml|μg|克|毫升|毫克))/i;
        const dosageMatch = text.match(dosagePattern);
        if (dosageMatch) {
            result.dosage = dosageMatch[1];
        }
        
        // Extract per dose (粒, 片, 袋, etc.)
        const perDosePattern = /(每次|一次)?\s?(\d+\s?(?:粒|片|袋|支|滴|丸|mg|ml|g|克|毫升|毫克))/;
        const perDoseMatch = text.match(perDosePattern);
        if (perDoseMatch) {
            result.perDose = perDoseMatch[1];
        }
        
        // Extract frequency
        const freqPattern = /(每天|每日)?\s?(\d+)\s?次/;
        const freqMatch = text.match(freqPattern);
        if (freqMatch) {
            const num = parseInt(freqMatch[1]);
            result.frequency = `每日${num}次`;
            
            // Generate default times based on frequency
            if (num === 1) {
                result.times = ['08:00'];
            } else if (num === 2) {
                result.times = ['08:00', '20:00'];
            } else if (num === 3) {
                result.times = ['08:00', '13:00', '19:00'];
            } else if (num === 4) {
                result.times = ['08:00', '12:00', '16:00', '20:00'];
            }
        }
        
        // Extract usage (饭前, 饭后, 睡前, etc.)
        const usagePattern = /(饭[前后]|睡前|晨起|需要时|空腹|餐[前后])/;
        const usageMatch = text.match(usagePattern);
        if (usageMatch) {
            result.usage = usageMatch[1] + '服用';
        }
        
        // Extract duration
        const durationPattern = /(?:用药|共|连续|疗程)?\s?(\d+)\s?[天日]/;
        const durationMatch = text.match(durationPattern);
        if (durationMatch) {
            result.duration = parseInt(durationMatch[1]);
        }
        
        return result;
    };

    return (
        <div className="container" style={{ paddingBottom: '100px' }}>
            {/* Header */}
            <div style={{ 
                paddingTop: '20px', 
                paddingBottom: '20px',
                borderBottom: '1px solid #F1F5F9',
                marginBottom: '20px'
            }}>
                <div className="flex items-center" style={{ gap: '12px', marginBottom: '12px' }}>
                    <button
                        onClick={() => navigate('/medications')}
                        style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            border: 'none',
                            background: '#F1F5F9',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                        }}
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <h1 style={{ 
                        fontSize: '1.5rem', 
                        fontWeight: 700, 
                        margin: 0,
                        color: '#0F172A'
                    }}>
                        {isEditMode ? '编辑用药' : '添加用药提醒'}
                    </h1>
                </div>
            </div>

            <form onSubmit={handleSubmit}>
                {/* Basic Info Card */}
                <div className="card" style={{ marginBottom: '16px', padding: '20px' }}>
                    <div className="flex-between" style={{ marginBottom: '16px' }}>
                        <h3 style={{ 
                            margin: 0, 
                            fontSize: '1rem', 
                            fontWeight: 600,
                            color: '#334155'
                        }}>
                            基本信息
                        </h3>
                        <button
                            type="button"
                            onClick={handlePrescriptionOCR}
                            disabled={ocrProcessing}
                            className="btn btn-secondary text-xs"
                            style={{ 
                                width: 'auto', 
                                padding: '6px 12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            {ocrProcessing ? (
                                <>
                                    <Loader size={14} className="spinner" />
                                    识别中...
                                </>
                            ) : (
                                <>
                                    <Camera size={14} />
                                    拍照识别处方
                                </>
                            )}
                        </button>
                    </div>

                    {/* Prescription Image Thumbnail */}
                    {prescriptionImage && (
                        <div style={{ 
                            marginBottom: '16px',
                            padding: '12px',
                            background: 'linear-gradient(135deg, #F0F9FF, #E0F2FE)',
                            borderRadius: '12px',
                            border: '2px solid #BFDBFE'
                        }}>
                            <div className="flex-between" style={{ marginBottom: '8px' }}>
                                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0369A1' }}>📄 处方图片</div>
                                <button type="button" onClick={() => setPrescriptionImage(null)}
                                    style={{ background: 'white', border: '1px solid #BFDBFE', borderRadius: '6px', padding: '4px 8px', fontSize: '0.75rem', color: '#DC2626', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <X size={12} /> 删除
                                </button>
                            </div>
                            <div onClick={() => setPreviewImage(prescriptionImage)} style={{ cursor: 'pointer', borderRadius: '8px', overflow: 'hidden', border: '2px solid white', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                                <img src={prescriptionImage} alt="处方" style={{ width: '100%', height: 'auto', display: 'block' }} />
                            </div>
                            <div style={{ fontSize: '0.7rem', color: '#60A5FA', textAlign: 'center', marginTop: '8px' }}>点击图片查看大图</div>
                        </div>
                    )}

                    <label className="text-sm text-muted mb-1 block">药品名称 *</label>
                    <input
                        type="text"
                        placeholder="例如：阿莫西林胶囊"
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        className="mb-4"
                        required
                    />

                    <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                        <div>
                            <label className="text-sm text-muted mb-1 block">剂量</label>
                            <input
                                type="text"
                                placeholder="如: 500mg, 0.5g, 10ml"
                                value={formData.dosage}
                                onChange={e => setFormData({ ...formData, dosage: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-sm text-muted mb-1 block">每次用量</label>
                            <input
                                type="text"
                                placeholder="如: 1粒, 2片, 1袋"
                                value={formData.perDose}
                                onChange={e => setFormData({ ...formData, perDose: e.target.value })}
                            />
                        </div>
                    </div>

                    <label className="text-sm text-muted mb-1 block">频率</label>
                    <select
                        value={formData.frequency}
                        onChange={e => setFormData({ ...formData, frequency: e.target.value })}
                        className="mb-4"
                    >
                        <option>每日1次</option>
                        <option>每日2次</option>
                        <option>每日3次</option>
                        <option>每日4次</option>
                        <option>需要时服用</option>
                    </select>

                    <label className="text-sm text-muted mb-1 block">用法</label>
                    <input
                        type="text"
                        placeholder="例如：饭后服用、睡前服用"
                        value={formData.usage}
                        onChange={e => setFormData({ ...formData, usage: e.target.value })}
                        className="mb-4"
                    />
                </div>

                {/* Schedule Card */}
                <div className="card" style={{ marginBottom: '16px', padding: '20px' }}>
                    <h3 style={{ 
                        margin: '0 0 16px 0', 
                        fontSize: '1rem', 
                        fontWeight: 600,
                        color: '#334155'
                    }}>
                        用药时间
                    </h3>

                    <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                        <div>
                            <label className="text-sm text-muted mb-1 block">开始日期</label>
                            <input
                                type="date"
                                value={formData.startDate}
                                onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-sm text-muted mb-1 block">疗程天数</label>
                            <input
                                type="number"
                                min="1"
                                value={formData.duration}
                                onChange={e => setFormData({ ...formData, duration: e.target.value })}
                            />
                        </div>
                    </div>

                    <label className="text-sm text-muted mb-2 block">每日服药时间</label>
                    <div style={{ marginBottom: '12px' }}>
                        {formData.times.map((time, index) => (
                            <div key={index} className="flex" style={{ gap: '8px', marginBottom: '8px' }}>
                                <input
                                    type="time"
                                    value={time}
                                    onChange={e => updateTime(index, e.target.value)}
                                    style={{ flex: 1 }}
                                />
                                <button
                                    type="button"
                                    onClick={() => removeTime(index)}
                                    style={{
                                        width: '40px',
                                        height: '40px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        background: '#FEE2E2',
                                        color: '#DC2626',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        ))}
                    </div>

                    <button
                        type="button"
                        onClick={addTime}
                        className="btn btn-outline text-sm"
                        style={{ width: '100%', borderStyle: 'dashed' }}
                    >
                        <Plus size={16} style={{ marginRight: '6px' }} />
                        添加服药时间
                    </button>
                </div>

                {/* Notes Card */}
                <div className="card" style={{ marginBottom: '16px', padding: '20px' }}>
                    <label className="text-sm text-muted mb-1 block">备注</label>
                    <textarea
                        rows={3}
                        placeholder="例如：如有不适立即停药并就医"
                        value={formData.notes}
                        onChange={e => setFormData({ ...formData, notes: e.target.value })}
                    />
                </div>

                {/* Reminder Toggle */}
                <div className="card" style={{ marginBottom: '80px', padding: '20px' }}>
                    <div className="flex-between">
                        <div>
                            <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '4px' }}>开启用药提醒</div>
                            <div style={{ fontSize: '0.85rem', color: '#64748B' }}>到时间时发送通知提醒您服药</div>
                        </div>
                        <div 
                            onClick={() => setFormData({ ...formData, reminderEnabled: !formData.reminderEnabled })}
                            style={{ 
                                width: '56px', 
                                height: '32px', 
                                background: formData.reminderEnabled ? '#3B82F6' : '#E2E8F0', 
                                borderRadius: '99px', 
                                position: 'relative', 
                                transition: 'background 0.3s',
                                cursor: 'pointer',
                                boxShadow: formData.reminderEnabled ? '0 4px 12px rgba(59, 130, 246, 0.3)' : 'inset 0 2px 4px rgba(0,0,0,0.06)'
                            }}
                        >
                            <div style={{ 
                                width: '28px', 
                                height: '28px', 
                                background: 'white', 
                                borderRadius: '50%', 
                                position: 'absolute', 
                                top: '2px', 
                                left: formData.reminderEnabled ? '26px' : '2px', 
                                transition: 'left 0.3s',
                                boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
                            }}></div>
                        </div>
                    </div>
                </div>

                {/* Submit Button */}
                <div style={{
                    position: 'fixed',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: '12px 16px',
                    paddingBottom: 'max(16px, calc(env(safe-area-inset-bottom) + 16px))', // Account for tab bar
                    background: 'white',
                    borderTop: '1px solid #F1F5F9',
                    zIndex: 100
                }}>
                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{
                            width: '100%',
                            padding: '14px',
                            fontSize: '1rem',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            marginBottom: '60px' // Space for tab bar
                        }}
                        disabled={loading}
                    >
                        {loading ? (
                            <>
                                <div className="spinner" style={{ width: '20px', height: '20px' }}></div>
                                保存中...
                            </>
                        ) : (
                            <>
                                <Save size={20} />
                                {isEditMode ? '保存修改' : '添加用药'}
                            </>
                        )}
                    </button>
                </div>
            </form>

            {/* Image Preview Modal */}
            {previewImage && (
                <div onClick={() => setPreviewImage(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.9)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <button onClick={() => setPreviewImage(null)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'white', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10000 }}>
                        <X size={24} />
                    </button>
                    <img src={previewImage} alt="处方预览" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} onClick={(e) => e.stopPropagation()} />
                </div>
            )}
        </div>
    );
};

export default AddEditMedication;
