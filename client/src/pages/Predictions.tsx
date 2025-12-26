import { ArrowLeft, Calendar, TrendingUp } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  AreaChart,
  Area,
} from "recharts";
import { useEffect, useState } from "react";

/* ===========================
   COMPONENT
=========================== */

export default function Predictions() {
  /* ---------------------------
     STATE
  --------------------------- */
  const [weeklyData, setWeeklyData] = useState<
    { day: string; occupancy: number }[]
  >([]);

  const [tomorrowProbability, setTomorrowProbability] = useState(0);

  const [zonePredictions, setZonePredictions] = useState<
    { id: string; prob: number }[]
  >([]);

  /* ---------------------------
     API FETCH
  --------------------------- */
  useEffect(() => {
    fetch("/api/predictions")
      .then((res) => res.json())
      .then((data) => {
        // Past 7 days trend
        setWeeklyData(data.past7Days || []);

        // Tomorrow probability
        setTomorrowProbability(data.tomorrow?.probability || 0);

        // Zone-wise probabilities
        setZonePredictions(
          (data.zones || []).map((z: any) => ({
            id: z.zone,
            prob: z.probability,
          }))
        );
      })
      .catch((err) => {
        console.error("Prediction API error:", err);
      });
  }, []);

  /* ===========================
     RENDER
  =========================== */
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* HEADER */}
      <div className="flex items-center gap-4 mb-2">
        <Link href="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Forecast & Analytics
          </h1>
          <p className="text-muted-foreground">
            Smart parking predictions for pilgrims
          </p>
        </div>
      </div>

      {/* TOMORROW CARD */}
      <Card className="bg-gradient-to-br from-primary to-blue-600 text-white border-none shadow-lg">
        <CardContent className="pt-6">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2 text-blue-100 mb-2">
                <Calendar className="w-4 h-4" />
                <span className="text-sm font-medium uppercase tracking-wider">
                  Tomorrow's Outlook
                </span>
              </div>

              <h2 className="text-4xl font-bold mb-1">
                {tomorrowProbability}% Probability
              </h2>

              <p className="text-blue-100">
                {tomorrowProbability > 70
                  ? "High probability of congestion"
                  : "Low probability of reaching full capacity"}
              </p>
            </div>

            <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
          </div>

          {/* AREA CHART (kept for future extension) */}
          <div className="h-[150px] mt-6">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={[
                  { time: "Morning", prob: tomorrowProbability },
                  { time: "Afternoon", prob: tomorrowProbability },
                  { time: "Evening", prob: tomorrowProbability },
                ]}
              >
                <defs>
                  <linearGradient
                    id="colorProbWhite"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="#fff" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#fff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" hide />
                <Tooltip
                  formatter={(value) => [`${value}%`, "Probability"]}
                />
                <Area
                  type="monotone"
                  dataKey="prob"
                  stroke="#fff"
                  strokeWidth={2}
                  fill="url(#colorProbWhite)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* PAST 7 DAYS */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Past 7 Days Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis hide />
                <Tooltip cursor={{ fill: "transparent" }} />
                <Bar
                  dataKey="occupancy"
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* ZONE-WISE PROBABILITY */}
      <div>
        <h3 className="font-semibold mb-4 ml-1">
          Zone-wise Probability (Tomorrow)
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {zonePredictions.map((zone) => (
            <div
              key={zone.id}
              className="bg-card border p-3 rounded-lg flex justify-between items-center"
            >
              <span className="font-medium text-sm">{zone.id}</span>

              <div
                className={`text-sm font-bold px-2 py-0.5 rounded ${
                  zone.prob > 85
                    ? "bg-red-100 text-red-700"
                    : zone.prob > 60
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-green-100 text-green-700"
                }`}
              >
                {zone.prob}%
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
