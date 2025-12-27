import { ArrowLeft, Calendar, TrendingUp } from "lucide-react";
import { Link } from "wouter";
import { useEffect, useState } from "react";
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

/* =========================
   TYPES
========================= */

type PastDay = {
  day: string;
  occupancy: number;
};

type ZonePrediction = {
  zone: string;
  probability: number;
};

/* =========================
   COMPONENT
========================= */

export default function Predictions() {
  const [weeklyData, setWeeklyData] = useState<PastDay[]>([]);
  const [tomorrowProbability, setTomorrowProbability] = useState<number>(0);
  const [zonePredictions, setZonePredictions] = useState<ZonePrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [hourlyData, setHourlyData] = useState<
  { time: string; probability: number }[]
>([]);

  /* =========================
     FETCH DATA
  ========================= */

  useEffect(() => {
    fetch("/api/predictions")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load predictions");
        return res.json();
      })
      .then((data) => {
        setWeeklyData(data.past7Days || []);
        setTomorrowProbability(data.tomorrow?.probability || 0);
        setZonePredictions(data.zones || []);
        setHourlyData(data.hourly || []);
      })
      .catch((err) => {
        console.error("Prediction fetch error:", err);
      })
      .finally(() => setLoading(false));
  }, []);

    /* =========================
     SORT ZONES NUMERICALLY
  ========================= */

  const sortedZones = [...zonePredictions].sort(
    (a, b) =>
      parseInt(a.zone.replace("Z", "")) -
      parseInt(b.zone.replace("Z", ""))
  );

  /* =========================
     UI
  ========================= */
    if (loading) {
    return (
      <div className="h-[60vh] flex items-center justify-center text-muted-foreground">
        Loading predictions…
      </div>
    );
  }

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
    ? "High congestion expected"
    : tomorrowProbability > 40
    ? "Moderate traffic expected"
    : "Low congestion expected"}
</p>
            </div>

            <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
          </div>

          {/* Decorative Area Chart */}
          <div className="h-[120px] mt-6">
            <ResponsiveContainer width="100%" height="100%">
             <AreaChart data={hourlyData}>
  <defs>
    <linearGradient id="probFill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="5%" stopColor="#ffffff" stopOpacity={0.35} />
      <stop offset="95%" stopColor="#ffffff" stopOpacity={0} />
    </linearGradient>
  </defs>

  <XAxis dataKey="time" hide />
  <YAxis hide />

  <Area
    type="monotone"
    dataKey="probability"
    stroke="#fff"
    strokeWidth={2}
    fill="url(#probFill)"
    activeDot={{ r: 4, fill: "#fff" }}
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
                <XAxis dataKey="day" />
                <YAxis hide />
                <Tooltip />
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

      {/* ZONE WISE */}
      <div>
        <h3 className="font-semibold mb-4 ml-1">
          Zone-wise Probability (Tomorrow)
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {sortedZones.map((zone) => (
            <div
              key={zone.zone}
              className="bg-card border p-3 rounded-lg flex justify-between items-center"
            >
              <span className="font-medium text-sm">{zone.zone}</span>

              <div
                className={`text-sm font-bold px-2 py-0.5 rounded ${
                  zone.probability > 85
                    ? "bg-red-100 text-red-700"
                    : zone.probability > 60
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-green-100 text-green-700"
                }`}
              >
                {zone.probability}%
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
