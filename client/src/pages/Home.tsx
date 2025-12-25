import { VehicleType } from "@/lib/parking-context";
import { ZoneCard } from "@/components/parking/ZoneCard";
import { MapPin, Search, MoreHorizontal, Activity, Ticket, Clock, Car, Bus, Truck, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiGet, apiPost } from "@/lib/api";
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
  status?: string; 
};

export default function Home() {
  const { isAdmin } = useParking();
  const [zones, setZones] = useState<Zone[]>([]);
  const { toast } = useToast();
  
  // Stats calculation
  const totalCapacity = zones.reduce((sum, z) => sum + z.capacity, 0);
  const totalOccupied = zones.reduce((sum, z) => sum + z.occupied, 0);
  const totalVacancy = totalCapacity - totalOccupied;
  
  const [hoveredZone, setHoveredZone] = useState<Zone | null>(null);
  const [isTicketOpen, setIsTicketOpen] = useState(false);
  const [ticketData, setTicketData] = useState({
    vehicleNumber: "",
    zoneId: "",
    slot: "",
    type: "light" as VehicleType
  });

  // NEW: Admin Zone Creation State
  const [isCreateZoneOpen, setIsCreateZoneOpen] = useState(false);
  const [newZoneForm, setNewZoneForm] = useState({
    name: "",
    heavy: 0,
    medium: 0,
    light: 0
  });

  // Auto-calculated total for the UI
  const newZoneTotal = Number(newZoneForm.heavy) + Number(newZoneForm.medium) + Number(newZoneForm.light);

  const formatIST = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const fetchZones = () => {
    apiGet<Zone[]>("/api/zones")
      .then((data) => setZones(data))
      .catch((err) => console.error("Failed to load zones", err));
  };

  useEffect(() => {
    fetchZones();
    const interval = setInterval(fetchZones, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleGenerateTicket = async () => {
    if (!ticketData.vehicleNumber) {
      toast({ variant: "destructive", title: "Error", description: "Please enter a vehicle number" });
      return;
    }
    try {
      await apiPost("/api/enter", {
        vehicle: ticketData.vehicleNumber.toUpperCase(),
        type: ticketData.type,
        zone: ticketData.zoneId || undefined,
        slot: ticketData.slot || undefined,
      });
      toast({ title: "Ticket Generated", description: "Vehicle parked successfully" });
      setIsTicketOpen(false);
      setTicketData({ vehicleNumber: "", zoneId: "", slot: "", type: "light" });
      fetchZones();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed", description: err?.message || "Error generating ticket" });
    }
  };

  // NEW: Admin Zone Creation Logic
  const handleCreateZone = async () => {
    if (!newZoneForm.name || newZoneTotal === 0) {
      toast({ variant: "destructive", title: "Validation Error", description: "Please provide a name and capacity" });
      return;
    }
    try {
      await apiPost("/api/admin/zones", {
        name: newZoneForm.name,
        limits: {
          heavy: Number(newZoneForm.heavy),
          medium: Number(newZoneForm.medium),
          light: Number(newZoneForm.light)
        }
      });
      toast({ title: "Success", description: "New parking zone created successfully" });
      setIsCreateZoneOpen(false);
      setNewZoneForm({ name: "", heavy: 0, medium: 0, light: 0 });
      fetchZones();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: "Failed to create zone" });
    }
  };

  const barChartData = zones.map(zone => {
    const heavyPct = zone.limits?.heavy > 0 ? (zone.stats.heavy / zone.limits.heavy) * 100 : 0;
    const mediumPct = zone.limits?.medium > 0 ? (zone.stats.medium / zone.limits.medium) * 100 : 0;
    const lightPct = zone.limits?.light > 0 ? (zone.stats.light / zone.limits.light) * 100 : 0;
    
    return {
      name: zone.name.replace('Nilakkal Parking Zone ', 'P'),
      Heavy: heavyPct,
      Medium: mediumPct,
      Light: lightPct,
      originalZone: zone 
    };
  });

  const activeStats = hoveredZone ? hoveredZone.stats : {
    heavy: zones.reduce((acc, z) => acc + (z.stats?.heavy || 0), 0),
    medium: zones.reduce((acc, z) => acc + (z.stats?.medium || 0), 0),
    light: zones.reduce((acc, z) => acc + (z.stats?.light || 0), 0)
  };
  const activeOccupied = hoveredZone ? hoveredZone.occupied : totalOccupied;
  const activeCapacity = hoveredZone ? hoveredZone.capacity : totalCapacity;
  const activeOccupancyRate = activeCapacity > 0 ? Math.round((activeOccupied / activeCapacity) * 100) : 0;
  
  const pieData = [
    { name: 'Heavy', value: activeStats.heavy, color: '#1e293b' },
    { name: 'Medium', value: activeStats.medium, color: '#f59e0b' },
    { name: 'Light', value: activeStats.light, color: '#3b82f6' },
  ];

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState<VehicleSearchResult | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    try {
      const result = await apiGet<VehicleSearchResult>(`/api/search?q=${encodeURIComponent(searchQuery.toUpperCase())}`);
      setSearchResult(result);
    } catch {
      setSearchResult(null);
      toast({ variant: "destructive", title: "Not Found", description: "Vehicle not found." });
    }
  };

  const TopCard = ({ title, value, dark = false, isVacancy = false }: any) => (
    <div className={`rounded-xl p-3 shadow-sm border relative overflow-hidden transition-all ${dark ? 'bg-[#1a233a] text-white border-none' : 'bg-white border-slate-100 text-slate-800'}`}>
      <div className="flex justify-between items-center">
        <span className={`text-[10px] font-bold uppercase tracking-wider ${dark ? 'text-slate-300' : 'text-slate-500'}`}>{title}</span>
        <div className={`text-xl font-bold ${isVacancy ? 'text-green-500' : ''}`}>{value}</div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Nilakkal Parking Portal</h1>
        </div>
        <div className="flex items-center gap-4">
           <img src={logo} alt="Kerala Police Logo" className="h-20 w-auto object-contain" />
        </div>
      </div>

      {/* Top Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <TopCard title="Vacancy" value={totalVacancy} dark={true} isVacancy={true} />
        <TopCard title="Occupancy" value={totalOccupied} />
        <TopCard title="Total Capacity" value={totalCapacity} />
        <div className="rounded-xl p-3 shadow-sm border bg-white border-slate-100 flex items-center gap-3">
           <div className="w-[70px] h-[70px] relative flex-shrink-0">
             <ResponsiveContainer width="100%" height="100%">
               <PieChart>
                 <Pie data={pieData} innerRadius={25} outerRadius={35} paddingAngle={0} dataKey="value" stroke="none">
                   {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                 </Pie>
               </PieChart>
             </ResponsiveContainer>
             <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-xs font-bold text-slate-700">
                {activeOccupancyRate}%
             </div>
           </div>
           <div className="flex-1 flex flex-col justify-center gap-1">
             <div className="flex justify-between items-center border-b border-slate-50 pb-1 mb-1 text-[10px]">
               <span className="font-medium text-slate-500">Composition</span>
               <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full uppercase">
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

      {/* Analytics Chart Section */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h3 className="font-bold text-slate-700">Live Parking Zone Status (Occupancy %)</h3>
            {isAdmin && (
              <Button size="sm" onClick={() => setIsCreateZoneOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                <PlusCircle className="w-4 h-4" /> Create Parking
              </Button>
            )}
          </div>
          <div className="hidden md:flex items-center gap-6">
             {pieData.map(d => (
               <div key={d.name} className="flex items-center gap-2">
                 <div className="w-3 h-3 rounded-sm" style={{backgroundColor: d.color}}></div>
                 <span className="text-xs text-slate-500">{d.name}</span>
               </div>
             ))}
          </div>
        </div>
        
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barChartData} barSize={24} onMouseMove={(state: any) => { if (state.activePayload) setHoveredZone(state.activePayload[0].payload.originalZone); }} onMouseLeave={() => setHoveredZone(null)}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 13}} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} unit="%" domain={[0, 100]} />
              <Tooltip cursor={{ fill: '#f8fafc' }} content={({ active, payload, label }) => {
                  if (active && payload?.length) {
                    const d = payload[0].payload.originalZone;
                    return (
                      <div className="bg-white p-3 border shadow-xl rounded-lg text-xs space-y-1">
                        <p className="font-bold border-bottom pb-1 mb-1">{label}</p>
                        <div className="flex justify-between gap-4"><span>Heavy:</span> <b>{d.stats.heavy}/{d.limits.heavy}</b></div>
                        <div className="flex justify-between gap-4"><span>Medium:</span> <b>{d.stats.medium}/{d.limits.medium}</b></div>
                        <div className="flex justify-between gap-4"><span>Light:</span> <b>{d.stats.light}/{d.limits.light}</b></div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="Heavy" fill="#1e293b" radius={[4, 4, 0, 0]}><LabelList dataKey="Heavy" position="center" angle={-90} formatter={(v: any) => v > 0 ? `${Math.round(v)}%` : ''} style={{ fill: '#fff', fontSize: 10 }} /></Bar>
              <Bar dataKey="Medium" fill="#f59e0b" radius={[4, 4, 0, 0]}><LabelList dataKey="Medium" position="center" angle={-90} formatter={(v: any) => v > 0 ? `${Math.round(v)}%` : ''} style={{ fill: '#fff', fontSize: 10 }} /></Bar>
              <Bar dataKey="Light" fill="#3b82f6" radius={[4, 4, 0, 0]}><LabelList dataKey="Light" position="center" angle={-90} formatter={(v: any) => v > 0 ? `${Math.round(v)}%` : ''} style={{ fill: '#fff', fontSize: 10 }} /></Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Grid View & Search */}
      <div className="space-y-4">
         <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
               <Activity className="w-5 h-5 text-orange-500" />
               <h3 className="font-bold text-slate-700">Live Parking Zone Overview</h3>
               {isAdmin && (
                <Button size="sm" onClick={() => setIsTicketOpen(true)} className="ml-4 bg-blue-600 hover:bg-blue-700 text-white gap-2">
                  <Ticket className="w-4 h-4" /> Generate Ticket
                </Button>
               )}
            </div>

            <div className="flex items-center gap-3">
               {searchResult && (
                 <div className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-md text-xs border border-blue-100 flex items-center gap-3">
                   <div className="flex flex-col">
                     <span className="font-bold flex items-center gap-1">{searchResult.vehicle_number}</span>
                     <span className="text-[10px] opacity-80">{searchResult.zone_name} • {formatIST(searchResult.entry_time)}</span>
                   </div>
                   <button onClick={() => setSearchResult(null)}>×</button>
                 </div>
               )}
               <form onSubmit={handleSearch} className="flex gap-2">
                  <Input placeholder="Find Vehicle Plate..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value.toUpperCase())} className="bg-white w-[180px] h-9" />
                  <Button type="submit" size="sm" className="bg-slate-900 text-white"><Search className="w-3.5 h-3.5" /></Button>
               </form>
            </div>
         </div>
         
         <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-2">
            {zones.map((zone) => <ZoneCard key={zone.id} zone={zone} />)}
         </div>
      </div>

      {/* CREATE ZONE DIALOG */}
      <Dialog open={isCreateZoneOpen} onOpenChange={setIsCreateZoneOpen}>
        <DialogContent className="sm:max-w-[425px] bg-[#1a233a] text-white border-none">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Create New Parking Zone</DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="space-y-2">
              <Label className="text-slate-400">Parking Zone Name</Label>
              <Input 
                placeholder="e.g. Nilakkal Parking Zone 2" 
                className="bg-[#242f4d] border-none text-white placeholder:text-slate-500"
                value={newZoneForm.name}
                onChange={(e) => setNewZoneForm({...newZoneForm, name: e.target.value})}
              />
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-400">Heavy</Label>
                <Input 
                  type="number" 
                  className="bg-[#242f4d] border-none text-white" 
                  value={newZoneForm.heavy}
                  onChange={(e) => setNewZoneForm({...newZoneForm, heavy: parseInt(e.target.value) || 0})}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-400">Medium</Label>
                <Input 
                  type="number" 
                  className="bg-[#242f4d] border-none text-white"
                  value={newZoneForm.medium}
                  onChange={(e) => setNewZoneForm({...newZoneForm, medium: parseInt(e.target.value) || 0})}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-400">Light</Label>
                <Input 
                  type="number" 
                  className="bg-[#242f4d] border-none text-white"
                  value={newZoneForm.light}
                  onChange={(e) => setNewZoneForm({...newZoneForm, light: parseInt(e.target.value) || 0})}
                />
              </div>
            </div>

            <div className="bg-[#242f4d] p-4 rounded-lg flex justify-between items-center">
              <span className="text-slate-400 font-medium">Total Capacity</span>
              <span className="text-2xl font-bold text-emerald-400">{newZoneTotal}</span>
            </div>
          </div>
          <DialogFooter>
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700 font-bold h-12" onClick={handleCreateZone}>
              CREATE PARKING
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EXISTING TICKET DIALOG */}
      <Dialog open={isTicketOpen} onOpenChange={setIsTicketOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>Generate Parking Ticket</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Vehicle No.</Label>
              <Input value={ticketData.vehicleNumber} onChange={(e) => setTicketData({ ...ticketData, vehicleNumber: e.target.value.toUpperCase() })} className="col-span-3 font-mono" placeholder="KL-01-AB-1234" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Type</Label>
              <Select value={ticketData.type} onValueChange={(val: VehicleType) => setTicketData({ ...ticketData, type: val })}>
                <SelectTrigger className="col-span-3"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light Vehicle</SelectItem>
                  <SelectItem value="medium">Medium Vehicle</SelectItem>
                  <SelectItem value="heavy">Heavy Vehicle</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button className="w-full bg-blue-600" onClick={handleGenerateTicket}>Generate Ticket</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}