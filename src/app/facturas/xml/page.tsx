"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
    AlertCircle,
    Loader2,
    FileCode,
    Package,
    ArrowLeft,
    Calendar,
    Printer,
    Download,
    ChevronRight,
    Building2,
    Hash
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { parseInvoiceItems, formatXML, parseInvoiceHeader, parseCufeFromXml, InvoiceItem, InvoiceHeader } from "@/app/facturas/utils/xml-parser";
import { getDianInvoiceById } from "@/app/actions/facturas";
import { SiigoCausationModal } from "@/components/siigo-causation-modal";
import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

function XMLViewerContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const xmlUrl = searchParams.get("url");

    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [xmlContent, setXmlContent] = useState<string | null>(null);
    const [items, setItems] = useState<InvoiceItem[]>([]);
    const [invoiceHeader, setInvoiceHeader] = useState<InvoiceHeader | null>(null);
    const [activeTab, setActiveTab] = useState<"items" | "xml">("items");
    const [invoiceId, setInvoiceId] = useState<string | null>(null);
    const [dbInvoice, setDbInvoice] = useState<any>(null);
    const [isCausationModalOpen, setIsCausationModalOpen] = useState(false);

    useEffect(() => {
        if (xmlUrl) {
            setError(null);
            setLoading(true);
            setXmlContent(null);
            setItems([]);

            fetch(xmlUrl)
                .then((response) => {
                    if (!response.ok) {
                        throw new Error(`Error HTTP: ${response.status}`);
                    }
                    return response.text();
                })
                .then(async (text) => {
                    setXmlContent(text);
                    const parsedItems = parseInvoiceItems(text);
                    const header = parseInvoiceHeader(text);
                    setItems(parsedItems);
                    setInvoiceHeader(header);

                    // Extract CUFE and load invoice from database
                    const cufe = parseCufeFromXml(text);
                    if (cufe) {
                        setInvoiceId(cufe);
                        const invoiceResult = await getDianInvoiceById(cufe);
                        if (invoiceResult.success && invoiceResult.data) {
                            setDbInvoice(invoiceResult.data);
                        }
                    }

                    setLoading(false);
                })
                .catch((err) => {
                    console.error("❌ Error cargando XML:", err);
                    setError(err instanceof Error ? err.message : "Error al cargar el XML");
                    setLoading(false);
                });
        } else {
            setError("No se proporcionó una URL de XML");
        }
    }, [xmlUrl]);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat("es-CO", {
            style: "currency",
            currency: "COP",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value);
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return "N/A";
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return dateString;

            return new Intl.DateTimeFormat("es-CO", {
                year: "numeric",
                month: "long",
                day: "numeric",
            }).format(date);
        } catch {
            return dateString;
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="relative">
                    <div className="h-16 w-16 border-4 border-blue-100 rounded-full animate-pulse"></div>
                    <Loader2 className="h-16 w-16 text-blue-600 animate-spin absolute top-0 left-0" />
                </div>
                <div className="text-center space-y-2">
                    <p className="text-lg font-medium text-slate-800">Analizando Documento XML</p>
                    <p className="text-sm text-slate-500">Estamos extrayendo la información detallada...</p>
                </div>
            </div>
        );
    }

    if (error || !xmlUrl) {
        return (
            <div className="p-6 lg:p-12 flex items-center justify-center min-h-[60vh]">
                <Card className="max-w-md w-full border-none shadow-2xl">
                    <CardContent className="pt-12 pb-10 flex flex-col items-center text-center">
                        <div className="h-20 w-20 bg-red-50 rounded-full flex items-center justify-center mb-6">
                            <AlertCircle className="h-10 w-10 text-red-500" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 mb-2">¡Ups! Algo salió mal</h2>
                        <p className="text-slate-500 mb-8 px-4">
                            {error || "No se ha proporcionado un documento válido para visualizar."}
                        </p>
                        <div className="space-y-3 w-full px-8">
                            <Button onClick={() => router.push("/facturas")} className="w-full bg-slate-900 hover:bg-slate-800">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Volver a Facturas
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-[#f1f5f9]">
            {/* Action Bar Header - Inside XMLViewerContent to access state */}
            <div className="bg-white/90 backdrop-blur-xl border-b border-slate-200 px-6 py-4 sticky top-0 z-50">
                <div className="container mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => router.push("/facturas")}
                            className="bg-slate-100 border border-slate-200 text-slate-800 hover:bg-slate-200 h-10 w-10 rounded-full transition-all"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <span className="text-sm font-black text-slate-500 uppercase tracking-[0.3em]">Detalle de Factura</span>
                    </div>
                    <div className="flex items-center gap-3">
                        {invoiceId && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="border-indigo-200 text-indigo-700 font-black text-[11px] uppercase tracking-widest hover:bg-indigo-50"
                                onClick={() => setIsCausationModalOpen(true)}
                                disabled={!invoiceId || (dbInvoice?.isAccounted === true)}
                            >
                                <BadgeCheck className="mr-2 h-4 w-4" />
                                {dbInvoice?.isAccounted ? "Ya Contabilizado" : "Contabilizar"}
                            </Button>
                        )}
                        {dbInvoice?.pdfUrl && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="hidden sm:flex border-slate-200 text-slate-700 font-black text-[11px] uppercase tracking-widest hover:bg-slate-50"
                                onClick={() => window.open(dbInvoice.pdfUrl, "_blank")}
                            >
                                <Download className="mr-2 h-4 w-4" />
                                Descargar PDF
                            </Button>
                        )}
                        <div className="w-px h-6 bg-slate-200 mx-2 hidden sm:block"></div>
                        <Badge className="bg-slate-900 text-white border-none text-[10px] font-black uppercase tracking-widest py-1.5 px-4 shadow-sm">
                            DIAN Standard
                        </Badge>
                    </div>
                </div>
            </div>

            {/* STICKY TOP CONTAINER: Provider info + Tabs */}
            <div className="sticky top-[73px] z-40 bg-[#f1f5f9] pt-8 pb-4 border-b border-transparent">
                <div className="flex flex-col gap-2 mb-6">
                    <Badge variant="outline" className="w-fit bg-white/80 text-slate-600 border-slate-300 text-xs py-0.5 px-3 font-bold mb-2 shadow-sm">
                        PROVEEDOR EMISOR
                    </Badge>
                    <h1 className="text-4xl lg:text-5xl font-black text-slate-900 uppercase tracking-tight leading-tight">
                        {invoiceHeader?.issuerName || "N/A"}
                    </h1>
                    <div className="flex flex-wrap items-center gap-x-10 gap-y-2 mt-2">
                        <h2 className="text-2xl lg:text-3xl font-black text-blue-600 uppercase tracking-tighter flex items-center gap-3">
                            <span className="text-slate-900 font-bold text-xl uppercase tracking-normal">Factura No.</span>
                            {invoiceHeader?.prefix}{invoiceHeader?.folio}
                        </h2>
                        <h3 className="text-lg lg:text-xl font-bold text-slate-500 flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-slate-400" />
                            {invoiceHeader?.issueDate ? formatDate(invoiceHeader.issueDate) : "---"}
                        </h3>
                    </div>
                </div>

                {/* Tabs also sticky as part of the header area */}
                <div className="flex items-center gap-10 border-b border-slate-200 bg-[#f1f5f9]">
                    <button
                        onClick={() => setActiveTab("items")}
                        className={cn(
                            "pb-4 text-xs font-black transition-all relative uppercase tracking-[0.2em]",
                            activeTab === "items" ? "text-blue-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600" : "text-slate-400 hover:text-slate-600"
                        )}
                    >
                        Detalle de Facturación
                    </button>
                    <button
                        onClick={() => setActiveTab("xml")}
                        className={cn(
                            "pb-4 text-xs font-black transition-all relative uppercase tracking-[0.2em]",
                            activeTab === "xml" ? "text-blue-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600" : "text-slate-400 hover:text-slate-600"
                        )}
                    >
                        Código Fuente XML
                    </button>
                </div>
            </div>

            {/* MAIN CONTENT AREA */}
            <div className="mt-8">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start relative">

                    {/* Left Column: Stat Cards - Stays sticky while table scrolls */}
                    <div className="lg:col-span-1 space-y-4 sticky top-[360px]">
                        {/* Comparison Card - Show DB vs XML values */}
                        {dbInvoice && (
                            <Card className="border-none shadow-sm bg-amber-50/50 overflow-hidden border border-amber-200">
                                <CardContent className="p-6">
                                    <p className="text-xs font-black text-amber-700 uppercase tracking-[0.1em] mb-3">Comparación: BD vs XML</p>
                                    <div className="space-y-3 text-xs">
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-600 font-medium">Total:</span>
                                            <div className="flex flex-col items-end gap-0.5">
                                                <span className={cn(
                                                    "font-bold",
                                                    Math.abs((dbInvoice.total - (invoiceHeader?.legalMonetaryTotal?.payableAmount || 0))) > 1
                                                        ? "text-red-600"
                                                        : "text-green-600"
                                                )}>
                                                    BD: {formatCurrency(dbInvoice.total)}
                                                </span>
                                                <span className="text-slate-500">
                                                    XML: {formatCurrency(invoiceHeader?.legalMonetaryTotal?.payableAmount || 0)}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-600 font-medium">IVA:</span>
                                            <div className="flex flex-col items-end gap-0.5">
                                                <span className={cn(
                                                    "font-bold",
                                                    Math.abs((dbInvoice.vat - (invoiceHeader?.totalTaxAmount || 0))) > 1
                                                        ? "text-red-600"
                                                        : "text-green-600"
                                                )}>
                                                    BD: {formatCurrency(dbInvoice.vat)}
                                                </span>
                                                <span className="text-slate-500">
                                                    XML: {formatCurrency(invoiceHeader?.totalTaxAmount || 0)}
                                                </span>
                                            </div>
                                        </div>
                                        {dbInvoice.isAccounted && (
                                            <div className="pt-2 border-t border-amber-200">
                                                <Badge className="bg-green-100 text-green-700 border-none text-[10px] font-black">
                                                    ✓ Contabilizado
                                                </Badge>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Subtotal Card */}
                        <Card className="border-none shadow-sm bg-white overflow-hidden">
                            <CardContent className="p-6">
                                <p className="text-xs font-black text-slate-500 uppercase tracking-[0.1em] mb-1">Subtotal</p>
                                <h3 className="text-xl font-extrabold text-slate-800">
                                    {formatCurrency(invoiceHeader?.legalMonetaryTotal?.lineExtensionAmount || 0)}
                                </h3>
                            </CardContent>
                        </Card>

                        {/* Taxes Detailed Card */}
                        <Card className="border-none shadow-sm bg-white overflow-hidden">
                            <CardContent className="p-6">
                                <p className="text-xs font-black text-slate-500 uppercase tracking-[0.1em] mb-3">Impuestos Totales</p>
                                <h3 className="text-xl font-extrabold text-slate-800 mb-4 pb-3 border-b border-slate-100">
                                    {formatCurrency(invoiceHeader?.totalTaxAmount || 0)}
                                </h3>
                                <div className="space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                                    {invoiceHeader?.taxSubtotals.map((tax, index) => (
                                        <div key={index} className="space-y-1.5 bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                                            <div className="flex justify-between items-center text-xs font-black text-blue-600 uppercase tracking-tighter">
                                                <span>{tax.taxSchemeName}</span>
                                                <Badge variant="secondary" className="bg-blue-50 text-blue-700 text-[10px] font-black border-none">{tax.percent}%</Badge>
                                            </div>
                                            <div className="flex justify-between text-[11px] text-slate-500 font-bold uppercase tracking-tighter">
                                                <span>Base:</span>
                                                <span>{formatCurrency(tax.taxableAmount)}</span>
                                            </div>
                                            <div className="flex justify-between text-xs font-black text-slate-800 pt-1 border-t border-slate-200/50 mt-1">
                                                <span>Valor:</span>
                                                <span>{formatCurrency(tax.taxAmount)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Total Pay Card */}
                        <Card className="border-none shadow-sm bg-blue-600 text-white overflow-hidden shadow-lg shadow-blue-200">
                            <CardContent className="p-6">
                                <p className="text-xs font-black text-blue-100 uppercase tracking-[0.1em] mb-1">Total a Pagar</p>
                                <h3 className="text-3xl font-black">
                                    {formatCurrency(invoiceHeader?.legalMonetaryTotal?.payableAmount || 0)}
                                </h3>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right Column: Dynamic Content - Scrolls below sticky tabs */}
                    <div className="lg:col-span-3 pb-20">
                        {activeTab === "items" ? (
                            <Card className="border-none shadow-sm bg-white overflow-hidden">
                                <CardContent className="p-0">
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="border-none bg-slate-50/80">
                                                    <TableHead className="text-xs font-black uppercase py-5 pl-6 text-slate-900 sticky top-0 bg-slate-50 z-20 backdrop-blur-sm border-b border-slate-100">Concepto / Descripción</TableHead>
                                                    <TableHead className="text-xs font-black uppercase text-right py-5 text-slate-900 sticky top-0 bg-slate-50 z-20 backdrop-blur-sm border-b border-slate-100">Cant.</TableHead>
                                                    <TableHead className="text-xs font-black uppercase text-right py-5 text-slate-900 sticky top-0 bg-slate-50 z-20 backdrop-blur-sm border-b border-slate-100">P. Unitario</TableHead>
                                                    <TableHead className="text-xs font-black uppercase text-right py-5 pr-6 text-slate-900 sticky top-0 bg-slate-50 z-20 backdrop-blur-sm border-b border-slate-100">Total</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {items.length > 0 ? (
                                                    items.map((item, index) => (
                                                        <TableRow key={index} className="group hover:bg-slate-50/50 border-slate-100">
                                                            <TableCell className="py-7 pl-6">
                                                                <div className="flex flex-col gap-1.5">
                                                                    <span className="text-sm font-black text-slate-900 uppercase leading-snug tracking-tight">{item.description}</span>
                                                                    <div className="flex items-center gap-3">
                                                                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-mono font-bold tracking-tighter uppercase border border-slate-200">Ref: {item.lineId}</span>
                                                                        {item.brandName && <span className="text-xs text-slate-400 font-bold uppercase tracking-tight">Marca: {item.brandName}</span>}
                                                                    </div>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-right text-sm text-slate-700 font-black">
                                                                {item.quantity.toLocaleString("es-CO")}
                                                                <span className="text-xs text-slate-400 ml-1.5 font-bold uppercase">{item.unitCode || "un"}</span>
                                                            </TableCell>
                                                            <TableCell className="text-right text-sm text-slate-600 font-bold">
                                                                {item.priceAmount !== undefined ? formatCurrency(item.priceAmount) : "-"}
                                                            </TableCell>
                                                            <TableCell className="text-right py-7 pr-6">
                                                                <span className="text-lg font-black text-slate-900 tracking-tighter">{formatCurrency(item.lineExtensionAmount)}</span>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))
                                                ) : (
                                                    <TableRow>
                                                        <TableCell colSpan={4} className="h-60 text-center">
                                                            <p className="text-slate-400 text-sm font-black uppercase tracking-[0.2em] opacity-40">Sin líneas de detalle registradas</p>
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="p-0 bg-[#0f172a] rounded-3xl overflow-hidden min-h-[700px] border border-white/10 shadow-3xl">
                                <div className="p-10">
                                    <pre className="text-[12px] font-mono leading-relaxed text-blue-100/80 overflow-x-auto whitespace-pre custom-scrollbar">
                                        <code>{xmlContent ? formatXML(xmlContent) : "Sin contenido"}</code>
                                    </pre>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {invoiceId && (
                <SiigoCausationModal
                    invoiceId={invoiceId}
                    open={isCausationModalOpen}
                    onOpenChange={setIsCausationModalOpen}
                    onSuccess={async () => {
                        // Reload invoice data after successful causation
                        if (invoiceId) {
                            const invoiceResult = await getDianInvoiceById(invoiceId);
                            if (invoiceResult.success && invoiceResult.data) {
                                setDbInvoice(invoiceResult.data);
                            }
                        }
                    }}
                />
            )}
        </div>
    );
}

export default function XMLViewerPage() {
    return (
        <div className="min-h-screen bg-[#f1f5f9] text-slate-900">
            <div className="container mx-auto px-6 lg:px-12">
                <Suspense fallback={
                    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                        <div className="h-12 w-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
                    </div>
                }>
                    <XMLViewerContent />
                </Suspense>
            </div>

            <style jsx global>{`
                @import url('https://fonts.googleapis.com/css2?family=Public+Sans:wght@300;400;500;600;700;800;900&display=swap');
                
                body {
                    font-family: 'Public Sans', sans-serif;
                    overflow-x: hidden;
                    background-color: #f1f5f9;
                }

                .custom-scrollbar::-webkit-scrollbar {
                    width: 7px;
                    height: 7px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(0, 0, 0, 0.1);
                    border-radius: 20px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(0, 0, 0, 0.2);
                }
            `}</style>
        </div>
    );
}
