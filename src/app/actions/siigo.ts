"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function createSiigoCredentials(formData: FormData) {
    const username = formData.get("username") as string
    const accessKey = formData.get("accessKey") as string
    const partnerId = formData.get("partnerId") as string

    if (!username || !accessKey) {
        throw new Error("Username and Access Key are required")
    }

    // Check if credentials already exist
    const existing = await prisma.siigoCredential.findFirst()

    if (existing) {
        await prisma.siigoCredential.update({
            where: { id: existing.id },
            data: {
                username,
                accessKey,
                partnerId,
            },
        })
    } else {
        await prisma.siigoCredential.create({
            data: {
                username,
                accessKey,
                partnerId,
            },
        })
    }

    revalidatePath("/siigo")
}

export async function getSiigoCredentials() {
    try {
        const credentials = await prisma.siigoCredential.findFirst();
        return { success: true, data: credentials };
    } catch (error) {
        console.error("Error fetching Siigo credentials:", error);
        return { success: false, error: "Failed to fetch Siigo credentials" };
    }
}
