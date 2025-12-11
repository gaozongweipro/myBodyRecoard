import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../db';
import CryptoJS from 'crypto-js';
import { Download, Upload, Trash2, ShieldCheck, RefreshCw, ChevronRight, Lock, FileText, Smartphone, AlertTriangle, Check, Eye, EyeOff, Database, BarChart2 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { createBackup, listBackups, readBackupFile, deleteBackup } from '../utils/backupManager';
import { format } from 'date-fns';

const Profile = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState(localStorage.getItem('backup_pwd') || '');
  const [showPassword, setShowPassword] = useState(false);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(localStorage.getItem('backup_auto') === 'true');
  const [loading, setLoading] = useState(false);
  const [backupList, setBackupList] = useState([]);
  const [showBackupList, setShowBackupList] = useState(false);
  const [recordCount, setRecordCount] = useState(0);

  useEffect(() => {
      loadData();
  }, []);

  useEffect(() => {
      if (Capacitor.isNativePlatform() && showBackupList) {
          loadBackups();
      }
  }, [showBackupList]);

  const loadData = async () => {
      const count = await db.records.count();
      setRecordCount(count);
      if (Capacitor.isNativePlatform()) {
          loadBackups();
      }
  };

  const loadBackups = async () => {
      const list = await listBackups();
      setBackupList(list);
  };

  const saveSettings = () => {
      if (!password && autoBackupEnabled) {
          alert('开启自动备份需要先设置密码');
          setAutoBackupEnabled(false);
          return;
      }
      localStorage.setItem('backup_pwd', password);
      localStorage.setItem('backup_auto', autoBackupEnabled);
  };

  const handleManualBackup = async () => {
    if (!password) return alert('请先设置备份密码');
    setLoading(true);
    try {
      const allRecords = await db.records.toArray();
      const allAttachments = await db.attachments.toArray();
      const data = {
        version: 1,
        timestamp: new Date().toISOString(),
        records: allRecords,
        attachments: allAttachments
      };

      const json = JSON.stringify(data);
      const encrypted = CryptoJS.AES.encrypt(json, password).toString();

      if (Capacitor.isNativePlatform()) {
          await createBackup(encrypted, false);
          alert('✓ 备份成功');
          loadBackups();
      } else {
           const blob = new Blob([encrypted], { type: 'application/octet-stream' });
           const url = URL.createObjectURL(blob);
           const a = document.createElement('a');
           a.href = url;
           a.download = `backup_${new Date().toISOString().slice(0,10)}.enc`;
           a.click();
           alert('✓ 备份文件已下载');
      }
    } catch (e) {
      console.error(e);
      alert('✗ 备份失败: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (fileContentOrFileObject) => {
    if (!password) return alert('请先输入备份密码');
    if (!confirm('⚠️ 恢复操作将覆盖当前所有数据，确定继续？')) return;

    setLoading(true);
    try {
        let encrypted = '';
        if (typeof fileContentOrFileObject === 'string') {
            encrypted = fileContentOrFileObject;
        } else {
            encrypted = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = e => resolve(e.target.result);
                reader.readAsText(fileContentOrFileObject);
            });
        }

        const bytes = CryptoJS.AES.decrypt(encrypted, password);
        const originalText = bytes.toString(CryptoJS.enc.Utf8);
        
        if (!originalText) throw new Error('密码错误或文件已损坏');

        const data = JSON.parse(originalText);
        
        await db.transaction('rw', db.records, db.attachments, async () => {
            await db.records.clear();
            await db.records.bulkPut(data.records);
            await db.attachments.clear();
            await db.attachments.bulkPut(data.attachments);
        });

        alert('✓ 数据恢复成功');
        loadData();
    } catch (err) {
        console.error(err);
        alert('✗ 恢复失败: ' + err.message);
    } finally {
        setLoading(false);
    }
  };

  const handleRestoreFromList = async (fileName) => {
      try {
          setLoading(true);
          const content = await readBackupFile(fileName);
          await handleRestore(content);
      } catch (e) {
          alert('✗ 读取文件失败: ' + e.message);
          setLoading(false);
      }
  };
  
  const handleDeleteBackup = async (fileName) => {
      if(!confirm('确定删除此备份？')) return;
      await deleteBackup(fileName);
      loadBackups();
  };

  const clearData = async () => {
    if (confirm('⚠️ 警告：此操作将永久删除所有数据且无法恢复！\n\n确定要继续吗？')) {
        const secondConfirm = confirm('请再次确认：真的要清空所有数据吗？');
        if (secondConfirm) {
            await db.records.clear();
            await db.attachments.clear();
            alert('✓ 数据已清空');
            loadData();
        }
    }
  };

  return (
    <div className="container" style={{ paddingBottom: '120px', background: 'linear-gradient(180deg, #F0F4FF 0%, #F8FAFC 20%, #FFFFFF 100%)' }}>
      
      {/* Profile Header */}
      <div className="flex-column items-center" style={{ paddingTop: '40px', paddingBottom: '32px' }}>
        <div style={{ position: 'relative', marginBottom: '20px' }}>
            <div style={{ 
                width: '88px', height: '88px', 
                background: 'white', 
                borderRadius: '50%', 
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 12px 30px -4px rgba(59, 130, 246, 0.2), 0 0 0 5px rgba(255, 255, 255, 0.95)',
                position: 'relative',
                zIndex: 1
            }}>
                <div style={{
                    width: '100%', height: '100%',
                    background: 'linear-gradient(135deg, #DBEAFE 0%, #BFDBFE 100%)',
                    borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <ShieldCheck size={42} style={{ color: '#3B82F6' }} strokeWidth={2} />
                </div>
            </div>
             <div style={{
               position: 'absolute', bottom: '-2px', right: '-2px',
               background: 'linear-gradient(135deg, #10B981, #059669)',
               border: '3px solid white',
               borderRadius: '50%',
               width: '28px', height: '28px',
               display: 'flex', alignItems: 'center', justifyContent: 'center',
               zIndex: 2,
               boxShadow: '0 4px 8px rgba(16, 185, 129, 0.3)'
           }}>
               <Check size={14} color="white" strokeWidth={3} />
           </div>
        </div>

        <h1 style={{ 
            fontSize: '1.875rem', 
            fontWeight: 700, 
            letterSpacing: '-0.03em', 
            color: '#0F172A',
            margin: '0 0 12px 0'
        }}>我的档案</h1>
        
        <div style={{ 
            background: 'rgba(255, 255, 255, 0.9)', 
            padding: '10px 20px', 
            borderRadius: '99px',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
            display: 'flex', 
            alignItems: 'center', 
            gap: '10px',
            border: '1px solid rgba(148, 163, 184, 0.15)'
        }}>
            <Database size={16} style={{ color: '#3B82F6' }} />
            <span style={{ fontSize: '0.9rem', fontWeight: 500, color: '#475569' }}>
                本地存储 · {recordCount} 条记录
            </span>
        </div>
      </div>

      {/* Main Content */}
      <div>
          {/* Security Settings Card */}
          <div className="card" style={{ 
              padding: 0, 
              overflow: 'hidden', 
              border: 'none', 
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04), 0 4px 16px rgba(0, 0, 0, 0.04)',
              borderRadius: '20px',
              background: 'white',
              marginBottom: '16px'
          }}>
              {/* Password Setting */}
              <div className="help-row" style={{ padding: '20px', borderBottom: '1px solid #F1F5F9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                      <div className="icon-box" style={{ background: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)', color: '#3B82F6' }}>
                          <Lock size={20} strokeWidth={2.5} />
                      </div>
                      <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: '1rem', color: '#0F172A', marginBottom: '4px' }}>备份密码</div>
                          <div className="text-xs" style={{ color: '#64748B' }}>设置用于加密备份数据的密钥</div>
                      </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input 
                          type={showPassword ? "text" : "password"}
                          placeholder="输入密码（至少6位）" 
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          style={{ 
                              flex: 1,
                              padding: '12px 16px',
                              border: '2px solid #E2E8F0',
                              borderRadius: '12px',
                              fontSize: '0.95rem', 
                              color: '#0F172A',
                              outline: 'none',
                              transition: 'all 0.2s',
                              fontWeight: 500,
                              background: '#F8FAFC'
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#3B82F6'}
                          onBlur={(e) => { e.target.style.borderColor = '#E2E8F0'; saveSettings(); }}
                      />
                      <button 
                          onClick={() => setShowPassword(!showPassword)}
                          style={{
                              padding: '12px',
                              background: '#F1F5F9',
                              border: 'none',
                              borderRadius: '12px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#64748B',
                              transition: 'all 0.2s'
                          }}
                          onMouseDown={(e) => e.target.style.background = '#E2E8F0'}
                          onMouseUp={(e) => e.target.style.background = '#F1F5F9'}
                      >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                  </div>
              </div>

              {/* Auto Backup Toggle */}
              <div className="help-row flex-between" style={{ padding: '20px', borderBottom: '1px solid #F1F5F9' }}>
                  <div className="flex items-center gap-16">
                      <div className="icon-box" style={{ background: 'linear-gradient(135deg, #F5F3FF, #EDE9FE)', color: '#8B5CF6' }}>
                          <RefreshCw size={20} strokeWidth={2.5} />
                      </div>
                      <div>
                          <div style={{ fontWeight: 600, fontSize: '1rem', color: '#0F172A', marginBottom: '4px' }}>自动备份</div>
                          <div className="text-xs" style={{ color: '#64748B' }}>每次启动应用时自动备份</div>
                      </div>
                  </div>
                  
                  <div 
                    onClick={() => { 
                        if (!password) {
                            alert('请先设置备份密码');
                            return;
                        }
                        const newState = !autoBackupEnabled;
                        setAutoBackupEnabled(newState);
                        localStorage.setItem('backup_auto', newState);
                        localStorage.setItem('backup_pwd', password);
                        if (newState) {
                            alert('✓ 自动备份已开启\n应用启动时将自动创建备份');
                        } else {
                            alert('自动备份已关闭');
                        }
                    }}
                    style={{ 
                        width: '56px', height: '32px', 
                        background: autoBackupEnabled ? 'linear-gradient(135deg, #3B82F6, #2563EB)' : '#E2E8F0', 
                        borderRadius: '99px', 
                        position: 'relative', 
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', 
                        cursor: 'pointer',
                        boxShadow: autoBackupEnabled ? '0 4px 12px rgba(59, 130, 246, 0.3)' : 'inset 0 2px 4px rgba(0,0,0,0.06)'
                    }}
                >
                    <div style={{ 
                        width: '28px', height: '28px', 
                        background: 'white', 
                        borderRadius: '50%', 
                        position: 'absolute', 
                        top: '2px', 
                        left: autoBackupEnabled ? '26px' : '2px', 
                        transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)', 
                        boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
                    }}></div>
                </div>
              </div>

              {/* Manual Backup Button */}
              <div 
                  className="help-row" 
                  onClick={handleManualBackup} 
                  style={{ 
                      padding: '20px', 
                      cursor: 'pointer', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between' 
                  }}
              >
                <div className="flex items-center gap-16">
                      <div className="icon-box" style={{ background: 'linear-gradient(135deg, #ECFDF5, #D1FAE5)', color: '#10B981' }}>
                          <Download size={20} strokeWidth={2.5} />
                      </div>
                      <div>
                          <div style={{ fontWeight: 600, fontSize: '1rem', color: '#0F172A', marginBottom: '4px' }}>立即备份</div>
                          <div className="text-xs" style={{ color: '#64748B' }}>手动创建加密备份文件</div>
                      </div>
                  </div>
                  {loading ? (
                      <div className="spinner" style={{ 
                          width: '20px', 
                          height: '20px', 
                          borderTopColor: '#3B82F6', 
                          borderRightColor: '#3B82F6' 
                      }}></div>
                  ) : (
                      <ChevronRight size={20} style={{ color: '#CBD5E1' }} />
                  )}
              </div>
          </div>

          {/* Backup Management Card */}
          <div className="card" style={{ 
              padding: 0, 
              overflow: 'hidden', 
              border: 'none', 
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
              borderRadius: '20px',
              background: 'white',
              marginBottom: '16px'
          }}>
              <div 
                  className="help-row flex-between" 
                  onClick={() => setShowBackupList(!showBackupList)} 
                  style={{ 
                      padding: '20px', 
                      cursor: 'pointer', 
                      borderBottom: showBackupList ? '1px solid #F1F5F9' : 'none' 
                  }}
              >
                  <div className="flex items-center gap-16">
                      <div className="icon-box" style={{ background: 'linear-gradient(135deg, #FFF7ED, #FFEDD5)', color: '#F97316' }}>
                          <FileText size={20} strokeWidth={2.5} />
                      </div>
                      <div>
                          <div style={{ fontWeight: 600, fontSize: '1rem', color: '#0F172A', marginBottom: '4px' }}>备份历史</div>
                          <div className="text-xs" style={{ color: '#64748B' }}>
                              {backupList.length > 0 ? `共 ${backupList.length} 个备份文件` : '暂无备份'}
                          </div>
                      </div>
                  </div>
                  <ChevronRight 
                      size={20} 
                      style={{ 
                          color: '#CBD5E1',
                          transform: showBackupList ? 'rotate(90deg)' : 'none', 
                          transition: 'transform 0.3s' 
                      }} 
                  />
              </div>

              <div style={{ 
                  maxHeight: showBackupList ? '600px' : '0', 
                  overflowY: 'auto', 
                  transition: 'max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  background: '#FAFAFA'
              }}>
                   {!Capacitor.isNativePlatform() && (
                        <label className="flex items-center help-row" style={{ 
                            padding: '16px 20px', 
                            cursor: 'pointer', 
                            borderBottom: '1px solid #F1F5F9', 
                            background: 'white',
                            gap: '12px'
                        }}>
                            <div style={{ 
                                width: '36px', 
                                height: '36px', 
                                borderRadius: '10px',
                                background: 'linear-gradient(135deg, #F0F9FF, #E0F2FE)', 
                                color: '#0EA5E9',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <Upload size={18} strokeWidth={2.5} />
                            </div>
                            <span style={{ fontSize: '0.9rem', fontWeight: 500, color: '#0EA5E9' }}>导入备份文件 (Web)</span>
                            <input type="file" hidden onChange={(e) => handleRestore(e.target.files[0])} accept=".enc" />
                        </label>
                    )}
                    {backupList.length > 0 ? (
                        backupList.map((f, i) => (
                            <div key={i} className="help-row flex-between" style={{ 
                                padding: '16px 20px', 
                                borderBottom: i < backupList.length - 1 ? '1px solid #F1F5F9' : 'none', 
                                background: 'white' 
                            }}>
                                <div style={{ overflow: 'hidden', flex: 1, paddingRight: '12px' }}>
                                    <div className="flex items-center" style={{ marginBottom: '6px', gap: '8px' }}>
                                        <span style={{ 
                                            fontSize: '10px', 
                                            padding: '3px 8px', 
                                            borderRadius: '6px',
                                            fontWeight: 600,
                                            background: f.name.startsWith('auto') ? '#F1F5F9' : '#EFF6FF',
                                            color: f.name.startsWith('auto') ? '#64748B' : '#3B82F6'
                                        }}>
                                            {f.name.startsWith('auto') ? '自动' : '手动'}
                                        </span>
                                        <span style={{ fontWeight: 600, color: '#0F172A', fontSize: '0.85rem' }}>
                                            {(() => {
                                                const match = f.name.match(/(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})/);
                                                if (match) {
                                                    return `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}`;
                                                }
                                                const dateMatch = f.name.match(/(\d{4}-\d{2}-\d{2})/);
                                                return dateMatch ? dateMatch[1] : '未知日期';
                                            })()}
                                        </span>
                                    </div>
                                    <div className="text-xs" style={{ color: '#94A3B8', fontFamily: 'monospace', fontSize: '0.7rem' }}>{f.name}</div>
                                </div>
                                <div className="flex" style={{ gap: '6px' }}>
                                    <button 
                                        className="btn btn-sm" 
                                        onClick={() => handleRestoreFromList(f.name)} 
                                        style={{ 
                                            height: '32px', 
                                            padding: '0 12px', 
                                            fontSize: '0.75rem', 
                                            borderRadius: '8px',
                                            background: '#F0F9FF',
                                            color: '#0EA5E9',
                                            border: '1px solid #BFDBFE',
                                            fontWeight: 600,
                                            minWidth: '60px'
                                        }}
                                    >
                                        恢复
                                    </button>
                                    <button 
                                        className="btn btn-sm" 
                                        onClick={() => handleDeleteBackup(f.name)} 
                                        style={{ 
                                            height: '32px', 
                                            padding: '0 12px', 
                                            fontSize: '0.75rem', 
                                            borderRadius: '8px',
                                            background: '#FEF2F2',
                                            color: '#EF4444',
                                            border: '1px solid #FECACA',
                                            fontWeight: 600,
                                            minWidth: '60px'
                                        }}
                                    >
                                        删除
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : showBackupList && (
                         <div className="text-center" style={{ padding: '40px 20px' }}>
                             <div style={{ fontSize: '2.5rem', marginBottom: '12px', opacity: 0.3 }}>📦</div>
                             <div style={{ color: '#94A3B8', fontSize: '0.9rem' }}>还没有备份记录</div>
                         </div>
                    )}
              </div>
          </div>

          {/* Statistics Entry */}
          <div 
              className="card help-row" 
              onClick={() => navigate('/stats')}
              style={{ 
                  padding: 0, 
                  overflow: 'hidden', 
                  border: 'none', 
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  borderRadius: '20px',
                  background: 'white',
                  marginBottom: '16px',
                  cursor: 'pointer'
              }}
          >
              <div style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div className="flex items-center gap-16">
                      <div className="icon-box" style={{ background: 'linear-gradient(135deg, #FEF3C7, #FDE68A)', color: '#D97706' }}>
                          <BarChart2 size={20} strokeWidth={2.5} />
                      </div>
                      <div>
                          <div style={{ fontWeight: 600, fontSize: '1rem', color: '#0F172A', marginBottom: '4px' }}>数据统计</div>
                          <div className="text-xs" style={{ color: '#64748B' }}>查看就诊趋势和费用分析</div>
                      </div>
                  </div>
                  <ChevronRight size={20} style={{ color: '#CBD5E1' }} />
              </div>
          </div>

          {/* Danger Zone */}
          <button 
              className="card click-scale" 
              onClick={clearData} 
              style={{ 
                  width: '100%',
                  padding: '20px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  cursor: 'pointer', 
                  border: '2px dashed #FCA5A5', 
                  background: 'linear-gradient(135deg, #FEF2F2, #FEE2E2)',
                  borderRadius: '16px',
                  color: '#DC2626',
                  transition: 'all 0.2s',
                  gap: '12px'
              }}
          >
            <div style={{ 
                width: '40px', 
                height: '40px', 
                background: 'rgba(220, 38, 38, 0.1)', 
                borderRadius: '12px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center'
            }}>
                <Trash2 size={20} strokeWidth={2.5} />
            </div>
            <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 700, fontSize: '1rem' }}>清空所有数据</div>
                <div style={{ fontSize: '0.75rem', opacity: 0.7, marginTop: '2px' }}>此操作不可恢复，请谨慎操作</div>
            </div>
          </button>

          <div className="text-center" style={{ marginTop: '40px', opacity: 0.4, paddingBottom: '20px' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>BodyRecord</div>
              <div style={{ fontSize: '0.7rem', color: '#94A3B8' }}>v1.0.2 · 2025</div>
          </div>
      </div>

      <style>{`
          .icon-box {
              width: 44px; 
              height: 44px; 
              border-radius: 12px;
              display: flex; 
              align-items: center; 
              justify-content: center;
              flex-shrink: 0;
              transition: transform 0.2s;
          }
          .help-row {
              transition: all 0.2s;
          }
          .help-row:active {
              background: #F1F5F9 !important;
          }
          .help-row:active .icon-box {
              transform: scale(0.92);
          }
          .click-scale:active {
              transform: scale(0.97);
              background: linear-gradient(135deg, #FEE2E2, #FECACA) !important;
          }
      `}</style>
      
    </div>
  );
};
export default Profile;
