import { apiGet, apiPost, apiPut, apiDelete } from "./api";
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { saveLatestSnapshot, VehicleRecord } from '@/utils/persistence';

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
  refreshData: () => Promise<void>; 
  enterVehicle: (vehicleNumber: string, type?: VehicleType, zoneId?: string, slot?: string) => Promise<{ success: boolean; ticket?: any; message?: string }>;
  totalCapacity: number;
  totalOccupied: number;
  isAdmin: boolean;
  loginAdmin: (username?: string, password?: string) => boolean;
  registerAdmin: (username: string, password: string, name: string, policeId: string) => boolean;
  logoutAdmin: () => void;
  addZone: (zone: Omit<ParkingZone, 'id' | 'occupied' | 'vehicles' | 'stats'>) => Promise<void>;
  updateZone: (
  id: string,
  data: {
    name: string;
    limits: {
      heavy: number;
      medium: number;
      light: number;
    };
  }
) => Promise<void>;
  deleteZone: (id: string) => Promise<void>;
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

  const refreshData = async () => {
    try {
      const data = await apiGet<ParkingZone[]>("/api/zones");
      const normalized = data.map(z => ({
        ...z,
        vehicles: [], 
        stats: z.stats || { heavy: 0, medium: 0, light: 0 }
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

  // Persistence logic
  useEffect(() => {
    const interval = setInterval(() => {
       const payload = makeSnapshotFromState(zonesRef.current);
       saveLatestSnapshot(payload).catch(e => console.error("Auto-save failed", e));
    }, 3 * 60 * 1000); 
    return () => clearInterval(interval);
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
    if (admins.some(a => a.username === username)) return false; 
    setAdmins([...admins, { username, password, name, policeId }]);
    return true;
  };
  
  const logoutAdmin = () => setIsAdmin(false);

  // --- RECTIFIED ADMIN ACTIONS WITH API SYNC ---

  const addZone = async (zoneData: Omit<ParkingZone, 'id' | 'occupied' | 'vehicles' | 'stats'>) => {
    try {
      // 1. Sync with backend
      await apiPost("/api/zones", zoneData);
      // 2. Refresh state from source of truth
      await refreshData();
      console.log("✅ New parking terminal registered on server");
    } catch (err) {
      console.error("❌ Failed to add zone", err);
      throw err;
    }
  };

  const updateZone = async (
  id: string,
  data: {
    name: string;
    limits: {
      heavy: number;
      medium: number;
      light: number;
    };
  }
) => {
  try {
    await apiPut(`/api/zones/${id}`, {
      name: data.name,
      limits: data.limits
    });
    await refreshData();
  } catch (err) {
    console.error("❌ Failed to update zone", err);
    throw err;
  }
};


  const deleteZone = async (id: string) => {
  try {
    await apiDelete(`/api/zones/${id}`);   // ✅ DELETE
    await refreshData();
  } catch (err) {
    console.error("❌ Failed to delete zone", err);
    throw err;
  }
};


  // --- END OF RECTIFIED ACTIONS ---

  const enterVehicle = async (vehicleNumber: string, type: VehicleType = "light", zoneId?: string, slot?: string) => {
    try {
      const res = await apiPost<{ success: boolean; ticket: string; }>("/api/enter", {
        vehicle: vehicleNumber,
        type,
        zone: zoneId,
        slot,
      });

      if (!res.success) return { success: false, message: "Entry failed" };

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
      let zone = newZones.find(z => z.name === rec.zone || z.id === rec.zone); 
      if (!zone) zone = newZones[0]; 

      const vehicleType: VehicleType = ['heavy', 'medium', 'light'].includes(rec.type) ? rec.type : 'light';
      
      if (zone.occupied < zone.capacity && zone.stats[vehicleType] < zone.limits[vehicleType]) {
        zone.vehicles.push({
          number: rec.plate,
          entryTime: new Date(rec.timeIn),
          zoneId: zone.id,
          ticketId: `RES-${Date.now()}`,
          type: vehicleType
        });
        zone.occupied++;
        zone.stats[vehicleType]++; 
      }
    });

    setZones(newZones);
  };

  return (
    <ParkingContext.Provider value={{ 
      zones, refreshData, enterVehicle, totalCapacity, totalOccupied, 
      isAdmin, loginAdmin, registerAdmin, logoutAdmin, 
      addZone, updateZone, deleteZone, restoreData 
    }}>
      {children}
    </ParkingContext.Provider>
  );
}

export function useParking() {
  const context = useContext(ParkingContext);
  if (!context) throw new Error("useParking must be used within ParkingProvider");
  return context;
}