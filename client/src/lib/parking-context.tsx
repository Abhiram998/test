import { apiGet } from "./api";
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
  enterVehicle: (vehicleNumber: string, type?: VehicleType, zoneId?: string, slot?: string) => { success: boolean; ticket?: any; message?: string };
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
  // Distribute capacity roughly
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
  const [zones, setZones] = useState<ParkingZone[]>(INITIAL_ZONES);
  const zonesRef = useRef(zones); // Ref to access latest zones in intervals/handlers

  useEffect(() => {
    zonesRef.current = zones;
  }, [zones]);

  const [isAdmin, setIsAdmin] = useState(false);
  const [admins, setAdmins] = useState([
    { username: "police@gmail.com", password: "575", name: "Sabarimala Traffic Control", policeId: "POL-KERALA-575" }
  ]);

  // Persistence: Auto-restore on mount - DISABLED to clear dummy data
  /*
  useEffect(() => {
    const initPersistence = async () => {
      try {
        const snapshot = await loadLatestSnapshotPayload();
        
        if (snapshot && Array.isArray(snapshot.data)) {
          // Validate structure
          const isValid = snapshot.data.every(item => item.plate && item.zone && item.timeIn);
          if (isValid) {
            console.log("Persistence: Auto-restoring latest snapshot", snapshot.meta);
            // Save pre-restore backup for safety
            await saveLatestSnapshot(makeSnapshotFromState(zonesRef.current));
            restoreData(snapshot.data);
            return;
          }
        }

        // Fallback to event log rebuild if no valid snapshot
        console.log("Persistence: Rebuilding from event log...");
        const rebuiltData = await rebuildStateFromEvents();
        if (rebuiltData.length > 0) {
           restoreData(rebuiltData);
        }
      } catch (err) {
        console.error("Persistence error:", err);
      }
    };
    initPersistence();
  }, []);
  */

  // Persistence: Periodic snapshots (every 3 mins)
  useEffect(() => {
    const interval = setInterval(() => {
       const payload = makeSnapshotFromState(zonesRef.current);
       saveLatestSnapshot(payload).catch(e => console.error("Auto-save failed", e));
    }, 3 * 60 * 1000); // 3 minutes

    return () => clearInterval(interval);
  }, []);

  // Persistence: Save on unload
  useEffect(() => {
    const handleUnload = () => {
       // Best effort synchronous save attempt (though async in logic, we fire and forget)
       // Navigator.sendBeacon is better for this but for indexedDB we just start the promise
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
      return false; // Already exists
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

  // Simulate live updates - DISABLED
  /*
  useEffect(() => {
    const interval = setInterval(() => {
      setZones(current => current.map(z => {
        // Randomly add or remove a vehicle occasionally
        if (Math.random() > 0.8) {
          const isAdding = Math.random() > 0.5;
          
          if (isAdding && z.occupied < z.capacity) {
            const typeRand = Math.random();
            const type: VehicleType = typeRand > 0.8 ? 'heavy' : typeRand > 0.5 ? 'medium' : 'light';
            
            // Check type limit
            if (z.stats[type] >= z.limits[type]) {
              return z; // Cannot add this type
            }

            const newVehicle: Vehicle = {
              number: `KL-${Math.floor(Math.random()*99)}-NEW-${Math.floor(1000+Math.random()*9000)}`,
              entryTime: new Date(),
              zoneId: z.id,
              ticketId: `TKT-${Date.now()}`,
              type
            };
            return {
              ...z,
              occupied: z.occupied + 1,
              vehicles: [newVehicle, ...z.vehicles],
              stats: {
                ...z.stats,
                [type]: z.stats[type] + 1
              }
            };
          } else if (!isAdding && z.occupied > 0) {
            const removedVehicle = z.vehicles[z.vehicles.length - 1]; // Remove oldest for simplicity in mock
            if (!removedVehicle) return z;
            
            return {
              ...z,
              occupied: z.occupied - 1,
              vehicles: z.vehicles.slice(0, -1),
              stats: {
                ...z.stats,
                [removedVehicle.type]: Math.max(0, z.stats[removedVehicle.type] - 1)
              }
            };
          }
        }
        return z;
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, []);
  */

  const enterVehicle = (vehicleNumber: string, type: VehicleType = 'light', zoneId?: string, slot?: string) => {
    let targetZoneIndex = -1;

    if (zoneId) {
      targetZoneIndex = zones.findIndex(z => z.id === zoneId);
      if (targetZoneIndex !== -1) {
        const zone = zones[targetZoneIndex];
        if (zone.occupied >= zone.capacity) {
          return { success: false, message: `Zone ${zone.name} is full!` };
        }
        if (zone.stats[type] >= zone.limits[type]) {
           return { success: false, message: `Zone ${zone.name} is full for ${type} vehicles!` };
        }
      }
    } else {
      // Find first available zone that has capacity AND type capacity
      targetZoneIndex = zones.findIndex(z => z.occupied < z.capacity && z.stats[type] < z.limits[type]);
    }
    
    if (targetZoneIndex === -1) {
      return { success: false, message: zoneId ? "Zone not found or full!" : `All parking zones are full for ${type} vehicles!` };
    }

    const zone = zones[targetZoneIndex];
    const ticketId = `TKT-${Date.now()}-${Math.floor(Math.random()*1000)}`;
    const newVehicle: Vehicle = {
      number: vehicleNumber,
      entryTime: new Date(),
      zoneId: zone.id,
      ticketId,
      type,
      slot
    };

    const updatedZones = [...zones];
    updatedZones[targetZoneIndex] = {
      ...zone,
      occupied: zone.occupied + 1,
      vehicles: [newVehicle, ...zone.vehicles],
      stats: {
        ...zone.stats,
        [type]: zone.stats[type] + 1
      }
    };

    setZones(updatedZones);

    // Persistence: Append event
    appendEvent({
      plate: vehicleNumber,
      zone: zone.name,
      timeIn: new Date().toISOString(),
      timeOut: null,
      type
    }).catch(e => console.error("Failed to persist event", e));

    return { 
      success: true, 
      ticket: {
        vehicleNumber,
        zoneName: zone.name,
        ticketId,
        time: new Date().toLocaleTimeString(),
        type,
        slot
      }
    };
  };

  const totalCapacity = zones.reduce((acc, z) => acc + z.capacity, 0);
  const totalOccupied = zones.reduce((acc, z) => acc + z.occupied, 0);

  const restoreData = (records: any[]) => {
    // Basic restore logic: Clear current vehicles and repopulate from records
    // In a real app with zones, we'd need to map zones correctly.
    // For this mockup, we'll try to map back to existing zones or default to Z1
    
    // Reset zones
    const newZones: ParkingZone[] = INITIAL_ZONES.map(z => ({
      ...z,
      occupied: 0,
      vehicles: [],
      stats: { heavy: 0, medium: 0, light: 0 }
    }));

    records.forEach(rec => {
      // Skip if vehicle has checked out
      if (rec.timeOut) return;

      // Find zone
      const zoneName = rec.zone;
      let zone = newZones.find(z => z.name === zoneName) || newZones.find(z => z.id === rec.zone); // Try name or ID match
      
      if (!zone && rec.zone) {
         // Try lenient match
         zone = newZones.find(z => z.name.includes(rec.zone) || rec.zone.includes(z.id));
      }
      
      if (!zone) zone = newZones[0]; // Fallback

      // Enforce capacity limit
      const rawType = rec.type;
      const vehicleType: VehicleType = (rawType === 'heavy' || rawType === 'medium' || rawType === 'light') ? rawType : 'light';
      
      if (zone.occupied >= zone.capacity || zone.stats[vehicleType] >= zone.limits[vehicleType]) {
        // Try to find another zone with space for this type
        const backupZone = newZones.find(z => z.occupied < z.capacity && z.stats[vehicleType] < z.limits[vehicleType]);
        if (backupZone) {
          zone = backupZone;
        } else {
          console.warn(`Cannot restore vehicle ${rec.plate}: All zones full for type ${vehicleType}.`);
          return;
        }
      }

      // Reconstruct vehicle
      const vehicle: Vehicle = {
        number: rec.plate,
        entryTime: new Date(rec.timeIn),
        zoneId: zone.id,
        ticketId: `RES-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        type: vehicleType,
        slot: undefined
      };

      // Add to zone
      zone.vehicles.push(vehicle);
      zone.occupied++;
      zone.stats[vehicleType]++; // Correct stats increment
    });

    setZones(newZones);
  };

  return (
    <ParkingContext.Provider value={{ zones, enterVehicle, totalCapacity, totalOccupied, isAdmin, loginAdmin, registerAdmin, logoutAdmin, addZone, updateZone, deleteZone, restoreData }}>
      {children}
    </ParkingContext.Provider>
  );
}

export function useParking() {
  const context = useContext(ParkingContext);
  if (!context) throw new Error("useParking must be used within ParkingProvider");
  return context;
}