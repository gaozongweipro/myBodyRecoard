
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

const BACKUP_DIR = 'MedicalBackups';
const MAX_AUTO_BACKUPS = 30;

// Initialize backup directory
const initBackupDir = async () => {
    if (!Capacitor.isNativePlatform()) return;
    try {
        await Filesystem.mkdir({
            path: BACKUP_DIR,
            directory: Directory.Documents,
            recursive: true
        });
    } catch (e) {
        // Directory might already exist
    }
};

export const listBackups = async () => {
    if (!Capacitor.isNativePlatform()) return [];
    try {
        await initBackupDir();
        const result = await Filesystem.readdir({
            path: BACKUP_DIR,
            directory: Directory.Documents
        });
        // Return file list, sorted by name (date) desc
        return result.files
            .map(f => typeof f === 'string' ? { name: f } : f)
            .sort((a,b) => b.name.localeCompare(a.name));
    } catch (e) {
        console.error("List backups failed", e);
        return [];
    }
};

export const createBackup = async (dataEncryptedString, isAuto = false) => {
    if (!Capacitor.isNativePlatform()) return;
    try {
        await initBackupDir();
        const prefix = isAuto ? 'auto_backup_' : 'manual_backup_';
        
        // Use local time for filename to be readable
        const now = new Date();
        const timestamp = now.getFullYear() +
                          String(now.getMonth() + 1).padStart(2, '0') +
                          String(now.getDate()).padStart(2, '0') + '_' +
                          String(now.getHours()).padStart(2, '0') +
                          String(now.getMinutes()).padStart(2, '0') +
                          String(now.getSeconds()).padStart(2, '0');
        
        const fileName = `${prefix}${timestamp}.enc`;

        await Filesystem.writeFile({
            path: `${BACKUP_DIR}/${fileName}`,
            data: dataEncryptedString,
            directory: Directory.Documents,
            encoding: Encoding.UTF8
        });

        if (isAuto) {
            await cleanupAutoBackups();
        }
        return fileName;
    } catch (e) {
        console.error("Create backup failed", e);
        throw e;
    }
};

export const deleteBackup = async (fileName) => {
    if (!Capacitor.isNativePlatform()) return;
    await Filesystem.deleteFile({
        path: `${BACKUP_DIR}/${fileName}`,
        directory: Directory.Documents
    });
};

const cleanupAutoBackups = async () => {
    try {
        const backups = await listBackups();
        const autoBackups = backups.filter(f => f.name.startsWith('auto_backup_'));
        
        if (autoBackups.length > MAX_AUTO_BACKUPS) {
            // Sort desc, keep first MAX (latest), delete rest
            const toDelete = autoBackups.slice(MAX_AUTO_BACKUPS);
            for (const file of toDelete) {
                await deleteBackup(file.name);
            }
        }
    } catch (e) {
        console.error("Cleanup failed", e);
    }
};

export const readBackupFile = async (fileName) => {
    if (!Capacitor.isNativePlatform()) return null;
    const result = await Filesystem.readFile({
        path: `${BACKUP_DIR}/${fileName}`,
        directory: Directory.Documents,
        encoding: Encoding.UTF8
    });
    return result.data;
};
