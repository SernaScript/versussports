"use server";

import { prisma } from "@/lib/prisma";
import { createPurchaseInvoice, getSiigoAuthToken } from "./siigo";
import { revalidatePath } from "next/cache";
import { XMLParser } from "fast-xml-parser";
import fs from "fs";
import path from "path";

// Helper to parse XML
function extractItemsFromXml(xmlContent: string) {
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_"
    });
    const result = parser.parse(xmlContent);

    // Navigate to Invoice (UBL 2.1 standard structure usually)
    // Root can be 'Invoice' or 'fe:Invoice' (DIAN)
    // DIAN XML attached document usually wraps the Invoice in 'cac:Attachment' -> 'cac:ExternalReference' -> 'cbc:Description' (base64)
    // But typically the saved XML is the Invoice structure itself if extracted.
    // Let's assume standard Invoice root.

    // Attempt to find root
    const root = result.Invoice || result["fe:Invoice"] || Object.values(result)[0]; // Fallback

    if (!root) return null;

    // Check for lines
    // Namespace prefixes can vary (cac:InvoiceLine, or just InvoiceLine)
    // We'll iterate to find keys usually associated with lines.

    // Normalize data access helper
    const getVal = (obj: any, keys: string[]) => {
        if (!obj) return undefined;
        for (const k of keys) {
            if (obj[k] !== undefined) return obj[k];
            // Try with prefix
            const withPrefix = Object.keys(obj).find(key => key.endsWith(`:${k}`) || key === k);
            if (withPrefix) return obj[withPrefix];
        }
        return undefined;
    };

    const linesContainer = root["cac:InvoiceLine"] || root["InvoiceLine"];
    // It might be an array or single object
    const lines = Array.isArray(linesContainer) ? linesContainer : (linesContainer ? [linesContainer] : []);

    if (lines.length === 0) return null;

    return lines.map((line: any) => {
        // Description
        const item = line["cac:Item"] || line["Item"];
        const description = item ? (item["cbc:Description"] || item["Description"]) : "Item Sin Descripción";

        // Quantity
        const qtyObj = line["cbc:InvoicedQuantity"] || line["InvoicedQuantity"];
        const quantity = Number(qtyObj?.["#text"] || qtyObj || 1);

        // Price (Unit)
        const priceObj = line["cac:Price"] || line["Price"];
        const priceVal = priceObj ? (priceObj["cbc:PriceAmount"] || priceObj["PriceAmount"]) : 0;
        const price = Number(priceVal?.["#text"] || priceVal || 0);

        // Taxes (detailed extraction)
        const taxTotals = line["cac:TaxTotal"] || line["TaxTotal"];
        const taxes: { value: number, rate: number }[] = [];

        if (taxTotals) {
            const taxArr = Array.isArray(taxTotals) ? taxTotals : [taxTotals];
            taxArr.forEach((t: any) => {
                const sub = t["cac:TaxSubtotal"] || t["TaxSubtotal"];
                if (sub) {
                    const subArr = Array.isArray(sub) ? sub : [sub];
                    subArr.forEach((s: any) => {
                        const amountObj = s["cbc:TaxAmount"] || s["TaxAmount"];
                        const amount = Number(amountObj?.["#text"] || amountObj || 0);

                        // Try to find rate
                        const percentObj = s["cbc:Percent"] || s["Percent"]; // Standard UBL
                        // Sometimes it's in cac:TaxCategory -> cbc:Percent
                        let rate = Number(percentObj?.["#text"] || percentObj || 0);

                        if (!rate && (s["cac:TaxCategory"] || s["TaxCategory"])) {
                            const cat = s["cac:TaxCategory"] || s["TaxCategory"];
                            const catPercent = cat["cbc:Percent"] || cat["Percent"];
                            rate = Number(catPercent?.["#text"] || catPercent || 0);
                        }

                        // Fallback calculation if rate is missing but we have base
                        if (!rate) {
                            const baseObj = s["cbc:TaxableAmount"] || s["TaxableAmount"] || t["cbc:TaxAmount"] || t["TaxAmount"]; // Rough guess
                            // Actually TaxableAmount is usually in TaxSubtotal too
                            const baseValObj = s["cbc:TaxableAmount"] || s["TaxableAmount"];
                            const base = Number(baseValObj?.["#text"] || baseValObj || 0);
                            if (base > 0) {
                                rate = (amount / base) * 100;
                            }
                        }

                        taxes.push({ value: amount, rate: Number(rate.toFixed(2)) });
                    });
                }
            });
        }

        return {
            description: String(description),
            quantity: quantity,
            price: price,
            taxesRaw: taxes
        };
    });
}

function getSiigoTaxId(rate: number): number | null {
    // Round to nearest integer or handle .00
    const rounded = Math.round(rate);
    if (rounded === 19) return 27572; // IVA 19%
    if (rounded === 5) return 27573;  // IVA 5%
    if (rounded === 8) return 27587;  // INC/IPO 8%
    // TODO: Add more mappings as discovered
    return null;
}

export async function previewSiigoCausation(invoiceId: string) {
    try {
        const invoice = await prisma.dianInvoice.findUnique({
            where: { id: invoiceId },
        });

        if (!invoice) {
            return { success: false, error: "Factura no encontrada" };
        }

        const providerConfig = await (prisma as any).providerAccountingConfig.findUnique({
            where: { providerNit: invoice.issuerNit },
            include: {
                expenseAccount: true,
                withholdingTax: true,
            },
        });

        if (!providerConfig) {
            return {
                success: false,
                error: `El proveedor con NIT ${invoice.issuerNit} no tiene configuración contable. Por favor configúrelo en Ajustes > Terceros.`,
            };
        }

        // Get the account code for product mapping
        const productCode = providerConfig.expenseAccount?.code || "001";

        // --- ITEM GENERATION LOGIC ---
        let items: any[] = [];
        let fromXml = false;

        // Try to read XML
        if (invoice.XMLURL) {
            try {
                // Resolve path: assumes XMLURL is relative to project root or 'downloads/'
                // Remove leading slashes or 'downloads/' duplication
                const cleanPath = invoice.XMLURL.replace(/^\//, '').replace(/^downloads\//, '');
                const fullPath = path.join(process.cwd(), "downloads", cleanPath);

                if (fs.existsSync(fullPath)) {
                    const xmlContent = fs.readFileSync(fullPath, "utf-8");
                    const xmlItems = extractItemsFromXml(xmlContent);

                    if (xmlItems && xmlItems.length > 0) {
                        fromXml = true;
                        items = xmlItems.map(x => {
                            const mappedTaxes = x.taxesRaw
                                .map(t => {
                                    const id = getSiigoTaxId(t.rate);
                                    return id ? { id, value: t.value } : null;
                                })
                                .filter(Boolean);

                            return {
                                type: "Account",
                                code: productCode, // Use the mapped account code
                                description: x.description,
                                quantity: x.quantity,
                                price: x.price,
                                discount: 0,
                                taxes: mappedTaxes
                            };
                        });
                    }
                }
            } catch (e) {
                console.warn("Failed to parse XML for invoice:", invoice.id, e);
                // Fallback to database summary
            }
        }

        // Fallback if no XML items found
        if (!fromXml) {
            const itemsTaxes = [];
            const valVat = Number(invoice.vat || 0);
            const valTotal = Number(invoice.total || 0);
            const valInc = Number(invoice.inc || 0);
            const valBags = Number(invoice.incBags || 0);

            // Base estimation
            const taxesVal = valVat + valInc + valBags;
            const baseValue = valTotal - taxesVal;

            // Infer VAT Rate
            if (valVat > 0 && baseValue > 0) {
                const rate = (valVat / baseValue) * 100;
                const ruleId = getSiigoTaxId(rate);
                if (ruleId) {
                    itemsTaxes.push({ id: ruleId, value: valVat });
                }
            }

            // TODO: Handle INC (Impuesto Nacional al Consumo) mapping if generic code exists

            const description = `Factura de Compra ${invoice.prefix || ""}${invoice.folio} - ${invoice.issuerName}`;

            items = [{
                type: "Account",
                code: productCode,
                description: description,
                quantity: 1,
                price: baseValue,
                discount: 0,
                taxes: itemsTaxes
            }];
        }

        // --- END ITEM LOGIC ---

        const date = invoice.issueDate.toISOString().split("T")[0];

        // Calculate total from items to match Siigo's calculation (max 2 decimals)
        const totalPayments = items.reduce((acc, item) => {
            const itemBase = item.price * item.quantity;
            const itemTaxes = item.taxes ? item.taxes.reduce((tAcc: number, t: any) => tAcc + t.value, 0) : 0;
            return acc + itemBase + itemTaxes;
        }, 0);

        // Payments
        const payments = [
            {
                id: 9585,
                value: Number(totalPayments.toFixed(2)),
                due_date: date
            }
        ];

        const payload = {
            document: {
                id: 46614
            },
            date: date,
            supplier: {
                identification: invoice.issuerNit,
                branch_office: 0
            },
            provider_invoice: {
                prefix: invoice.prefix || "",
                number: invoice.folio || ""
            },
            items: items,
            payments: payments,
            observations: `Causación automática desde App para Factura ${invoice.id}`
        };

        const headers = {
            "Content-Type": "application/json",
            "Authorization": "Bearer [TOKEN]",
            "Partner-Id": "[PARTNER_ID]"
        };

        return {
            success: true,
            data: {
                headers,
                body: payload,
                invoice,
                providerConfig,
                source: fromXml ? "XML Parsed" : "Database Summary"
            }
        };

    } catch (error) {
        console.error("Error previewing causation:", error);
        return { success: false, error: "Error generando la vista previa" };
    }
}

export async function createSiigoCausation(invoiceId: string, payload: any) {
    try {
        // We accept the payload from the client to allow for potential (future) manual edits 
        // or just to ensure we send exactly what the user approved.
        // For security, we might re-validate or re-build, but for this specific "Approve Preview" flow, passing it back is easier.

        const result = await createPurchaseInvoice(payload);

        if (result.success) {
            await prisma.dianInvoice.update({
                where: { id: invoiceId },
                data: {
                    isAccounted: true,
                    causationResult: result.data
                },
            });
            revalidatePath("/facturas");
        }

        return result;
    } catch (error) {
        console.error("Error creating causation:", error);
        return { success: false, error: "Error enviando la causación" };
    }
}
