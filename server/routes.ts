import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertZoneSchema } from "@shared/schema";

export async function registerRoutes(
  app: Express
): Promise<Server> {
  // --- PARKING ZONE ROUTES ---

  // Get all zones
  app.get("/api/zones", async (_req, res) => {
    try {
      const zones = await storage.getZones();
      res.json(zones);
    } catch (error) {
      console.error("Fetch Zones Error:", error);
      res.status(500).json({ message: "Failed to fetch zones" });
    }
  });

  // Create a new zone (Triggered by + New Terminal / + Add Parking)
  app.post("/api/zones", async (req, res) => {
    try {
      // Validate the incoming data against the schema
      const parsed = insertZoneSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ 
          message: "Invalid zone data", 
          errors: parsed.error.format() 
        });
      }

      const newZone = await storage.createZone(parsed.data);
      res.status(201).json(newZone);
    } catch (error) {
      console.error("Create Zone Error:", error);
      res.status(500).json({ message: "Failed to initialize terminal node" });
    }
  });

  // Update an existing zone
  app.post("/api/zones/:id", async (req, res) => {
    try {
      // FIX: Removed parseInt(). IDs like "Z1" must remain strings.
      const id = req.params.id; 
      const updatedZone = await storage.updateZone(id, req.body);
      res.json(updatedZone);
    } catch (error) {
      console.error("Update Zone Error:", error);
      res.status(500).json({ message: "Failed to update terminal" });
    }
  });

  // Delete a zone
  app.post("/api/zones/:id/delete", async (req, res) => {
    try {
      // FIX: Removed parseInt(). IDs are strings.
      const id = req.params.id; 
      await storage.deleteZone(id);
      res.sendStatus(200);
    } catch (error) {
      console.error("Delete Zone Error:", error);
      res.status(500).json({ message: "Failed to decommission terminal" });
    }
  });

  // --- VEHICLE OPERATIONS ---

  // Enter a vehicle
  app.post("/api/enter", async (req, res) => {
    try {
      const { vehicle, type, zone, slot } = req.body;
      
      // FIX: storage.createVehicleEntry now exists in the updated storage.ts
      const result = await storage.createVehicleEntry({
        plateNumber: vehicle,
        type,
        zoneId: zone, // Ensure this is the ID string (e.g., "Z1")
        slot,
        entryTime: new Date()
      });

      res.json({ 
        success: true, 
        ticket: `TKT-${Math.random().toString(36).substr(2, 9).toUpperCase()}` 
      });
    } catch (error: any) {
      console.error("Vehicle Entry Error:", error);
      res.status(400).json({ success: false, message: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}