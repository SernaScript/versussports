"use client";

import { useState } from "react";
import Link from "next/link";
import { Landmark, Calculator, Receipt, Key, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AppSidebar() {
    const [isCollapsed, setIsCollapsed] = useState(false);

    return (
        <div
            className={`flex h-screen flex-col border-r bg-[#0284c7] text-white transition-all duration-300 shadow-xl ${isCollapsed ? "w-16" : "w-64"
                }`}
        >
            <div className={`flex h-16 items-center border-b border-white/10 ${isCollapsed ? "justify-center px-0" : "justify-between px-6"}`}>
                {!isCollapsed && (
                    <h2 className="text-xl font-bold tracking-tight whitespace-nowrap overflow-hidden text-white drop-shadow-sm">
                        Versus Sports
                    </h2>
                )}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="text-white/80 hover:text-white hover:bg-white/20"
                >
                    {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
                </Button>
            </div>
            <div className="flex-1 overflow-y-auto py-6">
                <nav className="flex flex-col space-y-2 px-3">
                    <Link href="/facturas" passHref>
                        <Button
                            variant="ghost"
                            className={`w-full text-white/90 hover:bg-white/20 hover:text-white transition-colors h-10 px-4 group ${isCollapsed ? "justify-center px-0" : "justify-start"
                                }`}
                            title={isCollapsed ? "Facturas de compra" : undefined}
                        >
                            <Receipt className={`h-5 w-5 ${isCollapsed ? "mr-0" : "mr-3"} group-hover:scale-110 transition-transform`} />
                            {!isCollapsed && <span className="font-medium">Facturas de compra</span>}
                        </Button>
                    </Link>
                    <Link href="/conciliaciones" passHref>
                        <Button
                            variant="ghost"
                            className={`w-full text-white/90 hover:bg-white/20 hover:text-white transition-colors h-10 px-4 group ${isCollapsed ? "justify-center px-0" : "justify-start"
                                }`}
                            title={isCollapsed ? "Conciliaciones" : undefined}
                        >
                            <Landmark className={`h-5 w-5 ${isCollapsed ? "mr-0" : "mr-3"} group-hover:scale-110 transition-transform`} />
                            {!isCollapsed && <span className="font-medium">Conciliaciones</span>}
                        </Button>
                    </Link>
                    <Link href="/ajustes" passHref>
                        <Button
                            variant="ghost"
                            className={`w-full text-white/90 hover:bg-white/20 hover:text-white transition-colors h-10 px-4 group ${isCollapsed ? "justify-center px-0" : "justify-start"
                                }`}
                            title={isCollapsed ? "Ajustes contables" : undefined}
                        >
                            <Calculator className={`h-5 w-5 ${isCollapsed ? "mr-0" : "mr-3"} group-hover:scale-110 transition-transform`} />
                            {!isCollapsed && <span className="font-medium">Ajustes contables</span>}
                        </Button>
                    </Link>
                    <Link href="/siigo" passHref>
                        <Button
                            variant="ghost"
                            className={`w-full text-white/90 hover:bg-white/20 hover:text-white transition-colors h-10 px-4 group ${isCollapsed ? "justify-center px-0" : "justify-start"
                                }`}
                            title={isCollapsed ? "Credenciales Siigo" : undefined}
                        >
                            <Key className={`h-5 w-5 ${isCollapsed ? "mr-0" : "mr-3"} group-hover:scale-110 transition-transform`} />
                            {!isCollapsed && <span className="font-medium">Credenciales Siigo</span>}
                        </Button>
                    </Link>
                </nav>
            </div>
            <div className="border-t border-white/10 p-5 bg-black/5">
                <div className={`flex items-center gap-3 ${isCollapsed ? "justify-center" : ""}`}>
                    <div className="h-9 w-9 rounded-full bg-white/20 border border-white/30 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold">JD</span>
                    </div>
                    {!isCollapsed && (
                        <div className="text-sm overflow-hidden">
                            <p className="font-bold truncate text-white">Juan Diego</p>
                            <p className="text-xs text-white/70 truncate">admin@versus.com</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
