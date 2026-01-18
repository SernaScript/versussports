/**
 * Tipos para los items parseados del XML
 */
export interface InvoiceItem {
    lineId: string;
    description: string;
    quantity: number;
    unitCode?: string;
    lineExtensionAmount: number;
    sellerItemId?: string;
    standardItemId?: string;
    priceAmount?: number;
    brandName?: string;
    modelName?: string;
}

/**
 * Información de impuestos
 */
export interface TaxSubtotal {
    taxableAmount: number;
    taxAmount: number;
    percent: number;
    taxSchemeId: string;
    taxSchemeName: string;
}

/**
 * Total monetario legal de la factura
 */
export interface LegalMonetaryTotal {
    lineExtensionAmount: number;
    taxExclusiveAmount: number;
    taxInclusiveAmount: number;
    allowanceTotalAmount: number;
    chargeTotalAmount: number;
    prepaidAmount: number;
    payableAmount: number;
}

/**
 * Datos clave de la factura extraídos del XML
 */
export interface InvoiceHeader {
    issuerName: string;
    prefix: string;
    folio: string;
    totalTaxAmount: number;
    taxSubtotals: TaxSubtotal[];
    legalMonetaryTotal: LegalMonetaryTotal | null;
    issueDate?: string;
}

/**
 * Parsear el XML de una factura y extraer los items (cac:Item)
 * @param xmlContent Contenido del XML como string
 * @returns Array de items parseados
 */
export function parseInvoiceItems(xmlContent: string): InvoiceItem[] {
    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlContent, "text/xml");

        // Verificar errores de parsing
        const parserError = xmlDoc.querySelector("parsererror");
        if (parserError) {
            console.error("Error parsing XML:", parserError.textContent);
            return [];
        }

        // Namespaces UBL
        const namespaces = {
            cac: "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
            cbc: "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
        };

        // Buscar todos los InvoiceLine
        const invoiceLines = xmlDoc.getElementsByTagNameNS(
            namespaces.cac,
            "InvoiceLine"
        );

        const items: InvoiceItem[] = [];

        for (let i = 0; i < invoiceLines.length; i++) {
            const line = invoiceLines[i];

            // Extraer ID de la línea
            const lineIdElement = line.getElementsByTagNameNS(
                namespaces.cbc,
                "ID"
            )[0];
            const lineId = lineIdElement?.textContent?.trim() || `${i + 1}`;

            // Extraer cantidad
            const quantityElement = line.getElementsByTagNameNS(
                namespaces.cbc,
                "InvoicedQuantity"
            )[0];
            const quantity = parseFloat(
                quantityElement?.textContent?.trim() || "0"
            );
            const unitCode =
                quantityElement?.getAttribute("unitCode") || undefined;

            // Extraer valor de la línea
            const lineExtensionElement = line.getElementsByTagNameNS(
                namespaces.cbc,
                "LineExtensionAmount"
            )[0];
            const lineExtensionAmount = parseFloat(
                lineExtensionElement?.textContent?.trim() || "0"
            );

            // Buscar el Item dentro de la línea
            const itemElements = line.getElementsByTagNameNS(
                namespaces.cac,
                "Item"
            );

            if (itemElements.length > 0) {
                const item = itemElements[0];

                // Extraer descripción
                const descriptionElement = item.getElementsByTagNameNS(
                    namespaces.cbc,
                    "Description"
                )[0];
                const description =
                    descriptionElement?.textContent?.trim() || "";

                // Extraer código del vendedor
                const sellersIdElement = item
                    .getElementsByTagNameNS(namespaces.cac, "SellersItemIdentification")[0]
                    ?.getElementsByTagNameNS(namespaces.cbc, "ID")[0];
                const sellerItemId = sellersIdElement?.textContent?.trim();

                // Extraer código estándar
                const standardIdElement = item
                    .getElementsByTagNameNS(namespaces.cac, "StandardItemIdentification")[0]
                    ?.getElementsByTagNameNS(namespaces.cbc, "ID")[0];
                const standardItemId = standardIdElement?.textContent?.trim();

                // Extraer marca
                const brandElement = item.getElementsByTagNameNS(
                    namespaces.cbc,
                    "BrandName"
                )[0];
                const brandName = brandElement?.textContent?.trim();

                // Extraer modelo
                const modelElement = item.getElementsByTagNameNS(
                    namespaces.cbc,
                    "ModelName"
                )[0];
                const modelName = modelElement?.textContent?.trim();

                // Buscar precio en la línea (no en el item)
                const priceElement = line.getElementsByTagNameNS(
                    namespaces.cac,
                    "Price"
                )[0];
                const priceAmountElement = priceElement?.getElementsByTagNameNS(
                    namespaces.cbc,
                    "PriceAmount"
                )[0];
                const priceAmount = priceAmountElement?.textContent?.trim()
                    ? parseFloat(priceAmountElement.textContent.trim())
                    : undefined;

                items.push({
                    lineId,
                    description,
                    quantity,
                    unitCode,
                    lineExtensionAmount,
                    sellerItemId,
                    standardItemId,
                    priceAmount,
                    brandName,
                    modelName,
                });
            } else {
                // Si no hay Item, crear uno con la información básica de la línea
                items.push({
                    lineId,
                    description: "Item sin descripción",
                    quantity,
                    unitCode,
                    lineExtensionAmount,
                });
            }
        }

        return items;
    } catch (error) {
        console.error("Error parsing invoice items from XML:", error);
        return [];
    }
}

/**
 * Extraer CUFE/CUDE del XML
 * @param xmlContent Contenido del XML como string
 * @returns CUFE/CUDE o null si no se encuentra
 */
export function parseCufeFromXml(xmlContent: string): string | null {
    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlContent, "text/xml");

        // Verificar errores de parsing
        const parserError = xmlDoc.querySelector("parsererror");
        if (parserError) {
            console.error("Error parsing XML:", parserError.textContent);
            return null;
        }

        // Namespaces UBL
        const namespaces = {
            cbc: "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
        };

        // Buscar UUID con schemeName="CUFE-SHA384" o "CUDE-SHA384"
        const uuidElements = xmlDoc.getElementsByTagNameNS(namespaces.cbc, "UUID");
        
        for (let i = 0; i < uuidElements.length; i++) {
            const uuidElement = uuidElements[i];
            const schemeName = uuidElement.getAttribute("schemeName");
            
            if (schemeName && (schemeName.includes("CUFE") || schemeName.includes("CUDE"))) {
                const cufe = uuidElement.textContent?.trim();
                if (cufe) {
                    return cufe;
                }
            }
        }

        // Fallback: buscar cualquier UUID si no se encuentra con schemeName
        if (uuidElements.length > 0) {
            const firstUuid = uuidElements[0].textContent?.trim();
            if (firstUuid) {
                return firstUuid;
            }
        }

        return null;
    } catch (error) {
        console.error("Error parsing CUFE from XML:", error);
        return null;
    }
}

/**
 * Extraer datos clave de la factura (Proveedor, Prefijo, Folio)
 * @param xmlContent Contenido del XML como string
 * @returns Objeto con los datos clave de la factura
 */
export function parseInvoiceHeader(xmlContent: string): InvoiceHeader | null {
    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlContent, "text/xml");

        // Verificar errores de parsing
        const parserError = xmlDoc.querySelector("parsererror");
        if (parserError) {
            console.error("Error parsing XML:", parserError.textContent);
            return null;
        }

        // Namespaces UBL
        const namespaces = {
            cac: "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
            cbc: "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
        };

        // Extraer ID del documento (contiene prefijo + folio)
        const idElement = xmlDoc.getElementsByTagNameNS(namespaces.cbc, "ID")[0];
        const documentId = idElement?.textContent?.trim() || "";

        // Separar prefijo y folio
        // El formato típico es: PREFIJO + FOLIO (ej: "27E801585")
        // Intentar separar por el último grupo de números
        let prefix = "";
        let folio = "";

        if (documentId) {
            // Buscar el último grupo de letras al inicio (prefijo)
            const prefixMatch = documentId.match(/^([A-Za-z]+)/);
            if (prefixMatch) {
                prefix = prefixMatch[1];
                folio = documentId.substring(prefix.length);
            } else {
                // Si no hay letras, intentar separar por longitud común
                // Prefijos suelen ser 2-4 caracteres
                if (documentId.length > 4) {
                    prefix = documentId.substring(0, 3);
                    folio = documentId.substring(3);
                } else {
                    folio = documentId;
                }
            }
        }

        // Extraer fecha de emisión
        const issueDateElement = xmlDoc.getElementsByTagNameNS(namespaces.cbc, "IssueDate")[0];
        const issueDate = issueDateElement?.textContent?.trim() || "";

        // Extraer nombre del proveedor
        const supplierParty = xmlDoc.getElementsByTagNameNS(
            namespaces.cac,
            "AccountingSupplierParty"
        )[0];

        let issuerName = "";
        if (supplierParty) {
            const partyName = supplierParty
                .getElementsByTagNameNS(namespaces.cac, "Party")[0]
                ?.getElementsByTagNameNS(namespaces.cac, "PartyName")[0]
                ?.getElementsByTagNameNS(namespaces.cbc, "Name")[0];
            issuerName = partyName?.textContent?.trim() || "";
        }

        // Extraer información de impuestos (TaxTotal principal, no los de InvoiceLine)
        let totalTaxAmount = 0;
        const taxSubtotals: TaxSubtotal[] = [];

        // Buscar todos los TaxTotal, pero solo el que está a nivel de factura (no dentro de InvoiceLine)
        const allTaxTotals = xmlDoc.getElementsByTagNameNS(namespaces.cac, "TaxTotal");

        // El TaxTotal principal es el que está fuera de InvoiceLine
        // Buscamos el que está directamente bajo Invoice (no dentro de InvoiceLine)
        for (let i = 0; i < allTaxTotals.length; i++) {
            const taxTotal = allTaxTotals[i];
            // Verificar que no esté dentro de un InvoiceLine
            let parent: Element | null = taxTotal.parentElement;
            let isInInvoiceLine = false;
            while (parent) {
                const tagName = parent.tagName || "";
                const localName = parent.localName || "";
                if (tagName.includes("InvoiceLine") || localName === "InvoiceLine") {
                    isInInvoiceLine = true;
                    break;
                }
                parent = parent.parentElement;
            }

            // Si no está en InvoiceLine, es el TaxTotal principal
            if (!isInInvoiceLine) {
                // Extraer TaxAmount total
                const taxAmountElement = taxTotal.getElementsByTagNameNS(
                    namespaces.cbc,
                    "TaxAmount"
                )[0];
                totalTaxAmount = parseFloat(
                    taxAmountElement?.textContent?.trim() || "0"
                );

                // Extraer todos los TaxSubtotal
                const subtotals = taxTotal.getElementsByTagNameNS(
                    namespaces.cac,
                    "TaxSubtotal"
                );

                for (let j = 0; j < subtotals.length; j++) {
                    const subtotal = subtotals[j];

                    // TaxableAmount
                    const taxableAmountElement = subtotal.getElementsByTagNameNS(
                        namespaces.cbc,
                        "TaxableAmount"
                    )[0];
                    const taxableAmount = parseFloat(
                        taxableAmountElement?.textContent?.trim() || "0"
                    );

                    // TaxAmount
                    const subtotalTaxAmountElement = subtotal.getElementsByTagNameNS(
                        namespaces.cbc,
                        "TaxAmount"
                    )[0];
                    const subtotalTaxAmount = parseFloat(
                        subtotalTaxAmountElement?.textContent?.trim() || "0"
                    );

                    // TaxCategory -> Percent
                    const taxCategory = subtotal.getElementsByTagNameNS(
                        namespaces.cac,
                        "TaxCategory"
                    )[0];
                    const percentElement = taxCategory?.getElementsByTagNameNS(
                        namespaces.cbc,
                        "Percent"
                    )[0];
                    const percent = parseFloat(
                        percentElement?.textContent?.trim() || "0"
                    );

                    // TaxScheme -> ID y Name
                    const taxScheme = taxCategory?.getElementsByTagNameNS(
                        namespaces.cac,
                        "TaxScheme"
                    )[0];
                    const taxSchemeIdElement = taxScheme?.getElementsByTagNameNS(
                        namespaces.cbc,
                        "ID"
                    )[0];
                    const taxSchemeNameElement = taxScheme?.getElementsByTagNameNS(
                        namespaces.cbc,
                        "Name"
                    )[0];
                    const taxSchemeId = taxSchemeIdElement?.textContent?.trim() || "";
                    const taxSchemeName = taxSchemeNameElement?.textContent?.trim() || "";

                    taxSubtotals.push({
                        taxableAmount,
                        taxAmount: subtotalTaxAmount,
                        percent,
                        taxSchemeId,
                        taxSchemeName,
                    });
                }

                // Solo procesar el primer TaxTotal principal
                break;
            }
        }

        // Extraer LegalMonetaryTotal
        let legalMonetaryTotal: LegalMonetaryTotal | null = null;
        const legalMonetaryTotalElements = xmlDoc.getElementsByTagNameNS(
            namespaces.cac,
            "LegalMonetaryTotal"
        );

        if (legalMonetaryTotalElements.length > 0) {
            const lmt = legalMonetaryTotalElements[0];

            const lineExtensionAmountElement = lmt.getElementsByTagNameNS(
                namespaces.cbc,
                "LineExtensionAmount"
            )[0];
            const lineExtensionAmount = parseFloat(
                lineExtensionAmountElement?.textContent?.trim() || "0"
            );

            const taxExclusiveAmountElement = lmt.getElementsByTagNameNS(
                namespaces.cbc,
                "TaxExclusiveAmount"
            )[0];
            const taxExclusiveAmount = parseFloat(
                taxExclusiveAmountElement?.textContent?.trim() || "0"
            );

            const taxInclusiveAmountElement = lmt.getElementsByTagNameNS(
                namespaces.cbc,
                "TaxInclusiveAmount"
            )[0];
            const taxInclusiveAmount = parseFloat(
                taxInclusiveAmountElement?.textContent?.trim() || "0"
            );

            const allowanceTotalAmountElement = lmt.getElementsByTagNameNS(
                namespaces.cbc,
                "AllowanceTotalAmount"
            )[0];
            const allowanceTotalAmount = parseFloat(
                allowanceTotalAmountElement?.textContent?.trim() || "0"
            );

            const chargeTotalAmountElement = lmt.getElementsByTagNameNS(
                namespaces.cbc,
                "ChargeTotalAmount"
            )[0];
            const chargeTotalAmount = parseFloat(
                chargeTotalAmountElement?.textContent?.trim() || "0"
            );

            const prepaidAmountElement = lmt.getElementsByTagNameNS(
                namespaces.cbc,
                "PrepaidAmount"
            )[0];
            const prepaidAmount = parseFloat(
                prepaidAmountElement?.textContent?.trim() || "0"
            );

            const payableAmountElement = lmt.getElementsByTagNameNS(
                namespaces.cbc,
                "PayableAmount"
            )[0];
            const payableAmount = parseFloat(
                payableAmountElement?.textContent?.trim() || "0"
            );

            legalMonetaryTotal = {
                lineExtensionAmount,
                taxExclusiveAmount,
                taxInclusiveAmount,
                allowanceTotalAmount,
                chargeTotalAmount,
                prepaidAmount,
                payableAmount,
            };
        }

        return {
            issuerName,
            prefix,
            folio,
            totalTaxAmount,
            taxSubtotals,
            legalMonetaryTotal,
            issueDate,
        };
    } catch (error) {
        console.error("Error parsing invoice header from XML:", error);
        return null;
    }
}

/**
 * Formatear XML para mejor legibilidad
 * @param xmlContent Contenido del XML como string
 * @returns XML formateado con indentación
 */
export function formatXML(xmlContent: string): string {
    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlContent, "text/xml");

        // Verificar errores
        const parserError = xmlDoc.querySelector("parsererror");
        if (parserError) {
            return xmlContent; // Retornar original si hay error
        }

        // Serializar con formato
        const serializer = new XMLSerializer();
        let formatted = serializer.serializeToString(xmlDoc);

        // Agregar indentación básica
        const PADDING = " ".repeat(2);
        let formattedString = "";
        let indent = 0;
        const tokens = formatted.split(/>\s*</);

        if (tokens.length > 0) {
            formattedString += tokens[0] + ">\n";
        }

        for (let i = 1; i < tokens.length; i++) {
            const token = tokens[i];
            if (token.match(/^\/\w/)) {
                // Tag de cierre
                indent--;
            }
            formattedString += PADDING.repeat(Math.max(0, indent)) + "<" + token + ">\n";
            if (token.match(/^\/\w/) === null && !token.match(/\/$/)) {
                // Tag de apertura (no auto-cerrado)
                indent++;
            }
        }

        return formattedString;
    } catch (error) {
        console.error("Error formatting XML:", error);
        return xmlContent; // Retornar original si hay error
    }
}
