# Coding Standards & Best Practices - Versus Sports

## 1. Contexto y Propósito
El objetivo de estos estándares es mantener una base de código limpia, consistente y profesional que facilite la colaboración y el mantenimiento a largo plazo. 

**¿Por qué estas reglas?**
- **Código en Inglés**: Es el estándar de la industria. Facilita la integración de librerías, la búsqueda de soluciones online y la incorporación de desarrolladores internacionales en el futuro.
- **Rutas en Español**: El producto final está dirigido a usuarios hispanohablantes. Las URLs en español mejoran la experiencia del usuario (UX) y el posicionamiento en buscadores (SEO) para el mercado objetivo.
- **TypeScript Strict**: Previene errores en tiempo de ejecución y documenta el código automáticamente.

## 2. Convenciones de Idioma

| Elemento | Idioma | Ejemplo |
|----------|--------|---------|
| **Código Fuente** (Variables, Funciones, Comentarios) | **Inglés** | `const calculateTotal = () => {}` |
| **Modelos de Base de Datos** (Prisma, Interfaces) | **Inglés** | `model User { id Int ... }` |
| **Rutas (URLs)** | **Español** | `versussports.com/equipos` |
| **Contenido de UI** (Textos, Botones) | **Español** | `<button>Guardar Cambios</button>` |

## 3. Naming Conventions

### 3.1 Funciones y Variables (camelCase - English)
Deben ser descriptivas y usar verbos para acciones.
```typescript
// ✅ Correcto
const fetchPlayerStats = (playerId: string) => { ... }
const isVisible = true;

// ❌ Incorrecto
const obtenerDatos = () => { ... } // No español
const val = 5; // Poco descriptivo
```

### 3.2 Componentes e Interfaces (PascalCase - English)
```typescript
// ✅ Correcto
interface UserCardProps {
  name: string;
}

export const UserCard = ({ name }: UserCardProps) => { ... }
```

### 3.3 Archivos y Carpetas (kebab-case o PascalCase según tipo)
- **Componentes**: `UserCard.tsx`
- **Utilidades/Hooks**: `use-auth.ts`, `format-date.ts`
- **Rutas (Next.js App Router)**: Las carpetas definen la ruta, por lo tanto **deben ser en español**.
  - `src/app/equipos/page.tsx` -> `/equipos`
  - `src/app/perfil/page.tsx` -> `/perfil`

## 4. React & TypeScript Best Practices

### 4.1 Tipado Estricto
Evitar el uso de `any`. Definir siempre interfaces o tipos para props y estados.

```typescript
// ✅ Correcto
interface Match {
  id: string;
  score: number;
}

// ❌ Incorrecto
const Match = (data: any) => { ... }
```

### 4.2 Componentes Funcionales
Usar siempre componentes funcionales y Hooks.

```typescript
export default function TeamList() {
  const [teams, setTeams] = useState<Team[]>([]);
  // ...
}
```

### 4.3 Clean Code
- **Principio de Responsabilidad Única**: Un componente debe hacer una sola cosa. Si crece mucho, dividirlo en subcomponentes.
- **DRY (Don't Repeat Yourself)**: Extraer lógica repetida a Custom Hooks o funciones de utilidad.

## 5. Estructura de Rutas vs. Código
Este es un punto crítico de híbrido:
- La carpeta en `src/app` se llama en **Español** (ej: `src/app/configuracion`).
- El componente dentro (`page.tsx`) se llama y programa en **Inglés**.

**Ejemplo:**
Archivo: `src/app/configuracion/page.tsx`
```tsx
// El componente se llama SettingsPage (Inglés)
export default function SettingsPage() {
  const handleSave = () => { ... } // Función en Inglés
  
  return (
    <div>
      <h1>Configuración</h1> {/* Texto UI en Español */}
    </div>
  )
}
```
