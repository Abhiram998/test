import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User schema for authentication
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Parking Zone schema matching your dashboard needs
export const zones = pgTable("zones", {
  id: varchar("id").primaryKey(), 
  name: text("name").notNull(),
  capacity: integer("capacity").notNull(),
  occupied: integer("occupied").notNull().default(0),
  limits: jsonb("limits").$type<{
    heavy: number;
    medium: number;
    light: number;
  }>().notNull(),
  stats: jsonb("stats").$type<{
    heavy: number;
    medium: number;
    light: number;
  }>().notNull().default({ heavy: 0, medium: 0, light: 0 }),
});

export const insertZoneSchema = createInsertSchema(zones).pick({
  name: true,
  capacity: true,
  limits: true,
});

export type InsertZone = z.infer<typeof insertZoneSchema>;
export type ParkingZone = typeof zones.$inferSelect;