import Dexie from 'dexie';

export const db = new Dexie('SmartCareDB');

// Define Schema
db.version(1).stores({
  records: '++id, type, date, hospital, department, createdAt', // Indexed fields for search/sort
  files: '++id, recordId, type' // Separate table for heavy blobs
});

/**
 * Save record with transaction (Supports Multi-Page)
 * @param {Object} data - Processed JSON data
 * @param {Array<{original: Blob, masked: Blob}>} pages - Array of page image pairs
 */
export const saveMedicalRecord = async (data, pages) => {
  return await db.transaction('rw', db.records, db.files, async () => {
    // 1. Save Metadata
    const recordId = await db.records.add({ 
        ...data,
        createdAt: new Date()
    });

    // 2. Save Images (Multiple Pages)
    const filePromises = pages.map(async (page, index) => {
        // Save Original
        if (page.original) {
            await db.files.add({
                recordId,
                type: index === 0 ? 'original' : `original_${index}`, // Backward compat for index 0
                blob: page.original
            });
        }
        // Save Masked
        if (page.masked) {
             await db.files.add({
                recordId,
                type: index === 0 ? 'masked' : `masked_${index}`,
                blob: page.masked
            });
        }
    });

    await Promise.all(filePromises);
    return recordId;
  });
};

/**
 * Retrieve all records sorted by date descending
 */
export const getMyRecords = async () => {
  return await db.records.orderBy('date').reverse().toArray();
};

/**
 * Deep search records by keyword
 */
export const searchRecords = async (keyword) => {
  if (!keyword) return getMyRecords();
  
  const lowerKey = keyword.toLowerCase().trim();
  
  return await db.records
    .orderBy('date')
    .reverse()
    .filter(rec => {
       // 1. Basic Fields
       const basicMatch = 
           (rec.hospital && rec.hospital.toLowerCase().includes(lowerKey)) ||
           (rec.department && rec.department.toLowerCase().includes(lowerKey)) ||
           (rec.doctor && rec.doctor.toLowerCase().includes(lowerKey)) ||
           (rec.diagnosis && rec.diagnosis.toLowerCase().includes(lowerKey)) ||
           (rec.type && rec.type.toLowerCase().includes(lowerKey));
       
       if (basicMatch) return true;

       // 2. Deep Search in JSON (Medications & Inspections)
       if (rec.fullData) {
           // Medications
           if (rec.fullData.medications && rec.fullData.medications.some(m => m.name.toLowerCase().includes(lowerKey))) return true;
           // Inspections
           if (rec.fullData.inspections && rec.fullData.inspections.some(i => i.name.toLowerCase().includes(lowerKey))) return true;
       }
       
       return false;
    })
    .toArray();
};

/**
 * Export all data (records + files) to a JSON string
 */
export const exportDatabase = async () => {
    const allRecords = await db.records.toArray();
    const allFiles = await db.files.toArray();

    // Convert blobs to base64 for JSON serialization
    const filesWithBase64 = await Promise.all(allFiles.map(async (f) => {
        return {
            ...f,
            blob: await blobToBase64(f.blob) 
        };
    }));

    const exportData = {
        version: 1,
        timestamp: new Date().toISOString(),
        records: allRecords,
        files: filesWithBase64
    };

    return JSON.stringify(exportData);
};

/**
 * Import data from JSON string (Wipes existing data!)
 */
export const importDatabase = async (jsonString) => {
    try {
        const data = JSON.parse(jsonString);
        if (!data.records || !data.files) throw new Error("Invalid Backup Format");

        await db.transaction('rw', db.records, db.files, async () => {
            // Clear current DB
            await db.records.clear();
            await db.files.clear();

            // Restore Records
            await db.records.bulkAdd(data.records);

            // Restore Files (Convert Base64 back to Blob)
            const filesWithBlobs = data.files.map(f => ({
                ...f,
                blob: base64ToBlob(f.blob)
            }));
            await db.files.bulkAdd(filesWithBlobs);
        });
        return true;
    } catch (e) {
        console.error("Import Failed", e);
        throw e;
    }
};

// --- Helpers ---

const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

const base64ToBlob = (base64Data) => {
    const arr = base64Data.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
};
