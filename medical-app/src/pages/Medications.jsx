import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getActiveMedications, getAllMedications, stopMedication, deleteMedication, getTodayLogs, addMedicationLog, deleteMedicationLog } from '../db';
import { Plus, Pill, Clock, Calendar, AlertCircle, Check, X, Edit, Trash2, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { cancelMedicationReminders } from '../utils/notifications';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

// Long Press Button Component
const DoseItem = ({ dose, medId, onToggle }) => {
    const [progress, setProgress] = useState(0);
    const [isPressing, setIsPressing] = useState(false);
    const [dimensions, setDimensions] = useState({ width: 0, height: 46 });
    
    const requestRef = React.useRef();
    const startTimeRef = React.useRef();
    const hapticIntervalRef = React.useRef();
    const wrapperRef = React.useRef(null);
    
    // Config
    const PRESS_DURATION = 800; // ms
    
    const startPress = () => {
        if (dose.isTaken) {
            // If already taken, just simple click/confirm to undo
            if(confirm('撤销此打卡记录？')) {
                onToggle(medId, dose.time);
            }
            return;
        }

        // Measure current size for SVG path
        if (wrapperRef.current) {
            setDimensions({
                width: wrapperRef.current.offsetWidth,
                height: wrapperRef.current.offsetHeight
            });
        }

        // Clear any previous interval to be safe
        if (hapticIntervalRef.current) clearInterval(hapticIntervalRef.current);

        setIsPressing(true);
        startTimeRef.current = Date.now();
        setProgress(0);
        
        // Haptic feedback loop during press
        hapticIntervalRef.current = setInterval(() => {
            Haptics.impact({ style: ImpactStyle.Light });
        }, 150);

        const animate = () => {
            const elapsed = Date.now() - startTimeRef.current;
            const newProgress = Math.min((elapsed / PRESS_DURATION) * 100, 100);
            
            setProgress(newProgress);
            
            if (newProgress < 100) {
                requestRef.current = requestAnimationFrame(animate);
            } else {
                // Completed!
                triggerComplete();
            }
        };
        
        requestRef.current = requestAnimationFrame(animate);
    };

    const cancelPress = () => {
        setIsPressing(false);
        setProgress(0);
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
        if (hapticIntervalRef.current) clearInterval(hapticIntervalRef.current);
        hapticIntervalRef.current = null;
    };

    const triggerComplete = async () => {
        // Stop Loop Haptics FIRST
        if (hapticIntervalRef.current) clearInterval(hapticIntervalRef.current);
        hapticIntervalRef.current = null;
        if (requestRef.current) cancelAnimationFrame(requestRef.current);

        setIsPressing(false);
        
        // Success Haptic
        await Haptics.notification({ type: 'SUCCESS' }); 
        
        onToggle(medId, dose.time);
    };

    // Calculate SVG Path for Capsule (Rect with fully rounded corners)
    const strokeWidth = 4;
    // We draw inside the box, so reduce dimensions by strokeWidth
    const w = dimensions.width - strokeWidth;
    const h = dimensions.height - strokeWidth;
    const r = h / 2; // Radius is half height
    
    // Perimeter of a capsule: 2 * (length of straight part) + circumference of full circle parts
    // Straight part length = w - 2*r
    // Circle parts combined = 2 * PI * r
    const perimeter = 2 * (w - 2 * r) + 2 * Math.PI * r;
    
    const strokeDashoffset = perimeter - (progress / 100) * perimeter;

    return (
        <div 
            ref={wrapperRef}
            className="dose-item-wrapper"
            style={{ position: 'relative', userSelect: 'none', WebkitUserSelect: 'none' }}
            onMouseDown={startPress}
            onMouseUp={cancelPress}
            onMouseLeave={cancelPress}
            onTouchStart={startPress}
            onTouchEnd={cancelPress}
            onContextMenu={e => e.preventDefault()}
        >
            {/* Background & Border */}
            <div style={{
                height: '46px',
                padding: '0 16px 0 12px',
                borderRadius: '23px',
                background: dose.isTaken ? '#ECFDF5' : (dose.isPast ? '#FFFBEB' : 'white'),
                border: dose.isTaken ? '1px solid #10B981' : (dose.isPast ? '1px solid #F59E0B' : '1px solid #E2E8F0'),
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s',
                transform: isPressing ? 'scale(0.98)' : 'scale(1)',
                position: 'relative',
                overflow: 'hidden',
                zIndex: 2
            }}>
                {/* Status Icon */}
                <div style={{
                    width: '24px', height: '24px',
                    borderRadius: '50%',
                    background: dose.isTaken ? '#10B981' : (dose.isPast ? '#F59E0B' : '#F1F5F9'),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white',
                    transition: 'all 0.3s'
                }}>
                    {dose.isTaken ? <Check size={14} strokeWidth={3} /> : <Clock size={14} />}
                </div>

                {/* Text Info */}
                <div className="flex flex-col">
                    <span style={{ 
                        fontSize: '0.9rem', 
                        fontWeight: 700,
                        color: dose.isTaken ? '#065F46' : '#1E293B',
                        textDecoration: dose.isTaken ? 'line-through' : 'none'
                    }}>
                        {dose.time}
                    </span>
                    <span style={{
                        fontSize: '0.65rem',
                        fontWeight: 600,
                        color: dose.isTaken ? '#059669' : (isPressing ? '#3B82F6' : '#94A3B8'),
                        transition: 'color 0.2s'
                    }}>
                        {dose.isTaken ? '已服药' : (isPressing ? '保持按住...' : (dose.isPast ? '未打卡' : '长按打卡'))}
                    </span>
                </div>
            </div>

            {/* Progress Ring (Absolute Overlay) */}
            {!dose.isTaken && isPressing && dimensions.width > 0 && (
                <svg
                    width={dimensions.width} 
                    height={dimensions.height}
                    style={{
                        position: 'absolute',
                        top: 0, left: 0,
                        zIndex: 1, // Under the content div? No, wrapper zIndex needs handling.
                        // Actually, content div is zIndex 2 (opaque bg). 
                        // To show progress BORDER, we need this SVG to be ON TOP of content div
                        // BUT content div has background color...
                        // So SVG must be zIndex 3, and content div background transparent? No.
                        // Let's make SVG zIndex 3, fill transparent, stroke visible.
                        pointerEvents: 'none',
                        overflow: 'visible'
                    }}
                >
                    <rect
                        x={strokeWidth / 2}
                        y={strokeWidth / 2}
                        width={dimensions.width - strokeWidth}
                        height={dimensions.height - strokeWidth}
                        rx={(dimensions.height - strokeWidth) / 2}
                        fill="none"
                        stroke="#3B82F6" // Progress Color
                        strokeWidth={strokeWidth}
                        strokeDasharray={perimeter}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                    />
                </svg>
            )}
        </div>
    );
};

const Medications = () => {
    const navigate = useNavigate();
    const [medications, setMedications] = useState([]);
    const [logs, setLogs] = useState([]);
    const [filter, setFilter] = useState('active'); // 'active' | 'all'
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, [filter]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [meds, todayLogs] = await Promise.all([
                filter === 'active' ? getActiveMedications() : getAllMedications(),
                getTodayLogs()
            ]);
            setMedications(meds);
            setLogs(todayLogs);
        } catch (e) {
            console.error('Load medications failed', e);
        } finally {
            setLoading(false);
        }
    };

    const handleStop = async (id) => {
        if (confirm('确定要停止此用药提醒吗？')) {
            await stopMedication(id);
            await cancelMedicationReminders(id);
            await Haptics.impact({ style: ImpactStyle.Light });
            loadData();
        }
    };

    const handleDelete = async (id) => {
        if (confirm('确定要删除此用药记录吗？此操作不可恢复！')) {
            await deleteMedication(id);
            await cancelMedicationReminders(id);
            await Haptics.impact({ style: ImpactStyle.Light });
            loadData();
        }
    };

    const handleToggleLog = async (medId, time) => {
        const today = format(new Date(), 'yyyy-MM-dd');
        const taken = logs.find(l => l.medicationId === medId && l.time === time);
        
        try {
            if (taken) {
                 if(confirm('撤销此打卡记录？')) {
                     await deleteMedicationLog({ medicationId: medId, date: today, time });
                     await Haptics.impact({ style: ImpactStyle.Light });
                 }
            } else {
                 await addMedicationLog({ medicationId: medId, date: today, time, status: 'taken' });
                 await Haptics.impact({ style: ImpactStyle.Heavy });
            }
            const newLogs = await getTodayLogs();
            setLogs(newLogs);
        } catch (e) {
            console.error(e);
        }
    };

    const getTodayDoses = (med) => {
        if (!med.times || med.times.length === 0) return [];
        const now = new Date();
        const today = format(now, 'yyyy-MM-dd');
        
        return med.times.map(time => {
            const [hour, minute] = time.split(':');
            const doseTime = new Date();
            doseTime.setHours(hour, minute, 0);
            const isTaken = logs.some(l => l.medicationId === med.id && l.time === time);
            
            return {
                time,
                isPast: doseTime < now,
                isComing: doseTime > now && (doseTime - now) < 3600000, // Within 1 hour
                isTaken
            };
        });
    };

    const getDaysRemaining = (med) => {
        const today = new Date();
        const end = new Date(med.endDate);
        const diff = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
        return diff > 0 ? diff : 0;
    };

    const renderMedicationCard = (med) => {
        const todayDoses = getTodayDoses(med);
        const daysLeft = getDaysRemaining(med);
        const isActive = med.status === 'active';

        return (
            <div 
                key={med.id} 
                className="card" 
                style={{ 
                    marginBottom: '16px',
                    padding: 0,
                    overflow: 'hidden',
                    border: 'none',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    opacity: isActive ? 1 : 0.6
                }}
            >
                {/* Header */}
                <div style={{ 
                    padding: '16px 20px', 
                    borderBottom: '1px solid #F1F5F9',
                    background: isActive ? 'white' : '#F8FAFC'
                }}>
                    <div className="flex-between" style={{ marginBottom: '8px' }}>
                        <div className="flex items-center" style={{ gap: '12px' }}>
                            <div style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '12px',
                                background: isActive ? 'linear-gradient(135deg, #EFF6FF, #DBEAFE)' : '#E2E8F0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <Pill size={24} style={{ color: isActive ? '#3B82F6' : '#64748B' }} />
                            </div>
                            <div>
                                <h3 style={{ 
                                    margin: 0, 
                                    fontSize: '1.1rem', 
                                    fontWeight: 600,
                                    color: '#0F172A'
                                }}>
                                    {med.name}
                                </h3>
                                <div style={{ 
                                    fontSize: '0.85rem', 
                                    color: '#64748B', 
                                    marginTop: '2px' 
                                }}>
                                    {med.dosage} × {med.frequency || '每日服用'}
                                </div>
                            </div>
                        </div>
                        
                        <div style={{
                            padding: '4px 12px',
                            borderRadius: '99px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            background: isActive ? '#ECFDF5' : '#F1F5F9',
                            color: isActive ? '#059669' : '#64748B'
                        }}>
                            {med.status === 'active' && '进行中'}
                            {med.status === 'completed' && '已完成'}
                            {med.status === 'stopped' && '已停药'}
                        </div>
                    </div>

                    {med.usage && (
                        <div style={{ 
                            padding: '8px 12px',
                            background: '#F8FAFC',
                            borderRadius: '8px',
                            fontSize: '0.85rem',
                            color: '#475569'
                        }}>
                            💊 {med.usage}
                        </div>
                    )}
                </div>

                {/* Today's doses timeline */}
                {isActive && todayDoses.length > 0 && (
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9' }}>
                        <div style={{ 
                            fontSize: '0.8rem', 
                            color: '#64748B', 
                            marginBottom: '12px',
                            fontWeight: 600
                        }}>
                            今日服药时间
                        </div>
                        <div className="flex" style={{ gap: '12px', flexWrap: 'wrap' }}>
                            {todayDoses.map((dose, idx) => (
                                <DoseItem 
                                    key={idx} 
                                    dose={dose} 
                                    medId={med.id} 
                                    onToggle={handleToggleLog} 
                                />
                            ))}
                        </div>


                    </div>
                )}

                {/* Progress & Actions */}
                <div style={{ padding: '16px 20px' }}>
                    <div className="flex-between" style={{ marginBottom: '12px' }}>
                        <div style={{ fontSize: '0.85rem', color: '#64748B' }}>
                            <Calendar size={14} style={{ display: 'inline', marginRight: '6px' }} />
                            {format(new Date(med.startDate), 'MM月dd日', { locale: zhCN })} - {format(new Date(med.endDate), 'MM月dd日', { locale: zhCN })}
                        </div>
                        {isActive && daysLeft > 0 &&
 (
                            <div style={{ 
                                fontSize: '0.85rem', 
                                fontWeight: 600,
                                color: daysLeft <= 3 ? '#F59E0B' : '#3B82F6'
                            }}>
                                剩余 {daysLeft} 天
                            </div>
                        )}
                    </div>

                    <div className="flex" style={{ gap: '8px' }}>
                        <button 
                            className="btn btn-outline text-sm"
                            style={{ flex: 1, padding: '8px' }}
                            onClick={() => navigate(`/medications/edit/${med.id}`)}
                        >
                            <Edit size={14} style={{ marginRight: '6px' }} />
                            编辑
                        </button>
                        {isActive && (
                            <button 
                                className="btn text-sm"
                                style={{ 
                                    flex: 1, 
                                    padding: '8px',
                                    background: '#FEF2F2',
                                    color: '#EF4444',
                                    border: 'none'
                                }}
                                onClick={() => handleStop(med.id)}
                            >
                                <X size={14} style={{ marginRight: '6px' }} />
                                停药
                            </button>
                        )}
                        {!isActive && (
                            <button 
                                className="btn text-sm"
                                style={{ 
                                    flex: 1, 
                                    padding: '8px',
                                    background: '#FEE2E2',
                                    color: '#DC2626',
                                    border: 'none'
                                }}
                                onClick={() => handleDelete(med.id)}
                            >
                                <Trash2 size={14} style={{ marginRight: '6px' }} />
                                删除
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="container" style={{ paddingBottom: '100px' }}>
            {/* Header */}
            <div style={{ 
                paddingTop: '40px', 
                paddingBottom: '24px'
            }}>
                <h1 style={{ 
                    fontSize: '1.875rem', 
                    fontWeight: 700, 
                    margin: '0 0 16px 0',
                    color: '#0F172A'
                }}>
                    用药提醒
                </h1>

                {/* Filter Tabs */}
                <div className="flex" style={{ gap: '12px' }}>
                    <button
                        onClick={() => setFilter('active')}
                        style={{
                            padding: '10px 20px',
                            borderRadius: '99px',
                            border: 'none',
                            background: filter === 'active' ? '#3B82F6' : '#F1F5F9',
                            color: filter === 'active' ? 'white' : '#64748B',
                            fontWeight: 600,
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        进行中
                    </button>
                    <button
                        onClick={() => setFilter('all')}
                        style={{
                            padding: '10px 20px',
                            borderRadius: '99px',
                            border: 'none',
                            background: filter === 'all' ? '#3B82F6' : '#F1F5F9',
                            color: filter === 'all' ? 'white' : '#64748B',
                            fontWeight: 600,
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        全部
                    </button>
                </div>
            </div>

            {/* Medications List */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94A3B8' }}>
                    <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
                    加载中...
                </div>
            ) : medications.length === 0 ? (
                <div style={{ 
                    textAlign: 'center', 
                    padding: '80px 20px',
                    color: '#94A3B8'
                }}>
                    <div style={{ fontSize: '3rem', marginBottom: '16px', opacity: 0.3 }}>💊</div>
                    <div style={{ fontSize: '1rem', marginBottom: '8px' }}>还没有用药记录</div>
                    <div style={{ fontSize: '0.85rem' }}>点击下方按钮添加第一条用药提醒</div>
                </div>
            ) : (
                medications.map(renderMedicationCard)
            )}

            {/* Floating Add Button */}
            <button
                onClick={() => navigate('/medications/add')}
                style={{
                    position: 'fixed',
                    bottom: '80px',
                    right: '20px',
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
                    border: 'none',
                    boxShadow: '0 8px 20px rgba(59, 130, 246, 0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    zIndex: 100
                }}
                onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.9)'}
                onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
                <Plus size={28} color="white" strokeWidth={3} />
            </button>
        </div>
    );
};

export default Medications;
