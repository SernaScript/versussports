"use client";

import { useState, useEffect, useMemo } from "react";
import { Receipt, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ProcessedDianInvoice } from "./utils/dian-file-validator";
import { getDianInvoices } from "@/app/actions/facturas";
import { UploadDianModal } from "@/components/upload-dian-modal";

type GroupFilter = "all" | "Emitido" | "Recibido";

export default function FacturasPage() {
    const [invoices, setInvoices] = useState<ProcessedDianInvoice[]>([]);
    const [groupFilter, setGroupFilter] = useState<GroupFilter>("all");
    const [isLoading, setIsLoading] = useState(true);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

    useEffect(() => {
        // Load invoices from database
        const loadInvoices = async () => {
            setIsLoading(true);
            try {
                const result = await getDianInvoices();
                if (result.success && result.data) {
                    // Convert database format to ProcessedDianInvoice format
                    const convertedInvoices: ProcessedDianInvoice[] = result.data.map((dbInvoice) => ({
                        id: dbInvoice.id,
                        documentType: dbInvoice.documentType,
                        folio: dbInvoice.folio,
                        prefix: dbInvoice.prefix,
                        issueDate: dbInvoice.issueDate.toISOString(),
                        issuerNit: dbInvoice.issuerNit,
                        issuerName: dbInvoice.issuerName,
                        receiverNit: dbInvoice.receiverNit,
                        receiverName: dbInvoice.receiverName,
                        vat: Number(dbInvoice.vat),
                        inc: Number(dbInvoice.inc),
                        total: Number(dbInvoice.total),
                        group: dbInvoice.group,
                        currency: dbInvoice.currency || undefined,
                        paymentMethod: dbInvoice.paymentMethod || undefined,
                        paymentMedium: dbInvoice.paymentMedium || undefined,
                        receptionDate: dbInvoice.receptionDate?.toISOString() || undefined,
                        ica: dbInvoice.ica ? Number(dbInvoice.ica) : undefined,
                        ic: dbInvoice.ic ? Number(dbInvoice.ic) : undefined,
                        stamp: dbInvoice.stamp ? Number(dbInvoice.stamp) : undefined,
                        incBags: dbInvoice.incBags ? Number(dbInvoice.incBags) : undefined,
                        carbonTax: dbInvoice.carbonTax ? Number(dbInvoice.carbonTax) : undefined,
                        fuelTax: dbInvoice.fuelTax ? Number(dbInvoice.fuelTax) : undefined,
                        dataTax: dbInvoice.dataTax ? Number(dbInvoice.dataTax) : undefined,
                        icl: dbInvoice.icl ? Number(dbInvoice.icl) : undefined,
                        inpp: dbInvoice.inpp ? Number(dbInvoice.inpp) : undefined,
                        ibua: dbInvoice.ibua ? Number(dbInvoice.ibua) : undefined,
                        icui: dbInvoice.icui ? Number(dbInvoice.icui) : undefined,
                        withheldVat: dbInvoice.withheldVat ? Number(dbInvoice.withheldVat) : undefined,
                        withheldIncome: dbInvoice.withheldIncome ? Number(dbInvoice.withheldIncome) : undefined,
                        withheldIca: dbInvoice.withheldIca ? Number(dbInvoice.withheldIca) : undefined,
                        status: dbInvoice.status || undefined,
                    }));
                    setInvoices(convertedInvoices);
                } else {
                    // Fallback to localStorage if database fails
                    const storedInvoices = localStorage.getItem("dian-invoices");
                    if (storedInvoices) {
                        try {
                            const parsed = JSON.parse(storedInvoices);
                            setInvoices(parsed);
                        } catch (error) {
                            console.error("Error loading invoices from localStorage:", error);
                        }
                    }
                }
            } catch (error) {
                console.error("Error loading invoices:", error);
                // Fallback to localStorage
                const storedInvoices = localStorage.getItem("dian-invoices");
                if (storedInvoices) {
                    try {
                        const parsed = JSON.parse(storedInvoices);
                        setInvoices(parsed);
                    } catch (err) {
                        console.error("Error loading invoices from localStorage:", err);
                    }
                }
            } finally {
                setIsLoading(false);
            }
        };

        loadInvoices();

        // Listen for new uploads
        const handleStorageChange = async () => {
            // Reload from database when invoices are updated
            await loadInvoices();
        };

        window.addEventListener("storage", handleStorageChange);
        
        // Also listen for custom event for same-window updates
        window.addEventListener("invoices-updated", handleStorageChange);

        return () => {
            window.removeEventListener("storage", handleStorageChange);
            window.removeEventListener("invoices-updated", handleStorageChange);
        };
    }, []);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat("es-CO", {
            style: "currency",
            currency: "COP",
        }).format(value);
    };

    // Filter invoices based on group
    const filteredInvoices = useMemo(() => {
        if (groupFilter === "all") {
            return invoices;
        }
        return invoices.filter((invoice) => {
            const group = invoice.group?.toLowerCase() || "";
            if (groupFilter === "Emitido") {
                return group.includes("emitido") || group.includes("emitida");
            }
            if (groupFilter === "Recibido") {
                return group.includes("recibido") || group.includes("recibida");
            }
            return true;
        });
    }, [invoices, groupFilter]);

    const handleUploadSuccess = (data: ProcessedDianInvoice[]) => {
        // Reload invoices from database
        const loadInvoices = async () => {
            setIsLoading(true);
            try {
                const result = await getDianInvoices();
                if (result.success && result.data) {
                    const convertedInvoices: ProcessedDianInvoice[] = result.data.map((dbInvoice) => ({
                        id: dbInvoice.id,
                        documentType: dbInvoice.documentType,
                        folio: dbInvoice.folio,
                        prefix: dbInvoice.prefix,
                        issueDate: dbInvoice.issueDate.toISOString(),
                        issuerNit: dbInvoice.issuerNit,
                        issuerName: dbInvoice.issuerName,
                        receiverNit: dbInvoice.receiverNit,
                        receiverName: dbInvoice.receiverName,
                        vat: Number(dbInvoice.vat),
                        inc: Number(dbInvoice.inc),
                        total: Number(dbInvoice.total),
                        group: dbInvoice.group,
                        currency: dbInvoice.currency || undefined,
                        paymentMethod: dbInvoice.paymentMethod || undefined,
                        paymentMedium: dbInvoice.paymentMedium || undefined,
                        receptionDate: dbInvoice.receptionDate?.toISOString() || undefined,
                        ica: dbInvoice.ica ? Number(dbInvoice.ica) : undefined,
                        ic: dbInvoice.ic ? Number(dbInvoice.ic) : undefined,
                        stamp: dbInvoice.stamp ? Number(dbInvoice.stamp) : undefined,
                        incBags: dbInvoice.incBags ? Number(dbInvoice.incBags) : undefined,
                        carbonTax: dbInvoice.carbonTax ? Number(dbInvoice.carbonTax) : undefined,
                        fuelTax: dbInvoice.fuelTax ? Number(dbInvoice.fuelTax) : undefined,
                        dataTax: dbInvoice.dataTax ? Number(dbInvoice.dataTax) : undefined,
                        icl: dbInvoice.icl ? Number(dbInvoice.icl) : undefined,
                        inpp: dbInvoice.inpp ? Number(dbInvoice.inpp) : undefined,
                        ibua: dbInvoice.ibua ? Number(dbInvoice.ibua) : undefined,
                        icui: dbInvoice.icui ? Number(dbInvoice.icui) : undefined,
                        withheldVat: dbInvoice.withheldVat ? Number(dbInvoice.withheldVat) : undefined,
                        withheldIncome: dbInvoice.withheldIncome ? Number(dbInvoice.withheldIncome) : undefined,
                        withheldIca: dbInvoice.withheldIca ? Number(dbInvoice.withheldIca) : undefined,
                        status: dbInvoice.status || undefined,
                    }));
                    setInvoices(convertedInvoices);
                }
            } catch (error) {
                console.error("Error loading invoices:", error);
            } finally {
                setIsLoading(false);
            }
        };
        loadInvoices();
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold tracking-tight">Facturas de Compra</h1>
                    <p className="text-muted-foreground">
                        Visualización de facturas cargadas desde archivos Excel de la DIAN.
                    </p>
                </div>
                <Button onClick={() => setIsUploadModalOpen(true)}>
                    <Upload className="mr-2 h-4 w-4" />
                    Subir Excel DIAN
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <Receipt className="h-5 w-5" />
                            Facturas ({filteredInvoices.length})
                        </CardTitle>
                        {invoices.length > 0 && (
                            <Select value={groupFilter} onValueChange={(value) => setGroupFilter(value as GroupFilter)}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Filtrar por grupo" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas</SelectItem>
                                    <SelectItem value="Emitido">Emitidas</SelectItem>
                                    <SelectItem value="Recibido">Recibidas</SelectItem>
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <Receipt className="h-12 w-12 text-muted-foreground mb-4 opacity-50 animate-pulse" />
                            <h3 className="text-lg font-medium mb-2">Cargando facturas...</h3>
                        </div>
                    ) : invoices.length > 0 ? (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Folio</TableHead>
                                        <TableHead>Prefijo</TableHead>
                                        <TableHead>NIT Emisor</TableHead>
                                        <TableHead>Nombre Emisor</TableHead>
                                        <TableHead className="text-right">IVA</TableHead>
                                        <TableHead className="text-right">INC</TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredInvoices.length > 0 ? (
                                        filteredInvoices.map((invoice) => (
                                            <TableRow key={invoice.id}>
                                                <TableCell className="font-medium">
                                                    {invoice.folio || "-"}
                                                </TableCell>
                                                <TableCell>{invoice.prefix || "-"}</TableCell>
                                                <TableCell className="whitespace-nowrap">
                                                    {invoice.issuerNit || "-"}
                                                </TableCell>
                                                <TableCell className="max-w-[250px] truncate">
                                                    {invoice.issuerName || "-"}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {formatCurrency(invoice.vat || 0)}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {formatCurrency(invoice.inc || 0)}
                                                </TableCell>
                                                <TableCell className="text-right font-semibold">
                                                    {formatCurrency(invoice.total || 0)}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell 
                                                colSpan={7} 
                                                className="text-center py-8 text-muted-foreground"
                                            >
                                                No hay facturas que coincidan con el filtro seleccionado.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <Receipt className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                            <h3 className="text-lg font-medium mb-2">No hay facturas cargadas</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                Use el botón "Subir Excel DIAN" para cargar facturas.
                            </p>
                            <Button onClick={() => setIsUploadModalOpen(true)}>
                                <Upload className="mr-2 h-4 w-4" />
                                Subir Excel DIAN
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            <UploadDianModal
                open={isUploadModalOpen}
                onOpenChange={setIsUploadModalOpen}
                onUploadSuccess={handleUploadSuccess}
            />
        </div>
    );
}
