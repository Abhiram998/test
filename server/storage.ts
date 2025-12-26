import { type User, type InsertUser, type ParkingZone, type InsertZone } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getZones(): Promise<ParkingZone[]>;
  createZone(zone: InsertZone): Promise<ParkingZone>;
  updateZone(id: string, data: Partial<ParkingZone>): Promise<ParkingZone>;
  deleteZone(id: string): Promise<void>;
  createVehicleEntry(entry: any): Promise<any>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private zones: Map<string, ParkingZone>;

  constructor() {
    this.users = new Map();
    this.zones = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find((u) => u.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getZones(): Promise<ParkingZone[]> {
    return Array.from(this.zones.values());
  }

  async createZone(insertZone: InsertZone): Promise<ParkingZone> {
    const id = `Z${this.zones.size + 1}`;
    const newZone: ParkingZone = {
      ...insertZone,
      id,
      occupied: 0,
      stats: { heavy: 0, medium: 0, light: 0 }
    };
    this.zones.set(id, newZone);
    return newZone;
  }

  async updateZone(id: string, data: Partial<ParkingZone>): Promise<ParkingZone> {
    const existing = this.zones.get(id);
    if (!existing) throw new Error("Zone not found");
    const updated = { ...existing, ...data };
    this.zones.set(id, updated);
    return updated;
  }

  async deleteZone(id: string): Promise<void> {
    this.zones.delete(id);
  }

  async createVehicleEntry(entry: any): Promise<any> {
    const zone = this.zones.get(entry.zoneId);
    if (!zone) throw new Error("Zone not found");
    zone.occupied += 1;
    const type = entry.type as keyof typeof zone.stats;
    zone.stats[type] += 1;
    this.zones.set(zone.id, zone);
    return { success: true };
  }
}

export const storage = new MemStorage();