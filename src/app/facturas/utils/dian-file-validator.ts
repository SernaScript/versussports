import * as XLSX from "xlsx";

// Required columns in Spanish (as they appear in the Excel file)
export const REQUIRED_COLUMNS = [
    "Tipo de documento",
    "CUFE/CUDE",
    "Folio",
    "Prefijo",
    "Fecha emisión",
    "NIT de emisor",
    "Nombre de emisor",
    "NIT Receptor",
    "Nombre Receptor",
    "IVA",
    "INC",
    "Total",
    "Grupo",
] as const;

// Column mapping from Spanish (Excel) to English (DB)
// Includes variations in capitalization and spacing
export const COLUMN_MAPPING: Record<string, string> = {
    // Document type
    "Tipo de documento": "documentType",
    "Tipo de Documento": "documentType",
    // CUFE/CUDE
    "CUFE/CUDE": "cufe",
    "CUFE": "cufe",
    "CUDE": "cude",
    // Document identifiers
    "Folio": "folio",
    "Prefijo": "prefix",
    // Dates
    "Fecha emisión": "issueDate",
    "Fecha Emisión": "issueDate",
    "Fecha Recepción": "receptionDate",
    "Fecha recepción": "receptionDate",
    // Issuer information
    "NIT de emisor": "issuerNit",
    "NIT Emisor": "issuerNit",
    "NIT emisor": "issuerNit",
    "Nombre de emisor": "issuerName",
    "Nombre Emisor": "issuerName",
    "Nombre emisor": "issuerName",
    // Receiver information
    "NIT Receptor": "receiverNit",
    "NIT receptor": "receiverNit",
    "Nombre Receptor": "receiverName",
    "Nombre receptor": "receiverName",
    // Taxes
    "IVA": "vat",
    "INC": "inc",
    "ICA": "ica",
    "IC": "ic",
    "Timbre": "stamp",
    "INC Bolsas": "incBags",
    "IN Carbono": "carbonTax",
    "IN Combustibles": "fuelTax",
    "IC Datos": "dataTax",
    "ICL": "icl",
    "INPP": "inpp",
    "IBUA": "ibua",
    "ICUI": "icui",
    "Rete IVA": "withheldVat",
    "Rete Renta": "withheldIncome",
    "Rete ICA": "withheldIca",
    // Other fields
    "Total": "total",
    "Grupo": "group",
    "Estado": "status",
    "Divisa": "currency",
    "Forma de Pago": "paymentMethod",
    "Medio de Pago": "paymentMedium",
} as const;

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    missingColumns: string[];
}

export interface ProcessedDianInvoice {
    id: string; // CUFE or CUDE (UUID unique identifier)
    documentType: string;
    folio: string;
    prefix: string;
    issueDate: string;
    issuerNit: string;
    issuerName: string;
    receiverNit: string;
    receiverName: string;
    vat: number;
    inc: number;
    total: number;
    group: string;
    [key: string]: any; // For additional columns
}

/**
 * Validates if a file is an Excel file
 */
export function validateExcelFile(file: File): { isValid: boolean; error?: string } {
    const validExtensions = [".xlsx", ".xls"];
    const validMimeTypes = [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
    ];

    const fileName = file.name.toLowerCase();
    const fileExtension = fileName.substring(fileName.lastIndexOf("."));

    if (!validExtensions.includes(fileExtension)) {
        return {
            isValid: false,
            error: "El archivo debe ser un archivo Excel (.xlsx o .xls)",
        };
    }

    if (file.type && !validMimeTypes.includes(file.type)) {
        return {
            isValid: false,
            error: "El archivo debe ser un archivo Excel (.xlsx o .xls)",
        };
    }

    return { isValid: true };
}

/**
 * Normalizes column names for comparison (removes accents, converts to lowercase)
 */
function normalizeColumnName(name: string): string {
    return name
        .toLowerCase()
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove accents
        .replace(/\s+/g, " "); // Normalize spaces
}

/**
 * Checks if a header matches a required column name (flexible matching)
 */
function matchesColumn(header: string, requiredColumn: string): boolean {
    const normalizedHeader = normalizeColumnName(header);
    const normalizedRequired = normalizeColumnName(requiredColumn);

    // Exact match
    if (normalizedHeader === normalizedRequired) return true;

    // Special handling for CUFE/CUDE
    if (requiredColumn === "CUFE/CUDE") {
        return normalizedHeader.includes("cufe") || normalizedHeader.includes("cude");
    }

    // Special handling for "Fecha emisión" vs "Fecha Emisión"
    if (requiredColumn.toLowerCase().includes("fecha") && requiredColumn.toLowerCase().includes("emisión")) {
        return normalizedHeader.includes("fecha") && normalizedHeader.includes("emision");
    }

    // Special handling for "NIT de emisor" vs "NIT Emisor"
    if (requiredColumn.toLowerCase().includes("nit") && requiredColumn.toLowerCase().includes("emisor")) {
        return normalizedHeader.includes("nit") && normalizedHeader.includes("emisor");
    }

    // Special handling for "Nombre de emisor" vs "Nombre Emisor"
    if (requiredColumn.toLowerCase().includes("nombre") && requiredColumn.toLowerCase().includes("emisor")) {
        return normalizedHeader.includes("nombre") && normalizedHeader.includes("emisor");
    }

    // Partial matching for other columns
    return normalizedHeader.includes(normalizedRequired) || normalizedRequired.includes(normalizedHeader);
}

/**
 * Validates that the Excel file contains all required columns
 */
export function validateRequiredColumns(worksheet: XLSX.WorkSheet): ValidationResult {
    const errors: string[] = [];
    const missingColumns: string[] = [];

    // Get all column headers from the first row
    const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
    const headers: string[] = [];

    for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
        const cell = worksheet[cellAddress];
        if (cell && cell.v) {
            headers.push(String(cell.v).trim());
        }
    }

    if (headers.length === 0) {
        return {
            isValid: false,
            errors: ["El archivo no contiene columnas"],
            missingColumns: REQUIRED_COLUMNS.slice(),
        };
    }

    // Check for required columns
    for (const requiredCol of REQUIRED_COLUMNS) {
        const found = headers.some((header) => matchesColumn(header, requiredCol));

        if (!found) {
            missingColumns.push(requiredCol);
            errors.push(`El archivo no contiene la columna requerida: ${requiredCol}`);
        }
    }

    return {
        isValid: missingColumns.length === 0,
        errors,
        missingColumns,
    };
}

/**
 * Processes the Excel file and returns normalized data
 */
export function processDianFile(file: File): Promise<ProcessedDianInvoice[]> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                if (!data) {
                    reject(new Error("El archivo está vacío o no se pudo leer"));
                    return;
                }

                const workbook = XLSX.read(data, { type: "array" });
                
                if (workbook.SheetNames.length === 0) {
                    reject(new Error("El archivo no contiene hojas de cálculo"));
                    return;
                }

                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];

                // Validate required columns
                const validation = validateRequiredColumns(worksheet);
                if (!validation.isValid) {
                    reject(new Error(validation.errors.join("\n")));
                    return;
                }

                // Convert to JSON
                const rawData = XLSX.utils.sheet_to_json(worksheet, { 
                    defval: null,
                    raw: false 
                }) as any[];

                if (rawData.length === 0) {
                    reject(new Error("El archivo está vacío o no tiene datos válidos"));
                    return;
                }

                // Get headers
                const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
                const headers: string[] = [];
                for (let col = range.s.c; col <= range.e.c; col++) {
                    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
                    const cell = worksheet[cellAddress];
                    if (cell && cell.v) {
                        headers.push(String(cell.v).trim());
                    }
                }

                // Process and normalize data
                const seenIds = new Set<string>();
                const processedData: ProcessedDianInvoice[] = rawData.map((row: any, index: number) => {
                    const normalizedRow: any = {};

                    // Extract CUFE/CUDE first and use it as ID
                    const cufeOrCude = extractCufeOrCude(row, headers);
                    if (!cufeOrCude) {
                        throw new Error(
                            `El archivo contiene filas sin CUFE/CUDE. ` +
                            `Fila ${index + 2} (después del encabezado) no tiene un CUFE/CUDE.`
                        );
                    }

                    // Check for duplicates
                    if (seenIds.has(cufeOrCude)) {
                        throw new Error(
                            `El archivo contiene CUFE/CUDE duplicados. ` +
                            `El CUFE/CUDE "${cufeOrCude}" aparece más de una vez. ` +
                            `Cada factura debe tener un CUFE/CUDE único.`
                        );
                    }
                    seenIds.add(cufeOrCude);
                    normalizedRow.id = cufeOrCude;

                    // Map all columns from Spanish to English
                    headers.forEach((header) => {
                        // Skip CUFE/CUDE columns as we already processed them as ID
                        const normalizedHeader = normalizeColumnName(header);
                        if (normalizedHeader.includes("cufe") || normalizedHeader.includes("cude")) {
                            return;
                        }

                        // Try exact match first
                        let mappedKey = COLUMN_MAPPING[header];
                        
                        // If no exact match, try flexible matching
                        if (!mappedKey) {
                            // Find matching column in mapping
                            for (const [spanishCol, englishCol] of Object.entries(COLUMN_MAPPING)) {
                                if (matchesColumn(header, spanishCol)) {
                                    mappedKey = englishCol;
                                    break;
                                }
                            }
                            
                            // If still no match, use a sanitized version of the header
                            if (!mappedKey) {
                                mappedKey = normalizedHeader
                                    .replace(/\s+/g, "")
                                    .replace(/[^a-z0-9]/g, "");
                            }
                        }
                        
                        const value = row[header] ?? null;
                        
                        // Type conversion for numeric fields
                        if (["vat", "inc", "total", "ica", "ic", "withheldvat", "withheldincome", "withheldica"].includes(mappedKey.toLowerCase())) {
                            normalizedRow[mappedKey] = parseNumericValue(value);
                        } else {
                            normalizedRow[mappedKey] = value;
                        }
                    });

                    return normalizedRow as ProcessedDianInvoice;
                });

                resolve(processedData);
            } catch (error) {
                if (error instanceof Error) {
                    reject(error);
                } else {
                    reject(new Error("Error al procesar el archivo Excel"));
                }
            }
        };

        reader.onerror = () => {
            reject(new Error("Error al leer el archivo"));
        };

        reader.readAsArrayBuffer(file);
    });
}

/**
 * Extracts CUFE or CUDE from row data
 */
function extractCufeOrCude(row: any, headers: string[]): string | null {
    // Try to find CUFE/CUDE column
    for (const header of headers) {
        const normalizedHeader = normalizeColumnName(header);
        if (normalizedHeader.includes("cufe") || normalizedHeader.includes("cude")) {
            const value = row[header];
            if (value) {
                const strValue = String(value).trim();
                // Return the value if it's not empty
                if (strValue.length > 0) {
                    return strValue;
                }
            }
        }
    }
    return null;
}

/**
 * Helper function to parse numeric values from Excel
 */
function parseNumericValue(value: any): number {
    if (value === null || value === undefined || value === "") {
        return 0;
    }

    if (typeof value === "number") {
        return value;
    }

    const strValue = String(value).replace(/,/g, "").trim();
    const numValue = parseFloat(strValue);

    return isNaN(numValue) ? 0 : numValue;
}
