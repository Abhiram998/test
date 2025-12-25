import { useEffect, useState } from "react";
import { useParking } from "@/lib/parking-context";
import PoliceBackup, { VehicleRecord } from "@/components/PoliceBackup";
import { Link } from "wouter";
import { ArrowLeft, Database, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiGet, apiPost } from "@/lib/api";
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
      const data = await apiGet<SnapshotMeta[]>("/api/snapshots");
      setSnapshots(data);
    } catch {
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

  /* ================= SAVE SNAPSHOT (BACKEND) ================= */

  const saveSnapshot = async () => {
    setLoading(true);
    try {
      await apiPost("/api/snapshot", {});
      toast({
        title: "Snapshot saved",
        description: "Parking data backed up successfully",
      });
      loadSnapshots();
    } catch {
      toast({
        variant: "destructive",
        title: "Snapshot failed",
        description: "Could not save snapshot",
      });
    } finally {
      setLoading(false);
    }
  };

  /* ================= GET RECORDS (FOR RESTORE) ================= */

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
      {/* HEADER */}
      <div className="flex items-center gap-4 mb-2">
        <Link href="/admin">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>

        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="w-6 h-6" />
            System Backup
          </h1>
          <p className="text-muted-foreground">
            Manage local backups and data restoration.
          </p>
        </div>
      </div>

      {/* BACKUP PANEL (Restored to Original Dark Style) */}
      <div className="bg-black p-6 rounded-lg shadow-xl border border-zinc-800 space-y-4">
        
        <div className="flex flex-col gap-2">
          {/* THE ONLY SAVE SNAPSHOT BUTTON */}
          <Button
            onClick={saveSnapshot}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 w-fit text-white"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : null}
            {loading ? "Processing..." : "Save Snapshot"}
          </Button>

          {/* SNAPSHOT LIST STATUS */}
          <div className="text-sm text-zinc-400">
            {snapshots.length === 0
              ? "No backups available"
              : `${snapshots.length} backups available`}
          </div>
        </div>

        {/* Divider to separate Save from Restore */}
        <hr className="border-zinc-800" />

        {/* RESTORE PANEL */}
        <div className="pt-2">
          <PoliceBackup
            getRecords={getRecords}
            onRestore={restoreData}
            appName="nilakkal-police-admin"
          />
        </div>
      </div>
    </div>
  );
}