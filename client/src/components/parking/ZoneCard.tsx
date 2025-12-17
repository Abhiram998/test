import { ParkingZone, useParking } from "@/lib/parking-context";
import { motion } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { MoreHorizontal, Car, Bus, Truck } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ZoneCard({ zone, detailed = false }: { zone: ParkingZone, detailed?: boolean }) {
  const { isAdmin } = useParking();
  const percentage = Math.round((zone.occupied / zone.capacity) * 100);
  const isFull = percentage >= 100;
  const isNearFull = percentage > 85;
  const [showVehicles, setShowVehicles] = useState(false);

  const getVehicleIcon = (type: string) => {
    switch(type) {
      case 'heavy': return <Bus className="w-4 h-4" />;
      case 'medium': return <Truck className="w-4 h-4" />;
      default: return <Car className="w-4 h-4" />;
    }
  };

  const CardContent = (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "group relative overflow-hidden rounded-lg border bg-card p-2 transition-all hover:shadow-md cursor-pointer",
        isFull ? "border-red-200 bg-red-50/30 dark:bg-red-900/10" : "border-border hover:border-primary/30"
      )}
    >
      <div className="flex justify-between items-center mb-1">
        <div className="flex items-center gap-1.5">
          <div className={cn(
            "h-5 w-5 rounded-md flex items-center justify-center text-[10px] font-bold border",
            isFull 
              ? "bg-destructive text-destructive-foreground border-destructive/20" 
              : "bg-primary/10 text-primary border-primary/10"
          )}>
            {zone.id}
          </div>
          <div>
            <h3 className="font-bold text-xs text-foreground leading-none whitespace-nowrap">{zone.name.replace('Nilakkal Parking Zone ', 'Parking Zone ')}</h3>
          </div>
        </div>
        
        <span className={cn(
          "text-[9px] font-bold px-1 py-0 rounded-full border",
          isFull 
            ? "bg-red-100 text-red-700 border-red-200" 
            : isNearFull 
              ? "bg-orange-100 text-orange-700 border-orange-200" 
              : "bg-green-100 text-green-700 border-green-200"
        )}>
          {isFull ? "FULL" : isNearFull ? "FAST" : "OPEN"}
        </span>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-[10px] items-end">
          <span className="text-muted-foreground font-medium truncate">Occ</span>
          <div className="flex items-baseline gap-0.5">
            <span className="font-bold tabular-nums text-foreground">{zone.occupied}</span>
            <span className="text-[9px] text-muted-foreground">/{zone.capacity}</span>
          </div>
        </div>
        <Progress value={percentage} className={cn(
          "h-1",
          isFull ? "bg-red-100 [&>div]:bg-red-500" : "bg-primary/10 [&>div]:bg-primary"
        )} />
      </div>

      {/* Vehicle List Dialog */}
      <Dialog open={showVehicles} onOpenChange={setShowVehicles}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Zone {zone.id} - Vehicles</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
             {zone.vehicles.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">No vehicles parked</div>
             ) : (
               <div className="space-y-2">
                 {zone.vehicles.map((v, i) => (
                   <div key={i} className="flex justify-between items-center p-3 rounded-lg border bg-card">
                     <div className="flex items-center gap-3">
                       <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${
                          v.type === 'heavy' ? 'bg-red-500' : v.type === 'medium' ? 'bg-amber-500' : 'bg-primary'
                        }`}>
                          {getVehicleIcon(v.type)}
                        </div>
                        <div>
                          <div className="font-mono font-bold text-sm">{v.number}</div>
                          <div className="text-xs text-muted-foreground">{v.ticketId}</div>
                        </div>
                     </div>
                     <div className="text-xs font-mono text-muted-foreground">
                        {v.entryTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                     </div>
                   </div>
                 ))}
               </div>
             )}
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );

  // Only link if not in detailed admin view (where interaction might be different)
  if (detailed) return CardContent;

  return (
    <Link href={`/zone/${zone.id}`}>
      {CardContent}
    </Link>
  );
}