"use client";

import { useState, useEffect, useMemo } from "react";
import { Receipt, Upload, Calendar, Building2, FileText, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProcessedDianInvoice } from "./utils/dian-file-validator";
import { getDianInvoices } from "@/app/actions/facturas";
import { UploadDianModal } from "@/components/upload-dian-modal";
import { DownloadInvoicesModal } from "@/components/download-invoices-modal";

type ItemsPerPage = 20 | 40 | 60;

export default function FacturasPage() {
    const [invoices, setInvoices] = useState<ProcessedDianInvoice[]>([]);
    const [itemsPerPage, setItemsPerPage] = useState<ItemsPerPage>(20);
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);

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
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value);
    };

    // Filter invoices based on group and exclude "Application response" documents
    const filteredInvoices = useMemo(() => {
        // First, exclude "Application response" documents
        let result = invoices.filter((invoice) => {
            const documentType = invoice.documentType?.toLowerCase() || "";
            return !documentType.includes("application response");
        });

        // Then apply group filter (Always "Recibido")
        result = result.filter((invoice) => {
            const group = invoice.group?.toLowerCase() || "";
            return group.includes("recibido") || group.includes("recibida");
        });

        return result;
    }, [invoices]);

    // Paginate invoices
    const paginatedInvoices = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        return filteredInvoices.slice(startIndex, endIndex);
    }, [filteredInvoices, currentPage, itemsPerPage]);

    const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);

    useEffect(() => {
        setCurrentPage(1);
    }, [itemsPerPage]);

    const formatDate = (dateString: string) => {
        try {
            const date = new Date(dateString);
            return new Intl.DateTimeFormat("es-CO", {
                year: "numeric",
                month: "short",
                day: "numeric",
            }).format(date);
        } catch {
            return "-";
        }
    };

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
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        onClick={() => setIsDownloadModalOpen(true)}
                    >
                        <Download className="mr-2 h-4 w-4" />
                        Descargar Facturas
                    </Button>
                    <Button onClick={() => setIsUploadModalOpen(true)}>
                        <Upload className="mr-2 h-4 w-4" />
                        Subir Excel DIAN
                    </Button>
                </div>
            </div>

            <Card className="shadow-lg">
                <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-slate-100/50">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <CardTitle className="flex items-center gap-2 text-xl">
                            <Receipt className="h-6 w-6 text-primary" />
                            Facturas de Compra
                            <Badge variant="secondary" className="ml-2">
                                {filteredInvoices.length}
                            </Badge>
                        </CardTitle>
                        <div className="flex items-center gap-3 flex-wrap">
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground whitespace-nowrap">Mostrar:</span>
                                <Select
                                    value={itemsPerPage.toString()}
                                    onValueChange={(value) => {
                                        setItemsPerPage(Number(value) as ItemsPerPage);
                                    }}
                                >
                                    <SelectTrigger className="w-[100px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="20">20</SelectItem>
                                        <SelectItem value="40">40</SelectItem>
                                        <SelectItem value="60">60</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <Receipt className="h-16 w-16 text-muted-foreground mb-4 opacity-50 animate-pulse" />
                            <h3 className="text-lg font-medium mb-2">Cargando facturas...</h3>
                            <p className="text-sm text-muted-foreground">Por favor espere...</p>
                        </div>
                    ) : invoices.length > 0 ? (
                        <>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                                            <TableHead className="font-semibold">Número de Factura</TableHead>
                                            <TableHead className="font-semibold">Tipo de Documento</TableHead>
                                            <TableHead className="font-semibold">Fecha</TableHead>
                                            <TableHead className="font-semibold">NIT Emisor</TableHead>
                                            <TableHead className="font-semibold">Nombre Emisor</TableHead>
                                            <TableHead className="text-right font-semibold">IVA</TableHead>
                                            <TableHead className="text-right font-semibold">INC</TableHead>
                                            <TableHead className="text-right font-semibold">Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {paginatedInvoices.length > 0 ? (
                                            paginatedInvoices.map((invoice, index) => (
                                                <TableRow
                                                    key={invoice.id}
                                                    className="hover:bg-slate-50/50 transition-colors border-b"
                                                >
                                                    <TableCell className="font-medium text-sm">
                                                        <div className="flex items-center gap-2">
                                                            <FileText className="h-4 w-4 text-muted-foreground" />
                                                            <span>
                                                                {invoice.prefix ? `${invoice.prefix}${invoice.folio ? `-${invoice.folio}` : ''}` : (invoice.folio || "-")}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-sm">
                                                        <Badge variant="outline" className="font-normal">
                                                            {invoice.documentType || "-"}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-sm">
                                                        <div className="flex items-center gap-1.5 text-muted-foreground">
                                                            <Calendar className="h-3.5 w-3.5" />
                                                            {invoice.issueDate ? formatDate(invoice.issueDate) : "-"}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="whitespace-nowrap text-sm font-mono">
                                                        {invoice.issuerNit || "-"}
                                                    </TableCell>
                                                    <TableCell className="max-w-[280px]">
                                                        <div className="flex items-center gap-2">
                                                            <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                                            <span className="truncate text-sm">
                                                                {invoice.issuerName || "-"}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right text-sm">
                                                        <span className="text-muted-foreground">
                                                            {formatCurrency(invoice.vat || 0)}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-right text-sm">
                                                        <span className="text-muted-foreground">
                                                            {formatCurrency(invoice.inc || 0)}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <span className="font-semibold text-base text-primary">
                                                            {formatCurrency(invoice.total || 0)}
                                                        </span>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell
                                                    colSpan={8}
                                                    className="text-center py-12 text-muted-foreground"
                                                >
                                                    <div className="flex flex-col items-center gap-2">
                                                        <Receipt className="h-10 w-10 opacity-50" />
                                                        <p>No hay facturas que coincidan con el filtro seleccionado.</p>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                            {totalPages > 1 && (
                                <div className="border-t bg-slate-50/30 px-6 py-4 flex items-center justify-between">
                                    <div className="text-sm text-muted-foreground">
                                        Mostrando {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredInvoices.length)} de {filteredInvoices.length} facturas
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                            disabled={currentPage === 1}
                                        >
                                            Anterior
                                        </Button>
                                        <div className="flex items-center gap-1">
                                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                                let pageNum;
                                                if (totalPages <= 5) {
                                                    pageNum = i + 1;
                                                } else if (currentPage <= 3) {
                                                    pageNum = i + 1;
                                                } else if (currentPage >= totalPages - 2) {
                                                    pageNum = totalPages - 4 + i;
                                                } else {
                                                    pageNum = currentPage - 2 + i;
                                                }
                                                return (
                                                    <Button
                                                        key={pageNum}
                                                        variant={currentPage === pageNum ? "default" : "outline"}
                                                        size="sm"
                                                        onClick={() => setCurrentPage(pageNum)}
                                                        className="min-w-[40px]"
                                                    >
                                                        {pageNum}
                                                    </Button>
                                                );
                                            })}
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                            disabled={currentPage === totalPages}
                                        >
                                            Siguiente
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <Receipt className="h-16 w-16 text-muted-foreground mb-4 opacity-50" />
                            <h3 className="text-lg font-medium mb-2">No hay facturas cargadas</h3>
                            <p className="text-sm text-muted-foreground mb-6 max-w-md">
                                Use el botón "Subir Excel DIAN" para cargar facturas desde un archivo Excel.
                            </p>
                            <Button onClick={() => setIsUploadModalOpen(true)} size="lg">
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

            <DownloadInvoicesModal
                open={isDownloadModalOpen}
                onOpenChange={setIsDownloadModalOpen}
                onSuccess={(data) => {
                    console.log("Scraping completado:", data);
                    // Aquí puedes procesar los datos del scraping si es necesario
                }}
            />
        </div >
    );
}
