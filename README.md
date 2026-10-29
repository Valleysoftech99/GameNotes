# Notegame

PWA local-first para organizar objetos, objetivos y faltantes por juego.

## Requisitos

- Node.js 22.12 o superior (Node 24 LTS recomendado), con npm.

## Desarrollo local

En este workspace se preparó una copia portátil de Node 24.21.0 bajo `.tools/` (está excluida de Git). Para usarla en una terminal PowerShell:

```powershell
$env:PATH = "$PWD\.tools\node24\runtime\node-v24.21.0-win-x64;$env:PATH"
npm ci
npm run dev
```

En una instalación normal, instala Node 24 LTS y ejecuta `npm ci` y `npm run dev`. Vite muestra la dirección local (normalmente `http://localhost:5173`). Conserva `package-lock.json` para que las instalaciones y el workflow de Pages usen las mismas versiones.

## Comandos disponibles

- `npm run dev`: servidor local con recarga en caliente.
- `npm run typecheck`: comprueba tipos TypeScript.
- `npm run build`: comprueba tipos y genera la PWA estática en `dist/`.
- `npm run preview`: sirve localmente el build de producción.

## Publicación en GitHub Pages

El workflow `.github/workflows/deploy.yml` construye y publica al hacer push a `main` o manualmente desde Actions. Al crear el repositorio, habilita **Settings → Pages → Build and deployment → GitHub Actions**. El sitio usa la ruta base del repositorio en la compilación.

## Datos locales

El esquema inicial de IndexedDB vive en `src/data/database.ts`. Los datos permanecen en el navegador/dispositivo y no se sincronizan con un servidor. La exportación/restauración de respaldos todavía debe implementarse antes de usar datos importantes.
