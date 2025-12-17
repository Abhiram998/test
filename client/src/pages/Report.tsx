import { useState } from "react";
import { useParking } from "@/lib/parking-context";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Download, FileText, Bus, Truck, Car } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export default function Report() {
  const { zones } = useParking();
  const { toast } = useToast();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [selectedZoneId, setSelectedZoneId] = useState<string>("all");

  const getVehicleIcon = (type: string) => {
    switch(type) {
      case 'heavy': return <Bus className="w-4 h-4" />;
      case 'medium': return <Truck className="w-4 h-4" />;
      default: return <Car className="w-4 h-4" />;
    }
  };

  // Flatten all vehicles from all zones
  const allVehicles = zones.flatMap(zone => 
    zone.vehicles.map(v => ({ ...v, zoneName: zone.name, zoneId: zone.id }))
  );

  // Filter based on selection
  const filteredVehicles = allVehicles.filter(v => {
    const matchesZone = selectedZoneId === "all" || v.zoneId === selectedZoneId;
    // For mockup, we assume all current vehicles are "today". 
    // In a real app, we'd compare v.entryTime with selected date.
    // Here we'll just simulate it: if user picks today, show all. If another day, show none/mock.
    const isToday = date && format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
    
    return matchesZone && isToday;
  });

  const handleDownloadCurrent = () => {
    toast({
      title: "Downloading Current Report...",
      description: `Generating report for ${format(new Date(), "PPP p")}`,
    });
    // Simulate download delay
    setTimeout(() => {
        const csvContent = "data:text/csv;charset=utf-8," 
            + "Zone,Type,Vehicle No,Ticket ID,Entry Time\n"
            + filteredVehicles.map(v => `${v.zoneName},${v.type},${v.number},${v.ticketId},${v.entryTime.toISOString()}`).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `parking_report_current.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, 1000);
  };

  const handleDownloadFiltered = () => {
     toast({
      title: "Downloading Custom Report...",
      description: `Report for Zone: ${selectedZoneId === 'all' ? 'All' : zones.find(z => z.id === selectedZoneId)?.name} on ${date ? format(date, "PPP") : 'Selected Date'}`,
    });
    // Logic similar to above but conceptually for the filtered range
     setTimeout(() => {
        const csvContent = "data:text/csv;charset=utf-8," 
            + "Zone,Type,Vehicle No,Ticket ID,Entry Time\n"
            + filteredVehicles.map(v => `${v.zoneName},${v.type},${v.number},${v.ticketId},${v.entryTime.toISOString()}`).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `parking_report_${selectedZoneId}_${date ? format(date, "yyyy-MM-dd") : 'custom'}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, 1000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">Generate and download parking analytics.</p>
        </div>
        <Button onClick={handleDownloadCurrent} className="gap-2">
          <Download className="w-4 h-4" /> Download Current Report
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filter Reports</CardTitle>
          <CardDescription>Select zone and date to view specific records.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="grid w-full md:w-[200px] gap-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Zone</label>
              <Select value={selectedZoneId} onValueChange={setSelectedZoneId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Zone" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  <SelectItem value="all">All Zones</SelectItem>
                  {zones.map(zone => (
                    <SelectItem key={zone.id} value={zone.id}>{zone.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid w-full md:w-[240px] gap-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : <span>Pick a date</span>}
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

            <Button variant="secondary" onClick={handleDownloadFiltered} className="gap-2">
              <FileText className="w-4 h-4" /> Download Selected
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
        </CardHeader>
        <CardContent>
            {filteredVehicles.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                No records found for the selected criteria
            </div>
            ) : (
            <div className="rounded-md border">
                <table className="w-full text-left text-sm">
                <thead>
                    <tr className="border-b bg-muted/50">
                    <th className="p-4 font-medium w-16">Sl No</th>
                    <th className="p-4 font-medium">Zone</th>
                    <th className="p-4 font-medium">Type</th>
                    <th className="p-4 font-medium">Vehicle No</th>
                    <th className="p-4 font-medium text-right">Entry Time</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredVehicles.map((v, i) => (
                    <tr key={`${v.zoneId}-${i}`} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                        <td className="p-4 font-mono text-muted-foreground">{i + 1}</td>
                        <td className="p-4 font-medium">{v.zoneName}</td>
                        <td className="p-4">
                        <div className="flex items-center gap-2">
                            {getVehicleIcon(v.type)}
                            <span className="uppercase text-xs font-bold">{v.type}</span>
                        </div>
                        </td>
                        <td className="p-4 font-mono">{v.number}</td>
                        <td className="p-4 text-right font-mono">
                            {v.entryTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
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
