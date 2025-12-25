import { apiGet, apiPost } from "./api";
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { appendEvent, saveLatestSnapshot, loadLatestSnapshotPayload, rebuildStateFromEvents, VehicleRecord } from '@/utils/persistence';

export type VehicleType = 'heavy' | 'medium' | 'light';

export type Vehicle = {
  number: string;
  entryTime: Date;
  zoneId: string;
  ticketId: string;
  type: VehicleType;
  slot?: string;
};

export type ParkingZone = {
  id: string;
  name: string;
  capacity: number;
  occupied: number;
  vehicles: Vehicle[];
  limits: {
    heavy: number;
    medium: number;
    light: number;
  };
  stats: {
    heavy: number;
    medium: number;
    light: number;
  };
};

type ParkingContextType = {
  zones: ParkingZone[];
  // FIX 1: Added refreshData to type
  refreshData: () => Promise<void>; 
  // FIX 2: Corrected return type to Promise to match async implementation
  enterVehicle: (vehicleNumber: string, type?: VehicleType, zoneId?: string, slot?: string) => Promise<{ success: boolean; ticket?: any; message?: string }>;
  totalCapacity: number;
  totalOccupied: number;
  isAdmin: boolean;
  loginAdmin: (username?: string, password?: string) => boolean;
  registerAdmin: (username: string, password: string, name: string, policeId: string) => boolean;
  logoutAdmin: () => void;
  addZone: (zone: Omit<ParkingZone, 'id' | 'occupied' | 'vehicles' | 'stats'>) => void;
  updateZone: (id: string, data: Partial<Pick<ParkingZone, 'name' | 'capacity' | 'limits'>>) => void;
  deleteZone: (id: string) => void;
  restoreData: (records: any[]) => void;
};

const ParkingContext = createContext<ParkingContextType | undefined>(undefined);

const ZONES_COUNT = 20;
const ZONE_CAPACITY = 50;

const INITIAL_ZONES: ParkingZone[] = Array.from({ length: ZONES_COUNT }, (_, i) => {
  const heavyLimit = Math.floor(ZONE_CAPACITY * 0.2);
  const mediumLimit = Math.floor(ZONE_CAPACITY * 0.3);
  const lightLimit = ZONE_CAPACITY - heavyLimit - mediumLimit;

  return {
    id: `Z${i + 1}`,
    name: `Nilakkal Parking Zone ${i + 1}`,
    capacity: ZONE_CAPACITY,
    occupied: 0,
    vehicles: [],
    limits: { heavy: heavyLimit, medium: mediumLimit, light: lightLimit },
    stats: { heavy: 0, medium: 0, light: 0 }
  };
});

export function ParkingProvider({ children }: { children: React.ReactNode }) {
  const [zones, setZones] = useState<ParkingZone[]>([]);
  const zonesRef = useRef(zones);

  useEffect(() => {
    zonesRef.current = zones;
  }, [zones]);

  useEffect(() => {
    console.log("🔄 ZONES UPDATED FROM BACKEND", zones);
  }, [zones]);

  // FIX 3: Moved loadZones into a named function 'refreshData' so Report.tsx can use it
  const refreshData = async () => {
    try {
      const data = await apiGet<ParkingZone[]>("/api/zones");
      const normalized = data.map(z => ({
        ...z,
        vehicles: [], 
      }));
      setZones(normalized);
    } catch (err) {
      console.error("❌ Failed to load zones from backend", err);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const [isAdmin, setIsAdmin] = useState(false);
  const [admins, setAdmins] = useState([
    { username: "police@gmail.com", password: "575", name: "Sabarimala Traffic Control", policeId: "POL-KERALA-575" }
  ]);

  // Persistence logic (Kept exactly as per your original)
  useEffect(() => {
    const interval = setInterval(() => {
       const payload = makeSnapshotFromState(zonesRef.current);
       saveLatestSnapshot(payload).catch(e => console.error("Auto-save failed", e));
    }, 3 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleUnload = () => {
       const payload = makeSnapshotFromState(zonesRef.current);
       saveLatestSnapshot(payload);
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

  const makeSnapshotFromState = (currentZones: ParkingZone[]) => {
    const records: VehicleRecord[] = currentZones.flatMap(z => 
      z.vehicles.map(v => ({
        plate: v.number,
        zone: z.name,
        timeIn: v.entryTime.toISOString(),
        timeOut: null,
        type: v.type
      }))
    );
    return {
      meta: { app: "nilakkal-police", version: 1, createdAt: new Date().toISOString(), recordCount: records.length },
      data: records
    };
  };

  const loginAdmin = (username?: string, password?: string) => {
    const admin = admins.find(a => a.username === username && a.password === password);
    if (admin) {
      setIsAdmin(true);
      return true;
    }
    return false;
  };

  const registerAdmin = (username: string, password: string, name: string, policeId: string) => {
    if (admins.some(a => a.username === username)) {
      return false; 
    }
    setAdmins([...admins, { username, password, name, policeId }]);
    return true;
  };
  
  const logoutAdmin = () => setIsAdmin(false);

  const addZone = (zoneData: Omit<ParkingZone, 'id' | 'occupied' | 'vehicles' | 'stats'>) => {
    const newId = `Z${zones.length + 1}`;
    const newZone: ParkingZone = {
      id: newId,
      ...zoneData,
      occupied: 0,
      vehicles: [],
      stats: { heavy: 0, medium: 0, light: 0 }
    };
    setZones([...zones, newZone]);
  };

  const updateZone = (id: string, data: Partial<Pick<ParkingZone, 'name' | 'capacity' | 'limits'>>) => {
    setZones(zones.map(z => z.id === id ? { ...z, ...data } : z));
  };

  const deleteZone = (id: string) => {
    setZones(zones.filter(z => z.id !== id));
  };

  const enterVehicle = async (
    vehicleNumber: string,
    type: VehicleType = "light",
    zoneId?: string,
    slot?: string
  ) => {
    try {
      const res = await apiPost<{
        success: boolean;
        ticket: string;
      }>("/api/enter", {
        vehicle: vehicleNumber,
        type,
        zone: zoneId,
        slot,
      });

      if (!res.success) {
        return { success: false, message: "Entry failed" };
      }

      // Updated to use the named function
      await refreshData();

      return {
        success: true,
        ticket: {
          vehicleNumber,
          ticketId: res.ticket,
          time: new Date().toLocaleTimeString(),
          type,
          slot,
        },
      };
    } catch (err: any) {
      console.error("❌ ENTER VEHICLE FAILED", err);
      return { success: false, message: err.message };
    }
  };

  const totalCapacity = zones.reduce((acc, z) => acc + z.capacity, 0);
  const totalOccupied = zones.reduce((acc, z) => acc + z.occupied, 0);

  const restoreData = (records: any[]) => {
    const newZones: ParkingZone[] = INITIAL_ZONES.map(z => ({
      ...z,
      occupied: 0,
      vehicles: [],
      stats: { heavy: 0, medium: 0, light: 0 }
    }));

    records.forEach(rec => {
      if (rec.timeOut) return;
      const zoneName = rec.zone;
      let zone = newZones.find(z => z.name === zoneName) || newZones.find(z => z.id === rec.zone); 
      if (!zone && rec.zone) {
          zone = newZones.find(z => z.name.includes(rec.zone) || rec.zone.includes(z.id));
      }
      if (!zone) zone = newZones[0]; 

      const rawType = rec.type;
      const vehicleType: VehicleType = (rawType === 'heavy' || rawType === 'medium' || rawType === 'light') ? rawType : 'light';
      
      if (zone.occupied >= zone.capacity || zone.stats[vehicleType] >= zone.limits[vehicleType]) {
        const backupZone = newZones.find(z => z.occupied < z.capacity && z.stats[vehicleType] < z.limits[vehicleType]);
        if (backupZone) {
          zone = backupZone;
        } else {
          return;
        }
      }

      const vehicle: Vehicle = {
        number: rec.plate,
        entryTime: new Date(rec.timeIn),
        zoneId: zone.id,
        ticketId: `RES-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        type: vehicleType,
        slot: undefined
      };

      zone.vehicles.push(vehicle);
      zone.occupied++;
      zone.stats[vehicleType]++;
    });

    setZones(newZones);
  };

  return (
    <ParkingContext.Provider value={{ zones, refreshData, enterVehicle, totalCapacity, totalOccupied, isAdmin, loginAdmin, registerAdmin, logoutAdmin, addZone, updateZone, deleteZone, restoreData }}>
      {children}
    </ParkingContext.Provider>
  );
}

export function useParking() {
  const context = useContext(ParkingContext);
  if (!context) throw new Error("useParking must be used within ParkingProvider");
  return context;
}