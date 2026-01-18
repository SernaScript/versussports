"use server";

import { prisma } from "@/lib/prisma";
import { createPurchaseInvoice, getSiigoAuthToken } from "./siigo";
import { revalidatePath } from "next/cache";
import { XMLParser } from "fast-xml-parser";
import fs from "fs";
import path from "path";

// Helper to find value by key ignoring namespace prefix
function findKey(obj: any, keyName: string): any {
    if (!obj || typeof obj !== 'object') return undefined;
    if (obj[keyName] !== undefined) return obj[keyName];
    const found = Object.keys(obj).find(k => k.endsWith(`:${keyName}`) || k === keyName);
    return found ? obj[found] : undefined;
}

// Helper to parse XML
function extractItemsFromXml(xmlContent: string) {
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_"
    });
    const result = parser.parse(xmlContent);

    // root could be Invoice, fe:Invoice, etc.
    const root = findKey(result, "Invoice") || Object.values(result)[0];

    if (!root) return null;

    const linesContainer = findKey(root, "InvoiceLine");
    // It might be an array or single object
    const lines = Array.isArray(linesContainer) ? linesContainer : (linesContainer ? [linesContainer] : []);

    if (lines.length === 0) return null;

    const items = lines.map((line: any) => {
        // Item & Description
        const item = findKey(line, "Item");
        let description = item ? findKey(item, "Description") : "Item Sin Descripción";

        // Append Brand/Model to description to match Inspector detail
        const brand = findKey(item, "BrandName");
        const model = findKey(item, "ModelName");
        const sellersIdElement = findKey(findKey(item, "SellersItemIdentification"), "ID");
        // const standardIdElement = findKey(findKey(item, "StandardItemIdentification"), "ID");

        let details = [];
        if (brand) details.push(`Marca: ${brand}`);
        if (model) details.push(`Modelo: ${model}`);
        if (sellersIdElement) details.push(`Ref: ${sellersIdElement}`);

        // Only append if strict matching is desired, but usually description is enough. 
        // However, to "map as is in inspector", preserving this info in the single description field is helpful.
        if (details.length > 0) {
            description = `${description} (${details.join(", ")})`;
        }

        // Quantity
        const qtyObj = findKey(line, "InvoicedQuantity");
        let quantity = Number(qtyObj?.["#text"] || qtyObj || 1);
        if (isNaN(quantity) || !isFinite(quantity) || quantity <= 0) {
            quantity = 1;
        }

        // Price (Unit)
        const priceObj = findKey(line, "Price");
        const priceVal = priceObj ? findKey(priceObj, "PriceAmount") : null;
        const priceRaw = priceVal?.["#text"] || priceVal || 0;
        let price = Number(priceRaw);
        if (isNaN(price) || !isFinite(price)) {
            price = 0;
        }

        // Taxes (detailed extraction)
        const taxTotals = findKey(line, "TaxTotal");
        const taxes: { value: number, rate: number }[] = [];

        if (taxTotals) {
            const taxArr = Array.isArray(taxTotals) ? taxTotals : [taxTotals];
            taxArr.forEach((t: any) => {
                const sub = findKey(t, "TaxSubtotal");
                if (sub) {
                    const subArr = Array.isArray(sub) ? sub : [sub];
                    subArr.forEach((s: any) => {
                        const amountObj = findKey(s, "TaxAmount");
                        let amount = Number(amountObj?.["#text"] || amountObj || 0);
                        if (isNaN(amount) || !isFinite(amount)) amount = 0;

                        // Try to find rate
                        // Percent in TaxCategory usually, sometimes in Subtotal direct (rare)
                        let percentObj = findKey(s, "Percent");

                        if (!percentObj) {
                            const cat = findKey(s, "TaxCategory");
                            if (cat) percentObj = findKey(cat, "Percent");
                        }

                        let rate = Number(percentObj?.["#text"] || percentObj || 0);
                        if (isNaN(rate) || !isFinite(rate)) rate = 0;

                        // Fallback calculation if rate is missing but we have base
                        if (!rate) {
                            const baseObj = findKey(s, "TaxableAmount") || findKey(t, "TaxAmount");
                            let base = Number(baseObj?.["#text"] || baseObj || 0);
                            if (isNaN(base) || !isFinite(base)) base = 0;

                            if (base > 0 && amount > 0) {
                                rate = (amount / base) * 100;
                            }
                        }

                        taxes.push({ value: amount, rate: Number(rate.toFixed(2)) });
                    });
                }
            });
        }

        // Discount (AllowanceCharge)
        const allowanceCharges = findKey(line, "AllowanceCharge");
        let discount = 0;
        if (allowanceCharges) {
            const charges = Array.isArray(allowanceCharges) ? allowanceCharges : [allowanceCharges];
            charges.forEach((c: any) => {
                const indicator = findKey(c, "ChargeIndicator");
                // Check for 'false' string or boolean
                const isCharge = String(indicator) === "true";
                if (!isCharge) {
                    const amountObj = findKey(c, "Amount");
                    const amount = Number(amountObj?.["#text"] || amountObj || 0);
                    if (!isNaN(amount)) {
                        discount += amount;
                    }
                }
            });
        }

        return {
            description: String(description),
            quantity: quantity,
            price: price,
            discount: discount,
            taxesRaw: taxes
        };
    });

    // Handle Global AllowanceCharges (e.g., Tips/Propinas)
    const globalAllowanceCharges = findKey(root, "AllowanceCharge");
    if (globalAllowanceCharges) {
        const charges = Array.isArray(globalAllowanceCharges) ? globalAllowanceCharges : [globalAllowanceCharges];
        charges.forEach((c: any) => {
            const indicator = findKey(c, "ChargeIndicator");
            // "true" means Charge (Propina potentially)
            if (String(indicator) === "true") {
                const reasonObj = findKey(c, "AllowanceChargeReason");
                const reason = typeof reasonObj === 'object' ? (reasonObj?.["#text"] || "") : (reasonObj || "");

                const amountObj = findKey(c, "Amount");
                const amount = Number(amountObj?.["#text"] || amountObj || 0);

                if (amount > 0) {
                    items.push({
                        description: String(reason || "Cargo Global / Propina"),
                        quantity: 1,
                        price: amount,
                        discount: 0,
                        taxesRaw: []
                    });
                }
            }
        });
    }

    return items;
}

function extractSupplierFromXml(xmlContent: string) {
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        parseTagValue: false // Prevent "05" becoming 5
    });
    const result = parser.parse(xmlContent);
    const root = result.Invoice || result["fe:Invoice"] || Object.values(result)[0];

    if (!root) return null;

    // Helper to traverse safely
    const getVal = (obj: any, keys: string[]) => {
        if (!obj) return undefined;
        for (const k of keys) {
            if (obj[k] !== undefined) return obj[k];
            // Try with prefix
            const withPrefix = Object.keys(obj).find(key => key.endsWith(`:${k}`) || key === k);
            if (withPrefix) return obj[withPrefix];
        }
        return undefined;
    };

    const accountingSupplier = root["cac:AccountingSupplierParty"] || root["AccountingSupplierParty"];
    if (!accountingSupplier) return null;

    const party = accountingSupplier["cac:Party"] || accountingSupplier["Party"];
    if (!party) return null;

    // Name
    const taxScheme = party["cac:PartyTaxScheme"] || party["PartyTaxScheme"];
    // Usually name is in RegistrationName within PartyTaxScheme or PartyLegalEntity
    let name = getVal(taxScheme, ["cbc:RegistrationName", "RegistrationName"]);
    if (!name) {
        const legalEntity = party["cac:PartyLegalEntity"] || party["PartyLegalEntity"];
        name = getVal(legalEntity, ["cbc:RegistrationName", "RegistrationName"]);
    }
    // Fallback: PartyName
    if (!name) {
        const partyName = party["cac:PartyName"] || party["PartyName"];
        name = getVal(partyName, ["cbc:Name", "Name"]);
    }

    // Identification (NIT) & id_type
    const companyID = getVal(taxScheme, ["cbc:CompanyID", "CompanyID"]);
    const idVal = companyID?.["#text"] || companyID;

    // Determine id_type based on schemeName
    // User rule: schemeName="31" (NIT) or "13" (CC).
    // Siigo Mapping: '31' -> NIT, '13' -> Cédula.
    let idType = '31'; // Default to NIT
    const schemeName = companyID?.["@_schemeName"];
    if (schemeName === '13') {
        idType = '13';
    } else if (schemeName === '31') {
        idType = '31';
    }

    // Address extraction
    // User rule:
    // country_code <- cac:Country/cbc:IdentificationCode
    // state_code <- cac:RegistrationAddress/cbc:CountrySubentityCode
    // city_code <- cac:RegistrationAddress/cbc:ID

    // Search in RegistrationAddress first (Tax address)
    const regAddress = taxScheme?.["cac:RegistrationAddress"] || taxScheme?.["RegistrationAddress"] ||
        party["cac:PhysicalLocation"]?.["cac:Address"]; // Fallback

    let addressLine = "";
    let cityObj = null;

    if (regAddress) {
        // Address Line
        const lineObj = regAddress["cac:AddressLine"] || regAddress["AddressLine"];
        addressLine = getVal(lineObj?.["cbc:Line"] || lineObj?.["Line"], ["#text"]) ||
            lineObj?.["cbc:Line"] || lineObj?.["Line"] || "";

        // Country Code
        const countryObj = regAddress["cac:Country"] || regAddress["Country"];
        const countryCode = getVal(countryObj, ["cbc:IdentificationCode", "IdentificationCode"])?.["#text"] ||
            getVal(countryObj, ["cbc:IdentificationCode", "IdentificationCode"]) || "Co";

        // State Code
        const stateCodeVal = getVal(regAddress, ["cbc:CountrySubentityCode", "CountrySubentityCode"]);
        const stateCode = stateCodeVal?.["#text"] || stateCodeVal || "00";

        // City Code
        const cityIDVal = getVal(regAddress, ["cbc:ID", "ID"]);
        const cityCode = cityIDVal?.["#text"] || cityIDVal || "00000";

        cityObj = {
            country_code: String(countryCode),
            state_code: String(stateCode),
            city_code: String(cityCode)
        };
    }

    // Contact
    const contact = party["cac:Contact"] || party["Contact"];
    const phone = getVal(contact, ["cbc:Telephone", "Telephone"]);
    const email = getVal(contact, ["cbc:ElectronicMail", "ElectronicMail"]);

    return {
        identification: String(idVal || "").trim(),
        id_type: idType,
        name: String(name || "").trim().toUpperCase(),
        email: String(email || ""),
        phone: String(phone || ""),
        address: String(addressLine || ""),
        city: cityObj
    };
}

function getSiigoTaxId(rate: number): number | null {
    // Round to nearest integer or handle .00
    const rounded = Math.round(rate);
    if (rounded === 19) return 27572; // IVA 19%
    if (rounded === 5) return 27573;  // IVA 5%
    if (rounded === 8) return 27587;  // INC/IPO 8%
    // TODO: Add more mappings as discovered
    return null;
}

export async function previewSiigoCausation(invoiceId: string) {
    try {
        const invoice = await prisma.dianInvoice.findUnique({
            where: { id: invoiceId },
        });

        if (!invoice) {
            return { success: false, error: "Factura no encontrada" };
        }

        // --- PRE-CHECK REMOVED per user request (Check on send instead) ---

        const providerConfig = await prisma.providerAccountingConfig.findUnique({
            where: { providerNit: invoice.issuerNit },
            include: {
                expenseAccount: true,
                withholdingTax: true,
            },
        });

        if (!providerConfig) {
            return {
                success: false,
                error: `El proveedor con NIT ${invoice.issuerNit} no tiene configuración contable. Por favor configúrelo en Ajustes > Terceros.`,
            };
        }

        // Get the account code for product mapping
        const productCode = providerConfig.expenseAccount?.code || "001";

        // Get retention tax ID and Percentage if configured
        const retentionTaxId = providerConfig.withholdingTax?.siigoId ? Number(providerConfig.withholdingTax.siigoId) : null;
        const retentionPercentage = (providerConfig.withholdingTax as any)?.percentage
            ? Number((providerConfig.withholdingTax as any).percentage)
            : 0;

        // --- ITEM GENERATION LOGIC ---
        let items: any[] = [];
        let fromXml = false;
        // Try to read XML
        if (invoice.XMLURL) {
            try {
                // Resolve path: assumes XMLURL is relative to project root or 'downloads/'
                // Remove leading slashes or 'downloads/' duplication
                const cleanPath = invoice.XMLURL.replace(/^\//, '').replace(/^downloads\//, '');
                const fullPath = path.join(process.cwd(), "downloads", cleanPath);

                if (fs.existsSync(fullPath)) {
                    const xmlContent = fs.readFileSync(fullPath, "utf-8");
                    const xmlItems = extractItemsFromXml(xmlContent);

                    if (xmlItems && xmlItems.length > 0) {
                        fromXml = true;
                        items = xmlItems.map(x => {
                            const mappedTaxes: any[] = x.taxesRaw
                                .map(t => {
                                    const id = getSiigoTaxId(t.rate);
                                    return id ? { id, value: t.value } : null;
                                })
                                .filter(Boolean);

                            if (retentionTaxId) {
                                const base = x.quantity * x.price;
                                // Retention calculation is fixed later if prices are adjusted, 
                                // but initial estimate here:
                                const retValue = base * (retentionPercentage / 100);
                                mappedTaxes.push({ id: retentionTaxId, value: Number(retValue.toFixed(2)) });
                            }

                            return {
                                type: "Account",
                                code: productCode, // Use the mapped account code
                                description: x.description,
                                quantity: x.quantity,
                                price: x.price,
                                discount: x.discount || 0,
                                taxes: mappedTaxes
                            };
                        });
                    }
                }
            } catch (e) {
                console.warn("Failed to parse XML for invoice:", invoice.id, e);
                // Fallback to database summary
            }
        }

        // AUTO-FIX logic for inclusive prices handles 'items' in place...
        // It's after this block in the original file, so we don't need to replace it here.
        // But we DO need to construct the payload at the end. Can we target just the extraction?
        // No, I need to replace 'items.map' AND 'extractItemsFromXml' return.

        // I will replace from 'extractItemsFromXml' closing brace up to 'items ='

        // Actually, the prompt says "Replace the extractItemsFromXml function... and Update items mapping".
        // It's safer to replace a large chunk to capture all context.

        // ... (Fallbacks and payload generation will be below, I'll update payload generation there)

        // Let's rely on finding 'return {' inside maploop or extractItemsFromXml.

        // To update 'items' mapping in previewSiigoCausation AND extractItemsFromXml, 
        // I'll replace the block starting from inside extractItemsFromXml where 'return {' happens, 
        // down to where 'items' are mapped in previewSiigoCausation.

        // But 'extractItemsFromXml' is at top of file, 'previewSiigoCausation' is further down.
        // I should probably use multi_replace for this if possible, or just replace extractItemsFromXml first?
        // Ah, I can replace the whole helper function and subsequent helpers if they are contiguous? No, helpers are contiguous.

        // The file structure:
        // 1. imports
        // 2. findKey
        // 3. extractItemsFromXml (needs update)
        // 4. extractSupplierFromXml (unchanged)
        // 5. getSiigoTaxId (unchanged)
        // 6. previewSiigoCausation
        //    - ... items = xmlItems.map ... (needs update)
        //    - ... payload = ... (needs update)

        // This tool call seems to try replacing a HUGE chunk including extractSupplierFromXml which is risky if missed.
        // Let's try to just use MULTI_REPLACE.

        // Strategy:
        // 1. Update extractItemsFromXml return object and logic before it.
        // 2. Update items.map inside previewSiigoCausation.
        // 3. Update payload construction inside previewSiigoCausation.

        // It seems safer to use multi_replace_file_content.



        // AUTO-FIX: Detect if extracted prices are Tax-Inclusive
        // Logic: If Sum(ItemPrices) is close to (PayableAmount + Retentions), it means ItemPrices include VAT.
        // Normally, Sum(ItemPrices) should be (PayableAmount - VAT + Retentions).
        const currentTotalBase = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        const currentTotalRetentions = items.reduce((sum, item) => {
            if (!item.taxes) return sum;
            const ret = item.taxes.find((t: any) => t.id === retentionTaxId);
            return sum + (ret ? ret.value : 0);
        }, 0);

        const payableAmount = Number(invoice.total);
        const tolerance = 1000; // Tolerance for rounding differences

        // Check if Base ~= Payable + Retentions
        // This implies Base = Net + Taxes
        // Also ensure we have taxes to subtract, otherwise it's just a non-tax invoice.
        const totalTaxes = items.reduce((sum, item) => {
            return sum + (item.taxes?.reduce((tSum: number, t: any) => t.id !== retentionTaxId ? tSum + t.value : tSum, 0) || 0);
        }, 0);

        // Check if Base ~= Payable (Pre-Retention) OR Base ~= Payable + Retentions (Post-Retention)
        const diffPreRetention = Math.abs(currentTotalBase - payableAmount);
        const diffPostRetention = Math.abs(currentTotalBase - (payableAmount + currentTotalRetentions));

        const isInclusive = (diffPreRetention < tolerance || diffPostRetention < tolerance) && totalTaxes > 0;

        if (isInclusive) {
            console.log("Detected Tax-Inclusive Prices in XML. Adjusting to Net Prices.");
            items.forEach(item => {
                // Calculate tax amount to subtract (exclude retention)
                const taxAmount = item.taxes?.reduce((sum: number, t: any) => {
                    return t.id !== retentionTaxId ? sum + t.value : sum;
                }, 0) || 0;

                if (taxAmount > 0) {
                    const oldBase = item.price * item.quantity;
                    // New Base = InclusiveBase - Taxes
                    const newBase = oldBase - taxAmount;
                    const newPrice = newBase / item.quantity;

                    // Update Price
                    item.price = Number(newPrice.toFixed(4));

                    // Recalculate Retention if it exists, as it was likely calculated on the gross base
                    if (retentionTaxId && item.taxes) {
                        const retIndex = item.taxes.findIndex((t: any) => t.id === retentionTaxId);
                        if (retIndex !== -1) {
                            const newRetention = newBase * (retentionPercentage / 100);
                            item.taxes[retIndex].value = Number(newRetention.toFixed(2)); // Siigo API precision
                        }
                    }
                }
            });
        }

        // Fallback if no XML items found
        if (!fromXml) {
            const itemsTaxes = [];
            const valVat = Number(invoice.vat || 0);
            const valTotal = Number(invoice.total || 0);
            const valInc = Number(invoice.inc || 0);
            const valBags = Number(invoice.incBags || 0);

            // Base estimation
            const taxesVal = valVat + valInc + valBags;
            const baseValue = valTotal - taxesVal;

            // Infer VAT Rate
            if (valVat > 0 && baseValue > 0) {
                const rate = (valVat / baseValue) * 100;
                const ruleId = getSiigoTaxId(rate);
                if (ruleId) {
                    itemsTaxes.push({ id: ruleId, value: valVat });
                }
            }

            if (retentionTaxId) {
                const retValue = baseValue * (retentionPercentage / 100);
                itemsTaxes.push({ id: retentionTaxId, value: Number(retValue.toFixed(2)) });
            }

            // TODO: Handle INC (Impuesto Nacional al Consumo) mapping if generic code exists

            const description = `Factura de Compra ${invoice.prefix || ""}${invoice.folio} - ${invoice.issuerName}`;

            items = [{
                type: "Account",
                code: productCode,
                description: description,
                quantity: 1,
                price: baseValue,
                discount: 0,
                taxes: itemsTaxes
            }];
        }

        // --- END ITEM LOGIC ---

        const date = invoice.issueDate.toISOString().split("T")[0];

        // Calculate total from items to match Siigo's calculation (max 2 decimals)
        const totalPayments = items.reduce((acc, item) => {
            const itemBase = item.price * item.quantity;
            const discount = item.discount || 0;
            let itemTaxSum = 0;
            if (item.taxes) {
                item.taxes.forEach((t: any) => {
                    // Check if this tax is the retention tax
                    if (retentionTaxId && t.id === retentionTaxId) {
                        itemTaxSum -= t.value;
                    } else {
                        itemTaxSum += t.value;
                    }
                });
            }
            return acc + itemBase - discount + itemTaxSum;
        }, 0);

        // Payments
        const payments = [
            {
                id: 9585,
                value: Number(totalPayments.toFixed(2)),
                due_date: date
            }
        ];

        const inputHasDiscount = items.some(i => (i.discount || 0) > 0);

        const payload = {
            document: {
                id: 46614
            },
            date: date,
            supplier: {
                identification: invoice.issuerNit,
                branch_office: 0
            },
            provider_invoice: {
                prefix: invoice.prefix || "",
                number: invoice.folio || ""
            },
            discount_type: inputHasDiscount ? "Value" : undefined,
            items: items,
            payments: payments,
            observations: `Causación automática desde DianBridge para Factura ${invoice.id}`
        };

        const headers = {
            "Content-Type": "application/json",
            "Authorization": "Bearer [TOKEN]",
            "Partner-Id": "[PARTNER_ID]"
        };

        return {
            success: true,
            data: {
                headers,
                body: payload,
                invoice,
                providerConfig,
                source: fromXml ? "XML Parsed" : "Database Summary",
                retentionTaxId: retentionTaxId // Pass retention tax ID to frontend for proper display
            }
        };

    } catch (error) {
        console.error("Error previewing causation:", error);
        return { success: false, error: "Error generando la vista previa" };
    }
}

export async function createSiigoCausation(invoiceId: string, payload: any) {
    try {
        // We accept the payload from the client to allow for potential (future) manual edits 
        // or just to ensure we send exactly what the user approved.
        // For security, we might re-validate or re-build, but for this specific "Approve Preview" flow, passing it back is easier.

        const result: any = await createPurchaseInvoice(payload);

        if (result.success) {
            await prisma.dianInvoice.update({
                where: { id: invoiceId },
                data: {
                    isAccounted: true,
                    causationResult: result.data
                } as any,
            });
            revalidatePath("/facturas");
        } else {
            // Check for missing supplier error
            // Error structure example: { status: 400, errors: [{ code: 'invalid_reference', message: "The supplier doesn't exist..." }] }
            // result.errorData contains this structure
            if (result.errorData?.errors?.some((e: any) => e.code === 'invalid_reference' && e.message?.includes("supplier doesn't exist"))) {

                // Fetch invoice to get XML URL (as we don't have it passed in payload mainly)
                const invoice = await prisma.dianInvoice.findUnique({ where: { id: invoiceId } });

                let supplierData = null;
                if (invoice?.XMLURL) {
                    try {
                        const cleanPath = invoice.XMLURL.replace(/^\//, '').replace(/^downloads\//, '');
                        const fullPath = path.join(process.cwd(), "downloads", cleanPath);
                        if (fs.existsSync(fullPath)) {
                            const xmlContent = fs.readFileSync(fullPath, "utf-8");
                            supplierData = extractSupplierFromXml(xmlContent);
                        }
                    } catch (e) {
                        console.warn("Failed to extract supplier from XML in createSiigoCausation:", e);
                    }
                }

                // Fallback basic data
                if (!supplierData && invoice) {
                    supplierData = {
                        identification: invoice.issuerNit,
                        name: invoice.issuerName,
                    };
                }

                return {
                    success: false,
                    missingSupplier: true,
                    supplierData,
                    error: "El proveedor no existe en Siigo. Por favor créelo para continuar."
                };
            }
        }

        return result;
    } catch (error) {
        console.error("Error creating causation:", error);
        return { success: false, error: "Error enviando la causación" };
    }
}
