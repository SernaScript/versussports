"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Upload, Plus, Trash2, Search, Check, Save, FileText, Landmark, RefreshCw, Settings2 } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
    upsertSiigoAccounts,
    getSiigoAccounts,
    getSiigoSettings,
    saveSiigoSettings,
    getBankExpenseConcepts,
    createBankExpenseConcept,
    deleteBankExpenseConcept,
    getDocumentTypes,
    syncSiigoDocumentTypes
} from "../actions/ajustes";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { LoadingSection } from "@/components/ui/loading-section";
import { cn } from "@/lib/utils";

// --- Main Layout ---

export default function AjustesPage() {
    const [activeSection, setActiveSection] = useState<"general" | "vouchers" | "accounts" | "concepts">("vouchers");

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
            </aside>

            {/* Content Range */}
            <main className="flex-1 p-8 overflow-auto">
                {activeSection === "vouchers" && <VouchersSection />}
                {activeSection === "accounts" && <AccountsSection />}
                {activeSection === "concepts" && <ConceptsSection />}
                {activeSection === "general" && <GeneralSettingsSection />}
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
            toast.error(res.error);
        }
    };

    return (
        <div className="space-y-6 max-w-4xl">
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
                        <div className="rounded-md border bg-white overflow-hidden">
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
        <div className="space-y-6 max-w-5xl">
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
                        <div className="rounded-md border bg-white overflow-hidden">
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
        <div className="space-y-6 max-w-4xl">
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

    useEffect(() => {
        loadSettings();
    }, []);

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
        <div className="space-y-6 max-w-4xl">
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
                            <div className="space-y-2">
                                <Label>NIT del Banco / Tercero</Label>
                                <Input
                                    value={settings.bankNit || ""}
                                    onChange={(e) => setSettings({ ...settings, bankNit: e.target.value })}
                                    placeholder="Ej. 890900900"
                                />
                            </div>
                            <Button type="submit" className="w-full">
                                <Save className="mr-2 h-4 w-4" /> Guardar Configuración
                            </Button>
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
            <PopoverContent className="w-[400px] p-0">
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
