import { ParkingZone, useParking } from "@/lib/parking-context";
import { motion } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { Car, Bus, Truck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState } from "react";

export function ZoneCard({
  zone,
  displayIndex,
  detailed = false,
}: {
  zone: ParkingZone;
  displayIndex?: number; // ✅ UI ONLY
  detailed?: boolean;
}) {
  const { isAdmin } = useParking();

  const percentage = Math.round((zone.occupied / zone.capacity) * 100);
  const isFull = percentage >= 100;
  const isNearFull = percentage > 85;

  const [showVehicles, setShowVehicles] = useState(false);

  // ✅ SAFE FALLBACK
  const vehicles = zone.vehicles ?? [];

  const getVehicleIcon = (type: string) => {
    switch (type) {
      case "heavy":
        return <Bus className="w-4 h-4" />;
      case "medium":
        return <Truck className="w-4 h-4" />;
      default:
        return <Car className="w-4 h-4" />;
    }
  };

  // ================= CARD CONTENT =================
  const CardContent = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "group relative overflow-hidden rounded-lg border bg-card p-2 transition-all hover:shadow-md cursor-pointer",
        isFull
          ? "border-red-200 bg-red-50/30"
          : "border-border hover:border-primary/30"
      )}
    >
      {/* HEADER */}
      <div className="flex justify-between items-center mb-1">
        <div className="flex items-center gap-1.5">
          <div
            className={cn(
              "h-5 w-5 rounded-md flex items-center justify-center text-[10px] font-bold border",
              isFull
                ? "bg-red-500 text-white border-red-200"
                : "bg-primary/10 text-primary border-primary/10"
            )}
          >
            {/* ✅ UI LABEL ONLY — NEVER USED FOR ROUTING */}
            {displayIndex !== undefined ? `Z${displayIndex}` : zone.id}
          </div>

          <h3 className="font-bold text-xs text-foreground whitespace-nowrap">
            {zone.name.replace("Nilakkal Parking Zone ", "Parking Zone ")}
          </h3>
        </div>

        <span
          className={cn(
            "text-[9px] font-bold px-1 py-0 rounded-full border",
            isFull
              ? "bg-red-100 text-red-700 border-red-200"
              : isNearFull
              ? "bg-orange-100 text-orange-700 border-orange-200"
              : "bg-green-100 text-green-700 border-green-200"
          )}
        >
          {isFull ? "FULL" : isNearFull ? "FAST" : "OPEN"}
        </span>
      </div>

      {/* OCCUPANCY */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] items-end">
          <span className="text-muted-foreground font-medium">Occ</span>
          <div className="flex items-baseline gap-0.5">
            <span className="font-bold">{zone.occupied}</span>
            <span className="text-[9px] text-muted-foreground">
              /{zone.capacity}
            </span>
          </div>
        </div>

        <Progress
          value={percentage}
          className={cn(
            "h-1",
            isFull
              ? "bg-red-100 [&>div]:bg-red-500"
              : "bg-primary/10 [&>div]:bg-primary"
          )}
        />
      </div>

      {/* VEHICLE LIST DIALOG */}
      <Dialog open={showVehicles} onOpenChange={setShowVehicles}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Zone {displayIndex !== undefined ? `Z${displayIndex}` : zone.id} –
              Vehicles
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-2 mt-4">
            {vehicles.length === 0 ? (
              <div className="text-center text-muted-foreground">
                No vehicles parked
              </div>
            ) : (
              vehicles.map((v, i) => (
                <div
                  key={i}
                  className="flex justify-between items-center p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${
                        v.type === "heavy"
                          ? "bg-red-500"
                          : v.type === "medium"
                          ? "bg-amber-500"
                          : "bg-primary"
                      }`}
                    >
                      {getVehicleIcon(v.type)}
                    </div>

                    <div>
                      <div className="font-mono font-bold text-sm">
                        {v.number}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {v.ticketId}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );

  // ================= RENDER =================
  if (detailed) return CardContent;

  // ✅ ALWAYS USE BACKEND ZONE ID FOR ROUTING
  return <Link href={`/zone/${zone.id}`}>{CardContent}</Link>;
}
