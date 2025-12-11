import React, { useEffect, useState } from 'react';
import { searchRecords } from '../db';
import { Search, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { Link, useSearchParams } from 'react-router-dom';

const Records = () => {
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setQuery(searchParams.get('q') || '');
  }, [searchParams]);

  useEffect(() => {
    handleSearch();
  }, [query]);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const results = await searchRecords(query);
      setRecords(results);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="flex-between mb-4 sticky-top" style={{ position: 'sticky', top: 0, background: 'var(--background)', padding: '10px 0', zIndex: 10 }}>
        <div style={{ position: 'relative', width: '100%' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input 
            type="text" 
            placeholder="搜索 医院、科室、诊断..." 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ paddingLeft: '40px' }}
          />
        </div>
      </div>


      <div className="record-list">

        {loading ? (
            <div style={{ textAlign: 'center', padding: '20px' }}><div className="spinner" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent', margin: '0 auto' }}></div></div>
        ) : records.length === 0 ? (
          <div className="text-center text-muted" style={{ padding: '2rem' }}>没有找到记录</div>
        ) : (
          <div style={{ position: 'relative', paddingLeft: '20px' }}>
              {/* Timeline Line */}
              <div style={{ position: 'absolute', left: '7px', top: '10px', bottom: '10px', width: '2px', background: '#e2e8f0' }}></div>
              
              {records.map((r, index) => {
                  const currentDate = new Date(r.date);
                  const prevDate = index > 0 ? new Date(records[index-1].date) : null;
                  
                  // Group by Year-Month
                  const currentMonthKey = format(currentDate, 'yyyy-MM');
                  const prevMonthKey = prevDate ? format(prevDate, 'yyyy-MM') : null;
                  const showMonthHeader = currentMonthKey !== prevMonthKey;

                  return (
                    <div key={r.id} style={{ marginBottom: '20px', position: 'relative' }}>
                        
                        {/* Month Header on Timeline */}
                        {showMonthHeader && (
                            <div style={{ position: 'relative', marginBottom: '12px' }}>
                                {/* Large Dot for Month */}
                                <div style={{ 
                                    position: 'absolute', 
                                    left: '-20px', 
                                    top: '4px', 
                                    width: '16px', 
                                    height: '16px', 
                                    borderRadius: '50%', 
                                    background: 'var(--primary)',
                                    border: '4px solid #e0f2fe',
                                    zIndex: 2
                                }}></div>
                                <div style={{ marginLeft: '10px', fontSize: '1rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
                                    {format(currentDate, 'yyyy年MM月')}
                                </div>
                            </div>
                        )}

                        {/* Small Dot for Item */}
                        {!showMonthHeader && (
                             <div style={{ 
                                position: 'absolute', 
                                left: '-16px', 
                                top: '20px', 
                                width: '8px', 
                                height: '8px', 
                                borderRadius: '50%', 
                                background: '#cbd5e1',
                                border: '2px solid white',
                                zIndex: 2
                            }}></div>
                        )}

                        <Link to={`/records/${r.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                        <div className="card" style={{ marginLeft: '6px', marginBottom: 0 }}>
                            <div className="flex-between" style={{ alignItems: 'flex-start' }}> {/* Align start so date stays top even if title wraps */}
                                <span style={{ fontWeight: 600, color: 'var(--primary)', fontSize: '1.05rem', wordBreak: 'break-all', marginRight: '10px', flex: 1 }}>
                                    {r.hospital}
                                </span>
                                <span className="text-xs text-muted" style={{ whiteSpace: 'nowrap', marginTop: '4px' }}>
                                    {format(currentDate, 'MM-dd HH:mm')}
                                </span>
                            </div>
                            
                            <div className="flex-between" style={{ marginTop: '6px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, marginRight: '8px' }}>
                                    <span className="text-sm" style={{ fontWeight: 500, color: 'var(--text-main)' }}>
                                        {r.department} {r.doctor ? `· ${r.doctor}` : ''}
                                    </span>
                                </div>
                                <span className="text-sm badge" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--primary)', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', whiteSpace: 'nowrap', alignSelf: 'flex-start' }}>
                                    {r.type}
                                </span>
                            </div>

                            {r.title && (
                                <div className="text-sm text-muted" style={{ marginTop: '8px', borderTop: '1px solid var(--border)', paddingTop: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {r.title}
                                </div>
                            )}
                            
                            {/* Cost Summary Tag */}
                            {r.cost_total && (
                                <div className="text-xs text-muted" style={{ marginTop: '6px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                    <span>总额: ¥{r.cost_total}</span>
                                    {r.cost_self && <span style={{ color: '#f59e0b' }}>自费: ¥{r.cost_self}</span>}
                                </div>
                            )}
                        </div>
                        </Link>
                    </div>
                  );
              })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Records;
