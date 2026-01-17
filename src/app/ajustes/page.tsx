"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Upload, Plus, Trash2, Search, Check, Save, FileText, Landmark, RefreshCw, Settings2, Users, Building2, Package, Receipt, CreditCard, Coins, Circle } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
    upsertSiigoAccounts,
    getSiigoAccounts,
    getExpenseAccounts,
    getSiigoSettings,
    saveSiigoSettings,
    getDianReceiverNameByNit,
    getBankExpenseConcepts,
    createBankExpenseConcept,
    deleteBankExpenseConcept,
    getDocumentTypes,
    syncSiigoDocumentTypes
} from "../actions/ajustes";
import { getSuppliers, syncSiigoSuppliers, createSupplierInSiigo } from "../actions/suppliers";
import { getCostCenters, syncSiigoCostCenters } from "../actions/cost-centers";
import { getProducts, syncSiigoProducts, createProductInSiigo } from "../actions/products";
import { getTaxes, syncSiigoTaxes } from "../actions/taxes";
import { getPaymentTypes, syncSiigoPaymentTypes } from "../actions/payment-types";
import { getCurrencies, syncSiigoCurrencies } from "../actions/currencies";
import { getProviderAccountingConfigs, getWithholdingTaxes, upsertProviderAccountingConfig } from "../actions/provider-accounting-configs";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { LoadingSection } from "@/components/ui/loading-section";
import { cn } from "@/lib/utils";

// --- Main Layout ---

export default function AjustesPage() {
    const [activeSection, setActiveSection] = useState<"general" | "vouchers" | "accounts" | "concepts" | "suppliers" | "provider-configs" | "cost-centers" | "products" | "taxes" | "payment-types" | "currencies" | "invoice-types">("vouchers");

    return (
        <div className="flex flex-col md:flex-row h-[calc(100vh-4rem)]">
            {/* Sidebar */}
            <aside className="w-full md:w-64 bg-slate-50 border-r p-4 space-y-2">
                <div className="mb-6 px-2">
                    <h1 className="text-xl font-bold tracking-tight">Configuración</h1>
                    <p className="text-xs text-gray-500">Integración y ajustes contables</p>
                </div>

                <NavButton
                    active={activeSection === "vouchers"}
                    onClick={() => setActiveSection("vouchers")}
                    icon={<FileText className="w-4 h-4 mr-2" />}
                    label="Comprobantes"
                />
                <NavButton
                    active={activeSection === "accounts"}
                    onClick={() => setActiveSection("accounts")}
                    icon={<Landmark className="w-4 h-4 mr-2" />}
                    label="Plan de Cuentas"
                />
                <NavButton
                    active={activeSection === "concepts"}
                    onClick={() => setActiveSection("concepts")}
                    icon={<Settings2 className="w-4 h-4 mr-2" />}
                    label="Conceptos de Gasto"
                />
                <NavButton
                    active={activeSection === "general"}
                    onClick={() => setActiveSection("general")}
                    icon={<Settings2 className="w-4 h-4 mr-2" />}
                    label="Ajustes Generales"
                />
                <div className="pt-4 border-t mt-2">
                    <p className="text-xs font-semibold text-gray-400 uppercase px-2 mb-2">Facturas de Compra</p>
                </div>
                <NavButton
                    active={activeSection === "invoice-types"}
                    onClick={() => setActiveSection("invoice-types")}
                    icon={<FileText className="w-4 h-4 mr-2" />}
                    label="Tipos de Factura"
                />
                <NavButton
                    active={activeSection === "suppliers"}
                    onClick={() => setActiveSection("suppliers")}
                    icon={<Users className="w-4 h-4 mr-2" />}
                    label="Proveedores"
                />
                <NavButton
                    active={activeSection === "provider-configs"}
                    onClick={() => setActiveSection("provider-configs")}
                    icon={<Settings2 className="w-4 h-4 mr-2" />}
                    label="Config. Terceros"
                />
                <NavButton
                    active={activeSection === "cost-centers"}
                    onClick={() => setActiveSection("cost-centers")}
                    icon={<Building2 className="w-4 h-4 mr-2" />}
                    label="Centros de Costo"
                />
                <NavButton
                    active={activeSection === "products"}
                    onClick={() => setActiveSection("products")}
                    icon={<Package className="w-4 h-4 mr-2" />}
                    label="Productos"
                />
                <NavButton
                    active={activeSection === "taxes"}
                    onClick={() => setActiveSection("taxes")}
                    icon={<Receipt className="w-4 h-4 mr-2" />}
                    label="Impuestos"
                />
                <NavButton
                    active={activeSection === "payment-types"}
                    onClick={() => setActiveSection("payment-types")}
                    icon={<CreditCard className="w-4 h-4 mr-2" />}
                    label="Formas de Pago"
                />
                <NavButton
                    active={activeSection === "currencies"}
                    onClick={() => setActiveSection("currencies")}
                    icon={<Coins className="w-4 h-4 mr-2" />}
                    label="Monedas"
                />
            </aside>

            {/* Content Range */}
            <main className="flex-1 p-8 overflow-auto">
                {activeSection === "vouchers" && <VouchersSection />}
                {activeSection === "accounts" && <AccountsSection />}
                {activeSection === "concepts" && <ConceptsSection />}
                {activeSection === "general" && <GeneralSettingsSection />}
                {activeSection === "invoice-types" && <InvoiceTypesSection />}
                {activeSection === "suppliers" && <SuppliersSection />}
                {activeSection === "provider-configs" && <ProviderConfigsSection />}
                {activeSection === "cost-centers" && <CostCentersSection />}
                {activeSection === "products" && <ProductsSection />}
                {activeSection === "taxes" && <TaxesSection />}
                {activeSection === "payment-types" && <PaymentTypesSection />}
                {activeSection === "currencies" && <CurrenciesSection />}
            </main>
        </div>
    );
}

function NavButton({ active, onClick, icon, label }: any) {
    return (
        <Button
            variant={active ? "secondary" : "ghost"}
            className={cn("w-full justify-start", active && "bg-white shadow-sm border")}
            onClick={onClick}
        >
            {icon}
            {label}
        </Button>
    )
}

// --- Sections ---

function VouchersSection() {
    const [types, setTypes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);

    useEffect(() => {
        loadTypes();
    }, []);

    const loadTypes = async () => {
        setLoading(true);
        const res = await getDocumentTypes();
        if (res.success && res.data) {
            setTypes(res.data);
        }
        setLoading(false);
    };

    const handleSync = async () => {
        setSyncing(true);
        const res = await syncSiigoDocumentTypes();
        setSyncing(false);
        if (res.success) {
            toast.success(`Se sincronizaron ${res.count} tipos de comprobante.`);
            loadTypes();
        } else {
            toast.error(("error" in res && res.error) ? (res as any).error : "Error al sincronizar tipos de comprobante");
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Tipos de Comprobante</h2>
                <p className="text-muted-foreground">Gestiona los tipos de documento sincronizados con Siigo.</p>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Comprobantes Sincronizados</CardTitle>
                            <CardDescription>Lista de documentos disponibles para integraciones.</CardDescription>
                        </div>
                        <Button onClick={handleSync} disabled={syncing}>
                            {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                            Sincronizar desde Siigo
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <LoadingSection />
                    ) : (
                        <div className="rounded-md border bg-white overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Código</TableHead>
                                        <TableHead>Nombre</TableHead>
                                        <TableHead>Tipo</TableHead>
                                        <TableHead>Estado</TableHead>
                                        <TableHead>ID Interno</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {types.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-8 text-gray-500">No hay comprobantes sincronizados. Haz clic en Sincronizar.</TableCell>
                                        </TableRow>
                                    ) : (
                                        types.map((t) => (
                                            <TableRow key={t.id}>
                                                <TableCell className="font-medium">{t.code}</TableCell>
                                                <TableCell>{t.name}</TableCell>
                                                <TableCell>{t.type}</TableCell>
                                                <TableCell>
                                                    <Badge variant={t.active ? "outline" : "secondary"}>
                                                        {t.active ? "Activo" : "Inactivo"}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-xs text-gray-400 font-mono">{t.id}</TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function AccountsSection() {
    const [accounts, setAccounts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [isUploading, setIsUploading] = useState(false);
    const [fileName, setFileName] = useState<string | null>(null);
    const [uploadOpen, setUploadOpen] = useState(false);

    useEffect(() => {
        loadAccounts();
    }, []);

    const loadAccounts = async (query?: string) => {
        setLoading(true);
        const res = await getSiigoAccounts(query);
        if (res.success && res.data) {
            setAccounts(res.data);
        }
        setLoading(false);
    };

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearch(e.target.value);
        // Debounce could be added here
        loadAccounts(e.target.value);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setFileName(file.name);
        setIsUploading(true);

        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(sheet);

            const mappedData = jsonData.map((row: any) => ({
                code: String(row['Código'] || row['Codigo'] || row['CUENTA'] || ''),
                name: row['Nombre'] || row['DESCRIPCION'] || '',
                category: row['Categoría'] || row['Categoria'] || '',
                class: row['Clase'] || '',
                level: row['Nivel agrupación'] || row['Nivel'] || null,
                active: row['Activo'] === 'Si' || row['Activo'] === true || row['Activo'] === 'S'
            })).filter(r => r.code && r.name);

            if (mappedData.length === 0) {
                toast.error("No se encontraron cuentas válidas en el archivo.");
                setIsUploading(false);
                return;
            }

            const res = await upsertSiigoAccounts(mappedData);
            if (res.success) {
                toast.success(`Se importaron ${res.count} cuentas contables correctamente.`);
                setFileName(null);
                setUploadOpen(false);
                loadAccounts();
            } else {
                toast.error(res.error);
            }
        } catch (err) {
            console.error(err);
            toast.error("Error al procesar el archivo Excel.");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Plan de Cuentas</h2>
                    <p className="text-muted-foreground">Listado de cuentas contables sincronizadas.</p>
                </div>

                <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Upload className="mr-2 h-4 w-4" />
                            Importar Excel
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Importar Cuentas Contables</DialogTitle>
                            <DialogDescription>
                                Sube el archivo Excel exportado de Siigo para actualizar el plan de cuentas.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center space-y-2 hover:bg-slate-50 transition-colors cursor-pointer relative mt-4">
                            <Input
                                type="file"
                                accept=".xlsx, .xls"
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                onChange={handleFileUpload}
                                disabled={isUploading}
                            />
                            <div className="p-3 bg-blue-50 rounded-full">
                                {isUploading ? <Loader2 className="h-6 w-6 text-blue-500 animate-spin" /> : <Upload className="h-6 w-6 text-blue-500" />}
                            </div>
                            <div className="space-y-1">
                                <p className="font-medium text-sm">{isUploading ? "Procesando..." : "Click para subir o arrastra el archivo"}</p>
                                <p className="text-xs text-gray-500">Soporta .xlsx (Columnas: Código, Nombre, Activo)</p>
                            </div>
                            {fileName && <Badge variant="secondary" className="mt-2">{fileName}</Badge>}
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar cuenta por código o nombre..."
                            className="pl-8"
                            value={search}
                            onChange={handleSearch}
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <LoadingSection />
                    ) : (
                        <div className="rounded-md border bg-white overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Código</TableHead>
                                        <TableHead>Nombre</TableHead>
                                        <TableHead>Categoría / Clase</TableHead>
                                        <TableHead>Nivel</TableHead>
                                        <TableHead>Estado</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {accounts.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                                                No hay cuentas registradas. Importa un Excel para comenzar.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        accounts.map((acc) => (
                                            <TableRow key={acc.code}>
                                                <TableCell className="font-bold font-mono">{acc.code}</TableCell>
                                                <TableCell>{acc.name}</TableCell>
                                                <TableCell>{acc.category || acc.class || "-"}</TableCell>
                                                <TableCell>{acc.level || "-"}</TableCell>
                                                <TableCell>
                                                    <Badge variant={acc.active ? "outline" : "secondary"}>
                                                        {acc.active ? "Activo" : "Inactivo"}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function ConceptsSection() {
    const [concepts, setConcepts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [newConcept, setNewConcept] = useState({ alias: "", pattern: "", accountCode: "" });
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        loadConcepts();
    }, []);

    const loadConcepts = async () => {
        setLoading(true);
        const res = await getBankExpenseConcepts();
        if (res.success && res.data) {
            setConcepts(res.data);
        }
        setLoading(false);
    };

    const handleCreate = async () => {
        if (!newConcept.alias || !newConcept.pattern || !newConcept.accountCode) {
            toast.error("Todos los campos son obligatorios");
            return;
        }
        setIsCreating(true);
        const res = await createBankExpenseConcept(newConcept);
        setIsCreating(false);
        if (res.success) {
            toast.success("Concepto creado");
            setNewConcept({ alias: "", pattern: "", accountCode: "" });
            loadConcepts();
        } else {
            toast.error(res.error);
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm("¿Estás seguro de eliminar este concepto?")) {
            const res = await deleteBankExpenseConcept(id);
            if (res.success) {
                toast.success("Concepto eliminado");
                loadConcepts();
            } else {
                toast.error(res.error);
            }
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Conceptos de Gasto</h2>
                <p className="text-muted-foreground">Reglas automáticas para identificar gastos bancarios.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Nuevo Concepto</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label>Alias</Label>
                            <Input
                                placeholder="Ej. GMF"
                                value={newConcept.alias}
                                onChange={(e) => setNewConcept({ ...newConcept, alias: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Patrón (Texto)</Label>
                            <Input
                                placeholder="Ej. GRAVAMEN"
                                value={newConcept.pattern}
                                onChange={(e) => setNewConcept({ ...newConcept, pattern: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Cuenta Contable</Label>
                            <AccountSelector
                                value={newConcept.accountCode}
                                onSelect={(val) => setNewConcept({ ...newConcept, accountCode: val })}
                            />
                        </div>
                    </div>
                    <Button onClick={handleCreate} disabled={isCreating}>
                        {isCreating ? <Loader2 className="animate-spin mr-2" /> : <Plus className="mr-2 h-4 w-4" />}
                        Agregar Concepto
                    </Button>
                </CardContent>
            </Card>

            <div className="rounded-md border bg-white">
                {loading ? (
                    <LoadingSection />
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Alias</TableHead>
                                <TableHead>Patrón</TableHead>
                                <TableHead>Cuenta Contable</TableHead>
                                <TableHead className="w-[100px]">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {concepts.map((concept) => (
                                <TableRow key={concept.id}>
                                    <TableCell className="font-medium">{concept.alias}</TableCell>
                                    <TableCell><Badge variant="outline">{concept.pattern}</Badge></TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-bold">{concept.accountCode}</span>
                                            <span className="text-xs text-gray-500">{concept.account?.name}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-red-600 hover:bg-red-50"
                                            onClick={() => handleDelete(concept.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </div>
        </div>
    );
}

function GeneralSettingsSection() {
    const [settings, setSettings] = useState<any>({});
    const [loading, setLoading] = useState(true);
    const [bankNitReceiverName, setBankNitReceiverName] = useState<string | null>(null);
    const [bankNitLookupLoading, setBankNitLookupLoading] = useState(false);

    useEffect(() => {
        loadSettings();
    }, []);

    useEffect(() => {
        const nit = String(settings.bankNit || "").trim();
        if (!nit) {
            setBankNitReceiverName(null);
            setBankNitLookupLoading(false);
            return;
        }

        const timeout = setTimeout(async () => {
            setBankNitLookupLoading(true);
            const res = await getDianReceiverNameByNit(nit);
            if (res.success) {
                setBankNitReceiverName((res as any).data ?? null);
            } else {
                setBankNitReceiverName(null);
            }
            setBankNitLookupLoading(false);
        }, 400);

        return () => clearTimeout(timeout);
    }, [settings.bankNit]);

    const loadSettings = async () => {
        setLoading(true);
        const res = await getSiigoSettings();
        if (res.success && res.data) {
            setSettings(res.data);
        }
        setLoading(false);
    };

    const handleSaveSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        const res = await saveSiigoSettings(settings);
        if (res.success) {
            toast.success("Configuración guardada.");
        } else {
            toast.error(res.error);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Ajustes Generales</h2>
                <p className="text-muted-foreground">Parámetros globales para la contabilización.</p>
            </div>

            <Card>
                <CardContent className="pt-6">
                    {loading ? (
                        <LoadingSection />
                    ) : (
                        <form onSubmit={handleSaveSettings} className="space-y-4">
                            <div className="space-y-2">
                                <Label>Cuenta Bancaria (Contrapartida)</Label>
                                <AccountSelector
                                    value={settings.bankAccountCode || ""}
                                    onSelect={(val) => setSettings({ ...settings, bankAccountCode: val })}
                                />
                                <p className="text-xs text-gray-500">Esta cuenta recibirá el crédito en los egresos.</p>
                            </div>
                            <div className="space-y-2">
                                <Label>Tipo de Comprobante (Journal ID)</Label>
                                <Input
                                    value={settings.journalDocumentId || ""}
                                    onChange={(e) => setSettings({ ...settings, journalDocumentId: e.target.value })}
                                    placeholder="Ej. 2445"
                                />
                                <p className="text-xs text-gray-500">
                                    ID Interno del tipo de comprobante en Siigo.
                                    <br />
                                    <b>Nota:</b> Usa la sección "Comprobantes" para ver los IDs disponibles.
                                </p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>NIT del Banco / Tercero</Label>
                                    <Input
                                        value={settings.bankNit || ""}
                                        onChange={(e) => setSettings({ ...settings, bankNit: e.target.value })}
                                        placeholder="Ej. 890900900"
                                        inputMode="numeric"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Nombre del receptor (DIAN)</Label>
                                    <Input
                                        value={bankNitReceiverName || ""}
                                        readOnly
                                        disabled
                                        placeholder={
                                            bankNitLookupLoading
                                                ? "Consultando..."
                                                : (String(settings.bankNit || "").trim() ? "No encontrado" : "Ingresa un NIT")
                                        }
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end">
                                <Button type="submit" size="icon" aria-label="Guardar configuración">
                                    <Save className="h-4 w-4" />
                                </Button>
                            </div>
                        </form>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}

function AccountSelector({ value, onSelect }: { value: string, onSelect: (val: string) => void }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [accounts, setAccounts] = useState<any[]>([]);

    useEffect(() => {
        const fetch = async () => {
            const res = await getSiigoAccounts(search);
            if (res.success && res.data) {
                setAccounts(res.data);
            }
        };
        fetch();
    }, [search]);

    const selectedAccount = accounts.find(a => a.code === value);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between font-normal"
                >
                    {value ? (
                        selectedAccount ? `${selectedAccount.code} - ${selectedAccount.name}` : value
                    ) : (
                        "Buscar cuenta..."
                    )}
                    <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command shouldFilter={false}>
                    <CommandInput placeholder="Buscar por código o nombre..." onValueChange={setSearch} />
                    <CommandList>
                        <CommandEmpty>No se encontraron resultados.</CommandEmpty>
                        <CommandGroup>
                            {accounts.map((account) => (
                                <CommandItem
                                    key={account.code}
                                    value={account.code}
                                    onSelect={(currentValue) => {
                                        onSelect(account.code);
                                        setOpen(false);
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value === account.code ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    <div className="flex flex-col">
                                        <span className="font-bold">{account.code}</span>
                                        <span className="text-xs text-muted-foreground">{account.name}</span>
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

// --- New Sections for Purchase Invoices ---

function InvoiceTypesSection() {
    const [types, setTypes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);

    useEffect(() => {
        loadTypes();
    }, []);

    const loadTypes = async () => {
        setLoading(true);
        const res = await getDocumentTypes('FC');
        if (res.success && res.data) {
            setTypes(res.data);
        }
        setLoading(false);
    };

    const handleSync = async () => {
        setSyncing(true);
        const res = await syncSiigoDocumentTypes('FC');
        setSyncing(false);
        if (res.success) {
            toast.success(`Se sincronizaron ${res.count} tipos de factura.`);
            loadTypes();
        } else {
            toast.error(("error" in res && res.error) ? (res as any).error : "Error al sincronizar tipos de factura");
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Tipos de Factura (FC)</h2>
                <p className="text-muted-foreground">Configuración detallada de los tipos de factura de compra.</p>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Tipos de Documento FC</CardTitle>
                            <CardDescription>Parámetros sincronizados desde Siigo.</CardDescription>
                        </div>
                        <Button onClick={handleSync} disabled={syncing}>
                            {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                            Sincronizar (FC)
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <LoadingSection />
                    ) : (
                        <div className="rounded-md border bg-white overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Código</TableHead>
                                        <TableHead>Nombre</TableHead>
                                        <TableHead className="text-center">Soporte</TableHead>
                                        <TableHead className="text-center">C. Costo</TableHead>
                                        <TableHead className="text-center"># Auto</TableHead>
                                        <TableHead className="text-center">Decimales</TableHead>
                                        <TableHead className="text-center">Imp. Consumo</TableHead>
                                        <TableHead className="text-center">ReteIVA</TableHead>
                                        <TableHead className="text-center">ReteICA</TableHead>
                                        <TableHead>Estado</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {types.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={10} className="text-center py-8 text-gray-500">No hay tipos de factura sincronizados.</TableCell>
                                        </TableRow>
                                    ) : (
                                        types.map((t) => (
                                            <TableRow key={t.id}>
                                                <TableCell className="font-medium font-mono">{t.code}</TableCell>
                                                <TableCell className="max-w-[200px] truncate" title={t.name}>{t.name}</TableCell>
                                                <TableCell className="text-center">
                                                    {t.documentSupport ? <Check className="w-4 h-4 mx-auto text-green-500" /> : <span className="text-gray-300">-</span>}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {t.costCenter ? (
                                                        <Badge variant="outline" className={t.costCenterMandatory ? "border-red-200 bg-red-50 text-red-700" : ""}>
                                                            {t.costCenterMandatory ? "Oblig." : "Opc."}
                                                        </Badge>
                                                    ) : <span className="text-gray-300">-</span>}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {t.automaticNumber ? <Check className="w-4 h-4 mx-auto text-blue-500" /> : <span className="text-xs text-gray-500">Consec: {t.consecutive}</span>}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {t.decimals ? <Check className="w-4 h-4 mx-auto text-green-500" /> : <span className="text-gray-300">-</span>}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {t.consumptionTax ? <Check className="w-4 h-4 mx-auto text-green-500" /> : <span className="text-gray-300">-</span>}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {t.reteiva ? <Check className="w-4 h-4 mx-auto text-green-500" /> : <span className="text-gray-300">-</span>}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {t.reteica ? <Check className="w-4 h-4 mx-auto text-green-500" /> : <span className="text-gray-300">-</span>}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={t.active ? "outline" : "secondary"}>
                                                        {t.active ? "Activo" : "Inactivo"}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function SuppliersSection() {
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [search, setSearch] = useState("");

    useEffect(() => {
        loadSuppliers();
    }, []);

    const loadSuppliers = async (query?: string) => {
        setLoading(true);
        const res = await getSuppliers(query);
        if (res.success && res.data) {
            setSuppliers(res.data);
        }
        setLoading(false);
    };

    const handleSync = async () => {
        setSyncing(true);
        const res = await syncSiigoSuppliers();
        setSyncing(false);
        if (res.success) {
            toast.success(`Se sincronizaron ${res.count} proveedores.`);
            loadSuppliers();
        } else {
            toast.error(res.error);
        }
    };

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearch(e.target.value);
        loadSuppliers(e.target.value);
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Proveedores</h2>
                <p className="text-muted-foreground">Gestiona los proveedores sincronizados con Siigo.</p>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Proveedores Sincronizados</CardTitle>
                            <CardDescription>Lista de proveedores disponibles para facturas de compra.</CardDescription>
                        </div>
                        <Button onClick={handleSync} disabled={syncing}>
                            {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                            Sincronizar desde Siigo
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="relative mb-4">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar proveedor..."
                            className="pl-8"
                            value={search}
                            onChange={handleSearch}
                        />
                    </div>
                    {loading ? (
                        <LoadingSection />
                    ) : (
                        <div className="rounded-md border bg-white overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>NIT</TableHead>
                                        <TableHead>Nombre</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Teléfono</TableHead>
                                        <TableHead>Estado</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {suppliers.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-8 text-gray-500">No hay proveedores sincronizados. Haz clic en Sincronizar.</TableCell>
                                        </TableRow>
                                    ) : (
                                        suppliers.map((s) => (
                                            <TableRow key={s.id}>
                                                <TableCell className="font-medium">{s.identification}</TableCell>
                                                <TableCell>{s.name}</TableCell>
                                                <TableCell>{s.email || "-"}</TableCell>
                                                <TableCell>{s.phone || "-"}</TableCell>
                                                <TableCell>
                                                    <Badge variant={s.active ? "outline" : "secondary"}>
                                                        {s.active ? "Activo" : "Inactivo"}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function AccountIdSelector({ value, onSelect, initialAccount }: { value: string | null, onSelect: (val: string | null) => void, initialAccount?: any }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [accounts, setAccounts] = useState<any[]>([]);

    useEffect(() => {
        const fetch = async () => {
            const res = await getExpenseAccounts(search);
            if (res.success && res.data) {
                setAccounts(res.data);
            }
        };
        fetch();
    }, [search]);

    const findSelected = () => {
        if (!value) return null;
        const found = accounts.find(a => a.id === value);
        if (found) return found;
        if (initialAccount && initialAccount.id === value) return initialAccount;
        return null;
    };

    const selectedAccount = findSelected();

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between font-normal"
                >
                    {value ? (
                        selectedAccount ? `${selectedAccount.code} - ${selectedAccount.name}` : value
                    ) : (
                        "Sin configurar"
                    )}
                    <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command shouldFilter={false}>
                    <CommandInput placeholder="Buscar por código o nombre..." onValueChange={setSearch} />
                    <CommandList>
                        <CommandEmpty>No se encontraron resultados.</CommandEmpty>
                        <CommandGroup>
                            <CommandItem
                                key="__null__"
                                value="__null__"
                                onSelect={() => {
                                    onSelect(null);
                                    setOpen(false);
                                }}
                            >
                                <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                                <span className="text-sm">Sin configurar</span>
                            </CommandItem>
                            {accounts.map((account) => (
                                <CommandItem
                                    key={account.id}
                                    value={`${account.code} ${account.name}`}
                                    onSelect={() => {
                                        onSelect(account.id);
                                        setOpen(false);
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value === account.id ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    <div className="flex flex-col">
                                        <span className="font-bold">{account.code}</span>
                                        <span className="text-xs text-muted-foreground">{account.name}</span>
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

function WithholdingTaxSelector({ value, onSelect, initialTax }: { value: string | null, onSelect: (val: string | null) => void, initialTax?: any }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [taxes, setTaxes] = useState<any[]>([]);

    useEffect(() => {
        const fetch = async () => {
            const res = await getWithholdingTaxes(search);
            if (res.success && res.data) {
                setTaxes(res.data);
            }
        };
        fetch();
    }, [search]);

    const findSelected = () => {
        if (!value) return null;
        const found = taxes.find(t => t.id === value);
        if (found) return found;
        if (initialTax && initialTax.id === value) return initialTax;
        return null;
    };

    const selectedTax = findSelected();
    const selectedLabel = selectedTax
        ? `${selectedTax.name}${selectedTax.rate != null ? ` (${selectedTax.rate}%)` : ""} - ${selectedTax.type || ""}`
        : value;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between font-normal"
                >
                    {value ? (selectedLabel) : "Sin configurar"}
                    <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command shouldFilter={false}>
                    <CommandInput placeholder="Buscar por nombre o ID Siigo..." onValueChange={setSearch} />
                    <CommandList>
                        <CommandEmpty>No se encontraron resultados.</CommandEmpty>
                        <CommandGroup>
                            <CommandItem
                                key="__null__"
                                value="__null__"
                                onSelect={() => {
                                    onSelect(null);
                                    setOpen(false);
                                }}
                            >
                                <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                                <span className="text-sm">Sin configurar</span>
                            </CommandItem>
                            {taxes.map((tax) => (
                                <CommandItem
                                    key={tax.id}
                                    value={`${tax.name} ${tax.siigoId} ${tax.type || ""}`}
                                    onSelect={() => {
                                        onSelect(tax.id);
                                        setOpen(false);
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value === tax.id ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    <div className="flex flex-col">
                                        <span className="font-medium">{tax.name}</span>
                                        <span className="text-xs text-muted-foreground">
                                            {tax.type || "-"} · SiigoId: {tax.siigoId}{tax.rate != null ? ` · ${tax.rate}%` : ""}
                                        </span>
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

function ProviderConfigsSection() {
    const [configs, setConfigs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const pageSize = 20;
    const [total, setTotal] = useState(0);
    const [drafts, setDrafts] = useState<Record<string, { expenseAccountId: string | null; withholdingTaxId: string | null }>>({});
    const [savingNit, setSavingNit] = useState<string | null>(null);

    useEffect(() => {
        loadConfigs();
    }, []);

    const loadConfigs = async (query?: string, nextPage?: number) => {
        setLoading(true);
        const currentPage = nextPage ?? page;
        const res = await getProviderAccountingConfigs({ query, page: currentPage, pageSize });
        if (res.success && res.data) {
            setConfigs(res.data);
            setTotal((res as any).total ?? 0);
            setPage((res as any).page ?? currentPage);
            const nextDrafts: Record<string, { expenseAccountId: string | null; withholdingTaxId: string | null }> = {};
            for (const c of res.data) {
                nextDrafts[c.providerNit] = {
                    expenseAccountId: c.expenseAccountId ?? null,
                    withholdingTaxId: c.withholdingTaxId ?? null
                };
            }
            setDrafts(nextDrafts);
        }
        setLoading(false);
    };

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setSearch(val);
        setPage(1);
        loadConfigs(val, 1);
    };

    const handleSave = async (providerNit: string) => {
        const draft = drafts[providerNit];
        if (!draft) return;
        setSavingNit(providerNit);
        const res = await upsertProviderAccountingConfig({
            providerNit,
            expenseAccountId: draft.expenseAccountId,
            withholdingTaxId: draft.withholdingTaxId
        });
        setSavingNit(null);
        if (res.success) {
            toast.success("Configuración guardada");
            const payload = (res as any).data;
            setConfigs((prev) =>
                prev.map((c) =>
                    c.providerNit === providerNit
                        ? {
                            ...c,
                            status: payload?.status ?? "COMPLETED",
                            providerName: payload?.provider_name ?? c.providerName,
                            provider_name: payload?.provider_name ?? (c as any).provider_name,
                        }
                        : c
                )
            );
        } else {
            toast.error(("error" in res && (res as any).error) ? (res as any).error : "Error al guardar configuración");
        }
    };

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const canPrev = page > 1;
    const canNext = page < totalPages;

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Configuración de Terceros</h2>
                <p className="text-muted-foreground">Define cuenta de gasto e impuesto de retención por proveedor (NIT).</p>
            </div>

            <Card>
                <CardHeader>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por NIT..."
                            className="pl-8"
                            value={search}
                            onChange={handleSearch}
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <LoadingSection />
                    ) : (
                        <>
                            <div className="rounded-md border bg-white overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Tercero (NIT - Nombre)</TableHead>
                                            <TableHead>Cuenta de gasto</TableHead>
                                            <TableHead>Retención</TableHead>
                                            <TableHead className="text-center w-[80px]">Estado</TableHead>
                                            <TableHead className="text-right w-[60px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {configs.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                                                    No hay proveedores (o no hay coincidencias).
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            configs.map((c) => {
                                                const d = drafts[c.providerNit] || { expenseAccountId: null, withholdingTaxId: null };
                                                const status = String(c.status || "PENDING").toUpperCase();
                                                const isPending = status !== "COMPLETED";
                                                return (
                                                    <TableRow key={c.providerNit}>
                                                        <TableCell className="min-w-[280px]">
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-medium">{(c.providerName || c.provider_name || "-")}</span>
                                                                <span className="text-xs font-mono text-muted-foreground">{c.providerNit}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="min-w-[220px]">
                                                            <AccountIdSelector
                                                                value={d.expenseAccountId}
                                                                initialAccount={c.expenseAccount}
                                                                onSelect={(val) => setDrafts(prev => ({ ...prev, [c.providerNit]: { ...d, expenseAccountId: val } }))}
                                                            />
                                                        </TableCell>
                                                        <TableCell className="min-w-[260px]">
                                                            <WithholdingTaxSelector
                                                                value={d.withholdingTaxId}
                                                                initialTax={c.withholdingTax}
                                                                onSelect={(val) => setDrafts(prev => ({ ...prev, [c.providerNit]: { ...d, withholdingTaxId: val } }))}
                                                            />
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            <div className="flex justify-center">
                                                                <div
                                                                    className={cn(
                                                                        "h-2.5 w-2.5 rounded-full ring-2 ring-white",
                                                                        isPending ? "bg-amber-400" : "bg-emerald-500"
                                                                    )}
                                                                    title={isPending ? "Pendiente" : "Completado"}
                                                                />
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleSave(c.providerNit)}
                                                                disabled={savingNit === c.providerNit}
                                                                title="Guardar"
                                                            >
                                                                {savingNit === c.providerNit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            <div className="flex items-center justify-between pt-4">
                                <p className="text-xs text-muted-foreground">
                                    Mostrando {configs.length} de {total} · Página {page} de {totalPages}
                                </p>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={!canPrev}
                                        onClick={() => {
                                            const p = Math.max(1, page - 1);
                                            setPage(p);
                                            loadConfigs(search, p);
                                        }}
                                    >
                                        Anterior
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={!canNext}
                                        onClick={() => {
                                            const p = page + 1;
                                            setPage(p);
                                            loadConfigs(search, p);
                                        }}
                                    >
                                        Siguiente
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function CostCentersSection() {
    const [costCenters, setCostCenters] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [search, setSearch] = useState("");

    useEffect(() => {
        loadCostCenters();
    }, []);

    const loadCostCenters = async (query?: string) => {
        setLoading(true);
        const res = await getCostCenters(query);
        if (res.success && res.data) {
            setCostCenters(res.data);
        }
        setLoading(false);
    };

    const handleSync = async () => {
        setSyncing(true);
        const res = await syncSiigoCostCenters();
        setSyncing(false);
        if (res.success) {
            toast.success(`Se sincronizaron ${res.count} centros de costo.`);
            loadCostCenters();
        } else {
            toast.error(res.error);
        }
    };

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearch(e.target.value);
        loadCostCenters(e.target.value);
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Centros de Costo</h2>
                <p className="text-muted-foreground">Gestiona los centros de costo sincronizados con Siigo.</p>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Centros de Costo Sincronizados</CardTitle>
                            <CardDescription>Lista de centros de costo disponibles.</CardDescription>
                        </div>
                        <Button onClick={handleSync} disabled={syncing}>
                            {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                            Sincronizar desde Siigo
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="relative mb-4">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar centro de costo..."
                            className="pl-8"
                            value={search}
                            onChange={handleSearch}
                        />
                    </div>
                    {loading ? (
                        <LoadingSection />
                    ) : (
                        <div className="rounded-md border bg-white overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Código</TableHead>
                                        <TableHead>Nombre</TableHead>
                                        <TableHead>Estado</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {costCenters.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center py-8 text-gray-500">No hay centros de costo sincronizados. Haz clic en Sincronizar.</TableCell>
                                        </TableRow>
                                    ) : (
                                        costCenters.map((cc) => (
                                            <TableRow key={cc.id}>
                                                <TableCell className="font-medium">{cc.code}</TableCell>
                                                <TableCell>{cc.name}</TableCell>
                                                <TableCell>
                                                    <Badge variant={cc.active ? "outline" : "secondary"}>
                                                        {cc.active ? "Activo" : "Inactivo"}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function ProductsSection() {
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [search, setSearch] = useState("");

    useEffect(() => {
        loadProducts();
    }, []);

    const loadProducts = async (query?: string) => {
        setLoading(true);
        const res = await getProducts(query);
        if (res.success && res.data) {
            setProducts(res.data);
        }
        setLoading(false);
    };

    const handleSync = async () => {
        setSyncing(true);
        const res = await syncSiigoProducts();
        setSyncing(false);
        if (res.success) {
            toast.success(`Se sincronizaron ${res.count} productos.`);
            loadProducts();
        } else {
            toast.error(res.error);
        }
    };

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearch(e.target.value);
        loadProducts(e.target.value);
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Productos</h2>
                <p className="text-muted-foreground">Gestiona los productos sincronizados con Siigo.</p>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Productos Sincronizados</CardTitle>
                            <CardDescription>Lista de productos disponibles para facturas de compra.</CardDescription>
                        </div>
                        <Button onClick={handleSync} disabled={syncing}>
                            {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                            Sincronizar desde Siigo
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="relative mb-4">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar producto..."
                            className="pl-8"
                            value={search}
                            onChange={handleSearch}
                        />
                    </div>
                    {loading ? (
                        <LoadingSection />
                    ) : (
                        <div className="rounded-md border bg-white overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Código</TableHead>
                                        <TableHead>Nombre</TableHead>
                                        <TableHead>Descripción</TableHead>
                                        <TableHead>Estado</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {products.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-8 text-gray-500">No hay productos sincronizados. Haz clic en Sincronizar.</TableCell>
                                        </TableRow>
                                    ) : (
                                        products.map((p) => (
                                            <TableRow key={p.id}>
                                                <TableCell className="font-medium">{p.code}</TableCell>
                                                <TableCell>{p.name}</TableCell>
                                                <TableCell>{p.description || "-"}</TableCell>
                                                <TableCell>
                                                    <Badge variant={p.active ? "outline" : "secondary"}>
                                                        {p.active ? "Activo" : "Inactivo"}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function TaxesSection() {
    const [taxes, setTaxes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [search, setSearch] = useState("");

    useEffect(() => {
        loadTaxes();
    }, []);

    const loadTaxes = async (query?: string) => {
        setLoading(true);
        const res = await getTaxes(query);
        if (res.success && res.data) {
            setTaxes(res.data);
        }
        setLoading(false);
    };

    const handleSync = async () => {
        setSyncing(true);
        const res = await syncSiigoTaxes();
        setSyncing(false);
        if (res.success) {
            toast.success(`Se sincronizaron ${res.count} impuestos.`);
            loadTaxes();
        } else {
            toast.error(("error" in res && res.error) ? (res as any).error : "Error al sincronizar impuestos");
        }
    };

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearch(e.target.value);
        loadTaxes(e.target.value);
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Impuestos</h2>
                <p className="text-muted-foreground">Gestiona los impuestos sincronizados con Siigo.</p>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Impuestos Sincronizados</CardTitle>
                            <CardDescription>Lista de impuestos disponibles para facturas de compra.</CardDescription>
                        </div>
                        <Button onClick={handleSync} disabled={syncing}>
                            {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                            Sincronizar desde Siigo
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="relative mb-4">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar impuesto..."
                            className="pl-8"
                            value={search}
                            onChange={handleSearch}
                        />
                    </div>
                    {loading ? (
                        <LoadingSection />
                    ) : (
                        <div className="rounded-md border bg-white overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Nombre</TableHead>
                                        <TableHead>Tipo</TableHead>
                                        <TableHead>Tasa (%)</TableHead>
                                        <TableHead>Estado</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {taxes.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-8 text-gray-500">No hay impuestos sincronizados. Haz clic en Sincronizar.</TableCell>
                                        </TableRow>
                                    ) : (
                                        taxes.map((t) => (
                                            <TableRow key={t.id}>
                                                <TableCell className="font-medium">{t.name}</TableCell>
                                                <TableCell>{t.type || "-"}</TableCell>
                                                <TableCell>{t.rate ? `${t.rate}%` : "-"}</TableCell>
                                                <TableCell>
                                                    <Badge variant={t.active ? "outline" : "secondary"}>
                                                        {t.active ? "Activo" : "Inactivo"}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function PaymentTypesSection() {
    const [paymentTypes, setPaymentTypes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [search, setSearch] = useState("");

    useEffect(() => {
        loadPaymentTypes();
    }, []);

    const loadPaymentTypes = async (query?: string) => {
        setLoading(true);
        const res = await getPaymentTypes(query);
        if (res.success && res.data) {
            setPaymentTypes(res.data);
        }
        setLoading(false);
    };

    const handleSync = async () => {
        setSyncing(true);
        const res = await syncSiigoPaymentTypes();
        setSyncing(false);
        if (res.success) {
            toast.success(`Se sincronizaron ${res.count} formas de pago.`);
            loadPaymentTypes();
        } else {
            toast.error(("error" in res && res.error) ? (res as any).error : "Error al sincronizar formas de pago");
        }
    };

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearch(e.target.value);
        loadPaymentTypes(e.target.value);
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Formas de Pago</h2>
                <p className="text-muted-foreground">Gestiona las formas de pago sincronizadas con Siigo.</p>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Formas de Pago Sincronizadas</CardTitle>
                            <CardDescription>Lista de formas de pago disponibles para facturas de compra.</CardDescription>
                        </div>
                        <Button onClick={handleSync} disabled={syncing}>
                            {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                            Sincronizar desde Siigo
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="relative mb-4">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar forma de pago..."
                            className="pl-8"
                            value={search}
                            onChange={handleSearch}
                        />
                    </div>
                    {loading ? (
                        <LoadingSection />
                    ) : (
                        <div className="rounded-md border bg-white overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Nombre</TableHead>
                                        <TableHead>Estado</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paymentTypes.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={2} className="text-center py-8 text-gray-500">No hay formas de pago sincronizadas. Haz clic en Sincronizar.</TableCell>
                                        </TableRow>
                                    ) : (
                                        paymentTypes.map((pt) => (
                                            <TableRow key={pt.id}>
                                                <TableCell className="font-medium">{pt.name}</TableCell>
                                                <TableCell>
                                                    <Badge variant={pt.active ? "outline" : "secondary"}>
                                                        {pt.active ? "Activo" : "Inactivo"}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function CurrenciesSection() {
    const [currencies, setCurrencies] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [search, setSearch] = useState("");

    useEffect(() => {
        loadCurrencies();
    }, []);

    const loadCurrencies = async (query?: string) => {
        setLoading(true);
        const res = await getCurrencies(query);
        if (res.success && res.data) {
            setCurrencies(res.data);
        }
        setLoading(false);
    };

    const handleSync = async () => {
        setSyncing(true);
        const res = await syncSiigoCurrencies();
        setSyncing(false);
        if (res.success) {
            toast.success(`Se sincronizaron ${res.count} monedas.`);
            loadCurrencies();
        } else {
            toast.error(("error" in res && (res as any).error) ? (res as any).error : "Error al sincronizar monedas");
        }
    };

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearch(e.target.value);
        loadCurrencies(e.target.value);
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Monedas</h2>
                <p className="text-muted-foreground">Gestiona las monedas sincronizadas con Siigo.</p>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Monedas Sincronizadas</CardTitle>
                            <CardDescription>Lista de monedas disponibles para facturas de compra.</CardDescription>
                        </div>
                        <Button onClick={handleSync} disabled={syncing}>
                            {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                            Sincronizar desde Siigo
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="relative mb-4">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar moneda..."
                            className="pl-8"
                            value={search}
                            onChange={handleSearch}
                        />
                    </div>
                    {loading ? (
                        <LoadingSection />
                    ) : (
                        <div className="rounded-md border bg-white overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Código</TableHead>
                                        <TableHead>Nombre</TableHead>
                                        <TableHead>Símbolo</TableHead>
                                        <TableHead>Estado</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {currencies.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-8 text-gray-500">No hay monedas sincronizadas. Haz clic en Sincronizar.</TableCell>
                                        </TableRow>
                                    ) : (
                                        currencies.map((c) => (
                                            <TableRow key={c.id}>
                                                <TableCell className="font-medium">{c.code}</TableCell>
                                                <TableCell>{c.name}</TableCell>
                                                <TableCell>{c.symbol || "-"}</TableCell>
                                                <TableCell>
                                                    <Badge variant={c.active ? "outline" : "secondary"}>
                                                        {c.active ? "Activo" : "Inactivo"}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
