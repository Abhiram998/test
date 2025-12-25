import { useEffect, useState } from "react";
import { useParking } from "@/lib/parking-context";
import PoliceBackup, { VehicleRecord } from "@/components/PoliceBackup";
import { Link } from "wouter";
import { ArrowLeft, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiGet } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

/* ================= TYPES ================= */

type SnapshotMeta = {
  snapshot_time: string;
  records: number;
};

/* ================= COMPONENT ================= */

export default function Backup() {
  const { restoreData } = useParking();
  const { toast } = useToast();

  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([]);
  const [loading, setLoading] = useState(false);

  /* ================= FETCH SNAPSHOT LIST ================= */

  const loadSnapshots = async () => {
    setLoading(true);
    try {
      // Fetches history to display the count in the black header
      const data = await apiGet<SnapshotMeta[]>("/api/snapshots");
      if (data && Array.isArray(data)) {
        setSnapshots(data);
      } else {
        setSnapshots([]);
      }
    } catch (err) {
      // This handles the server sync error specifically
      toast({
        variant: "destructive",
        title: "Failed to load backups",
        description: "Could not fetch snapshot history from server",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSnapshots();
  }, []);

  /* ================= GET RECORDS (FOR RESTORE) ================= */
  /**
   * This function is passed to PoliceBackup. 
   * It fetches the data that will be used to restore the system state.
   */
  const getRecords = async (): Promise<VehicleRecord[]> => {
    const today = new Date().toISOString().slice(0, 10);
    const rows = await apiGet<any[]>(`/api/reports?date=${today}`);

    return rows.map((r) => ({
      plate: `SNAP-${r.zone_id}`,
      zone: r.zone_name,
      timeIn: r.snapshot_time,
      timeOut: null,
      type:
        r.heavy > 0
          ? "heavy"
          : r.medium > 0
          ? "medium"
          : "light",
    }));
  };

  /* ================= UI ================= */

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* HEADER SECTION */}
      <div className="flex items-center gap-4 mb-2">
        <Link href="/admin">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>

        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="w-6 h-6 text-blue-500" />
            System Backup
          </h1>
          <p className="text-muted-foreground text-sm">
            Manage local backups and data restoration.
          </p>
        </div>
      </div>

      {/* PRIMARY BACKUP PANEL (The "Black Box") */}
      <div className="bg-black p-6 rounded-lg shadow-xl border border-zinc-800 space-y-4">
        
        {/* SNAPSHOT COUNTER 
            The first button was removed from here to keep the UI clean 
        */}
        <div className="text-sm text-zinc-400 font-medium">
          {loading ? (
            "Syncing with server..."
          ) : snapshots.length === 0 ? (
            "No backups available"
          ) : (
            `${snapshots.length} backups available`
          )}
        </div>

        {/* RESTORE & SNAPSHOT HUB
            PoliceBackup component handles the "Save Snapshot" and "Quick Recovery" 
            internally, ensuring there is only ONE button for each action.
        */}
        <div className="pt-2">
          <PoliceBackup
            getRecords={getRecords}
            onRestore={restoreData}
            appName="nilakkal-police-admin"
          />
        </div>
      </div>

      {/* FOOTER INFO */}
      <p className="text-[11px] text-zinc-500 px-2 italic">
        * Snapshots are stored securely on the central server and can be used to recover the system in case of local data loss.
      </p>
    </div>
  );
}