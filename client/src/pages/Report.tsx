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
  id: number;
  snapshot_time: string;
  zone_id: string;
  zone_name: string;
  capacity: number;
  occupied: number;
  heavy: number;
  medium: number;
  light: number;
};

/* ================= COMPONENT ================= */

export default function Report() {
  const { toast } = useToast();

  const [date, setDate] = useState<Date | undefined>(new Date());
  const [selectedZoneId, setSelectedZoneId] = useState("all");
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [reportType, setReportType] = useState<"daily" | "monthly" | "yearly">("daily");


  /* ================= FETCH REPORTS ================= */

useEffect(() => {
  if (!date) return;

  setLoading(true);

  let url = "";

  if (reportType === "daily") {
    url = `/api/reports?date=${format(date, "yyyy-MM-dd")}`;
  }

  if (reportType === "monthly") {
    url = `/api/reports/monthly?year=${date.getFullYear()}&month=${date.getMonth() + 1}`;
  }

  if (reportType === "yearly") {
    url = `/api/reports/yearly?year=${date.getFullYear()}`;
  }

  apiGet<ReportRow[]>(url)
    .then(setReports)
    .catch(() => {
      toast({
        variant: "destructive",
        title: "Failed to load report",
        description: "Could not fetch report data from server",
      });
    })
    .finally(() => setLoading(false));
}, [date, reportType]);

  /* ================= FILTER ================= */

  const filteredReports = reports.filter(
    (r) => selectedZoneId === "all" || r.zone_id === selectedZoneId
  );

  /* ================= DOWNLOAD ================= */

  const downloadCSV = (rows: ReportRow[], filename: string) => {
    const header =
      "Zone,Capacity,Occupied,Heavy,Medium,Light,Snapshot Time\n";

    const body = rows
      .map(
        (r) =>
          `${r.zone_name},${r.capacity},${r.occupied},${r.heavy},${r.medium},${r.light},${r.snapshot_time}`
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
      filteredReports,
      `parking_report_${format(new Date(), "yyyy-MM-dd")}.csv`
    );

    toast({
      title: "Report downloaded",
      description: "Current report CSV generated",
    });
  };

  const handleDownloadFiltered = () => {
    if (!date) return;

    downloadCSV(
      filteredReports,
      `parking_report_${selectedZoneId}_${format(date, "yyyy-MM-dd")}.csv`
    );

    toast({
      title: "Filtered report downloaded",
      description: "Custom report CSV generated",
    });
  };

  /* ================= UNIQUE ZONES ================= */

  const uniqueZones = Array.from(
    new Map(reports.map((r) => [r.zone_id, r.zone_name]))
  );

  /* ================= UI ================= */

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">
            Generate and download parking analytics.
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
            Select zone and date to view specific records.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 items-end">
            {/* ZONE */}
            <div className="grid w-full md:w-[200px] gap-2">
              <label className="text-sm font-medium">Zone</label>
              <Select
                value={selectedZoneId}
                onValueChange={setSelectedZoneId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Zone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Zones</SelectItem>
                  {uniqueZones.map(([id, name]) => (
                    <SelectItem key={id} value={id}>
                      {name}
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

            <Button
              variant="secondary"
              onClick={handleDownloadFiltered}
              className="gap-2"
            >
              <FileText className="w-4 h-4" />
              Download Selected
            </Button>
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
          ) : filteredReports.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
              No records found for the selected criteria
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-4">#</th>
                    <th className="p-4">Zone</th>
                    <th className="p-4">Capacity</th>
                    <th className="p-4">Occupied</th>
                    <th className="p-4">Heavy</th>
                    <th className="p-4">Medium</th>
                    <th className="p-4">Light</th>
                    <th className="p-4 text-right">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReports.map((r, i) => (
                    <tr key={r.id} className="border-b">
                      <td className="p-4">{i + 1}</td>
                      <td className="p-4 font-medium">{r.zone_name}</td>
                      <td className="p-4">{r.capacity}</td>
                      <td className="p-4">{r.occupied}</td>
                      <td className="p-4">{r.heavy}</td>
                      <td className="p-4">{r.medium}</td>
                      <td className="p-4">{r.light}</td>
                      <td className="p-4 text-right font-mono">
                        {new Date(r.snapshot_time).toLocaleTimeString()}
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
