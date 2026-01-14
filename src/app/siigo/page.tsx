"use client";

import { useState, useEffect } from "react";
import { Key, Plus, CheckCircle2, AlertCircle, Edit2, ShieldCheck, Trash2, Wifi, WifiOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { getSiigoCredential, saveSiigoCredential, deleteSiigoCredential, testSiigoConnection } from "../actions/siigo";
import { Toaster, toast } from "sonner";
import { cn } from "@/lib/utils";
import { LoadingSection } from "@/components/ui/loading-section";

const credentialSchema = z.object({
    username: z.string().email("Debe ser un correo electrónico válido"),
    accessKey: z.string().min(10, "La clave de acceso es demasiado corta"),
    partnerId: z.string().optional(),
});

type CredentialFormValues = z.infer<typeof credentialSchema>;

export default function SiigoPage() {
    const [credential, setCredential] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [testPassed, setTestPassed] = useState(false);

    const form = useForm<CredentialFormValues>({
        resolver: zodResolver(credentialSchema),
        defaultValues: {
            username: "",
            accessKey: "",
            partnerId: "",
        },
    });

    // Reset test state when form values change
    const watchedValues = form.watch();
    useEffect(() => {
        setTestPassed(false);
    }, [watchedValues.username, watchedValues.accessKey]);

    useEffect(() => {
        loadCredential();
    }, []);

    const loadCredential = async () => {
        setLoading(true);
        const res = await getSiigoCredential();
        if (res.success && res.data) {
            setCredential(res.data);
            form.reset({
                username: res.data.username,
                accessKey: res.data.accessKey,
                partnerId: res.data.partnerId || "",
            });
        } else {
            setCredential(null);
            form.reset({
                username: "",
                accessKey: "",
                partnerId: "",
            });
        }
        setLoading(false);
    };

    const handleTestConnection = async () => {
        const values = form.getValues();
        if (!values.username || !values.accessKey) {
            toast.error("Por favor ingrese usuario y clave de acceso para probar");
            return;
        }

        setIsTesting(true);
        const res = await testSiigoConnection({
            username: values.username,
            accessKey: values.accessKey,
            partnerId: values.partnerId
        });
        setIsTesting(false);

        if (res.success) {
            setTestPassed(true);
            toast.success("¡Conexión exitosa!", {
                description: "Las credenciales son válidas y el sistema puede comunicarse con Siigo.",
                icon: <Wifi className="h-5 w-5 text-green-500" />,
            });
        } else {
            setTestPassed(false);
            toast.error("Error de conexión", {
                description: res.error || "No se pudo validar la conexión con las credenciales proporcionadas.",
                icon: <WifiOff className="h-5 w-5 text-red-500" />,
            });
        }
    };

    const onSubmit = async (values: CredentialFormValues) => {
        if (!testPassed) {
            toast.warning("Prueba de conexión requerida", {
                description: "Debe realizar una prueba de conexión exitosa antes de guardar.",
            });
            return;
        }

        setIsSaving(true);
        const res = await saveSiigoCredential(values);
        setIsSaving(false);

        if (res.success) {
            setIsDialogOpen(false);
            loadCredential();
            toast.success("Configuración guardada", {
                description: "La conexión con Siigo se ha establecido correctamente.",
            });
        } else {
            toast.error("Error al guardar", {
                description: res.error || "Ocurrió un problema al intentar guardar la configuración.",
            });
        }
    };

    const handleDelete = async () => {
        const res = await deleteSiigoCredential();
        if (res.success) {
            loadCredential();
            toast.success("Conexión eliminada", {
                description: "Se ha removido la conexión con Siigo.",
            });
        } else {
            toast.error("Error al eliminar", {
                description: res.error || "No se pudo eliminar la credencial.",
            });
        }
    };

    if (loading) {
        return <LoadingSection />;
    }

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-8">
            <Toaster position="top-right" richColors closeButton />

            <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">Configuración de Siigo</h1>
                <p className="text-muted-foreground">
                    Gestione su conexión con la API de Siigo para la sincronización de datos.
                </p>
            </div>

            <div className="grid gap-6">
                {!credential ? (
                    <Card className="border-dashed flex flex-col items-center justify-center py-12 px-6 text-center">
                        <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                            <Key className="h-8 w-8 text-slate-400" />
                        </div>
                        <CardTitle className="text-xl mb-2">No hay conexión activa</CardTitle>
                        <CardDescription className="max-w-md mb-6">
                            Para comenzar a sincronizar sus facturas y ajustes con Siigo, primero debe configurar su clave de acceso.
                        </CardDescription>

                        <Dialog open={isDialogOpen} onOpenChange={(open) => {
                            setIsDialogOpen(open);
                            if (!open) {
                                setTestPassed(false);
                                if (!credential) form.reset();
                            }
                        }}>
                            <DialogTrigger asChild>
                                <Button size="lg" className="px-8">
                                    <Plus className="mr-2 h-5 w-5" />
                                    Agregar Credencial
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[450px]">
                                <DialogHeader>
                                    <DialogTitle>Configurar Conexión Siigo</DialogTitle>
                                    <DialogDescription>
                                        Ingrese sus credenciales de API. Se requiere una prueba de conexión exitosa antes de guardar.
                                    </DialogDescription>
                                </DialogHeader>
                                <Form {...form}>
                                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                                        <FormField
                                            control={form.control}
                                            name="username"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Usuario de API (Email)</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="usuario@empresa.com" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="accessKey"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Clave de Acceso (Access Key)</FormLabel>
                                                    <FormControl>
                                                        <Input type="password" placeholder="••••••••••••••••" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="partnerId"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Partner ID (Opcional)</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="Ingrese si tiene un Partner ID" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <div className="pt-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className={cn(
                                                    "w-full border-2",
                                                    testPassed ? "border-green-500 bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800" : "border-slate-200"
                                                )}
                                                onClick={handleTestConnection}
                                                disabled={isTesting}
                                            >
                                                {isTesting ? (
                                                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Probando...</>
                                                ) : testPassed ? (
                                                    <><CheckCircle2 className="mr-2 h-4 w-4" /> Conexión Validada</>
                                                ) : (
                                                    <><Wifi className="mr-2 h-4 w-4" /> Probar Conexión</>
                                                )}
                                            </Button>
                                        </div>

                                        <DialogFooter className="pt-4">
                                            <Button
                                                type="submit"
                                                disabled={isSaving || !testPassed}
                                                className="w-full"
                                            >
                                                {isSaving ? "Guardando..." : "Conectar Sistema"}
                                            </Button>
                                        </DialogFooter>
                                    </form>
                                </Form>
                            </DialogContent>
                        </Dialog>
                    </Card>
                ) : (
                    <Card className="overflow-hidden border-2 border-green-100 bg-green-50/20">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
                            <div className="space-y-1">
                                <CardTitle className="flex items-center gap-2 text-2xl text-green-700">
                                    <ShieldCheck className="h-7 w-7" />
                                    Conexión Activa
                                </CardTitle>
                                <CardDescription className="text-green-600/80 font-medium">
                                    El sistema está vinculado correctamente con Siigo API V1.
                                </CardDescription>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="bg-green-100 text-green-700 border-green-200 hover:bg-green-200"
                                    onClick={async () => {
                                        setIsTesting(true);
                                        const res = await testSiigoConnection({
                                            username: credential.username,
                                            accessKey: credential.accessKey,
                                            partnerId: credential.partnerId
                                        });
                                        setIsTesting(false);
                                        if (res.success) {
                                            toast.success("Conexión activa y funcionando", {
                                                icon: <Wifi className="h-5 w-5 text-green-500" />,
                                            });
                                        } else {
                                            toast.error("La conexión ha fallado", {
                                                description: res.error,
                                                icon: <WifiOff className="h-5 w-5 text-red-500" />,
                                            });
                                        }
                                    }}
                                    disabled={isTesting}
                                >
                                    {isTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Wifi className="h-3.5 w-3.5 mr-1.5" />}
                                    Test rápido
                                </Button>
                                <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200 px-3 py-1 text-sm">
                                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                                    Estado: OK
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-1">
                                    <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Usuario Vinculado</p>
                                    <p className="text-lg font-medium text-slate-900">{credential.username}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Partner ID</p>
                                    <p className="text-lg font-medium text-slate-900">{credential.partnerId || "No configurado"}</p>
                                </div>
                                <div className="space-y-1 col-span-full">
                                    <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Clave de Acceso</p>
                                    <p className="text-lg font-mono text-slate-900">••••••••••••••••••••••••••••••••</p>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="bg-white border-t p-6 flex justify-between">
                            <Button variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={handleDelete}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Eliminar Conexión
                            </Button>

                            <Dialog open={isDialogOpen} onOpenChange={(open) => {
                                setIsDialogOpen(open);
                                if (!open) setTestPassed(false);
                            }}>
                                <DialogTrigger asChild>
                                    <Button variant="outline" className="border-slate-300">
                                        <Edit2 className="mr-2 h-4 w-4" />
                                        Editar Configuración
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-[450px]">
                                    <DialogHeader>
                                        <DialogTitle>Editar Conexión Siigo</DialogTitle>
                                        <DialogDescription>
                                            Actualice sus credenciales. Debe validar la conexión antes de guardar.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <Form {...form}>
                                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                                            <FormField
                                                control={form.control}
                                                name="username"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Usuario de API (Email)</FormLabel>
                                                        <FormControl>
                                                            <Input placeholder="usuario@empresa.com" {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="accessKey"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Clave de Acceso (Access Key)</FormLabel>
                                                        <FormControl>
                                                            <Input type="password" placeholder="••••••••••••••••" {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="partnerId"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Partner ID (Opcional)</FormLabel>
                                                        <FormControl>
                                                            <Input placeholder="Ingrese si tiene un Partner ID" {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            <div className="pt-2">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    className={cn(
                                                        "w-full border-2",
                                                        testPassed ? "border-green-500 bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800" : "border-slate-200"
                                                    )}
                                                    onClick={handleTestConnection}
                                                    disabled={isTesting}
                                                >
                                                    {isTesting ? (
                                                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Probando...</>
                                                    ) : testPassed ? (
                                                        <><CheckCircle2 className="mr-2 h-4 w-4" /> Conexión Validada</>
                                                    ) : (
                                                        <><Wifi className="mr-2 h-4 w-4" /> Probar Conexión</>
                                                    )}
                                                </Button>
                                            </div>

                                            <DialogFooter className="pt-4">
                                                <Button
                                                    type="submit"
                                                    disabled={isSaving || !testPassed}
                                                    className="w-full"
                                                >
                                                    {isSaving ? "Actualizando..." : "Guardar Cambios"}
                                                </Button>
                                            </DialogFooter>
                                        </form>
                                    </Form>
                                </DialogContent>
                            </Dialog>
                        </CardFooter>
                    </Card>
                )}
            </div>

            <div className="bg-slate-50 border rounded-lg p-6 space-y-4">
                <div className="flex items-center gap-2 font-semibold text-slate-800">
                    <AlertCircle className="h-5 w-5 text-blue-500" />
                    Información Importante
                </div>
                <div className="text-sm text-slate-600 space-y-3">
                    <p>Para garantizar la integridad de la sincronización, el sistema valida las credenciales en tiempo real:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>El botón <strong>Guardar</strong> solo se habilitará tras una prueba de conexión exitosa.</li>
                        <li>Si cambia el usuario o la clave, deberá realizar una nueva prueba.</li>
                        <li>Las peticiones se realizan de forma segura al endpoint oficial: <code>api.siigo.com/v1/auth</code>.</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
