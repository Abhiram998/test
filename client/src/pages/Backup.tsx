import { useParking } from "@/lib/parking-context";
import PoliceBackup, { VehicleRecord } from "@/components/PoliceBackup";
import { Link } from "wouter";
import { ArrowLeft, Database } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Backup() {
  const { zones, restoreData } = useParking();

  // Helper for PoliceBackup
  const getRecords = (): VehicleRecord[] => {
    return zones.flatMap(z => z.vehicles.map(v => ({
      plate: v.number,
      zone: z.name,
      timeIn: v.entryTime.toISOString(),
      timeOut: null 
    })));
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-4 mb-2">
        <Link href="/admin">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Database className="w-6 h-6" />
            System Backup
          </h1>
          <p className="text-muted-foreground">Manage local backups and data restoration.</p>
        </div>
      </div>

      <div className="bg-black p-6 rounded-lg shadow-xl border border-border">
         <PoliceBackup 
          getRecords={getRecords} 
          onRestore={restoreData} 
          appName="nilakkal-police-admin" 
        />
      </div>
    </div>
  );
}
