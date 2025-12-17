import { ArrowLeft, Calendar, TrendingUp } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, AreaChart, Area } from "recharts";

const weeklyData = [
  { day: "Mon", occupancy: 0 },
  { day: "Tue", occupancy: 0 },
  { day: "Wed", occupancy: 0 },
  { day: "Thu", occupancy: 0 },
  { day: "Fri", occupancy: 0 },
  { day: "Sat", occupancy: 0 },
  { day: "Sun", occupancy: 0 },
];

const tomorrowHourlyData = [
  { time: "4am", prob: 0 },
  { time: "8am", prob: 0 },
  { time: "12pm", prob: 0 },
  { time: "4pm", prob: 0 },
  { time: "8pm", prob: 0 },
  { time: "12am", prob: 0 },
];

const zonePredictions = Array.from({ length: 20 }, (_, i) => ({
  id: `Z${i + 1}`,
  prob: 0
}));

export default function Predictions() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-4 mb-2">
        <Link href="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Forecast & Analytics</h1>
          <p className="text-muted-foreground">Smart parking predictions for pilgrims</p>
        </div>
      </div>

      {/* Main Tomorrow Card */}
      <Card className="bg-gradient-to-br from-primary to-blue-600 text-white border-none shadow-lg">
        <CardContent className="pt-6">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2 text-blue-100 mb-2">
                <Calendar className="w-4 h-4" />
                <span className="text-sm font-medium uppercase tracking-wider">Tomorrow's Outlook</span>
              </div>
              <h2 className="text-4xl font-bold mb-1">{Math.max(...tomorrowHourlyData.map(d => d.prob))}% Probability</h2>
              <p className="text-blue-100">
                {Math.max(...tomorrowHourlyData.map(d => d.prob)) > 50 
                  ? "Expected to reach full capacity by 12:00 PM" 
                  : "Low probability of reaching full capacity"}
              </p>
            </div>
            <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
          </div>
          
          <div className="h-[150px] mt-6">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={tomorrowHourlyData}>
                <defs>
                  <linearGradient id="colorProbWhite" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#fff" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#fff" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" hide />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '8px', 
                    border: 'none',
                    backgroundColor: 'white',
                    color: '#333',
                    padding: '10px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                  }} 
                  cursor={{ stroke: 'rgba(255,255,255,0.2)', strokeWidth: 2 }} 
                  isAnimationActive={false}
                  labelStyle={{ color: '#666', marginBottom: '5px', fontSize: '12px' }}
                  itemStyle={{ color: '#2563eb', fontWeight: 'bold' }}
                  formatter={(value) => [`${value}%`, 'Probability']}
                />
                <Area type="monotone" dataKey="prob" stroke="#fff" strokeWidth={2} fill="url(#colorProbWhite)" activeDot={{ r: 4, fill: 'white' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Past 7 Days */}
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
                <Tooltip cursor={{fill: 'transparent'}} />
                <Bar dataKey="occupancy" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Per Zone Predictions */}
      <div>
        <h3 className="font-semibold mb-4 ml-1">Zone-wise Probability (Tomorrow)</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {zonePredictions.map((zone) => (
            <div key={zone.id} className="bg-card border p-3 rounded-lg flex justify-between items-center">
              <span className="font-medium text-sm">{zone.id}</span>
              <div className={`text-sm font-bold px-2 py-0.5 rounded ${
                zone.prob > 85 ? "bg-red-100 text-red-700" :
                zone.prob > 60 ? "bg-yellow-100 text-yellow-700" :
                "bg-green-100 text-green-700"
              }`}>
                {zone.prob}%
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}