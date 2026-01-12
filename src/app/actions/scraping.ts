"use server";

import { chromium } from "playwright";

export interface ScrapingResult {
    success: boolean;
    data?: any;
    error?: string;
    httpRequests?: Array<{
        url: string;
        method: string;
        headers?: Record<string, string>;
        body?: string;
    }>;
}

/**
 * Realiza scraping de una URL usando Playwright y captura solicitudes HTTP
 */
export async function scrapeUrl(url: string): Promise<ScrapingResult> {
    let browser;
    try {
        // Validar URL
        if (!url || !url.startsWith("http")) {
            return {
                success: false,
                error: "URL inválida. Debe comenzar con http:// o https://",
            };
        }

        // Iniciar navegador
        browser = await chromium.launch({
            headless: true,
        });

        const context = await browser.newContext({
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        });

        const page = await context.newPage();

        // Array para almacenar las solicitudes HTTP
        const httpRequests: Array<{
            url: string;
            method: string;
            headers?: Record<string, string>;
            body?: string;
        }> = [];

        // Interceptar solicitudes HTTP
        page.on("request", (request) => {
            const requestData = {
                url: request.url(),
                method: request.method(),
                headers: request.headers(),
            };

            // Intentar obtener el body si existe
            const postData = request.postData();
            if (postData) {
                httpRequests.push({
                    ...requestData,
                    body: postData,
                });
            } else {
                httpRequests.push(requestData);
            }
        });

        // Navegar a la URL
        const response = await page.goto(url, {
            waitUntil: "networkidle",
            timeout: 30000,
        });

        if (!response || !response.ok()) {
            return {
                success: false,
                error: `Error al cargar la página: ${response?.status()} ${response?.statusText()}`,
            };
        }

        // Esperar un poco para capturar todas las solicitudes
        await page.waitForTimeout(2000);

        // Obtener el contenido de la página
        const content = await page.content();
        const title = await page.title();

        await browser.close();

        return {
            success: true,
            data: {
                url,
                title,
                contentLength: content.length,
                httpRequests: httpRequests,
            },
            httpRequests: httpRequests,
        };
    } catch (error) {
        if (browser) {
            await browser.close();
        }

        console.error("Error en scraping:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Error desconocido al realizar el scraping",
        };
    }
}
