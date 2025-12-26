import { VehicleType } from "@/lib/parking-context";
import { ZoneCard } from "@/components/parking/ZoneCard";
import { MapPin, Search, MoreHorizontal, Activity, Ticket, Plus, Pencil, Trash2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { useEffect } from "react";
import { useParking } from "@/lib/parking-context";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
  PieChart, Pie, Cell, LabelList
} from 'recharts';

import logo from "@/assets/kerala-police-logo.jpg";

// ==========================================
// TYPES & INTERFACES
// ==========================================

type Zone = {
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
};

type VehicleSearchResult = {
  vehicle_number: string;
  type_name: string;
  zone_id: string;
  zone_name: string;
  ticket_code: string;
  entry_time: string;
};

// ==========================================
// MAIN COMPONENT: HOME
// ==========================================

export default function Home() {
  const { isAdmin } = useParking();
  const { toast } = useToast();
  
  // 🔹 Zones State
  const [zones, setZones] = useState<Zone[]>([]);
  const [hoveredZone, setHoveredZone] = useState<Zone | null>(null);

  // 🔹 Ticket Generation State
  const [isTicketOpen, setIsTicketOpen] = useState(false);
  const [ticketData, setTicketData] = useState({
    vehicleNumber: "",
    zoneId: "",
    slot: "",
    type: "light" as VehicleType
  });

  // 🔹 Zone Management State (Add/Edit)
  const [isZoneModalOpen, setIsZoneModalOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [zoneForm, setZoneForm] = useState({
    name: "",
    heavy: 10,
    medium: 15,
    light: 25
  });

  // 🔹 Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState<any>(null);

  // 🔹 Derived Calculations
  const totalCapacity = zones.reduce((sum, z) => sum + z.capacity, 0);
  const totalOccupied = zones.reduce((sum, z) => sum + z.occupied, 0);
  const totalVacancy = totalCapacity - totalOccupied;
  const currentFormTotal = zoneForm.heavy + zoneForm.medium + zoneForm.light;

  // ------------------------------------------
  // DATA FETCHING
  // ------------------------------------------
  
  const fetchZones = async () => {
    try {
      const data = await apiGet<Zone[]>("/api/zones");
      setZones(data);
    } catch (err) {
      console.error("Failed to load zones", err);
    }
  };

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
  }, []);

  // ------------------------------------------
  // ACTION HANDLERS
  // ------------------------------------------

  const handleGenerateTicket = async () => {
    if (!ticketData.vehicleNumber) {
      toast({ variant: "destructive", title: "Error", description: "Please enter a vehicle number" });
      return;
    }

    try {
      await apiPost("/api/enter", {
        vehicle: ticketData.vehicleNumber,
        type: ticketData.type,
        zone: ticketData.zoneId || undefined,
        slot: ticketData.slot || undefined,
      });

      toast({ title: "Ticket Generated", description: `Vehicle ${ticketData.vehicleNumber} parked successfully` });
      setIsTicketOpen(false);
      setTicketData({ vehicleNumber: "", zoneId: "", slot: "", type: "light" });
      fetchZones();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Generation Failed", description: err?.message || "Could not generate ticket" });
    }
  };

  const handleSaveZone = async () => {
    if (!zoneForm.name.trim()) {
      toast({ variant: "destructive", title: "Missing Name", description: "Zone name is required" });
      return;
    }

    try {
      if (editingZone) {
        await apiPatch(`/api/zones/${editingZone.id}`, zoneForm);
        toast({ title: "Zone Updated", description: "Zone limits updated successfully" });
      } else {
        await apiPost("/api/zones", zoneForm);
        toast({ title: "Zone Created", description: "New parking zone added" });
      }
      setIsZoneModalOpen(false);
      setEditingZone(null);
      fetchZones();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Action Failed", description: err?.message || "Failed to save zone" });
    }
  };

  const openAddZone = () => {
    setEditingZone(null);
    setZoneForm({ name: "", heavy: 10, medium: 15, light: 25 });
    setIsZoneModalOpen(true);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    try {
      const result = await apiGet<VehicleSearchResult>(
        `/api/search/vehicle?number=${encodeURIComponent(searchQuery)}`
      );
      setSearchResult(result);
    } catch {
      setSearchResult(null);
      toast({ variant: "destructive", title: "Not Found", description: "Vehicle not currently parked" });
    }
  };

  // ------------------------------------------
  // CHART CONFIGURATION
  // ------------------------------------------

  const barChartData = zones.map(zone => {
    const limits = zone.limits || { heavy: 0, medium: 0, light: 0 };
    const stats = zone.stats || { heavy: 0, medium: 0, light: 0 };
    
    return {
      name: zone.name.replace('Nilakkal Parking Zone ', 'P'),
      Heavy: limits.heavy > 0 ? (stats.heavy / limits.heavy) * 100 : 0,
      Medium: limits.medium > 0 ? (stats.medium / limits.medium) * 100 : 0,
      Light: limits.light > 0 ? (stats.light / limits.light) * 100 : 0,
      originalZone: zone 
    };
  });

  const activeStats = hoveredZone ? hoveredZone.stats : {
    heavy: zones.reduce((acc, z) => acc + z.stats.heavy, 0),
    medium: zones.reduce((acc, z) => acc + z.stats.medium, 0),
    light: zones.reduce((acc, z) => acc + z.stats.light, 0)
  };

  const activeOccupied = hoveredZone ? hoveredZone.occupied : totalOccupied;
  const activeCapacity = hoveredZone ? hoveredZone.capacity : totalCapacity;
  const activeOccupancyRate = activeCapacity > 0 ? Math.round((activeOccupied / activeCapacity) * 100) : 0;

  const pieData = [
    { name: 'Heavy', value: activeStats.heavy, color: '#1e293b' },
    { name: 'Medium', value: activeStats.medium, color: '#f59e0b' },
    { name: 'Light', value: activeStats.light, color: '#3b82f6' },
  ];

  // ------------------------------------------
  // SUB-COMPONENTS
  // ------------------------------------------

  const TopCard = ({ title, value, dark = false, isVacancy = false }: any) => (
    <div className={`rounded-xl p-3 shadow-sm border relative overflow-hidden group hover:shadow-md transition-all ${dark ? 'bg-[#1a233a] text-white border-none' : 'bg-white border-slate-100 text-slate-800'}`}>
      <div className="flex justify-between items-center mb-0">
        <span className={`text-[10px] font-bold uppercase tracking-wider ${dark ? 'text-slate-300' : 'text-slate-500'}`}>{title}</span>
        <div className={`text-xl font-bold ${isVacancy ? 'text-green-500' : ''}`}>
          {value}
        </div>
      </div>
    </div>
  );

  // ------------------------------------------
  // RENDER
  // ------------------------------------------

  return (
    <div className="space-y-4">
      {/* Header Section */}
      <div className="flex items-center justify-between mb-1">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Dashboard Parking Zone</h1>
        </div>
        <div className="flex items-center gap-4">
           <img src={logo} alt="Kerala Police Logo" className="h-20 w-auto object-contain" />
           <Button variant="ghost" size="icon" className="md:hidden">
             <MoreHorizontal />
           </Button>
        </div>
      </div>

      {/* Top Status Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <TopCard title="Vacancy" value={totalVacancy} dark={true} isVacancy={true} />
        <TopCard title="Occupancy" value={totalOccupied} />
        <TopCard title="Total Capacity" value={totalCapacity} />
        
        <div className="rounded-xl p-3 shadow-sm border bg-white border-slate-100 h-full flex items-center gap-3">
           <div className="w-[70px] h-[70px] relative flex-shrink-0">
             <ResponsiveContainer width="100%" height="100%">
               <PieChart>
                 <Pie
                   data={pieData}
                   innerRadius={25}
                   outerRadius={35}
                   paddingAngle={0}
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
                <span className="text-xs font-bold text-slate-700">{activeOccupancyRate}%</span>
             </div>
           </div>

           <div className="flex-1 flex flex-col justify-center gap-1">
             <div className="flex justify-between items-center border-b border-slate-50 pb-1 mb-1">
               <span className="font-medium text-slate-500 text-xs">Composition</span>
               <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">
                 {hoveredZone ? `P${hoveredZone.name.replace('Nilakkal Parking Zone ', '')}` : "Total"}
               </span>
             </div>
             
             <div className="space-y-0.5">
                {pieData.map((item, index) => (
                   <div key={index} className="flex items-center justify-between text-[10px]">
                      <div className="flex items-center gap-1">
                         <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.color }} />
                         <span className="text-slate-500">{item.name}</span>
                      </div>
                      <span className="font-bold text-slate-700">{item.value}</span>
                   </div>
                ))}
             </div>
           </div>
        </div>
      </div>

      {/* Chart and Controls */}
      <div className="grid grid-cols-1 gap-6 h-full mt-2">
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <h3 className="font-bold text-slate-700">Live Parking Zone Status (Occupancy %)</h3>
                
                {isAdmin && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => setIsTicketOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
                      <Ticket className="w-4 h-4" /> Generate Ticket
                    </Button>
                    <Button size="sm" onClick={openAddZone} className="bg-green-600 hover:bg-green-700 text-white gap-2">
                      <Plus className="w-4 h-4" /> Add Zone
                    </Button>
                  </div>
                )}
              </div>
              <div className="hidden md:flex items-center gap-6">
                 {['Heavy', 'Medium', 'Light'].map((type, i) => (
                   <div key={type} className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-sm ${i === 0 ? 'bg-[#1e293b]' : i === 1 ? 'bg-[#f59e0b]' : 'bg-[#3b82f6]'}`}></div>
                      <span className="text-xs text-slate-500">{type}</span>
                   </div>
                 ))}
              </div>
            </div>
            
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={barChartData} 
                  barSize={24} 
                  margin={{ top: 20, right: 10, left: 0, bottom: 5 }}
                  onMouseMove={(state: any) => {
                    if (state.activePayload) setHoveredZone(state.activePayload[0].payload.originalZone);
                  }}
                  onMouseLeave={() => setHoveredZone(null)}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} tickLine={false} 
                    tick={{fill: '#64748b', fontSize: 13, fontWeight: 500}} dy={10} 
                  />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} unit="%" domain={[0, 100]} />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload.originalZone;
                        return (
                          <div className="bg-white p-3 border border-slate-100 shadow-xl rounded-lg text-sm">
                            <p className="font-bold text-slate-800 mb-2">{label}</p>
                            <div className="space-y-1">
                              {['heavy', 'medium', 'light'].map((t: any) => (
                                <div key={t} className="flex items-center justify-between gap-4 text-xs">
                                  <span className="capitalize">{t}</span>
                                  <span className="font-mono">{d.stats[t]} / {d.limits[t]}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="Heavy" fill="#1e293b" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="Heavy" position="center" angle={-90} formatter={(v: number) => v > 0 ? `${Math.round(v)}%` : ''} style={{ fill: '#fff', fontSize: 10 }} />
                  </Bar>
                  <Bar dataKey="Medium" fill="#f59e0b" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="Medium" position="center" angle={-90} formatter={(v: number) => v > 0 ? `${Math.round(v)}%` : ''} style={{ fill: '#fff', fontSize: 10 }} />
                  </Bar>
                  <Bar dataKey="Light" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="Light" position="center" angle={-90} formatter={(v: number) => v > 0 ? `${Math.round(v)}%` : ''} style={{ fill: '#fff', fontSize: 10 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Grid Overview and Search */}
          <div className="space-y-4">
             <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                   <Activity className="w-5 h-5 text-orange-500" />
                   <h3 className="font-bold text-slate-700">Live Parking Zone Overview</h3>
                </div>

                {isAdmin && (
                   <div className="flex items-center gap-3">
                      {searchResult && (
                        <div className="px-3 py-1.5 bg-green-50 text-green-700 rounded-md text-xs border border-green-100 flex items-center gap-2">
                          <span className="font-bold">{searchResult.vehicle_number}</span>
                          <span>in {searchResult.zone_name}</span>
                          <Button variant="ghost" size="icon" className="h-4 w-4 ml-1" onClick={() => setSearchResult(null)}>×</Button>
                        </div>
                      )}
                      <form onSubmit={handleSearch} className="flex gap-2">
                          <Input placeholder="Find Vehicle..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-white w-[180px] h-9 text-sm" />
                          <Button type="submit" size="sm" className="bg-slate-900 text-white h-9 px-3"><Search className="w-3.5 h-3.5" /></Button>
                      </form>
                   </div>
                )}
             </div>
             
             <div className="max-h-[500px] overflow-y-auto pr-2 grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-2">
                {zones.map((zone) => (
                  <div key={zone.id} className="relative group">
                    <ZoneCard zone={zone} />
                    {isAdmin && (
                      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1">
                        <Button 
                          size="icon" 
                          className="h-6 w-6 bg-white shadow-md border hover:bg-slate-100"
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
                          <Pencil className="h-3 w-3 text-blue-600" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
             </div>
          </div>
        </div>
      </div>

      {/* MODAL: ZONE MANAGEMENT (Add/Edit) */}
      <Dialog open={isZoneModalOpen} onOpenChange={setIsZoneModalOpen}>
        <DialogContent className="bg-black text-white border-slate-800 sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingZone ? "Edit Parking Zone" : "Create New Parking Zone"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-slate-400">Name</Label>
              <Input 
                className="col-span-3 bg-slate-900 border-slate-700 text-white" 
                value={zoneForm.name}
                onChange={(e) => setZoneForm({...zoneForm, name: e.target.value})}
              />
            </div>
            <div className="text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest border-t border-slate-800 pt-4">
              Vehicle Type Limits
            </div>
            {['heavy', 'medium', 'light'].map((type) => (
              <div key={type} className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right capitalize text-slate-400">{type}</Label>
                <Input 
                  type="number" 
                  className="col-span-3 bg-slate-900 border-slate-700 text-white"
                  value={zoneForm[type as keyof typeof zoneForm]}
                  onChange={(e) => setZoneForm({...zoneForm, [type]: parseInt(e.target.value) || 0})}
                />
              </div>
            ))}
            <div className="flex justify-between items-center border-t border-slate-800 pt-4">
              <span className="text-sm font-bold text-slate-400">Total Capacity</span>
              <span className="text-xl font-black text-white">{currentFormTotal}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsZoneModalOpen(false)} className="text-slate-400 hover:text-white">Cancel</Button>
            <Button onClick={handleSaveZone} className="bg-white text-black hover:bg-slate-200">
              {editingZone ? "Save Changes" : "Create Parking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: TICKET GENERATION */}
      {isAdmin && (
        <Dialog open={isTicketOpen} onOpenChange={setIsTicketOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader><DialogTitle>Generate Parking Ticket</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Vehicle No.</Label>
                <Input value={ticketData.vehicleNumber} onChange={(e) => setTicketData({ ...ticketData, vehicleNumber: e.target.value })} className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Type</Label>
                <Select value={ticketData.type} onValueChange={(val: VehicleType) => setTicketData({ ...ticketData, type: val })}>
                  <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light Vehicle</SelectItem>
                    <SelectItem value="medium">Medium Vehicle</SelectItem>
                    <SelectItem value="heavy">Heavy Vehicle</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Zone</Label>
                <Select value={ticketData.zoneId || "auto"} onValueChange={(val) => setTicketData({ ...ticketData, zoneId: val === "auto" ? "" : val })}>
                  <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    <SelectItem value="auto">Auto-assign</SelectItem>
                    {zones.map((z) => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter><Button onClick={handleGenerateTicket}>Generate Ticket</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}