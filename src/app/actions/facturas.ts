"use server";

import { revalidatePath } from "next/cache";
import { ProcessedDianInvoice } from "@/app/facturas/utils/dian-file-validator";
import { prisma } from "@/lib/prisma";

/**
 * Guarda facturas DIAN en la base de datos
 * Evita duplicados usando el ID (CUFE/CUDE)
 */
export async function saveDianInvoices(invoices: ProcessedDianInvoice[]) {
    try {
        if (invoices.length === 0) {
            return { success: true, count: 0, message: "No hay facturas para guardar" };
        }

        // Preparar datos para insertar/actualizar
        const formattedInvoices = invoices.map((invoice) => {
            // Convertir issueDate a Date si es string
            let issueDate: Date;
            if (typeof invoice.issueDate === "string") {
                issueDate = new Date(invoice.issueDate);
            } else {
                issueDate = invoice.issueDate as Date;
            }

            // Convertir receptionDate si existe
            let receptionDate: Date | null = null;
            if (invoice.receptionDate) {
                if (typeof invoice.receptionDate === "string") {
                    receptionDate = new Date(invoice.receptionDate);
                } else {
                    receptionDate = invoice.receptionDate as Date;
                }
            }

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
                await prisma.dianInvoice.upsert({
                    where: { id: invoice.id },
                    update: invoice,
                    create: invoice,
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
        return { success: true, data: invoices };
    } catch (error) {
        console.error("Error obteniendo facturas:", error);
        return { success: false, error: "Error al obtener las facturas" };
    }
}
