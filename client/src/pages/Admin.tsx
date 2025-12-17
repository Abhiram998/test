import { useState, useEffect } from "react";
import { useParking, ParkingZone } from "@/lib/parking-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Link } from "wouter";
import { User, Eye, Bus, Truck, Car, ChevronLeft, ChevronRight, Pause, Play, Plus, Pencil, Trash2, FileText, Download, Database } from "lucide-react";

export default function Admin() {
  const { zones, totalCapacity, totalOccupied, addZone, updateZone, deleteZone } = useParking();
  const [selectedZone, setSelectedZone] = useState<ParkingZone | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Edit/Create State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<ParkingZone | null>(null);
  const [formData, setFormData] = useState({ 
    name: "", 
    capacity: 50,
    limits: { heavy: 10, medium: 15, light: 25 }
  });
  
  // Slideshow state
  const [pageIndex, setPageIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const ITEMS_PER_PAGE = 5;
  const totalPages = Math.ceil(zones.length / ITEMS_PER_PAGE) || 1;

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto-rotate slides
  useEffect(() => {
    if (isPaused) return;
    
    const interval = setInterval(() => {
      setPageIndex((prev) => (prev + 1) % totalPages);
    }, 5000); // Rotate every 5 seconds

    return () => clearInterval(interval);
  }, [isPaused, totalPages]);

  const handlePrev = () => {
    setPageIndex((prev) => (prev - 1 + totalPages) % totalPages);
    setIsPaused(true); // Pause on manual interaction
  };

  const handleNext = () => {
    setPageIndex((prev) => (prev + 1) % totalPages);
    setIsPaused(true); // Pause on manual interaction
  };

  const togglePause = () => setIsPaused(!isPaused);

  const getVehicleIcon = (type: string) => {
    switch(type) {
      case 'heavy': return <Bus className="w-4 h-4" />;
      case 'medium': return <Truck className="w-4 h-4" />;
      default: return <Car className="w-4 h-4" />;
    }
  };

  const handleEditClick = (zone: ParkingZone) => {
    setEditingZone(zone);
    setFormData({ 
      name: zone.name, 
      capacity: zone.capacity,
      limits: zone.limits || { 
        heavy: Math.floor(zone.capacity * 0.2), 
        medium: Math.floor(zone.capacity * 0.3), 
        light: zone.capacity - Math.floor(zone.capacity * 0.2) - Math.floor(zone.capacity * 0.3)
      }
    });
    setIsEditOpen(true);
    setIsPaused(true);
  };

  const handleDeleteClick = (id: string) => {
    if (confirm("Are you sure you want to delete this zone?")) {
      deleteZone(id);
    }
  };

  const handleSaveEdit = () => {
    if (editingZone) {
      updateZone(editingZone.id, formData);
      setIsEditOpen(false);
      setEditingZone(null);
    }
  };

  const handleCreate = () => {
    addZone(formData);
    setIsCreateOpen(false);
    setFormData({ 
      name: "", 
      capacity: 50,
      limits: { heavy: 10, medium: 15, light: 25 }
    });
  };

  const openCreateDialog = () => {
    setFormData({ 
      name: "New Zone", 
      capacity: 50,
      limits: { heavy: 10, medium: 15, light: 25 }
    });
    setIsCreateOpen(true);
    setIsPaused(true);
  };

  const updateLimit = (type: 'heavy' | 'medium' | 'light', value: number) => {
    const newLimits = { ...formData.limits, [type]: value };
    const newCapacity = newLimits.heavy + newLimits.medium + newLimits.light;
    setFormData({ ...formData, limits: newLimits, capacity: newCapacity });
  };

  const currentZones = zones.slice(pageIndex * ITEMS_PER_PAGE, (pageIndex + 1) * ITEMS_PER_PAGE);

  return (
    <div className="min-h-screen bg-black text-white font-mono p-4 flex flex-col text-sm">
      {/* Header */}
      <div className="mb-4 border-b border-white/20 pb-2 flex justify-between items-end">
        <div>
          <h1 className="text-xl font-bold uppercase tracking-wider mb-1">Nilakkal Parking – Live Admin Dashboard</h1>
          <div className="text-xs text-white/60">CONTROL ROOM • {currentTime.toLocaleDateString()} • {currentTime.toLocaleTimeString()}</div>
        </div>
        <div className="flex gap-4 items-center">
          <Link href="/report">
             <Button variant="outline" className="border-white text-white hover:bg-white hover:text-black rounded-none gap-2 h-10">
                <FileText className="w-4 h-4" /> Reports
             </Button>
          </Link>
           <Link href="/backup">
             <Button variant="outline" className="border-white text-white hover:bg-white hover:text-black rounded-none gap-2 h-10">
                <Database className="w-4 h-4" /> Backup
             </Button>
          </Link>
          <Button onClick={openCreateDialog} className="bg-white text-black hover:bg-white/90 rounded-none gap-2 h-10">
            <Plus className="w-4 h-4" /> Add Parking
          </Button>
          <div className="border border-white p-2 min-w-[150px] text-right">
            <div className="text-[10px] uppercase tracking-widest mb-1 text-white/70">Total Capacity</div>
            <div className="text-2xl font-bold">{totalCapacity}</div>
          </div>
        </div>
      </div>

      {/* Top Info Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="border border-white p-3 flex justify-between items-center">
          <div>
            <div className="text-[10px] uppercase tracking-widest mb-1 text-white/70">Total Vehicles Inside</div>
            <div className="text-3xl font-bold">{totalOccupied}</div>
          </div>
          <div className="text-right">
             <div className="text-[10px] uppercase tracking-widest mb-1 text-white/70">Occupancy Rate</div>
             <div className="text-xl font-bold">{totalCapacity > 0 ? Math.round((totalOccupied / totalCapacity) * 100) : 0}%</div>
          </div>
        </div>
        <div className="border border-white p-3">
          <div className="text-[10px] uppercase tracking-widest mb-1 text-white/70">Total Vacancy (Available Spots)</div>
          <div className="text-3xl font-bold text-green-500">{totalCapacity - totalOccupied}</div>
        </div>
      </div>

      {/* Main Table Container - Flex grow to fill space */}
      <div className="flex-grow flex flex-col border border-white relative">
        <table className="w-full text-left border-collapse flex-grow">
          <thead>
            <tr className="border-b border-white bg-white/5">
              <th className="p-3 uppercase tracking-wider border-r border-white font-bold text-xs">Zone Name</th>
              <th className="p-3 uppercase tracking-wider border-r border-white font-bold text-right text-xs">Current Vehicles</th>
              <th className="p-3 uppercase tracking-wider border-r border-white font-bold text-right text-xs">Capacity</th>
              <th className="p-3 uppercase tracking-wider border-r border-white font-bold text-right text-xs">Vacant Slots</th>
              <th className="p-3 uppercase tracking-wider font-bold text-center text-xs">Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentZones.map((zone) => {
              const vacant = zone.capacity - zone.occupied;
              const isFull = vacant === 0;
              
              return (
                <tr key={zone.id} className="border-b border-white/20 hover:bg-white/5 transition-colors h-14">
                  <td className="p-3 border-r border-white/20 font-bold text-lg">{zone.name} ({zone.id})</td>
                  <td className="p-3 border-r border-white/20 text-right font-mono text-lg">{zone.occupied}</td>
                  <td className="p-3 border-r border-white/20 text-right font-mono text-lg text-white/50">{zone.capacity}</td>
                  <td className="p-3 border-r border-white/20 text-right font-mono text-lg text-green-500 font-bold">{vacant}</td>
                  <td className="p-3 text-center flex justify-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setSelectedZone(zone)}
                      className="h-8 w-8 p-0 text-white hover:text-black hover:bg-white rounded-none border border-white"
                      title="View Vehicles"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleEditClick(zone)}
                      className="h-8 w-8 p-0 text-white hover:text-black hover:bg-white rounded-none border border-white"
                      title="Edit Zone"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleDeleteClick(zone.id)}
                      className="h-8 w-8 p-0 text-red-400 hover:text-red-900 hover:bg-red-200 rounded-none border border-red-400"
                      title="Delete Zone"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
            {/* Fill empty rows to maintain height if last page has fewer items */}
            {Array.from({ length: Math.max(0, ITEMS_PER_PAGE - currentZones.length) }).map((_, i) => (
               <tr key={`empty-${i}`} className="border-b border-white/10 h-14">
                 <td colSpan={6} className="p-3 text-center text-white/10 uppercase tracking-widest text-xs">--- Empty Slot ---</td>
               </tr>
            ))}
          </tbody>
        </table>

        {/* Slideshow Controls */}
        <div className="border-t border-white p-2 flex justify-between items-center bg-black">
          <div className="flex gap-4">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handlePrev}
              className="rounded-none border-white text-white hover:bg-white hover:text-black h-8 text-xs"
            >
              <ChevronLeft className="mr-1 h-3 w-3" /> PREV
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={togglePause}
              className="rounded-none border-white text-white hover:bg-white hover:text-black w-24 h-8 text-xs"
            >
              {isPaused ? <Play className="mr-1 h-3 w-3" /> : <Pause className="mr-1 h-3 w-3" />}
              {isPaused ? "RESUME" : "PAUSE"}
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleNext}
              className="rounded-none border-white text-white hover:bg-white hover:text-black h-8 text-xs"
            >
              NEXT <ChevronRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
          <div className="flex items-center gap-6">
             <span className="text-xs font-bold uppercase tracking-wider bg-white text-black px-2 py-0.5">
                Page {pageIndex + 1} / {totalPages}
             </span>
             {isPaused && <span className="text-[10px] bg-red-500 text-white px-2 py-0.5 font-bold uppercase animate-pulse">PAUSED</span>}
             <div className="text-[10px] uppercase tracking-widest text-white/50 border-l border-white/20 pl-4">
               Auto-rotating every 5s
             </div>
          </div>
        </div>
      </div>

      {/* Vehicle Details Dialog */}
      <Dialog open={!!selectedZone} onOpenChange={(open) => !open && setSelectedZone(null)}>
        <DialogContent className="bg-black border border-white text-white max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl uppercase tracking-wider font-bold border-b border-white pb-4">
              Zone {selectedZone?.id} - Vehicle Manifest
            </DialogTitle>
          </DialogHeader>
          
          <div className="mt-4">
             {selectedZone?.vehicles.length === 0 ? (
                <div className="text-center py-8 text-white/50 uppercase tracking-widest border border-white/20">
                  No vehicles currently parked
                </div>
             ) : (
               <div className="border border-white">
                 <table className="w-full text-left">
                   <thead>
                     <tr className="border-b border-white bg-white/10">
                       <th className="p-3 uppercase text-xs tracking-wider">Type</th>
                       <th className="p-3 uppercase text-xs tracking-wider">Vehicle No</th>
                       <th className="p-3 uppercase text-xs tracking-wider">Ticket ID</th>
                       <th className="p-3 uppercase text-xs tracking-wider text-right">Entry Time</th>
                     </tr>
                   </thead>
                   <tbody>
                     {selectedZone?.vehicles.map((v, i) => (
                       <tr key={i} className="border-b border-white/20 hover:bg-white/5">
                         <td className="p-3">
                           <div className="flex items-center gap-2">
                              {getVehicleIcon(v.type)}
                              <span className="uppercase text-xs">{v.type}</span>
                           </div>
                         </td>
                         <td className="p-3 font-mono font-bold">{v.number}</td>
                         <td className="p-3 font-mono text-sm opacity-70">{v.ticketId}</td>
                         <td className="p-3 font-mono text-sm text-right">
                            {v.entryTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
             )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Zone Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="bg-black border border-white text-white">
          <DialogHeader>
            <DialogTitle>Edit Zone</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">Name</Label>
              <Input 
                id="name" 
                value={formData.name} 
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="col-span-3 bg-black border-white text-white" 
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-xs uppercase text-white/70 col-span-4 text-center border-b border-white/20 pb-2 mb-2">Vehicle Type Limits</Label>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="limit-heavy" className="text-right flex items-center justify-end gap-2">
                <Bus className="w-3 h-3" /> Heavy
              </Label>
              <Input 
                id="limit-heavy" 
                type="number"
                value={formData.limits.heavy} 
                onChange={(e) => updateLimit('heavy', parseInt(e.target.value) || 0)}
                className="col-span-3 bg-black border-white text-white" 
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="limit-medium" className="text-right flex items-center justify-end gap-2">
                <Truck className="w-3 h-3" /> Medium
              </Label>
              <Input 
                id="limit-medium" 
                type="number"
                value={formData.limits.medium} 
                onChange={(e) => updateLimit('medium', parseInt(e.target.value) || 0)}
                className="col-span-3 bg-black border-white text-white" 
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="limit-light" className="text-right flex items-center justify-end gap-2">
                <Car className="w-3 h-3" /> Light
              </Label>
              <Input 
                id="limit-light" 
                type="number"
                value={formData.limits.light} 
                onChange={(e) => updateLimit('light', parseInt(e.target.value) || 0)}
                className="col-span-3 bg-black border-white text-white" 
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4 mt-2 pt-2 border-t border-white/20">
              <Label htmlFor="capacity" className="text-right font-bold">Total Capacity</Label>
              <div className="col-span-3 text-xl font-bold pl-3">
                {formData.capacity}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)} className="border-white text-white hover:bg-white hover:text-black">Cancel</Button>
            <Button onClick={handleSaveEdit} className="bg-white text-black hover:bg-white/90">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Zone Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="bg-black border border-white text-white">
          <DialogHeader>
            <DialogTitle>Create New Parking Zone</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="new-name" className="text-right">Name</Label>
              <Input 
                id="new-name" 
                value={formData.name} 
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="col-span-3 bg-black border-white text-white" 
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-xs uppercase text-white/70 col-span-4 text-center border-b border-white/20 pb-2 mb-2">Vehicle Type Limits</Label>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="new-limit-heavy" className="text-right flex items-center justify-end gap-2">
                <Bus className="w-3 h-3" /> Heavy
              </Label>
              <Input 
                id="new-limit-heavy" 
                type="number"
                value={formData.limits.heavy} 
                onChange={(e) => updateLimit('heavy', parseInt(e.target.value) || 0)}
                className="col-span-3 bg-black border-white text-white" 
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="new-limit-medium" className="text-right flex items-center justify-end gap-2">
                <Truck className="w-3 h-3" /> Medium
              </Label>
              <Input 
                id="new-limit-medium" 
                type="number"
                value={formData.limits.medium} 
                onChange={(e) => updateLimit('medium', parseInt(e.target.value) || 0)}
                className="col-span-3 bg-black border-white text-white" 
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="new-limit-light" className="text-right flex items-center justify-end gap-2">
                <Car className="w-3 h-3" /> Light
              </Label>
              <Input 
                id="new-limit-light" 
                type="number"
                value={formData.limits.light} 
                onChange={(e) => updateLimit('light', parseInt(e.target.value) || 0)}
                className="col-span-3 bg-black border-white text-white" 
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4 mt-2 pt-2 border-t border-white/20">
              <Label className="text-right font-bold">Total Capacity</Label>
              <div className="col-span-3 text-xl font-bold pl-3">
                {formData.capacity}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)} className="border-white text-white hover:bg-white hover:text-black">Cancel</Button>
            <Button onClick={handleCreate} className="bg-white text-black hover:bg-white/90">Create Parking</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}