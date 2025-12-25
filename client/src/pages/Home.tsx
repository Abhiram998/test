import { VehicleType } from "@/lib/parking-context";
import { ZoneCard } from "@/components/parking/ZoneCard";
import { MapPin, Search, MoreHorizontal, Activity, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiGet, apiPost } from "@/lib/api";
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
};

export default function Home() {
  const { isAdmin } = useParking();
  const { toast } = useToast();

  // 🔹 Zones from backend API
  const [zones, setZones] = useState<Zone[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState<VehicleSearchResult | null>(null);
  
  // State for interactive graph and Dialogs
  const [hoveredZone, setHoveredZone] = useState<Zone | null>(null);
  const [isTicketOpen, setIsTicketOpen] = useState(false);
  const [ticketData, setTicketData] = useState({
    vehicleNumber: "",
    zoneId: "",
    slot: "",
    type: "light" as VehicleType
  });

  // 🔹 Derived totals
  const totalCapacity = zones.reduce((sum, z) => sum + z.capacity, 0);
  const totalOccupied = zones.reduce((sum, z) => sum + z.occupied, 0);
  const totalVacancy = totalCapacity - totalOccupied;

  // 🔹 Fetch function reused for initial load and after actions
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

  const handleGenerateTicket = async () => {
    if (!ticketData.vehicleNumber) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a vehicle number",
      });
      return;
    }

    try {
      await apiPost("/api/enter", {
        vehicle: ticketData.vehicleNumber,
        type: ticketData.type,
        zone: ticketData.zoneId || undefined,
        slot: ticketData.slot || undefined,
      });

      toast({
        title: "Ticket Generated",
        description: `Vehicle ${ticketData.vehicleNumber} parked successfully`,
      });

      setIsTicketOpen(false);
      setTicketData({ vehicleNumber: "", zoneId: "", slot: "", type: "light" });
      // Immediate Refresh
      fetchZones();

    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Generation Failed",
        description: err?.message || "Could not generate ticket",
      });
    }
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
      toast({
        variant: "destructive",
        title: "Not Found",
        description: "Vehicle not currently parked",
      });
    }
  };

  // Chart Data Preparation
  const barChartData = zones.map(zone => {
    const calcPct = (current: number, limit: number) => 
      limit > 0 ? (current / limit) * 100 : 0;

    return {
      name: zone.name.replace('Nilakkal Parking Zone ', 'P'),
      Heavy: zone.limits ? calcPct(zone.stats.heavy, zone.limits.heavy) : calcPct(zone.stats.heavy, zone.capacity),
      Medium: zone.limits ? calcPct(zone.stats.medium, zone.limits.medium) : calcPct(zone.stats.medium, zone.capacity),
      Light: zone.limits ? calcPct(zone.stats.light, zone.limits.light) : calcPct(zone.stats.light, zone.capacity),
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

  const TopCard = ({ title, value, dark = false, isVacancy = false }: any) => (
    <div className={`rounded-xl p-3 shadow-sm border transition-all ${dark ? 'bg-[#1a233a] text-white border-none' : 'bg-white border-slate-100 text-slate-800'}`}>
      <div className="flex justify-between items-center">
        <span className={`text-[10px] font-bold uppercase tracking-wider ${dark ? 'text-slate-300' : 'text-slate-500'}`}>{title}</span>
        <div className={`text-xl font-bold ${isVacancy ? 'text-green-500' : ''}`}>
          {value}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Dashboard Parking Zone</h1>
        </div>
        <div className="flex items-center gap-4">
           <img src={logo} alt="Kerala Police Logo" className="h-16 w-auto object-contain" />
           <Button variant="ghost" size="icon" className="md:hidden">
             <MoreHorizontal />
           </Button>
        </div>
      </div>

      {/* Top Cards Row */}
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

      {/* Main Grid */}
      <div className="grid grid-cols-1 gap-6 h-full mt-2">
        <div className="space-y-6">
          
          {/* Bar Chart Section */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-4">
                <h3 className="font-bold text-slate-700">Live Parking Status (Occupancy %)</h3>
                {isAdmin && (
                  <Button size="sm" onClick={() => setIsTicketOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
                    <Ticket className="w-4 h-4" /> Generate Ticket
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-4">
                 {['Heavy', 'Medium', 'Light'].map((type, i) => (
                   <div key={type} className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-sm ${i===0?'bg-[#1e293b]':i===1?'bg-[#f59e0b]':'bg-[#3b82f6]'}`}></div>
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
                    if (state.activePayload) {
                      setHoveredZone(state.activePayload[0].payload.originalZone);
                    }
                  }}
                  onMouseLeave={() => setHoveredZone(null)}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#64748b', fontSize: 13, fontWeight: 500}} 
                    dy={10} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#64748b', fontSize: 12}} 
                    unit="%"
                    domain={[0, 100]} 
                  />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        const oz = data.originalZone;
                        return (
                          <div className="bg-white p-3 border border-slate-100 shadow-xl rounded-lg text-sm">
                            <p className="font-bold text-slate-800 mb-2">{label}</p>
                            <div className="space-y-1">
                              {[
                                { lab: 'Heavy', val: oz.stats.heavy, lim: oz.limits?.heavy, pct: data.Heavy, col: '#1e293b' },
                                { lab: 'Medium', val: oz.stats.medium, lim: oz.limits?.medium, pct: data.Medium, col: '#f59e0b' },
                                { lab: 'Light', val: oz.stats.light, lim: oz.limits?.light, pct: data.Light, col: '#3b82f6' }
                              ].map(row => (
                                <div key={row.lab} className="flex items-center justify-between gap-4 text-xs">
                                  <span className="flex items-center gap-1.5 text-slate-500">
                                    <div className="w-2 h-2 rounded-full" style={{backgroundColor: row.col}}></div>
                                    {row.lab}
                                  </span>
                                  <span className="font-mono font-medium">
                                    {row.val} / {row.lim || '-'} ({row.pct.toFixed(1)}%)
                                  </span>
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
                    <LabelList dataKey="Heavy" position="center" angle={-90} formatter={(v: number) => v > 15 ? `${Math.round(v)}%` : ''} style={{ fill: '#fff', fontSize: 10 }} />
                  </Bar>
                  <Bar dataKey="Medium" fill="#f59e0b" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="Medium" position="center" angle={-90} formatter={(v: number) => v > 15 ? `${Math.round(v)}%` : ''} style={{ fill: '#fff', fontSize: 10 }} />
                  </Bar>
                  <Bar dataKey="Light" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="Light" position="center" angle={-90} formatter={(v: number) => v > 15 ? `${Math.round(v)}%` : ''} style={{ fill: '#fff', fontSize: 10 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bottom Section: Live Zone Overview & Search */}
          <div className="space-y-4">
             <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                   <Activity className="w-5 h-5 text-orange-500" />
                   <h3 className="font-bold text-slate-700">Live Zone Overview</h3>
                </div>

                {isAdmin && (
                   <div className="flex items-center gap-3">
                      {searchResult && (
                        <div className="px-3 py-1.5 bg-green-50 text-green-700 rounded-md text-xs border border-green-100 flex items-center gap-2">
                          <span className="font-bold">{searchResult.vehicle_number}</span>
                          <span>in {searchResult.zone_name}</span>
                          <Button variant="ghost" size="icon" className="h-4 w-4 ml-1 hover:bg-green-100 rounded-full" onClick={() => setSearchResult(null)}>×</Button>
                        </div>
                      )}
                      <form onSubmit={handleSearch} className="flex gap-2">
                          <Input 
                              placeholder="Find Vehicle..." 
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="bg-white w-[180px] h-9 text-sm"
                          />
                          <Button type="submit" size="sm" className="bg-slate-900 text-white h-9 px-3">
                            <Search className="w-3.5 h-3.5" />
                          </Button>
                      </form>
                   </div>
                )}
             </div>
             
             <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-2">
                {zones.map((zone) => (
                  <ZoneCard key={zone.id} zone={zone} />
                ))}
             </div>
          </div>
        </div>
      </div>

      {/* Ticket Dialog (Police Only) */}
      {isAdmin && (
        <Dialog open={isTicketOpen} onOpenChange={setIsTicketOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Generate Parking Ticket</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="vehicle-no" className="text-right">Vehicle No.</Label>
                <Input id="vehicle-no" value={ticketData.vehicleNumber} onChange={(e) => setTicketData({ ...ticketData, vehicleNumber: e.target.value.toUpperCase() })} className="col-span-3" placeholder="KL-01-AB-1234" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="vehicle-type" className="text-right">Type</Label>
                <Select value={ticketData.type} onValueChange={(val: VehicleType) => setTicketData({ ...ticketData, type: val })}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light Vehicle (Car/Jeep)</SelectItem>
                    <SelectItem value="medium">Medium Vehicle (Van/Mini Bus)</SelectItem>
                    <SelectItem value="heavy">Heavy Vehicle (Bus/Truck)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="zone" className="text-right">Zone</Label>
                <Select value={ticketData.zoneId || "auto"} onValueChange={(val) => setTicketData({ ...ticketData, zoneId: val === "auto" ? "" : val })}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Auto-assign" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    <SelectItem value="auto">Auto-assign (Recommended)</SelectItem>
                    {zones.map((zone) => (
                      <SelectItem key={zone.id} value={zone.id}>{zone.name} ({zone.capacity - zone.occupied} free)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="slot" className="text-right">Slot (Opt)</Label>
                <Input id="slot" value={ticketData.slot} onChange={(e) => setTicketData({ ...ticketData, slot: e.target.value })} className="col-span-3" placeholder="e.g. A-12" />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" onClick={handleGenerateTicket} className="w-full">Confirm Entry</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}