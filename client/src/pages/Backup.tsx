import { useEffect, useState } from "react";
import { useParking } from "@/lib/parking-context";
import PoliceBackup, { VehicleRecord } from "@/components/PoliceBackup";
import { Link } from "wouter";
import { ArrowLeft, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiGet, apiPost } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

type SnapshotMeta = {
  snapshot_time: string;
  records: number;
};

export default function Backup() {
  const { zones, restoreData } = useParking();
  const { toast } = useToast();

  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([]);
  const [loading, setLoading] = useState(false);

  /* ================= FETCH SNAPSHOTS ================= */

  const loadSnapshots = () => {
    setLoading(true);
    apiGet<SnapshotMeta[]>("/api/snapshots")
      .then(setSnapshots)
      .catch(() => {
        toast({
          variant: "destructive",
          title: "Failed to load backups",
          description: "Could not fetch snapshot history from server",
        });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSnapshots();
  }, []);

  /* ================= SAVE SNAPSHOT ================= */

  const saveSnapshot = async () => {
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
    }
  };

  /* ================= RECORDS (LIVE DATA) ================= */

  const getRecords = (): VehicleRecord[] => {
    return zones.flatMap((z) =>
      z.vehicles.map((v) => ({
        plate: v.number,
        zone: z.name,
        timeIn: new Date(v.entryTime).toISOString(),
        timeOut: null,
      }))
    );
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
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Database className="w-6 h-6" />
            System Backup
          </h1>
          <p className="text-muted-foreground">
            Manage local backups and data restoration.
          </p>
        </div>
      </div>

      {/* BACKUP PANEL */}
      <div className="bg-black p-6 rounded-lg shadow-xl border border-border">
        <PoliceBackup
          getRecords={getRecords}
          onRestore={restoreData}
          appName="nilakkal-police-admin"
          snapshots={snapshots}
          loading={loading}
          onSaveSnapshot={saveSnapshot}
        />
      </div>
    </div>
  );
}
