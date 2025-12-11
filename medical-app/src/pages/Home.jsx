import React, { useEffect, useState } from 'react';
import { getAllRecords } from '../db';
import { getActiveMedications } from '../db';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Plus, Pill, Clock, ChevronRight, Calendar, Building2, Stethoscope, TrendingUp } from 'lucide-react';

const Home = () => {
  const navigate = useNavigate();
  const [recentRecords, setRecentRecords] = useState([]);
  const [stats, setStats] = useState({ total: 0 });
  const [todayMedications, setTodayMedications] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    let records = await getAllRecords();
    records = records.sort((a, b) => new Date(b.date) - new Date(a.date));
    setRecentRecords(records.slice(0, 6));
    setStats({ total: records.length });

    const activeMeds = await getActiveMedications();
    const today = new Date();
    const todayMeds = activeMeds.filter(med => {
      const start = new Date(med.startDate);
      const end = new Date(med.endDate);
      return today >= start && today <= end;
    });
    setTodayMedications(todayMeds);
  };

  return (
    <div style={{ 
      height: 'calc(100vh - 60px)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      background: '#F8FAFC'
    }}>
      {/* Fixed Header + Quick Actions - No Scroll */}
      <div style={{ 
        flexShrink: 0,
        padding: '16px 20px 12px 20px'
      }}>
        {/* Page Title */}
        <h1 style={{ 
          fontSize: '1.5rem', 
          fontWeight: 700, 
          margin: '0 0 16px 0',
          color: '#0F172A',
          letterSpacing: '-0.01em'
        }}>
          我的医疗档案
        </h1>

        {/* Compact 2-Column Quick Stats */}
        <div className="grid" style={{ 
          gridTemplateColumns: '1fr 1fr', 
          gap: '12px',
          marginBottom: '12px'
        }}>
          {/* Total Records - Compact */}
          <div style={{ 
            background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
            borderRadius: '16px',
            padding: '16px',
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{
              position: 'absolute',
              top: '-10px',
              right: '-10px',
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.15)',
              filter: 'blur(20px)'
            }}></div>
            
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div className="flex items-center" style={{ gap: '6px', marginBottom: '8px' }}>
                <TrendingUp size={14} color="rgba(255, 255, 255, 0.9)" strokeWidth={2.5} />
                <div style={{ 
                  fontSize: '0.7rem', 
                  color: 'rgba(255, 255, 255, 0.85)',
                  fontWeight: 600,
                  letterSpacing: '0.03em'
                }}>
                  总记录
                </div>
              </div>
              <div style={{ 
                fontSize: '2rem', 
                fontWeight: 800, 
                color: 'white',
                lineHeight: 1
              }}>
                {stats.total}
              </div>
            </div>
          </div>

          {/* Add Record Button - Compact */}
          <Link 
            to="/add" 
            style={{ 
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '16px',
              background: 'white',
              borderRadius: '16px',
              textDecoration: 'none',
              border: '2px solid #E2E8F0',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
              transition: 'all 0.2s'
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'scale(0.96)';
              e.currentTarget.style.borderColor = '#3B82F6';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.borderColor = '#E2E8F0';
            }}
          >
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)'
            }}>
              <Plus size={22} color="white" strokeWidth={3} />
            </div>
            <div style={{ 
              fontSize: '0.8rem', 
              fontWeight: 700, 
              color: '#3B82F6'
            }}>
              新增记录
            </div>
          </Link>
        </div>

        {/* Medication Reminder Card - Compact */}
        {todayMedications.length > 0 && (
          <div 
            onClick={() => navigate('/medications')}
            style={{ 
              padding: '14px 16px', 
              background: 'white',
              borderRadius: '16px',
              border: '2px solid #DBEAFE',
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 2px 8px rgba(59, 130, 246, 0.08)',
              marginBottom: '12px'
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'scale(0.98)';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <div className="flex-between" style={{ marginBottom: '12px' }}>
              <div className="flex items-center" style={{ gap: '10px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)'
                }}>
                  <Pill size={18} color="white" strokeWidth={2.5} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '0.95rem' }}>今日用药</div>
                  <div style={{ fontSize: '0.7rem', color: '#3B82F6', fontWeight: 600 }}>{todayMedications.length} 个待服用</div>
                </div>
              </div>
              <ChevronRight size={20} style={{ color: '#3B82F6' }} />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {todayMedications.slice(0, todayMedications.length > 2 ? 1 : 2).map((med, idx) => (
                <div key={idx} style={{ 
                  padding: '10px 12px', 
                  background: 'linear-gradient(135deg, #F0F9FF, #E0F2FE)',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  border: '1px solid #BFDBFE'
                }}>
                  <Clock size={14} style={{ color: '#3B82F6', flexShrink: 0 }} strokeWidth={2.5} />
                  <span style={{ 
                    fontSize: '0.85rem', 
                    color: '#1E40AF',
                    flex: 1,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {med.name} {med.dosage}
                  </span>
                  {med.times && med.times.length > 0 && (
                    <span style={{ 
                      fontSize: '0.75rem', 
                      color: '#3B82F6',
                      background: 'white',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontWeight: 700,
                      border: '1px solid #BFDBFE'
                    }}>
                      {med.times[0]}
                    </span>
                  )}
                </div>
              ))}
              {todayMedications.length > 1 && (
                <div style={{ 
                  fontSize: '0.75rem', 
                  color: '#60A5FA',
                  textAlign: 'center',
                  fontWeight: 600
                }}>
                  {todayMedications.length > 2 ? `还有 ${todayMedications.length - 1} 个...` : ''}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Fixed Section Title - No Scroll */}
      <div style={{ 
        flexShrink: 0,
        padding: '0 20px',
        marginBottom: '12px'
      }}>
        <div className="flex-between">
          <h2 style={{ 
            fontSize: '1.1rem', 
            fontWeight: 700, 
            color: '#0F172A',
            margin: 0
          }}>
            最近记录
          </h2>
          <Link 
            to="/records" 
            style={{ 
              fontSize: '0.8rem',
              color: '#3B82F6', 
              textDecoration: 'none',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '2px'
            }}
          >
            查看全部
            <ChevronRight size={14} />
          </Link>
        </div>
      </div>

      {/* Scrollable Records List */}
      <div style={{ 
        flex: 1,
        overflowY: 'auto',
        padding: '0 20px',
        paddingBottom: '20px',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
      }}>
        {recentRecords.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '40px 20px',
            background: 'white',
            borderRadius: '16px',
            border: '2px dashed #E2E8F0'
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '12px', opacity: 0.3 }}>📋</div>
            <p style={{ color: '#94A3B8', fontSize: '0.9rem', margin: '0 0 16px 0' }}>还没有就诊记录</p>
            <Link 
              to="/add" 
              style={{ 
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 24px',
                background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
                color: 'white',
                borderRadius: '10px',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '0.9rem',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)'
              }}
            >
              <Plus size={16} />
              开始记录
            </Link>
          </div>
        ) : (
          recentRecords.map(record => (
            <Link 
              key={record.id} 
              to={`/records/${record.id}`} 
              style={{ textDecoration: 'none', color: 'inherit', display: 'block', marginBottom: '10px' }}
            >
              <div style={{ 
                background: 'white',
                borderRadius: '14px',
                padding: '14px 16px',
                borderLeft: '4px solid #3B82F6',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)',
                transition: 'all 0.2s'
              }}
              onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
              onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                <div className="flex-between" style={{ marginBottom: '10px' }}>
                  <div className="flex items-center" style={{ gap: '8px', flex: 1, minWidth: 0 }}>
                    <Building2 size={14} style={{ color: '#3B82F6', flexShrink: 0 }} strokeWidth={2.5} />
                    <span style={{ 
                      fontWeight: 700, 
                      color: '#0F172A', 
                      fontSize: '0.95rem',
                      lineHeight: '14px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {record.hospital}
                    </span>
                  </div>
                  <div className="flex items-center" style={{ gap: '4px', flexShrink: 0 }}>
                    <Calendar size={12} style={{ color: '#94A3B8' }} />
                    <span style={{ 
                      fontSize: '0.75rem', 
                      color: '#64748B',
                      fontWeight: 600,
                      lineHeight: '12px',
                      whiteSpace: 'nowrap'
                    }}>
                      {format(new Date(record.date), 'MM-dd HH:mm')}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center" style={{ gap: '8px', marginBottom: record.title ? '8px' : 0 }}>
                  <div style={{
                    padding: '3px 8px',
                    background: 'linear-gradient(135deg, #F0F9FF, #E0F2FE)',
                    borderRadius: '6px',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    color: '#0369A1',
                    border: '1px solid #BFDBFE',
                    lineHeight: '1.2'
                  }}>
                    {record.department}
                  </div>
                  <div style={{
                    padding: '3px 8px',
                    background: '#F1F5F9',
                    borderRadius: '6px',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    color: '#475569',
                    lineHeight: '1.2'
                  }}>
                    {record.type}
                  </div>
                </div>
                
                {record.title && (
                  <div style={{ 
                    fontSize: '0.85rem', 
                    color: '#334155',
                    fontWeight: 500,
                    marginTop: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <Stethoscope size={12} style={{ color: '#64748B', flexShrink: 0 }} />
                    <span style={{
                      lineHeight: '12px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {record.title}
                    </span>
                  </div>
                )}
              </div>
            </Link>
          ))
        )}
      </div>

      {/* Hide scrollbar */}
      <style>{`
        div::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
};

export default Home;
