import Link from "next/link";
import { FileText, Landmark, Calculator, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AppSidebar() {
    return (
        <div className="flex h-screen w-64 flex-col border-r bg-slate-900 text-white">
            <div className="flex h-16 items-center border-b border-slate-700 px-6">
                <h2 className="text-lg font-bold tracking-tight">Versus Sports</h2>
            </div>
            <div className="flex-1 overflow-y-auto py-4">
                <nav className="flex flex-col space-y-1 px-3">
                    <Link href="/facturas" passHref>
                        <Button variant="ghost" className="w-full justify-start text-slate-300 hover:bg-slate-800 hover:text-white">
                            <Receipt className="mr-2 h-4 w-4" />
                            Facturas de compra
                        </Button>
                    </Link>
                    <Link href="/conciliaciones" passHref>
                        <Button variant="ghost" className="w-full justify-start text-slate-300 hover:bg-slate-800 hover:text-white">
                            <Landmark className="mr-2 h-4 w-4" />
                            Conciliaciones
                        </Button>
                    </Link>
                    <Link href="/ajustes" passHref>
                        <Button variant="ghost" className="w-full justify-start text-slate-300 hover:bg-slate-800 hover:text-white">
                            <Calculator className="mr-2 h-4 w-4" />
                            Ajustes contables
                        </Button>
                    </Link>
                </nav>
            </div>
            <div className="border-t border-slate-700 p-4">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-slate-700" />
                    <div className="text-sm">
                        <p className="font-medium">Usuario</p>
                        <p className="text-xs text-slate-400">admin@versus.com</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
