# Plan de corrección: objetivos, objetos y progreso

## Objetivo

Corregir las incoherencias detectadas entre inventario, materiales de objetivos, progreso, estados y respaldos. Antes de tocar el código, el modelo debe tener una sola definición de «cantidad poseída» y reglas explícitas para los faltantes.

## Decisión de modelo recomendada

- `GameItem.stock` será la fuente única de la cantidad poseída. Representa las unidades disponibles en el inventario del juego y se puede actualizar desde «Por objeto».
- Cada requisito de objetivo guardará el objeto y la cantidad necesaria. No duplicará el stock ni guardará una cantidad poseída propia.
- En cada objetivo, el faltante visible será `max(0, cantidad_necesaria - GameItem.stock)`, tal como se solicitó originalmente.
- En «Por objeto», la demanda total será la suma de cantidades necesarias de los objetivos incluidos. El faltante agregado será `max(0, demanda_total - stock)`, descontando el inventario compartido una sola vez. Los faltantes de renglón son informativos y no se suman entre objetivos, porque una misma unidad de inventario puede cubrir la demanda de uno u otro objetivo, pero no ambos simultáneamente.
- Objetivos en pausa no participan en la demanda/faltantes activos. Al reactivarlos vuelven a incluirse.
- Crear un objetivo puede incluir cero o más objetos. Si tiene objetos, su lista se define al crearlo y no se podrán añadir ni quitar objetos después; las cantidades necesarias existentes sí podrán ajustarse. El stock seguirá actualizándose desde el inventario.
- Un objetivo sin materiales puede funcionar como recordatorio. Su control de completado aplica únicamente a ese tipo de objetivo. Los objetivos con materiales se consideran completos cuando todos sus requisitos alcanzan la cantidad necesaria; no tendrán un checkbox de completado independiente.

> La regla de «lista fija» se interpreta como no permitir cambiar qué objetos forman parte del objetivo después de guardarlo. No debe impedir corregir la cantidad necesaria ni actualizar el inventario real.

## Fases de trabajo

### 1. Alinear el modelo y los tipos

- Modificar `ItemRequirement` para conservar `itemId` y `quantity` (cantidad necesaria), y retirar `possessedQuantity` del modelo canónico.
- Mantener `GameItem.stock` como dato poseído autoritativo.
- Actualizar esquemas de creación, lectura, validación y progreso para que no haya dos fuentes de stock.
- Definir un helper de dominio para calcular el faltante de una fila y otro para demanda/faltante agregado; evitar repetir fórmulas en componentes.
- Revisar si `done` debe permanecer en `Goal` solo como estado de recordatorio. Los materiales deben determinar el avance sin un estado duplicado.

**Aceptación:** editar el stock de un objeto se refleja inmediatamente en todos los objetivos vinculados; ningún cálculo de progreso lee una cantidad poseída duplicada en el requisito.

### 2. Corregir creación y edición de objetivos

- Permitir cero o más materiales en el formulario de creación; cada material agregado requiere objeto y cantidad necesaria positiva.
- Evitar que los campos del primer renglón hagan obligatorio crear un requisito cuando se desea un objetivo tipo recordatorio.
- En edición de un objetivo con materiales, mostrar su lista existente de solo lectura, permitir cambiar cantidades necesarias y guardar esos cambios junto con los metadatos del objetivo.
- No ofrecer controles para añadir, quitar o reemplazar objetos tras la creación.
- Eliminar el checkbox «Recordatorio completado» de objetivos con materiales; para objetivos sin materiales, conservar el control de completado.
- Mostrar en las filas la cantidad poseída tomada del stock compartido, la cantidad necesaria y el faltante calculado.

**Aceptación:** se puede crear un recordatorio sin materiales aunque ya existan objetos en el catálogo; se pueden actualizar las cantidades del inventario y ajustar la cantidad necesaria sin alterar qué objetos forman parte del objetivo.

### 3. Reparar progreso, estados y agregados

- Calcular el porcentaje de un material con `min(stock / cantidad_necesaria, 1) * 100`.
- Definir el progreso del objetivo como promedio de sus requisitos (o acordar ponderación por cantidades antes de implementar; no mezclar porcentajes sin explicitarlo).
- Para objetivos sin materiales, el progreso será 0 o 100 según el estado del recordatorio.
- Excluir objetivos en pausa de «Faltantes» y del total de demanda activa. Identificar claramente si la pantalla «Por objeto» muestra demanda activa o incluye también objetivos pausados.
- Calcular el faltante agregado desde demanda activa menos stock una sola vez. Mostrar por separado los faltantes indicativos por objetivo para no sugerir que son sumables.
- Comprobar y validar `stock`, `quantity` y referencias al objeto/objetivo antes de calcular.

**Aceptación:** subir el stock actualiza el porcentaje y los faltantes; pausar un objetivo lo excluye según la regla acordada; el agregado nunca descuenta varias veces el mismo stock.

### 4. Cerrar la vía de modificación desde respaldos

- En restauración merge, si el objetivo ya existe localmente, no importar requisitos que amplíen o cambien su conjunto de objetos.
- Permitir requisitos del respaldo solo para objetivos nuevos que se importen en la misma operación, o definir una política explícita de reemplazo para restauración completa.
- Hacer que la vista previa informe los requisitos omitidos por pertenecer a objetivos existentes.
- Validar relaciones y unicidad de objeto dentro de cada objetivo en respaldos nuevos y heredados.

**Aceptación:** una restauración merge no puede agregar/quitar objetos de un objetivo existente por una ruta distinta a la interfaz autorizada; restaurar un objetivo nuevo conserva sus materiales.

### 5. Migrar base local y respaldos

- Crear una nueva versión de IndexedDB que quite `possessedQuantity` de los requisitos existentes. El stock del catálogo ya contiene la cantidad autoritativa, así que no se debe copiar ni sumar ningún valor durante esta migración.
- Actualizar lectura heredada para tolerar el campo antiguo y descartarlo solo en la proyección canónica, sin escribir de vuelta filas corruptas o desconocidas fuera de una migración explícita.
- Emitir una nueva versión de respaldo que no exporte cantidad poseída por requisito.
- Seguir importando respaldos v1, v2 y v3, descartando el snapshot poseído antiguo y usando `items[].stock` como única posesión.
- Revisar restauración replace para preservar la clave RAWG local según el comportamiento actual.

**Aceptación:** una base existente mantiene el stock de cada objeto sin duplicarlo; respaldos viejos siguen importándose y respaldos nuevos no reintroducen el campo obsoleto.

### 6. Revisar interfaz y documentación

- Alinear etiquetas y ayudas de «Objetivos», «Por objeto» y «Faltantes» con el modelo de inventario compartido.
- Aclarar que las diferencias por objetivo son indicativas cuando varios objetivos compiten por el mismo stock.
- Eliminar texto que describa cantidades poseídas congeladas por objetivo, condiciones editables después de guardar o faltantes agregados como suma de faltantes por fila.
- Actualizar `Implementationplan.md`, `Improvements.md` y `Security.md` con el modelo final y su compatibilidad de datos.

**Aceptación:** la misma cantidad de inventario significa lo mismo en todas las vistas; no quedan descripciones antiguas que contradigan el comportamiento.

### 7. Verificación antes de darlo por terminado

- Añadir pruebas unitarias de cálculo: faltante cero, parcial, completo y stock compartido entre varios objetivos.
- Añadir pruebas de progreso para recordatorios, objetivos con materiales y objetivos en pausa.
- Añadir pruebas de creación con cero/varios materiales, edición de cantidad necesaria y rechazo de cambio de composición tras guardar.
- Añadir pruebas de restauración merge que intenten anexar un requisito a un objetivo ya existente y de compatibilidad v1/v2/v3.
- Ejecutar `npm run typecheck`, `npm run build` y la suite de pruebas del repositorio. Revisar manualmente el flujo de creación, edición de stock, pausa y restauración.

**Aceptación final:** todas las reglas anteriores tienen cobertura automatizada y las pantallas muestran el mismo inventario y faltantes que el modelo calcula.

## Orden sugerido de implementación

1. Confirmar este modelo como regla de producto.
2. Actualizar esquema, dominio y migración.
3. Corregir repositorios y política de restauración.
4. Corregir creación/edición y las vistas de objetivos/inventario.
5. Actualizar respaldos y documentación.
6. Ejecutar verificaciones y recorrer los flujos completos.

