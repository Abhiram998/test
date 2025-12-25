import { useEffect, useState } from "react";
import { format, isValid } from "date-fns";
import { 
  Calendar as CalendarIcon, 
  Download, 
  Loader2, 
  History, 
  SearchX, 
  Clock,
  LogOut
} from "lucide-react";

import { apiGet, apiPost } from "@/lib/api";
import { useParking } from "@/lib/parking-context";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/* ================= TYPES ================= */
type ReportRow = {
  ticketId: string;
  vehicle: string;
  type: "Light" | "Medium" | "Heavy";
  zone: string;
  entryTime: string;
  exitTime: string | null;
  status: "INSIDE" | "EXITED";
};

export default function Report() {
  const { toast } = useToast();
  const { zones, refreshData } = useParking(); // Added refreshData to sync dashboard counts

  const [date, setDate] = useState<Date | undefined>(new Date());
  const [selectedZone, setSelectedZone] = useState<string>("all");
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingExit, setProcessingExit] = useState<string | null>(null);

  /* ================= FETCH LOGIC ================= */
  const fetchReports = async () => {
    if (!date) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("report_date", format(date, "yyyy-MM-dd"));
      if (selectedZone !== "all") params.append("zone", selectedZone);

      const data = await apiGet<ReportRow[]>(`/api/reports?${params.toString()}`);
      setReports(data);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Network Error",
        description: "Could not retrieve history logs.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [date, selectedZone]);

  /* ================= EXIT ACTION ================= */
  const handleExit = async (ticketId: string) => {
    setProcessingExit(ticketId);
    try {
      await apiPost("/api/exit", { ticket_code: ticketId });
      toast({
        title: "Vehicle Exited",
        description: `Ticket ${ticketId} has been closed successfully.`,
      });
      // Refresh both the local report list and the global parking context
      fetchReports();
      if (refreshData) refreshData();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Exit Failed",
        description: "Could not process vehicle exit. Please try again.",
      });
    } finally {
      setProcessingExit(null);
    }
  };

  /* ================= HELPERS ================= */
  const formatTime = (isoString: string | null) => {
    if (!isoString) return "—";
    const d = new Date(isoString);
    return isValid(d) ? format(d, "hh:mm a") : "Invalid Date";
  };

  const exportToCSV = () => {
    const headers = "Index,Ticket ID,Vehicle,Type,Zone,Entry Time,Exit Time,Status\n";
    const csvContent = reports.map((r, i) => 
      `${i + 1},${r.ticketId},${r.vehicle},${r.type},${r.zone},${r.entryTime},${r.exitTime || ""},${r.status}`
    ).join("\n");

    const blob = new Blob([headers + csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Parking_Report_${format(date || new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 animate-in fade-in duration-500">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <History className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Vehicle History</h1>
            <p className="text-muted-foreground text-sm">
              Auditing activity for {date ? format(date, "PPP") : "Selected Date"}
            </p>
          </div>
        </div>
        <Button 
          onClick={exportToCSV} 
          disabled={reports.length === 0} 
          variant="outline"
          className="bg-background shadow-sm"
        >
          <Download className="w-4 h-4 mr-2" /> Export CSV
        </Button>
      </div>

      {/* FILTER CONTROLS */}
      <Card className="border-primary/5 shadow-sm">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-6 items-end">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Parking Zone</label>
              <Select value={selectedZone} onValueChange={setSelectedZone}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All Zones" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Zones</SelectItem>
                  {zones.map((z) => (
                    <SelectItem key={z.id} value={z.id}>{z.name} ({z.id})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Report Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[240px] justify-start text-left font-normal", !date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : "Select a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* DATA TABLE */}
      <Card className="border-primary/5 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-4">
              <Loader2 className="w-10 h-10 animate-spin text-primary/40" />
              <p className="text-sm text-muted-foreground font-medium animate-pulse">Syncing records...</p>
            </div>
          ) : reports.length === 0 ? (
            <div className="py-32 text-center flex flex-col items-center gap-4">
              <SearchX className="w-12 h-12 text-muted-foreground/20" />
              <h3 className="text-lg font-semibold">No activity found</h3>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="p-4 text-left font-semibold w-12 text-muted-foreground">#</th>
                    <th className="p-4 text-left font-semibold">Ticket ID</th>
                    <th className="p-4 text-left font-semibold">Vehicle No.</th>
                    <th className="p-4 text-center font-semibold">Type</th>
                    <th className="p-4 text-center font-semibold">Zone</th>
                    <th className="p-4 text-right font-semibold">Entry Time</th>
                    <th className="p-4 text-right font-semibold">Exit Time</th>
                    <th className="p-4 text-center font-semibold">Status</th>
                    <th className="p-4 text-center font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {reports.map((r, index) => (
                    <tr key={r.ticketId} className="hover:bg-muted/30 transition-colors group">
                      <td className="p-4 text-muted-foreground font-mono text-xs">{index + 1}</td>
                      <td className="p-4 font-mono text-xs font-bold text-primary tracking-tight">{r.ticketId}</td>
                      <td className="p-4 font-semibold uppercase tracking-wider">{r.vehicle}</td>
                      <td className="p-4 text-center"><Badge variant="outline" className="text-[10px] font-bold uppercase">{r.type}</Badge></td>
                      <td className="p-4 text-center font-medium">{r.zone}</td>
                      <td className="p-4 text-right font-mono text-[11px] text-muted-foreground">{formatTime(r.entryTime)}</td>
                      <td className="p-4 text-right font-mono text-[11px] text-muted-foreground">{formatTime(r.exitTime)}</td>
                      <td className="p-4 text-center">
                        <Badge className={cn("rounded px-2 py-0.5 text-[10px] font-bold border-0", r.status === "INSIDE" ? "bg-emerald-100 text-emerald-700 shadow-sm" : "bg-slate-100 text-slate-600")}>
                          {r.status}
                        </Badge>
                      </td>
                      <td className="p-4 text-center">
                        {r.status === "INSIDE" ? (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleExit(r.ticketId)}
                            disabled={processingExit === r.ticketId}
                          >
                            {processingExit === r.ticketId ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <><LogOut className="h-3 w-3 mr-1" /> Exit</>
                            )}
                          </Button>
                        ) : (
                          <span className="text-[10px] text-muted-foreground uppercase font-bold">Closed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 text-[11px] text-muted-foreground bg-muted/20 p-3 rounded-lg border border-dashed">
        <Clock className="w-3.5 h-3.5" />
        Note: Records include vehicles present during any point of the 24-hour period of the selected date.
      </div>
    </div>
  );
}