import { VehicleType } from "@/lib/parking-context";
import { ZoneCard } from "@/components/parking/ZoneCard";
import { 
  MapPin, 
  Search, 
  MoreHorizontal, 
  Activity, 
  Ticket, 
  Plus, 
  Settings2, 
  Trash2, 
  Edit3,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiGet, apiPost, apiDelete, apiPatch } from "@/lib/api";
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
  PieChart, Pie, Cell, LabelList
} from 'recharts';

import logo from "@/assets/kerala-police-logo.jpg";

// --- Types ---

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

export default function Home() {
  const { isAdmin } = useParking();
  const { toast } = useToast();

  // --- State Management ---
  const [zones, setZones] = useState<Zone[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState<VehicleSearchResult | null>(null);
  const [hoveredZone, setHoveredZone] = useState<Zone | null>(null);

  // Dialog Controls
  const [isTicketOpen, setIsTicketOpen] = useState(false);
  const [isCreateZoneOpen, setIsCreateZoneOpen] = useState(false);
  const [isEditZoneOpen, setIsEditZoneOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);

  // Form Data
  const [ticketData, setTicketData] = useState({
    vehicleNumber: "",
    zoneId: "",
    slot: "",
    type: "light" as VehicleType
  });

  const [zoneFormData, setZoneFormData] = useState({
    name: "",
    heavy: 0,
    medium: 0,
    light: 0
  });

  // --- Data Fetching ---
  const fetchZones = async () => {
    try {
      const data = await apiGet<Zone[]>("/api/zones");
      setZones(data);
    } catch (err) {
      console.error("Failed to load zones", err);
    }
  };

  useEffect(() => {
    fetchZones();
    const interval = setInterval(fetchZones, 5000);
    return () => clearInterval(interval);
  }, []);

  // --- Derived Calculations ---
  const totalCapacity = zones.reduce((sum, z) => sum + (z.capacity || 0), 0);
  const totalOccupied = zones.reduce((sum, z) => sum + (z.occupied || 0), 0);
  const totalVacancy = totalCapacity - totalOccupied;

  // --- Handlers ---

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    try {
      const result = await apiGet<VehicleSearchResult>(`/api/search/vehicle?number=${encodeURIComponent(searchQuery)}`);
      setSearchResult(result);
    } catch {
      setSearchResult(null);
      toast({ variant: "destructive", title: "Not Found", description: "Vehicle not currently parked" });
    }
  };

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
      toast({ title: "Ticket Generated", description: `Vehicle ${ticketData.vehicleNumber} successfully parked` });
      setIsTicketOpen(false);
      setTicketData({ vehicleNumber: "", zoneId: "", slot: "", type: "light" });
      fetchZones();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed", description: err?.message || "Error generating ticket" });
    }
  };

  const handleCreateZone = async () => {
    if (!zoneFormData.name) return;
    try {
      await apiPost("/api/zones", {
        name: zoneFormData.name,
        limits: { heavy: zoneFormData.heavy, medium: zoneFormData.medium, light: zoneFormData.light }
      });
      toast({ title: "Success", description: "New parking zone created" });
      setIsCreateZoneOpen(false);
      resetZoneForm();
      fetchZones();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: "Failed to create zone" });
    }
  };

  const handleUpdateZone = async () => {
    if (!selectedZone) return;
    try {
      await apiPatch(`/api/zones/${selectedZone.id}`, {
        name: zoneFormData.name,
        limits: { heavy: zoneFormData.heavy, medium: zoneFormData.medium, light: zoneFormData.light }
      });
      toast({ title: "Updated", description: "Zone configuration saved" });
      setIsEditZoneOpen(false);
      fetchZones();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Update Failed", description: "Could not save changes" });
    }
  };

  const handleDeleteZone = async () => {
    if (!selectedZone) return;
    try {
      await apiDelete(`/api/zones/${selectedZone.id}`);
      toast({ title: "Deleted", description: "Parking zone removed successfully" });
      setIsDeleteConfirmOpen(false);
      setSelectedZone(null);
      fetchZones();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Delete Failed", description: "Zone contains vehicles or server error" });
    }
  };

  const resetZoneForm = () => {
    setZoneFormData({ name: "", heavy: 10, medium: 20, light: 50 });
  };

  const openEditDialog = (zone: Zone) => {
    setSelectedZone(zone);
    setZoneFormData({
      name: zone.name,
      heavy: zone.limits.heavy,
      medium: zone.limits.medium,
      light: zone.limits.light
    });
    setIsEditZoneOpen(true);
  };

  // --- Chart Data Formatting ---
  const barChartData = zones.map(zone => {
    const calc = (cur: number, lim: number) => (lim > 0 ? (cur / lim) * 100 : 0);
    return {
      name: zone.name.replace('Nilakkal Parking Zone ', 'P'),
      Heavy: calc(zone.stats.heavy, zone.limits?.heavy || zone.capacity),
      Medium: calc(zone.stats.medium, zone.limits?.medium || zone.capacity),
      Light: calc(zone.stats.light, zone.limits?.light || zone.capacity),
      originalZone: zone 
    };
  });

  const activeStats = hoveredZone ? hoveredZone.stats : {
    heavy: zones.reduce((acc, z) => acc + z.stats.heavy, 0),
    medium: zones.reduce((acc, z) => acc + z.stats.medium, 0),
    light: zones.reduce((acc, z) => acc + z.stats.light, 0)
  };

  const pieData = [
    { name: 'Heavy', value: activeStats.heavy, color: '#1e293b' },
    { name: 'Medium', value: activeStats.medium, color: '#f59e0b' },
    { name: 'Light', value: activeStats.light, color: '#3b82f6' },
  ];

  const activeOccupancyRate = totalCapacity > 0 ? Math.round((totalOccupied / totalCapacity) * 100) : 0;

  // --- Sub-Components ---
  const TopCard = ({ title, value, dark = false, isVacancy = false }: any) => (
    <div className={`rounded-xl p-4 shadow-sm border transition-all ${dark ? 'bg-slate-900 text-white border-none' : 'bg-white border-slate-100 text-slate-800'}`}>
      <div className="flex justify-between items-center">
        <span className={`text-[10px] font-bold uppercase tracking-wider ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{title}</span>
        <div className={`text-2xl font-black ${isVacancy ? 'text-emerald-500' : ''}`}>{value}</div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-10">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <img src={logo} alt="Logo" className="h-16 w-auto" />
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">NILAKKAL SMART PARKING</h1>
            <p className="text-xs font-bold text-slate-500 uppercase">Real-time Traffic & Transit Management</p>
          </div>
        </div>
        
        {isAdmin && (
          <div className="flex gap-2">
            <Button onClick={() => setIsCreateZoneOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 px-6 shadow-lg shadow-emerald-100">
              <Plus className="w-5 h-5 mr-2" /> Add Zone
            </Button>
            <Button onClick={() => setIsTicketOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 px-6 shadow-lg shadow-blue-100">
              <Ticket className="w-5 h-5 mr-2" /> New Ticket
            </Button>
          </div>
        )}
      </div>

      {/* KPI Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <TopCard title="Available Slots" value={totalVacancy} dark={true} isVacancy={true} />
        <TopCard title="Occupied Slots" value={totalOccupied} />
        <TopCard title="Capacity" value={totalCapacity} />
        
        <div className="rounded-xl p-3 shadow-sm border bg-white border-slate-100 flex items-center gap-4">
          <div className="w-16 h-16 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart><Pie data={pieData} innerRadius={22} outerRadius={32} dataKey="value" stroke="none">
                {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie></PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black">{activeOccupancyRate}%</div>
          </div>
          <div className="flex-1">
            <div className="text-[10px] font-bold text-slate-400 mb-1">LIVE COMPOSITION</div>
            {pieData.map((item, i) => (
              <div key={i} className="flex justify-between text-[10px] leading-tight">
                <span className="text-slate-500 flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full" style={{backgroundColor: item.color}}/>{item.name}</span>
                <span className="font-bold">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Analytics Chart */}
      <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-100">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-600" /> OCCUPANCY METRICS PER ZONE (%)
          </h3>
          <div className="flex gap-4">
            {pieData.map(d => <div key={d.name} className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
              <div className="w-2.5 h-2.5 rounded-sm" style={{backgroundColor: d.color}}/> {d.name.toUpperCase()}
            </div>)}
          </div>
        </div>
        <div className="h-[350px] w-full">
          <ResponsiveContainer>
            <BarChart data={barChartData} onMouseMove={(s:any) => s.activePayload && setHoveredZone(s.activePayload[0].payload.originalZone)} onMouseLeave={() => setHoveredZone(null)}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 700}} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} unit="%" />
              <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
              <Bar dataKey="Heavy" fill="#1e293b" radius={[6, 6, 0, 0]}><LabelList dataKey="Heavy" position="top" formatter={(v:any) => v > 0 ? `${Math.round(v)}%` : ''} style={{fontSize: 10, fontWeight: 800, fill: '#1e293b'}}/></Bar>
              <Bar dataKey="Medium" fill="#f59e0b" radius={[6, 6, 0, 0]}><LabelList dataKey="Medium" position="top" formatter={(v:any) => v > 0 ? `${Math.round(v)}%` : ''} style={{fontSize: 10, fontWeight: 800, fill: '#f59e0b'}}/></Bar>
              <Bar dataKey="Light" fill="#3b82f6" radius={[6, 6, 0, 0]}><LabelList dataKey="Light" position="top" formatter={(v:any) => v > 0 ? `${Math.round(v)}%` : ''} style={{fontSize: 10, fontWeight: 800, fill: '#3b82f6'}}/></Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Zone Management Section */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-red-500" /> ZONE INVENTORY
            </h2>
            <p className="text-xs text-slate-500">Manage capacities and vehicle distribution</p>
          </div>
          
          <div className="flex gap-2">
            {searchResult && (
              <div className="bg-emerald-50 text-emerald-700 px-3 py-2 rounded-lg border border-emerald-100 text-xs font-bold flex items-center gap-3">
                {searchResult.vehicle_number} found in {searchResult.zone_name}
                <X className="w-4 h-4 cursor-pointer" onClick={() => setSearchResult(null)} />
              </div>
            )}
            <form onSubmit={handleSearch} className="flex gap-1">
              <Input placeholder="Search Vehicle..." className="w-48 bg-white border-slate-200 h-10 font-medium" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              <Button type="submit" className="bg-slate-900 text-white h-10 w-10 p-0"><Search className="w-4 h-4" /></Button>
            </form>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
          {zones.map((zone) => (
            <div key={zone.id} className="group relative">
              <ZoneCard zone={zone} />
              {isAdmin && (
                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  <Button size="icon" className="h-6 w-6 bg-white/90 text-slate-700 hover:bg-white" onClick={() => openEditDialog(zone)}>
                    <Settings2 className="w-3 h-3" />
                  </Button>
                  <Button size="icon" variant="destructive" className="h-6 w-6" onClick={() => { setSelectedZone(zone); setIsDeleteConfirmOpen(true); }}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* DIALOG: Create/Edit Zone (Modern Dark UI) */}
      <Dialog open={isCreateZoneOpen || isEditZoneOpen} onOpenChange={(val) => { if(!val) { setIsCreateZoneOpen(false); setIsEditZoneOpen(false); resetZoneForm(); } }}>
        <DialogContent className="sm:max-w-[450px] bg-[#0c111d] text-white border-slate-800 rounded-3xl p-8">
          <DialogHeader>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4">
              <Settings2 className="w-6 h-6 text-emerald-500" />
            </div>
            <DialogTitle className="text-2xl font-black">{isEditZoneOpen ? 'Configure Zone' : 'Create New Zone'}</DialogTitle>
            <DialogDescription className="text-slate-400">Set parking limits for different vehicle categories.</DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Zone Identification</Label>
              <Input value={zoneFormData.name} onChange={e => setZoneFormData({...zoneFormData, name: e.target.value})} className="bg-slate-900/50 border-slate-800 h-12 focus:ring-emerald-500" placeholder="e.g. North Entry P1" />
            </div>

            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Heavy', key: 'heavy', color: 'bg-slate-700' },
                { label: 'Medium', key: 'medium', color: 'bg-amber-500' },
                { label: 'Light', key: 'light', color: 'bg-blue-500' }
              ].map(type => (
                <div key={type.key} className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${type.color}`} /> {type.label}
                  </Label>
                  <Input 
                    type="number" 
                    value={(zoneFormData as any)[type.key]} 
                    onChange={e => setZoneFormData({...zoneFormData, [type.key]: parseInt(e.target.value) || 0})}
                    className="bg-slate-900/50 border-slate-800 h-12 text-center font-bold"
                  />
                </div>
              ))}
            </div>

            <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 flex justify-between items-center">
              <span className="text-xs font-bold text-emerald-500 uppercase">Calculated Total Capacity</span>
              <span className="text-2xl font-black text-emerald-400">{zoneFormData.heavy + zoneFormData.medium + zoneFormData.light}</span>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => { setIsCreateZoneOpen(false); setIsEditZoneOpen(false); }} className="text-slate-500 hover:text-white hover:bg-slate-800 font-bold">Discard</Button>
            <Button onClick={isEditZoneOpen ? handleUpdateZone : handleCreateZone} className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 font-black rounded-xl">
              {isEditZoneOpen ? 'Save Changes' : 'Initialize Zone'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: Delete Confirmation */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="w-5 h-5" /> Delete Zone?
            </DialogTitle>
            <DialogDescription className="pt-2">
              This will permanently remove <strong>{selectedZone?.name}</strong>. You cannot delete a zone that currently has vehicles parked in it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsDeleteConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteZone}>Confirm Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: Ticket Generation (Existing Logic) */}
      <Dialog open={isTicketOpen} onOpenChange={setIsTicketOpen}>
        <DialogContent className="sm:max-w-[450px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-black"><Ticket className="w-5 h-5" /> PARKING TICKET ENTRY</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label className="font-bold text-xs uppercase text-slate-500">Vehicle Number</Label>
              <Input placeholder="KL-01-AB-1234" value={ticketData.vehicleNumber} onChange={e => setTicketData({...ticketData, vehicleNumber: e.target.value.toUpperCase()})} className="h-12 text-lg font-bold tracking-widest border-2 focus:border-blue-500" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-bold text-xs uppercase text-slate-500">Vehicle Type</Label>
                <Select value={ticketData.type} onValueChange={(val: any) => setTicketData({...ticketData, type: val})}>
                  <SelectTrigger className="h-12 font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light (Car)</SelectItem>
                    <SelectItem value="medium">Medium (Van)</SelectItem>
                    <SelectItem value="heavy">Heavy (Bus)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-xs uppercase text-slate-500">Manual Zone (Opt)</Label>
                <Select value={ticketData.zoneId} onValueChange={val => setTicketData({...ticketData, zoneId: val})}>
                  <SelectTrigger className="h-12 font-bold"><SelectValue placeholder="Auto" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value=" ">Auto Assign</SelectItem>
                    {zones.map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleGenerateTicket} className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl text-lg shadow-lg shadow-blue-100">PRINT TICKET</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}