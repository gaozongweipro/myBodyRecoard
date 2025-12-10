
import React, { useState, useEffect } from 'react';
import { db } from '../db';
import CryptoJS from 'crypto-js';
import { Download, Upload, Trash2, ShieldCheck, Key, FileInput, RefreshCw, Settings, Check } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { createBackup, listBackups, readBackupFile, deleteBackup } from '../utils/backupManager';
import { format } from 'date-fns';

const Profile = () => {
  const [password, setPassword] = useState(localStorage.getItem('backup_pwd') || '');
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(localStorage.getItem('backup_auto') === 'true');
  const [loading, setLoading] = useState(false);
  const [backupList, setBackupList] = useState([]);
  const [showBackupList, setShowBackupList] = useState(false);

  useEffect(() => {
      if (Capacitor.isNativePlatform()) {
          loadBackups();
      }
  }, [showBackupList]);

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
      alert('设置已保存');
  };

  const handleManualBackup = async () => {
    if (!password) return alert('请设置导出密码以保障安全');
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
          await createBackup(encrypted, false); // isAuto = false
          alert('备份成功！');
          loadBackups();
      } else {
          // Web Fallback
           const blob = new Blob([encrypted], { type: 'application/octet-stream' });
           const url = URL.createObjectURL(blob);
           const a = document.createElement('a');
           a.href = url;
           a.download = `manual_backup_${new Date().toISOString().slice(0,10)}.enc`;
           a.click();
      }
    } catch (e) {
      console.error(e);
      alert('备份失败: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (fileContentOrFileObject) => {
    if (!password) return alert('请输入解密密码');
    if (!confirm('恢复将覆盖/合并现有数据，是否继续？')) return;

    setLoading(true);
    try {
        let encrypted = '';
        if (typeof fileContentOrFileObject === 'string') {
            encrypted = fileContentOrFileObject;
        } else {
            // Browser file object
            encrypted = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = e => resolve(e.target.result);
                reader.readAsText(fileContentOrFileObject);
            });
        }

        const bytes = CryptoJS.AES.decrypt(encrypted, password);
        const originalText = bytes.toString(CryptoJS.enc.Utf8);
        
        if (!originalText) throw new Error('密码错误或文件损坏');

        const data = JSON.parse(originalText);
        
        await db.transaction('rw', db.records, db.attachments, async () => {
            await db.records.clear(); // Clear old data for clean restore as requested? "Recover" usually means Replace?
            // User requested "Recover". Mixed merge might be messy. Let's clear + add.
            // But wait, if user just wants to see old record?
            // "Recover" usually implies "I lost my data, give it back".
            // Let's safe clear.
            await db.records.bulkPut(data.records);
            await db.attachments.clear();
            await db.attachments.bulkPut(data.attachments);
        });

        alert('数据恢复成功！');
    } catch (err) {
        console.error(err);
        alert('恢复失败: ' + err.message);
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
          alert('读取文件失败:' + e.message);
          setLoading(false);
      }
  };
  
  const handleDeleteBackup = async (fileName) => {
      if(!confirm('确定删除此备份？')) return;
      await deleteBackup(fileName);
      loadBackups();
  };

  const clearData = async () => {
    if (confirm('确定要清空所有数据吗？此操作不可逆！')) {
       await db.records.clear();
       await db.attachments.clear();
       alert('数据已清空');
    }
  };

  return (
    <div className="container">
      <h2 className="mb-4">我的档案</h2>

      <div className="card mb-4" style={{ textAlign: 'center', padding: '2rem' }}>
        <div style={{ width: '80px', height: '80px', background: 'var(--surface)', borderRadius: '50%', margin: '0 auto 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow)' }}>
           <ShieldCheck size={40} color="var(--primary)" />
        </div>
        <h3>本地安全存储</h3>
        <p className="text-muted text-sm">您的所有医疗数据仅存储在当前设备。</p>
      </div>

      <div className="card">
        <h3>备份设置</h3>
        <p className="text-muted text-sm mb-4">开启自动备份，每次打开App自动保存数据到手机文档目录。</p>
        
        <div className="mb-4">
             <label className="text-sm text-muted mb-1 block">备份密码 (必填)</label>
             <div className="flex g-2">
                <input 
                    type="password" 
                    placeholder="输入密码用于加密" 
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    style={{ border: '1px solid var(--border)', borderRadius: '8px' }}
                />
             </div>
        </div>

        <div className="flex-between mb-4">
            <span>开启自动备份 (保留最近30条)</span>
            <div 
                onClick={() => setAutoBackupEnabled(!autoBackupEnabled)}
                style={{ 
                    width: '40px', height: '24px', background: autoBackupEnabled ? 'var(--primary)' : '#ccc', 
                    borderRadius: '12px', position: 'relative', transition: '0.2s', cursor: 'pointer' 
                }}
            >
                <div style={{ 
                    width: '20px', height: '20px', background: 'white', borderRadius: '50%', 
                    position: 'absolute', top: '2px', left: autoBackupEnabled ? '18px' : '2px', transition: '0.2s'
                }}></div>
            </div>
        </div>

        <button className="btn btn-primary mb-4" onClick={saveSettings}>
            保存设置
        </button>

        <hr style={{ borderColor: 'var(--border)', margin: '20px 0' }} />

        <h3>手动作业</h3>
        <div className="grid g-2 mb-4">
            <button className="btn btn-secondary" onClick={handleManualBackup} disabled={loading}>
                <Download size={18} style={{ marginRight: '8px' }} />
                立即手动备份
            </button>
            <button className="btn btn-secondary" onClick={() => setShowBackupList(!showBackupList)}>
                <RefreshCw size={18} style={{ marginRight: '8px' }} />
                管理/恢复备份 {showBackupList ? '▲' : '▼'}
            </button>
        </div>
        
        {/* Web fallback import */}
        {!Capacitor.isNativePlatform() && (
            <label className="btn btn-secondary">
                <Upload size={18} style={{ marginRight: '8px' }} />
                从文件恢复 (Web)
                <input type="file" hidden onChange={(e) => handleRestore(e.target.files[0])} />
            </label>
        )}

        {showBackupList && Capacitor.isNativePlatform() && (
            <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '10px', maxHeight: '300px', overflowY: 'auto' }}>
                {backupList.length === 0 ? <div className="text-center text-muted text-sm">暂无备份</div> : (
                    backupList.map((f, i) => (
                        <div key={i} className="flex-between" style={{ padding: '8px', borderBottom: '1px solid #eee' }}>
                            <div style={{ overflow: 'hidden' }}>
                                <div className="text-sm" style={{ fontWeight: 500 }}>
                                    {f.name.startsWith('auto') ? '自动备份' : '手动备份'}
                                </div>
                                <div className="text-xs text-muted">{f.name}</div>
                            </div>
                            <div className="flex g-2">
                                <button className="btn text-xs btn-primary" style={{ width: 'auto', padding: '4px 8px' }} onClick={() => handleRestoreFromList(f.name)}>
                                    恢复
                                </button>
                                <button className="btn text-xs" style={{ width: 'auto', padding: '4px 8px', color: 'var(--error)' }} onClick={() => handleDeleteBackup(f.name)}>
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        )}

      </div>

      <div className="card" style={{ marginTop: '2rem', borderColor: 'var(--error)' }}>
        <h3 style={{ color: 'var(--error)' }}>危险区域</h3>
        <button className="btn" style={{ color: 'var(--error)', border: '1px solid var(--error)', marginTop: '1rem' }} onClick={clearData}>
            <Trash2 size={18} style={{ marginRight: '8px' }} />
            清空所有数据
        </button>
      </div>
    </div>
  );
};
export default Profile;
