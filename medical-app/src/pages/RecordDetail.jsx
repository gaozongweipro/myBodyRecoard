

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

import { getRecordWithAttachments, db } from '../db';
import { ArrowLeft, Calendar, MapPin, Activity, Clock, Trash, FileText, Download, Share2, X, User } from 'lucide-react';
import { format } from 'date-fns';

const RecordDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [previewImage, setPreviewImage] = useState(null); // URL for full screen preview

  useEffect(() => {
    load();
  }, [id]);

  const load = async () => {
    const data = await getRecordWithAttachments(parseInt(id));
    if (!data) {
        alert('记录不存在');
        navigate('/records');
        return;
    }
    setRecord(data);
    setLoading(false);
  };

  const handleDelete = async () => {
      if(confirm('删除后不可恢复，确定删除？')) {
        await db.records.delete(record.id);
        await db.attachments.where('recordId').equals(record.id).delete();
        navigate('/records');
      }
  };

  const handleDownload = async (att) => {
      try {
          if (Capacitor.isNativePlatform()) {
              // Native: Use Filesystem to write to Documents
              const fileName = att.name || `file_${att.id}.${att.type === 'application/pdf' ? 'pdf' : 'jpg'}`;
              
              const savedFile = await Filesystem.writeFile({
                  path: fileName,
                  data: att.data, // base64 data url? Filesystem expects pure base64 (without prefix) or data url?
                  // Capacitor 6+ writes data url fine usually, otherwise need to strip prefix.
                  // Docs say: "data: Data to write... If a string is supplied, it is written as utf-8 ... unless type is not specified"
                  // Actually for images/binary, it's safer to strip the prefix if it exists.
                  // Base64 string for binary data.
                  directory: Directory.Documents,
              });

              alert(`已保存到文档目录: ${savedFile.uri}`);
              
              // Optional: Try to open or share it immediately?
          } else {
              // Web: Use anchor tag download
              const a = document.createElement('a');
              a.href = att.data;
              a.download = att.name || `file_${att.id}.${att.type === 'application/pdf' ? 'pdf' : 'jpg'}`;
              a.click();
          }
      } catch (e) {
          console.error("Download failed", e);
          alert("保存失败: " + e.message);
      }
  };

  const handleShare = async (att) => {
      if (!Capacitor.isNativePlatform()) {
          alert("网页版暂不支持原生分享，请使用下载功能。");
          return;
      }
      try {
          // Check if can share
          const canShare = await Share.canShare();
          if(!canShare.value) {
               alert("您的设备不支持分享");
               return;
          }

          // For share, we often need a file on disk first, OR we can share text/url.
          // Sharing base64 directly: "Share supports sharing local files... by passing file path in `files` array".
          // So we MUST write to temp first.
          
          const fileName = `share_${att.id}.${att.type==='application/pdf'?'pdf':'jpg'}`;
          const result = await Filesystem.writeFile({
              path: fileName,
              data: att.data,
              directory: Directory.Cache 
          });

          await Share.share({
              title: att.name || '分享附件',
              text: '我的病历附件',
              url: result.uri, 
              dialogTitle: '分享到'
          });
      } catch (e) {
          console.error("Share failed", e);
          // alert("分享失败: " + e.message); 
      }
  };

  const generateICS = () => {
      if(!record) return;
      const dateStr = prompt("请输入提醒日期 (YYYY-MM-DD)", format(new Date(), 'yyyy-MM-dd'));
      if(!dateStr) return;
      
      const title = `复查/吃药提醒: ${record.hospital} ${record.department}`;
      const desc = `原记录: ${record.title || ''}\n备注: ${record.notes || ''}`;
      
      const icsMsg = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:${dateStr.replace(/-/g, '')}T090000
SUMMARY:${title}
DESCRIPTION:${desc}
END:VEVENT
END:VCALENDAR`;

      const blob = new Blob([icsMsg], { type: 'text/calendar' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reminder_${record.id}.ics`;
      a.click();
  };


  const [scale, setScale] = useState(1);

  const handleZoom = (e) => {
      // Very simple click to zoom in/out
      e.stopPropagation();
      setScale(prev => prev === 1 ? 2.5 : 1);
  };


  const renderModuleThumbnails = (moduleName) => {
      const moduleAttachments = record.attachments?.filter(a => a.module === moduleName) || [];
      if (moduleAttachments.length === 0) return null;

      return (
          <div className="flex" style={{ gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
              {moduleAttachments.map(att => {
                  let label = null;
                   if (moduleName === 'cost_ocr' && record.cost_items) {
                        const index = record.cost_items.findIndex(item => item.attachmentId === att.id);
                        if (index !== -1) {
                            label = `明细${index + 1}`;
                        }
                    }

                  return (
                      <div key={att.id} style={{ position: 'relative', width: '60px', height: '60px', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                          <img 
                              src={att.data} 
                              alt="thumbnail" 
                              style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }} 
                              onClick={() => { setScale(1); setPreviewImage(att.data); }}
                          />
                           {label && (
                                <div style={{ 
                                    position: 'absolute', bottom: 0, left: 0, right: 0, 
                                    background: 'rgba(0,0,0,0.6)', color: 'white', 
                                    fontSize: '8px', textAlign: 'center', padding: '2px 0' 
                                }}>
                                    {label}
                                </div>
                            )}
                      </div>
                  );
              })}
          </div>
      );
  };

  if (loading) return <div className="container" style={{paddingTop:'50px', textAlign:'center'}}>加载中...</div>;

  return (
    <div className="container" style={{ paddingBottom: '100px' }}>
      
      {/* Full screen preview */}
      {previewImage && (
          <div 
            style={{ position: 'fixed', inset: 0, background: 'black', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }} 
            onClick={() => setPreviewImage(null)}
          >
              <div style={{ width: '100%', height: '100%', overflow: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <img 
                    src={previewImage} 
                    style={{ 
                        maxWidth: '100vw', 
                        maxHeight: '100vh', 
                        objectFit: 'contain',
                        transform: `scale(${scale})`,
                        transition: 'transform 0.3s',
                        cursor: scale === 1 ? 'zoom-in' : 'zoom-out'
                    }} 
                    onClick={handleZoom}
                />
              </div>
              
               <a 
                    href={previewImage} 
                    download={`preview_${Date.now()}.png`}
                    onClick={(e) => e.stopPropagation()}
                    style={{ position: 'absolute', top: 40, right: 80, background: 'rgba(255,255,255,0.2)', borderRadius: '50%', padding: '10px', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                    <Download size={24}/>
                </a>

              <button 
                  style={{ position: 'absolute', top: '40px', right: '20px', background: 'rgba(255,255,255,0.3)', borderRadius: '50%', color: 'white', padding: '8px', border: 'none', zIndex: 2001 }}
                  onClick={(e) => { e.stopPropagation(); setPreviewImage(null); }}
              >
                  <X size={24} />
              </button>
          </div>
      )}

      <div className="flex-between mb-4 sticky-top" style={{ padding: '10px 0', background: 'var(--bg-main)', zIndex: 10 }}>
         <button onClick={() => navigate(-1)} className="btn btn-secondary" style={{ width: 'auto', padding: '8px' }}>
            <ArrowLeft size={20} />
         </button>
         <h3>详情</h3>
         <div style={{ display: 'flex', gap: '10px' }}>
             <button onClick={() => navigate(`/edit/${record.id}`)} className="btn btn-secondary" style={{ width: 'auto', padding: '8px 12px' }}>
                编辑
             </button>
             <button onClick={handleDelete} className="btn" style={{ color: 'var(--error)', width: 'auto', padding: '8px' }}>
                <Trash size={20} />
             </button>
         </div>
      </div>

      <div className="card">
         <h2 className="mb-2">{record.title || "无标题"}</h2>
         
         <div className="flex g-2 mb-2 text-muted" style={{alignItems:'center'}}>
            <Calendar size={16} />
            <span>{format(new Date(record.date), 'yyyy年MM月dd日 HH:mm')}</span>
         </div>
         
         <div className="flex g-2 mb-2" style={{alignItems:'center', flexWrap: 'wrap'}}>
            <MapPin size={16} className="text-secondary" style={{ flexShrink: 0 }} />
            <span style={{ fontWeight: 500 }}>{record.hospital}</span>
            <span className="text-muted">|</span>
            <span>{record.department}</span>
         </div>

         {record.doctor && (
            <div className="flex g-2 mb-2 text-muted" style={{alignItems:'center'}}>
                <User size={16} />
                <span>{record.doctor}</span>
            </div>
         )}

         <div className="badge" style={{ display: 'inline-block', background: 'var(--primary)', color: 'white', padding: '4px 12px', borderRadius: '16px', fontSize: '0.8rem', marginTop: '8px' }}>
            {record.type}
         </div>


         {record.diagnosis && (
             <div style={{ marginTop: '1rem', background: '#f1f5f9', padding: '1rem', borderRadius: '8px' }}>
                <div className="text-xs text-muted mb-1" style={{ fontWeight: 600 }}>详细诊断</div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{record.diagnosis}</div>
                {renderModuleThumbnails('diagnosis')}
             </div>
         )}
         {!record.diagnosis && renderModuleThumbnails('diagnosis') && (
            <div style={{ marginTop: '1rem', background: '#f1f5f9', padding: '1rem', borderRadius: '8px' }}>
                 <div className="text-xs text-muted mb-1" style={{ fontWeight: 600 }}>详细诊断 (图片)</div>
                 {renderModuleThumbnails('diagnosis')}
            </div>
         )}

         {record.medical_advice && (
             <div style={{ marginTop: '1rem', background: '#f1f5f9', padding: '1rem', borderRadius: '8px' }}>
                <div className="text-xs text-muted mb-1" style={{ fontWeight: 600 }}>医嘱 / 处方</div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{record.medical_advice}</div>
                {renderModuleThumbnails('medical_advice')}
             </div>
         )}
         {!record.medical_advice && renderModuleThumbnails('medical_advice') && (
            <div style={{ marginTop: '1rem', background: '#f1f5f9', padding: '1rem', borderRadius: '8px' }}>
                 <div className="text-xs text-muted mb-1" style={{ fontWeight: 600 }}>医嘱 / 处方 (图片)</div>
                 {renderModuleThumbnails('medical_advice')}
            </div>
         )}

         {/* Cost Display */}
         {(record.cost_items?.length > 0 || record.cost_total) && (
              <div style={{ marginTop: '1rem', background: '#FFF7ED', padding: '1rem', borderRadius: '8px', border: '1px solid #FFEDD5' }}>
                  <div className="text-xs text-muted mb-2" style={{ fontWeight: 600, color: '#C2410C' }}>医疗费用</div>
                  
                  {/* Summary */}
                  <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '8px' }}>
                        <div><div className="text-xs text-muted">总金额</div><div style={{ fontWeight: 'bold' }}>￥{parseFloat(record.cost_total||0).toFixed(2)}</div></div>
                        <div><div className="text-xs text-muted">自费</div><div>￥{parseFloat(record.cost_self||0).toFixed(2)}</div></div>
                        <div><div className="text-xs text-muted">统筹</div><div>￥{parseFloat(record.cost_pool||0).toFixed(2)}</div></div>
                        <div><div className="text-xs text-muted">个账</div><div>￥{parseFloat(record.cost_personal||0).toFixed(2)}</div></div>
                  </div>

                  {/* Details List */}
                  {record.cost_items?.length > 0 && (
                      <div style={{ marginTop: '8px', borderTop: '1px dashed #fdba74', paddingTop: '8px' }}>
                          {record.cost_items.map((item, i) => (
                              <div key={item.id || i} className="flex-between text-xs text-muted" style={{ marginBottom: '4px' }}>
                                  <span>明细 {i+1}</span>
                                  <span>自费: {item.self} | 统筹: {item.pool} | 个账: {item.personal}</span>
                              </div>
                          ))}
                      </div>
                  )}
                  {renderModuleThumbnails('cost_ocr')}
              </div>
         )}

         {record.notes && (
             <div style={{ marginTop: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '8px', whiteSpace: 'pre-wrap', border: '1px dashed var(--border)' }}>
                <div className="text-xs text-muted mb-1">其他备注</div>
                {record.notes}
             </div>
         )}
      </div>


      {/* General Attachments - Filtered */}
      {(record.attachments?.some(a => !a.module)) && (
          <div className="card">
            <h3>附件 ({record.attachments?.filter(a => !a.module).length})</h3>
            <div className="grid" style={{ gap: '1rem' }}>
                {record.attachments?.filter(att => !att.module).map(att => (
                <div key={att.id} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '10px' }}>
                    {/* Header / Type */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {att.type === 'application/pdf' ? <FileText size={20} /> : <MapPin size={20} />}
                            <span className="text-sm" style={{ fontWeight: 500 }}>
                                {att.name || (att.type === 'application/pdf' ? 'PDF文件' : '图片')}
                            </span>
                        </div>
                        <div className="flex" style={{ gap: '8px' }}>
                                <button className="btn btn-secondary text-xs" style={{ width: 'auto', padding: '4px 8px' }} onClick={() => handleShare(att)}>
                                    <Share2 size={16} />
                                </button>
                                <button className="btn btn-secondary text-xs" style={{ width: 'auto', padding: '4px 8px' }} onClick={() => handleDownload(att)}>
                                    <Download size={16} />
                                </button>
                        </div>
                    </div>

                    {/* Content */}
                    {att.type === 'application/pdf' ? (
                        <div style={{ padding: '20px', background: '#f8fafc', borderRadius: '8px', textAlign: 'center' }}>
                                <FileText size={40} className="text-secondary" style={{ marginBottom: '10px' }}/>
                                <p className="text-xs text-muted">点击上方按钮下载/分享查看</p>
                        </div>
                    ) : (
                        <img 
                                src={att.data} 
                                style={{ width: '100%', borderRadius: '8px', border: '1px solid var(--border)' }} 
                                loading="lazy" 
                                onClick={() => { setScale(1); setPreviewImage(att.data); }}
                            />
                    )}
                </div>
                ))}
            </div>
          </div>
      )}


      <div className="card">
         <h3>后续提醒</h3>
         <p className="text-muted text-sm">将此记录添加到日历提醒。</p>
         <button className="btn btn-primary" onClick={generateICS}>
            <Clock size={18} style={{ marginRight: '8px' }} />
            设置日历提醒
         </button>
      </div>

    </div>
  );
};

export default RecordDetail;
