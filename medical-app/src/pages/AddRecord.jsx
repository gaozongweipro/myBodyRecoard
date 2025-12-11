
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { addRecord, updateRecord, getRecordWithAttachments } from '../db';
import { Camera, Upload, X, FileText, Download, ScanLine, Loader, Calendar, Maximize2 } from 'lucide-react';
import Tesseract from 'tesseract.js';
import AutoCompleteInput from '../components/AutoCompleteInput';
import { SHANGHAI_HOSPITALS, COMMON_DEPARTMENTS } from '../data/constants';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Camera as CapacitorCamera, CameraResultType } from '@capacitor/camera';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

const AddRecord = () => {
    const navigate = useNavigate();
    const { id } = useParams(); // Check if editing
    const isEditMode = !!id;

    const [expandedField, setExpandedField] = useState(null); // 'diagnosis' | 'medical_advice' | null
    const [processingModule, setProcessingModule] = useState(null); // 'diagnosis' | 'medical_advice' | 'cost_ocr'

    const [loading, setLoading] = useState(false);
    // eslint-disable-next-line no-unused-vars
    const [ocrProcessing, setOcrProcessing] = useState(false);
    
    // Custom Options State
    const [hospitalOptions, setHospitalOptions] = useState(SHANGHAI_HOSPITALS);
    const [deptOptions, setDeptOptions] = useState(COMMON_DEPARTMENTS);
    const [doctorOptions, setDoctorOptions] = useState([]);

    useEffect(() => {
        const loadOptions = () => {
            try {
                const savedDepts = JSON.parse(localStorage.getItem('custom_departments') || '[]');
                // Merge unique, prepending saved ones
                const uniqueDepts = savedDepts.filter(d => !COMMON_DEPARTMENTS.includes(d));
                setDeptOptions([...uniqueDepts, ...COMMON_DEPARTMENTS]);

                const savedHospitals = JSON.parse(localStorage.getItem('custom_hospitals') || '[]');
                const uniqueHospitals = savedHospitals.filter(h => !SHANGHAI_HOSPITALS.includes(h));
                setHospitalOptions([...uniqueHospitals, ...SHANGHAI_HOSPITALS]);

                const savedDoctors = JSON.parse(localStorage.getItem('custom_doctors') || '[]');
                setDoctorOptions(savedDoctors);
            } catch (e) {
                console.error("Error loading options", e);
            }
        };
        loadOptions();
    }, []);
    const [formData, setFormData] = useState({
        date: new Date().toISOString().slice(0, 16),
        hospital: '',
        department: '',
        doctor: '',
        type: '门诊',
        cost_total: 0,
        cost_personal: 0,
        cost_pool: 0,
        cost_self: 0,
        cost_items: [], // Array of { id, self, pool, personal, total }
        title: '',
        notes: ''
    });

    const [previewImage, setPreviewImage] = useState(null);
    const [attachments, setAttachments] = useState([]);
    const [deletedAttachmentIds, setDeletedAttachmentIds] = useState([]); // Track deletions
    const [ocrModalText, setOcrModalText] = useState(null); // Content for text selection modal

    // Crop State
    const [cropModalOpen, setCropModalOpen] = useState(false);
    const [cropImage, setCropImage] = useState(null); // Base64 of image to crop
    const [crop, setCrop] = useState();
    const [completedCrop, setCompletedCrop] = useState(null);
    const [cropTarget, setCropTarget] = useState(null); // { fieldName, targetItemId, file }
    const imgRef = React.useRef(null);

    function onImageLoad(e) {
        const { width, height } = e.currentTarget;
        const crop = centerCrop(
            makeAspectCrop(
                {
                    unit: '%',
                    width: 90,
                },
                width / height,
                width,
                height
            ),
            width,
            height
        )
        setCrop(crop)
    }

    const getCroppedImg = (image, crop) => {
        const canvas = document.createElement('canvas');
        const scaleX = image.naturalWidth / image.width;
        const scaleY = image.naturalHeight / image.height;
        
        // Calculate the actual size of the crop on the original image
        canvas.width = crop.width * scaleX;
        canvas.height = crop.height * scaleY;

        const ctx = canvas.getContext('2d');
        
        // Draw the image at its native resolution
        ctx.drawImage(
            image,
            crop.x * scaleX,
            crop.y * scaleY,
            crop.width * scaleX,
            crop.height * scaleY,
            0,
            0,
            crop.width * scaleX,
            crop.height * scaleY
        );

        // Return high quality PNG
        return canvas.toDataURL('image/png');
    }

    useEffect(() => {
        if (isEditMode) {
            loadRecordForEdit();
        } else {
             // Initialize with one empty cost item if new record? Or empty.
             // Let's start empty or maybe 1 item.
             setFormData(prev => ({ ...prev, cost_items: [{ id: Date.now(), self: '', pool: '', personal: '' }] }));
        }
    }, [id]);

    const loadRecordForEdit = async () => {
        try {
            const record = await getRecordWithAttachments(parseInt(id));
            if (record) {
                // Handle legacy cost data
                let items = record.cost_items || [];
                if (items.length === 0 && (record.cost_total || record.cost_self || record.cost_pool || record.cost_personal)) {
                    items = [{
                        id: Date.now(),
                        self: record.cost_self || 0,
                        pool: record.cost_pool || 0,
                        personal: record.cost_personal || 0,
                        total: record.cost_total || 0 // Store legacy total
                    }];
                }

                setFormData({
                    date: record.date,
                    hospital: record.hospital,
                    department: record.department,
                    doctor: record.doctor || '',
                    type: record.type,
                    cost_total: record.cost_total || 0,
                    cost_personal: record.cost_personal || 0,
                    cost_pool: record.cost_pool || 0,
                    cost_self: record.cost_self || 0,
                    cost_items: items,
                    title: record.title || '',
                    diagnosis: record.diagnosis || '',
                    medical_advice: record.medical_advice || '',
                    notes: record.notes || ''
                });
                setAttachments(record.attachments || []);
            }
        } catch (e) {
            console.error("Load failed", e);
        }
    };

    const handleCameraCapture = async () => {
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
            
            // Create a "file-like" entries
            const newAtt = {
                id: Date.now() + Math.random(),
                // Mock file object (optional, mostly for name/type)
                file: null, 
                data: base64Data,
                type: `image/${image.format}`,
                name: `Camera_${Date.now()}.${image.format}`,
                ocrText: '',
                ocrStatus: 'scanning' // Auto scan even for camera? Sure.
            };

            setAttachments(prev => [...prev, newAtt]);
            performOCR(newAtt.id, newAtt.data);

        } catch (e) {
            console.error("Camera cancelled or failed", e);
        }
    };

    const handleFileChange = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        const newAttachments = await Promise.all(files.map(async file => {
            const isPdf = file.type === 'application/pdf';
            const base64 = await readFileAsBase64(file);
            return {
                id: Date.now() + Math.random(),
                file,
                data: base64, 
                type: file.type,
                name: file.name,
                ocrText: '',
                ocrStatus: isPdf ? 'idle' : 'scanning' // Auto start scanning
            };
        }));

        setAttachments(prev => [...prev, ...newAttachments]);
        
        // Trigger background OCR for non-pdf
        newAttachments.forEach(att => {
            if (att.type !== 'application/pdf') {
                performOCR(att.id, att.data);
            }
        });
    };

    const performOCR = async (attId, base64Data) => {
        try {
            const result = await Tesseract.recognize(base64Data, 'chi_sim+eng', {
                logger: m => console.log(m)
            });
            const text = result.data.text;

            setAttachments(prev => prev.map(a => a.id === attId ? {
                ...a,
                ocrStatus: 'done',
                ocrText: text
            } : a));
            // Note: We do NOT append to formData.notes anymore.
            
        } catch (err) {
            console.error("OCR Failed", err);
            setAttachments(prev => prev.map(a => a.id === attId ? { ...a, ocrStatus: 'error' } : a));
        }
    };

    const readFileAsBase64 = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const removeAttachment = (id) => {
        const att = attachments.find(a => a.id === id);
        // Only track deletion if it was an existing attachment (has recordId)
        if (att && att.recordId) {
            setDeletedAttachmentIds(prev => [...prev, id]);
        }
        setAttachments(attachments.filter(a => a.id !== id));
    };


    const updateCostTotals = (items) => {
        const totals = items.reduce((acc, item) => {
            const self = parseFloat(item.self) || 0;
            const pool = parseFloat(item.pool) || 0;
            const personal = parseFloat(item.personal) || 0;
            return {
                self: acc.self + self,
                pool: acc.pool + pool,
                personal: acc.personal + personal,
                total: acc.total + (self + pool + personal)
            };
        }, { self: 0, pool: 0, personal: 0, total: 0 });

        return totals;
    };

    const handleCostItemChange = (itemId, field, value) => {
        const newItems = formData.cost_items.map(item => 
            item.id === itemId ? { ...item, [field]: value } : item
        );
        const totals = updateCostTotals(newItems);
        setFormData(prev => ({
            ...prev,
            cost_items: newItems,
            cost_self: totals.self,
            cost_pool: totals.pool,
            cost_personal: totals.personal,
            cost_total: totals.total
        }));
    };

    const addCostItem = () => {
        const index = formData.cost_items.length + 1;
        const newItems = [...formData.cost_items, { id: Date.now(), name: `费用明细 ${index}`, self: '', pool: '', personal: '' }];
        setFormData(prev => ({ ...prev, cost_items: newItems }));
    };

    const removeCostItem = (itemId) => {
        const itemToRemove = formData.cost_items.find(i => i.id === itemId);
        if (itemToRemove && itemToRemove.attachmentId) {
             // Also remove the attachment
             setAttachments(prev => prev.filter(a => a.id !== itemToRemove.attachmentId));
        }

        const newItems = formData.cost_items.filter(i => i.id !== itemId);
        const totals = updateCostTotals(newItems);
        setFormData(prev => ({
            ...prev,
            cost_items: newItems,
            cost_self: totals.self,
            cost_pool: totals.pool,
            cost_personal: totals.personal,
            cost_total: totals.total
        }));
    };


    const handleModuleOCR = async (e, fieldName, targetItemId = null) => {
        const file = e.target.files[0];
        if (!file) return;
        
        // Reset input immediately so change event fires again for same file
        e.target.value = '';

        try {
            const base64 = await readFileAsBase64(file);
            setCropImage(base64);
            setCropTarget({ fieldName, targetItemId, file, base64 }); // Store context
            setCropModalOpen(true);
        } catch (err) {
            console.error("Read file failed", err);
        }
    };

    const handleModuleCameraOCR = async (fieldName, targetItemId = null) => {
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
            
            // Create a fake file object for logic consistency (though cropTarget uses base64 mostly)
            const mockFile = {
                 name: `Camera_${Date.now()}.${image.format}`,
                 type: `image/${image.format}`
            };

            setCropImage(base64Data);
            setCropTarget({ fieldName, targetItemId, file: mockFile, base64: base64Data });
            setCropModalOpen(true);

        } catch (e) {
            console.error("Camera OCR failed", e);
        }
    };

    const confirmCropAndOCR = async () => {
        if (!cropTarget || !imgRef.current || !completedCrop) return;

        setCropModalOpen(false);
        const { fieldName, targetItemId, file, base64: originalBase64 } = cropTarget;
        
        const processId = targetItemId ? `${fieldName}_${targetItemId}` : fieldName;
        setProcessingModule(processId);

        try {
             // 1. Get Cropped Image Base64
             const croppedBase64 = getCroppedImg(imgRef.current, completedCrop);

             // 2. Add to attachments (Save ORIGINAL image, but use CROPPED for OCR logic?)
             // Usually users want to keep the full original record.
             const newAtt = {
                id: Date.now() + Math.random(),
                file,
                data: originalBase64, 
                type: file.type,
                name: `OCR_${fieldName === 'diagnosis' ? '诊断' : fieldName === 'medical_advice' ? '医嘱' : '费用'}_${file.name}`,
                ocrText: '', // Will update after OCR
                ocrStatus: 'scanning',
                module: fieldName // Tag it so we know where it came from if needed
             };
             
             // Check if we are replacing an existing attachment for a cost item
             let oldAttachmentId = null;
             if (targetItemId) {
                 const destItem = formData.cost_items.find(i => i.id === targetItemId);
                 if (destItem && destItem.attachmentId) {
                     oldAttachmentId = destItem.attachmentId;
                 }
             }

             setAttachments(prev => {
                 let list = prev;
                 if (oldAttachmentId) {
                     list = list.filter(a => a.id !== oldAttachmentId);
                 }
                 return [...list, newAtt];
             });

             // 3. Run OCR on CROPPED image
             const result = await Tesseract.recognize(croppedBase64, 'chi_sim+eng', {
                logger: m => console.log(m)
             });
             const text = result.data.text;
             
             // 4. Update Attachment Status
             setAttachments(prev => prev.map(a => a.id === newAtt.id ? { ...a, ocrStatus: 'done', ocrText: text } : a));

             // 5. Update Field Data
            if (fieldName === 'cost_ocr') {
                // Cost parsing logic for cost_ocr
                const lines = text.split('\n').filter(l => l.trim().length > 0);
                const findMoney = (keywords) => {
                    for (const line of lines) {
                        if (keywords.some(k => line.includes(k))) {
                            const match = line.match(/(\d+\.?\d*)/g);
                            if (match && match.length > 0) return match[match.length - 1];
                        }
                    }
                    return null;
                };

                const pool = findMoney(['统筹', '基金支付']) || 0;
                const personal = findMoney(['账户支付', '个账', '个人账户']) || 0;
                const self = findMoney(['自费', '现金', '个人支付']) || 0;
                
                if (targetItemId) {
                    // Update existing item
                    const newItems = formData.cost_items.map(item => {
                        if (item.id === targetItemId) {
                            return {
                                ...item,
                                self: self,
                                pool: pool,
                                personal: personal,
                                attachmentId: newAtt.id
                            };
                        }
                        return item;
                    });
                    const totals = updateCostTotals(newItems);
                    setFormData(prev => ({ 
                         ...prev, 
                         cost_items: newItems,
                         cost_self: totals.self,
                         cost_pool: totals.pool,
                         cost_personal: totals.personal,
                         cost_total: totals.total
                    }));
                } else {
                     // Should not really happen for cost_ocr now as we only use per-item button, but keep for safety
                }

            } else {
                 setFormData(prev => ({
                     ...prev,
                     [fieldName]: (prev[fieldName] || '') + (prev[fieldName] ? '\n' : '') + text
                 }));
             }

        } catch (err) {
            console.error(err);
            alert("识别失败: " + err.message);
        } finally {
            setProcessingModule(null);
            setCropTarget(null);
        }
    };
    
    // ... handleSubmit ...

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Save new Hospital
            // Prepend new entry to appear at top, remove duplicates
            if (formData.hospital && !SHANGHAI_HOSPITALS.includes(formData.hospital)) {
                // We don't save custom hospitals to a separate list yet, maybe we should? 
                // For now, let's just assume we want to save them if we had a mechanism (like custom_departments).
                // But user specifically asked for "Hospital manually entered... adds to dropdown".
                // SHANGHAI_HOSPITALS is a constant file, we can't write to it.
                // We need a 'custom_hospitals' in localStorage.
                const savedHospitals = JSON.parse(localStorage.getItem('custom_hospitals') || '[]');
                if (!savedHospitals.includes(formData.hospital)) {
                    // Prepend
                    const newHospitals = [formData.hospital, ...savedHospitals];
                    localStorage.setItem('custom_hospitals', JSON.stringify(newHospitals));
                }
            }

            // Save new Department
            if (formData.department && !deptOptions.includes(formData.department)) {
                const savedDepts = JSON.parse(localStorage.getItem('custom_departments') || '[]');
                // Check if already in saved list to avoid duplicates
                const uniqueDepts = savedDepts.filter(d => d !== formData.department);
                // Prepend
                const newDepts = [formData.department, ...uniqueDepts];
                localStorage.setItem('custom_departments', JSON.stringify(newDepts));
            }

             // Save new Doctor
            if (formData.doctor && !doctorOptions.includes(formData.doctor)) {
                const savedDoctors = JSON.parse(localStorage.getItem('custom_doctors') || '[]');
                const uniqueDoctors = savedDoctors.filter(d => d !== formData.doctor);
                // Prepend
                const newDoctors = [formData.doctor, ...uniqueDoctors];
                localStorage.setItem('custom_doctors', JSON.stringify(newDoctors));
            }

            // Fix map to preserve ID and recordId
            const dbAttachments = attachments.map(a => ({
                ...a, // Preserve original properties
            }));


            if (isEditMode) {
                // Now existing attachments HAVE recordId, new ones DON'T.
                const newAtts = dbAttachments.filter(a => !a.recordId); 
                
                await updateRecord(parseInt(id), formData, newAtts, deletedAttachmentIds);
            } else {
                await addRecord(formData, dbAttachments);
            }
            navigate('/');
        } catch (err) {
            console.error(err);
            alert('保存失败: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const renderModuleThumbnails = (moduleName) => {
        if (moduleName === 'cost_ocr') {
            // Sort by cost items order
             if (!formData.cost_items || formData.cost_items.length === 0) return null;

             return (
                <div className="flex" style={{ gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                    {formData.cost_items.map((item, index) => {
                        if (!item.attachmentId) return null;
                        const att = attachments.find(a => a.id === item.attachmentId);
                        if (!att) return null; 

                        const label = item.name || `费用明细 ${index + 1}`;

                        return (
                            <div key={att.id} style={{ position: 'relative', width: '60px', height: '60px', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                                <img 
                                    src={att.data} 
                                    alt="thumbnail" 
                                style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }} 
                                onClick={() => setPreviewImage(att.data)}
                            />
                                <div style={{ 
                                    position: 'absolute', bottom: 0, left: 0, right: 0, 
                                    background: 'rgba(0,0,0,0.6)', color: 'white', 
                                    fontSize: '8px', textAlign: 'center', padding: '2px 0',
                                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                                }}>
                                    {label}
                                </div>
                                <button 
                                    type="button"
                                    onClick={() => removeAttachment(att.id)}
                                    style={{ 
                                        position: 'absolute', top: 0, right: 0, 
                                        background: 'rgba(0,0,0,0.6)', color: 'white', 
                                        border: 'none', cursor: 'pointer', padding: '1px',
                                        width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}
                                >
                                    <X size={10} />
                                </button>
                            </div>
                        );
                    })}
                </div>
             );
        }

        const moduleAttachments = attachments.filter(a => a.module === moduleName);
        if (moduleAttachments.length === 0) return null;

        return (
            <div className="flex" style={{ gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                {moduleAttachments.map(att => {
                    return (
                        <div key={att.id} style={{ position: 'relative', width: '60px', height: '60px', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                            <img 
                                src={att.data} 
                                alt="thumbnail" 
                                style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }} 
                                onClick={() => setPreviewImage(att.data)}
                            />
                             <button 
                                type="button"
                                onClick={() => removeAttachment(att.id)} 
                                style={{ 
                                    position: 'absolute', top: 0, right: 0, 
                                    background: 'rgba(0,0,0,0.6)', color: 'white', 
                                    border: 'none', cursor: 'pointer', padding: '1px',
                                    width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}
                            >
                                <X size={10} />
                            </button>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="container" style={{ paddingBottom: '100px' }}>
            <div className="flex-between mb-4">
                <h2>{isEditMode ? '编辑记录' : '记录就医信息'}</h2>
                {isEditMode && <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => navigate(-1)} style={{ width: 'auto' }}>取消</button>}
            </div>


            <form onSubmit={handleSubmit}>
                <div className="card">
                    <label className="text-sm text-muted mb-1 block">日期时间</label>
                    <input
                        type="datetime-local"
                        value={formData.date}
                        onChange={e => setFormData({ ...formData, date: e.target.value })}
                        required
                        style={{
                            width: '100%',
                            padding: '12px',
                            borderRadius: '8px',
                            border: '1px solid var(--border)',
                            background: 'var(--surface)',
                            fontSize: '1rem', // Larger font for easier tapping
                            color: 'var(--text-main)',
                            boxSizing: 'border-box',
                            marginBottom: '1.5rem',
                            appearance: 'none' // Remove default browser styling if any
                        }}
                    />
                    
                    <AutoCompleteInput
                        label="医院"
                        placeholder="例如：瑞金医院 (可手动输入)"
                        value={formData.hospital}
                        onChange={val => setFormData(prev => ({ ...prev, hospital: val }))}
                        options={hospitalOptions}
                    />

                    <div className="flex g-4 mb-4" style={{ gap: '1rem' }}>
                        <div style={{ flex: 1 }}>
                            <label className="text-sm text-muted mb-1 block">科室</label>
                            <AutoCompleteInput
                                placeholder="例如：内科"
                                value={formData.department}
                                onChange={val => setFormData(prev => ({ ...prev, department: val }))}
                                options={deptOptions}
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label className="text-sm text-muted mb-1 block">医生</label>
                            <AutoCompleteInput
                                placeholder="例如：张三"
                                value={formData.doctor}
                                onChange={val => setFormData(prev => ({ ...prev, doctor: val }))}
                                options={doctorOptions}
                            />
                        </div>
                    </div>

                    <div className="mb-4">
                        <label className="text-sm text-muted mb-1 block">类型</label>
                        <select
                            value={formData.type}
                            onChange={e => setFormData({ ...formData, type: e.target.value })}
                        >
                            <option>首次就诊</option>
                            <option>急诊</option>
                            <option>复诊</option>
                            <option>体检</option>
                            <option>理疗</option>
                            <option>开检查</option>
                        </select>
                    </div>

                    <label className="text-sm text-muted mb-1 block">摘要/诊断 (标题)</label>
                    <input
                        type="text"
                        placeholder="例如：急性肠胃炎"
                        value={formData.title}
                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                        className="mb-4"
                    />



                    {/* NEW: Diagnosis Module */}
                    <div className="card" style={{ padding: '10px', marginBottom: '1rem', border: '1px solid var(--border)' }}>
                        <div className="flex-between mb-2">
                             <label className="text-sm text-muted block" style={{ fontWeight: 600 }}>详细诊断</label>
                             <div className="flex" style={{gap:'8px'}}>
                                <button type="button" className="btn btn-secondary text-xs" style={{ width: 'auto', padding: '4px 8px' }} onClick={() => setExpandedField('diagnosis')}>
                                    <Maximize2 size={14} style={{ marginRight: '4px' }} />
                                    展开
                                </button>
                                <button type="button" className={`btn ${processingModule === 'diagnosis' ? 'btn-disabled' : 'btn-secondary'} text-xs`} style={{ width: 'auto', padding: '4px 8px' }} onClick={() => handleModuleCameraOCR('diagnosis')} disabled={processingModule === 'diagnosis'}>
                                    {processingModule === 'diagnosis' ? <Loader size={14} className="spinner" style={{ marginRight: '4px' }} /> : <Camera size={14} style={{ marginRight: '4px' }} />}
                                    {processingModule === 'diagnosis' ? '识别中...' : '拍照/上传'}
                                </button>
                             </div>
                        </div>
                        <textarea
                            rows={3}
                            placeholder="手动输入或通过拍照识别填充诊断信息..."
                            value={formData.diagnosis || ''}
                            onChange={e => setFormData({ ...formData, diagnosis: e.target.value })}
                        />
                        {renderModuleThumbnails('diagnosis')}
                    </div>

                    {/* NEW: Medical Advice Module */}
                    <div className="card" style={{ padding: '10px', marginBottom: '1rem', border: '1px solid var(--border)' }}>
                         <div className="flex-between mb-2">
                             <label className="text-sm text-muted block" style={{ fontWeight: 600 }}>医嘱 / 处方</label>
                             <div className="flex" style={{gap:'8px'}}>
                                <button type="button" className="btn btn-secondary text-xs" style={{ width: 'auto', padding: '4px 8px' }} onClick={() => setExpandedField('medical_advice')}>
                                    <Maximize2 size={14} style={{ marginRight: '4px' }} />
                                    展开
                                </button>
                                <button type="button" className={`btn ${processingModule === 'medical_advice' ? 'btn-disabled' : 'btn-secondary'} text-xs`} style={{ width: 'auto', padding: '4px 8px' }} onClick={() => handleModuleCameraOCR('medical_advice')} disabled={processingModule === 'medical_advice'}>
                                    {processingModule === 'medical_advice' ? <Loader size={14} className="spinner" style={{ marginRight: '4px' }} /> : <Camera size={14} style={{ marginRight: '4px' }} />}
                                    {processingModule === 'medical_advice' ? '识别中...' : '拍照/上传'}
                                </button>
                             </div>
                        </div>
                        <textarea
                            rows={3}
                            placeholder="手动输入或通过拍照识别填充医嘱信息..."
                            value={formData.medical_advice || ''}
                            onChange={e => setFormData({ ...formData, medical_advice: e.target.value })}
                        />
                        {renderModuleThumbnails('medical_advice')}
                    </div>

                    {/* NEW: Cost Module */}
                    <div className="card" style={{ padding: '10px', marginBottom: '1rem', border: '1px solid var(--border)' }}>
                        <div className="flex-between mb-2">
                             <label className="text-sm text-muted block" style={{ fontWeight: 600 }}>医疗费用</label>
                        </div>
                        
                        {/* Cost Items List */}
                        {formData.cost_items && formData.cost_items.map((item, index) => (
                             <div key={item.id} style={{ background: 'var(--surface-muted)', borderRadius: '8px', padding: '8px', marginBottom: '8px', position: 'relative' }}>
                                 <div className="flex-between mb-1">
                                     <input 
                                        type="text" 
                                        value={item.name || ''} 
                                        placeholder={`费用明细 ${index + 1}`}
                                        onChange={(e) => handleCostItemChange(item.id, 'name', e.target.value)}
                                        style={{ 
                                            background: 'rgba(0,0,0,0.03)', 
                                            border: 'none', 
                                            borderBottom: '1px solid var(--border)', 
                                            borderRadius: '4px 4px 0 0',
                                            fontSize: '0.9rem', 
                                            color: 'var(--text-main)',
                                            width: '140px',
                                            padding: '4px 8px',
                                            outline: 'none',
                                            transition: 'all 0.2s'
                                        }} 
                                        onFocus={(e) => { e.target.style.borderBottomColor = 'var(--primary)'; e.target.style.background = 'rgba(0,0,0,0.05)'; }}
                                        onBlur={(e) => { e.target.style.borderBottomColor = 'var(--border)'; e.target.style.background = 'rgba(0,0,0,0.03)'; }}
                                     />
                                     <div className="flex" style={{gap:'8px'}}>
                                         <button type="button" className={`btn btn-secondary text-xs ${processingModule === `cost_ocr_${item.id}` ? 'btn-disabled' : ''}`} style={{ width: 'auto', padding: '2px 6px', height: 'auto' }} onClick={() => handleModuleCameraOCR('cost_ocr', item.id)} disabled={processingModule === `cost_ocr_${item.id}`}>
                                            {processingModule === `cost_ocr_${item.id}` ? <Loader size={12} className="spinner" /> : <Camera size={12} />}
                                         </button>
                                        <button type="button" onClick={() => removeCostItem(item.id)} style={{ color: 'var(--text-secondary)', padding: 0, background: 'none', border: 'none' }}>
                                            <X size={14} />
                                        </button>
                                     </div>
                                 </div>
                                 <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                                     <div>
                                         <label className="text-xs text-muted">个人自费</label>
                                         <input type="number" step="0.01" value={item.self} onChange={e => handleCostItemChange(item.id, 'self', e.target.value)} placeholder="0" style={{ fontSize: '0.9rem', padding: '4px' }}/>
                                     </div>
                                     <div>
                                          <label className="text-xs text-muted">医保统筹</label>
                                         <input type="number" step="0.01" value={item.pool} onChange={e => handleCostItemChange(item.id, 'pool', e.target.value)} placeholder="0" style={{ fontSize: '0.9rem', padding: '4px' }}/>
                                     </div>
                                     <div>
                                          <label className="text-xs text-muted">医保个账</label>
                                         <input type="number" step="0.01" value={item.personal} onChange={e => handleCostItemChange(item.id, 'personal', e.target.value)} placeholder="0" style={{ fontSize: '0.9rem', padding: '4px' }}/>
                                     </div>
                                 </div>
                             </div>
                        ))}

                        <button type="button" className="btn btn-outline text-xs mb-3" onClick={addCostItem} style={{ width: '100%', borderStyle: 'dashed' }}>
                            + 添加一笔费用
                        </button>

                         {/* Summary */}
                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
                             <label className="text-xs text-muted block mb-2">汇总 (自动计算)</label>
                             <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                <div>
                                    <span className="text-xs text-muted block">总金额</span>
                                    <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>￥{parseFloat(formData.cost_total || 0).toFixed(2)}</span>
                                </div>
                                <div>
                                    <span className="text-xs text-muted block">个人自费</span>
                                     <span className="text-sm">￥{parseFloat(formData.cost_self || 0).toFixed(2)}</span>
                                </div>
                                <div>
                                    <span className="text-xs text-muted block">医保统筹</span>
                                     <span className="text-sm">￥{parseFloat(formData.cost_pool || 0).toFixed(2)}</span>
                                </div>
                                <div>
                                    <span className="text-xs text-muted block">医保个账</span>
                                     <span className="text-sm">￥{parseFloat(formData.cost_personal || 0).toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        {renderModuleThumbnails('cost_ocr')}
                    </div>

                    <label className="text-sm text-muted mb-1 block">其他备注</label>
                    <textarea
                        rows={4}
                        value={formData.notes}
                        onChange={e => setFormData({ ...formData, notes: e.target.value })}
                        className="mb-4"
                    />
                </div>

                <div className="card">
                    <div className="flex-between mb-2">
                        <h3 className="text-sm">票据/报告 附件 (通用)</h3>

                        <div className="flex" style={{ gap: '8px' }}>
                             <button type="button" className="btn btn-secondary text-sm" style={{ width: 'auto', padding: '0.4rem 0.8rem' }} onClick={handleCameraCapture}>
                                <Camera size={16} style={{ marginRight: '4px' }} />
                                拍照/上传
                            </button>
                        </div>
                    </div>


                    <div className="grid g-2">
                        {attachments.filter(att => !att.module).map(att => ( // Filter out module attachments
                            <div key={att.id} style={{ position: 'relative', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                                {att.type === 'application/pdf' ? (
                                    <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', flexDirection: 'column' }}>
                                        <FileText size={48} className="text-secondary" />
                                        <span className="text-xs text-muted mt-2">{att.name}</span>
                                    </div>
                                ) : (
                                    <img src={att.data} alt="preview" style={{ width: '100%', height: '200px', objectFit: 'cover' }} onClick={() => setPreviewImage(att.data)} />
                                )}

                                <div style={{ position: 'absolute', top: '4px', right: '4px' }}>
                                    <button type="button" onClick={() => removeAttachment(att.id)} style={{ background: 'rgba(0,0,0,0.5)', color: 'white', borderRadius: '50%', padding: '4px', width: '24px', height: '24px' }}>
                                        <X size={16} />
                                    </button>
                                </div>

                                <div style={{ padding: '8px', background: 'var(--surface)' }}>
                                    <div className="flex-between">
                                        <div className="flex items-center" style={{gap:'6px'}}>
                                            <span className="text-xs text-muted">{att.type === 'application/pdf' ? '文档' : '图片'}</span>
                                            {att.ocrStatus === 'scanning' && <span className="text-xs text-muted flex items-center"><Loader size={10} className="spinner" style={{marginRight:'2px'}}/>识别中...</span>}
                                        </div>
                                        
                                        {att.type !== 'application/pdf' && att.ocrText && (
                                            <button
                                                type="button"
                                                className="btn btn-secondary"
                                                style={{ fontSize: '10px', padding: '4px 8px', width: 'auto' }}
                                                onClick={() => setOcrModalText(att.ocrText)}
                                            >
                                                <FileText size={12} />
                                                <span style={{ marginLeft: '4px' }}>查看识别文本</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <button type="submit" className="btn btn-primary" disabled={loading} style={{ height: '50px', fontSize: '1.1rem' }}>
                    {loading ? '保存中...' : (isEditMode ? '更新记录' : '保存记录')}
                </button>
            </form>

            {/* EXPANDED TEXT MODAL */}
            {expandedField && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 3000, display: 'flex', alignItems: 'end', justifyContent: 'center' }}>
                     <div className="card" style={{ 
                         width: '100%', 
                         height: '80vh', 
                         margin: 0, 
                         borderRadius: '16px 16px 0 0', 
                         display: 'flex', 
                         flexDirection: 'column',
                         animation: 'slideUp 0.3s ease-out'
                     }}>
                        <div className="flex-between mb-4">
                            <h3>编辑{expandedField === 'diagnosis' ? '诊断' : '医嘱'}</h3>
                            <button className="btn btn-secondary" style={{ width: 'auto' }} onClick={() => setExpandedField(null)}>完成</button>
                        </div>
                        <textarea
                            style={{ flex: 1, fontSize: '1rem', lineHeight: '1.6', padding: '1rem', border: '1px solid var(--border)', borderRadius: '8px', resize: 'none' }}
                            value={formData[expandedField] || ''}
                            onChange={(e) => setFormData({ ...formData, [expandedField]: e.target.value })}
                            placeholder="在此输入详细内容..."
                            autoFocus
                        />
                     </div>
                </div>
            )}

            {/* OCR TEXT MODAL */}
            {ocrModalText !== null && (
                 <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 3500, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setOcrModalText(null)}>
                      <div className="card" style={{ width: '90%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
                           <div className="flex-between mb-2">
                               <h3>识别文本 (可复制)</h3>
                               <button onClick={() => setOcrModalText(null)} style={{ background: 'none', border:'none' }}><X size={20}/></button>
                           </div>
                           <textarea
                                readOnly
                                value={ocrModalText}
                                style={{ flex: 1, minHeight: '300px', padding: '10px', fontSize: '0.9rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                           />
                           <div className="text-xs text-muted mt-2">长按文本进行选择和复制</div>
                      </div>
                 </div>
            )}

            {/* CROP MODAL */}
            {cropModalOpen && (
                 <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 4000, display: 'flex', flexDirection: 'column' }}>
                      <div className="flex-between" style={{ padding: '1rem', color: 'white' }}>
                          <h3>选择识别区域</h3>
                          <button onClick={() => { setCropModalOpen(false); setCropImage(null); }} style={{ background: 'transparent', border: 'none', color: 'white' }}><X size={24} /></button>
                      </div>
                      
                      <div style={{ flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', padding: '10px' }}>
                          {cropImage && (
                            <ReactCrop crop={crop} onChange={c => setCrop(c)} onComplete={c => setCompletedCrop(c)}>
                                <img ref={imgRef} src={cropImage} onLoad={onImageLoad} style={{ maxWidth: '100%', maxHeight: '70vh' }} />
                            </ReactCrop>
                          )}
                      </div>

                      <div style={{ padding: '1rem', background: 'var(--surface)', display: 'flex', gap: '10px' }}>
                          <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setCropModalOpen(false)}>取消</button>
                          <button className="btn btn-primary" style={{ flex: 1 }} onClick={confirmCropAndOCR}>
                              <ScanLine size={16} style={{ marginRight: '6px' }} />
                              确认选区并识别
                          </button>
                      </div>
                 </div>
            )}


            {/* IMAGE PREVIEW MODAL */}
            {previewImage && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 4000, background: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                     <TransformWrapper>
                        <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }} contentStyle={{ width: "100%", height: "100%" }}>
                            <img src={previewImage} style={{ width: '100vw', height: '100vh', objectFit: 'contain' }} />
                        </TransformComponent>
                     </TransformWrapper>
                     
                     <a 
                        href={previewImage} 
                        download={`preview_${Date.now()}.png`}
                        onClick={(e) => e.stopPropagation()}
                        style={{ position: 'absolute', top: 20, right: 80, background: 'rgba(255,255,255,0.2)', borderRadius: '50%', padding: '10px', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 4001 }}
                    >
                        <Download size={24}/>
                    </a>

                     <button style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.2)', borderRadius: '50%', padding: '10px', color: 'white', zIndex: 4001 }} onClick={() => setPreviewImage(null)}>
                        <X size={24}/>
                     </button>
                </div>
            )}
        </div>
    );
};

export default AddRecord;
