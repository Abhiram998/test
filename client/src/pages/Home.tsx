import { VehicleType } from "@/lib/parking-context";
import { ZoneCard } from "@/components/parking/ZoneCard";
import { 
  MapPin, 
  Search, 
  MoreHorizontal, 
  Activity, 
  Ticket, 
  Plus, 
  Pencil, 
  Trash2, 
  Save, 
  X,
  ShieldCheck,
  TrendingUp,
  AlertCircle,
  Info,
  ChevronRight,
  Filter,
  Download,
  LayoutDashboard
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { useParking } from "@/lib/parking-context";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LabelList, AreaChart, Area
} from 'recharts';

/**
 * ASSET IMPORTS
 * Ensure these paths are correct in your project structure
 */
import logo from "@/assets/kerala-police-logo.jpg";

// =============================================================================
// TYPES & INTERFACES DEFINITIONS
// =============================================================================

/**
 * Interface representing the detailed structure of a Parking Zone
 * tailored for both the Grid view and the Analytics engine.
 */
interface Zone {
  id: string;
  name: string;
  capacity: number;
  occupied: number;
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
  vehicles?: {
    number: string;
    type: "light" | "medium" | "heavy";
    ticketId?: string;
    entryTime?: string;
  }[];
}

/**
 * Search result structure for vehicle tracking across all sectors
 */
interface VehicleSearchResult {
  vehicle_number: string;
  type_name: string;
  zone_id: string;
  zone_name: string;
  ticket_code: string;
  entry_time: string;
}

// =============================================================================
// MAIN COMPONENT: HOME (POLICE DASHBOARD)
// =============================================================================

/**
 * The Home component serves as the primary Command & Control interface for Nilakkal.
 * It features high-density information layouts, real-time Recharts analytics,
 * and secure administrative controls for zone manipulation.
 */
export default function Home() {
  // ---------------------------------------------------------------------------
  // 1. HOOKS & CONTEXT
  // ---------------------------------------------------------------------------
  const { isAdmin } = useParking();
  const { toast } = useToast();
  
  // ---------------------------------------------------------------------------
  // 2. STATE MANAGEMENT: CORE DATA
  // ---------------------------------------------------------------------------
  const [zones, setZones] = useState<Zone[]>([]);
  const [hoveredZone, setHoveredZone] = useState<Zone | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ---------------------------------------------------------------------------
  // 3. STATE MANAGEMENT: TICKET GENERATION (ENTRY GATE)
  // ---------------------------------------------------------------------------
  const [isTicketOpen, setIsTicketOpen] = useState(false);
  const [ticketData, setTicketData] = useState({
    vehicleNumber: "",
    zoneId: "",
    slot: "",
    type: "light" as VehicleType
  });

  // ---------------------------------------------------------------------------
  // 4. STATE MANAGEMENT: ZONE CONFIGURATION
  // ---------------------------------------------------------------------------
  const [isZoneModalOpen, setIsZoneModalOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [zoneForm, setZoneForm] = useState({
    name: "",
    heavy: 10,
    medium: 15,
    light: 25
  });

  // ---------------------------------------------------------------------------
  // 5. STATE MANAGEMENT: GLOBAL SEARCH & FILTERS
  // ---------------------------------------------------------------------------
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState<VehicleSearchResult | null>(null);

  // ---------------------------------------------------------------------------
  // 6. DERIVED ANALYTICS (USEMEMO FOR PERFORMANCE)
  // ---------------------------------------------------------------------------
  
  /** Computes the global capacity across all synchronized nodes */
  const totalCapacity = useMemo(() => zones.reduce((sum, z) => sum + (z.capacity || 0), 0), [zones]);
  
  /** Computes the total current occupancy across the entire facility */
  const totalOccupied = useMemo(() => zones.reduce((sum, z) => sum + (z.occupied || 0), 0), [zones]);
  
  /** Calculates real-time available vacancy for arrival routing */
  const totalVacancy = totalCapacity - totalOccupied;
  
  /** Dynamic summation for the Zone configuration form */
  const currentFormTotal = zoneForm.heavy + zoneForm.medium + zoneForm.light;

  // ---------------------------------------------------------------------------
  // 7. DATA SYNCHRONIZATION (API POLLING)
  // ---------------------------------------------------------------------------
  
  /**
   * Fetches the current state of all parking zones from the distributed database.
   * This is a critical function for maintaining the "Live" feel of the dashboard.
   */
  const fetchZones = useCallback(async () => {
    try {
      const data = await apiGet<Zone[]>("/api/zones");
      setZones(data);
      setIsLoading(false);
    } catch (err) {
      console.error("CRITICAL_SYNC_FAILURE: Failed to load zones from API.", err);
      setIsLoading(false);
    }
  }, []);

  /**
   * Polling effect: Refreshes the UI every 5 seconds to reflect entry/exit changes
   * happening at various entry terminals.
   */
  useEffect(() => {
    let isMounted = true;
    fetchZones();
    
    const interval = setInterval(() => {
      if (isMounted) fetchZones();
    }, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [fetchZones]);

  // ---------------------------------------------------------------------------
  // 8. ACTION HANDLERS: VEHICLE ENTRY
  // ---------------------------------------------------------------------------

  /**
   * Validates and submits a new vehicle entry.
   * Interfaces with /api/enter to update zone stats and record the manifest.
   */
  const handleGenerateTicket = async () => {
    if (!ticketData.vehicleNumber.trim()) {
      toast({ 
        variant: "destructive", 
        title: "Validation Error", 
        description: "A valid Vehicle Registration Number is mandatory for entry." 
      });
      return;
    }

    try {
      await apiPost("/api/enter", {
        vehicle: ticketData.vehicleNumber.toUpperCase(),
        type: ticketData.type,
        zone: ticketData.zoneId || undefined,
        slot: ticketData.slot || undefined,
      });

      toast({ 
        title: "Entry Verified", 
        description: `Vehicle [${ticketData.vehicleNumber.toUpperCase()}] assigned to Terminal.` 
      });
      
      setIsTicketOpen(false);
      setTicketData({ vehicleNumber: "", zoneId: "", slot: "", type: "light" });
      fetchZones(); // Immediate refresh
    } catch (err: any) {
      toast({ 
        variant: "destructive", 
        title: "Access Denied", 
        description: err?.message || "Internal routing error. Could not allocate slot." 
      });
    }
  };

  // ---------------------------------------------------------------------------
  // 9. ACTION HANDLERS: ZONE ADMINISTRATION
  // ---------------------------------------------------------------------------

  /**
   * Persists zone changes to the database.
   * Uses PATCH for updates and POST for initialization of new nodes.
   */
  const handleSaveZone = async () => {
    if (!zoneForm.name.trim()) {
      toast({ variant: "destructive", title: "Parameter Error", description: "Zone designation is required" });
      return;
    }

    try {
      if (editingZone) {
        await apiPatch(`/api/zones/${editingZone.id}`, {
          name: zoneForm.name,
          capacity: currentFormTotal,
          limits: {
            heavy: zoneForm.heavy,
            medium: zoneForm.medium,
            light: zoneForm.light
          }
        });
        toast({ title: "Node Updated", description: "Configuration parameters synchronized." });
      } else {
        await apiPost("/api/zones", {
          name: zoneForm.name,
          capacity: currentFormTotal,
          limits: {
            heavy: zoneForm.heavy,
            medium: zoneForm.medium,
            light: zoneForm.light
          }
        });
        toast({ title: "Node Initialized", description: "New sector added to global grid." });
      }
      setIsZoneModalOpen(false);
      setEditingZone(null);
      fetchZones();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Commit Failed", description: err?.message || "Database write error." });
    }
  };

  /** Resets form for a fresh zone creation */
  const openAddZone = () => {
    setEditingZone(null);
    setZoneForm({ name: "", heavy: 10, medium: 15, light: 25 });
    setIsZoneModalOpen(true);
  };

  // ---------------------------------------------------------------------------
  // 10. ACTION HANDLERS: GLOBAL SEARCH
  // ---------------------------------------------------------------------------

  /** Performs a fuzzy search against active vehicle manifests */
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    try {
      const result = await apiGet<VehicleSearchResult>(
        `/api/search/vehicle?number=${encodeURIComponent(searchQuery.toUpperCase())}`
      );
      setSearchResult(result);
    } catch {
      setSearchResult(null);
      toast({ 
        variant: "destructive", 
        title: "Trace Failed", 
        description: "Vehicle not found in any active sector." 
      });
    }
  };

  // ---------------------------------------------------------------------------
  // 11. CHART CONFIGURATION & CALCULATIONS
  // ---------------------------------------------------------------------------

  /** Transforms raw zone data into a format suitable for Recharts visualization */
  const barChartData = useMemo(() => zones.map(zone => {
    const limits = zone.limits || { heavy: 1, medium: 1, light: 1 };
    const stats = zone.stats || { heavy: 0, medium: 0, light: 0 };
    
    return {
      name: zone.name.replace('Nilakkal Parking Zone ', 'P'),
      Heavy: (stats.heavy / (limits.heavy || 1)) * 100,
      Medium: (stats.medium / (limits.medium || 1)) * 100,
      Light: (stats.light / (limits.light || 1)) * 100,
      originalZone: zone 
    };
  }), [zones]);

  /** * Context-aware stats: 
   * If hovering over a chart bar, show that zone's stats. Otherwise show global totals.
   */
  const activeStats = useMemo(() => hoveredZone ? hoveredZone.stats : {
    heavy: zones.reduce((acc, z) => acc + (z.stats?.heavy || 0), 0),
    medium: zones.reduce((acc, z) => acc + (z.stats?.medium || 0), 0),
    light: zones.reduce((acc, z) => acc + (z.stats?.light || 0), 0)
  }, [hoveredZone, zones]);

  const activeOccupied = hoveredZone ? hoveredZone.occupied : totalOccupied;
  const activeCapacity = hoveredZone ? hoveredZone.capacity : totalCapacity;
  const activeOccupancyRate = activeCapacity > 0 ? Math.round((activeOccupied / activeCapacity) * 100) : 0;

  /** Data for the circular composition donut chart */
  const pieData = [
    { name: 'Heavy', value: activeStats.heavy, color: '#1e293b' },
    { name: 'Medium', value: activeStats.medium, color: '#f59e0b' },
    { name: 'Light', value: activeStats.light, color: '#3b82f6' },
  ];

  // ---------------------------------------------------------------------------
  // 12. INTERNAL UI COMPONENTS (SUB-TEMPLATES)
  // ---------------------------------------------------------------------------

  /** High-contrast metric card used for top-level KPIs */
  const TopCard = ({ title, value, dark = false, isVacancy = false }: any) => (
    <div className={`rounded-xl p-4 shadow-sm border relative overflow-hidden group hover:shadow-md transition-all ${
      dark ? 'bg-[#1a233a] text-white border-none' : 'bg-white border-slate-100 text-slate-800'
    }`}>
      <div className="flex justify-between items-center">
        <div className="flex flex-col">
          <span className={`text-[10px] font-black uppercase tracking-widest ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
            {title}
          </span>
          <div className={`text-2xl font-black tracking-tighter mt-1 ${isVacancy ? 'text-emerald-400' : ''}`}>
            {value}
          </div>
        </div>
        <div className={`p-2 rounded-lg ${dark ? 'bg-white/10' : 'bg-slate-50'}`}>
           {isVacancy ? <ShieldCheck className="w-5 h-5 text-emerald-500" /> : <Activity className="w-5 h-5 text-blue-500" />}
        </div>
      </div>
      {/* Decorative Background Element */}
      <div className="absolute -bottom-2 -right-2 opacity-5 group-hover:scale-110 transition-transform">
        <LayoutDashboard className="w-16 h-16" />
      </div>
    </div>
  );

  // ---------------------------------------------------------------------------
  // 13. MASTER RENDER
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10">
      
      {/* SECTION: BRANDING & GLOBAL HEADER */}
      <div className="flex flex-col md:flex-row items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-100 gap-6">
        <div className="flex items-center gap-6">
          <img src={logo} alt="Kerala Police" className="h-16 w-auto object-contain" />
          <div className="h-12 w-[1px] bg-slate-200 hidden md:block" />
          <div>
            <div className="flex items-center gap-2 text-blue-600 mb-1">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Secure Surveillance Node</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
              Nilakkal Parking <span className="text-slate-400">Management System</span>
            </h1>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="hidden xl:flex flex-col items-end mr-4">
            <span className="text-[10px] font-bold text-slate-400 uppercase">System Status</span>
            <span className="text-xs font-bold text-emerald-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live Polling Active
            </span>
          </div>
          <Button variant="outline" className="border-slate-200 text-slate-600 gap-2 h-11 px-5 font-bold hover:bg-slate-50">
            <Download className="w-4 h-4" /> Export Logs
          </Button>
          <Button className="bg-slate-900 hover:bg-slate-800 text-white gap-2 h-11 px-6 font-bold shadow-lg shadow-slate-200">
            <Filter className="w-4 h-4" /> Global Filters
          </Button>
        </div>
      </div>

      {/* SECTION: KEY PERFORMANCE INDICATORS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <TopCard title="Real-time Vacancy" value={totalVacancy} dark={true} isVacancy={true} />
        <TopCard title="Active Occupancy" value={totalOccupied} />
        <TopCard title="Hardware Capacity" value={totalCapacity} />
        
        {/* COMPOSITION DONUT CARD */}
        <div className="rounded-xl p-4 shadow-sm border bg-white border-slate-100 h-full flex items-center gap-4 relative">
          <div className="w-[80px] h-[80px] relative flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  innerRadius={28}
                  outerRadius={38}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-[11px] font-black text-slate-800">{activeOccupancyRate}%</span>
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            <div className="flex justify-between items-center border-b border-slate-50 pb-2 mb-2">
              <span className="font-bold text-slate-400 text-[10px] uppercase">Composition</span>
              <span className="text-[9px] font-black text-white bg-blue-600 px-2 py-0.5 rounded uppercase">
                {hoveredZone ? hoveredZone.name.split(' ').pop() : "Global"}
              </span>
            </div>
            
            <div className="grid grid-cols-3 gap-1">
              {pieData.map((item, index) => (
                <div key={index} className="flex flex-col items-center">
                   <div className="w-1.5 h-1.5 rounded-full mb-1" style={{ backgroundColor: item.color }} />
                   <span className="font-black text-slate-800 text-[10px]">{item.value}</span>
                   <span className="text-slate-400 text-[8px] uppercase">{item.name[0]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION: MAIN ANALYTICS VIEWPORT */}
      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-2 h-6 bg-blue-600 rounded-full" />
                <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight">Occupancy Metrics by Sector</h3>
              </div>
              <p className="text-slate-400 text-sm font-medium ml-4">Live percentage distribution across vehicle classes</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              {isAdmin && (
                <>
                  <Button onClick={() => setIsTicketOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white gap-2 font-bold h-10">
                    <Ticket className="w-4 h-4" /> New Ticket
                  </Button>
                  <Button onClick={openAddZone} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-bold h-10">
                    <Plus className="w-4 h-4" /> Add Sector
                  </Button>
                </>
              )}
              <div className="h-8 w-[1px] bg-slate-200 mx-2 hidden lg:block" />
              <div className="flex items-center gap-4 bg-slate-50 px-4 py-2 rounded-lg">
                 {['Heavy', 'Medium', 'Light'].map((type, i) => (
                   <div key={type} className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${i === 0 ? 'bg-[#1e293b]' : i === 1 ? 'bg-[#f59e0b]' : 'bg-[#3b82f6]'}`}></div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase">{type}</span>
                   </div>
                 ))}
              </div>
            </div>
          </div>
          
          <div className="h-[350px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={barChartData} 
                barGap={8}
                margin={{ top: 20, right: 10, left: -20, bottom: 5 }}
                onMouseMove={(state: any) => {
                  if (state.activePayload) setHoveredZone(state.activePayload[0].payload.originalZone);
                }}
                onMouseLeave={() => setHoveredZone(null)}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} tickLine={false} 
                  tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 700}} dy={10} 
                />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} unit="%" domain={[0, 100]} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload.originalZone;
                      return (
                        <div className="bg-slate-900 text-white p-4 shadow-2xl rounded-xl border border-slate-800 text-xs min-w-[150px]">
                          <p className="font-black border-b border-white/10 pb-2 mb-2 uppercase tracking-widest">{label}</p>
                          <div className="space-y-2">
                            {['heavy', 'medium', 'light'].map((t: any) => (
                              <div key={t} className="flex items-center justify-between gap-6">
                                <span className="capitalize text-slate-400 font-bold">{t}</span>
                                <span className="font-black text-emerald-400">{d.stats[t]} <span className="text-white/20">/</span> {d.limits[t]}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="Heavy" fill="#1e293b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Medium" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Light" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* SECTION: SECTOR GRID & SEARCH */}
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
           <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-6">
              <div className="flex items-center gap-3">
                 <div className="p-2 bg-orange-100 rounded-lg">
                    <Activity className="w-5 h-5 text-orange-600" />
                 </div>
                 <div>
                    <h3 className="font-black text-slate-800 uppercase tracking-tight">Sector Grid Matrix</h3>
                    <p className="text-xs font-bold text-slate-400 uppercase">Real-time status of all {zones.length} deployment nodes</p>
                 </div>
              </div>

              {isAdmin && (
                 <div className="flex items-center gap-3">
                    {searchResult && (
                      <div className="px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-xs border border-emerald-100 flex items-center gap-3 animate-in fade-in slide-in-from-right-4">
                        <ShieldCheck className="w-4 h-4" />
                        <span className="font-black">{searchResult.vehicle_number}</span>
                        <ChevronRight className="w-3 h-3 opacity-30" />
                        <span className="font-bold">{searchResult.zone_name}</span>
                        <Button variant="ghost" size="icon" className="h-5 w-5 ml-2 hover:bg-emerald-100 rounded-full" onClick={() => setSearchResult(null)}><X className="w-3 h-3" /></Button>
                      </div>
                    )}
                    <form onSubmit={handleSearch} className="flex gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-100 focus-within:border-blue-300 transition-all">
                        <Input 
                          placeholder="Search Vehicle ID..." 
                          value={searchQuery} 
                          onChange={(e) => setSearchQuery(e.target.value)} 
                          className="bg-transparent border-none shadow-none focus-visible:ring-0 w-[180px] h-9 text-xs font-bold uppercase" 
                        />
                        <Button type="submit" size="sm" className="bg-slate-900 text-white h-9 w-9 p-0 rounded-lg">
                          <Search className="w-4 h-4" />
                        </Button>
                    </form>
                 </div>
              )}
           </div>
           
           <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-8 xl:grid-cols-10 gap-3">
              {zones.map((zone) => (
                <div key={zone.id} className="relative group perspective-1000">
                  <ZoneCard zone={zone} />
                  {isAdmin && (
                    <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-all transform scale-75 group-hover:scale-100 flex flex-col gap-1 z-20">
                      <Button 
                        size="icon" 
                        className="h-8 w-8 bg-white shadow-xl border border-slate-100 hover:bg-blue-600 hover:text-white rounded-full transition-colors"
                        onClick={() => {
                          setEditingZone(zone);
                          setZoneForm({
                            name: zone.name,
                            heavy: zone.limits.heavy,
                            medium: zone.limits.medium,
                            light: zone.limits.light
                          });
                          setIsZoneModalOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              
              {/* Empty State placeholder if no zones exist */}
              {zones.length === 0 && !isLoading && (
                 <div className="col-span-full py-20 text-center flex flex-col items-center gap-4 border-2 border-dashed border-slate-100 rounded-2xl">
                    <Info className="w-10 h-10 text-slate-200" />
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No active sectors deployed</p>
                    <Button onClick={openAddZone} variant="outline" className="mt-2">Initialize First Sector</Button>
                 </div>
              )}
           </div>
        </div>
      </div>

      {/* MODAL: ZONE CONFIGURATION ENGINE */}
      <Dialog open={isZoneModalOpen} onOpenChange={setIsZoneModalOpen}>
        <DialogContent className="bg-slate-950 text-white border-slate-800 sm:max-w-[450px] p-0 overflow-hidden rounded-3xl">
          <div className="bg-gradient-to-br from-slate-800 to-slate-950 p-6 border-b border-white/5">
            <DialogTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
              <LayoutDashboard className="w-5 h-5 text-blue-400" />
              {editingZone ? "Modify Sector Parameters" : "Initialize New Sector"}
            </DialogTitle>
            <DialogDescription className="text-slate-400 mt-1 font-medium">
              Update hardware allocation and vehicle class constraints for this node.
            </DialogDescription>
          </div>
          
          <div className="p-8 space-y-8">
            <div className="space-y-3">
              <Label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Sector Designation</Label>
              <Input 
                className="bg-slate-900/50 border-slate-800 text-white h-12 rounded-xl focus:ring-blue-500 font-bold uppercase tracking-wider" 
                placeholder="e.g. SECTOR_ALPHA_01"
                value={zoneForm.name}
                onChange={(e) => setZoneForm({...zoneForm, name: e.target.value})}
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                 <div className="h-px flex-1 bg-slate-800" />
                 <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">Class Allocation</span>
                 <div className="h-px flex-1 bg-slate-800" />
              </div>
              
              {['heavy', 'medium', 'light'].map((type) => (
                <div key={type} className="flex items-center justify-between bg-slate-900/30 p-3 rounded-xl border border-slate-800/50">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${type === 'heavy' ? 'bg-slate-600' : type === 'medium' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                    <Label className="capitalize text-slate-300 font-black tracking-wide">{type} Class</Label>
                  </div>
                  <Input 
                    type="number" 
                    className="w-24 bg-slate-950 border-slate-800 text-white text-right font-black h-10 rounded-lg"
                    value={zoneForm[type as keyof typeof zoneForm]}
                    onChange={(e) => setZoneForm({...zoneForm, [type]: parseInt(e.target.value) || 0})}
                  />
                </div>
              ))}
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-2xl flex justify-between items-center">
              <div>
                 <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Total Allocated Nodes</p>
                 <p className="text-3xl font-black text-white tracking-tighter">{currentFormTotal} UNITS</p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-500/30" />
            </div>
          </div>

          <DialogFooter className="p-6 bg-slate-900/50 border-t border-white/5 flex gap-3">
            <Button variant="ghost" onClick={() => setIsZoneModalOpen(false)} className="text-slate-400 hover:text-white hover:bg-white/5 font-bold h-11 px-6">
              Cancel Task
            </Button>
            <Button onClick={handleSaveZone} className="bg-white text-slate-950 hover:bg-slate-200 font-black h-11 px-8 rounded-xl uppercase tracking-tight">
              {editingZone ? "Commit Changes" : "Initialize Hardware"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: TICKET GENERATION (ACCESS CONTROL) */}
      {isAdmin && (
        <Dialog open={isTicketOpen} onOpenChange={setIsTicketOpen}>
          <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden rounded-3xl border-none shadow-2xl">
            <div className="bg-blue-600 p-8 text-white relative overflow-hidden">
               <Ticket className="absolute -right-4 -bottom-4 w-32 h-32 text-white/10 rotate-12" />
               <DialogHeader>
                  <DialogTitle className="text-2xl font-black uppercase tracking-tight text-white">Entry Manifest</DialogTitle>
                  <DialogDescription className="text-blue-100 font-medium opacity-80">Generate authorized parking ticket for arriving vehicle.</DialogDescription>
               </DialogHeader>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Vehicle Registration</Label>
                <div className="relative">
                   <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-sm">IND</div>
                   <Input 
                     value={ticketData.vehicleNumber} 
                     onChange={(e) => setTicketData({ ...ticketData, vehicleNumber: e.target.value })} 
                     className="pl-14 h-12 bg-slate-50 border-slate-200 font-black text-lg tracking-widest uppercase focus:ring-blue-500 rounded-xl"
                     placeholder="KL 01 AB 1234"
                   />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Vehicle Class</Label>
                  <Select value={ticketData.type} onValueChange={(val: VehicleType) => setTicketData({ ...ticketData, type: val })}>
                    <SelectTrigger className="h-12 bg-slate-50 border-slate-200 font-bold rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light" className="font-bold">Light Class</SelectItem>
                      <SelectItem value="medium" className="font-bold">Medium Class</SelectItem>
                      <SelectItem value="heavy" className="font-bold">Heavy Class</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Target Sector</Label>
                  <Select value={ticketData.zoneId || "auto"} onValueChange={(val) => setTicketData({ ...ticketData, zoneId: val === "auto" ? "" : val })}>
                    <SelectTrigger className="h-12 bg-slate-50 border-slate-200 font-bold rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-[250px]">
                      <SelectItem value="auto" className="font-black text-blue-600">Auto-Assign</SelectItem>
                      {zones.map((z) => (
                        <SelectItem key={z.id} value={z.id} className="font-medium">
                           {z.name.replace('Nilakkal Parking Zone ', 'P-')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="p-4 bg-slate-50 rounded-2xl flex items-start gap-3">
                 <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5" />
                 <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                   Generating this ticket will immediately allocate a slot in the target sector. 
                   Ensure the vehicle class matches the physical dimensions for optimized flow.
                 </p>
              </div>
            </div>

            <DialogFooter className="p-8 pt-0">
               <Button 
                 onClick={handleGenerateTicket} 
                 className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black h-14 rounded-2xl text-lg shadow-xl shadow-blue-100 uppercase tracking-tight"
               >
                 Verify & Print Ticket
               </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}