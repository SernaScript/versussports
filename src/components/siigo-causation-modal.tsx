"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, AlertCircle, FileJson, FileCode, Check, X, UserPlus } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { previewSiigoCausation, createSiigoCausation } from "@/app/actions/siigo-causation";
import { createSupplierInSiigo } from "@/app/actions/suppliers";
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

    // Supplier Creation State
    const [missingSupplier, setMissingSupplier] = useState(false);
    const [supplierData, setSupplierData] = useState<any>({
        identification: "",
        name: "",
        email: "",
        phone: "",
        address: "",
        city: ""
    });

    useEffect(() => {
        if (open && invoiceId) {
            loadPreview(invoiceId);
        } else {
            resetState();
        }
    }, [open, invoiceId]);

    const resetState = () => {
        setPreviewData(null);
        setError(null);
        setMissingSupplier(false);
        setSupplierData({
            identification: "",
            name: "",
            email: "",
            phone: "",
            address: "",
            city: ""
        });
    };

    const loadPreview = async (id: string) => {
        setIsLoading(true);
        setError(null);
        setMissingSupplier(false);
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

    const handleCreateSupplier = async () => {
        if (!invoiceId) return;
        setIsSaving(true);
        try {
            const result = await createSupplierInSiigo(supplierData);
            if (result.success) {
                // Supplier created, reload preview to continue normal flow
                await loadPreview(invoiceId);
            } else {
                setError(result.error || "Error al crear el proveedor");
            }
        } catch (err) {
            setError("Error al crear proveedor");
        } finally {
            setIsSaving(false);
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
                // onSuccess(); // Refresh parent - Call this maybe after closing
                // Instead of closing immediately, we show success state
                setPreviewData({ ...previewData, successResult: result.data });
                // But we should still notify parent to refresh lists
                onSuccess();
            } else if (result.missingSupplier) {
                setMissingSupplier(true);
                if (result.supplierData) {
                    setSupplierData(result.supplierData);
                }
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
                    <DialogTitle>
                        {missingSupplier ? "Crear Proveedor en Siigo" : "Contabilizar Factura en Siigo"}
                    </DialogTitle>
                    <DialogDescription>
                        {missingSupplier
                            ? "El proveedor de esta factura no existe en Siigo. Verifique los datos extraídos del XML para crearlo."
                            : "Revise la información que se enviará a Siigo antes de confirmar."}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto py-2 relative min-h-0">
                    {isLoading ? (
                        <div className="flex justify-center items-center h-full">
                            <LoadingSection />
                        </div>
                    ) : error ? (
                        <div className="bg-destructive/10 p-4 rounded-md flex gap-3 text-destructive items-start">
                            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-medium">Ocurrió un error</p>
                                <p className="text-sm opacity-90">{error}</p>
                                {missingSupplier && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="mt-2 border-destructive/30 hover:bg-destructive/10"
                                        onClick={() => setError(null)}
                                    >
                                        Intentar nuevamente
                                    </Button>
                                )}
                            </div>
                        </div>
                    ) : missingSupplier ? (
                        <div className="h-full flex flex-col gap-4">
                            <div className="bg-amber-50 border border-amber-200 p-3 rounded-md text-sm text-amber-800 flex gap-2 flex-shrink-0">
                                <AlertCircle className="h-4 w-4 mt-0.5" />
                                <p>Al crear el proveedor, el sistema intentará nuevamente la contabilización de la factura automáticamente.</p>
                            </div>

                            <Tabs defaultValue="form" className="flex-1 flex flex-col min-h-0">
                                <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
                                    <TabsTrigger value="form">Formulario</TabsTrigger>
                                    <TabsTrigger value="preview">Preview Petición HTTP</TabsTrigger>
                                </TabsList>

                                <TabsContent value="form" className="flex-1 overflow-y-auto rounded-md border p-4 mt-2 min-h-0">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Identificación (NIT)</Label>
                                            <Input
                                                value={supplierData.identification}
                                                onChange={(e) => setSupplierData({ ...supplierData, identification: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Nombre / Razón Social</Label>
                                            <Input
                                                value={supplierData.name}
                                                onChange={(e) => setSupplierData({ ...supplierData, name: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Email</Label>
                                            <Input
                                                value={supplierData.email}
                                                onChange={(e) => setSupplierData({ ...supplierData, email: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Teléfono</Label>
                                            <Input
                                                value={supplierData.phone}
                                                onChange={(e) => setSupplierData({ ...supplierData, phone: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2 col-span-2">
                                            <Label>Dirección</Label>
                                            <Input
                                                value={supplierData.address}
                                                onChange={(e) => setSupplierData({ ...supplierData, address: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Ciudad</Label>
                                            <Input
                                                value={supplierData.city}
                                                onChange={(e) => setSupplierData({ ...supplierData, city: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="preview" className="flex-1 overflow-y-auto rounded-md border p-4 bg-slate-50 mt-2 min-h-0">
                                    <div className="space-y-4">
                                        <div className="bg-slate-100 p-2 rounded text-xs font-mono text-slate-600 mb-2 break-all">
                                            <span className="font-bold text-blue-600">POST</span> https://api.siigo.com/v1/customers
                                        </div>

                                        <div className="space-y-2">
                                            <p className="text-sm font-semibold text-slate-700">Body</p>
                                            <pre className="text-xs font-mono whitespace-pre-wrap break-all text-slate-800 bg-white p-3 rounded border">
                                                {JSON.stringify({
                                                    type: "Supplier",
                                                    person_type: "Company",
                                                    id_type: "13",
                                                    identification: supplierData.identification,
                                                    name: supplierData.name,
                                                    email: supplierData.email || null,
                                                    phone: supplierData.phone || null,
                                                    address: supplierData.address ? {
                                                        address: supplierData.address,
                                                        city: supplierData.city ? {
                                                            city_name: supplierData.city
                                                        } : null
                                                    } : null
                                                }, null, 2)}
                                            </pre>
                                        </div>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </div>
                    ) : previewData?.successResult ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-slate-50 rounded-md border">
                            <div className="bg-green-100 p-4 rounded-full mb-4">
                                <CheckCircle2 className="h-12 w-12 text-green-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 mb-2">¡Contabilización Exitosa!</h3>
                            <p className="text-slate-600 mb-6 max-w-md">
                                La factura ha sido creada correctamente en Siigo.
                            </p>

                            <div className="bg-white p-4 rounded-md border text-left w-full max-w-sm shadow-sm mb-4">
                                <div className="text-xs text-slate-500 uppercase font-bold mb-2">Resultado Siigo</div>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <span className="text-slate-500">Comprobante:</span>
                                    <span className="font-mono font-medium">{previewData.successResult.id || "N/A"}</span>
                                    <span className="text-slate-500">Número:</span>
                                    <span className="font-mono font-medium">{previewData.successResult.number || "N/A"}</span>
                                </div>
                            </div>
                        </div>
                    ) : previewData ? (
                        <div className="flex-1 flex flex-col min-h-0">
                            <Tabs defaultValue="details" className="flex-1 flex flex-col min-h-0">
                                <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
                                    <TabsTrigger value="details">Detalles de Factura</TabsTrigger>
                                    <TabsTrigger value="raw">JSON Original</TabsTrigger>
                                </TabsList>

                                <TabsContent value="details" className="flex-1 overflow-y-auto bg-slate-50 p-4 rounded-md mt-2 border min-h-0">
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 bg-white border p-2 rounded-md shadow-sm">
                                            <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-xs font-bold">POST</span>
                                            <span className="text-xs font-mono text-slate-600 truncate">https://api.siigo.com/v1/purchases</span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                            {/* Header Info */}
                                            <div className="bg-white p-3 rounded-md border shadow-sm">
                                                <div className="text-xs text-slate-500 mb-1 uppercase font-semibold tracking-wider">Documento</div>
                                                <div className="grid grid-cols-2 gap-y-2">
                                                    <div>
                                                        <span className="block text-xs text-slate-400">Fecha</span>
                                                        <span className="font-medium">{previewData.body.date}</span>
                                                    </div>
                                                    <div>
                                                        <span className="block text-xs text-slate-400">Número</span>
                                                        <span className="font-medium">{previewData.body.provider_invoice?.prefix || ""}{previewData.body.provider_invoice?.number}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Third Party */}
                                            <div className="bg-white p-3 rounded-md border shadow-sm">
                                                <div className="text-xs text-slate-500 mb-1 uppercase font-semibold tracking-wider">Tercero</div>
                                                <div>
                                                    <span className="block text-xs text-slate-400">Identificación</span>
                                                    <span className="font-medium">{previewData.body.supplier?.identification}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Items Table */}
                                        <div className="bg-white rounded-md border shadow-sm overflow-hidden">
                                            <div className="bg-slate-50 px-3 py-2 border-b text-xs font-semibold text-slate-500 uppercase tracking-wider">Ítems</div>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-xs text-left">
                                                    <thead>
                                                        <tr className="border-b bg-slate-50/50">
                                                            <th className="px-3 py-2 font-medium text-slate-500">Código</th>
                                                            <th className="px-3 py-2 font-medium text-slate-500">Descripción</th>
                                                            <th className="px-3 py-2 font-medium text-slate-500 text-right">Cant.</th>
                                                            <th className="px-3 py-2 font-medium text-slate-500 text-right">Precio</th>
                                                            <th className="px-3 py-2 font-medium text-slate-500 text-right">Subtotal</th>
                                                            <th className="px-3 py-2 font-medium text-slate-500 text-right">Impuestos</th>
                                                            <th className="px-3 py-2 font-medium text-slate-500 text-right">Total</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y">
                                                        {previewData.body.items?.map((item: any, idx: number) => {
                                                            const retentionTaxId = previewData.providerConfig?.withholdingTax?.siigoId
                                                                ? Number(previewData.providerConfig.withholdingTax.siigoId)
                                                                : null;

                                                            const itemBase = (item.quantity || 0) * (item.price || 0);
                                                            let taxesSum = 0;
                                                            let retentionSum = 0;

                                                            if (item.taxes) {
                                                                item.taxes.forEach((t: any) => {
                                                                    if (retentionTaxId && t.id === retentionTaxId) {
                                                                        retentionSum += t.value;
                                                                    } else {
                                                                        taxesSum += t.value;
                                                                    }
                                                                });
                                                            }

                                                            const itemTotal = itemBase + taxesSum - retentionSum;

                                                            return (
                                                                <tr key={idx}>
                                                                    <td className="px-3 py-2 font-mono text-slate-600">{item.code}</td>
                                                                    <td className="px-3 py-2 text-slate-700 truncate max-w-[150px]" title={item.description}>{item.description}</td>
                                                                    <td className="px-3 py-2 text-right">{item.quantity}</td>
                                                                    <td className="px-3 py-2 text-right">${item.price?.toLocaleString()}</td>
                                                                    <td className="px-3 py-2 text-right text-slate-600">
                                                                        ${itemBase.toLocaleString()}
                                                                    </td>
                                                                    <td className="px-3 py-2 text-right">
                                                                        {item.taxes && item.taxes.length > 0 ? (
                                                                            <div className="space-y-0.5">
                                                                                {item.taxes.map((tax: any, taxIdx: number) => {
                                                                                    const isRetention = retentionTaxId && tax.id === retentionTaxId;
                                                                                    return (
                                                                                        <div
                                                                                            key={taxIdx}
                                                                                            className={isRetention ? "text-red-600" : "text-green-600"}
                                                                                            title={isRetention ? "Retención (se resta)" : "Impuesto (se suma)"}
                                                                                        >
                                                                                            {isRetention ? "-" : "+"} ${tax.value.toLocaleString()}
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        ) : (
                                                                            <span className="text-slate-400">-</span>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-3 py-2 text-right font-medium text-slate-800">
                                                                        ${itemTotal.toLocaleString()}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>

                                        {/* Payments & Observations */}
                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                            <div className="bg-white p-3 rounded-md border shadow-sm">
                                                <div className="text-xs text-slate-500 mb-2 uppercase font-semibold tracking-wider">Pagos</div>

                                                {/* Calculate totals for summary */}
                                                {(() => {
                                                    const retentionTaxId = previewData.providerConfig?.withholdingTax?.siigoId
                                                        ? Number(previewData.providerConfig.withholdingTax.siigoId)
                                                        : null;

                                                    let totalBase = 0;
                                                    let totalTaxes = 0;
                                                    let totalRetentions = 0;

                                                    previewData.body.items?.forEach((item: any) => {
                                                        const itemBase = (item.quantity || 0) * (item.price || 0);
                                                        totalBase += itemBase;

                                                        if (item.taxes) {
                                                            item.taxes.forEach((t: any) => {
                                                                if (retentionTaxId && t.id === retentionTaxId) {
                                                                    totalRetentions += t.value;
                                                                } else {
                                                                    totalTaxes += t.value;
                                                                }
                                                            });
                                                        }
                                                    });

                                                    const calculatedTotal = totalBase + totalTaxes - totalRetentions;

                                                    return (
                                                        <div className="space-y-2">
                                                            {/* Summary breakdown */}
                                                            <div className="space-y-1 text-xs border-b pb-2">
                                                                <div className="flex justify-between text-slate-600">
                                                                    <span>Subtotal Items:</span>
                                                                    <span>${totalBase.toLocaleString()}</span>
                                                                </div>
                                                                {totalTaxes > 0 && (
                                                                    <div className="flex justify-between text-green-600">
                                                                        <span>+ Impuestos:</span>
                                                                        <span>${totalTaxes.toLocaleString()}</span>
                                                                    </div>
                                                                )}
                                                                {totalRetentions > 0 && (
                                                                    <div className="flex justify-between text-red-600">
                                                                        <span>- Retenciones:</span>
                                                                        <span>${totalRetentions.toLocaleString()}</span>
                                                                    </div>
                                                                )}
                                                                <div className="flex justify-between font-semibold text-slate-800 pt-1 border-t">
                                                                    <span>Total a Pagar:</span>
                                                                    <span>${calculatedTotal.toLocaleString()}</span>
                                                                </div>
                                                            </div>

                                                            {/* Payment methods */}
                                                            {previewData.body.payments?.map((payment: any, idx: number) => (
                                                                <div key={idx} className="flex justify-between items-center text-xs border-b last:border-0 py-1">
                                                                    <span className="text-slate-600">Forma #{payment.id}</span>
                                                                    <span className="font-medium">${payment.value?.toLocaleString()}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                            <div className="bg-white p-3 rounded-md border shadow-sm">
                                                <div className="text-xs text-slate-500 mb-1 uppercase font-semibold tracking-wider">Observaciones</div>
                                                <p className="text-xs text-slate-600 line-clamp-3" title={previewData.body.observations}>
                                                    {previewData.body.observations || "Ninguna"}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="raw" className="flex-1 overflow-y-auto rounded-md border p-4 bg-slate-50 mt-2 min-h-0">
                                    <div className="space-y-4">
                                        <div className="bg-slate-100 p-3 rounded-md text-sm mb-2 flex gap-2">
                                            <FileCode className="h-4 w-4 mt-0.5" />
                                            <span>Payload JSON Completo</span>
                                        </div>
                                        <pre className="text-xs font-mono whitespace-pre-wrap break-all text-slate-800 bg-white p-2 border rounded">
                                            {JSON.stringify(previewData, null, 2)}
                                        </pre>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </div>
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

                    {previewData?.successResult ? (
                        <Button
                            onClick={() => onOpenChange(false)}
                            className="bg-green-600 hover:bg-green-700 w-full sm:w-auto"
                        >
                            <Check className="mr-2 h-4 w-4" /> Finalizar
                        </Button>
                    ) : missingSupplier ? (
                        <Button
                            onClick={handleCreateSupplier}
                            disabled={isSaving || isLoading}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            {isSaving ? "Creando..." : (
                                <>
                                    <UserPlus className="mr-2 h-4 w-4" /> Crear Proveedor
                                </>
                            )}
                        </Button>
                    ) : (
                        <Button
                            onClick={handleConfirm}
                            disabled={isSaving || !!error || isLoading || !previewData}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            {isSaving ? "Enviando..." : (
                                <>
                                    <Check className="mr-2 h-4 w-4" /> Confirmar Contabilización
                                </>
                            )}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
