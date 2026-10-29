# Implementationplan.md — plan de ataque

## Objetivo
Construir Notegame como una PWA local-first para registrar perfil, juegos, objetos, objetivos, requisitos y recordatorios; consultar avance y faltantes; y respaldar/restaurar datos entre dispositivos.

## Estado del proyecto
- Scaffold React + TypeScript + Vite, PWA y esquema Dexie en `src/data/database.ts`.
- Fases 0–12 están completadas localmente en el workspace. La publicación en GitHub Pages está diferida explícitamente por el usuario; no se creó repositorio, no se subieron cambios ni se desplegó.
- **Fase 0 local completada parcialmente:** Node.js 24.21.0 portátil quedó en `.tools/` (ignorado por Git); `package-lock.json` existe; `npm ci --offline` y `npm run build` terminaron bien.
- El lote de seguridad de las Fases 0–2 fue remediado: se retiró `vite-plugin-pwa` y su cadena vulnerable, se endurecieron los schemas y lectores legacy, y se añadieron repositorios con validación referencial. La auditoría online final de Coordinator reportó cero vulnerabilidades en todas las severidades. GitHub Pages se pospone hasta terminar la app; el workspace aún no tiene `.git` y el remoto todavía no existe.

## Decisiones de producto
Confirmadas por el usuario para la Fase 1 (2026-10-28):

- **Sin reserva de stock en el MVP:** cada objetivo calcula su avance con el stock actual del objeto; el agregado suma la demanda y descuenta el stock una vez.
- **Progreso simple:** porcentaje del objetivo = promedio simple de sus requisitos directos; las condiciones cuentan 0%/100%; un objetivo sin requisitos usa el check de recordatorio.

Confirmación adicional del usuario para la Fase 2 (2026-10-28): mostrar «Mis juegos» incluso con un único juego, para invitar a agregar más.

## Fases

### 0. Entorno reproducible — completada en local; publicación diferida
- Node.js 24.21.0 y npm disponibles de forma portátil dentro de `.tools/`; ese directorio se excluye de Git.
- `package-lock.json` generado; `npm ci --offline` completado.
- `npm run build` completado correctamente con TypeScript, Vite y generación del service worker.
- Workflow usa `npm ci`; README documenta los pasos de desarrollo.
- **Diferido por decisión del usuario:** crear/vincular GitHub, configurar Pages y publicar después de completar la aplicación.
- El lote de seguridad de Fases 0–2 se cerró al finalizar Fase 2; Secure lo reauditó y Coordinator confirmó `npm audit` online con cero advisories.

### 1. Dominio y persistencia local — completada
Definir y validar perfil, juegos, objetos, objetivos, condiciones y requisitos; implementar cálculos puros para progreso, agregado por objeto y faltantes; versionar tablas e índices Dexie. La política sin reserva y el promedio simple ya fueron confirmados.

**Estado:** Implementer entregó schemas Zod, migración Dexie v1→v2 y funciones de progreso/agregado. Typecheck y build terminaron correctamente usando el Node portátil. Secure completó la auditoría de fase y registró hallazgos bajos, agrupados para el cierre de Fase 2.

**Criterio de salida:** los cálculos siguen las reglas confirmadas, los valores derivados no se persisten, y los hallazgos de fase están documentados con remediación planificada.

### 2. Perfil y navegación de juegos — completada
Crear perfil local; implementar lista, alta, edición, selección y entrada al espacio de cada juego. Conservar «Mis juegos» aun con un solo juego, según lo confirmado por el usuario.

**Estado:** perfil local y lista persistente, alta/edición y entrada a cada juego implementadas. Se conserva «Mis juegos» también con un único juego. Typecheck/build pasan. El lote de seguridad de Fases 0–2 fue revisado por Secure/Coordinator; audit reportó cero advisories.

**Criterio de salida:** perfil y juegos persisten al recargar y nunca se mezclan. Cumplido.

### 3. Captura de objetos, objetivos y requisitos
Implementar alta, edición y consulta de objetos, objetivos, sub-objetivos, recordatorios y requisitos materiales/no materiales; actualizar stock, ubicaciones y notas con validación.

**Estado:** implementada captura, edición y consulta local de objetos, objetivos/subobjetivos, recordatorios y requisitos materiales/condición dentro del espacio de juego. Las escrituras pasan por los repositorios, que validan schemas y referencias; no hay borrado. Se muestran progreso de objetivos y faltantes agregados por objeto, sin reservas. Typecheck/build pasan; no se ejecutaron pruebas.

**Criterio de salida:** objeto único por juego reutilizable en varios objetivos; recordatorios binarios; cambios de stock reflejados en cálculos asociados. Cumplido.

### 4. Vistas de consulta
Implementar vistas de objetivos/progreso, agregado por objeto, faltantes agrupados por lugar y árbol de dependencias; permitir navegación cruzada entre requisitos, objetos y objetivos.

**Estado:** completadas las vistas de progreso por objetivo, agregado por objeto con demanda total y desglose por objetivo, faltantes agrupados por ubicación y árbol de objetivos/subobjetivos. Los recordatorios y condiciones pendientes aparecen en faltantes; requisitos enlazan a objetos, desglose de objetos enlaza a objetivos y las vistas usan los datos aislados del juego actual y los cálculos existentes. La lectura de requisitos inválidos ahora queda aislada por fila y por juego: no altera esas filas, muestra las válidas e informa cuántos requisitos no pudo leer. Typecheck/build pasan; no se ejecutaron pruebas.

**Criterio de salida:** todas las vistas provienen de los mismos datos y se actualizan al editar. Cumplido. Al cerrar esta fase, corregir en lote vulnerabilidades acumuladas de fases 3–4 y solicitar reauditoría de Secure.

### 5. Respaldo y recuperación
Exportar archivo versionado e importar solo tras validar el documento completo. Si se confirma reemplazo, mostrar resumen y pedir confirmación; los errores no deben producir cambios parciales.

**Estado:** exportación JSON versionada (`notegame-backup`, versión 1) e importación implementadas para perfil, juegos, objetos, objetivos y requisitos. El archivo se valida completo antes de escribir: formato/versión, límite de 5 MB y 20 000 registros, schemas, IDs únicos por entidad, nombres de objetos sin duplicados normalizados por juego, relaciones y ciclos. Reemplazo y combinación muestran un resumen y requieren confirmación; la escritura se ejecuta en una sola transacción. Typecheck/build pasan; no se ejecutaron pruebas.

**Semántica elegida para el MVP (decisión de implementación; no atribuida al usuario):** reemplazar sustituye todas las tablas locales por el respaldo y avisa antes de confirmar; combinar es aditivo, mantiene registros locales cuando hay IDs duplicados, agrega los registros compatibles sin conflicto y omite objetos con nombre normalizado duplicado y sus requisitos dependientes si no queda una referencia válida. Un juego entrante con ID ya presente se considera el mismo juego local: sus elementos agregados se integran en ese juego. El resumen detalla altas y omisiones por entidad. La transacción evita escrituras parciales.

**Criterio de salida:** transferencia entre dispositivos y restauración validada con políticas de reemplazo/combinar explícitas. Cumplido.

### 6. Acabado PWA local — completada
Completar manifest/íconos y experiencia móvil; revisar accesibilidad, instalación, offline y caché sin publicar.

**Estado:** agregados íconos PNG de 180/192/512 px y metadatos instalables para Android/iOS; manifest y precache usan rutas bajo `BASE_URL`; el service worker precachea solo el shell y recursos estáticos de build. Las actualizaciones esperan el cierre de pestañas antiguas antes de activar el nuevo caché, evitando quitar recursos a una sesión abierta; la UI avisa accesiblemente cuando una versión espera y explica que se cierren todas las pestañas de Notegame y se vuelva a abrir. El estado waiting persiste en `window` para que React no pierda avisos tempranos; listeners se limpian en `pagehide`, se reinstalan en `pageshow`/BFCache sin duplicarse, y `controllerchange` resincroniza el estado. Se añadieron foco visible, estado accesible de navegación, colores de texto de botón con mejor contraste y respeto a `prefers-reduced-motion`. Typecheck/build pasan con base raíz y `/notegame/`; no se ejecutaron pruebas.

**Criterio de salida local:** shell instalable y offline con rutas compatibles con subdirectorio, además de acabado móvil/accesible. Cumplido. Secure auditará los cambios acumulados de Fases 5–6.

### Publicación en GitHub Pages — diferida explícitamente por el usuario
La creación/vinculación del repositorio, publicación de cambios, configuración de Pages y despliegue quedan pospuestos para que el usuario los realice más adelante. No se efectuaron operaciones remotas.

## Flujo de agentes y seguridad

1. **Coordinator** acota cada fase y prepara criterios de aceptación.
2. **Implementer** implementa el alcance autorizado y reporta cambios y comprobaciones reales.
3. **Secure** audita el cambio tras cada fase y detalla en `Security.md` hallazgos observados, riesgos pendientes por fase, evidencia y límites.
4. **Coordinator** prioriza correcciones. Por decisión del usuario, los hallazgos normales se corrigen en lotes al terminar cada dos fases (cierres 2, 4 y 6). Hallazgos **Críticos o Altos** se corrigen en cuanto aparecen, sin esperar el cierre del lote.
5. Secure reaudita los arreglos antes de marcar hallazgos como cerrados.

## Próximo paso
Fases 0–12 están completadas en local. No se creó repositorio ni se subieron cambios; GitHub Pages permanece expresamente diferido hasta que el usuario decida publicar la app terminada.

## Nuevo plan de ataque — especificación `Improvements.md`

La especificación agrega una refactorización del modelo de objetivos/requisitos, configuración de RAWG, metadatos y carátulas en «Mis juegos», y traslado de respaldo/restauración al perfil. Este trabajo **todavía no está implementado**. No se harán cambios de datos hasta cerrar la Fase 7 y acordar los puntos bloqueantes.

### Fase 7. Reconciliar la especificación y cerrar decisiones — completada

Revisar `Improvements.md` junto a `App.md`, `AppStructure.md` y los modelos existentes. Resolver/documentar:

- **Subobjetivos:** decisión confirmada: aplanar objetivos y descartar solo `parentGoalId`; mantener cada objetivo y sus requisitos.
- **Requisitos:** decisión confirmada: conservar `goalId` y `kind` en el modelo, pero iniciar altas desde el objetivo con acciones separadas de material/condición.
- **Campo `objectDescription`:** decisión confirmada: guardar texto libre de objeto/acción dentro de cada objetivo, con cadena vacía para datos anteriores.
- **Clave RAWG:** decisión confirmada: guardar la clave localmente, excluirla de respaldos y avisar que no está cifrada. No se usa backend/proxy.
- **Restauración del perfil:** decisión confirmada: reemplazo conserva la clave local si el archivo trae perfil; si no trae perfil, se elimina el perfil local y su clave. La combinación conserva los datos de perfil locales ante conflicto.
- **RAWG API/CORS:** la prueba de conectividad se ofrece en perfil; el comportamiento real de CORS requiere una clave del usuario y no se pudo verificar en este cambio.

**Decisiones confirmadas por el usuario:** aplanar subobjetivos conservando `goalId`/`kind`; agregar texto de acción en cada objetivo; almacenar la clave RAWG localmente, excluirla de los respaldos y advertir que no está cifrada. Para restore, se conservará la clave existente del dispositivo como preferencia local, ya que el archivo no la transporta; se podrá borrar desde el perfil.

**Criterio de salida:** decisiones registradas en `Improvements.md` o aquí; el esquema objetivo/requisito y la política de claves/respaldos ya no admiten interpretaciones incompatibles.

Antes de activar llamadas reales, verificar la [documentación de RAWG](https://rawg.io/apidocs) y sus [términos de API](https://rawg.io/tos_api), incluidos atribución y uso previsto.

**Revisión inicial de fuentes (2026-10-28):** la documentación oficial requiere una clave en cada solicitud y enlazar/atribuir RAWG en páginas con sus datos/imágenes. Sus páginas oficiales no describen el plan gratuito exactamente igual: la documentación lo presenta como personal/no comercial, mientras los términos de API también describen uso comercial limitado. Confirmar las condiciones aplicables al proyecto antes de integrar o publicar; no asumir CORS sin comprobar la API desde la app publicada. [API docs](https://rawg.io/apidocs), [API terms](https://rawg.io/tos_api).

### Fase 8. Contrato de datos y migración — completada

Definir el nuevo modelo acordado, actualizar Zod, lectores legacy, repositorios y cálculos; preparar migración Dexie versionada. Ampliar el respaldo a versión 2 y admitir archivos versión 1 mediante conversión validada en memoria. Preservar las filas que no puedan migrarse y reportarlas, sin pérdida silenciosa.

**Criterio de salida:** migración repetible y no destructiva; registros v3 mantienen el contenido acordado; respaldo v1 se convierte o falla antes de escribir; importación v2 valida completamente y aplica transaccionalmente.

**Estado:** Dexie migra de versión 3 a 4. `goals` deja de indexar `parentGoalId`; el upgrade elimina únicamente ese campo, preserva todos los demás campos/requisitos y rellena `objectDescription` solo cuando falta o no es texto. El schema y el lector legacy son planos; agregan los campos RAWG opcionales al juego. La UI ya no ofrece árbol/subobjetivos; las altas de requisitos son contextuales por objetivo con acciones separadas de material/condición y conserva `goalId`/`kind`. Se añadieron backup schemas separados versión 2, exportación sin `rawgApiKey` e importación v1 a v2 en memoria, descartando parent links y asignando descripción vacía. Typecheck/build pasan; no se ejecutaron pruebas.

### Fase 9. Perfil, preferencias y ubicación de respaldos — completada

Añadir edición de perfil posterior al onboarding, configuración RAWG según la decisión de Fase 7, acción para probar/limpiar la clave y mover el panel de backup exclusivamente al perfil. Excluir credenciales de exportación y definir su tratamiento en restore. No mostrar la clave en texto por defecto ni incluirla en errores.

**Estado:** perfil permite guardar, cambiar y borrar `rawgApiKey` en un campo password, con advertencia explícita de almacenamiento local sin cifrado. El botón «Probar clave» hace una petición explícita a RAWG con timeout de 8 s, `cache: no-store` y mensajes genéricos sin imprimir clave/URL/respuesta. El respaldo quedó exclusivamente en perfil; restore recarga perfil/juegos y conserva la clave local al reemplazar un perfil, pero la elimina si el respaldo no trae perfil. Los esquemas de backup v1/v2 excluyen la clave estrictamente. CORS no se verificó con una clave real. Typecheck/build pasan; no se ejecutaron pruebas.

**Criterio de salida:** clave/prueba/guardado/borrado tienen estados claros; un error de red no altera perfil ni datos; importar y exportar siguen la política acordada; no quedan controles de backup en «Mis juegos». Cumplido.

### Fase 10. Cliente RAWG y búsqueda — depende de Fases 7–9

Implementar `rawgService` con `fetch`, timeout/cancelación, respuestas Zod y mensajes genéricos; búsquedas automáticas desde el formulario activo tras una pausa al escribir, con debounce/deduplicación y tratamiento de cuota/offline. No buscar al abrir la biblioteca ni registrar tokens, URLs con clave o respuestas completas. Validar hosts HTTPS de imágenes y evitar caché de imágenes remotas inicialmente.

**Criterio de salida:** búsqueda y consulta de detalle funcionan con clave válida; clave ausente, inválida, cuota agotada y desconexión muestran errores controlados; la app local sigue operativa; atribución/enlaces requeridos están presentes.

**Estado:** servicio `rawgService` con validación Zod, búsqueda automática con debounce y detalle bajo selección, timeout/cancelación, `cache: no-store`, límite de cuerpo y deduplicación en memoria. El término y la clave se transmiten mientras se completa el formulario activo; nunca al abrir la biblioteca. Atribución/enlace a RAWG visible. Build pasa; no se probaron llamadas reales/CORS/clave. Cumplida localmente con esas limitaciones.

### Fase 11. Selector RAWG al crear juegos y biblioteca — depende de Fase 10

Al agregar un juego, buscar coincidencias RAWG automáticamente a partir del nombre y permitir elegir una ficha con carátula, fecha/año, géneros, plataformas, desarrolladores, puntuación y descripción. Guardar metadatos validados en la ficha local, sin cambiar el nombre del juego sin consentimiento. Dar fallback para imágenes/datos ausentes y permitir refresco manual.

**Criterio de salida:** selección y desvinculación no alteran objetivos/objetos; juegos no vinculados mantienen todas las funciones; texto externo se representa como texto seguro; imágenes fallidas tienen fallback, atribución visible y comportamiento offline explicado.

**Estado:** implementado en el alta/edición del juego. Las sugerencias aparecen al escribir; la persona elige la ficha y guarda el juego local, luego la tarjeta muestra la información antes de entrar a las anotaciones. También se puede refrescar o desvincular. La biblioteca muestra carátula con fallback, año, géneros, plataformas, desarrolladores, Metacritic y descripción como texto React. Las imágenes requieren HTTPS y host exacto `media.rawg.io`; usan `referrerPolicy="no-referrer"`, carga diferida y fallback si fallan. Se conservaron datos legacy y backup v2 previos con hosts externos, pero esos covers se omiten al leer y no se cargan. Typecheck/build pasan; no hubo clave RAWG para validar el flujo remoto.

### Fase 12. Integración, lote de seguridad y aceptación — depende de Fases 8–11

Revisar migración, restauración v1/v2, privacidad de clave, solicitudes RAWG, URL de imágenes, límites de datos, atribución, accesibilidad y regresiones funcionales. Secure audita cada fase y los hallazgos normales se corrigen en lote al cerrar las Fases 8, 10 y 12; los altos/críticos se corrigen de inmediato. Ejecutar build/typecheck y validación manual de flujos al autorizar pruebas.

**Criterio de salida:** documentación funcional/modelos respaldos y código coinciden; no hay secretos en backups/logs/UI por defecto; el modo offline y los juegos sin RAWG siguen siendo utilizables. La publicación continúa fuera del alcance hasta autorización expresa del usuario.

**Estado:** revisión de integración y seguridad local completada. Reverificado el 2026-10-29: `npm run typecheck` y `npm run build` pasan; el preview de producción respondió HTTP 200 y entregó sus bundles JS/CSS con HTTP 200. Revisión estática cubrió schemas/migración/restores v1-v2, proyección de clave, solicitudes, contenido externo, host de imágenes, atribución y fallbacks; no se observaron secretos en backups, logs o representación HTML. La validación manual interactiva (perfil/juego/objetivos/backup) sigue pendiente porque el host de automatización de navegador expiró/no está disponible. CORS, cuota, clave real, instalación/offline de navegador y restore con IndexedDB real siguen sin validación dinámica.

### Dependencias y alcance

Secuencia: **7 (decisiones) → 8 (datos/migración) → 9 (perfil/backups) → 10 (servicio RAWG) → 11 (biblioteca) → 12 (integración/auditoría final)**. Las Fases 8–11 no deben iniciar cambios incompatibles mientras las preguntas de Fase 7 sigan abiertas. La integración no requiere nuevas dependencias de runtime en el MVP; `fetch`, `AbortController` y Zod ya están disponibles. Cualquier backend/proxy implica revisar el stack y obtener una decisión de alcance; no asumirlo.







### 2026-10-29 — Ajuste del flujo de alta a aclaración de producto
- **Alcance:** `src/RawgGamePicker.tsx`, `src/App.tsx`, `src/data/profileAndGames.ts`, estilos y documentación.
- **Cambio revisado:** la búsqueda ya no vive como panel independiente en la biblioteca. «Nuevo juego» ofrece selector RAWG explícito con portada y metadatos; la elección y el alta local ocurren en una sola escritura de juego validada. La biblioteca presenta la ficha antes de entrar al espacio de anotaciones. La carga manual sigue disponible sin clave.
- **Seguridad/integridad:** la escritura combina el juego y metadatos validados en un único registro; elegir otra ficha limpia metadatos anteriores no presentes en el resultado y mantiene el nombre elegido localmente. No modifica objetivos, objetos ni requisitos.
- **Verificación:** `npm run typecheck` y `npm run build` pasan después del cambio.
- **Limitación:** sin clave RAWG no se validó el flujo remoto ni la vista en navegador; la ejecución previa de navegador expiró.

### 2026-10-29 — Automatización de sugerencias RAWG
- **Cambio de producto:** reemplazada la acción «Buscar» por sugerencias automáticas al escribir en el formulario de juego. Debounce de 650 ms, mínimo de tres caracteres y cancelación de consultas obsoletas. No hay petición al abrir la biblioteca; una ficha requiere que el usuario la elija.
- **Privacidad:** el nombre escrito y la clave configurada se envían a RAWG tras la pausa. La interfaz informa esto junto al selector. No se registra la query, clave, URL o respuesta.
- **Verificación:** typecheck/build después del cambio. Búsqueda y CORS reales no se verificaron al no tener clave.



### 2026-10-29 — Materiales y faltantes dentro de objetivos
- **Alcance:** vista de objetivos en `src/GameWorkspace.tsx` y estilos de tabla/editor.
- **Cambio:** removido el panel independiente de requisitos; cada tarjeta de objetivo gestiona varios objetos y condiciones. Se muestran stock actual, cantidad necesaria y faltante no negativo por fila. Los objetos ya asociados al objetivo se excluyen del selector al agregar otro para evitar duplicados en altas nuevas.
- **Integridad:** esta implementación reemplazó la escritura independiente de requisitos por una transacción de creación de objetivo y materiales. Consulte la nota «Lista fija de objetos por objetivo» más abajo para el modelo vigente.
- **Verificación:** `npm run typecheck` y `npm run build` pasaron.
- **Limitación:** no se validó visualmente el formulario ni el ejemplo con IndexedDB real porque browser automation no estaba disponible en el entorno.

### 2026-10-29 — Lista fija de objetos por objetivo
- **Modelo:** cada requisito de objeto registra cantidad necesaria y poseída; la cantidad faltante se calcula como `max(0, necesaria - poseída)`. La posesión es propia de cada objetivo; el agregado suma los faltantes de esos registros.
- **Escritura:** el alta del objetivo y su lista inicial se valida y guarda en una transacción. La edición posterior solo actualiza el objetivo. Se retiró `saveRequirement` y cualquier control visible para modificar la lista guardada; los requisitos heredados quedan de solo lectura.
- **Compatibilidad:** migración IndexedDB v5 inicializa la cantidad poseída con el stock de cada objeto. Los respaldos v3 guardan el campo y convierten respaldos v1/v2.
- **Validación estática:** se revisarán typecheck y build. No se ejecutaron pruebas automatizadas ni se verificó la interfaz en navegador.

