"use server";

import { promises as fs } from "fs";
import path from "path";
import AdmZip from "adm-zip";
import { chromium } from "playwright";
import { prisma } from "@/lib/prisma";

interface DownloadResult {
    success: boolean;
    zipPath?: string;
    error?: string;
}

interface ProcessZipResult {
    xmlPath?: string;
    pdfPath?: string;
    error?: string;
}

interface DownloadSummary {
    success: number;
    failed: number;
    errors: Array<{ cufe: string; error: string }>;
}

/**
 * Descarga el archivo ZIP de una factura desde la DIAN usando Playwright
 * @param cufe El CUFE (ID) de la factura
 * @param page La página de Playwright ya inicializada con la sesión del usuario
 * @returns Resultado de la descarga
 */
async function downloadInvoiceFiles(cufe: string, page: any): Promise<DownloadResult> {
    const maxRetries = 3;
    const baseUrl = "https://catalogo-vpfe.dian.gov.co/Document/DownloadZipFiles";
    const downloadUrl = `${baseUrl}?trackId=${encodeURIComponent(cufe)}`;

    console.log(`🔗 Intentando descargar desde URL: ${downloadUrl}`);

    // Crear directorio temporal si no existe
    const tempDir = path.join(process.cwd(), "downloads", "temp");
    await fs.mkdir(tempDir, { recursive: true });

    const zipPath = path.join(tempDir, `${cufe}.zip`);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`📥 Intento ${attempt} de ${maxRetries} para CUFE: ${cufe}`);

            // Configurar la ruta de descarga
            const downloadPath = path.join(tempDir, `${cufe}_temp.zip`);

            // Esperar el evento de descarga ANTES de hacer la solicitud HTTP
            const downloadPromise = page.waitForEvent("download", { timeout: 30000 });

            // Hacer la solicitud HTTP a la URL de descarga usando el mismo contexto del navegador
            console.log(`🌐 Haciendo solicitud HTTP a: ${downloadUrl}`);

            // Usar evaluate para hacer la solicitud desde el contexto del navegador
            await page.evaluate((url: string) => {
                window.location.href = url;
            }, downloadUrl);

            // Esperar un poco para que se inicie la descarga
            await page.waitForTimeout(2000);

            // Esperar la descarga
            let download;
            try {
                download = await Promise.race([
                    downloadPromise,
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error("Timeout esperando descarga")), 25000)
                    )
                ]) as any;
            } catch (error) {
                if (attempt < maxRetries) {
                    const delay = Math.pow(2, attempt - 1) * 1000;
                    await new Promise((resolve) => setTimeout(resolve, delay));
                    continue;
                }

                return {
                    success: false,
                    error: `No se inició la descarga después de hacer la solicitud HTTP. URL: ${downloadUrl}`,
                };
            }

            // Guardar el archivo descargado
            await download.saveAs(downloadPath);

            // Leer el archivo descargado
            const buffer = await fs.readFile(downloadPath);

            // Eliminar el archivo temporal
            try {
                await fs.unlink(downloadPath);
            } catch (error) {
                // Ignorar error si no se puede eliminar
            }

            // Verificar que el buffer comience con la firma ZIP (PK)
            if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
                // Intentar detectar qué tipo de contenido se recibió
                const contentStart = buffer.slice(0, Math.min(500, buffer.length)).toString('utf-8');
                let detectedType = "desconocido";
                let errorDetails = "";

                if (contentStart.trim().startsWith('<!DOCTYPE') || contentStart.trim().startsWith('<html') || contentStart.trim().startsWith('<!')) {
                    detectedType = "HTML";
                    const titleMatch = contentStart.match(/<title[^>]*>([^<]+)<\/title>/i);
                    const errorMatch = contentStart.match(/error|Error|ERROR/i);
                    if (titleMatch) {
                        errorDetails = ` - ${titleMatch[1]}`;
                    } else if (errorMatch) {
                        errorDetails = " - La respuesta parece ser una página de error";
                    } else {
                        errorDetails = " - La respuesta parece ser una página HTML (posiblemente requiere autenticación)";
                    }
                } else if (contentStart.trim().startsWith('{') || contentStart.trim().startsWith('[')) {
                    detectedType = "JSON";
                    try {
                        const json = JSON.parse(contentStart);
                        errorDetails = ` - ${JSON.stringify(json).substring(0, 200)}`;
                    } catch {
                        errorDetails = " - La respuesta parece ser JSON";
                    }
                } else if (buffer.length < 100) {
                    detectedType = "texto corto";
                    errorDetails = ` - Contenido: ${contentStart.substring(0, 100)}`;
                }

                if (attempt < maxRetries) {
                    const delay = Math.pow(2, attempt - 1) * 1000;
                    await new Promise((resolve) => setTimeout(resolve, delay));
                    continue;
                }

                // Guardar el archivo recibido para diagnóstico (si no es muy grande)
                if (buffer.length < 100000) {
                    const debugPath = path.join(process.cwd(), "downloads", "temp", `${cufe}_debug_${Date.now()}.txt`);
                    await fs.writeFile(debugPath, buffer);
                    errorDetails += ` (archivo guardado en: ${debugPath})`;
                }

                return {
                    success: false,
                    error: `El archivo descargado no es un ZIP válido. Tipo detectado: ${detectedType}${errorDetails}`,
                };
            }

            // Guardar el archivo ZIP en la ubicación final
            await fs.writeFile(zipPath, buffer);

            return {
                success: true,
                zipPath,
            };
        } catch (error) {
            if (attempt < maxRetries) {
                const delay = Math.pow(2, attempt - 1) * 1000;
                await new Promise((resolve) => setTimeout(resolve, delay));
                continue;
            }

            return {
                success: false,
                error: error instanceof Error ? error.message : "Error desconocido al descargar",
            };
        }
    }

    return {
        success: false,
        error: "Falló después de 3 intentos",
    };
}

/**
 * Procesa un archivo ZIP descargado: lo descomprime y organiza los archivos
 * @param zipPath Ruta del archivo ZIP
 * @param cufe CUFE de la factura para nombrar los archivos
 * @returns Rutas de los archivos XML y PDF encontrados
 */
async function processDownloadedZip(zipPath: string, cufe: string): Promise<ProcessZipResult> {
    try {
        const zip = new AdmZip(zipPath);
        const zipEntries = zip.getEntries();

        // Crear estructura de carpetas
        const downloadsDir = path.join(process.cwd(), "downloads");
        const xmlDir = path.join(downloadsDir, "XML");
        const pdfDir = path.join(downloadsDir, "PDF");

        await fs.mkdir(xmlDir, { recursive: true });
        await fs.mkdir(pdfDir, { recursive: true });

        let xmlPath: string | undefined;
        let pdfPath: string | undefined;

        // Procesar cada entrada del ZIP
        for (const entry of zipEntries) {
            if (entry.isDirectory) continue;

            const entryName = entry.entryName.toLowerCase();
            let targetDir: string | null = null;
            let fileName: string | null = null;
            let relativePath: string | undefined;

            if (entryName.endsWith(".xml")) {
                targetDir = xmlDir;
                fileName = `${cufe}.xml`;
                relativePath = `/api/downloads/XML/${fileName}`;
            } else if (entryName.endsWith(".pdf")) {
                targetDir = pdfDir;
                fileName = `${cufe}.pdf`;
                relativePath = `/api/downloads/PDF/${fileName}`;
            }

            if (targetDir && relativePath && fileName) {
                const fullPath = path.join(targetDir, fileName);

                // Extraer el contenido del archivo
                const fileData = entry.getData();

                // Escribir el archivo
                await fs.writeFile(fullPath, fileData);

                // Guardar la ruta (solo el primero de cada tipo)
                if (entryName.endsWith(".xml") && !xmlPath) {
                    xmlPath = relativePath;
                } else if (entryName.endsWith(".pdf") && !pdfPath) {
                    pdfPath = relativePath;
                }
            }
        }

        // Eliminar el archivo ZIP temporal
        try {
            await fs.unlink(zipPath);
        } catch (error) {
            console.warn(`No se pudo eliminar el archivo temporal ${zipPath}:`, error);
        }

        return {
            xmlPath,
            pdfPath,
        };
    } catch (error) {
        return {
            error: error instanceof Error ? error.message : "Error al procesar el ZIP",
        };
    }
}

/**
 * Descarga todas las facturas recibidas que aún no han sido descargadas
 * @param userUrl La URL de la DIAN donde el usuario está autenticado
 * @returns Resumen de descargas exitosas y fallidas
 */
export async function downloadAllReceivedInvoices(userUrl: string): Promise<DownloadSummary> {
    const summary: DownloadSummary = {
        success: 0,
        failed: 0,
        errors: [],
    };

    let invoices: any[] = [];

    try {
        // Obtener todas las facturas recibidas que no han sido descargadas
        // Nota: Usamos raw query temporalmente hasta que se regenere el cliente de Prisma
        invoices = await prisma.$queryRaw`
            SELECT * FROM dian_invoices 
            WHERE LOWER("group") LIKE '%recibido%' 
            AND is_downloaded = false
        `;

        console.log(`📥 Iniciando descarga de ${invoices.length} factura(s) recibida(s)...`);

        // Inicializar el navegador una sola vez
        const browser = await chromium.launch({
            headless: false,
            slowMo: 500,
        });

        const context = await browser.newContext({
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        });

        const page = await context.newPage();

        try {
            // Paso 1: Navegar a la URL del usuario (donde está autenticado)
            console.log(`🌐 Navegando a la URL del usuario: ${userUrl}`);
            await page.goto(userUrl, {
                waitUntil: "domcontentloaded",
                timeout: 30000,
            });

            // Paso 2: Esperar 10 segundos para mantener la sesión
            console.log(`⏳ Esperando 10 segundos para mantener la sesión...`);
            await page.waitForTimeout(10000);
            console.log(`✅ Espera completada, procediendo con las descargas...`);

            // Paso 3: Para cada factura, hacer la solicitud HTTP de descarga
            for (const invoice of invoices) {
                const cufe = invoice.id;

                try {
                    // Descargar el ZIP usando la misma página/sesión
                    const downloadResult = await downloadInvoiceFiles(cufe, page);

                    if (!downloadResult.success || !downloadResult.zipPath) {
                        summary.failed++;
                        summary.errors.push({
                            cufe,
                            error: downloadResult.error || "Error desconocido en la descarga",
                        });
                        console.error(`❌ Error descargando factura ${cufe}:`, downloadResult.error);
                        continue; // Continuar con la siguiente factura
                    }

                    // Procesar el ZIP
                    const processResult = await processDownloadedZip(downloadResult.zipPath, cufe);

                    if (processResult.error) {
                        summary.failed++;
                        summary.errors.push({
                            cufe,
                            error: processResult.error,
                        });
                        console.error(`❌ Error procesando ZIP de factura ${cufe}:`, processResult.error);
                        continue;
                    }

                    // Actualizar la base de datos
                    // Usamos raw query temporalmente hasta que se regenere el cliente de Prisma
                    await prisma.$executeRaw`
                        UPDATE dian_invoices 
                        SET is_downloaded = true,
                            xml_url = ${processResult.xmlPath || null},
                            pdf_url = ${processResult.pdfPath || null}
                        WHERE id = ${cufe}
                    `;

                    summary.success++;
                    console.log(`✅ Factura ${cufe} descargada y procesada exitosamente`);
                } catch (error) {
                    summary.failed++;
                    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
                    summary.errors.push({
                        cufe,
                        error: errorMessage,
                    });
                    console.error(`❌ Error procesando factura ${cufe}:`, error);
                    // Continuar con la siguiente factura
                }
            }
        } finally {
            // Cerrar el navegador al finalizar
            await browser.close();
        }

        console.log(
            `📊 Resumen: ${summary.success} exitosa(s), ${summary.failed} fallida(s)`
        );

        return summary;
    } catch (error) {
        console.error("Error en downloadAllReceivedInvoices:", error);
        return {
            success: 0,
            failed: invoices?.length || 0,
            errors: [
                {
                    cufe: "ALL",
                    error: error instanceof Error ? error.message : "Error desconocido",
                },
            ],
        };
    }
}
