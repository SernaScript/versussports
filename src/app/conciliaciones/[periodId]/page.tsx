"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Upload, FileSpreadsheet, Save, Loader2 } from "lucide-react";
import { format, addMinutes } from "date-fns";
import { es } from "date-fns/locale";
import * as XLSX from "xlsx";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

import { getBankPeriodById, saveBankTransactions } from "@/app/actions/conciliaciones";
import { processBankExpenses } from "@/app/actions/accounting";
import { toast } from "sonner";

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
    const [view, setView] = useState<"list" | "upload" | "preview">("list");
    const [isSaving, setIsSaving] = useState(false);
    const [isAccounting, setIsAccounting] = useState(false);

    useEffect(() => {
        loadPeriodData();
    }, [periodId]);

    const loadPeriodData = async () => {
        setLoading(true);
        const res = await getBankPeriodById(periodId);
        if (res.success && res.data) {
            setPeriod(res.data);
            setTransactions(res.data.transactions || []);
        }
        setLoading(false);
    };

    const handleProcessExpenses = async () => {
        if (!confirm("¿Deseas generar el comprobante contable para los gastos identificados?")) return;

        setIsAccounting(true);
        const res = await processBankExpenses(periodId);
        setIsAccounting(false);

        if (res.success) {
            toast.success(res.message);
            if (res.warning) toast.warning(res.warning);
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
                        <Button onClick={handleProcessExpenses} disabled={isAccounting} variant="secondary">
                            {isAccounting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileSpreadsheet className="w-4 h-4 mr-2" />}
                            Contabilizar Gastos
                        </Button>
                        <Button onClick={() => setView("upload")}>
                            <Upload className="w-4 h-4 mr-2" />
                            Cargar Más Transacciones
                        </Button>
                    </div>
                )}
            </div>

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
                                            <TableRow key={tx.id}>
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
                                                    <Badge variant={tx.status === "RECONCILED" ? "default" : "secondary"}>
                                                        {tx.status === "RECONCILED" ? "Conciliado" : "Pendiente"}
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
