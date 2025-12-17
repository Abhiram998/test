import { useParams, Link } from "wouter";
import { useParking } from "@/lib/parking-context";
import { ArrowLeft, Car, User, Truck, Bus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts";

export default function AreaDetails() {
  const { id } = useParams();
  const { zones, isAdmin } = useParking();
  const zone = zones.find(z => z.id === id);

  if (!zone) return <div>Zone not found</div>;

  const percentage = Math.round((zone.occupied / zone.capacity) * 100);
  const isFull = percentage >= 100;

  const vehicleTypeData = [
    { name: 'Light (Cars/Jeeps)', value: zone.stats.light, color: 'hsl(var(--primary))', icon: Car },
    { name: 'Medium (Vans/Minibus)', value: zone.stats.medium, color: '#f59e0b', icon: Truck }, // amber-500
    { name: 'Heavy (Buses/Trucks)', value: zone.stats.heavy, color: '#ef4444', icon: Bus }, // red-500
  ];

  const getVehicleIcon = (type: string) => {
    switch(type) {
      case 'heavy': return <Bus className="w-4 h-4" />;
      case 'medium': return <Truck className="w-4 h-4" />;
      default: return <Car className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Area {zone.id}</h1>
          <p className="text-muted-foreground">{zone.name}</p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-2xl font-bold">{zone.capacity}</div>
            <div className="text-xs text-muted-foreground uppercase">Total</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center border-primary/20 bg-primary/5">
            <div className="text-2xl font-bold text-primary">{zone.occupied}</div>
            <div className="text-xs text-muted-foreground uppercase">Occupied</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center border-green-500/20 bg-green-500/5">
            <div className="text-2xl font-bold text-green-600">{zone.capacity - zone.occupied}</div>
            <div className="text-xs text-muted-foreground uppercase">Vacant</div>
          </CardContent>
        </Card>
      </div>

      {/* Vehicle Type Breakdown */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Vehicle Classification</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="h-[180px] w-[180px] relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={vehicleTypeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {vehicleTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                <span className="text-2xl font-bold">{zone.occupied}</span>
                <span className="text-[10px] text-muted-foreground uppercase">Vehicles</span>
              </div>
            </div>
            <div className="space-y-4 flex-1 ml-6">
              {vehicleTypeData.map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-sm font-medium">{item.name}</span>
                  </div>
                  <span className="font-bold font-mono">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Live Slot Map</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Occupancy Level</span>
                <span className="font-bold">{percentage}%</span>
              </div>
              <Progress value={percentage} className={`h-4 ${isFull ? "bg-red-100 [&>div]:bg-red-500" : "bg-primary/10 [&>div]:bg-primary"}`} />
            </div>

            <div className="grid grid-cols-5 sm:grid-cols-8 gap-2">
               {Array.from({ length: zone.capacity }).map((_, i) => (
                 <div 
                   key={i}
                   className={`aspect-square rounded-sm flex items-center justify-center text-[10px] font-mono transition-all border ${
                     i < zone.occupied 
                       ? "bg-slate-100 border-slate-200 dark:bg-slate-800 dark:border-slate-700 text-muted-foreground" 
                       : "bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                   }`}
                   title={i < zone.occupied ? "Occupied" : `Slot ${i+1} Free`}
                 >
                   {i < zone.occupied ? (
                     // If occupied, try to show type icon based on vehicle index if available
                     // Simplified matching for mockup since slots aren't 1:1 mapped to vehicle array indices strictly in this simple model
                     // We'll just map the first N vehicles to the first N slots
                     zone.vehicles[i] ? getVehicleIcon(zone.vehicles[i].type) : <Car className="w-3 h-3" />
                   ) : (
                     i+1
                   )}
                 </div>
               ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Vehicle List - Only visible to Admin */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Car className="w-5 h-5" />
              Parked Vehicles List
            </CardTitle>
          </CardHeader>
          <CardContent>
            {zone.vehicles.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No vehicles currently parked in this zone.
              </div>
            ) : (
              <div className="divide-y">
                {zone.vehicles.map((v, i) => (
                  <div key={i} className="py-3 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${
                        v.type === 'heavy' ? 'bg-red-500' : v.type === 'medium' ? 'bg-amber-500' : 'bg-primary'
                      }`}>
                        {getVehicleIcon(v.type)}
                      </div>
                      <div>
                        <div className="font-mono font-medium">{v.number}</div>
                        <div className="flex gap-2 items-center">
                          <span className="text-xs text-muted-foreground">Ticket: {v.ticketId}</span>
                          <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded border ${
                            v.type === 'heavy' ? 'border-red-200 bg-red-50 text-red-700' : 
                            v.type === 'medium' ? 'border-amber-200 bg-amber-50 text-amber-700' : 
                            'border-blue-200 bg-blue-50 text-blue-700'
                          }`}>
                            {v.type}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground font-mono">
                      {v.entryTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}