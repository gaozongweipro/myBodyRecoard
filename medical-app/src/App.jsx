
import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Records from './pages/Records';
import AddRecord from './pages/AddRecord';
import Profile from './pages/Profile';
import RecordDetail from './pages/RecordDetail';
import Stats from './pages/Stats';
import { AIProvider } from './context/AIContext';
import { db } from './db';
import { createBackup } from './utils/backupManager';
import CryptoJS from 'crypto-js';

function App() {
  useEffect(() => {
    runAutoBackup();
  }, []);

  const runAutoBackup = async () => {
      const enabled = localStorage.getItem('backup_auto') === 'true';
      const pwd = localStorage.getItem('backup_pwd');
      if (enabled && pwd) {
          try {
              // Wait a bit to not slow down startup? Or just do it.
              console.log("Running auto backup...");
              const allRecords = await db.records.toArray();
              const allAttachments = await db.attachments.toArray();
              if (allRecords.length === 0) return; // Don't backup empty

              const data = {
                version: 1,
                timestamp: new Date().toISOString(),
                records: allRecords,
                attachments: allAttachments
              };
              const json = JSON.stringify(data);
              const encrypted = CryptoJS.AES.encrypt(json, pwd).toString();
              await createBackup(encrypted, true); // isAuto = true
              console.log("Auto backup complete");
          } catch(e) {
              console.error("Auto backup failed", e);
          }
      }
  };

  return (
    <AIProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="records" element={<Records />} />
            <Route path="records/:id" element={<RecordDetail />} />
            <Route path="add" element={<AddRecord />} />
            <Route path="edit/:id" element={<AddRecord />} />
            <Route path="stats" element={<Stats />} />
            <Route path="profile" element={<Profile />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </AIProvider>
  );
}

export default App;
