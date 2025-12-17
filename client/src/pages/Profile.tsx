import { ArrowLeft, User, Phone, Car, History, LogOut, Shield } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useParking } from "@/lib/parking-context";

export default function Profile() {
  const { isAdmin, logoutAdmin } = useParking();

  if (isAdmin) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4 mb-2">
          <Link href="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Officer Profile</h1>
        </div>

        <Card className="border-none shadow-md bg-slate-900 text-white">
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-blue-500/20 flex items-center justify-center border-2 border-blue-500/50">
              <Shield className="w-8 h-8 text-blue-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Officer James Smith</h2>
              <div className="flex flex-col gap-1 text-blue-100 text-sm mt-1">
                <div className="flex items-center gap-2">
                  <User className="w-3 h-3" />
                  <span>ID: POL-575</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-3 h-3" />
                  <span>+91 98765 43210</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="pt-4">
          <Link href="/login">
            <Button 
              variant="destructive" 
              className="w-full gap-2"
              onClick={logoutAdmin}
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-2">
        <Link href="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">My Profile</h1>
      </div>

      {/* User Info Card */}
      <Card className="border-none shadow-md bg-gradient-to-r from-primary/90 to-blue-600 text-white">
        <CardContent className="pt-6 flex items-center gap-4">
          <Avatar className="h-16 w-16 border-2 border-white/20">
            <AvatarImage src="https://github.com/shadcn.png" />
            <AvatarFallback>JD</AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-xl font-bold">John Doe</h2>
            <div className="flex items-center gap-2 text-blue-100 text-sm">
              <Phone className="w-3 h-3" />
              <span>+91 98765 43210</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Saved Vehicles */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Car className="w-5 h-5 text-primary" />
            Saved Vehicles
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
            <div className="flex items-center gap-3">
              <div className="bg-white p-2 rounded border">
                <Car className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold">Toyota Innova</p>
                <p className="text-xs text-muted-foreground font-mono">KL-01-AB-1234</p>
              </div>
            </div>
            <Button variant="outline" size="sm">Edit</Button>
          </div>
          <Button variant="ghost" className="w-full text-primary border-dashed border border-primary/30">
            + Add New Vehicle
          </Button>
        </CardContent>
      </Card>

      {/* Ticket History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-0 divide-y">
          {[1, 2, 3].map((_, i) => (
            <div key={i} className="py-3 flex justify-between items-center">
              <div>
                <p className="font-medium text-sm">Nilakkal Zone A{7-i}</p>
                <p className="text-xs text-muted-foreground">Oct {20-i}, 2023 • 10:30 AM</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-sm">₹50</p>
                <p className="text-[10px] text-green-600 bg-green-100 px-2 py-0.5 rounded-full inline-block">Paid</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="pt-4">
        <Link href="/login">
          <Button variant="destructive" className="w-full gap-2">
            <LogOut className="w-4 h-4" /> Sign Out
          </Button>
        </Link>
      </div>
    </div>
  );
}