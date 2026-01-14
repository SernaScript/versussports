"use client";

import { useState, useEffect } from "react";
import { Plus, CalendarIcon, Eye } from "lucide-react";
import { format, startOfMonth, endOfMonth, addMinutes } from "date-fns";
import { es } from "date-fns/locale";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { LoadingSection } from "@/components/ui/loading-section";
import { getBankPeriods, createBankPeriod, saveBankTransactions } from "../actions/conciliaciones";

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

// Schema for creating a new period
const periodSchema = z.object({
    name: z.string().min(1, "El nombre es requerido"),
    monthYear: z.date(),
}).refine((data) => data.monthYear !== undefined, {
    message: "El mes y año son requeridos",
    path: ["monthYear"],
});

export default function ConciliacionesPage() {
    const router = useRouter();
    const [periods, setPeriods] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreatePeriodOpen, setIsCreatePeriodOpen] = useState(false);

    // File upload states
    const [files, setFiles] = useState<File[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<"idle" | "success" | "error">("idle");

    const form = useForm<z.infer<typeof periodSchema>>({
        resolver: zodResolver(periodSchema),
        defaultValues: {
            name: "",
        },
    });

    useEffect(() => {
        loadPeriods();
    }, []);

    const loadPeriods = async () => {
        setIsLoading(true);
        try {
            const res = await getBankPeriods();
            if (res.success && res.data) {
                setPeriods(res.data);
            }
        } catch (error) {
            console.error("Error loading periods:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const uploadedFiles = event.target.files;
        if (uploadedFiles) {
            setFiles(Array.from(uploadedFiles));
            setUploadStatus("idle");
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

    const handleCreatePeriod = async (values: z.infer<typeof periodSchema>) => {
        // Calculate start and end dates from the selected month/year
        const startDate = startOfMonth(values.monthYear);
        const endDate = endOfMonth(values.monthYear);

        setIsProcessing(true);

        try {
            // Process files first
            let allData: any[] = [];
            for (const file of files) {
                const data = await processBancolombiaFile(file);
                if (data) {
                    allData = [...allData, ...data];
                }
            }

            // Create period
            const res = await createBankPeriod({
                name: values.name,
                startDate,
                endDate
            });

            if (res.success && res.data) {
                // Save transactions if any files were uploaded
                if (allData.length > 0) {
                    await saveBankTransactions(res.data.id, allData);
                }

                await loadPeriods();
                setIsCreatePeriodOpen(false);
                form.reset();
                setFiles([]);
                setUploadStatus("idle");

                // Navigate to the new period detail page
                router.push(`/conciliaciones/${res.data.id}`);
            } else {
                alert("Error creando el periodo");
                setUploadStatus("error");
            }
        } catch (error) {
            console.error("Error creating period:", error);
            alert("Error procesando archivos o creando periodo");
            setUploadStatus("error");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold tracking-tight">Conciliaciones Bancarias</h1>
                    <p className="text-muted-foreground">
                        Gestione sus periodos de conciliación bancaria.
                    </p>
                </div>

                <Dialog open={isCreatePeriodOpen} onOpenChange={setIsCreatePeriodOpen}>
                    <DialogTrigger asChild>
                        <Button variant="default">
                            <Plus className="w-4 h-4 mr-2" />
                            Nuevo Periodo
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Crear Periodo Bancario</DialogTitle>
                            <DialogDescription>
                                Defina el nombre, seleccione el mes y cargue los extractos bancarios del periodo.
                            </DialogDescription>
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
                                <FormField
                                    control={form.control}
                                    name="monthYear"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-col">
                                            <FormLabel>Mes y Año</FormLabel>
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
                                                                format(field.value, "MMMM yyyy", { locale: es })
                                                            ) : (
                                                                <span>Seleccionar mes</span>
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
                                                        locale={es}
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                            <p className="text-xs text-muted-foreground">
                                                {field.value && (
                                                    <>Periodo: {format(startOfMonth(field.value), "d 'de' MMMM", { locale: es })} - {format(endOfMonth(field.value), "d 'de' MMMM 'de' yyyy", { locale: es })}</>
                                                )}
                                            </p>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {/* File Upload Section */}
                                <div className="space-y-4 border-t pt-4">
                                    <div>
                                        <FormLabel>Extractos Bancarios (Opcional)</FormLabel>
                                        <p className="text-sm text-muted-foreground mb-2">
                                            Puede cargar archivos Excel con las transacciones del periodo.
                                        </p>
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
                                            <h3 className="font-medium text-sm">
                                                Archivos Seleccionados ({files.length}):
                                            </h3>
                                            <ul className="text-sm text-muted-foreground pl-6 list-disc">
                                                {files.map((file, index) => (
                                                    <li key={index}>{file.name}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>

                                <DialogFooter>
                                    <Button type="submit" disabled={isProcessing}>
                                        {isProcessing ? "Procesando..." : "Crear Periodo"}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Periodos Table */}
            {isLoading ? (
                <Card>
                    <CardContent className="p-0">
                        <LoadingSection />
                    </CardContent>
                </Card>
            ) : periods.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <CalendarIcon className="w-16 h-16 mb-4 opacity-30" />
                        <h3 className="text-xl font-semibold mb-2">No hay periodos creados</h3>
                        <p className="text-muted-foreground mb-4">
                            Cree su primer periodo bancario para comenzar.
                        </p>
                        <Button onClick={() => setIsCreatePeriodOpen(true)}>
                            <Plus className="w-4 h-4 mr-2" />
                            Crear Primer Periodo
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle>Periodos Registrados</CardTitle>
                        <CardDescription>
                            Seleccione un periodo para ver sus transacciones.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Nombre</TableHead>
                                        <TableHead>Fecha Inicio</TableHead>
                                        <TableHead>Fecha Fin</TableHead>
                                        <TableHead className="text-right">Transacciones</TableHead>
                                        <TableHead className="text-right">Cargos</TableHead>
                                        <TableHead className="text-right">Abonos</TableHead>
                                        <TableHead className="text-right">Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {periods.map((period) => (
                                        <TableRow key={period.id}>
                                            <TableCell className="font-medium">{period.name}</TableCell>
                                            <TableCell>
                                                {formatDateSafe(period.startDate, "dd-MM-yyyy")}
                                            </TableCell>
                                            <TableCell>
                                                {formatDateSafe(period.endDate, "dd-MM-yyyy")}
                                            </TableCell>
                                            <TableCell className="text-right text-muted-foreground">
                                                {period._count?.transactions || 0}
                                            </TableCell>
                                            <TableCell className="text-right text-red-600 font-medium">
                                                {formatCurrency(period.cargos || 0)}
                                            </TableCell>
                                            <TableCell className="text-right text-green-600 font-medium">
                                                {formatCurrency(period.abonos || 0)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => router.push(`/conciliaciones/${period.id}`)}
                                                    title="Ver Detalles"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
