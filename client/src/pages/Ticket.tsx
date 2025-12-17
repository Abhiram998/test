import { ArrowLeft, QrCode, Download, Share2 } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function Ticket() {
  // Mock ticket data
  const ticket = {
    id: "TKT-9823-XJ",
    vehicle: "KL-01-AB-1234",
    zone: "Zone A7",
    slot: "A7-312",
    entryTime: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
    date: new Date().toLocaleDateString(),
  };

  return (
    <div className="min-h-screen bg-muted/30 p-4 flex flex-col">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <h1 className="text-xl font-bold">My Ticket</h1>
      </div>

      <div className="flex-1 flex items-center justify-center pb-12">
        <Card className="w-full max-w-sm shadow-xl border-0 overflow-hidden relative">
          {/* Decorative top sawtooth */}
          <div className="absolute top-0 left-0 right-0 h-2 bg-primary" />
          
          <CardContent className="pt-8 pb-8 px-6 text-center space-y-6">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-primary">Nilakkal Parking</h2>
              <p className="text-xs text-muted-foreground uppercase tracking-widest">Official Parking Receipt</p>
            </div>

            <div className="py-6 bg-muted/20 rounded-lg border border-border/50">
              <div className="text-4xl font-black text-foreground tracking-tighter">{ticket.slot}</div>
              <p className="text-sm font-medium text-muted-foreground mt-1">Assigned Slot</p>
            </div>

            <div className="grid grid-cols-2 gap-y-4 text-left text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Zone</p>
                <p className="font-semibold">{ticket.zone}</p>
              </div>
              <div className="text-right">
                <p className="text-muted-foreground text-xs">Vehicle</p>
                <p className="font-mono font-semibold">{ticket.vehicle}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Date</p>
                <p className="font-semibold">{ticket.date}</p>
              </div>
              <div className="text-right">
                <p className="text-muted-foreground text-xs">Entry Time</p>
                <p className="font-semibold">{ticket.entryTime}</p>
              </div>
            </div>

            <Separator className="my-4" />

            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="bg-white p-4 rounded-xl border-2 border-black/10">
                <QrCode className="w-32 h-32 text-black" />
              </div>
              <p className="font-mono text-xs text-muted-foreground">{ticket.id}</p>
            </div>
          </CardContent>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 border-t divide-x">
            <Button variant="ghost" className="rounded-none h-12 hover:bg-primary/5 text-primary">
              <Download className="w-4 h-4 mr-2" /> Save
            </Button>
            <Button variant="ghost" className="rounded-none h-12 hover:bg-primary/5 text-primary">
              <Share2 className="w-4 h-4 mr-2" /> Share
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}