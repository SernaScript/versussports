"use client";

import { useEffect, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { AlertCircle } from "lucide-react";

interface PDFViewerModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    pdfUrl: string | null;
    fileName?: string;
}

export function PDFViewerModal({
    open,
    onOpenChange,
    pdfUrl,
    fileName = "Documento"
}: PDFViewerModalProps) {
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (pdfUrl && open) {
            console.log("🔍 PDFViewerModal - URL del PDF:", pdfUrl);
            setError(null);
        }
    }, [pdfUrl, open]);

    if (!pdfUrl) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[98vw] w-[98vw] h-[95vh] flex flex-col p-0">
                <DialogHeader className="p-4 border-b">
                    <DialogTitle>{fileName}</DialogTitle>
                </DialogHeader>
                <div className="flex-1 w-full h-full bg-slate-100 p-1">
                    {error ? (
                        <div className="flex flex-col items-center justify-center h-full gap-4">
                            <AlertCircle className="h-12 w-12 text-red-500" />
                            <div className="text-center">
                                <p className="text-lg font-semibold text-red-600">Error al cargar el PDF</p>
                                <p className="text-sm text-muted-foreground mt-2">{error}</p>
                                <p className="text-xs text-muted-foreground mt-4">URL: {pdfUrl}</p>
                            </div>
                        </div>
                    ) : (
                        <iframe
                            src={pdfUrl}
                            className="w-full h-full rounded-md"
                            title="PDF Viewer"
                            onError={() => {
                                console.error("❌ Error cargando PDF desde:", pdfUrl);
                                setError("No se pudo cargar el PDF. Verifica que el archivo exista.");
                            }}
                            onLoad={() => {
                                console.log("✅ PDF cargado exitosamente desde:", pdfUrl);
                            }}
                        />
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
