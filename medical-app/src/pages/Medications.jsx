import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getActiveMedications, getAllMedications, stopMedication, deleteMedication } from '../db';
import { Plus, Pill, Clock, Calendar, AlertCircle, Check, X, Edit, Trash2, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

const Medications = () => {
    const navigate = useNavigate();
    const [medications, setMedications] = useState([]);
    const [filter, setFilter] = useState('active'); // 'active' | 'all'
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadMedications();
    }, [filter]);

    const loadMedications = async () => {
        setLoading(true);
        try {
            const data = filter === 'active' 
                ? await getActiveMedications()
                : await getAllMedications();
            setMedications(data);
        } catch (e) {
            console.error('Load medications failed', e);
        } finally {
            setLoading(false);
        }
    };

    const handleStop = async (id) => {
        if (confirm('确定要停止此用药提醒吗？')) {
            await stopMedication(id);
            loadMedications();
        }
    };

    const handleDelete = async (id) => {
        if (confirm('确定要删除此用药记录吗？此操作不可恢复！')) {
            await deleteMedication(id);
            loadMedications();
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
            
            return {
                time,
                isPast: doseTime < now,
                isComing: doseTime > now && (doseTime - now) < 3600000 // Within 1 hour
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
                                <div 
                                    key={idx}
                                    style={{
                                        padding: '8px 16px',
                                        borderRadius: '10px',
                                        border: dose.isPast ? '2px solid #10B981' : '2px solid #E2E8F0',
                                        background: dose.isPast ? '#ECFDF5' : dose.isComing ? '#FEF3C7' : 'white',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        fontSize: '0.9rem',
                                        fontWeight: 600,
                                        color: dose.isPast ? '#059669' : dose.isComing ? '#D97706' : '#64748B'
                                    }}
                                >
                                    {dose.isPast && <Check size={16} />}
                                    {dose.isComing && <AlertCircle size={16} />}
                                    {!dose.isPast && !dose.isComing && <Clock size={16} />}
                                    {dose.time}
                                </div>
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
