import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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
import { format } from "date-fns";
import {
  Calendar as CalendarIcon,
  Download,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

/* ================= TYPES ================= */

type ReportRow = {
  ticketId: string;
  vehicle: string;
  type: "Light" | "Medium" | "Heavy";
  zone: string;
  entryTime: string;
  exitTime: string | null;
};

/* ================= COMPONENT ================= */

export default function Report() {
  const { toast } = useToast();

  const [date, setDate] = useState<Date | undefined>(new Date());
  const [selectedZone, setSelectedZone] = useState<string>("All Zones");
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);

  /* ================= FETCH REPORTS ================= */

  useEffect(() => {
    if (!date) return;

    setLoading(true);

    const params = new URLSearchParams();
    params.append("report_date", format(date, "yyyy-MM-dd"));

    if (selectedZone !== "All Zones") {
      params.append("zone", selectedZone);
    }

    apiGet<ReportRow[]>(`/api/reports?${params.toString()}`)
      .then(setReports)
      .catch(() => {
        toast({
          variant: "destructive",
          title: "Failed to load report",
          description: "Could not fetch report data from server",
        });
      })
      .finally(() => setLoading(false));
  }, [date, selectedZone]);

  /* ================= CSV DOWNLOAD ================= */

  const downloadCSV = (rows: ReportRow[], filename: string) => {
    const header =
      "Ticket ID,Vehicle,Type,Zone,Entry Time,Exit Time\n";

    const body = rows
      .map(
        (r) =>
          `${r.ticketId},${r.vehicle},${r.type},${r.zone},${r.entryTime},${r.exitTime ?? ""}`
      )
      .join("\n");

    const csv = "data:text/csv;charset=utf-8," + header + body;
    const uri = encodeURI(csv);

    const link = document.createElement("a");
    link.href = uri;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadCurrent = () => {
    downloadCSV(
      reports,
      `parking_report_${format(new Date(), "yyyy-MM-dd")}.csv`
    );

    toast({
      title: "Report downloaded",
      description: "Current report CSV generated",
    });
  };

  /* ================= UNIQUE ZONES ================= */

  const uniqueZones = Array.from(
    new Set(reports.map((r) => r.zone))
  );

  /* ================= UI ================= */

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">
            Vehicle entry & exit history.
          </p>
        </div>

        <Button onClick={handleDownloadCurrent} className="gap-2">
          <Download className="w-4 h-4" />
          Download Current Report
        </Button>
      </div>

      {/* FILTER */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Reports</CardTitle>
          <CardDescription>
            Filter by zone and entry date.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 items-end">
            {/* ZONE */}
            <div className="grid w-full md:w-[200px] gap-2">
              <label className="text-sm font-medium">Zone</label>
              <Select value={selectedZone} onValueChange={setSelectedZone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All Zones">All Zones</SelectItem>
                  {uniqueZones.map((z) => (
                    <SelectItem key={z} value={z}>
                      {z}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* DATE */}
            <div className="grid w-full md:w-[240px] gap-2">
              <label className="text-sm font-medium">Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PREVIEW */}
      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="text-center py-12">Loading report...</div>
          ) : reports.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
              No records found for the selected criteria
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-4">#</th>
                    <th className="p-4">Ticket</th>
                    <th className="p-4">Vehicle</th>
                    <th className="p-4">Type</th>
                    <th className="p-4">Zone</th>
                    <th className="p-4">Entry Time</th>
                    <th className="p-4">Exit Time</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r, i) => (
                    <tr key={r.ticketId} className="border-b">
                      <td className="p-4">{i + 1}</td>
                      <td className="p-4 font-mono">{r.ticketId}</td>
                      <td className="p-4">{r.vehicle}</td>
                      <td className="p-4">{r.type}</td>
                      <td className="p-4">{r.zone}</td>
                      <td className="p-4 font-mono">
                        {new Date(r.entryTime).toLocaleString()}
                      </td>
                      <td className="p-4 font-mono">
                        {r.exitTime
                          ? new Date(r.exitTime).toLocaleString()
                          : "Inside"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
