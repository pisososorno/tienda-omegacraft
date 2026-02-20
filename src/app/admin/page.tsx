"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart, DollarSign, AlertTriangle, Shield } from "lucide-react";

interface DashboardStats {
  totalOrders: number;
  totalRevenue: string;
  disputedOrders: number;
  frozenOrders: number;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    fetch("/api/admin/dashboard")
      .then((r) => r.json())
      .then(setStats)
      .catch(console.error);
  }, []);

  const cards = [
    {
      title: "Total Orders",
      value: stats?.totalOrders ?? "—",
      icon: ShoppingCart,
      color: "text-blue-600",
    },
    {
      title: "Revenue (USD)",
      value: stats?.totalRevenue ? `$${stats.totalRevenue}` : "—",
      icon: DollarSign,
      color: "text-green-600",
    },
    {
      title: "Disputed",
      value: stats?.disputedOrders ?? "—",
      icon: AlertTriangle,
      color: "text-orange-600",
    },
    {
      title: "Frozen",
      value: stats?.frozenOrders ?? "—",
      icon: Shield,
      color: "text-red-600",
    },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight mb-8">Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
