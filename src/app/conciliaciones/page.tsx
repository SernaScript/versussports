"use client";

import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, ArrowLeft, Plus, CalendarIcon, Save } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

import { getBankPeriods, createBankPeriod, saveBankTransactions } from "../actions/conciliaciones";

// Schema for creating a new period
const periodSchema = z.object({
    name: z.string().min(1, "El nombre es requerido"),
    startDate: z.date(),
    endDate: z.date(),
});

export default function ConciliacionesPage() {
    // State for Global Data
    const [periods, setPeriods] = useState<any[]>([]);
    const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");

    // State for File Processing
    const [files, setFiles] = useState<File[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<"idle" | "success" | "error">("idle");
    const [processedData, setProcessedData] = useState<any[]>([]);
    const [view, setView] = useState<"upload" | "results">("upload");
    const [isSaving, setIsSaving] = useState(false);

    // State for UI
    const [isCreatePeriodOpen, setIsCreatePeriodOpen] = useState(false);

    // Form for New Period
    const form = useForm<z.infer<typeof periodSchema>>({
        resolver: zodResolver(periodSchema),
        defaultValues: {
            name: "",
        },
    });

    // Load periods on mount
    useEffect(() => {
        loadPeriods();
    }, []);

    const loadPeriods = async () => {
        const res = await getBankPeriods();
        if (res.success && res.data) {
            setPeriods(res.data);
        }
    };

    const handleCreatePeriod = async (values: z.infer<typeof periodSchema>) => {
        const res = await createBankPeriod(values);
        if (res.success && res.data) {
            await loadPeriods();
            setSelectedPeriodId(res.data.id);
            setIsCreatePeriodOpen(false);
            form.reset();
        } else {
            // Handle error (could use toast)
            alert("Error creando el periodo");
        }
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const uploadedFiles = event.target.files;
        if (uploadedFiles) {
            setFiles(Array.from(uploadedFiles));
            setUploadStatus("idle");
            setProcessedData([]);
        }
    };

    const processFiles = async () => {
        setIsProcessing(true);
        setUploadStatus("idle");
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
            setUploadStatus("success");
            setView("results");
        } catch (error) {
            console.error("Error processing files:", error);
            setUploadStatus("error");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReset = () => {
        setFiles([]);
        setProcessedData([]);
        setUploadStatus("idle");
        setView("upload");
    };

    const handleSaveToDB = async () => {
        if (!selectedPeriodId) return;
        setIsSaving(true);
        const res = await saveBankTransactions(selectedPeriodId, processedData);
        setIsSaving(false);

        if (res.success) {
            alert(`Se guardaron ${res.count} transacciones exitosamente.`);
            handleReset(); // Go back to start
        } else {
            alert("Error guardando transacciones.");
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

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 flex flex-col h-full">
            {/* Header: Period Selection */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold tracking-tight">Conciliaciones Bancarias</h1>
                    <p className="text-muted-foreground">
                        Gestione periodos y cargue sus extractos bancarios.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <Select value={selectedPeriodId} onValueChange={setSelectedPeriodId}>
                        <SelectTrigger className="w-[250px]">
                            <SelectValue placeholder="Seleccionar Periodo" />
                        </SelectTrigger>
                        <SelectContent>
                            {periods.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                    {p.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Dialog open={isCreatePeriodOpen} onOpenChange={setIsCreatePeriodOpen}>
                        <DialogTrigger asChild>
                            <Button variant="default">
                                <Plus className="w-4 h-4 mr-2" />
                                Nuevo Periodo
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Crear Periodo Bancario</DialogTitle>
                                <DialogDescription>Defina el nombre y rango de fechas para este periodo.</DialogDescription>
                            </DialogHeader>
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(handleCreatePeriod)} className="space-y-4">
                                    <FormField
                                        control={form.control}
                                        name="name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Nombre del Periodo</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Ej: Enero 2025" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="startDate"
                                            render={({ field }) => (
                                                <FormItem className="flex flex-col">
                                                    <FormLabel>Fecha Inicio</FormLabel>
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <FormControl>
                                                                <Button
                                                                    variant={"outline"}
                                                                    className={cn(
                                                                        "w-full pl-3 text-left font-normal",
                                                                        !field.value && "text-muted-foreground"
                                                                    )}
                                                                >
                                                                    {field.value ? (
                                                                        format(field.value, "PPP", { locale: es })
                                                                    ) : (
                                                                        <span>Seleccionar</span>
                                                                    )}
                                                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                                </Button>
                                                            </FormControl>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-auto p-0" align="start">
                                                            <Calendar
                                                                mode="single"
                                                                selected={field.value}
                                                                onSelect={field.onChange}
                                                                initialFocus
                                                            />
                                                        </PopoverContent>
                                                    </Popover>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="endDate"
                                            render={({ field }) => (
                                                <FormItem className="flex flex-col">
                                                    <FormLabel>Fecha Fin</FormLabel>
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <FormControl>
                                                                <Button
                                                                    variant={"outline"}
                                                                    className={cn(
                                                                        "w-full pl-3 text-left font-normal",
                                                                        !field.value && "text-muted-foreground"
                                                                    )}
                                                                >
                                                                    {field.value ? (
                                                                        format(field.value, "PPP", { locale: es })
                                                                    ) : (
                                                                        <span>Seleccionar</span>
                                                                    )}
                                                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                                </Button>
                                                            </FormControl>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-auto p-0" align="start">
                                                            <Calendar
                                                                mode="single"
                                                                selected={field.value}
                                                                onSelect={field.onChange}
                                                                initialFocus
                                                            />
                                                        </PopoverContent>
                                                    </Popover>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                    <DialogFooter>
                                        <Button type="submit">Crear Periodo</Button>
                                    </DialogFooter>
                                </form>
                            </Form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Validation: Must select period */}
            {!selectedPeriodId && periods.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-12 text-center text-muted-foreground">
                    <CalendarIcon className="w-12 h-12 mb-4 opacity-50" />
                    <h3 className="text-lg font-medium">No hay periodos creados</h3>
                    <p>Por favor cree un nuevo periodo para comenzar a subir extractos.</p>
                </div>
            )}

            {!selectedPeriodId && periods.length > 0 && (
                <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-12 text-center text-muted-foreground">
                    <FileSpreadsheet className="w-12 h-12 mb-4 opacity-50" />
                    <h3 className="text-lg font-medium">Periodo no seleccionado</h3>
                    <p>Seleccione un periodo del menú superior para cargar archivos.</p>
                </div>
            )}

            {/* Main Content */}
            {selectedPeriodId && (
                <>
                    {view === "upload" && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Cargar Archivos</CardTitle>
                                <CardDescription>
                                    Suba los archivos correspondientes al periodo seleccionado.
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
                                        className="w-full sm:w-auto"
                                    >
                                        {isProcessing ? (
                                            <>Processing...</>
                                        ) : (
                                            <>
                                                <Upload className="mr-2 h-4 w-4" /> Procesar Archivos
                                            </>
                                        )}
                                    </Button>

                                    {uploadStatus === "error" && (
                                        <span className="text-destructive flex items-center gap-1 text-sm font-medium">
                                            <AlertCircle className="h-4 w-4" /> Error al procesar
                                        </span>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {view === "results" && (
                        <div className="flex-1 flex flex-col space-y-6 overflow-hidden">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-semibold">
                                    Vista Previa ({processedData.length} transacciones)
                                </h2>
                                <div className="flex gap-2">
                                    <Button variant="outline" onClick={handleReset}>
                                        <ArrowLeft className="mr-2 h-4 w-4" />
                                        Atrás
                                    </Button>
                                    <Button onClick={handleSaveToDB} disabled={isSaving}>
                                        {isSaving ? (
                                            <>Guardando...</>
                                        ) : (
                                            <>
                                                <Save className="mr-2 h-4 w-4" />
                                                Guardar en Base de Datos
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>

                            <Card className="flex-1 flex flex-col overflow-hidden">
                                <div className="flex-1 overflow-auto rounded-md">
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
                                            {processedData.length > 0 ? (
                                                processedData.map((row, index) => (
                                                    <TableRow key={index}>
                                                        <TableCell className="whitespace-nowrap">{row.FECHA}</TableCell>
                                                        <TableCell>{row["DESCRIPCIÓN"]}</TableCell>
                                                        <TableCell>{row["SUCURSAL"]}</TableCell>
                                                        <TableCell>{row["DCTO."]}</TableCell>
                                                        <TableCell className={`text-right ${row.VALOR < 0 ? "text-red-500" : "text-green-600"}`}>
                                                            {new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP" }).format(row.VALOR)}
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            ) : (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                                        No hay datos.
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </Card>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
