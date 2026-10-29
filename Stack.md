# Stack.md — stack adoptado

## Objetivo
Notegame es una PWA local-first, instalable en celulares y publicable como sitio estático en GitHub Pages. Guarda perfil y anotaciones estructuradas en IndexedDB; no requiere cuentas, backend ni sincronización automática.

## Stack

| Área | Tecnología | Uso |
|---|---|---|
| Lenguaje | TypeScript | Entidades y relaciones tipadas. |
| UI | React | Formularios y vistas del anotador. |
| Desarrollo/build | Vite | Servidor local, compilación y ruta base para GitHub Pages. |
| Persistencia | IndexedDB con Dexie | Registros locales y migraciones declarativas del esquema. |
| Validación | Zod | Schemas estrictos en escrituras y lectores de compatibilidad separados para datos heredados. |
| PWA | Manifiesto web + service worker nativo + plugin Vite del proyecto | Instalable y disponible sin conexión. El plugin genera la lista de precache a partir de archivos estáticos emitidos por el build. |
| Estilos | CSS con variables y CSS Modules cuando convenga | Tema oscuro, acentos glow, adaptación móvil y contraste legible. |
| Calidad | ESLint y Prettier (por incorporar) | Consistencia y detección de errores comunes. |
| Publicación | GitHub Actions y GitHub Pages | Build y publicación de los archivos estáticos. |

## Arquitectura de datos

- Mantener los cálculos del dominio fuera de React y no persistir valores derivados.
- Usar identificadores estables y validar referencias dentro de transacciones de repositorio.
- Limitar las lecturas y escrituras al `gameId` apropiado.
- Versionar IndexedDB y preservar registros que no pasen validación; reportarlos con errores genéricos y diagnóstico técnico sin mostrar sus valores.
- Importación/exportación de respaldos queda para su fase correspondiente y debe validar el archivo completo antes de modificar la base.

## PWA y caché

`public/manifest.webmanifest` define la identidad instalable. `src/pwa/sw.js` contiene el service worker nativo. El plugin local de `vite.config.ts` agrega al worker solo `index.html`, el manifiesto, el favicon y bundles estáticos emitidos por Vite; elimina cachés antiguas con el mismo prefijo. No intercepta escrituras ni guarda datos de usuario: esos datos viven en IndexedDB.

El `base` de Vite se fija con `VITE_BASE_PATH` durante GitHub Actions para que manifiesto, worker y archivos precacheados se resuelvan bajo el subdirectorio del repositorio.

## Sin backend

El alcance actual pide almacenamiento local y transferencia mediante un archivo de respaldo. Un backend introduciría cuentas, costos y tratamiento remoto sin una necesidad definida. Si luego se pide sincronización, habrá que diseñar autenticación, conflictos y protección del almacenamiento remoto como una decisión de alcance separada.
