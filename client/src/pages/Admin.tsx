import { useState, useEffect, useMemo, useCallback } from "react";
import { apiGet } from "@/lib/api";
import { useParking, ParkingZone } from "@/lib/parking-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Link } from "wouter";
import { 
  User, 
  Eye, 
  Bus, 
  Truck, 
  Car, 
  ChevronLeft, 
  ChevronRight, 
  Pause, 
  Play, 
  Plus, 
  Pencil, 
  Trash2, 
  FileText, 
  Download, 
  Database,
  RefreshCcw,
  AlertTriangle,
  Activity,
  ShieldCheck,
  Clock
} from "lucide-react";

/**
 * ADMIN DASHBOARD COMPONENT
 * Handles real-time monitoring, zone management, and slideshow rotation.
 * Theme: Monospace High-Contrast Dark (Control Room Style)
 */
export default function Admin() {
  const { addZone, updateZone, deleteZone } = useParking();
  
  // --- Core State ---
  const [zones, setZones] = useState<ParkingZone[]>([]);
  const [selectedZone, setSelectedZone] = useState<ParkingZone | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [zoneVehicles, setZoneVehicles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // --- Derived Calculations ---
  const totalCapacity = useMemo(() => zones.reduce((s, z) => s + z.capacity, 0), [zones]);
  const totalOccupied = useMemo(() => zones.reduce((s, z) => s + z.occupied, 0), [zones]);
  const occupancyPercentage = totalCapacity > 0 ? Math.round((totalOccupied / totalCapacity) * 100) : 0;
  const selectedVehicles = selectedZone?.vehicles ?? zoneVehicles ?? [];
  
  // --- Modal & Form State ---
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<ParkingZone | null>(null);
  const [formData, setFormData] = useState({ 
    name: "", 
    capacity: 50,
    limits: { heavy: 10, medium: 15, light: 25 }
  });
  
  // --- Slideshow & Pagination State ---
  const [pageIndex, setPageIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const ITEMS_PER_PAGE = 5;
  const totalPages = Math.ceil(zones.length / ITEMS_PER_PAGE) || 1;

  // --- Effects: Clock ---
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // --- Effects: API Polling ---
  const fetchZones = useCallback(() => {
    apiGet<ParkingZone[]>("/api/zones")
      .then((data) => {
        setZones(data);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Critical: Admin zone fetch failed", err);
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    let mounted = true;
    fetchZones();
    const interval = setInterval(() => {
      if (mounted) fetchZones();
    }, 5000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [fetchZones]);

  // --- Effects: Auto-Rotation ---
  useEffect(() => {
    if (isPaused || totalPages <= 1) return;
    
    const interval = setInterval(() => {
      setPageIndex((prev) => (prev + 1) % totalPages);
    }, 5000);

    return () => clearInterval(interval);
  }, [isPaused, totalPages]);

  // --- Effects: Fetch Specific Zone Manifest ---
  useEffect(() => {
    if (!selectedZone) {
      setZoneVehicles([]);
      return;
    }
    apiGet<any[]>(`/api/zones/${selectedZone.id}/vehicles`)
      .then(setZoneVehicles)
      .catch(() => setZoneVehicles([]));
  }, [selectedZone]);

  // --- Handlers: Navigation ---
  const handlePrev = () => {
    setPageIndex((prev) => (prev - 1 + totalPages) % totalPages);
    setIsPaused(true);
  };

  const handleNext = () => {
    setPageIndex((prev) => (prev + 1) % totalPages);
    setIsPaused(true);
  };

  const togglePause = () => setIsPaused(!isPaused);

  // --- Handlers: Zone Operations ---
  const handleEditClick = (zone: ParkingZone) => {
    setEditingZone(zone);
    setFormData({ 
      name: zone.name, 
      capacity: zone.capacity,
      limits: zone.limits || { 
        heavy: Math.floor(zone.capacity * 0.2), 
        medium: Math.floor(zone.capacity * 0.3), 
        light: zone.capacity - Math.floor(zone.capacity * 0.2) - Math.floor(zone.capacity * 0.3)
      }
    });
    setIsEditOpen(true);
    setIsPaused(true);
  };

  const handleDeleteClick = (id: string) => {
    if (window.confirm(`SECURITY ALERT: Are you sure you want to PERMANENTLY delete zone ${id}? This action cannot be undone.`)) {
      deleteZone(id);
    }
  };

  const handleSaveEdit = () => {
    if (editingZone) {
      updateZone(editingZone.id, formData);
      setIsEditOpen(false);
      setEditingZone(null);
    }
  };

  const handleCreate = () => {
    if (!formData.name.trim()) return alert("Zone name is required.");
    addZone(formData);
    setIsCreateOpen(false);
    setFormData({ 
      name: "", 
      capacity: 50,
      limits: { heavy: 10, medium: 15, light: 25 }
    });
  };

  const openCreateDialog = () => {
    setFormData({ 
      name: "ZONE_" + (zones.length + 1), 
      capacity: 50,
      limits: { heavy: 10, medium: 15, light: 25 }
    });
    setIsCreateOpen(true);
    setIsPaused(true);
  };

  const updateLimit = (type: 'heavy' | 'medium' | 'light', value: number) => {
    const val = Math.max(0, value);
    const newLimits = { ...formData.limits, [type]: val };
    const newCapacity = newLimits.heavy + newLimits.medium + newLimits.light;
    setFormData({ ...formData, limits: newLimits, capacity: newCapacity });
  };

  // --- Helper: Icons ---
  const getVehicleIcon = (type: string) => {
    switch(type.toLowerCase()) {
      case 'heavy': return <Bus className="w-4 h-4 text-blue-400" />;
      case 'medium': return <Truck className="w-4 h-4 text-yellow-400" />;
      default: return <Car className="w-4 h-4 text-green-400" />;
    }
  };

  const currentZones = useMemo(() => {
    return zones.slice(pageIndex * ITEMS_PER_PAGE, (pageIndex + 1) * ITEMS_PER_PAGE);
  }, [zones, pageIndex]);

  return (
    <div className="min-h-screen bg-black text-white font-mono p-4 flex flex-col text-sm selection:bg-white selection:text-black">
      
      {/* 1. TOP HEADER SECTION */}
      <header className="mb-6 border-b-2 border-white/30 pb-4 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-white/80 uppercase tracking-tighter text-[10px] mb-1">
            <ShieldCheck className="w-3 h-3 text-green-500" /> System Secure: Level 4 Auth
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tighter leading-none">
            NILAKKAL <span className="text-white/40">ADMIN</span> CORE
          </h1>
          <div className="flex items-center gap-4 text-xs font-bold">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {currentTime.toLocaleTimeString()}</span>
            <span className="text-white/40">|</span>
            <span className="flex items-center gap-1 uppercase tracking-widest">{currentTime.toLocaleDateString()}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <Link href="/report">
            <Button variant="outline" className="border-white/40 text-white hover:bg-white hover:text-black rounded-none gap-2 h-9 px-4 transition-all uppercase font-bold text-xs">
              <FileText className="w-4 h-4" /> View Logs
            </Button>
          </Link>
          <Link href="/backup">
            <Button variant="outline" className="border-white/40 text-white hover:bg-white hover:text-black rounded-none gap-2 h-9 px-4 transition-all uppercase font-bold text-xs">
              <Database className="w-4 h-4" /> Data Vault
            </Button>
          </Link>
          <Button 
            onClick={openCreateDialog} 
            className="bg-white text-black hover:bg-white/80 rounded-none gap-2 h-9 px-4 transition-all uppercase font-black text-xs"
          >
            <Plus className="w-4 h-4" /> New Terminal
          </Button>
          
          <div className="hidden lg:block border-l border-white/20 pl-4 ml-2">
             <div className="text-[9px] uppercase tracking-[0.2em] text-white/50 mb-0.5">Global Nodes</div>
             <div className="text-xl font-bold tracking-tighter">{zones.length} / 24</div>
          </div>
        </div>
      </header>

      {/* 2. STATISTICAL OVERVIEW CARDS */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="border border-white/40 p-4 relative overflow-hidden group">
          <Activity className="absolute -right-2 -top-2 w-16 h-16 text-white/5 group-hover:scale-110 transition-transform" />
          <div className="text-[10px] uppercase tracking-widest mb-2 text-white/60">Global Occupancy</div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black tracking-tighter">{totalOccupied}</span>
            <span className="text-lg text-white/40 font-bold">/ {totalCapacity}</span>
          </div>
          <div className="mt-2 w-full bg-white/10 h-1">
             <div className="bg-white h-full transition-all duration-1000" style={{ width: `${occupancyPercentage}%` }} />
          </div>
        </div>

        <div className="border border-white/40 p-4 relative overflow-hidden group bg-white/5">
          <RefreshCcw className="absolute -right-2 -top-2 w-16 h-16 text-white/5 group-hover:rotate-90 transition-transform" />
          <div className="text-[10px] uppercase tracking-widest mb-2 text-white/60">System Load</div>
          <div className="text-4xl font-black tracking-tighter">{occupancyPercentage}%</div>
          <div className="mt-2 text-[10px] font-bold uppercase text-white/40">Real-time calculate: active</div>
        </div>

        <div className="border border-white/40 p-4 relative overflow-hidden group">
          <div className="absolute -right-2 -top-2 text-green-500/20"><ShieldCheck className="w-16 h-16" /></div>
          <div className="text-[10px] uppercase tracking-widest mb-2 text-white/60">Available Vacancy</div>
          <div className="text-4xl font-black tracking-tighter text-green-500">
            {totalCapacity - totalOccupied}
          </div>
          <div className="mt-2 text-[10px] font-bold uppercase text-green-500/60 flex items-center gap-1">
             <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Nodes operational
          </div>
        </div>
      </section>

      {/* 3. MAIN DATA TABLE AREA */}
      <div className="flex-grow flex flex-col border border-white/40 relative shadow-2xl bg-black">
        <div className="overflow-x-auto flex-grow">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b-2 border-white bg-white/10 sticky top-0 z-10 backdrop-blur-md">
                <th className="p-4 uppercase tracking-wider border-r border-white/20 font-black text-[11px]">Node Identifier</th>
                <th className="p-4 uppercase tracking-wider border-r border-white/20 font-black text-right text-[11px]">Occupied</th>
                <th className="p-4 uppercase tracking-wider border-r border-white/20 font-black text-right text-[11px]">Max Capacity</th>
                <th className="p-4 uppercase tracking-wider border-r border-white/20 font-black text-right text-[11px]">Free Slots</th>
                <th className="p-4 uppercase tracking-wider font-black text-center text-[11px]">Operations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="p-20 text-center animate-pulse tracking-[0.5em] text-white/40">INITIALIZING_DATA_STREAM...</td>
                </tr>
              ) : currentZones.map((zone) => {
                const vacant = zone.capacity - zone.occupied;
                const isNearingCapacity = (zone.occupied / zone.capacity) > 0.85;
                
                return (
                  <tr key={zone.id} className="group hover:bg-white/5 transition-colors h-16">
                    <td className="p-4 border-r border-white/10">
                       <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${vacant === 0 ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' : 'bg-green-500'}`} />
                          <div className="flex flex-col">
                            <span className="font-black text-lg tracking-tighter uppercase leading-none">{zone.name}</span>
                            <span className="text-[10px] text-white/40 font-mono">ID: {zone.id.slice(0,8)}...</span>
                          </div>
                       </div>
                    </td>
                    <td className="p-4 border-r border-white/10 text-right font-mono text-xl font-black">
                      {zone.occupied}
                    </td>
                    <td className="p-4 border-r border-white/10 text-right font-mono text-lg text-white/40">
                      {zone.capacity}
                    </td>
                    <td className={`p-4 border-r border-white/10 text-right font-mono text-xl font-black ${vacant === 0 ? 'text-red-500' : 'text-green-500'}`}>
                      {vacant}
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center gap-2 opacity-100 lg:opacity-30 group-hover:opacity-100 transition-opacity">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setSelectedZone(zone)}
                          className="h-9 w-9 p-0 text-white hover:text-black hover:bg-white rounded-none border border-white/40"
                          title="Detailed Manifest"
                        >
                          <Eye className="w-5 h-5" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleEditClick(zone)}
                          className="h-9 w-9 p-0 text-white hover:text-black hover:bg-white rounded-none border border-white/40"
                          title="Configure Parameters"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleDeleteClick(zone.id)}
                          className="h-9 w-9 p-0 text-red-500 hover:text-white hover:bg-red-600 rounded-none border border-red-500/50"
                          title="Decommission Node"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {/* Padding empty slots for visual consistency */}
              {Array.from({ length: Math.max(0, ITEMS_PER_PAGE - currentZones.length) }).map((_, i) => (
                 <tr key={`empty-${i}`} className="border-b border-white/5 h-16 opacity-20 pointer-events-none">
                   <td colSpan={5} className="p-4 text-center text-white/20 uppercase tracking-[1em] text-[9px]">NO_DATA_ENTRY</td>
                 </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 4. SLIDESHOW / PAGINATION FOOTER */}
        <footer className="border-t-2 border-white p-3 flex flex-col sm:flex-row justify-between items-center bg-black gap-4">
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handlePrev}
              disabled={totalPages <= 1}
              className="rounded-none border-white/60 text-white hover:bg-white hover:text-black h-9 px-4 text-xs font-black uppercase"
            >
              <ChevronLeft className="mr-1 h-4 w-4" /> Prev_Node
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={togglePause}
              className={`rounded-none border-white text-white hover:bg-white hover:text-black w-32 h-9 text-xs font-black uppercase ${isPaused ? 'border-red-500 text-red-500' : ''}`}
            >
              {isPaused ? <Play className="mr-2 h-4 w-4" /> : <Pause className="mr-2 h-4 w-4" />}
              {isPaused ? "RESUME_AUTO" : "PAUSE_AUTO"}
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleNext}
              disabled={totalPages <= 1}
              className="rounded-none border-white/60 text-white hover:bg-white hover:text-black h-9 px-4 text-xs font-black uppercase"
            >
              Next_Node <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex items-center gap-4">
              <div className="flex flex-col items-end">
                 <span className="text-[10px] uppercase font-bold text-white/40 tracking-widest">Rotation Status</span>
                 <div className="flex items-center gap-2">
                    {isPaused && <span className="text-[9px] bg-red-600 text-white px-2 py-0.5 font-black uppercase animate-pulse">Manual_Override</span>}
                    <span className="text-xs font-black uppercase tracking-tighter bg-white text-black px-3 py-1">
                      Terminal {pageIndex + 1} of {totalPages}
                    </span>
                 </div>
              </div>
              <div className="hidden md:block text-[9px] uppercase tracking-widest text-white/30 border-l border-white/20 pl-4 max-w-[120px]">
                Global polling rate: 5000ms. Displaying subset: {ITEMS_PER_PAGE} units.
              </div>
          </div>
        </footer>
      </div>

      {/* 5. MODAL: VEHICLE MANIFEST (EYE ICON) */}
      <Dialog open={!!selectedZone} onOpenChange={(open) => !open && setSelectedZone(null)}>
        <DialogContent className="bg-black border-2 border-white text-white max-w-3xl max-h-[85vh] overflow-hidden flex flex-col rounded-none p-0">
          <div className="bg-white text-black p-4 flex justify-between items-center">
             <DialogTitle className="text-xl font-black uppercase tracking-tighter">
               Manifest: {selectedZone?.name}
             </DialogTitle>
             <div className="text-[10px] font-bold border border-black px-2 py-1 uppercase">
               Node_Loc: {selectedZone?.id.slice(0,12)}
             </div>
          </div>
          
          <div className="p-6 overflow-y-auto flex-grow">
             {selectedVehicles.length === 0 ? (
                <div className="text-center py-20 border-2 border-dashed border-white/20 flex flex-col items-center gap-4">
                  <AlertTriangle className="w-12 h-12 text-white/20" />
                  <div className="text-white/40 uppercase tracking-[0.3em] font-bold">No active vehicle links found</div>
                </div>
             ) : (
                <div className="border border-white/40">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-white bg-white/5">
                        <th className="p-3 uppercase text-[10px] font-black tracking-[0.2em]">Class</th>
                        <th className="p-3 uppercase text-[10px] font-black tracking-[0.2em]">Registration</th>
                        <th className="p-3 uppercase text-[10px] font-black tracking-[0.2em]">Link_ID</th>
                        <th className="p-3 uppercase text-[10px] font-black tracking-[0.2em] text-right">Entry_Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono divide-y divide-white/10">
                      {selectedVehicles.map((v, i) => (
                        <tr key={i} className="hover:bg-white/5 transition-colors">
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                               {getVehicleIcon(v.type)}
                               <span className="uppercase text-xs font-bold">{v.type}</span>
                            </div>
                          </td>
                          <td className="p-3 font-black text-sm tracking-tight">{v.number}</td>
                          <td className="p-3 text-[10px] text-white/50">{v.ticketId}</td>
                          <td className="p-3 text-xs text-right text-white/70">
                             {new Date(v.entryTime).toLocaleTimeString([], {hour12: false, hour: '2-digit', minute:'2-digit', second: '2-digit'})}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
             )}
          </div>
          <div className="p-4 border-t border-white/20 flex justify-end">
             <Button onClick={() => setSelectedZone(null)} className="rounded-none border-2 border-white bg-white text-black font-black uppercase text-xs h-10 px-8 hover:invert">
               Acknowledge
             </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 6. MODAL: CREATE / EDIT ZONE */}
      <Dialog 
        open={isEditOpen || isCreateOpen} 
        onOpenChange={(open) => {
          if (!open) {
            setIsEditOpen(false);
            setIsCreateOpen(false);
          }
        }}
      >
        <DialogContent className="bg-black border-2 border-white text-white rounded-none p-0 max-w-md">
          <div className="bg-white text-black p-4">
            <DialogTitle className="uppercase font-black tracking-tighter text-xl">
              {isEditOpen ? "Configuration: Modify Node" : "Terminal: Initialize Node"}
            </DialogTitle>
            <DialogDescription className="text-black/60 text-[10px] font-bold uppercase tracking-widest">
              Set resource parameters and hardware limits
            </DialogDescription>
          </div>

          <div className="p-6 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="node-name" className="text-[10px] uppercase font-black text-white/60 tracking-[0.2em]">Node Designation</Label>
              <Input 
                id="node-name" 
                value={formData.name} 
                placeholder="e.g., SECTOR_ALPHA"
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="bg-black border-white/40 text-white rounded-none font-black uppercase tracking-widest focus:border-white h-11" 
              />
            </div>
            
            <div className="space-y-4">
              <Label className="text-[10px] uppercase font-black text-white/60 tracking-[0.2em] block pb-2 border-b border-white/10">Vehicle Class Allocation</Label>
              
              <div className="grid grid-cols-1 gap-4">
                {[
                  { id: 'heavy', label: 'Heavy Class (Bus/Coach)', icon: <Bus className="w-4 h-4" /> },
                  { id: 'medium', label: 'Medium Class (Truck/HCV)', icon: <Truck className="w-4 h-4" /> },
                  { id: 'light', label: 'Light Class (Car/LUV)', icon: <Car className="w-4 h-4" /> }
                ].map((vehicleClass) => (
                  <div key={vehicleClass.id} className="flex items-center justify-between gap-4 bg-white/5 p-2 border border-white/10">
                    <div className="flex items-center gap-3">
                      <div className="p-2 border border-white/20 text-white/60">{vehicleClass.icon}</div>
                      <span className="text-xs font-bold uppercase tracking-tight">{vehicleClass.label}</span>
                    </div>
                    <Input 
                      type="number"
                      value={formData.limits[vehicleClass.id as keyof typeof formData.limits]} 
                      onChange={(e) => updateLimit(vehicleClass.id as any, parseInt(e.target.value) || 0)}
                      className="w-20 bg-black border-white/40 text-right font-black rounded-none h-9 text-lg" 
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t-2 border-white/20 flex justify-between items-end">
              <div>
                <div className="text-[10px] uppercase font-black text-white/40">Total Capacity Computed</div>
                <div className="text-3xl font-black tracking-tighter text-white underline decoration-white/20 underline-offset-4">
                  {formData.capacity} UNITS
                </div>
              </div>
              <div className="text-[9px] text-white/30 uppercase font-mono max-w-[100px] text-right">
                Node efficiency at 100% capacity
              </div>
            </div>
          </div>

          <DialogFooter className="p-4 bg-white/5 border-t border-white/20 flex sm:justify-between gap-2">
            <Button 
              variant="outline" 
              onClick={() => { setIsEditOpen(false); setIsCreateOpen(false); }} 
              className="border-white/40 text-white hover:bg-white/10 rounded-none uppercase font-black text-xs"
            >
              Abort_Task
            </Button>
            <Button 
              onClick={isEditOpen ? handleSaveEdit : handleCreate} 
              className="bg-white text-black hover:bg-white/80 rounded-none uppercase font-black text-xs px-8"
            >
              {isEditOpen ? "Commit_Changes" : "Initialize_Node"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}