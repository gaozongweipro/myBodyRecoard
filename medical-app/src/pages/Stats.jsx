import React, { useEffect, useState } from 'react';
import { getAllRecords } from '../db';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Building2, Stethoscope, CreditCard, ChevronDown, ChevronUp } from 'lucide-react';
import { format, subMonths } from 'date-fns';

import { useNavigate } from 'react-router-dom';
import { X, ChevronRight } from 'lucide-react'; // Add X and ChevronRight

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const Stats = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [costExpanded, setCostExpanded] = useState(false);
    
    // Modals
    const [showAllHospitals, setShowAllHospitals] = useState(false);
    const [showAllDepartments, setShowAllDepartments] = useState(false);

    const [summary, setSummary] = useState({
        totalRecords: 0,
        totalCost: 0,
        self: 0,
        pool: 0,
        personal: 0,
        hospitalCount: 0,
        departmentCount: 0,
        hospitalData: [], // Top 6
        fullHospitalData: [], // All
        departmentData: [], // All (already was formatted as full list before slice in render)
        monthStats: []
    });

    useEffect(() => {
        calculateStats();
    }, []);

    const calculateStats = async () => {
        const records = await getAllRecords();

        // Basic Counts
        const totalRecords = records.length;

        // Total Cost Breakdown
        let totalCost = 0;
        let selfC = 0;
        let poolC = 0;
        let personalC = 0;

        const hospitalMap = {};
        const departmentMap = {};
        const monthsMap = {};

        records.forEach(r => {
            // Cost
            const cost = parseFloat(r.cost_total) || 0;
            totalCost += cost;
            selfC += (parseFloat(r.cost_self) || 0);
            poolC += (parseFloat(r.cost_pool) || 0);
            personalC += (parseFloat(r.cost_personal) || 0);

            // Hospital
            const h = r.hospital || '其他';
            hospitalMap[h] = (hospitalMap[h] || 0) + 1;

            // Department
            const d = r.department || '未分类';
            departmentMap[d] = (departmentMap[d] || 0) + 1;

            // Month (YYYY-MM)
            const m = r.date.slice(0, 7);
            monthsMap[m] = (monthsMap[m] || 0) + 1; // Count visits
        });

        // Format for Hospital Pie Chart
        const fullHospitalData = Object.entries(hospitalMap)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

        const hospitalData = fullHospitalData.slice(0, 6);

        // Format for Dept List
        const departmentData = Object.entries(departmentMap)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);

        // Format for Monthly Trend (Last 6 Months)
        const last6Months = [];
        for (let i = 5; i >= 0; i--) {
            const d = subMonths(new Date(), i);
            const key = format(d, 'yyyy-MM');
            last6Months.push({
                label: format(d, 'MM月'),
                key: key,
                value: monthsMap[key] || 0
            });
        }

        setSummary({
            totalRecords,
            totalCost,
            self: selfC,
            pool: poolC,
            personal: personalC,
            hospitalCount: Object.keys(hospitalMap).length,
            departmentCount: Object.keys(departmentMap).length,
            hospitalData,
            fullHospitalData,
            departmentData,
            monthStats: last6Months
        });
        setLoading(false);
    };

    if (loading) return <div className="container text-center" style={{ paddingTop: '50px' }}>加载中...</div>;

    const maxMonthCost = Math.max(...summary.monthStats.map(m => m.value), 1);

    return (
        <div className="container" style={{ paddingBottom: '100px' }}>
            <h2 className="mb-4">数据统计</h2>

            {/* Key Metrics Grid - Modified to include Expandable Cost Card */}
            <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.8rem', marginBottom: '1.5rem' }}>
                <div className="card hover-scale" style={{ marginBottom: 0, padding: '1rem', background: '#ecfdf5', border: '1px solid #d1fae5', textAlign: 'center', transition: 'transform 0.2s', cursor: 'pointer' }} onClick={() => navigate('/records')}>
                    <div style={{ width: '40px', height: '40px', background: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                        <TrendingUp size={20} className="text-primary" />
                    </div>
                    <div className="text-xs text-muted mb-1" style={{ fontWeight: 500 }}>总记录</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-main)' }}>{summary.totalRecords}</div>
                </div>

                <div className="card hover-scale" style={{ marginBottom: 0, padding: '1rem', background: '#eff6ff', border: '1px solid #dbeafe', textAlign: 'center', transition: 'transform 0.2s', cursor: 'pointer' }} onClick={() => setShowAllHospitals(true)}>
                    <div style={{ width: '40px', height: '40px', background: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                         <Building2 size={20} style={{ color: '#3b82f6' }} />
                    </div>
                    <div className="text-xs text-muted mb-1" style={{ fontWeight: 500 }}>就诊医院</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-main)' }}>{summary.hospitalCount}</div>
                </div>

                <div className="card hover-scale" style={{ marginBottom: 0, padding: '1rem', background: '#f5f3ff', border: '1px solid #ede9fe', textAlign: 'center', transition: 'transform 0.2s', cursor: 'pointer' }} onClick={() => setShowAllDepartments(true)}>
                    <div style={{ width: '40px', height: '40px', background: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                        <Stethoscope size={20} style={{ color: '#8b5cf6' }} />
                    </div>
                    <div className="text-xs text-muted mb-1" style={{ fontWeight: 500 }}>涉及科室</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-main)' }}>{summary.departmentCount}</div>
                </div>
            </div>

            {/* Expandable Total Cost Card */}
            <div
                className="card mb-4"
                style={{
                    background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
                    color: 'white',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                }}
                onClick={() => setCostExpanded(!costExpanded)}
            >
                <div className="flex-between">
                    <div>
                        <h3 style={{ opacity: 0.9, fontSize: '0.9rem', marginBottom: '4px' }}>总医疗费用</h3>
                        <div style={{ fontSize: '2.2rem', fontWeight: 'bold' }}>
                            ￥{summary.totalCost.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '50%', padding: '8px', display: 'flex' }}>
                        {costExpanded ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                    </div>
                </div>

                {costExpanded && (
                    <div style={{ marginTop: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '1rem', animation: 'slideDown 0.3s ease-out' }}>
                        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                            <div>
                                <div style={{ fontSize: '0.75rem', opacity: 0.8, marginBottom: '2px' }}>个人自费</div>
                                <div style={{ fontSize: '1rem', fontWeight: 600 }}>￥{summary.self.toFixed(0)}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.75rem', opacity: 0.8, marginBottom: '2px' }}>医保统筹</div>
                                <div style={{ fontSize: '1rem', fontWeight: 600 }}>￥{summary.pool.toFixed(0)}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.75rem', opacity: 0.8, marginBottom: '2px' }}>医保个账</div>
                                <div style={{ fontSize: '1rem', fontWeight: 600 }}>￥{summary.personal.toFixed(0)}</div>
                            </div>
                        </div>
                    </div>
                )}
                {!costExpanded && (
                    <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '8px' }}>
                        点击查看费用详情
                    </div>
                )}
            </div>

            {/* Monthly Trend (CSS Styled) */}
            <div className="card mb-4">
                <h3 className="mb-4">月度就诊次数趋势</h3>
                <div style={{ height: '220px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', paddingBottom: '4px' }}>
                    {summary.monthStats.every(m => m.value === 0) ? (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            暂无就诊记录
                        </div>
                    ) : (
                        summary.monthStats.map(m => (
                            <div key={m.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', padding: '0 2px' }}>
                                <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                                    <div style={{
                                        width: '80%',
                                        maxWidth: '24px',
                                        background: m.value > 0 ? 'var(--primary)' : 'transparent',
                                        opacity: 0.8,
                                        borderRadius: '4px 4px 0 0',
                                        height: m.value > 0 ? `${(m.value / maxMonthCost) * 85 + 5}%` : '4px',
                                        minHeight: m.value > 0 ? '4px' : '0',
                                        transition: 'height 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                                        position: 'relative',
                                        display: 'flex',
                                        justifyContent: 'center'
                                    }}>
                                        {m.value > 0 && (
                                            <div style={{
                                                position: 'absolute',
                                                top: '-20px',
                                                fontSize: '9px',
                                                color: 'var(--text-secondary)',
                                                whiteSpace: 'nowrap'
                                            }}>
                                                {m.value}次
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div style={{ fontSize: '11px', marginTop: '8px', color: 'var(--text-secondary)' }}>{m.label}</div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Department Distribution (List Style) */}
            <div className="card mb-4">
                <h3 className="mb-4">科室分布</h3>
                {summary.departmentData.length === 0 ? (
                    <div className="text-center text-muted py-4">暂无数据</div>
                ) : (
                    summary.departmentData.slice(0, 5).map((d, i) => (
                        <div key={d.name} style={{ marginBottom: i === Math.min(summary.departmentData.length, 5) - 1 ? 0 : '16px' }}>
                            <div className="flex-between mb-2">
                                <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>{d.name}</span>
                                <span className="text-muted text-sm">{d.count}次</span>
                            </div>
                            <div style={{ height: '8px', background: 'var(--surface-muted)', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{
                                    height: '100%',
                                    background: i === 0 ? 'var(--primary)' : 'var(--secondary)',
                                    width: `${(d.count / summary.totalRecords) * 100}%`,
                                    borderRadius: '4px'
                                }} />
                            </div>
                        </div>
                    ))
                )}
                {summary.departmentData.length > 5 && (
                    <div className="text-center mt-3 pt-3 border-top">
                        <span className="text-xs text-muted">还有 {summary.departmentData.length - 5} 个科室...</span>
                    </div>
                )}
            </div>

            {/* Hospitals Pie */}
            <div className="card">
                <h3 className="mb-4">常去医院分布</h3>
                <div style={{ position: 'relative', height: '220px', width: '100%', marginBottom: '20px' }}>
                    <ResponsiveContainer>
                        <PieChart>
                            <Pie
                                data={summary.hospitalData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                                stroke="none"
                            >
                                {summary.hospitalData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip 
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                                itemStyle={{ color: 'var(--text-main)' }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                    
                     {/* Center Label Overlay */}
                    <div style={{ 
                        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', 
                        textAlign: 'center', pointerEvents: 'none' 
                    }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Top {summary.hospitalData.length}</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                            {summary.hospitalData.reduce((a, b) => a + b.value, 0)}
                        </div>
                    </div>
                </div>

                <div className="grid g-2">
                    {summary.hospitalData.map((entry, index) => {
                         const percent = Math.round((entry.value / summary.totalRecords) * 100);
                         return (
                            <div key={index} className="flex-between" style={{ padding: '8px 4px', borderBottom: index === summary.hospitalData.length - 1 ? 'none' : '1px dashed var(--border)' }}>
                                <div className="flex items-center" style={{ gap: '10px', flex: 1, minWidth: 0 }}>
                                    <div style={{ width: '10px', height: '10px', display: 'flex', alignItems: 'center', borderRadius: '50%', background: COLORS[index % COLORS.length], flexShrink: 0 }}></div>
                                    <span className="text-sm text-truncate" style={{ fontWeight: 500 }}>{entry.name}</span>
                                </div>
                                <div className="flex items-center" style={{ gap: '12px' }}>
                                    <span style={{ fontSize: '0.75rem', opacity: 0.6, background: 'var(--surface-muted)', padding: '2px 6px', borderRadius: '4px' }}>{percent}%</span>
                                    <span className="text-sm" style={{ fontWeight: 600, minWidth: '30px', textAlign: 'right' }}>{entry.value}次</span>
                                </div>
                            </div>
                         );
                    })}
                </div>
            </div>
        {showAllHospitals && (
            <ListModal 
                title="所有就诊医院" 
                data={summary.fullHospitalData} 
                onClose={() => setShowAllHospitals(false)} 
                onItemClick={(name) => navigate(`/records?q=${name}`)}
            />
        )}

        {showAllDepartments && (
             <ListModal 
                title="所有涉及科室" 
                data={summary.departmentData} 
                onClose={() => setShowAllDepartments(false)} 
                onItemClick={(name) => navigate(`/records?q=${name}`)}
            />
        )}
        </div>
    );
};

export default Stats;

// Simple List Modal Component
const ListModal = ({ title, data, onClose, onItemClick }) => (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }} onClick={onClose}>
        <div 
            style={{ 
                width: '80%', 
                height: '100%', 
                background: 'var(--surface)', 
                paddingTop: 'max(env(safe-area-inset-top), 20px)',  // Account for notch/status bar
                paddingBottom: 'env(safe-area-inset-bottom)',
                paddingLeft: '20px',
                paddingRight: '20px',
                overflowY: 'auto', 
                animation: 'slideRight 0.3s ease-out' 
            }} 
            onClick={e => e.stopPropagation()}
        >
            <div className="flex-between mb-4">
                <h3>{title}</h3>
                <button onClick={onClose} style={{ border: 'none', background: 'none' }}><X size={24} /></button>
            </div>
            <div className="grid" style={{ gridTemplateColumns: '1fr', gap: '10px' }}>
                {data.map((item, i) => (
                    <div key={i} 
                         className="flex-between" 
                         style={{ padding: '12px', background: 'var(--bg-main)', borderRadius: '8px', cursor: 'pointer' }}
                         onClick={() => onItemClick(item.name)}
                    >
                        <span style={{ fontWeight: 500 }}>{item.name}</span>
                        <div className="flex items-center text-muted">
                            <span style={{ marginRight: '8px', fontSize: '0.9rem' }}>{item.value || item.count}次</span>
                            <ChevronRight size={16} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
        <style>{`
            @keyframes slideRight {
                from { transform: translateX(100%); }
                to { transform: translateX(0); }
            }
        `}</style>
    </div>
);
