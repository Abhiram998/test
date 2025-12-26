import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertZoneSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // --- PARKING ZONE OPERATIONS ---

  // Get all zones for dashboard
  app.get("/api/zones", async (_req, res) => {
    try {
      const zones = await storage.getZones();
      res.json(zones);
    } catch (error) {
      res.status(500).json({ message: "Failed to sync zones" });
    }
  });

  // Create new terminal (Fixed: matches the POST request from dashboard)
  app.post("/api/zones", async (req, res) => {
    try {
      const parsed = insertZoneSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid configuration", details: parsed.error });
      }
      const zone = await storage.createZone(parsed.data);
      res.status(201).json(zone);
    } catch (error) {
      res.status(500).json({ message: "Node initialization failed" });
    }
  });

  // Update existing terminal
  app.post("/api/zones/:id", async (req, res) => {
    try {
      const id = req.params.id; // Corrected: Use string ID to fix ts(2345)
      const zone = await storage.updateZone(id, req.body);
      res.json(zone);
    } catch (error) {
      res.status(500).json({ message: "Update sequence failed" });
    }
  });

  // Delete terminal
  app.post("/api/zones/:id/delete", async (req, res) => {
    try {
      const id = req.params.id; // Corrected: Use string ID to fix ts(2345)
      await storage.deleteZone(id);
      res.sendStatus(200);
    } catch (error) {
      res.status(500).json({ message: "Decommissioning failed" });
    }
  });

  // --- TRAFFIC / VEHICLE OPERATIONS ---

  // Register vehicle entry
  app.post("/api/enter", async (req, res) => {
    try {
      const { vehicle, type, zone } = req.body;
      // Fixed: createVehicleEntry now exists in storage
      await storage.createVehicleEntry({ 
        plateNumber: vehicle, 
        type, 
        zoneId: zone 
      });
      res.json({ success: true, ticket: `TKT-${Date.now()}` });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}