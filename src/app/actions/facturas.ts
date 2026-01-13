"use server";

import { revalidatePath } from "next/cache";
import { ProcessedDianInvoice } from "@/app/facturas/utils/dian-file-validator";
import { prisma } from "@/lib/prisma";

/**
 * Guarda facturas DIAN en la base de datos
 * Evita duplicados usando el ID (CUFE/CUDE)
 */
/**
 * Helper to parse dates robustly
 */
function parseDate(value: any): Date | null {
    if (!value) return null;
    if (value instanceof Date) {
        return isNaN(value.getTime()) ? null : value;
    }

    const str = String(value).trim();
    if (!str) return null;

    // Try standard constructor (ISO, YYYY-MM-DD, etc)
    let date = new Date(str);
    if (!isNaN(date.getTime())) return date;

    // Try Excel format if it's a number (serial date) handled by upstream?
    // But data seems to be strings here like "YYYY-MM-DD" or "DD/MM/YYYY"

    // Try DD/MM/YYYY or DD-MM-YYYY
    const parts = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (parts) {
        const day = parseInt(parts[1], 10);
        const month = parseInt(parts[2], 10) - 1;
        const yearStr = parts[3];
        let year = parseInt(yearStr, 10);
        if (yearStr.length === 2) year += 2000;

        date = new Date(year, month, day);
        if (!isNaN(date.getTime())) return date;
    }

    return null;
}

export async function saveDianInvoices(invoices: ProcessedDianInvoice[]) {
    try {
        if (invoices.length === 0) {
            return { success: true, count: 0, message: "No hay facturas para guardar" };
        }

        // Preparar datos para insertar/actualizar
        const formattedInvoices = invoices.map((invoice) => {
            let issueDate = parseDate(invoice.issueDate);
            // Si la fecha es inválida, usar fecha actual como fallback o dejar que falle?
            // Para evitar el error "Invalid Date", si es null, usaremos new Date() 
            // pero idealmente deberíamos omitir esta factura.
            if (!issueDate) {
                console.warn(`Fecha inválida para factura ${invoice.id}: ${invoice.issueDate}. Usando fecha actual.`);
                issueDate = new Date(); // Fallback to avoid crash, or construct invalid date?
            }

            const receptionDate = parseDate(invoice.receptionDate);

            return {
                id: invoice.id,
                documentType: invoice.documentType || "",
                folio: invoice.folio || "",
                prefix: invoice.prefix || "",
                issueDate: issueDate,
                issuerNit: invoice.issuerNit || "",
                issuerName: invoice.issuerName || "",
                receiverNit: invoice.receiverNit || "",
                receiverName: invoice.receiverName || "",
                vat: invoice.vat || 0,
                inc: invoice.inc || 0,
                total: invoice.total || 0,
                group: invoice.group || "",
                // Campos opcionales
                currency: invoice.currency || null,
                paymentMethod: invoice.paymentMethod || null,
                paymentMedium: invoice.paymentMedium || null,
                receptionDate: receptionDate,
                ica: invoice.ica || null,
                ic: invoice.ic || null,
                stamp: invoice.stamp || null,
                incBags: invoice.incBags || null,
                carbonTax: invoice.carbonTax || null,
                fuelTax: invoice.fuelTax || null,
                dataTax: invoice.dataTax || null,
                icl: invoice.icl || null,
                inpp: invoice.inpp || null,
                ibua: invoice.ibua || null,
                icui: invoice.icui || null,
                withheldVat: invoice.withheldVat || null,
                withheldIncome: invoice.withheldIncome || null,
                withheldIca: invoice.withheldIca || null,
                status: invoice.status || null,
            };
        });

        // Usar upsert para evitar duplicados (crear o actualizar)
        let savedCount = 0;
        let skippedCount = 0;

        for (const invoice of formattedInvoices) {
            try {
                // Al actualizar, no sobrescribir los campos de tracking (isDownloaded, isAccounted, XMLURL, PDFURL)
                // Estos campos se mantienen con sus valores actuales en la BD
                await prisma.dianInvoice.upsert({
                    where: { id: invoice.id },
                    update: {
                        // Solo actualizar campos de datos de factura, no campos de tracking
                        documentType: invoice.documentType,
                        folio: invoice.folio,
                        prefix: invoice.prefix,
                        issueDate: invoice.issueDate,
                        issuerNit: invoice.issuerNit,
                        issuerName: invoice.issuerName,
                        receiverNit: invoice.receiverNit,
                        receiverName: invoice.receiverName,
                        vat: invoice.vat,
                        inc: invoice.inc,
                        total: invoice.total,
                        group: invoice.group,
                        currency: invoice.currency,
                        paymentMethod: invoice.paymentMethod,
                        paymentMedium: invoice.paymentMedium,
                        receptionDate: invoice.receptionDate,
                        ica: invoice.ica,
                        ic: invoice.ic,
                        stamp: invoice.stamp,
                        incBags: invoice.incBags,
                        carbonTax: invoice.carbonTax,
                        fuelTax: invoice.fuelTax,
                        dataTax: invoice.dataTax,
                        icl: invoice.icl,
                        inpp: invoice.inpp,
                        ibua: invoice.ibua,
                        icui: invoice.icui,
                        withheldVat: invoice.withheldVat,
                        withheldIncome: invoice.withheldIncome,
                        withheldIca: invoice.withheldIca,
                        status: invoice.status,
                        // Los campos isDownloaded, isAccounted, XMLURL, PDFURL se mantienen con sus valores actuales
                    },
                    create: invoice, // Al crear, incluir todos los campos con valores por defecto
                });
                savedCount++;
            } catch (error) {
                console.error(`Error guardando factura ${invoice.id}:`, error);
                skippedCount++;
            }
        }

        revalidatePath("/facturas");
        return {
            success: true,
            count: savedCount,
            skipped: skippedCount,
            message: `Se guardaron ${savedCount} factura(s)${skippedCount > 0 ? `, ${skippedCount} omitida(s)` : ""}`,
        };
    } catch (error) {
        console.error("❌ Error guardando facturas:", error);
        const errorMessage = error instanceof Error ? error.message : "Error desconocido al guardar las facturas";

        // Mensaje más descriptivo para errores comunes
        let userMessage = errorMessage;
        if (errorMessage.includes("DATABASE_URL")) {
            userMessage = "Error de configuración: DATABASE_URL no está configurada. Por favor, configura la conexión a la base de datos en el archivo .env";
        } else if (errorMessage.includes("P1001") || errorMessage.includes("Can't reach database")) {
            userMessage = "Error de conexión: No se puede conectar a la base de datos. Verifica que la base de datos esté corriendo y que DATABASE_URL sea correcta.";
        } else if (errorMessage.includes("P2002") || errorMessage.includes("Unique constraint")) {
            userMessage = "Algunas facturas ya existen en la base de datos (duplicados detectados)";
        }

        return {
            success: false,
            error: userMessage,
        };
    }
}

/**
 * Obtiene todas las facturas DIAN de la base de datos
 */
export async function getDianInvoices() {
    try {
        const invoices = await prisma.dianInvoice.findMany({
            orderBy: { issueDate: "desc" },
        });

        const serializedInvoices = invoices.map((invoice: any) => ({
            ...invoice,
            vat: Number(invoice.vat),
            inc: Number(invoice.inc),
            total: Number(invoice.total),
            currency: invoice.currency,
            paymentMethod: invoice.paymentMethod,
            paymentMedium: invoice.paymentMedium,
            ica: invoice.ica ? Number(invoice.ica) : null,
            ic: invoice.ic ? Number(invoice.ic) : null,
            stamp: invoice.stamp ? Number(invoice.stamp) : null,
            incBags: invoice.incBags ? Number(invoice.incBags) : null,
            carbonTax: invoice.carbonTax ? Number(invoice.carbonTax) : null,
            fuelTax: invoice.fuelTax ? Number(invoice.fuelTax) : null,
            dataTax: invoice.dataTax ? Number(invoice.dataTax) : null,
            icl: invoice.icl ? Number(invoice.icl) : null,
            inpp: invoice.inpp ? Number(invoice.inpp) : null,
            ibua: invoice.ibua ? Number(invoice.ibua) : null,
            icui: invoice.icui ? Number(invoice.icui) : null,
            withheldVat: invoice.withheldVat ? Number(invoice.withheldVat) : null,
            withheldIncome: invoice.withheldIncome ? Number(invoice.withheldIncome) : null,
            withheldIca: invoice.withheldIca ? Number(invoice.withheldIca) : null,
            pdfUrl: invoice.PDFURL 
                ? invoice.PDFURL.startsWith('/api/downloads/') 
                    ? invoice.PDFURL 
                    : invoice.PDFURL.replace(/^downloads\//, '/api/downloads/').replace(/^\/downloads\//, '/api/downloads/')
                : null,
            xmlUrl: invoice.XMLURL 
                ? invoice.XMLURL.startsWith('/api/downloads/') 
                    ? invoice.XMLURL 
                    : invoice.XMLURL.replace(/^downloads\//, '/api/downloads/').replace(/^\/downloads\//, '/api/downloads/')
                : null,
        }));

        return { success: true, data: serializedInvoices };
    } catch (error) {
        console.error("Error obteniendo facturas:", error);
        return { success: false, error: "Error al obtener las facturas" };
    }
}
