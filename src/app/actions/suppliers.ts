"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSiigoAuthToken } from "./siigo";

// Tipos para la API de Siigo Customers/Suppliers
interface SiigoCity {
    city_name: string;
}

interface SiigoAddress {
    address: string;
    city?: SiigoCity;
}

type SiigoAddressField = string | SiigoAddress | null | undefined;
type SiigoCityField = string | SiigoCity | null | undefined;
type SiigoNameField = string | string[];

interface SiigoCustomer {
    id: number | string; // Puede ser UUID o número
    identification: string;
    name: SiigoNameField;
    email?: string | null;
    phone?: string | null;
    address?: SiigoAddressField;
    city?: SiigoCityField;
    active?: boolean;
    type?: string;
}

interface SiigoCustomersResponse {
    results?: SiigoCustomer[];
}

type SiigoCustomersApiResponse = SiigoCustomer[] | SiigoCustomersResponse;

export async function getSuppliers(query?: string) {
    try {
        const where = query ? {
            OR: [
                { name: { contains: query, mode: "insensitive" } },
                { identification: { contains: query } }
            ]
        } : undefined;

        const suppliers = await prisma.siigoSupplier.findMany({
            where: where as any,
            orderBy: { name: "asc" },
            take: 100
        });
        return { success: true, data: suppliers };
    } catch (error) {
        return { success: false, error: "Error fetching suppliers" };
    }
}

export async function syncSiigoSuppliers() {
    try {
        const auth = await getSiigoAuthToken();
        if (!auth) return { success: false, error: "No hay credenciales de Siigo o fallo autenticación" };

        // Fetch all suppliers from Siigo with pagination
        let allSuppliers: SiigoCustomer[] = [];
        let page = 1;
        let hasMore = true;

        while (hasMore) {
            const response = await fetch(`https://api.siigo.com/v1/customers?type=Supplier&page=${page}`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${auth.token}`,
                    "Partner-Id": auth.partnerId
                },
                cache: 'no-store'
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error("Siigo API Error:", errorText);
                return { success: false, error: "Error fetching suppliers from Siigo API" };
            }

            const siigoSuppliers: SiigoCustomersApiResponse = await response.json();
            const suppliers: SiigoCustomer[] = Array.isArray(siigoSuppliers) 
                ? siigoSuppliers 
                : siigoSuppliers.results || [];
            
            // If no suppliers returned or empty array, stop pagination
            if (!suppliers || suppliers.length === 0) {
                hasMore = false;
            } else {
                allSuppliers = allSuppliers.concat(suppliers);
                // If we got less than 25 results, we're on the last page
                hasMore = suppliers.length >= 25;
                page++;
            }
        }

        // Upsert into DB
        let count = 0;
        for (const supplier of allSuppliers) {
            // Handle name as string or array and convert to uppercase
            const name = (Array.isArray(supplier.name) 
                ? supplier.name.join(" ") 
                : (supplier.name || "")).toUpperCase();
            
            // Handle address - can be string or object
            let addressStr: string | null = null;
            if (supplier.address) {
                if (typeof supplier.address === 'string') {
                    addressStr = supplier.address;
                } else if (typeof supplier.address === 'object' && supplier.address.address) {
                    addressStr = supplier.address.address;
                }
            }
            
            // Handle city - can be string or object
            let cityStr: string | null = null;
            if (supplier.city) {
                if (typeof supplier.city === 'string') {
                    cityStr = supplier.city;
                } else if (typeof supplier.city === 'object' && supplier.city.city_name) {
                    cityStr = supplier.city.city_name;
                }
            }
            // Also check address.city as fallback
            if (!cityStr && supplier.address && typeof supplier.address === 'object' && supplier.address.city?.city_name) {
                cityStr = supplier.address.city.city_name;
            }
            
            // Convert siigoId to string (can be number or UUID)
            const siigoId = String(supplier.id);

            await prisma.siigoSupplier.upsert({
                where: { siigoId },
                update: {
                    identification: supplier.identification || "",
                    name,
                    email: supplier.email || null,
                    phone: supplier.phone || null,
                    address: addressStr,
                    city: cityStr,
                    active: supplier.active !== false,
                    type: supplier.type || "Supplier"
                },
                create: {
                    siigoId,
                    identification: supplier.identification || "",
                    name,
                    email: supplier.email || null,
                    phone: supplier.phone || null,
                    address: addressStr,
                    city: cityStr,
                    active: supplier.active !== false,
                    type: supplier.type || "Supplier"
                }
            });
            count++;
        }

        revalidatePath("/ajustes");
        return { success: true, count };

    } catch (error) {
        console.error("Sync Error:", error);
        return { success: false, error: "Error syncing suppliers" };
    }
}

export async function createSupplierInSiigo(data: {
    identification: string;
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    type?: string;
}) {
    try {
        const auth = await getSiigoAuthToken();
        if (!auth) return { success: false, error: "No hay credenciales de Siigo o fallo autenticación" };

        // Create supplier in Siigo
        const response = await fetch("https://api.siigo.com/v1/customers", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${auth.token}`,
                "Partner-Id": auth.partnerId
            },
            body: JSON.stringify({
                type: data.type || "Supplier",
                person_type: "Company",
                id_type: "13", // NIT
                identification: data.identification,
                name: data.name,
                email: data.email || null,
                phone: data.phone || null,
                address: data.address ? {
                    address: data.address,
                    city: data.city || null
                } : null
            }),
            cache: 'no-store'
        });

        const result = await response.json();

        if (!response.ok) {
            console.error("Siigo Create Supplier Error:", JSON.stringify(result, null, 2));
            return {
                success: false,
                error: result.Errors?.[0]?.Message || result.message || "Error al crear proveedor en Siigo"
            };
        }

        // Sync to update local DB
        await syncSiigoSuppliers();

        revalidatePath("/ajustes");
        return { success: true, data: result };

    } catch (error) {
        console.error("Error creating supplier:", error);
        return { success: false, error: "Error de comunicación con Siigo" };
    }
}
