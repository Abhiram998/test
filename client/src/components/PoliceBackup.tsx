import React, { useState, useEffect } from 'react';
import { Loader2, Download, Trash2, RotateCcw, Save, FileJson } from 'lucide-react';

export type VehicleRecord = {
  plate: string;
  zone: string;
  timeIn: string;
  timeOut?: string | null;
  type?: 'heavy' | 'medium' | 'light';
};

type BackupSnapshot = {
  id: number;
  meta: {
    app: string;
    version: number;
    createdAt: string;
    recordCount: number;
  };
  data: VehicleRecord[];
};

interface PoliceBackupProps {
  getRecords: () => Promise<VehicleRecord[]>;
  onRestore: (records: VehicleRecord[]) => void;
  appName?: string;
}

export default function PoliceBackup({
  getRecords,
  onRestore,
  appName = "nilakkal-police-admin"
}: PoliceBackupProps) {
  const [snapshots, setSnapshots] = useState<BackupSnapshot[]>([]);
  const [status, setStatus] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [db, setDb] = useState<IDBDatabase | null>(null);

  const dbName = `${appName}-backup-db`;
  const STORE_NAME = 'backups';

  /* ================= DB INITIALIZATION ================= */

  useEffect(() => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      setDb(database);
      loadLocalSnapshots(database);
    };
  }, [dbName]);

  const loadLocalSnapshots = (database: IDBDatabase) => {
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => {
      const result = request.result as BackupSnapshot[];
      setSnapshots(result.sort((a, b) => 
        new Date(b.meta.createdAt).getTime() - new Date(a.meta.createdAt).getTime()
      ));
    };
  };

  /* ================= CORE ACTION: QUICK RECOVERY ================= */

  const handleQuickRecovery = async () => {
    if (!confirm('Quick Recovery will fetch the latest system state from the server and restore live data. Continue?')) return;

    setIsProcessing(true);
    setStatus('Fetching latest records from server...');

    try {
      // CRITICAL: We await the server records to ensure no "Promise" is passed to restore logic
      const records = await getRecords();

      if (!records || records.length === 0) {
        alert('No active vehicle records found on the server for today.');
        setStatus('Recovery failed: No server data.');
        return;
      }

      // Restore to application state
      onRestore(records);
      
      setStatus('Success: Dashboard recovered.');
      alert(`Quick Recovery successful! Restored ${records.length} vehicles.`);
    } catch (e) {
      console.error('Quick Recovery Error:', e);
      setStatus('Recovery Error: Check connection.');
      alert('Failed to perform Quick Recovery: ' + (e as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  /* ================= MANUAL SNAPSHOT SAVING ================= */

  const handleSaveSnapshot = async () => {
    if (!db) return;
    setIsProcessing(true);
    setStatus('Creating local backup...');

    try {
      const records = await getRecords();
      const snapshot: Omit<BackupSnapshot, 'id'> = {
        meta: {
          app: appName,
          version: 1,
          createdAt: new Date().toISOString(),
          recordCount: records.length
        },
        data: records
      };

      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(snapshot);

      request.onsuccess = () => {
        setStatus('Manual snapshot saved locally.');
        loadLocalSnapshots(db);
        alert('Snapshot saved to local browser storage.');
      };
    } catch (e) {
      console.error('Save Error:', e);
      setStatus('Error saving local snapshot.');
    } finally {
      setIsProcessing(false);
    }
  };

  /* ================= UTILS ================= */

  const handleDelete = (id: number) => {
    if (!db || !confirm('Delete this backup from local history?')) return;
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = () => loadLocalSnapshots(db);
  };

  const exportJSON = (snapshot: BackupSnapshot) => {
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `police-backup-${new Date(snapshot.meta.createdAt).getTime()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !db) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = JSON.parse(event.target?.result as string);
        if (!content.data || !Array.isArray(content.data)) throw new Error('Invalid JSON format.');
        
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        store.add({
          meta: {
            app: appName,
            version: content.meta?.version || 1,
            createdAt: content.meta?.createdAt || new Date().toISOString(),
            recordCount: content.data.length
          },
          data: content.data
        });
        transaction.oncomplete = () => {
          loadLocalSnapshots(db);
          alert('Backup file imported successfully.');
        };
      } catch (err) {
        alert('Import Error: ' + (err as Error).message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  /* ================= RENDER ================= */

  return (
    <div className="text-zinc-100">
      {/* ACTION BAR */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-800 pb-6 mb-6">
        <div className="space-y-1">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <RotateCcw className={`w-5 h-5 text-blue-400 ${isProcessing ? 'animate-spin' : ''}`} />
            System Resilience
          </h2>
          <p className="text-xs text-zinc-500 font-medium">
            {status || 'Ready for data restoration or local logging.'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleQuickRecovery}
            disabled={isProcessing}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded text-sm font-bold transition-all shadow-lg shadow-green-900/20"
          >
            <RotateCcw className="w-4 h-4" />
            Quick Recovery
          </button>
          
          <button
            onClick={handleSaveSnapshot}
            disabled={isProcessing}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-sm font-medium border border-zinc-700"
          >
            <Save className="w-4 h-4" />
            Manual Log
          </button>

          <label className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-sm font-medium border border-zinc-700 cursor-pointer">
            <FileJson className="w-4 h-4" />
            Import
            <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
          </label>
        </div>
      </div>

      {/* HISTORY LIST */}
      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
        <h3 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-3">Local Storage History</h3>
        
        {snapshots.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-zinc-800 rounded">
            <p className="text-zinc-600 text-xs">No local logs found on this device.</p>
          </div>
        ) : (
          snapshots.map((snap) => (
            <div 
              key={snap.id} 
              className="p-3 bg-zinc-900/50 border border-zinc-800 rounded flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:border-zinc-700 transition-colors"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold text-zinc-500 bg-zinc-800 px-1 rounded">#{snap.id}</span>
                  <span className="text-xs font-semibold text-zinc-300">
                    {new Date(snap.meta.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="text-[10px] text-zinc-500 flex items-center gap-2">
                  <span className="text-blue-400 font-bold">{snap.meta.recordCount} records</span>
                  <span>•</span>
                  <span>v{snap.meta.version}</span>
                </div>
              </div>
              
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  onClick={() => exportJSON(snap)}
                  className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-[10px] text-zinc-400 rounded border border-zinc-700"
                >
                  Download
                </button>
                <button
                  onClick={() => onRestore(snap.data)}
                  className="px-3 py-1 bg-blue-900/20 hover:bg-blue-900/40 text-[10px] text-blue-400 border border-blue-900/50 rounded font-bold"
                >
                  Restore
                </button>
                <button
                  onClick={() => handleDelete(snap.id)}
                  className="p-1 text-zinc-700 hover:text-red-500"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}