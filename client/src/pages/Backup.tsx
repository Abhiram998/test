import { useEffect, useState } from "react";
import { useParking } from "@/lib/parking-context";
import PoliceBackup, { VehicleRecord } from "@/components/PoliceBackup";
import { Link } from "wouter";
import { ArrowLeft, Database, Clock, ShieldCheck, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiGet, apiPost } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
    <div className="space-y-6 max-w-6xl mx-auto p-4 animate-in fade-in duration-500">
      
      {/* HEADER - No Save Button here anymore */}
      <div className="flex items-center gap-4">
        <Link href="/admin">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>

        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Database className="w-8 h-8 text-blue-600" />
            System Integrity
          </h1>
          <p className="text-muted-foreground text-sm">
            Securely capture and restore system states for Nilakkal Parking.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card className="border-slate-200 shadow-lg overflow-hidden">
          <CardHeader className="bg-slate-50 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                <CardTitle>Police State Hub</CardTitle>
              </div>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                {snapshots.length} Snapshots Available
              </Badge>
            </div>
            <CardDescription>
              Perform manual snapshots or use Quick Recovery to restore the parking state.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* SNAPSHOT CREATION SECTION */}
              <div className="p-6 border rounded-2xl bg-white hover:border-blue-200 transition-all group">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-blue-50 rounded-xl group-hover:bg-blue-100 transition-colors">
                    <Download className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">Create Snapshot</h3>
                <p className="text-sm text-slate-500 mb-6">
                  Save a point-in-time image of all active parking zones and vehicle records.
                </p>
                <Button 
                  onClick={saveSnapshot} 
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white h-11 shadow-md shadow-blue-100"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  Save New Snapshot
                </Button>
              </div>

              {/* RESTORE / POLICE BACKUP COMPONENT SECTION */}
              <div className="p-6 border rounded-2xl bg-slate-50 border-dashed border-slate-300">
                <h3 className="text-lg font-bold text-slate-800 mb-2">Quick Recovery</h3>
                <p className="text-sm text-slate-500 mb-6">
                  Restore the system to a previously captured snapshot.
                </p>
                
                {/* The PoliceBackup component handles the "Restore" logic internally.
                  We pass our custom fetcher and the global restore function.
                */}
                <PoliceBackup
                  getRecords={getRecords}
                  onRestore={restoreData}
                  appName="nilakkal-police-admin"
                />
              </div>
            </div>

            {/* STATUS FOOTER */}
            <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-100/50 p-4 rounded-xl border border-slate-100">
              <Clock className="w-4 h-4" />
              <span>
                {snapshots.length > 0 
                  ? `Last available backup: ${snapshots[0].snapshot_time}` 
                  : "No manual snapshots found in current session."}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}