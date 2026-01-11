"use client";

import { useState } from "react";
import { Upload, FileSpreadsheet, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    validateExcelFile,
    processDianFile,
    ProcessedDianInvoice,
} from "@/app/facturas/utils/dian-file-validator";
import { saveDianInvoices } from "@/app/actions/facturas";

interface UploadDianModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onUploadSuccess: (data: ProcessedDianInvoice[]) => void;
}

export function UploadDianModal({
    open,
    onOpenChange,
    onUploadSuccess,
}: UploadDianModalProps) {
    const [file, setFile] = useState<File | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string>("");

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const uploadedFile = event.target.files?.[0];
        if (uploadedFile) {
            setFile(uploadedFile);
            setErrorMessage("");
        }
    };

    const handleRemoveFile = () => {
        setFile(null);
        setErrorMessage("");
    };

    const handleProcessFile = async () => {
        if (!file) return;

        setIsProcessing(true);
        setErrorMessage("");

        try {
            // Validate file type
            const fileValidation = validateExcelFile(file);
            if (!fileValidation.isValid) {
                setErrorMessage(fileValidation.error || "Error al validar el archivo");
                setIsProcessing(false);
                return;
            }

            // Process file
            const data = await processDianFile(file);
            
            // Save to database
            const saveResult = await saveDianInvoices(data);
            
            if (!saveResult.success) {
                setErrorMessage(
                    saveResult.error || "Error al guardar las facturas en la base de datos"
                );
                setIsProcessing(false);
                return;
            }
            
            // Also store in localStorage for backward compatibility
            const existingInvoices = localStorage.getItem("dian-invoices");
            let allInvoices: ProcessedDianInvoice[] = [];
            
            if (existingInvoices) {
                try {
                    allInvoices = JSON.parse(existingInvoices);
                } catch (error) {
                    console.error("Error parsing existing invoices:", error);
                }
            }
            
            // Merge new invoices (avoid duplicates by ID)
            const existingIds = new Set(allInvoices.map(inv => inv.id));
            const newInvoices = data.filter(inv => !existingIds.has(inv.id));
            allInvoices = [...allInvoices, ...newInvoices];
            
            // Save to localStorage
            localStorage.setItem("dian-invoices", JSON.stringify(allInvoices));
            
            // Trigger update event
            window.dispatchEvent(new Event("invoices-updated"));
            
            onUploadSuccess(data);
            
            // Reset and close
            setFile(null);
            setErrorMessage("");
            onOpenChange(false);
        } catch (error) {
            console.error("Error processing file:", error);
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : "Error al procesar el archivo Excel"
            );
        } finally {
            setIsProcessing(false);
        }
    };

    const handleClose = () => {
        if (!isProcessing) {
            setFile(null);
            setErrorMessage("");
            onOpenChange(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Cargar Archivo DIAN</DialogTitle>
                    <DialogDescription>
                        Suba un archivo Excel (.xlsx o .xls) con información de facturas de la DIAN.
                        El archivo debe contener las columnas requeridas.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="grid w-full items-center gap-1.5">
                        <Input
                            id="file-upload"
                            type="file"
                            accept=".xls,.xlsx"
                            onChange={handleFileUpload}
                            className="cursor-pointer"
                            disabled={isProcessing}
                        />
                    </div>

                    {file && (
                        <div className="bg-muted p-4 rounded-md space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <FileSpreadsheet className="h-4 w-4" />
                                    <span className="font-medium text-sm">{file.name}</span>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleRemoveFile}
                                    disabled={isProcessing}
                                    className="h-6 w-6 p-0"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Tamaño: {(file.size / 1024).toFixed(2)} KB
                            </p>
                        </div>
                    )}

                    {errorMessage && (
                        <div className="bg-destructive/10 border border-destructive/20 rounded-md p-4">
                            <div className="flex items-start gap-2">
                                <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-destructive">
                                        Error al procesar el archivo
                                    </p>
                                    <p className="text-sm text-destructive/80 mt-1 whitespace-pre-line">
                                        {errorMessage}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={handleClose}
                        disabled={isProcessing}
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleProcessFile}
                        disabled={!file || isProcessing}
                    >
                        {isProcessing ? (
                            <>Procesando...</>
                        ) : (
                            <>
                                <Upload className="mr-2 h-4 w-4" /> Procesar Archivo
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
