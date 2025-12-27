import { useEffect, useState } from "react";
import PoliceBackup, { VehicleRecord } from "@/components/PoliceBackup";
import { Link } from "wouter";
import { ArrowLeft, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiGet } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useParking } from "@/lib/parking-context";

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
      const data = await apiGet<SnapshotMeta[]>("/api/snapshots");
      if (data && Array.isArray(data)) {
        setSnapshots(data);
      }
    } catch (err) {
      console.error("Backup Sync Error:", err);
      toast({
        variant: "destructive",
        title: "Sync Error",
        description: "Could not fetch snapshot history from server.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSnapshots();
  }, []);

  /* ================= GET RECORDS (FOR QUICK RECOVERY) ================= */
  /* NOTE: This does NOT overwrite DB — used only for inspection */

  const getRecords = async (): Promise<VehicleRecord[]> => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const rows = await apiGet<any[]>(`/api/reports?report_date=${today}`);

      if (!rows || !Array.isArray(rows)) return [];

      return rows
        .filter((r) => r.status === "INSIDE")
        .map((r) => ({
          plate: r.vehicle,
          zone: r.zone,
          timeIn: r.entryTime,
          timeOut: null,
          type: r.type.toLowerCase() as "light" | "medium" | "heavy",
        }));
    } catch (error) {
      console.error("Quick Recovery Fetch Failed:", error);
      toast({
        variant: "destructive",
        title: "Recovery Error",
        description: "Failed to fetch recovery data from server.",
      });
      return [];
    }
  };

  /* ================= RESTORE LIVE DATA ================= */
  /* Restores data ONLY to frontend state */

  const restoreLiveData = (records: VehicleRecord[]) => {
    restoreData(records);

    toast({
      title: "Data Restored",
      description: `Loaded ${records.length} vehicle records into dashboard.`,
    });
  };

  /* ================= ACTIVATE SNAPSHOT VIEW ================= */
  /* Backend-only feature (kept for future use) */

  const activateSnapshotView = async (snapshotId: number) => {
    try {
      await fetch(`/api/snapshot/view/${snapshotId}`, {
        method: "POST",
      });

      toast({
        title: "Snapshot Activated",
        description: "System is now showing backup snapshot data.",
      });
    } catch (err) {
      console.error("Snapshot activation failed:", err);
      toast({
        variant: "destructive",
        title: "Restore Failed",
        description: "Could not activate snapshot view.",
      });
    }
  };

  /* ================= UI ================= */

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* HEADER */}
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

      {/* BACKUP PANEL - Dark UI */}
      <div className="bg-black p-6 rounded-lg shadow-xl border border-zinc-800 space-y-4">
        <div className="text-sm text-zinc-400 font-medium">
          {loading ? (
            "Syncing snapshot history..."
          ) : snapshots.length === 0 ? (
            "No backups available"
          ) : (
            `${snapshots.length} automatic snapshots available on server`
          )}
        </div>

        <div className="pt-2">
          <PoliceBackup
            getRecords={getRecords}
            onRestore={restoreLiveData}
            // onSnapshotRestore={activateSnapshotView} 
            // ↑ intentionally kept commented (prop not supported yet)
            appName="nilakkal-police-admin"
          />
        </div>
      </div>

      <p className="text-[11px] text-zinc-500 px-2 italic">
        * Snapshots are created automatically on every entry/exit and stored securely on the central server.
      </p>
    </div>
  );
}
