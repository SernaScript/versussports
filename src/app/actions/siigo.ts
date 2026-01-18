"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getSiigoCredential() {
    try {
        const credential = await prisma.siigoCredential.findFirst();
        return { success: true, data: credential };
    } catch (error) {
        console.error("Error fetching Siigo credential:", error);
        return { success: false, error: "Error al obtener la credencial" };
    }
}

export async function saveSiigoCredential(data: {
    username: string;
    accessKey: string;
    partnerId?: string;
}) {
    try {
        const existing = await prisma.siigoCredential.findFirst();

        if (existing) {
            const updated = await prisma.siigoCredential.update({
                where: { id: existing.id },
                data: {
                    username: data.username,
                    accessKey: data.accessKey,
                    partnerId: data.partnerId,
                },
            });
            revalidatePath("/siigo");
            return { success: true, data: updated };
        } else {
            const created = await prisma.siigoCredential.create({
                data: {
                    username: data.username,
                    accessKey: data.accessKey,
                    partnerId: data.partnerId,
                },
            });
            revalidatePath("/siigo");
            return { success: true, data: created };
        }
    } catch (error) {
        console.error("Error saving Siigo credential:", error);
        return { success: false, error: "Error al guardar la credencial" };
    }
}

export async function testSiigoConnection(data: {
    username: string;
    accessKey: string;
    partnerId?: string;
}) {
    try {
        // 1. Autenticación (Endpoint correcto según PROJECT_CONTEXT.md)
        const authResponse = await fetch("https://api.siigo.com/auth", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                username: data.username,
                access_key: data.accessKey,
            }),
            cache: 'no-store'
        });

        if (!authResponse.ok) {
            const errorResult = await authResponse.json();
            return {
                success: false,
                error: errorResult.message || "Credenciales de autenticación inválidas (401)"
            };
        }

        const authResult = await authResponse.json();
        const token = authResult.access_token;

        if (!token) {
            return { success: false, error: "No se recibió un token de acceso válido" };
        }

        // 2. Validación Real (Endpoint de Clientes)
        // Intentamos una petición simple para verificar que el Partner-Id y el Token son aceptados
        const testResponse = await fetch("https://api.siigo.com/v1/suppliers?pageSize=1", {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "Partner-Id": data.partnerId || ""
            },
            cache: 'no-store'
        });

        if (testResponse.ok) {
            return { success: true, message: "Conexión validada exitosamente con Siigo" };
        } else {
            const testResult = await testResponse.json();
            // Si falla aquí, suele ser por el Partner-Id o permisos del token
            return {
                success: false,
                error: `Autenticación OK, pero la API rechazó la solicitud: ${testResult.message || testResponse.statusText}. Verifique el Partner-Id.`
            };
        }
    } catch (error) {
        console.error("Error testing Siigo connection:", error);
        return { success: false, error: "Fallo de conexión crítico: Verifique su internet o configuración de red." };
    }
}

export async function deleteSiigoCredential() {
    try {
        const existing = await prisma.siigoCredential.findFirst();
        if (existing) {
            await prisma.siigoCredential.delete({
                where: { id: existing.id },
            });
            revalidatePath("/siigo");
        }
        return { success: true };
    } catch (error) {
        console.error("Error deleting Siigo credential:", error);
        return { success: false, error: "Error al eliminar la credencial" };
    }
}

// --- Helper: Autenticación Reutilizable ---

/**
 * Obtiene un token de autenticación de Siigo
 * @returns Token de acceso o null si hay error
 */
export async function getSiigoAuthToken(): Promise<{ token: string; partnerId: string } | null> {
    try {
        const credential = await prisma.siigoCredential.findFirst();
        if (!credential) {
            console.error("No hay credenciales de Siigo configuradas");
            return null;
        }

        const authResponse = await fetch("https://api.siigo.com/auth", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username: credential.username,
                access_key: credential.accessKey,
            }),
            cache: 'no-store'
        });

        if (!authResponse.ok) {
            console.error("Fallo autenticación con Siigo");
            return null;
        }

        const { access_token } = await authResponse.json();
        if (!access_token) {
            console.error("No se recibió token de acceso");
            return null;
        }

        return {
            token: access_token,
            partnerId: credential.partnerId || ""
        };
    } catch (error) {
        console.error("Error obteniendo token de Siigo:", error);
        return null;
    }
}

// --- Journals (Comprobantes) ---

export async function createJournal(journalData: any) {
    try {
        const auth = await getSiigoAuthToken();
        if (!auth) return { success: false, error: "No hay credenciales de Siigo configuradas o fallo autenticación." };

        // 2. Create Journal
        const response = await fetch("https://api.siigo.com/v1/journals", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${auth.token}`,
                "Partner-Id": auth.partnerId
            },
            body: JSON.stringify(journalData)
        });

        const result = await response.json();

        if (response.ok) {
            return { success: true, data: result };
        } else {
            console.error("Siigo Journal Error:", JSON.stringify(result, null, 2));
            return {
                success: false,
                error: result.Errors?.[0]?.Message || result.message || "Error al crear comprobante en Siigo"
            };
        }
    } catch (error) {
        console.error("Error creating journal:", error);
        return { success: false, error: "Error de comunicación con Siigo" };
    }
}

// --- Purchases (Facturas de Compra) ---

export async function createPurchaseInvoice(invoiceData: any, isRetry = false): Promise<any> {
    try {
        const auth = await getSiigoAuthToken();
        if (!auth) return { success: false, error: "No hay credenciales de Siigo configuradas o fallo autenticación." };

        console.log(`Enviando factura de compra a Siigo (${isRetry ? "RETRY" : "FIRST"}):`, JSON.stringify(invoiceData, null, 2));

        const response = await fetch("https://api.siigo.com/v1/purchases", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${auth.token}`,
                "Partner-Id": auth.partnerId
            },
            body: JSON.stringify(invoiceData)
        });

        const result = await response.json();

        if (response.ok) {
            return { success: true, data: result };
        } else {
            console.error("Siigo Purchase Error:", JSON.stringify(result, null, 2));

            // Siigo API can return errors in different formats: result.errors (array) or result.Errors (array)
            const errorsArray = result.errors || result.Errors || [];

            // Auto-Retry Logic for 'invalid_total_payments'
            // Error example: "The total payments must be equal to the total purchase. The total purchase calculated is 18256000"
            if (!isRetry && errorsArray.length > 0) {
                // Try to find the invalid_total_payments error (case-insensitive for code)
                const totalError = errorsArray.find((e: any) =>
                    (e.code || e.Code) === 'invalid_total_payments'
                );

                if (totalError) {
                    // Extract the calculated total from the message
                    // Message format: "The total payments must be equal to the total purchase. The total purchase calculated is 18256000"
                    const message = totalError.message || totalError.Message || '';
                    const match = message.match(/calculated\s+is\s+(\d+(?:\.\d+)?)/i);

                    if (match && match[1]) {
                        const correctTotal = Number(match[1]);
                        console.log(`Auto-correcting total payments to: ${correctTotal}`);

                        // Clone data and update payments
                        // Assumes simple case: Update the first payment (or the one matching standard flow)
                        const newData = JSON.parse(JSON.stringify(invoiceData));
                        if (newData.payments && newData.payments.length > 0) {
                            // If multiple payments exist, this logic might be too simple, but usually we send 1 payment
                            newData.payments[0].value = correctTotal;

                            // Retry recursively
                            return createPurchaseInvoice(newData, true);
                        }
                    } else {
                        console.warn("Could not extract calculated total from error message:", message);
                    }
                }
            }

            // Handle error message extraction (support both formats)
            const errorMessage = errorsArray.length > 0
                ? (errorsArray[0].message || errorsArray[0].Message)
                : (result.message || "Error al crear factura de compra en Siigo");

            return {
                success: false,
                error: errorMessage,
                errorData: result
            };
        }
    } catch (error) {
        console.error("Error creating purchase invoice:", error);
        return { success: false, error: "Error de comunicación con Siigo" };
    }
}
