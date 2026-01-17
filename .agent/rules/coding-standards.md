# Coding Standards & Best Practices - Versus Sports

## 1. Context and Purpose
The goal of these standards is to maintain a clean, consistent, and professional codebase that facilitates long-term collaboration and maintenance.

**Why these rules?**
- **English Code**: Industry standard. Facilitates library integration, online troubleshooting, and future international developer onboarding.
- **Spanish Routes**: The final product is for Spanish-speaking users. Spanish URLs improve User Experience (UX) and SEO for the target market.
- **Strict TypeScript**: Prevents runtime errors and automatically documents the code.

## 2. Language Conventions

| Element | Language | Example |
|---|---|---|
| **Source Code** (Variables, Functions, Comments) | **English** | `const calculateTotal = () => {}` |
| **Database Models** (Prisma, Interfaces) | **English** | `model User { id Int ... }` |
| **Routes (URLs)** | **Spanish** | `versussports.com/equipos` |
| **UI Content** (Text, Buttons) | **Spanish** | `<button>Guardar Cambios</button>` |

## 3. Naming Conventions

### 3.1 Functions and Variables (camelCase - English)
Must be descriptive and use verbs for actions.
```typescript
// ✅ Correct
const fetchPlayerStats = (playerId: string) => { ... }
const isVisible = true;

// ❌ Incorrect
const obtenerDatos = () => { ... } // Not English
const val = 5; // Not descriptive
```

### 3.2 Components and Interfaces (PascalCase - English)
```typescript
// ✅ Correct
interface UserCardProps {
  name: string;
}

export const UserCard = ({ name }: UserCardProps) => { ... }
```

### 3.3 Files and Folders (kebab-case or PascalCase depending on type)
- **Components**: `UserCard.tsx`
- **Utilities/Hooks**: `use-auth.ts`, `format-date.ts`
- **Routes (Next.js App Router)**: Folders define the route, so they **MUST be in Spanish**.
  - `src/app/equipos/page.tsx` -> `/equipos`
  - `src/app/perfil/page.tsx` -> `/perfil`

## 4. React & TypeScript Best Practices

### 4.1 Strict Typing
Avoid using `any`. Always define interfaces or types for props and state.

```typescript
// ✅ Correct
interface Match {
  id: string;
  score: number;
}

// ❌ Incorrect
const Match = (data: any) => { ... }
```

### 4.2 Functional Components
Always use functional components and Hooks.

```typescript
export default function TeamList() {
  const [teams, setTeams] = useState<Team[]>([]);
  // ...
}
```

### 4.3 Clean Code
- **Single Responsibility Principle**: A component should do one thing. If it grows too large, split it into subcomponents.
- **DRY (Don't Repeat Yourself)**: Extract repeated logic into Custom Hooks or utility functions.

## 5. Route Structure vs. Code Structure
This is a critical hybrid point:
- The folder in `src/app` is named in **Spanish** (e.g., `src/app/configuracion`).
- The component inside (`page.tsx`) is named and programmed in **English**.

**Example:**
File: `src/app/configuracion/page.tsx`
```tsx
// The component is named SettingsPage (English)
export default function SettingsPage() {
  const handleSave = () => { ... } // Function in English
  
  return (
    <div>
      <h1>Configuración</h1> {/* UI Text in Spanish */}
    </div>
  )
}
```
