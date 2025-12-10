
import React, { useEffect, useState } from 'react';
import { getAllRecords } from '../db';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

const Home = () => {
  const [recentRecords, setRecentRecords] = useState([]);
  const [stats, setStats] = useState({ total: 0 });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const records = await getAllRecords();
    setRecentRecords(records.slice(0, 3));
    setStats({ total: records.length });
  };

  return (
    <div className="container">
      <header style={{ paddingTop: '20px', paddingBottom: '20px' }}>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '4px' }}>我的医疗档案</h1>
        <p className="text-muted text-sm">本地存储，安全隐私</p>
      </header>

      <div className="card" style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))', color: 'white' }}>
        <h3 style={{ opacity: 0.9 }}>总记录数</h3>
        <div style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>{stats.total}</div>
        <div style={{ opacity: 0.8, fontSize: '0.875rem', marginTop: '8px' }}>
          持续记录，守护健康
        </div>
      </div>

      <div className="flex-between mb-2" style={{ marginTop: '2rem' }}>
        <h3>最近记录</h3>
        <Link to="/records" className="text-sm" style={{ color: 'var(--primary)', textDecoration: 'none' }}>查看全部</Link>
      </div>

      <div className="recent-list">
        {recentRecords.length === 0 ? (
          <div className="card text-muted" style={{ textAlign: 'center', padding: '2rem' }}>
            <p>暂无记录</p>
            <Link to="/add" className="btn btn-primary" style={{ marginTop: '1rem', width: 'auto', textDecoration: 'none' }}>
              开始记录
            </Link>
          </div>
        ) : (
          recentRecords.map(record => (
            <Link key={record.id} to={`/records/${record.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>

              <div className="card mb-2">
                <div className="flex-between" style={{ alignItems: 'flex-start' }}>
                  <span style={{ fontWeight: 600, flex: 1, marginRight: '10px' }}>{record.hospital}</span>
                  <span className="text-xs text-muted" style={{ whiteSpace: 'nowrap', marginTop: '2px' }}>{format(new Date(record.date), 'MM-dd HH:mm')}</span>
                </div>
                <div className="text-sm text-muted mb-1" style={{ marginTop: '4px' }}>{record.department} - {record.type}</div>
                {record.title && <div className="text-sm">{record.title}</div>}
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
};

export default Home;
