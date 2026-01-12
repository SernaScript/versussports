"use client";

import { useState } from "react";
import Link from "next/link";
import { Landmark, Calculator, Receipt, Key, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AppSidebar() {
    const [isCollapsed, setIsCollapsed] = useState(false);

    return (
        <div
            className={`flex h-screen flex-col border-r bg-slate-900 text-white transition-all duration-300 ${isCollapsed ? "w-16" : "w-64"
                }`}
        >
            <div className={`flex h-16 items-center border-b border-slate-700 ${isCollapsed ? "justify-center px-0" : "justify-between px-6"}`}>
                {!isCollapsed && <h2 className="text-lg font-bold tracking-tight whitespace-nowrap overflow-hidden">Versus Sports</h2>}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="text-slate-400 hover:text-white hover:bg-slate-800"
                >
                    {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </Button>
            </div>
            <div className="flex-1 overflow-y-auto py-4">
                <nav className="flex flex-col space-y-1 px-3">
                    <Link href="/facturas" passHref>
                        <Button
                            variant="ghost"
                            className={`w-full text-slate-300 hover:bg-slate-800 hover:text-white ${isCollapsed ? "justify-center px-0" : "justify-start"
                                }`}
                            title={isCollapsed ? "Facturas de compra" : undefined}
                        >
                            <Receipt className={`h-4 w-4 ${isCollapsed ? "mr-0" : "mr-2"}`} />
                            {!isCollapsed && "Facturas de compra"}
                        </Button>
                    </Link>
                    <Link href="/conciliaciones" passHref>
                        <Button
                            variant="ghost"
                            className={`w-full text-slate-300 hover:bg-slate-800 hover:text-white ${isCollapsed ? "justify-center px-0" : "justify-start"
                                }`}
                            title={isCollapsed ? "Conciliaciones" : undefined}
                        >
                            <Landmark className={`h-4 w-4 ${isCollapsed ? "mr-0" : "mr-2"}`} />
                            {!isCollapsed && "Conciliaciones"}
                        </Button>
                    </Link>
                    <Link href="/ajustes" passHref>
                        <Button
                            variant="ghost"
                            className={`w-full text-slate-300 hover:bg-slate-800 hover:text-white ${isCollapsed ? "justify-center px-0" : "justify-start"
                                }`}
                            title={isCollapsed ? "Ajustes contables" : undefined}
                        >
                            <Calculator className={`h-4 w-4 ${isCollapsed ? "mr-0" : "mr-2"}`} />
                            {!isCollapsed && "Ajustes contables"}
                        </Button>
                    </Link>
                    <Link href="/siigo" passHref>
                        <Button
                            variant="ghost"
                            className={`w-full text-slate-300 hover:bg-slate-800 hover:text-white ${isCollapsed ? "justify-center px-0" : "justify-start"
                                }`}
                            title={isCollapsed ? "Credenciales Siigo" : undefined}
                        >
                            <Key className={`h-4 w-4 ${isCollapsed ? "mr-0" : "mr-2"}`} />
                            {!isCollapsed && "Credenciales Siigo"}
                        </Button>
                    </Link>
                </nav>
            </div>
            <div className="border-t border-slate-700 p-4">
                <div className={`flex items-center gap-3 ${isCollapsed ? "justify-center" : ""}`}>
                    <div className="h-8 w-8 rounded-full bg-slate-700 flex-shrink-0" />
                    {!isCollapsed && (
                        <div className="text-sm overflow-hidden">
                            <p className="font-medium truncate">Usuario</p>
                            <p className="text-xs text-slate-400 truncate">admin@versus.com</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
