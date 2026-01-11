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
        const testResponse = await fetch("https://api.siigo.com/v1/customers?pageSize=1", {
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
