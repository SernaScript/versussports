"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Upload, FileSpreadsheet, Save, Loader2, Settings2, CheckCircle2, AlertCircle, FileStack, ListFilter, PlusCircle, Check } from "lucide-react";
import { format, addMinutes } from "date-fns";
import { es } from "date-fns/locale";
import * as XLSX from "xlsx";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

import { getBankPeriodById, saveBankTransactions } from "@/app/actions/conciliaciones";
import { processBankExpenses, getConsolidatedExpenses, approveMatchedExpenses } from "@/app/actions/accounting";
import { getSiigoAccounts, createBankExpenseConcept, getSiigoSettings, getDocumentTypes } from "@/app/actions/ajustes";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter
} from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// Helper to format currency without decimals
const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        maximumFractionDigits: 0,
    }).format(amount);
};

// Helper to format dates correctly ignoring timezone shift
const formatDateSafe = (date: Date | string, formatStr: string) => {
    const d = new Date(date);
    // Add timezone offset to keep the same day
    const adjustedDate = addMinutes(d, d.getTimezoneOffset());
    return format(adjustedDate, formatStr, { locale: es });
};

export default function PeriodDetailPage() {
    const params = useParams();
    const router = useRouter();
    const periodId = params.periodId as string;

    const [period, setPeriod] = useState<any>(null);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // File upload states
    const [files, setFiles] = useState<File[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processedData, setProcessedData] = useState<any[]>([]);
    const [view, setView] = useState<"list" | "upload" | "preview" | "consolidated">("list");
    const [isSaving, setIsSaving] = useState(false);
    const [isAccounting, setIsAccounting] = useState(false);
    const [isApproving, setIsApproving] = useState(false);
    const [consolidatedData, setConsolidatedData] = useState<any>(null);
    const [unmatchedVisibleCount, setUnmatchedVisibleCount] = useState(15);

    // Concept creation states
    const [conceptModalOpen, setConceptModalOpen] = useState(false);
    const [selectedTx, setSelectedTx] = useState<any>(null);
    const [newConcept, setNewConcept] = useState({ alias: "", pattern: "", accountCode: "" });
    const [isCreatingConcept, setIsCreatingConcept] = useState(false);

    // Accounting Modal states
    const [accountingModalOpen, setAccountingModalOpen] = useState(false);
    const [documentTypes, setDocumentTypes] = useState<any[]>([]);
    const [accountingForm, setAccountingForm] = useState({
        documentId: "",
        bankAccountCode: "",
        date: "",
        observations: ""
    });

    useEffect(() => {
        loadPeriodData();
    }, [periodId]);

    const loadPeriodData = async () => {
        setLoading(true);
        const res = await getBankPeriodById(periodId);
        if (res.success && res.data) {
            setPeriod(res.data);
            setTransactions(res.data.transactions || []);

            // Also load consolidation
            const consRes = await getConsolidatedExpenses(periodId);
            if (consRes.success) {
                setConsolidatedData(consRes.data);
            }

            // Initialize accounting form date with period end date
            if (res.data.endDate) {
                const endDateStr = new Date(res.data.endDate).toISOString().split('T')[0];
                setAccountingForm(prev => ({
                    ...prev,
                    date: endDateStr,
                    observations: `Contabilización resumida bancaria ${res.data.name}.`
                }));
            }
        }

        // Load document types for the modal
        const docsRes = await getDocumentTypes();
        if (docsRes.success) {
            setDocumentTypes(docsRes.data || []);
            // Set default document if found in settings
            const settingsRes = await getSiigoSettings();
            if (settingsRes.success && settingsRes.data?.journalDocumentId) {
                setAccountingForm(prev => ({ ...prev, documentId: settingsRes.data?.journalDocumentId || "" }));
            }
        }

        setLoading(false);
    };

    const handleCreateConcept = async () => {
        if (!newConcept.alias || !newConcept.pattern || !newConcept.accountCode) {
            toast.error("Todos los campos son obligatorios");
            return;
        }
        setIsCreatingConcept(true);
        const res = await createBankExpenseConcept(newConcept);
        setIsCreatingConcept(false);

        if (res.success) {
            toast.success("Regla de gasto creada exitosamente");
            setConceptModalOpen(false);
            loadPeriodData(); // Refresh consolidation
        } else {
            toast.error(res.error);
        }
    };

    const openConceptModal = (tx: any) => {
        setSelectedTx(tx);
        // Clean description for pattern (remove dates or weird numbers if common, but let's keep it simple)
        setNewConcept({
            alias: "",
            pattern: tx.description,
            accountCode: ""
        });
        setConceptModalOpen(true);
    };

    const handleApprove = async () => {
        if (!consolidatedData || consolidatedData.consolidated.length === 0) return;

        setIsApproving(true);
        // Solo aprobamos lo que está PENDIENTE
        const pendingTxIds = consolidatedData.consolidated.flatMap((c: any) =>
            c.transactions
                .filter((tx: any) => tx.status === "PENDING")
                .map((tx: any) => tx.id)
        );

        if (pendingTxIds.length === 0) {
            toast.info("No hay nuevas transacciones identificadas para aprobar.");
            setIsApproving(false);
            return;
        }

        const res = await approveMatchedExpenses(periodId, pendingTxIds);
        setIsApproving(false);

        if (res.success) {
            toast.success(`${pendingTxIds.length} transacciones marcadas como APROBADAS`);
            loadPeriodData();
        } else {
            toast.error(res.error);
        }
    };

    const handleOpenAccountingModal = () => {
        if (!consolidatedData?.consolidated?.some((c: any) => c.approvedCount > 0)) {
            toast.error("No hay movimientos aprobados para contabilizar.");
            return;
        }
        setAccountingModalOpen(true);
    };

    const handleProcessExpenses = async () => {
        if (!accountingForm.documentId || !accountingForm.date || !accountingForm.bankAccountCode) {
            toast.error("El tipo de documento, la cuenta de banco y la fecha son obligatorios.");
            return;
        }

        setIsAccounting(true);
        const res = await processBankExpenses(periodId, {
            documentId: Number(accountingForm.documentId),
            bankAccountCode: accountingForm.bankAccountCode,
            date: accountingForm.date,
            observations: accountingForm.observations
        });
        setIsAccounting(false);

        if (res.success) {
            toast.success(res.message);
            if (res.warning) toast.warning(res.warning);
            setAccountingModalOpen(false);
            loadPeriodData();
        } else {
            toast.error(res.error);
        }
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const uploadedFiles = event.target.files;
        if (uploadedFiles) {
            setFiles(Array.from(uploadedFiles));
            setProcessedData([]);
        }
    };

    const processBancolombiaFile = (file: File): Promise<any[]> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const data = e.target?.result;
                    if (data) {
                        const workbook = XLSX.read(data, { type: "array" });
                        const firstSheetName = workbook.SheetNames[0];
                        const worksheet = workbook.Sheets[firstSheetName];

                        const rawData = XLSX.utils.sheet_to_json(worksheet, { range: 14 }) as any[];

                        const cleanedData = rawData.filter((row: any) => {
                            const valor = row["VALOR"];
                            if (valor === undefined || valor === null || valor === "") return false;

                            const strVal = String(valor);
                            if (/[a-zA-Z]/.test(strVal)) return false;

                            return true;
                        }).map((row: any) => {
                            let valorRaw = String(row["VALOR"]);
                            valorRaw = valorRaw.replace(/,/g, "");
                            const valorNumerico = parseFloat(valorRaw);

                            let fechaRaw = String(row["FECHA"]);
                            let fechaFinal = fechaRaw;

                            const dateParts = fechaRaw.trim().split("/");
                            if (dateParts.length >= 2) {
                                const day = dateParts[0].padStart(2, "0");
                                const month = dateParts[1].padStart(2, "0");
                                const year = "2025";
                                fechaFinal = `${year}-${month}-${day}`;
                            }

                            return {
                                ...row,
                                FECHA: fechaFinal,
                                VALOR: valorNumerico,
                            };
                        });
                        resolve(cleanedData);
                    } else {
                        resolve([]);
                    }
                } catch (error) {
                    reject(error);
                }
            };

            reader.onerror = (error) => reject(error);
            reader.readAsArrayBuffer(file);
        });
    };

    const processFiles = async () => {
        setIsProcessing(true);
        setProcessedData([]);

        try {
            let allData: any[] = [];
            for (const file of files) {
                const data = await processBancolombiaFile(file);
                if (data) {
                    allData = [...allData, ...data];
                }
            }
            setProcessedData(allData);
            setView("preview");
        } catch (error) {
            console.error("Error processing files:", error);
            alert("Error procesando archivos");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSaveToDB = async () => {
        setIsSaving(true);
        const res = await saveBankTransactions(periodId, processedData);
        setIsSaving(false);

        if (res.success) {
            alert(`Se guardaron ${res.count} transacciones exitosamente.`);
            setFiles([]);
            setProcessedData([]);
            setView("list");
            await loadPeriodData();
        } else {
            alert("Error guardando transacciones.");
        }
    };

    const handleCancelUpload = () => {
        setFiles([]);
        setProcessedData([]);
        setView("list");
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px]">
                <Loader2 className="w-12 h-12 animate-spin text-muted-foreground" />
                <p className="mt-4 text-muted-foreground">Cargando datos del periodo...</p>
            </div>
        );
    }

    if (!period) {
        return (
            <div className="p-8 text-center space-y-4">
                <h2 className="text-2xl font-bold italic">No se encontró el periodo bancario</h2>
                <Button onClick={() => router.push("/conciliaciones")}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Volver a Conciliaciones
                </Button>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.push("/conciliaciones")}
                >
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <div className="flex-1">
                    <h1 className="text-3xl font-bold tracking-tight">{period.name}</h1>
                    <p className="text-muted-foreground">
                        {formatDateSafe(period.startDate, "d 'de' MMMM")} - {formatDateSafe(period.endDate, "d 'de' MMMM 'de' yyyy")}
                    </p>
                </div>
                {view === "list" && (
                    <div className="flex gap-2">
                        <Button onClick={() => setView("upload")}>
                            <Upload className="w-4 h-4 mr-2" />
                            Cargar Más Transacciones
                        </Button>
                    </div>
                )}
            </div>

            {/* View Navigation */}
            {(view === "list" || view === "consolidated") && (
                <div className="flex gap-4 border-b pb-1">
                    <button
                        className={`pb-2 px-1 text-sm font-medium transition-colors border-b-2 ${view === "list" ? "border-blue-600 text-blue-600" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                        onClick={() => setView("list")}
                    >
                        Listado de Transacciones
                    </button>
                    <button
                        className={`pb-2 px-1 text-sm font-medium transition-colors border-b-2 ${view === "consolidated" ? "border-blue-600 text-blue-600" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                        onClick={() => setView("consolidated")}
                    >
                        Consolidado de Gastos
                        {consolidatedData?.consolidated?.length > 0 && (
                            <Badge variant="secondary" className="ml-2 h-5 px-1.5 font-bold">
                                {consolidatedData.consolidated.length}
                            </Badge>
                        )}
                    </button>
                </div>
            )}

            {/* Consolidated View */}
            {view === "consolidated" && (
                <div className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                        <Card className="border-green-100 shadow-sm">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <div>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                                        Gastos e Ingresos Identificados
                                    </CardTitle>
                                    <CardDescription>Resumen por concepto según reglas</CardDescription>
                                </div>
                                <div className="text-right">
                                    <div className="text-2xl font-bold text-green-700">{formatCurrency(consolidatedData?.totalMatchedSum || 0)}</div>
                                    <div className="text-xs text-muted-foreground">{consolidatedData?.totalMatchedCount || 0} movimientos</div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="rounded-md border overflow-hidden">
                                    <Table>
                                        <TableHeader className="bg-slate-50">
                                            <TableRow>
                                                <TableHead>Concepto</TableHead>
                                                <TableHead>Cuenta</TableHead>
                                                <TableHead className="text-right">Total</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {consolidatedData?.consolidated?.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No se identificaron gastos.</TableCell>
                                                </TableRow>
                                            ) : (
                                                consolidatedData?.consolidated?.map((c: any) => (
                                                    <TableRow key={c.conceptId}>
                                                        <TableCell className="font-medium">
                                                            {c.conceptAlias}
                                                            {c.vouchers.length > 0 && (
                                                                <div className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100 w-fit mt-1 font-bold">
                                                                    Siigo: {c.vouchers.join(", ")}
                                                                </div>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-xs">
                                                            <div className="font-mono">{c.accountCode}</div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-gray-500">{c.accountName}</span>
                                                                {c.pendingCount > 0 && <Badge variant="secondary" className="h-4 text-[9px] px-1 bg-yellow-100 text-yellow-700 border-yellow-200">{c.pendingCount} pend.</Badge>}
                                                                {c.approvedCount > 0 && <Badge variant="secondary" className="h-4 text-[9px] px-1 bg-green-100 text-green-700 border-green-200">{c.approvedCount} apr.</Badge>}
                                                                {c.reconciledCount > 0 && <Badge variant="secondary" className="h-4 text-[9px] px-1 bg-blue-100 text-blue-700 border-blue-200">{c.reconciledCount} cont.</Badge>}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className={`text-right font-bold ${c.total < 0 ? "text-red-700" : "text-green-700"}`}>
                                                            {formatCurrency(c.total)}
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                                <div className="mt-4 space-y-4">
                                    <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-100">
                                        <h4 className="text-sm font-bold text-blue-900 mb-1 flex items-center gap-2">
                                            <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-[10px]">1</div>
                                            Preparación
                                        </h4>
                                        <p className="text-[11px] text-blue-700 mb-2">
                                            Identifica y aprueba los movimientos detectados por las reglas.
                                        </p>
                                        <Button
                                            className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                                            onClick={handleApprove}
                                            disabled={isApproving || !consolidatedData?.consolidated?.some((c: any) => c.pendingCount > 0)}
                                        >
                                            {isApproving ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                                            Aprobar {consolidatedData?.totalPendingCount} Movimientos
                                        </Button>
                                    </div>

                                    <div className="p-3 bg-slate-50/50 rounded-lg border border-slate-200">
                                        <h4 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
                                            <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px]">2</div>
                                            Envío a Siigo
                                        </h4>
                                        <p className="text-[11px] text-slate-600 mb-2">
                                            Genera un comprobante contable resumido en Siigo con los movimientos aprobados.
                                        </p>
                                        <Button
                                            className="w-full bg-slate-800 hover:bg-slate-900 text-white shadow-sm"
                                            onClick={handleOpenAccountingModal}
                                            disabled={isAccounting || !consolidatedData?.consolidated?.some((c: any) => c.approvedCount > 0)}
                                        >
                                            {isAccounting ? <Loader2 className="animate-spin mr-2" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
                                            {consolidatedData?.totalApprovedCount > 0 ? `Contabilizar ${consolidatedData.totalApprovedCount} en Siigo` : "Contabilizar en Siigo"}
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-orange-100 shadow-sm">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <div>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <AlertCircle className="w-5 h-5 text-orange-500" />
                                        Movimientos por Identificar
                                    </CardTitle>
                                    <CardDescription>Movimientos sin categoría (Ingresos o Egresos)</CardDescription>
                                </div>
                                <div className="text-right">
                                    <div className="text-2xl font-bold text-orange-700">{formatCurrency(consolidatedData?.totalUnmatched || 0)}</div>
                                    <div className="text-xs text-muted-foreground font-medium">{consolidatedData?.unmatched?.length || 0} pendientes</div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="rounded-md border overflow-hidden">
                                    <Table>
                                        <TableHeader className="bg-slate-50">
                                            <TableRow>
                                                <TableHead>Descripción</TableHead>
                                                <TableHead className="text-right">Valor</TableHead>
                                                <TableHead className="w-[50px]"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {consolidatedData?.unmatched?.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground italic">¡Todos los gastos están vinculados!</TableCell>
                                                </TableRow>
                                            ) : (
                                                consolidatedData?.unmatched?.slice(0, unmatchedVisibleCount).map((u: any) => (
                                                    <TableRow key={u.id} className="group">
                                                        <TableCell className="text-sm truncate max-w-[200px]" title={u.description}>{u.description}</TableCell>
                                                        <TableCell className={`text-right font-medium ${Number(u.amount) < 0 ? "text-orange-600" : "text-green-600"}`}>
                                                            {formatCurrency(Number(u.amount))}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                onClick={() => openConceptModal(u)}
                                                                title="Crear regla para este gasto"
                                                            >
                                                                <PlusCircle className="h-4 w-4" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                            {(consolidatedData?.unmatched?.length || 0) > unmatchedVisibleCount && (
                                                <TableRow>
                                                    <TableCell colSpan={3} className="text-center py-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-xs text-blue-600 hover:text-blue-800"
                                                            onClick={() => setUnmatchedVisibleCount(prev => prev + 15)}
                                                        >
                                                            Ver 15 más ({consolidatedData.unmatched.length - unmatchedVisibleCount} restantes)
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                                <Button
                                    variant="outline"
                                    className="w-full mt-4"
                                    onClick={() => router.push('/ajustes')}
                                >
                                    <Settings2 className="mr-2 h-4 w-4" /> Ver Todas las Reglas
                                </Button>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Accounting Modal */}
                    <Dialog open={accountingModalOpen} onOpenChange={setAccountingModalOpen}>
                        <DialogContent className="sm:max-w-[450px]">
                            <DialogHeader>
                                <DialogTitle>Generar Comprobante en Siigo</DialogTitle>
                                <DialogDescription>
                                    Confirma los datos para el envío contable a Siigo Nube.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="space-y-2">
                                    <Label>Tipo de Documento (CC)</Label>
                                    <select
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        value={accountingForm.documentId}
                                        onChange={(e) => setAccountingForm({ ...accountingForm, documentId: e.target.value })}
                                    >
                                        <option value="">Selecciona un tipo...</option>
                                        {documentTypes.map((t: any) => (
                                            <option key={t.id} value={t.id}>
                                                {t.code} - {t.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Cuenta de Banco (Salida)</Label>
                                    <AccountSelector
                                        value={accountingForm.bankAccountCode}
                                        onSelect={(code) => setAccountingForm({ ...accountingForm, bankAccountCode: code })}
                                    />
                                    <p className="text-[10px] text-muted-foreground italic">Cuenta de donde sale el dinero (Crédito).</p>
                                </div>
                                <div className="space-y-2">
                                    <Label>Fecha del Comprobante</Label>
                                    <Input
                                        type="date"
                                        value={accountingForm.date}
                                        onChange={(e) => setAccountingForm({ ...accountingForm, date: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Observaciones (Opcional)</Label>
                                    <textarea
                                        className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        value={accountingForm.observations}
                                        onChange={(e) => setAccountingForm({ ...accountingForm, observations: e.target.value })}
                                        placeholder="Descripción para el resumen de movimientos..."
                                    />
                                </div>
                                <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">A Contabilizar:</span>
                                        <span className="text-sm font-bold text-blue-900">{formatCurrency(Math.abs(consolidatedData?.totalApprovedSum || 0))}</span>
                                    </div>
                                    <p className="text-[10px] text-blue-700 leading-tight">
                                        Se generará un comprobante único en Siigo que resume los {consolidatedData?.totalApprovedCount || 0} movimientos aprobados.
                                    </p>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setAccountingModalOpen(false)}>Cancelar</Button>
                                <Button
                                    className="bg-slate-800 hover:bg-slate-900"
                                    onClick={handleProcessExpenses}
                                    disabled={isAccounting}
                                >
                                    {isAccounting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                    Confirmar y Enviar a Siigo
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {/* New Concept Modal */}
                    <Dialog open={conceptModalOpen} onOpenChange={setConceptModalOpen}>
                        <DialogContent className="sm:max-w-[500px]">
                            <DialogHeader>
                                <DialogTitle>Nueva Regla de Gasto</DialogTitle>
                                <DialogDescription>
                                    Define una regla automática para clasificar gastos similares en el futuro.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Movimiento de referencia:</Label>
                                    <div className="p-3 bg-slate-50 rounded border text-sm italic">
                                        "{selectedTx?.description}"
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="alias">Alias (Nombre corto)</Label>
                                        <Input
                                            id="alias"
                                            placeholder="Ej. GMF, Portes"
                                            value={newConcept.alias}
                                            onChange={(e) => setNewConcept({ ...newConcept, alias: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="pattern">Patrón de Búsqueda</Label>
                                        <Input
                                            id="pattern"
                                            placeholder="Texto a buscar"
                                            value={newConcept.pattern}
                                            onChange={(e) => setNewConcept({ ...newConcept, pattern: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Asignar a Cuenta Contable</Label>
                                    <AccountSelector
                                        value={newConcept.accountCode}
                                        onSelect={(code) => setNewConcept({ ...newConcept, accountCode: code })}
                                    />
                                </div>
                            </div>

                            <DialogFooter>
                                <Button variant="outline" onClick={() => setConceptModalOpen(false)}>Cancelar</Button>
                                <Button
                                    onClick={handleCreateConcept}
                                    disabled={isCreatingConcept}
                                >
                                    {isCreatingConcept ? <Loader2 className="animate-spin mr-2" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                                    Crear y Aplicar Regla
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            )}

            {/* Upload View */}
            {view === "upload" && (
                <Card>
                    <CardHeader>
                        <CardTitle>Cargar Transacciones</CardTitle>
                        <CardDescription>
                            Suba archivos Excel con transacciones adicionales para este periodo.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid w-full max-w-sm items-center gap-1.5">
                            <Input
                                id="file-upload"
                                type="file"
                                accept=".xls, .xlsx"
                                multiple
                                onChange={handleFileUpload}
                                className="cursor-pointer"
                            />
                        </div>

                        {files.length > 0 && (
                            <div className="bg-muted p-4 rounded-md space-y-2">
                                <h3 className="font-medium text-sm flex items-center gap-2">
                                    <FileSpreadsheet className="h-4 w-4" />
                                    Archivos Seleccionados ({files.length}):
                                </h3>
                                <ul className="text-sm text-muted-foreground pl-6 list-disc">
                                    {files.map((file, index) => (
                                        <li key={index}>{file.name}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className="flex items-center gap-4 pt-4">
                            <Button
                                onClick={processFiles}
                                disabled={files.length === 0 || isProcessing}
                            >
                                {isProcessing ? "Procesando..." : (
                                    <>
                                        <Upload className="mr-2 h-4 w-4" /> Procesar Archivos
                                    </>
                                )}
                            </Button>
                            <Button variant="outline" onClick={handleCancelUpload}>
                                Cancelar
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Preview View */}
            {view === "preview" && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold">
                            Vista Previa ({processedData.length} transacciones)
                        </h2>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={handleCancelUpload}>
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Cancelar
                            </Button>
                            <Button onClick={handleSaveToDB} disabled={isSaving}>
                                {isSaving ? "Guardando..." : (
                                    <>
                                        <Save className="mr-2 h-4 w-4" />
                                        Guardar Transacciones
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>

                    <Card>
                        <div className="overflow-auto">
                            <Table className="min-w-[800px]">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Fecha</TableHead>
                                        <TableHead>Descripción</TableHead>
                                        <TableHead>Sucursal</TableHead>
                                        <TableHead>Dcto.</TableHead>
                                        <TableHead className="text-right">Valor</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {processedData.map((row, index) => (
                                        <TableRow key={index}>
                                            <TableCell className="whitespace-nowrap">{row.FECHA}</TableCell>
                                            <TableCell>{row["DESCRIPCIÓN"]}</TableCell>
                                            <TableCell>{row["SUCURSAL"]}</TableCell>
                                            <TableCell>{row["DCTO."]}</TableCell>
                                            <TableCell className={`text-right ${row.VALOR < 0 ? "text-red-500" : "text-green-600"}`}>
                                                {formatCurrency(row.VALOR)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </Card>
                </div>
            )}

            {/* Transactions List View */}
            {view === "list" && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Transacciones</CardTitle>
                                <CardDescription>
                                    Total: {transactions.length} transacciones
                                </CardDescription>
                            </div>
                            <Badge variant="secondary" className="text-lg px-4 py-2">
                                {formatCurrency(transactions.reduce((sum, tx) => sum + Number(tx.amount), 0))}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {transactions.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                <FileSpreadsheet className="w-16 h-16 mb-4 opacity-30" />
                                <h3 className="text-xl font-semibold mb-2">No hay transacciones</h3>
                                <p className="text-muted-foreground mb-4">
                                    Cargue archivos para agregar transacciones a este periodo.
                                </p>
                                <Button onClick={() => setView("upload")}>
                                    <Upload className="w-4 h-4 mr-2" />
                                    Cargar Transacciones
                                </Button>
                            </div>
                        ) : (
                            <div className="rounded-md border overflow-auto">
                                <Table className="min-w-[800px]">
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Fecha</TableHead>
                                            <TableHead>Descripción</TableHead>
                                            <TableHead>Sucursal</TableHead>
                                            <TableHead>Documento</TableHead>
                                            <TableHead className="text-right">Valor</TableHead>
                                            <TableHead>Estado</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {transactions.map((tx) => (
                                            <TableRow
                                                key={tx.id}
                                                className={
                                                    tx.status === "PENDING"
                                                        ? "bg-yellow-50 hover:bg-yellow-100/80 transition-colors"
                                                        : "bg-green-100 hover:bg-green-200/80 transition-colors"
                                                }
                                            >
                                                <TableCell className="whitespace-nowrap">
                                                    {formatDateSafe(tx.date, "dd/MM/yyyy")}
                                                </TableCell>
                                                <TableCell className="max-w-md truncate">{tx.description}</TableCell>
                                                <TableCell>{tx.branch || "-"}</TableCell>
                                                <TableCell>{tx.documentId || "-"}</TableCell>
                                                <TableCell className={`text-right font-medium ${Number(tx.amount) < 0 ? "text-red-600" : "text-green-600"}`}>
                                                    {formatCurrency(Number(tx.amount))}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={
                                                        tx.status === "RECONCILED" ? "default" :
                                                            tx.status === "APPROVED" ? "outline" : "secondary"
                                                    }>
                                                        {tx.status === "RECONCILED" ? "Conciliado" :
                                                            tx.status === "APPROVED" ? "Aprobado" : "Pendiente"}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

// --- Account Selector Component (Adapted for reuse) ---
function AccountSelector({ value, onSelect }: { value: string, onSelect: (code: string) => void }) {
    const [open, setOpen] = useState(false);
    const [accounts, setAccounts] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchValue, setSearchValue] = useState("");

    useEffect(() => {
        const fetchAccounts = async () => {
            setLoading(true);
            const res = await getSiigoAccounts(searchValue);
            if (res.success && res.data) {
                setAccounts(res.data);
            }
            setLoading(false);
        };

        const timer = setTimeout(() => {
            fetchAccounts();
        }, 300);

        return () => clearTimeout(timer);
    }, [searchValue]);

    const selectedAccount = accounts.find((acc) => acc.code === value);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between font-normal"
                >
                    {selectedAccount
                        ? `${selectedAccount.code} - ${selectedAccount.name}`
                        : value || "Seleccionar cuenta..."}
                    <ListFilter className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0">
                <Command>
                    <CommandInput
                        placeholder="Buscar por código o nombre..."
                        onValueChange={setSearchValue}
                    />
                    <CommandList>
                        {loading && <div className="p-4 text-center text-sm">Cargando cuentas...</div>}
                        {!loading && accounts.length === 0 && (
                            <CommandEmpty>No se encontraron cuentas.</CommandEmpty>
                        )}
                        <CommandGroup>
                            {accounts.map((account) => (
                                <CommandItem
                                    key={account.code}
                                    value={`${account.code} ${account.name}`}
                                    onSelect={() => {
                                        onSelect(account.code);
                                        setOpen(false);
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value === account.code ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    <span className="font-mono mr-2">{account.code}</span>
                                    {account.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
