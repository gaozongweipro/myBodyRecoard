
import React, { useEffect, useState } from 'react';
import { getAllRecords } from '../db';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { TrendingUp, Building2, Stethoscope, CreditCard } from 'lucide-react';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const Stats = () => {
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState({
        totalRecords: 0,
        totalCost: 0,
        hospitalCount: 0,
        departmentCount: 0,
        hospitalData: [],
        departmentData: [],
        costTrend: []
    });

    useEffect(() => {
        calculateStats();
    }, []);

    const calculateStats = async () => {
        const records = await getAllRecords();
        
        // Basic Counts
        const totalRecords = records.length;
        
        // Total Cost
        let totalCost = 0;
        const hospitalMap = {};
        const departmentMap = {};
        const dateMap = {};

        records.forEach(r => {
            // Cost
            const cost = parseFloat(r.cost_total) || 0;
            totalCost += cost;

            // Hospital
            const h = r.hospital || '其他';
            hospitalMap[h] = (hospitalMap[h] || 0) + 1;

            // Department
            const d = r.department || '其他';
            departmentMap[d] = (departmentMap[d] || 0) + 1;

            // Date (Year-Month) for trend
            const ym = r.date.slice(0, 7); // yyyy-MM
            dateMap[ym] = (dateMap[ym] || 0) + cost;
        });

        // Format for Charts
        const hospitalData = Object.entries(hospitalMap)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 6); // Top 6

        const departmentData = Object.entries(departmentMap)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 6);

        // Trend Data (sort by date)
        const costTrend = Object.entries(dateMap)
            .map(([date, amount]) => ({ date, amount }))
            .sort((a, b) => a.date.localeCompare(b.date));

        setSummary({
            totalRecords,
            totalCost: totalCost.toFixed(2),
            hospitalCount: Object.keys(hospitalMap).length,
            departmentCount: Object.keys(departmentMap).length,
            hospitalData,
            departmentData,
            costTrend
        });
        setLoading(false);
    };

    if (loading) return <div className="container text-center" style={{paddingTop:'50px'}}>加载中...</div>;

    return (
        <div className="container">
            <h2 className="mb-4">数据统计</h2>

            {/* Key Metrics */}
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="card" style={{ marginBottom: 0, padding: '1rem' }}>
                    <div className="text-sm text-muted mb-1 flex items-center" style={{ gap: '4px' }}>
                        <TrendingUp size={16} /> 总记录
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{summary.totalRecords}</div>
                </div>
                <div className="card" style={{ marginBottom: 0, padding: '1rem' }}>
                    <div className="text-sm text-muted mb-1 flex items-center" style={{ gap: '4px' }}>
                        <CreditCard size={16} /> 总费用
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                        ¥{summary.totalCost}
                    </div>
                </div>
                <div className="card" style={{ marginBottom: 0, padding: '1rem' }}>
                    <div className="text-sm text-muted mb-1 flex items-center" style={{ gap: '4px' }}>
                        <Building2 size={16} /> 就诊医院
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{summary.hospitalCount}家</div>
                </div>
                <div className="card" style={{ marginBottom: 0, padding: '1rem' }}>
                    <div className="text-sm text-muted mb-1 flex items-center" style={{ gap: '4px' }}>
                        <Stethoscope size={16} /> 涉及科室
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{summary.departmentCount}个</div>
                </div>
            </div>

            {/* Charts Section */}
            
            {/* Hospitals Pie */}
            <div className="card">
                <h3 className="mb-4">常去医院 (Top 6)</h3>
                <div style={{ height: '250px', width: '100%' }}>
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
                            >
                                {summary.hospitalData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div className="flex" style={{ flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginTop: '10px' }}>
                    {summary.hospitalData.map((entry, index) => (
                        <div key={index} className="flex items-center" style={{ fontSize: '0.75rem', gap: '4px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: COLORS[index % COLORS.length] }}></div>
                            {entry.name} ({entry.value})
                        </div>
                    ))}
                </div>
            </div>

            {/* Department Bar */}
            <div className="card">
                <h3 className="mb-4">科室分布</h3>
                <div style={{ height: '300px', width: '100%', marginLeft: '-20px' }}>
                    <ResponsiveContainer>
                        <BarChart data={summary.departmentData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                            <XAxis type="number" hide />
                            <YAxis type="category" dataKey="name" width={80} tick={{fontSize: 12}} />
                            <Tooltip />
                            <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={20} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

             {/* Cost Trend */}
             <div className="card">
                <h3 className="mb-4">月度费用趋势</h3>
                {summary.costTrend.length > 0 ? (
                    <div style={{ height: '250px', width: '100%', marginLeft: '-20px' }}>
                    <ResponsiveContainer>
                        <BarChart data={summary.costTrend}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="date" tick={{fontSize: 10}} />
                            <YAxis tick={{fontSize: 10}} />
                            <Tooltip formatter={(value) => `¥${value.toFixed(2)}`} />
                            <Bar dataKey="amount" fill="#10b981" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                    </div>
                ) : <div className="text-center text-muted text-sm py-4">暂无并费记录</div>}
            </div>

        </div>
    );
};

export default Stats;
