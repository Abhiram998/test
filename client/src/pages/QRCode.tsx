import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { QrCode, Scan, CheckCircle2, XCircle } from "lucide-react";
import { useParking } from "@/lib/parking-context";
import { Link } from "wouter";

export default function QRCode() {
  const [isScanning, setIsScanning] = useState(false);
  const [scannedData, setScannedData] = useState<any>(null);
  const { zones } = useParking();

  const handleScan = () => {
    setIsScanning(true);
    setScannedData(null);

    // Simulate scanning delay
    setTimeout(() => {
      setIsScanning(false);
      // Simulate finding a random vehicle from the zones
      const allVehicles = zones.flatMap(z => z.vehicles.map(v => ({ ...v, zoneName: z.name })));
      
      if (allVehicles.length > 0) {
        const randomVehicle = allVehicles[Math.floor(Math.random() * allVehicles.length)];
        setScannedData({
          success: true,
          vehicle: randomVehicle
        });
      } else {
        setScannedData({
          success: false,
          message: "No active ticket found in QR code."
        });
      }
    }, 2000);
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-2">
        <h1 className="text-2xl font-bold">QR Ticket Scanner</h1>
      </div>

      <Card className="border-2 border-dashed border-primary/20 bg-muted/20">
        <CardContent className="pt-12 pb-12 flex flex-col items-center justify-center text-center space-y-6">
          
          {isScanning ? (
            <div className="relative">
              <div className="w-48 h-48 rounded-lg border-2 border-primary relative overflow-hidden bg-black/5">
                <div className="absolute top-0 left-0 w-full h-1 bg-primary/50 shadow-[0_0_20px_rgba(59,130,246,0.5)] animate-[scan_2s_ease-in-out_infinite]"></div>
                <QrCode className="w-full h-full p-8 text-primary/20" />
              </div>
              <p className="mt-4 text-sm text-muted-foreground animate-pulse">Scanning QR Code...</p>
            </div>
          ) : !scannedData ? (
            <>
              <div className="w-32 h-32 rounded-full bg-primary/10 flex items-center justify-center">
                <Scan className="w-16 h-16 text-primary" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Ready to Scan</h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  Point camera at the vehicle's QR code ticket to verify details.
                </p>
              </div>
              <Button size="lg" className="w-full max-w-xs" onClick={handleScan}>
                <QrCode className="w-4 h-4 mr-2" /> Scan Ticket
              </Button>
            </>
          ) : (
            <div className="w-full space-y-6 animate-in fade-in zoom-in duration-300">
              {scannedData.success ? (
                <div className="bg-background rounded-xl shadow-sm border p-6 text-left space-y-4 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-green-500"></div>
                  <div className="flex items-center gap-3 text-green-600 mb-2">
                    <CheckCircle2 className="w-6 h-6" />
                    <span className="font-bold text-lg">Valid Ticket</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs uppercase tracking-wider">Vehicle No</p>
                      <p className="font-mono font-bold text-lg">{scannedData.vehicle.number}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-muted-foreground text-xs uppercase tracking-wider">Type</p>
                      <p className="font-medium capitalize">{scannedData.vehicle.type}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs uppercase tracking-wider">Zone</p>
                      <p className="font-medium">{scannedData.vehicle.zoneName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-muted-foreground text-xs uppercase tracking-wider">Entry Time</p>
                      <p className="font-medium">{new Date(scannedData.vehicle.entryTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-dashed">
                    <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Ticket ID</p>
                    <p className="font-mono text-xs text-muted-foreground break-all">{scannedData.vehicle.ticketId}</p>
                  </div>

                  <Button className="w-full mt-4" variant="outline" onClick={() => setScannedData(null)}>
                    Scan Another
                  </Button>
                </div>
              ) : (
                <div className="text-center space-y-4">
                   <div className="w-16 h-16 rounded-full bg-red-100 mx-auto flex items-center justify-center text-red-600">
                     <XCircle className="w-8 h-8" />
                   </div>
                   <div>
                     <h3 className="font-bold text-lg text-red-600">Invalid Ticket</h3>
                     <p className="text-muted-foreground">{scannedData.message}</p>
                   </div>
                   <Button className="w-full" variant="outline" onClick={() => setScannedData(null)}>
                    Try Again
                  </Button>
                </div>
              )}
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
}
