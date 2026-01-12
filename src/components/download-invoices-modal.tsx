"use client";

import { useState } from "react";
import { Download, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { scrapeUrl } from "@/app/actions/scraping";
import { downloadAllReceivedInvoices } from "@/app/actions/download-invoices";

interface DownloadInvoicesModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: (data: any) => void;
}

export function DownloadInvoicesModal({
    open,
    onOpenChange,
    onSuccess,
}: DownloadInvoicesModalProps) {
    const [url, setUrl] = useState("");
    const [isScraping, setIsScraping] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string>("");
    const [successMessage, setSuccessMessage] = useState<string>("");
    const [scrapingResult, setScrapingResult] = useState<any>(null);
    const [downloadSummary, setDownloadSummary] = useState<{
        success: number;
        failed: number;
        errors: Array<{ cufe: string; error: string }>;
    } | null>(null);

    const handleScrape = async () => {
        if (!url.trim()) {
            setErrorMessage("Por favor ingrese una URL válida");
            return;
        }

        setIsScraping(true);
        setErrorMessage("");
        setSuccessMessage("");
        setScrapingResult(null);

        try {
            const result = await scrapeUrl(url.trim());

            if (result.success) {
                setSuccessMessage("Scraping completado exitosamente");
                setScrapingResult(result);
                
                // Automáticamente ejecutar descarga de facturas después del scraping
                setIsDownloading(true);
                setDownloadSummary(null);
                
                try {
                    // Pasar la URL del usuario a la función de descarga
                    const downloadResult = await downloadAllReceivedInvoices(url.trim());
                    setDownloadSummary(downloadResult);
                    
                    if (downloadResult.success > 0) {
                        setSuccessMessage(
                            `Scraping y descarga completados. ${downloadResult.success} factura(s) descargada(s) exitosamente.`
                        );
                    } else if (downloadResult.failed > 0) {
                        setSuccessMessage(
                            `Scraping completado. No se pudieron descargar ${downloadResult.failed} factura(s).`
                        );
                    } else {
                        setSuccessMessage("Scraping completado. No hay facturas pendientes de descarga.");
                    }
                    
                    if (onSuccess) {
                        onSuccess({ scraping: result, download: downloadResult });
                    }
                } catch (downloadError) {
                    console.error("Error en descarga de facturas:", downloadError);
                    setErrorMessage(
                        `Scraping exitoso, pero error al descargar facturas: ${
                            downloadError instanceof Error ? downloadError.message : "Error desconocido"
                        }`
                    );
                } finally {
                    setIsDownloading(false);
                }
            } else {
                setErrorMessage(result.error || "Error al realizar el scraping");
            }
        } catch (error) {
            console.error("Error en scraping:", error);
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : "Error desconocido al realizar el scraping"
            );
        } finally {
            setIsScraping(false);
        }
    };

    const handleClose = () => {
        if (!isScraping && !isDownloading) {
            setUrl("");
            setErrorMessage("");
            setSuccessMessage("");
            setScrapingResult(null);
            setDownloadSummary(null);
            onOpenChange(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Descargar Facturas</DialogTitle>
                    <DialogDescription>
                        Ingrese la URL de la página de la DIAN. El sistema realizará scraping y
                        automáticamente descargará las facturas recibidas que aún no han sido descargadas.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="grid w-full items-center gap-2">
                        <Label htmlFor="url-input">URL</Label>
                        <Input
                            id="url-input"
                            type="url"
                            placeholder="https://ejemplo.com/facturas"
                            value={url}
                            onChange={(e) => {
                                setUrl(e.target.value);
                                setErrorMessage("");
                            }}
                            disabled={isScraping || isDownloading}
                            className="font-mono text-sm"
                        />
                    </div>

                    {(isScraping || isDownloading) && (
                        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                            <div className="flex items-center gap-2">
                                <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                                <p className="text-sm text-blue-800">
                                    {isScraping && "Analizando página..."}
                                    {isDownloading && "Descargando facturas desde la DIAN..."}
                                </p>
                            </div>
                        </div>
                    )}

                    {errorMessage && (
                        <div className="bg-destructive/10 border border-destructive/20 rounded-md p-4">
                            <div className="flex items-start gap-2">
                                <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-destructive">Error</p>
                                    <p className="text-sm text-destructive/80 mt-1">
                                        {errorMessage}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {successMessage && scrapingResult && (
                        <div className="bg-green-50 border border-green-200 rounded-md p-4">
                            <div className="flex items-start gap-2">
                                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-green-800">
                                        {successMessage}
                                    </p>
                                    <div className="mt-2 space-y-1 text-xs text-green-700">
                                        <p>
                                            <strong>Título:</strong> {scrapingResult.data?.title || "N/A"}
                                        </p>
                                        <p>
                                            <strong>Solicitudes HTTP capturadas:</strong>{" "}
                                            {scrapingResult.httpRequests?.length || 0}
                                        </p>
                                    </div>
                                    {scrapingResult.httpRequests && scrapingResult.httpRequests.length > 0 && (
                                        <div className="mt-3 max-h-60 overflow-y-auto">
                                            <p className="text-xs font-semibold text-green-800 mb-2">
                                                Solicitudes HTTP:
                                            </p>
                                            <div className="space-y-2">
                                                {scrapingResult.httpRequests.slice(0, 10).map((req: any, index: number) => (
                                                    <div
                                                        key={index}
                                                        className="bg-white p-2 rounded border border-green-200 text-xs"
                                                    >
                                                        <p className="font-mono text-green-900 break-all">
                                                            <strong>{req.method}</strong> {req.url}
                                                        </p>
                                                        {req.body && (
                                                            <p className="mt-1 text-green-700 break-all">
                                                                Body: {req.body.substring(0, 100)}
                                                                {req.body.length > 100 ? "..." : ""}
                                                            </p>
                                                        )}
                                                    </div>
                                                ))}
                                                {scrapingResult.httpRequests.length > 10 && (
                                                    <p className="text-xs text-green-600">
                                                        ... y {scrapingResult.httpRequests.length - 10} más
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {downloadSummary && (
                        <div className="bg-slate-50 border border-slate-200 rounded-md p-4">
                            <p className="text-sm font-semibold text-slate-800 mb-2">
                                Resumen de Descarga
                            </p>
                            <div className="space-y-1 text-xs text-slate-700">
                                <p>
                                    <strong className="text-green-700">
                                        ✓ Exitosas: {downloadSummary.success}
                                    </strong>
                                </p>
                                {downloadSummary.failed > 0 && (
                                    <>
                                        <p>
                                            <strong className="text-red-700">
                                                ✗ Fallidas: {downloadSummary.failed}
                                            </strong>
                                        </p>
                                        {downloadSummary.errors.length > 0 && (
                                            <div className="mt-2 max-h-40 overflow-y-auto">
                                                <p className="font-semibold mb-1">Errores:</p>
                                                <div className="space-y-1">
                                                    {downloadSummary.errors.slice(0, 5).map((err, idx) => (
                                                        <p key={idx} className="text-red-600 font-mono text-xs">
                                                            {err.cufe}: {err.error.substring(0, 50)}
                                                            {err.error.length > 50 ? "..." : ""}
                                                        </p>
                                                    ))}
                                                    {downloadSummary.errors.length > 5 && (
                                                        <p className="text-slate-500">
                                                            ... y {downloadSummary.errors.length - 5} error(es) más
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={handleClose}
                        disabled={isScraping || isDownloading}
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleScrape}
                        disabled={!url.trim() || isScraping || isDownloading}
                    >
                        {(isScraping || isDownloading) ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                {isScraping ? "Analizando..." : "Descargando..."}
                            </>
                        ) : (
                            <>
                                <Download className="mr-2 h-4 w-4" />
                                Descargar Facturas
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
