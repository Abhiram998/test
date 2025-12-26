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
  Clock,
  Terminal,
  Cpu,
  Server,
  Network
} from "lucide-react";

/**
 * NILAKKAL ADMIN CORE - SYSTEM v4.0.2
 * * DESCRIPTION:
 * High-performance administrative interface for real-time parking logistics.
 * Implements a "Control Room" aesthetic using high-contrast black/white palette.
 * * FEATURES:
 * - Real-time polling (5000ms heartbeat)
 * - Automated Node Rotation (Slideshow mode)
 * - Vehicle Class Allocation (Heavy/Medium/Light)
 * - Dynamic Manifest Inspection
 * * @author System Architect
 * @component Admin
 */
export default function Admin() {
  // --- Context Hooks ---
  const { addZone, updateZone, deleteZone } = useParking();
  
  // --- Core Node State ---
  const [zones, setZones] = useState<ParkingZone[]>([]);
  const [selectedZone, setSelectedZone] = useState<ParkingZone | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [zoneVehicles, setZoneVehicles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [systemAlerts, setSystemAlerts] = useState<string[]>([]);
  
  // --- Derived Calculations (Memoized for Performance) ---
  const totalCapacity = useMemo(() => {
    return zones.reduce((sum, zone) => sum + (zone.capacity || 0), 0);
  }, [zones]);

  const totalOccupied = useMemo(() => {
    return zones.reduce((sum, zone) => sum + (zone.occupied || 0), 0);
  }, [zones]);

  const occupancyPercentage = useMemo(() => {
    if (totalCapacity === 0) return 0;
    return Math.round((totalOccupied / totalCapacity) * 100);
  }, [totalOccupied, totalCapacity]);

  const selectedVehicles = useMemo(() => {
    return selectedZone?.vehicles ?? zoneVehicles ?? [];
  }, [selectedZone, zoneVehicles]);
  
  // --- Modal & Operation State ---
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<ParkingZone | null>(null);
  const [formData, setFormData] = useState({ 
    name: "", 
    capacity: 50,
    limits: { heavy: 10, medium: 15, light: 25 }
  });
  
  // --- Slideshow & Data Pagination Control ---
  const [pageIndex, setPageIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const ITEMS_PER_PAGE = 5;
  const totalPages = Math.ceil(zones.length / ITEMS_PER_PAGE) || 1;

  // --- Clock Heartbeat Effect ---
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // --- API Stream Synchronization ---
  const fetchZones = useCallback(async () => {
    try {
      const data = await apiGet<ParkingZone[]>("/api/zones");
      if (Array.isArray(data)) {
        setZones(data);
      }
      setIsLoading(false);
    } catch (err) {
      console.error("CRITICAL_SYSTEM_ERROR: Admin zone fetch failure", err);
      setIsLoading(false);
      setSystemAlerts(prev => [...prev, `FETCH_ERROR_${Date.now()}`]);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    
    // Initial fetch
    fetchZones();
    
    // Establishing 5s Polling Interval
    const interval = setInterval(() => {
      if (isMounted) fetchZones();
    }, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [fetchZones]);

  // --- Auto-Rotation Logic (Slideshow) ---
  useEffect(() => {
    if (isPaused || totalPages <= 1 || isEditOpen || isCreateOpen) return;
    
    const rotationTimer = setInterval(() => {
      setPageIndex((prev) => (prev + 1) % totalPages);
    }, 5000);

    return () => clearInterval(rotationTimer);
  }, [isPaused, totalPages, isEditOpen, isCreateOpen]);

  // --- Manifest Retrieval Effect ---
  useEffect(() => {
    if (!selectedZone) {
      setZoneVehicles([]);
      return;
    }

    const fetchManifest = async () => {
      try {
        const manifest = await apiGet<any[]>(`/api/zones/${selectedZone.id}/vehicles`);
        setZoneVehicles(manifest);
      } catch (err) {
        console.error("MANIFEST_FETCH_ERROR", err);
        setZoneVehicles([]);
      }
    };

    fetchManifest();
  }, [selectedZone]);

  // --- UI Control Handlers ---
  const handlePrev = () => {
    setPageIndex((prev) => (prev - 1 + totalPages) % totalPages);
    setIsPaused(true); // Pause auto-rotation on manual intervention
  };

  const handleNext = () => {
    setPageIndex((prev) => (prev + 1) % totalPages);
    setIsPaused(true); // Pause auto-rotation on manual intervention
  };

  const togglePause = () => setIsPaused(!isPaused);

  // --- CRUD Operational Handlers ---
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
    const confirmationMsg = `SECURITY WARNING: Permanent decommissioning of node [${id}]. 
This will erase all historical allocation data for this terminal. 
Proceed with deletion?`;
    
    if (window.confirm(confirmationMsg)) {
      deleteZone(id);
    }
  };

  const handleSaveEdit = async () => {
    if (editingZone) {
      try {
        await updateZone(editingZone.id, formData);
        setIsEditOpen(false);
        setEditingZone(null);
      } catch (err) {
        alert("COMMIT_FAILED: Error updating node configuration.");
      }
    }
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      alert("VALIDATION_ERROR: Node designation required.");
      return;
    }
    
    try {
      await addZone(formData);
      setIsCreateOpen(false);
      setFormData({ 
        name: "", 
        capacity: 50,
        limits: { heavy: 10, medium: 15, light: 25 }
      });
    } catch (err) {
      alert("INITIALIZATION_FAILED: Error creating new node.");
    }
  };

  const openCreateDialog = () => {
    setFormData({ 
      name: `TERM_${(zones.length + 1).toString().padStart(3, '0')}`, 
      capacity: 50,
      limits: { heavy: 10, medium: 15, light: 25 }
    });
    setIsCreateOpen(true);
    setIsPaused(true);
  };

  const updateLimit = (type: 'heavy' | 'medium' | 'light', value: number) => {
    const numericValue = Math.max(0, value);
    const updatedLimits = { ...formData.limits, [type]: numericValue };
    const calculatedCapacity = updatedLimits.heavy + updatedLimits.medium + updatedLimits.light;
    
    setFormData({ 
      ...formData, 
      limits: updatedLimits, 
      capacity: calculatedCapacity 
    });
  };

  // --- View Helpers ---
  const getVehicleIcon = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('heavy') || t === 'bus') return <Bus className="w-4 h-4 text-blue-400" />;
    if (t.includes('medium') || t === 'truck') return <Truck className="w-4 h-4 text-yellow-400" />;
    return <Car className="w-4 h-4 text-green-400" />;
  };

  const currentZonesSlice = useMemo(() => {
    const start = pageIndex * ITEMS_PER_PAGE;
    return zones.slice(start, start + ITEMS_PER_PAGE);
  }, [zones, pageIndex]);

  return (
    <div className="min-h-screen bg-black text-white font-mono p-4 flex flex-col text-sm selection:bg-white selection:text-black">
      
      {/* 1. TOP HEADER SECTION */}
      <header className="mb-6 border-b-2 border-white/30 pb-4 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-white/80 uppercase tracking-tighter text-[10px] mb-1">
            <ShieldCheck className="w-3 h-3 text-green-500" /> System Secure: Level 4 Admin Access
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tighter leading-none">
            NILAKKAL <span className="text-white/40">ADMIN</span> CORE
          </h1>
          <div className="flex items-center gap-4 text-xs font-bold">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" /> {currentTime.toLocaleTimeString()}
            </span>
            <span className="text-white/40">|</span>
            <span className="flex items-center gap-1 uppercase tracking-widest">
              {currentTime.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <Link href="/report">
            <Button variant="outline" className="border-white/40 text-white hover:bg-white hover:text-black rounded-none gap-2 h-9 px-4 transition-all uppercase font-bold text-xs">
              <FileText className="w-4 h-4" /> System Logs
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
             <div className="text-[9px] uppercase tracking-[0.2em] text-white/50 mb-0.5">Active Nodes</div>
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
          <div className="mt-2 text-[10px] font-bold uppercase text-white/40 flex items-center gap-1">
            <Cpu className="w-3 h-3" /> Real-time compute: ACTIVE
          </div>
        </div>

        <div className="border border-white/40 p-4 relative overflow-hidden group">
          <div className="absolute -right-2 -top-2 text-green-500/20"><ShieldCheck className="w-16 h-16" /></div>
          <div className="text-[10px] uppercase tracking-widest mb-2 text-white/60">Available Vacancy</div>
          <div className="text-4xl font-black tracking-tighter text-green-500">
            {totalCapacity - totalOccupied}
          </div>
          <div className="mt-2 text-[10px] font-bold uppercase text-green-500/60 flex items-center gap-1">
             <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> All Nodes Operational
          </div>
        </div>
      </section>

      {/* 3. MAIN DATA TABLE AREA */}
      <div className="flex-grow flex flex-col border border-white/40 relative shadow-2xl bg-black overflow-hidden">
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
                  <td colSpan={5} className="p-20 text-center animate-pulse tracking-[0.5em] text-white/40">
                    <div className="flex flex-col items-center gap-2">
                       <Terminal className="w-8 h-8 mb-2" />
                       INITIALIZING_DATA_STREAM...
                    </div>
                  </td>
                </tr>
              ) : currentZonesSlice.map((zone) => {
                const vacant = zone.capacity - zone.occupied;
                const isFull = vacant <= 0;
                
                return (
                  <tr key={zone.id} className="group hover:bg-white/5 transition-colors h-16">
                    <td className="p-4 border-r border-white/10">
                        <div className="flex items-center gap-3">
                           <div className={`w-2 h-2 rounded-full ${isFull ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' : 'bg-green-500 shadow-[0_0_8px_#22c55e]'}`} />
                           <div className="flex flex-col">
                             <span className="font-black text-lg tracking-tighter uppercase leading-none">{zone.name}</span>
                             <span className="text-[10px] text-white/40 font-mono">NODE_HASH: {zone.id.slice(0,12)}</span>
                           </div>
                        </div>
                    </td>
                    <td className="p-4 border-r border-white/10 text-right font-mono text-xl font-black">
                      {zone.occupied}
                    </td>
                    <td className="p-4 border-r border-white/10 text-right font-mono text-lg text-white/40">
                      {zone.capacity}
                    </td>
                    <td className={`p-4 border-r border-white/10 text-right font-mono text-xl font-black ${isFull ? 'text-red-500' : 'text-green-500'}`}>
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
              
              {/* Visual Padding for Table Stability */}
              {!isLoading && Array.from({ length: Math.max(0, ITEMS_PER_PAGE - currentZonesSlice.length) }).map((_, i) => (
                 <tr key={`empty-${i}`} className="border-b border-white/5 h-16 opacity-20 pointer-events-none">
                   <td colSpan={5} className="p-4 text-center text-white/20 uppercase tracking-[1em] text-[9px]">
                     BUFFER_ZONE_EMPTY
                   </td>
                 </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 4. SLIDESHOW / PAGINATION FOOTER */}
        <footer className="border-t-2 border-white p-3 flex flex-col sm:flex-row justify-between items-center bg-black gap-4 z-20">
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
              className={`rounded-none border-white text-white hover:bg-white hover:text-black w-36 h-9 text-xs font-black uppercase transition-all ${isPaused ? 'border-red-500 text-red-500 bg-red-500/10' : ''}`}
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
                 <span className="text-[10px] uppercase font-bold text-white/40 tracking-widest">Display Status</span>
                 <div className="flex items-center gap-2">
                    {isPaused && <span className="text-[9px] bg-red-600 text-white px-2 py-0.5 font-black uppercase animate-pulse">Manual_Override</span>}
                    <span className="text-xs font-black uppercase tracking-tighter bg-white text-black px-3 py-1">
                      Terminals {pageIndex + 1} of {totalPages}
                    </span>
                 </div>
              </div>
              <div className="hidden md:block text-[9px] uppercase tracking-widest text-white/30 border-l border-white/20 pl-4 max-w-[150px]">
                Network Polling: 5000ms. Displaying subset of {ITEMS_PER_PAGE} nodes.
              </div>
          </div>
        </footer>
      </div>

      {/* 5. MODAL: VEHICLE MANIFEST (EYE ICON) */}
      <Dialog open={!!selectedZone} onOpenChange={(open) => !open && setSelectedZone(null)}>
        <DialogContent className="bg-black border-2 border-white text-white max-w-4xl max-h-[85vh] overflow-hidden flex flex-col rounded-none p-0 shadow-[0_0_50px_rgba(255,255,255,0.1)]">
          <div className="bg-white text-black p-4 flex justify-between items-center">
             <DialogTitle className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
                <Eye className="w-5 h-5" /> Manifest Inspection: {selectedZone?.name}
             </DialogTitle>
             <div className="text-[10px] font-bold border border-black px-2 py-1 uppercase font-mono">
               LOC_ID: {selectedZone?.id}
             </div>
          </div>
          
          <div className="p-6 overflow-y-auto flex-grow custom-scrollbar">
             {selectedVehicles.length === 0 ? (
                <div className="text-center py-24 border-2 border-dashed border-white/10 flex flex-col items-center gap-4">
                  <AlertTriangle className="w-12 h-12 text-white/20" />
                  <div className="text-white/40 uppercase tracking-[0.4em] font-bold">No active vehicle links detected</div>
                </div>
             ) : (
                <div className="border border-white/20">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-white/40 bg-white/5">
                        <th className="p-3 uppercase text-[10px] font-black tracking-[0.2em]">Class</th>
                        <th className="p-3 uppercase text-[10px] font-black tracking-[0.2em]">Registration</th>
                        <th className="p-3 uppercase text-[10px] font-black tracking-[0.2em]">Link_ID</th>
                        <th className="p-3 uppercase text-[10px] font-black tracking-[0.2em] text-right">Entry_Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono divide-y divide-white/10">
                      {selectedVehicles.map((v, i) => (
                        <tr key={i} className="hover:bg-white/10 transition-colors">
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                               {getVehicleIcon(v.type)}
                               <span className="uppercase text-xs font-bold">{v.type}</span>
                            </div>
                          </td>
                          <td className="p-3 font-black text-sm tracking-tight">{v.number}</td>
                          <td className="p-3 text-[10px] text-white/50">{v.ticketId}</td>
                          <td className="p-3 text-xs text-right text-white/70">
                             {new Date(v.entryTime).toLocaleString([], {
                               hour12: false, 
                               hour: '2-digit', 
                               minute:'2-digit', 
                               second: '2-digit',
                               day: '2-digit',
                               month: 'short'
                             })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
             )}
          </div>
          <div className="p-4 border-t border-white/20 flex justify-between items-center bg-white/5">
             <div className="text-[10px] uppercase text-white/40 font-bold">
               Total Active Links: {selectedVehicles.length}
             </div>
             <Button onClick={() => setSelectedZone(null)} className="rounded-none border-2 border-white bg-white text-black font-black uppercase text-xs h-10 px-8 hover:bg-black hover:text-white transition-all">
               Close_Manifest
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
        <DialogContent className="bg-black border-2 border-white text-white rounded-none p-0 max-w-md shadow-[0_0_100px_rgba(255,255,255,0.05)]">
          <div className="bg-white text-black p-4">
            <DialogTitle className="uppercase font-black tracking-tighter text-xl flex items-center gap-2">
              <Server className="w-5 h-5" /> 
              {isEditOpen ? "CONFIG: MODIFY_NODE" : "TERM: INITIALIZE_NODE"}
            </DialogTitle>
            <DialogDescription className="text-black/60 text-[10px] font-bold uppercase tracking-widest mt-1">
              Configure hardware constraints and resource parameters
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
                className="bg-black border-white/40 text-white rounded-none font-black uppercase tracking-widest focus:border-white h-11 focus:ring-0" 
              />
            </div>
            
            <div className="space-y-4">
              <Label className="text-[10px] uppercase font-black text-white/60 tracking-[0.2em] block pb-2 border-b border-white/10">Vehicle Class Allocation</Label>
              
              <div className="grid grid-cols-1 gap-3">
                {[
                  { id: 'heavy', label: 'Heavy Class (Bus/Coach)', icon: <Bus className="w-4 h-4" /> },
                  { id: 'medium', label: 'Medium Class (Truck/HCV)', icon: <Truck className="w-4 h-4" /> },
                  { id: 'light', label: 'Light Class (Car/LUV)', icon: <Car className="w-4 h-4" /> }
                ].map((vehicleClass) => (
                  <div key={vehicleClass.id} className="flex items-center justify-between gap-4 bg-white/5 p-2 border border-white/10 group">
                    <div className="flex items-center gap-3">
                      <div className="p-2 border border-white/20 text-white/60 group-hover:text-white transition-colors">{vehicleClass.icon}</div>
                      <span className="text-xs font-bold uppercase tracking-tight">{vehicleClass.label}</span>
                    </div>
                    <Input 
                      type="number"
                      value={formData.limits[vehicleClass.id as keyof typeof formData.limits]} 
                      onChange={(e) => updateLimit(vehicleClass.id as any, parseInt(e.target.value) || 0)}
                      className="w-20 bg-black border-white/40 text-right font-black rounded-none h-9 text-lg focus:border-white" 
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t-2 border-white/20 flex justify-between items-end">
              <div>
                <div className="text-[10px] uppercase font-black text-white/40 mb-1">Total Computed Capacity</div>
                <div className="text-3xl font-black tracking-tighter text-white underline decoration-white/20 underline-offset-4">
                  {formData.capacity} UNITS
                </div>
              </div>
              <div className="text-[9px] text-white/30 uppercase font-mono max-w-[120px] text-right leading-tight">
                Allocating system resources for peak operational load.
              </div>
            </div>
          </div>

          <DialogFooter className="p-4 bg-white/5 border-t border-white/20 flex sm:justify-between gap-2">
            <Button 
              variant="outline" 
              onClick={() => { setIsEditOpen(false); setIsCreateOpen(false); }} 
              className="border-white/40 text-white hover:bg-white/10 rounded-none uppercase font-black text-xs h-10 px-6"
            >
              Abort_Task
            </Button>
            <Button 
              onClick={isEditOpen ? handleSaveEdit : handleCreate} 
              className="bg-white text-black hover:bg-white/80 rounded-none uppercase font-black text-xs px-10 h-10 shadow-[0_0_20px_rgba(255,255,255,0.2)]"
            >
              {isEditOpen ? "Commit_Changes" : "Initialize_Node"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}