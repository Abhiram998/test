import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useParking } from "@/lib/parking-context";
import { Shield, Lock, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const { loginAdmin } = useParking();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (loginAdmin(email, password)) {
      setLocation("/admin");
    } else {
      setError("Invalid ID or Password. Access Denied.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 dark">
      <Card className="w-full max-w-md border-slate-800 bg-slate-900 text-slate-50">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mb-4 text-blue-500 border border-blue-500/20">
            <Shield className="w-8 h-8" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Police Control</CardTitle>
          <CardDescription className="text-slate-400">Restricted Access. Authorized Personnel Only.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="admin-id" className="text-slate-200">Officer Email</Label>
              <div className="relative">
                <ShieldAlert className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                <Input 
                  id="admin-id" 
                  placeholder="police@gmail.com" 
                  className="pl-9 bg-slate-950 border-slate-800 text-slate-50 placeholder:text-slate-600 focus-visible:ring-blue-500" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required 
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-200">Secure Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                <Input 
                  id="password" 
                  type="password" 
                  placeholder="••••••••" 
                  className="pl-9 bg-slate-950 border-slate-800 text-slate-50 placeholder:text-slate-600 focus-visible:ring-blue-500" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>
            
            {error && (
              <div className="text-red-500 text-sm text-center bg-red-500/10 p-2 rounded border border-red-500/20">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold">
              Authenticate
            </Button>
          </form>
          <div className="mt-6 text-center">
            <Link href="/">
              <span className="text-sm text-slate-500 hover:text-slate-300 cursor-pointer transition-colors">
                ← Return to Public Portal
              </span>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}