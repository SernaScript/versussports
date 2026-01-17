"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, AlertCircle, FileJson, FileCode, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { previewSiigoCausation, createSiigoCausation } from "@/app/actions/siigo-causation";
import { LoadingSection } from "@/components/ui/loading-section";
import { cn } from "@/lib/utils";

interface SiigoCausationModalProps {
    invoiceId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export function SiigoCausationModal({
    invoiceId,
    open,
    onOpenChange,
    onSuccess,
}: SiigoCausationModalProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [previewData, setPreviewData] = useState<any>(null);

    useEffect(() => {
        if (open && invoiceId) {
            loadPreview(invoiceId);
        } else {
            setPreviewData(null);
            setError(null);
        }
    }, [open, invoiceId]);

    const loadPreview = async (id: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await previewSiigoCausation(id);
            if (result.success) {
                setPreviewData(result.data);
            } else {
                setError(result.error || "Error al cargar la vista previa");
            }
        } catch (err) {
            setError("Error de comunicación con el servidor");
        } finally {
            setIsLoading(false);
        }
    };

    const handleConfirm = async () => {
        if (!invoiceId || !previewData) return;

        setIsSaving(true);
        try {
            // We pass the payload back to the server to be sent (or the server could re-generate it)
            // Passing it back ensures what the user saw is what is sent (if editable in future).
            const result = await createSiigoCausation(invoiceId, previewData.body);

            if (result.success) {
                onSuccess();
                onOpenChange(false);
            } else {
                setError(result.error || "Error al enviar la causación");
            }
        } catch (err) {
            setError("Error inesperado al enviar");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(val) => !isSaving && onOpenChange(val)}>
            <DialogContent className="sm:max-w-[700px] h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Contabilizar Factura en Siigo</DialogTitle>
                    <DialogDescription>
                        Revise la información que se enviará a Siigo antes de confirmar.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden py-2 relative">
                    {isLoading ? (
                        <div className="flex justify-center items-center h-full">
                            <LoadingSection />
                        </div>
                    ) : error ? (
                        <div className="bg-destructive/10 p-4 rounded-md flex gap-3 text-destructive items-start">
                            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-medium">No se puede realizar la causación</p>
                                <p className="text-sm opacity-90">{error}</p>
                            </div>
                        </div>
                    ) : previewData ? (
                        <Tabs defaultValue="body" className="h-full flex flex-col">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="body">Body (JSON)</TabsTrigger>
                                <TabsTrigger value="headers">Headers</TabsTrigger>
                            </TabsList>
                            <TabsContent value="body" className="flex-1 overflow-auto rounded-md border p-4 bg-slate-50 mt-2">
                                <div className="space-y-4">
                                    <div className="bg-blue-50 text-blue-800 p-3 rounded-md text-sm mb-2 flex gap-2">
                                        <FileJson className="h-4 w-4 mt-0.5" />
                                        <div>
                                            <span className="font-semibold block">Estructura /v1/purchases</span>
                                            Se creará una Factura de Compra con la siguiente información.
                                        </div>
                                    </div>
                                    <pre className="text-xs font-mono whitespace-pre-wrap break-all text-slate-800">
                                        {JSON.stringify(previewData.body, null, 2)}
                                    </pre>
                                </div>
                            </TabsContent>
                            <TabsContent value="headers" className="flex-1 overflow-auto rounded-md border p-4 bg-slate-50 mt-2">
                                <div className="bg-slate-100 p-3 rounded-md text-sm mb-2 flex gap-2">
                                    <FileCode className="h-4 w-4 mt-0.5" />
                                    <span>Headers de la petición</span>
                                </div>
                                <pre className="text-xs font-mono whitespace-pre-wrap text-slate-800">
                                    {JSON.stringify(previewData.headers, null, 2)}
                                </pre>
                            </TabsContent>
                        </Tabs>
                    ) : null}
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isSaving}
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={isSaving || !!error || isLoading}
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        {isSaving ? "Enviando..." : (
                            <>
                                <Check className="mr-2 h-4 w-4" /> Confirmar Contabilización
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
