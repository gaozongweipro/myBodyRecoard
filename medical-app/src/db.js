
import Dexie from 'dexie';

export const db = new Dexie('MedicalRecordsDB');

db.version(1).stores({
  records: '++id, date, hospital, department, type, title, timestamp',
  attachments: '++id, recordId, type' // content stored but not indexed
});

// Version 2: Add medications table
// Version 2: Add medications table
db.version(2).stores({
  records: '++id, date, hospital, department, type, title, timestamp',
  attachments: '++id, recordId, type',
  medications: '++id, name, startDate, endDate, status, linkedRecordId, createdAt'
});

// Version 3: Add medication_logs table
db.version(3).stores({
  records: '++id, date, hospital, department, type, title, timestamp',
  attachments: '++id, recordId, type',
  medications: '++id, name, startDate, endDate, status, linkedRecordId, createdAt',
  medication_logs: '++id, medicationId, date, time, status'
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

export const updateRecord = async (id, updates, newAttachments = [], deletedAttachmentIds = []) => {
  return db.transaction('rw', db.records, db.attachments, async () => {
    await db.records.update(id, {
        ...updates,
        timestamp: new Date().toISOString()
    });

    if (deletedAttachmentIds && deletedAttachmentIds.length > 0) {
        await db.attachments.bulkDelete(deletedAttachmentIds);
    }

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

// ========== Medication Management ==========

export const addMedication = async (medication) => {
    return await db.medications.add({
        ...medication,
        createdAt: new Date().toISOString(),
        status: medication.status || 'active'
    });
};

export const getAllMedications = async () => {
    return await db.medications.orderBy('createdAt').reverse().toArray();
};

export const getActiveMedications = async () => {
    return await db.medications.where('status').equals('active').toArray();
};

export const getMedicationById = async (id) => {
    return await db.medications.get(id);
};

export const updateMedication = async (id, updates) => {
    return await db.medications.update(id, updates);
};

export const deleteMedication = async (id) => {
    return await db.medications.delete(id);
};

export const stopMedication = async (id) => {
    return await db.medications.update(id, { 
        status: 'stopped',
        stoppedAt: new Date().toISOString()
    });
};

export const completeMedication = async (id) => {
    return await db.medications.update(id, { 
        status: 'completed',
        completedAt: new Date().toISOString()
    });
};

// ========== Medication Logs ==========

export const addMedicationLog = async ({ medicationId, date, time, status }) => {
    // Check if duplicate log exists
    const existing = await db.medication_logs
        .where({ medicationId, date, time })
        .first();
        
    if (existing) {
        return await db.medication_logs.update(existing.id, { status, timestamp: new Date().toISOString() });
    }

    return await db.medication_logs.add({
        medicationId,
        date,
        time,
        status,
        timestamp: new Date().toISOString()
    });
};

export const deleteMedicationLog = async ({ medicationId, date, time }) => {
    const existing = await db.medication_logs
        .where({ medicationId, date, time })
        .first();
    
    if (existing) {
        return await db.medication_logs.delete(existing.id);
    }
}

export const getMedicationLogs = async (medicationId) => {
    return await db.medication_logs.where('medicationId').equals(medicationId).toArray();
};

export const getTodayLogs = async () => {
    const today = new Date().toISOString().slice(0, 10);
    return await db.medication_logs.where('date').equals(today).toArray();
};

export const getRecentLogs = async (days = 7) => {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - days);
    
    const startStr = startDate.toISOString().slice(0, 10);
    
    return await db.medication_logs.where('date').aboveOrEqual(startStr).toArray();
};
