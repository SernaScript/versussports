import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <main className="max-w-5xl mx-auto space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Versus Colombia</h1>
            <p className="text-slate-500">Sistema de Contabilidad Anual</p>
          </div>
          <Button>Nuevo Registro</Button>
        </header>

        <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Ingresos Totales</CardTitle>
              <CardDescription>Año en curso</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">$0.00</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Gastos Totales</CardTitle>
              <CardDescription>Año en curso</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">$0.00</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Balance Neto</CardTitle>
              <CardDescription>Ingresos vs Gastos</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">$0.00</p>
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardTitle>Ingresar Movimiento</CardTitle>
              <CardDescription>Registra un nuevo ingreso o gasto</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date">Fecha</Label>
                    <Input id="date" type="date" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amount">Monto</Label>
                    <Input id="amount" type="number" placeholder="0.00" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="description">Descripción</Label>
                    <Input id="description" placeholder="Concepto del movimiento" />
                  </div>
                </div>
                <div className="flex justify-end gap-4 mt-4">
                  <Button variant="outline" type="button">Cancelar</Button>
                  <Button type="submit">Guardar Registro</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
