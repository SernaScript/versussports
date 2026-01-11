import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

// Verificar y loggear DATABASE_URL (sin mostrar la contraseña completa)
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
    console.error("❌ DATABASE_URL no está configurada en las variables de entorno");
    console.error("Variables de entorno disponibles:", Object.keys(process.env).filter(k => k.includes("DATABASE")));
    throw new Error(
        "DATABASE_URL no está configurada. Por favor, asegúrate de tener un archivo .env en la raíz del proyecto con la variable DATABASE_URL."
    );
}

// Loggear información de la conexión (sin mostrar credenciales completas)
const urlParts = databaseUrl.match(/^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
if (urlParts) {
    console.log(`✓ DATABASE_URL configurada: postgresql://${urlParts[1]}:***@${urlParts[3]}:${urlParts[4]}/${urlParts[5]}`);
} else {
    console.warn("⚠ DATABASE_URL tiene un formato inesperado");
}

// Inicializar PrismaClient
let prismaInstance: PrismaClient;

try {
    if (!globalForPrisma.prisma) {
        // En Prisma 7, debemos usar un adapter para la conexión directa
        const pool = new Pool({
            connectionString: databaseUrl,
        });

        const adapter = new PrismaPg(pool);

        prismaInstance = new PrismaClient({
            adapter,
        });

        if (process.env.NODE_ENV !== "production") {
            globalForPrisma.prisma = prismaInstance;
        }

        console.log("✓ PrismaClient inicializado correctamente con adapter de PostgreSQL");
    } else {
        prismaInstance = globalForPrisma.prisma;
        console.log("✓ Usando instancia existente de PrismaClient");
    }
} catch (error) {
    console.error("❌ Error al inicializar PrismaClient:", error);
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    throw new Error(
        `Error al inicializar PrismaClient: ${errorMessage}. Verifica que DATABASE_URL esté correctamente configurada y que la base de datos esté accesible.`
    );
}

export const prisma = prismaInstance;
