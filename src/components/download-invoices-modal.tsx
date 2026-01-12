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
    const [errorMessage, setErrorMessage] = useState<string>("");
    const [successMessage, setSuccessMessage] = useState<string>("");
    const [scrapingResult, setScrapingResult] = useState<any>(null);

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
                if (onSuccess) {
                    onSuccess(result);
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
        if (!isScraping) {
            setUrl("");
            setErrorMessage("");
            setSuccessMessage("");
            setScrapingResult(null);
            onOpenChange(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Descargar Facturas</DialogTitle>
                    <DialogDescription>
                        Ingrese la URL de la página que desea analizar. El sistema realizará scraping
                        y capturará las solicitudes HTTP realizadas.
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
                            disabled={isScraping}
                            className="font-mono text-sm"
                        />
                    </div>

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
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={handleClose}
                        disabled={isScraping}
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleScrape}
                        disabled={!url.trim() || isScraping}
                    >
                        {isScraping ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Analizando...
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
