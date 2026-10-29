# Implementationplan.md — plan de ataque

## Objetivo
Construir Notegame como una PWA local-first para registrar perfil, juegos, objetos, objetivos, requisitos y recordatorios; consultar avance y faltantes; y respaldar/restaurar datos entre dispositivos.

## Estado del proyecto
- Scaffold React + TypeScript + Vite, PWA y esquema Dexie en `src/data/database.ts`.
- Fases 0–12 están completadas localmente en el workspace; el flujo de alta RAWG se ajustó según la aclaración de producto del 2026-10-29. La publicación en GitHub Pages está diferida explícitamente por el usuario; no se creó repositorio, no se subieron cambios ni se desplegó.
- **Fase 0 local completada parcialmente:** Node.js 24.21.0 portátil quedó en `.tools/` (ignorado por Git); `package-lock.json` existe; `npm ci --offline` y `npm run build` terminaron bien.
- El lote de seguridad de las Fases 0–2 fue remediado: se retiró `vite-plugin-pwa` y su cadena vulnerable, se endurecieron los schemas y lectores legacy, y se añadieron repositorios con validación referencial. La auditoría online final de Coordinator reportó cero vulnerabilidades en todas las severidades. GitHub Pages se pospone hasta terminar la app; el workspace aún no tiene `.git` y el remoto todavía no existe.

## Decisiones de producto
Confirmadas por el usuario para la Fase 1 (2026-10-28):

- **Sin reserva de stock en el MVP:** cada objetivo calcula su avance con el stock actual del objeto; el agregado suma la demanda y descuenta el stock una vez.
- **Progreso simple:** porcentaje del objetivo = promedio simple de sus requisitos directos; las condiciones cuentan 0%/100%; un objetivo sin requisitos usa el check de recordatorio.

Confirmación adicional del usuario para la Fase 2 (2026-10-28): mostrar «Mis juegos» incluso con un único juego, para invitar a agregar más.

## Aclaración de producto — selector RAWG durante el alta (2026-10-29)

El usuario aclaró el flujo esperado: al agregar un juego, se busca y elige una ficha RAWG (carátula y datos); esa ficha aparece en «Mis juegos» y luego se entra al juego para crear listas/anotaciones. La búsqueda no queda como una acción aislada de la biblioteca. El alta manual se conserva como alternativa sin clave o sin vínculo. Esta aclaración prevalece sobre la especificación inicial.
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

Implementar `rawgService` con `fetch`, timeout/cancelación, respuestas Zod y mensajes genéricos; búsquedas automáticas tras escribir el nombre, con debounce/deduplicación y tratamiento de cuota/offline. Enviar consultas automáticamente solo desde el formulario activo tras una pausa al escribir; no buscar al abrir la biblioteca. No registrar tokens, URLs con clave o respuestas completas. Validar hosts HTTPS de imágenes y evitar caché de imágenes remotas inicialmente.

**Criterio de salida:** búsqueda y consulta de detalle funcionan con clave válida; clave ausente, inválida, cuota agotada y desconexión muestran errores controlados; la app local sigue operativa; atribución/enlaces requeridos están presentes.

**Estado:** servicio `rawgService` con validación Zod, solicitudes debounced al escribir y detalle bajo selección, con timeout/cancelación, `cache: no-store`, límite de cuerpo y deduplicación en memoria de búsquedas simultáneas. El nombre del juego en alta/edición dispara una búsqueda automática tras 650 ms y desde 3 caracteres; se cancelan consultas obsoletas y solo se consultan candidatos mientras se completa el formulario, nunca al abrir la biblioteca. El nombre se transmite a RAWG con la clave local; la selección del candidato sigue siendo manual. Atribución/enlace a RAWG visible. Build pasa; no se probaron llamadas reales/CORS/clave. Cumplida localmente con esas limitaciones.

### Fase 11. Selector RAWG al crear juegos y biblioteca — depende de Fase 10

Al agregar un juego, ofrecer búsqueda automática al escribir y selección de una ficha RAWG con carátula y datos; guardar la ficha junto con el juego y mostrarla en «Mis juegos» antes de entrar al espacio de anotaciones. Mantener alta manual si no hay clave o no se desea RAWG. Permitir reemplazo/refresco/desvinculación. Mantener el nombre elegido/editable por el usuario, sin sobrescribirlo en refrescos. Mostrar fecha/año, géneros, plataformas, desarrolladores, puntuación y descripción, con fallback para datos/imágenes ausentes.

**Criterio de salida:** selección y desvinculación no alteran objetivos/objetos; juegos no vinculados mantienen todas las funciones; texto externo se representa como texto seguro; imágenes fallidas tienen fallback, atribución visible y comportamiento offline explicado.

**Estado:** implementado en el flujo «Nuevo juego»: se busca y selecciona una ficha antes de crear el registro local; la biblioteca muestra la ficha y «Entrar» abre el espacio para listas/anotaciones. La carga manual sigue disponible. También se pueden elegir/reemplazar metadatos durante edición, refrescar o desvincular. La biblioteca muestra carátula con fallback, año, géneros, plataformas, desarrolladores, Metacritic y descripción como texto React. Las imágenes requieren HTTPS y host exacto `media.rawg.io`; usan `referrerPolicy="no-referrer"`, carga diferida y fallback si fallan. Se conservaron datos legacy y backup v2 previos con hosts externos, pero esos covers se omiten al leer y no se cargan. Typecheck/build pasan; no hubo clave RAWG para validar el flujo remoto.

### Fase 12. Integración, lote de seguridad y aceptación — depende de Fases 8–11

Revisar migración, restauración v1/v2, privacidad de clave, solicitudes RAWG, URL de imágenes, límites de datos, atribución, accesibilidad y regresiones funcionales. Secure audita cada fase y los hallazgos normales se corrigen en lote al cerrar las Fases 8, 10 y 12; los altos/críticos se corrigen de inmediato. Ejecutar build/typecheck y validación manual de flujos al autorizar pruebas.

**Criterio de salida:** documentación funcional/modelos respaldos y código coinciden; no hay secretos en backups/logs/UI por defecto; el modo offline y los juegos sin RAWG siguen siendo utilizables. La publicación continúa fuera del alcance hasta autorización expresa del usuario.

**Estado:** revisión de integración y seguridad local completada. Reverificado el 2026-10-29: `npm run typecheck` y `npm run build` pasan; el preview de producción respondió HTTP 200 y entregó sus bundles JS/CSS con HTTP 200. Revisión estática cubrió schemas/migración/restores v1-v2, proyección de clave, solicitudes, contenido externo, host de imágenes, atribución y fallbacks; no se observaron secretos en backups, logs o representación HTML. La validación manual interactiva (perfil/juego/objetivos/backup) sigue pendiente porque el host de automatización de navegador expiró/no está disponible. CORS, cuota, clave real, instalación/offline de navegador y restore con IndexedDB real siguen sin validación dinámica.

### Dependencias y alcance

Secuencia: **7 (decisiones) → 8 (datos/migración) → 9 (perfil/backups) → 10 (servicio RAWG) → 11 (biblioteca) → 12 (integración/auditoría final)**. Las Fases 8–11 no deben iniciar cambios incompatibles mientras las preguntas de Fase 7 sigan abiertas. La integración no requiere nuevas dependencias de runtime en el MVP; `fetch`, `AbortController` y Zod ya están disponibles. Cualquier backend/proxy implica revisar el stack y obtener una decisión de alcance; no asumirlo.











## Ajuste funcional posterior a Fase 12 — materiales dentro de cada objetivo (2026-10-29)

- Cada objetivo admite varios objetos; el esquema ya modela varios requisitos `item` por `goalId` y no requiere migración.
- La interfaz no ofrece una sección de condiciones; la especificación posterior del módulo unificado las eliminó. Las filas históricas se conservan y no intervienen en el progreso actual.
- Cada material del objetivo guarda cantidades poseída y necesaria; se muestra su faltante por renglón: `max(necesario - poseída, 0)`. Ejemplo: 100 poseídas, 200 necesarias, faltan 100.
- La creación registra la lista inicial de objetos con su cantidad necesaria; la iteración vigente permite añadir o quitar materiales individualmente desde el detalle. Los objetos nuevos empiezan con cantidad poseída 0 y el detalle la incrementa por requisito para calcular el faltante por renglón.
- La lista inicial queda fija al guardar, pero la iteración posterior permite agregar o quitar materiales desde el detalle. No se permite editar la cantidad necesaria ya guardada; el detalle sí incrementa la cantidad poseída.
- La migración IndexedDB v5 inicializa `cantidad_poseida` desde el stock existente, y los respaldos v3 conservan ese dato y convierten respaldos v1/v2.
- Typecheck y build pasan. No se recorrió la interfaz en browser ni se probaron registros en IndexedDB real.

## Iteración intermedia del módulo Objetivos y Gestión Activa — sustituida

La interfaz de dos modos descrita aquí fue reemplazada por la siguiente iteración de lista y detalle.

- El workspace de cada juego tiene dos modos: **Modo creación** y **Modo activo**. Se quitaron las pestañas separadas de objetivos, objetos y faltantes.
- Modo creación crea un objetivo con título, descripción y lista fija de materiales. Cada renglón pide nombre y cantidad necesaria; el stock inicial no se captura aquí. Un objeto ya conocido en el juego se reutiliza por nombre normalizado; si no existe, se crea en el catálogo local dentro de la misma transacción. No se permite repetir el mismo objeto en un objetivo.
- Modo activo muestra objetivos, progreso y faltantes por material. «Agregar lo que juntaste» incrementa únicamente `possessedQuantity` del requisito seleccionado y valida el cambio en una transacción. No permite crear, editar ni eliminar objetivos/materiales.
- La completitud se deriva cuando todos los materiales del objetivo alcanzan la cantidad requerida. El estado almacenado `active | paused` se conserva; objetivos legacy pausados siguen mostrándose pausados. No se requiere migración.
- La UI ya no incluye condiciones. Las filas de condición legacy se preservan, pero no se muestran ni influyen en el progreso de esta interfaz.
- El perfil y la carátula del juego aparecen antes del módulo; la imagen se desenfoca con una capa de contraste y tiene fondo de reemplazo cuando falta o falla.
- Comprobaciones ejecutadas: `npm run typecheck` y `npm run build` pasan. No se recorrió la UI en navegador ni se verificó una sesión IndexedDB real.

## Nueva iteración del módulo Objetivos — lista y detalle implementados

- La pantalla principal lista objetivos seleccionables y usa un botón icono «+» accesible para abrir el formulario de creación multi-material.
- Seleccionar un objetivo abre una vista de detalle titulada con su nombre y con acción para regresar a la lista.
- La lista permite eliminar un objetivo con confirmación que explica que también se quitarán sus materiales, cantidades y progreso. El borrado validado y transaccional elimina objetivo y requisitos asociados; conserva los objetos del catálogo.
- El detalle permite eliminar cada material en cualquier estado con confirmación. El borrado validado comprueba juego, objetivo, requisito y objeto; elimina solo el requisito de ese objetivo y conserva el objeto compartido y sus usos en otros objetivos.
- Los materiales en progreso muestran necesario en violeta, juntado en blanco y faltante en rojo. Cuando `possessedQuantity >= quantity`, los tres valores se muestran verdes. La acción de acumulación se llama «Agregar» y mantiene entrada numérica.
- Se conservan avatar, carátula RAWG con blur/fallback, modelo persistido, estado legacy `active | paused`, y formatos de respaldo. No se agregó migración.
- `npm run typecheck` y `npm run build` pasan; la UI no se validó manualmente en navegador ni con IndexedDB real.

## Refinamiento final de materiales en el detalle — implementado

- El detalle permite agregar materiales tras guardar el objetivo. El repositorio valida el juego y objetivo dentro de una transacción, reutiliza el objeto del catálogo por nombre normalizado o lo crea, inicia `possessedQuantity` en cero y rechaza nombres duplicados en ese objetivo. Otros objetivos no cambian.
- Cada tarjeta de material inicia expandida y puede contraerse. El estado de acordeón se mantiene solo en React por `requirementId`; no se añade a IndexedDB ni a respaldos.
- Cada material muestra porcentaje propio y barra accesible, limitada a 0–100%. En progreso, necesario usa `#8A00F2`, juntado `#FFFFFF` y faltante `#F20000`; al completar, todos cambian a verde `#00E676`.
- En escritorio, métricas y barra ocupan la columna izquierda y cantidad/«Agregar» la derecha; en móvil se apilan.
- Se conservan los borrados confirmados y transaccionales anteriores. No hay migración ni cambios de formato de respaldo.
- `npm run typecheck` y `npm run build` pasan. No se verificó manualmente la interacción en navegador ni con IndexedDB real.

