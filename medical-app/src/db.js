
import Dexie from 'dexie';

export const db = new Dexie('MedicalRecordsDB');

db.version(1).stores({
  records: '++id, date, hospital, department, type, title, timestamp',
  attachments: '++id, recordId, type' // content stored but not indexed
});

export const addRecord = async (record, attachments = []) => {
  return db.transaction('rw', db.records, db.attachments, async () => {
    const recordId = await db.records.add({
      ...record,
      timestamp: new Date().toISOString()
    });

    if (attachments.length > 0) {
      await db.attachments.bulkAdd(attachments.map(att => ({
        ...att,
        recordId
      })));
    }
    return recordId;
  });
};

export const getRecordWithAttachments = async (id) => {
  const record = await db.records.get(id);
  if (!record) return null;
  const attachments = await db.attachments.where('recordId').equals(id).toArray();
  return { ...record, attachments };
};

export const getAllRecords = async () => {
  return await db.records.orderBy('date').reverse().toArray();
};


export const searchRecords = async (query) => {
    if (!query) return getAllRecords();
    const lowerQuery = query.toLowerCase();
    
    // 1. Search in Records
    const allRecords = await db.records.toArray();
    let results = allRecords.filter(r => 
        (r.hospital && r.hospital.toLowerCase().includes(lowerQuery)) ||
        (r.department && r.department.toLowerCase().includes(lowerQuery)) ||
        (r.title && r.title.toLowerCase().includes(lowerQuery)) ||
        (r.type && r.type.toLowerCase().includes(lowerQuery))
    );

    // 2. Search in Attachments (OCR Text)
    // Dexie Collection.filter is efficient enough for client-side small DBs
    const matchedAttachments = await db.attachments.filter(att => 
        att.ocrText && att.ocrText.toLowerCase().includes(lowerQuery)
    ).toArray();

    // 3. Merge Results
    const attachmentRecordIds = new Set(matchedAttachments.map(a => a.recordId));
    const resultRecordIds = new Set(results.map(r => r.id));

    for (const rid of attachmentRecordIds) {
        if (!resultRecordIds.has(rid)) {
            const rec = allRecords.find(r => r.id === rid);
            if (rec) {
                results.push(rec);
                resultRecordIds.add(rid);
            }
        }
    }

    return results.sort((a,b) => new Date(b.date) - new Date(a.date));
};

export const updateRecord = async (id, updates, newAttachments = []) => {
  return db.transaction('rw', db.records, db.attachments, async () => {
    await db.records.update(id, {
        ...updates,
        timestamp: new Date().toISOString()
    });

    if (newAttachments.length > 0) {
       await db.attachments.bulkAdd(newAttachments.map(att => ({
         ...att,
         recordId: id
       })));
    }
    return id;
  });
};

export const deleteRecord = async (id) => {
    return db.transaction('rw', db.records, db.attachments, async () => {
        await db.records.delete(id);
        await db.attachments.where('recordId').equals(id).delete();
    });
};
