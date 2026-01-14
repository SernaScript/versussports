
import { Loader2 } from "lucide-react";

export function LoadingSection() {
    return (
        <div className="flex h-full min-h-[50vh] w-full flex-col items-center justify-center gap-4 bg-background/50 p-8 backdrop-blur-sm">
            <div className="relative flex items-center justify-center">
                {/* Outer pulsing ring */}
                <div className="absolute h-16 w-16 animate-ping rounded-full bg-primary/20 opacity-75"></div>
                {/* Inner spinning loader */}
                <Loader2 className="relative h-12 w-12 animate-spin text-primary transition-all duration-500" />
            </div>
            <div className="flex flex-col items-center gap-1">
                <h3 className="text-lg font-semibold tracking-tight text-foreground animate-pulse">
                    Cargando
                </h3>
                <p className="text-xs text-muted-foreground">
                    Por favor espere un momento...
                </p>
            </div>
        </div>
    );
}
