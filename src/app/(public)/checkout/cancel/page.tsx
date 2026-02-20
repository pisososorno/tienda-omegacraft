"use client";

import Link from "next/link";
import { XCircle, ArrowLeft, ShoppingCart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function CheckoutCancelPage() {
  return (
    <div className="container py-12 max-w-lg mx-auto">
      <Card>
        <CardHeader>
          <div className="flex flex-col items-center text-center gap-3">
            <div className="p-3 rounded-full bg-orange-100">
              <XCircle className="h-8 w-8 text-orange-500" />
            </div>
            <CardTitle>Pago cancelado</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            Tu pago fue cancelado y no se realizo ningun cobro. Puedes volver al catalogo para continuar comprando.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Link href="/catalog">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Volver al catalogo
              </Button>
            </Link>
            <Link href="/catalog">
              <Button className="gap-2">
                <ShoppingCart className="h-4 w-4" />
                Seguir comprando
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
