"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AlertCircle, Loader2, FileCode, Package, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { parseInvoiceItems, formatXML, parseInvoiceHeader, InvoiceItem, InvoiceHeader } from "@/app/facturas/utils/xml-parser";

export default function XMLViewerPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const xmlUrl = searchParams.get("url");

    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [xmlContent, setXmlContent] = useState<string | null>(null);
    const [items, setItems] = useState<InvoiceItem[]>([]);
    const [invoiceHeader, setInvoiceHeader] = useState<InvoiceHeader | null>(null);
    const [activeTab, setActiveTab] = useState<"xml" | "items">("items");

    useEffect(() => {
        if (xmlUrl) {
            console.log("🔍 XMLViewerPage - URL del XML:", xmlUrl);
            setError(null);
            setLoading(true);
            setXmlContent(null);
            setItems([]);

            fetch(xmlUrl)
                .then((response) => {
                    if (!response.ok) {
                        throw new Error(`Error HTTP: ${response.status}`);
                    }
                    return response.text();
                })
                .then((text) => {
                    setXmlContent(text);
                    const parsedItems = parseInvoiceItems(text);
                    const header = parseInvoiceHeader(text);
                    setItems(parsedItems);
                    setInvoiceHeader(header);
                    setLoading(false);
                })
                .catch((err) => {
                    console.error("❌ Error cargando XML:", err);
                    setError(err instanceof Error ? err.message : "Error al cargar el XML");
                    setLoading(false);
                });
        } else {
            setError("No se proporcionó una URL de XML");
        }
    }, [xmlUrl]);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat("es-CO", {
            style: "currency",
            currency: "COP",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value);
    };

    // Generar el nombre del archivo basado en prefijo+folio o el ID del archivo
    const fileName = invoiceHeader && invoiceHeader.prefix && invoiceHeader.folio
        ? `Factura ${invoiceHeader.prefix}${invoiceHeader.folio}`
        : xmlUrl
            ? `Factura XML ${xmlUrl.split("/").pop()?.replace(".xml", "") || ""}`
            : "Factura XML";

    if (!xmlUrl) {
        return (
            <div className="container mx-auto p-6">
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
                        <p className="text-lg font-semibold text-red-600 mb-2">
                            No se proporcionó una URL de XML
                        </p>
                        <Button onClick={() => router.push("/facturas")} className="mt-4">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Volver a Facturas
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.push("/facturas")}
                        title="Volver a Facturas"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <h1 className="text-2xl font-bold">{fileName}</h1>
                </div>
            </div>

            {/* Datos clave de la factura */}
            {invoiceHeader && (
                <>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <p className="text-sm font-medium text-muted-foreground">Proveedor</p>
                                    <p className="text-base font-semibold">{invoiceHeader.issuerName || "N/A"}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm font-medium text-muted-foreground">Factura</p>
                                    <p className="text-base font-semibold">
                                        {invoiceHeader.prefix && invoiceHeader.folio
                                            ? `${invoiceHeader.prefix}${invoiceHeader.folio}`
                                            : invoiceHeader.prefix || invoiceHeader.folio || "N/A"}
                                    </p>
                                </div>

                            </div>
                        </CardContent>
                    </Card>

                    {/* Resumen de Impuestos */}
                    {invoiceHeader.taxSubtotals.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Resumen de Impuestos</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-medium text-muted-foreground">Total Impuestos</p>
                                        <p className="text-lg font-bold">{formatCurrency(invoiceHeader.totalTaxAmount)}</p>
                                    </div>
                                    <div className="border rounded-lg overflow-hidden">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-slate-50/50">
                                                    <TableHead className="font-semibold">Tipo de Impuesto</TableHead>
                                                    <TableHead className="font-semibold text-right">Base Imponible</TableHead>
                                                    <TableHead className="font-semibold text-right">Porcentaje</TableHead>
                                                    <TableHead className="font-semibold text-right">Monto</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {invoiceHeader.taxSubtotals.map((tax, index) => (
                                                    <TableRow key={index}>
                                                        <TableCell className="font-medium">
                                                            {tax.taxSchemeName} ({tax.taxSchemeId})
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            {formatCurrency(tax.taxableAmount)}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            {tax.percent.toFixed(2)}%
                                                        </TableCell>
                                                        <TableCell className="text-right font-semibold">
                                                            {formatCurrency(tax.taxAmount)}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Total Monetario Legal */}
                    {invoiceHeader.legalMonetaryTotal && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Total Monetario</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="flex items-center justify-between border-b pb-2">
                                            <p className="text-sm font-medium text-muted-foreground">Total Líneas (Sin Impuestos)</p>
                                            <p className="text-base font-semibold">
                                                {formatCurrency(invoiceHeader.legalMonetaryTotal.lineExtensionAmount)}
                                            </p>
                                        </div>
                                        <div className="flex items-center justify-between border-b pb-2">
                                            <p className="text-sm font-medium text-muted-foreground">Monto Sin Impuestos</p>
                                            <p className="text-base font-semibold">
                                                {formatCurrency(invoiceHeader.legalMonetaryTotal.taxExclusiveAmount)}
                                            </p>
                                        </div>
                                        <div className="flex items-center justify-between border-b pb-2">
                                            <p className="text-sm font-medium text-muted-foreground">Monto Con Impuestos</p>
                                            <p className="text-base font-semibold">
                                                {formatCurrency(invoiceHeader.legalMonetaryTotal.taxInclusiveAmount)}
                                            </p>
                                        </div>
                                        <div className="flex items-center justify-between border-b pb-2">
                                            <p className="text-sm font-medium text-muted-foreground">Total Descuentos</p>
                                            <p className="text-base font-semibold">
                                                {formatCurrency(invoiceHeader.legalMonetaryTotal.allowanceTotalAmount)}
                                            </p>
                                        </div>
                                        <div className="flex items-center justify-between border-b pb-2">
                                            <p className="text-sm font-medium text-muted-foreground">Total Cargos</p>
                                            <p className="text-base font-semibold">
                                                {formatCurrency(invoiceHeader.legalMonetaryTotal.chargeTotalAmount)}
                                            </p>
                                        </div>
                                        <div className="flex items-center justify-between border-b pb-2">
                                            <p className="text-sm font-medium text-muted-foreground">Monto Prepagado</p>
                                            <p className="text-base font-semibold">
                                                {formatCurrency(invoiceHeader.legalMonetaryTotal.prepaidAmount)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between pt-4 border-t-2 border-primary/20">
                                        <p className="text-lg font-bold">Monto a Pagar</p>
                                        <p className="text-2xl font-bold text-primary">
                                            {formatCurrency(invoiceHeader.legalMonetaryTotal.payableAmount)}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </>
            )}

            <Card>
                <CardHeader>
                    <div className="flex border-b">
                        <Button
                            variant="ghost"
                            onClick={() => setActiveTab("items")}
                            className={`rounded-none border-b-2 ${activeTab === "items"
                                ? "border-primary text-primary"
                                : "border-transparent"
                                }`}
                        >
                            <Package className="mr-2 h-4 w-4" />
                            Items ({items.length})
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={() => setActiveTab("xml")}
                            className={`rounded-none border-b-2 ${activeTab === "xml"
                                ? "border-primary text-primary"
                                : "border-transparent"
                                }`}
                        >
                            <FileCode className="mr-2 h-4 w-4" />
                            XML Completo
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-4">
                            <Loader2 className="h-12 w-12 text-primary animate-spin" />
                            <p className="text-sm text-muted-foreground">Cargando XML...</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-4">
                            <AlertCircle className="h-12 w-12 text-red-500" />
                            <div className="text-center">
                                <p className="text-lg font-semibold text-red-600">Error al cargar el XML</p>
                                <p className="text-sm text-muted-foreground mt-2">{error}</p>
                                <p className="text-xs text-muted-foreground mt-4">URL: {xmlUrl}</p>
                            </div>
                            <Button onClick={() => router.push("/facturas")} className="mt-4">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Volver a Facturas
                            </Button>
                        </div>
                    ) : activeTab === "items" ? (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-semibold">Items de la Factura</h3>
                                <span className="text-sm text-muted-foreground">
                                    {items.length} item{items.length !== 1 ? "s" : ""}
                                </span>
                            </div>
                            {items.length > 0 ? (
                                <div className="border rounded-lg overflow-hidden bg-white">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-slate-50/50">
                                                <TableHead className="font-semibold">ID</TableHead>
                                                <TableHead className="font-semibold">Descripción</TableHead>
                                                <TableHead className="font-semibold text-right">Cantidad</TableHead>
                                                <TableHead className="font-semibold text-right">Precio Unit.</TableHead>
                                                <TableHead className="font-semibold text-right">Total</TableHead>
                                                <TableHead className="font-semibold">Código</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {items.map((item, index) => (
                                                <TableRow key={index}>
                                                    <TableCell className="font-mono text-sm">
                                                        {item.lineId}
                                                    </TableCell>
                                                    <TableCell className="max-w-md">
                                                        <div className="space-y-1">
                                                            <div className="font-medium">{item.description}</div>
                                                            {item.brandName && (
                                                                <div className="text-xs text-muted-foreground">
                                                                    Marca: {item.brandName}
                                                                </div>
                                                            )}
                                                            {item.modelName && (
                                                                <div className="text-xs text-muted-foreground">
                                                                    Modelo: {item.modelName}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="space-y-1">
                                                            <div>{item.quantity.toLocaleString("es-CO")}</div>
                                                            {item.unitCode && (
                                                                <div className="text-xs text-muted-foreground">
                                                                    {item.unitCode}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {item.priceAmount !== undefined
                                                            ? formatCurrency(item.priceAmount)
                                                            : "-"}
                                                    </TableCell>
                                                    <TableCell className="text-right font-semibold">
                                                        {formatCurrency(item.lineExtensionAmount)}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="space-y-1">
                                                            {item.sellerItemId && (
                                                                <div className="text-xs font-mono">
                                                                    Vendedor: {item.sellerItemId}
                                                                </div>
                                                            )}
                                                            {item.standardItemId && (
                                                                <div className="text-xs font-mono text-muted-foreground">
                                                                    Estándar: {item.standardItemId}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <Package className="h-10 w-10 text-muted-foreground opacity-50 mb-4" />
                                    <p className="text-sm text-muted-foreground">
                                        No se encontraron items en el XML
                                    </p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-semibold">XML Completo</h3>
                            </div>
                            {xmlContent ? (
                                <div className="border rounded-lg overflow-hidden bg-white">
                                    <pre className="p-4 overflow-auto text-xs font-mono bg-slate-900 text-slate-100 max-h-[calc(100vh-300px)]">
                                        <code>{formatXML(xmlContent)}</code>
                                    </pre>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <FileCode className="h-10 w-10 text-muted-foreground opacity-50 mb-4" />
                                    <p className="text-sm text-muted-foreground">
                                        No hay contenido XML disponible
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
