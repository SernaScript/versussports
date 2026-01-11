"use client";

import { useState, useEffect } from "react";
import { Key, Save, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { createSiigoCredentials, getSiigoCredentials } from "../actions/siigo";

const formSchema = z.object({
    username: z.string().email("Debe ser un correo válido"),
    accessKey: z.string().min(1, "La llave de acceso es requerida"),
    partnerId: z.string().optional(),
});

export default function SiigoPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            username: "",
            accessKey: "",
            partnerId: "",
        },
    });

    useEffect(() => {
        async function load() {
            const res = await getSiigoCredentials();
            if (res.success && res.data) {
                form.reset({
                    username: res.data.username,
                    accessKey: res.data.accessKey,
                    partnerId: res.data.partnerId || "",
                });
            }
            setIsLoading(false);
        }
        load();
    }, [form]);

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setIsSaving(true);
        const formData = new FormData();
        formData.append("username", values.username);
        formData.append("accessKey", values.accessKey);
        if (values.partnerId) formData.append("partnerId", values.partnerId);

        try {
            await createSiigoCredentials(formData);
            alert("Credenciales guardadas correctamente");
        } catch (e) {
            alert("Error al guardar credenciales");
        } finally {
            setIsSaving(false);
        }
    }

    if (isLoading) {
        return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>
    }

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Integración Siigo</h1>
                <p className="text-muted-foreground">
                    Configure las credenciales de acceso a la API de Siigo.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Credenciales de API</CardTitle>
                    <CardDescription>
                        Estas credenciales son necesarias para sincronizar facturas y datos contables.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <FormField
                                control={form.control}
                                name="username"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Usuario (Correo Electrónico)</FormLabel>
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
                                        <FormLabel>Access Key (Llave)</FormLabel>
                                        <FormControl>
                                            <Input type="password" placeholder="••••••••••••••••" {...field} />
                                        </FormControl>
                                        <FormDescription>
                                            La llave generada desde el portal de Siigo.
                                        </FormDescription>
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
                                            <Input placeholder="Identificador del partner" {...field} />
                                        </FormControl>
                                        <FormDescription>
                                            Identificador de la aplicación integradora si aplica.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <Button type="submit" disabled={isSaving}>
                                {isSaving ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Guardando...
                                    </>
                                ) : (
                                    <>
                                        <Save className="mr-2 h-4 w-4" />
                                        Guardar Configuración
                                    </>
                                )}
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    );
}
