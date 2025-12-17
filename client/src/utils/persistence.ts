export type VehicleRecord = {
  plate: string;
  zone: string;
  timeIn: string;
  timeOut?: string | null;
  type?: 'heavy' | 'medium' | 'light';
};

const DB_NAME = "nilakkal-police-events-db";
const DB_VERSION = 1;
const STORE_EVENTS = "events";
const STORE_BACKUPS = "backups";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_EVENTS)) {
        db.createObjectStore(STORE_EVENTS, { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(STORE_BACKUPS)) {
        db.createObjectStore(STORE_BACKUPS, { keyPath: "id" });
      }
    };
  });
}

export async function appendEvent(record: VehicleRecord): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_EVENTS], "readwrite");
    const store = transaction.objectStore(STORE_EVENTS);
    const event = {
      createdAt: new Date().toISOString(),
      record
    };
    const request = store.add(event);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function readAllEvents(): Promise<{ id: string; createdAt: string; record: VehicleRecord }[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_EVENTS], "readonly");
    const store = transaction.objectStore(STORE_EVENTS);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function rebuildStateFromEvents(): Promise<VehicleRecord[]> {
  const events = await readAllEvents();
  // Sort events by time just in case (though getAll usually returns in key order)
  events.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const vehicleMap = new Map<string, VehicleRecord>();

  for (const event of events) {
    const { record } = event;
    // Simple logic: last event for a plate wins (updates status)
    // If we had distinct "ENTER" and "EXIT" event types, we'd handle them differently.
    // Based on the record structure, it seems to represent the current state of a vehicle.
    // If timeOut is present, they left? Or maybe we just track the latest record object.
    
    // Assuming 'record' is the full state of that vehicle at that time.
    vehicleMap.set(record.plate, record);
  }

  // Return only vehicles that haven't "left" if timeOut implies leaving
  // But requirement says "rebuild current vehicle list".
  // If timeOut is set, they are effectively history, but maybe we still want to return them if we are displaying logs.
  // However, for "current parking log", usually we want currently parked.
  // Let's filter out ones with timeOut if that's the convention, OR just return all unique latest states.
  // The requirement says "rebuild current vehicle list". I'll return all latest states.
  // Integration logic will decide if it filters by timeOut.
  
  return Array.from(vehicleMap.values());
}

export async function saveLatestSnapshot(payload: { meta: any; data: VehicleRecord[] }): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_BACKUPS], "readwrite");
    const store = transaction.objectStore(STORE_BACKUPS);

    // Save as "latest"
    store.put({ id: "latest", ...payload });

    // Save timestamped copy
    store.put({ id: `snap-${Date.now()}`, ...payload });

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function loadLatestSnapshotPayload(): Promise<{ meta: any; data: VehicleRecord[] } | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_BACKUPS], "readonly");
    const store = transaction.objectStore(STORE_BACKUPS);
    const request = store.get("latest");

    request.onsuccess = () => {
      const result = request.result;
      if (result) {
        // Remove the internal ID when returning payload
        const { id, ...payload } = result;
        resolve(payload);
      } else {
        resolve(null);
      }
    };
    request.onerror = () => reject(request.error);
  });
}
