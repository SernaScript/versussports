"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
    Receipt,
    Upload,
    Calendar,
    Building2,
    FileText,
    Download,
    CheckCircle2,
    XCircle,
    Circle,
    Search,
    Filter,
    Plus,
    RefreshCw,
    MoreVertical,
    Trash2,
    DollarSign,
    ArrowUpDown,
    DownloadCloud
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ProcessedDianInvoice } from "./utils/dian-file-validator";
import { getDianInvoices } from "@/app/actions/facturas";
import { UploadDianModal } from "@/components/upload-dian-modal";
import { DownloadInvoicesModal } from "@/components/download-invoices-modal";
import { PDFViewerModal } from "@/components/pdf-viewer-modal";
import { Eye, FileCode } from "lucide-react";
import { LoadingSection } from "@/components/ui/loading-section";
import {
    Tabs,
    TabsList,
    TabsTrigger
} from "@/components/ui/tabs";

type ItemsPerPage = 20 | 40 | 60;

export default function FacturasPage() {
    const router = useRouter();
    const [invoices, setInvoices] = useState<ProcessedDianInvoice[]>([]);
    const [itemsPerPage, setItemsPerPage] = useState<ItemsPerPage>(20);
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
    const [selectedPdfUrl, setSelectedPdfUrl] = useState<string | null>(null);
    const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [activeTab, setActiveTab] = useState("all");
    const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);

    useEffect(() => {
        // Load invoices from database
        const loadInvoices = async () => {
            setIsLoading(true);
            try {
                const result = await getDianInvoices();
                if (result.success && result.data) {
                    // Debug: verificar el primer invoice para ver qué campos tiene
                    if (result.data.length > 0) {
                        console.log("Primer invoice desde getDianInvoices:", {
                            id: result.data[0].id,
                            pdfUrl: result.data[0].pdfUrl,
                            PDFURL: result.data[0].PDFURL,
                            pdf_url: result.data[0].pdf_url,
                        });
                    }
                    // Convert database format to ProcessedDianInvoice format
                    const convertedInvoices: ProcessedDianInvoice[] = result.data.map((dbInvoice: any) => ({
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
                        isDownloaded: Boolean(dbInvoice.isDownloaded || dbInvoice.is_downloaded),
                        isAccounted: Boolean(dbInvoice.isAccounted || dbInvoice.is_accounted),
                        pdfUrl: dbInvoice.pdfUrl || undefined,
                        xmlUrl: dbInvoice.xmlUrl || undefined,
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

    const filteredInvoices = useMemo(() => {
        // First, exclude "Application response" documents
        let result = invoices.filter((invoice) => {
            const documentType = invoice.documentType?.toLowerCase() || "";
            return !documentType.includes("application response");
        });

        // Apply search filter
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter((invoice) =>
                invoice.issuerName?.toLowerCase().includes(term) ||
                invoice.folio?.toLowerCase().includes(term) ||
                invoice.issuerNit?.toLowerCase().includes(term)
            );
        }

        // Apply tab filter
        if (activeTab !== "all") {
            result = result.filter((invoice) => {
                const status = (invoice.status || "").toLowerCase();
                if (activeTab === "por-pagar") return status === "por pagar";
                if (activeTab === "por-causar") return status === "por causar";
                // Add more mappings as needed
                return true;
            });
        }

        // Then apply group filter (Always "Recibido") or check if it is explicitly downloaded
        result = result.filter((invoice) => {
            const group = invoice.group?.toLowerCase() || "";
            return (
                group.includes("recibido") ||
                group.includes("recibida") ||
                Boolean(invoice.isDownloaded) ||
                Boolean(invoice.isAccounted)
            );
        });

        return result;
    }, [invoices, searchTerm, activeTab]);

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
                year: "2-digit",
                month: "2-digit",
                day: "2-digit",
            }).format(date);
        } catch {
            return "-";
        }
    };

    const loadInvoicesFromDB = async () => {
        setIsLoading(true);
        try {
            const result = await getDianInvoices();
            if (result.success && result.data) {
                console.log("Raw invoice data from DB:", result.data[0]);
                const convertedInvoices: ProcessedDianInvoice[] = result.data.map((dbInvoice: any) => ({
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
                    isDownloaded: Boolean(dbInvoice.isDownloaded || dbInvoice.is_downloaded),
                    isAccounted: Boolean(dbInvoice.isAccounted || dbInvoice.is_accounted),
                    pdfUrl: dbInvoice.pdfUrl || undefined,
                    xmlUrl: dbInvoice.xmlUrl || undefined,
                }));
                setInvoices(convertedInvoices);
            }
        } catch (error) {
            console.error("Error loading invoices:", error);
        } finally {
            setIsLoading(false);
        }
    };
    const handleUploadSuccess = (data: ProcessedDianInvoice[]) => {
        // Reload invoices from database
        loadInvoicesFromDB();
    };

    const handleDownloadSuccess = (data: any) => {
        // Reload invoices from database after download
        console.log("Descarga completada:", data);
        loadInvoicesFromDB();
    };

    return (
        <div className="flex flex-col h-full bg-[#f8fafc]">
            {/* Header Content */}
            <div className="px-6 py-6 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>Proveedores</span>
                            <span>/</span>
                            <span className="text-foreground font-medium">Documentos</span>
                        </div>
                        <h1 className="text-2xl font-bold text-[#1e293b]">Documentos</h1>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm">
                            Actualizado: {new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <Button
                            variant="outline"
                            className="bg-white hover:bg-slate-50 border-slate-200 text-slate-700 shadow-sm"
                            onClick={() => setIsDownloadModalOpen(true)}
                        >
                            <RefreshCw className="mr-2 h-4 w-4 text-blue-500" />
                            Sincronizar DIAN
                        </Button>
                        <Button
                            className="bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-100"
                            onClick={() => setIsUploadModalOpen(true)}
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            Nuevo documento
                        </Button>
                    </div>
                </div>

                {/* Tabs / States */}
                <Tabs defaultValue="all" className="w-full" onValueChange={setActiveTab}>
                    <TabsList className="bg-transparent border-b rounded-none w-full justify-start h-auto p-0 gap-6">
                        <TabsTrigger
                            value="all"
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 pb-3 text-slate-500 hover:text-slate-700"
                        >
                            Ver todo
                        </TabsTrigger>
                        <TabsTrigger
                            value="por-aprobar"
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 pb-3 text-slate-500 hover:text-slate-700"
                        >
                            Por aprobar
                        </TabsTrigger>
                        <TabsTrigger
                            value="por-pagar"
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 pb-3 text-slate-500 hover:text-slate-700"
                        >
                            Por pagar
                        </TabsTrigger>
                        <TabsTrigger
                            value="por-causar"
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 pb-3 text-slate-500 hover:text-slate-700"
                        >
                            Por causar
                        </TabsTrigger>
                        <TabsTrigger
                            value="causados"
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 pb-3 text-slate-500 hover:text-slate-700"
                        >
                            Causados
                        </TabsTrigger>
                        <TabsTrigger
                            value="eventos-dian"
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 pb-3 text-slate-500 hover:text-slate-700"
                        >
                            Eventos DIAN
                        </TabsTrigger>
                    </TabsList>
                </Tabs>

                {/* Filters & Search */}
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Buscar por concepto o CUFE"
                                className="pl-10 bg-white border-slate-200 ring-offset-blue-600 focus-visible:ring-1 focus-visible:ring-blue-600 h-10"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <Button variant="ghost" className="h-10 text-slate-600 hover:bg-slate-100 px-3">
                            <Building2 className="mr-2 h-4 w-4" />
                            Proveedor
                        </Button>
                        <Button variant="ghost" className="h-10 text-slate-600 hover:bg-slate-100 px-3">
                            <Filter className="mr-2 h-4 w-4" />
                            Tipo
                        </Button>
                        <Button variant="ghost" className="h-10 text-slate-600 hover:bg-slate-100 px-3">
                            <Calendar className="mr-2 h-4 w-4" />
                            Fecha de emisión
                        </Button>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="text-slate-400 hover:text-blue-600">
                            <DownloadCloud className="h-5 w-5" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 px-6 pb-6 overflow-hidden">
                <Card className="h-full flex flex-col border-slate-200 shadow-sm overflow-hidden bg-white p-0 gap-0">
                    <div className="flex-1 overflow-auto relative scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                        {isLoading ? (
                            <LoadingSection />
                        ) : invoices.length > 0 ? (
                            <table className="w-full border-separate border-spacing-0">
                                <thead className="sticky top-0 z-30">
                                    <tr className="bg-slate-50">
                                        <th className="w-[60px] px-4 py-5 sticky top-0 bg-slate-50 border-b border-slate-200 z-40">
                                            <div className="flex items-center justify-center">
                                                <input
                                                    type="checkbox"
                                                    className="h-4 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-600 cursor-pointer"
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedInvoices(paginatedInvoices.map(i => i.id || ""));
                                                        } else {
                                                            setSelectedInvoices([]);
                                                        }
                                                    }}
                                                />
                                            </div>
                                        </th>
                                        <th className="w-[140px] text-slate-500 font-bold py-5 px-4 text-[11px] uppercase tracking-widest sticky top-0 bg-slate-50 border-b border-slate-200 text-left z-40">
                                            Fecha <ArrowUpDown className="inline h-3 w-3 ml-1 text-slate-400" />
                                        </th>
                                        <th className="min-w-[250px] text-slate-500 font-bold py-5 px-4 text-[11px] uppercase tracking-widest sticky top-0 bg-slate-50 border-b border-slate-200 text-left z-40">
                                            Nombre Emisor
                                        </th>
                                        <th className="w-[160px] text-slate-500 font-bold py-5 px-4 text-[11px] uppercase tracking-widest sticky top-0 bg-slate-50 border-b border-slate-200 text-right z-40">
                                            Valor Impuesto
                                        </th>
                                        <th className="w-[160px] text-slate-500 font-bold py-5 px-4 text-[11px] uppercase tracking-widest sticky top-0 bg-slate-50 border-b border-slate-200 text-right z-40">
                                            Total <ArrowUpDown className="inline h-3 w-3 ml-1 text-slate-400" />
                                        </th>
                                        <th className="w-[130px] text-slate-500 font-bold py-5 px-4 text-[11px] uppercase tracking-widest sticky top-0 bg-slate-50 border-b border-slate-200 text-center z-40">
                                            Descargado
                                        </th>
                                        <th className="w-[130px] text-slate-500 font-bold py-5 px-4 text-[11px] uppercase tracking-widest sticky top-0 bg-slate-50 border-b border-slate-200 text-center z-40">
                                            Contabilizado
                                        </th>
                                        <th className="w-[120px] text-slate-500 font-bold py-5 px-4 text-[11px] uppercase tracking-widest sticky top-0 bg-slate-50 border-b border-slate-200 text-center z-40">
                                            Acciones
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedInvoices.length > 0 ? (
                                        paginatedInvoices.map((invoice) => (
                                            <tr
                                                key={invoice.id}
                                                className="hover:bg-blue-50/30 transition-colors group border-b border-slate-100"
                                            >
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <div className="flex items-center justify-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedInvoices.includes(invoice.id || "")}
                                                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setSelectedInvoices(prev => [...prev, invoice.id || ""]);
                                                                } else {
                                                                    setSelectedInvoices(prev => prev.filter(id => id !== invoice.id));
                                                                }
                                                            }}
                                                        />
                                                    </div>
                                                </td>
                                                <td className="py-4 px-3 text-sm text-slate-500 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                                        {invoice.issueDate ? formatDate(invoice.issueDate) : "-"}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-3 whitespace-nowrap">
                                                    <div className="flex flex-col gap-0.5">
                                                        <div className="flex items-center gap-2">
                                                            <Building2 className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                                                            <span className="text-sm font-medium text-slate-700 truncate max-w-[200px]">
                                                                {invoice.issuerName || "-"}
                                                            </span>
                                                        </div>
                                                        <span className="text-[10px] text-slate-400 pl-5 uppercase">
                                                            NIT: {invoice.issuerNit || "-"}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="py-4 px-3 text-right text-xs font-medium text-slate-500 whitespace-nowrap">
                                                    {formatCurrency((invoice.vat || 0) + (invoice.inc || 0))}
                                                </td>
                                                <td className="py-4 px-3 text-right whitespace-nowrap">
                                                    <span className="font-bold text-slate-900">
                                                        {formatCurrency(invoice.total || 0)}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-3 text-center whitespace-nowrap">
                                                    <div className="flex justify-center">
                                                        {invoice.isDownloaded ? (
                                                            <CheckCircle2 className="h-5 w-5 text-emerald-500 shadow-sm rounded-full" />
                                                        ) : (
                                                            <Circle className="h-5 w-5 text-slate-200" strokeWidth={1} />
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-3 text-center whitespace-nowrap">
                                                    <div className="flex justify-center">
                                                        {invoice.isAccounted ? (
                                                            <CheckCircle2 className="h-5 w-5 text-blue-500 shadow-sm rounded-full" />
                                                        ) : (
                                                            <Circle className="h-5 w-5 text-slate-200" strokeWidth={1} />
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-3 whitespace-nowrap">
                                                    <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => {
                                                                setSelectedPdfUrl(invoice.pdfUrl || null);
                                                                setIsPdfModalOpen(true);
                                                            }}
                                                            className="h-8 w-8 text-blue-600 hover:bg-blue-50"
                                                            title="Ver PDF"
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => {
                                                                const encodedUrl = encodeURIComponent(invoice.xmlUrl || "");
                                                                router.push(`/facturas/xml?url=${encodedUrl}`);
                                                            }}
                                                            className="h-8 w-8 text-emerald-600 hover:bg-emerald-50"
                                                            title="Ver XML"
                                                        >
                                                            <FileCode className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={8} className="text-center py-20">
                                                <div className="flex flex-col items-center gap-3">
                                                    <div className="p-4 bg-slate-50 rounded-full">
                                                        <Receipt className="h-8 w-8 text-slate-300" />
                                                    </div>
                                                    <p className="text-slate-500 font-medium">No se encontraron documentos</p>
                                                    <p className="text-slate-400 text-sm">Prueba ajustando los filtros o realiza una nueva sincronización</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-24 text-center">
                                <div className="p-6 bg-blue-50 rounded-full mb-6">
                                    <Receipt className="h-12 w-12 text-blue-500" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-800 mb-2">No hay facturas cargadas</h3>
                                <p className="text-slate-500 mb-8 max-w-md">
                                    Sincroniza con la DIAN o sube tus archivos Excel para empezar a gestionar tus documentos.
                                </p>
                                <div className="flex items-center gap-3 justify-center">
                                    <Button onClick={() => setIsUploadModalOpen(true)} size="lg" className="bg-blue-600 hover:bg-blue-700">
                                        <Plus className="mr-2 h-4 w-4" />
                                        Nuevo documento
                                    </Button>
                                    <Button variant="outline" size="lg" onClick={() => setIsDownloadModalOpen(true)}>
                                        <RefreshCw className="mr-2 h-4 w-4" />
                                        Sincronizar DIAN
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>

                    {totalPages > 1 && (
                        <div className="px-6 py-4 border-t bg-white flex items-center justify-between">
                            <div className="flex items-center gap-4 text-sm text-slate-500 font-medium">
                                <span>Mostrar:</span>
                                <Select
                                    value={itemsPerPage.toString()}
                                    onValueChange={(value) => {
                                        setItemsPerPage(Number(value) as ItemsPerPage);
                                    }}
                                >
                                    <SelectTrigger className="w-[80px] h-8 border-slate-200">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="20">20</SelectItem>
                                        <SelectItem value="40">40</SelectItem>
                                        <SelectItem value="60">60</SelectItem>
                                    </SelectContent>
                                </Select>
                                <span>de {filteredInvoices.length} resultados</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                    className="text-slate-600"
                                >
                                    Anterior
                                </Button>
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    let pageNum;
                                    if (totalPages <= 5) pageNum = i + 1;
                                    else if (currentPage <= 3) pageNum = i + 1;
                                    else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                                    else pageNum = currentPage - 2 + i;

                                    return (
                                        <Button
                                            key={pageNum}
                                            variant={currentPage === pageNum ? "secondary" : "ghost"}
                                            size="sm"
                                            onClick={() => setCurrentPage(pageNum)}
                                            className={`w-8 h-8 p-0 ${currentPage === pageNum ? "bg-blue-50 text-blue-600 hover:bg-blue-100" : "text-slate-600"}`}
                                        >
                                            {pageNum}
                                        </Button>
                                    );
                                })}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={currentPage === totalPages}
                                    className="text-slate-600"
                                >
                                    Siguiente
                                </Button>
                            </div>
                        </div>
                    )}
                </Card>
            </div >

            <UploadDianModal
                open={isUploadModalOpen}
                onOpenChange={setIsUploadModalOpen}
                onUploadSuccess={handleUploadSuccess}
            />

            <DownloadInvoicesModal
                open={isDownloadModalOpen}
                onOpenChange={setIsDownloadModalOpen}
                onSuccess={handleDownloadSuccess}
            />

            <PDFViewerModal
                open={isPdfModalOpen}
                onOpenChange={setIsPdfModalOpen}
                pdfUrl={selectedPdfUrl}
                fileName="Factura Electrónica"
            />
        </div >
    );
}
