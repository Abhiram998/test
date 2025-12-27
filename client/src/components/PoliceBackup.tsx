import React, { useState, useEffect } from 'react';
import { Loader2, Download, Trash2, RotateCcw, Save, FileJson } from 'lucide-react';

/* ================= TYPES ================= */

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

  /** LIVE / LOCAL restore (Quick Recovery + local snapshot) */
  onRestore: (records: VehicleRecord[]) => void;

  /** SNAPSHOT VIEW restore (non-destructive) */
  onSnapshotRestore?: (snapshotId: number) => void;

  appName?: string;
}

/* ================= COMPONENT ================= */

export default function PoliceBackup({
  getRecords,
  onRestore,
  onSnapshotRestore,
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
      setSnapshots(
        result.sort(
          (a, b) =>
            new Date(b.meta.createdAt).getTime() -
            new Date(a.meta.createdAt).getTime()
        )
      );
    };
  };

  /* ================= QUICK RECOVERY ================= */

  const handleQuickRecovery = async () => {
    if (!confirm('Quick Recovery will restore the CURRENT LIVE system state. Continue?')) return;

    setIsProcessing(true);
    setStatus('Fetching live records from server...');

    try {
      const records = await getRecords();

      if (!records.length) {
        alert('No active vehicle records found.');
        return;
      }

      onRestore(records);
      setStatus('Live system restored successfully.');
      alert(`Recovered ${records.length} vehicles.`);
    } catch (e) {
      alert('Quick Recovery failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  /* ================= MANUAL SNAPSHOT ================= */

  const handleSaveSnapshot = async () => {
    if (!db) return;

    setIsProcessing(true);
    setStatus('Creating local snapshot...');

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

      const tx = db.transaction([STORE_NAME], 'readwrite');
      tx.objectStore(STORE_NAME).add(snapshot);

      tx.oncomplete = () => {
        loadLocalSnapshots(db);
        setStatus('Snapshot saved locally.');
        alert('Snapshot saved.');
      };
    } finally {
      setIsProcessing(false);
    }
  };

  /* ================= UTILS ================= */

  const handleDelete = (id: number) => {
    if (!db || !confirm('Delete this snapshot?')) return;
    const tx = db.transaction([STORE_NAME], 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => loadLocalSnapshots(db);
  };

  const exportJSON = (snapshot: BackupSnapshot) => {
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `police-backup-${snapshot.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ================= RENDER ================= */

  return (
    <div className="text-zinc-100">
      {/* ACTION BAR */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-800 pb-6 mb-6">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <RotateCcw className={`w-5 h-5 text-blue-400 ${isProcessing ? 'animate-spin' : ''}`} />
            System Resilience
          </h2>
          <p className="text-xs text-zinc-500">{status || 'Ready for restore or logging.'}</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleQuickRecovery}
            disabled={isProcessing}
            className="px-4 py-2 bg-green-600 text-white rounded"
          >
            Quick Recovery
          </button>

          <button
            onClick={handleSaveSnapshot}
            disabled={isProcessing}
            className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded"
          >
            Manual Log
          </button>
        </div>
      </div>

      {/* HISTORY */}
      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {snapshots.map((snap) => (
          <div key={snap.id} className="p-3 border border-zinc-800 rounded flex justify-between">
            <div>
              <p className="text-xs">#{snap.id} — {new Date(snap.meta.createdAt).toLocaleString()}</p>
              <p className="text-[10px] text-zinc-500">{snap.meta.recordCount} records</p>
            </div>

            <div className="flex gap-2">
              <button onClick={() => exportJSON(snap)}>Download</button>

              {/* SNAPSHOT VIEW RESTORE */}
              <button
                onClick={() => onSnapshotRestore?.(snap.id)}
                className="text-blue-400 font-bold"
              >
                Restore
              </button>

              <button onClick={() => handleDelete(snap.id)}>
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
