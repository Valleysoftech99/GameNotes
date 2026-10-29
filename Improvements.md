Especificación Técnica Actualizada: Módulo de Objetivos e Ítems (Ajustes de UI/UX)
1. Resumen de Cambios Estructurales
Paleta de Colores Modificada:

Necesario: Violeta de alta saturación (#8A00F2).

Faltante: Rojo brillante (#F20000).

Rediseño del Layout de Ítems (Distribución Horizontal): Se reestructura el diseño interno de cada ítem/objeto. La métrica de cantidades (Necesario / Juntado / Faltante) se ubica a la izquierda y la interacción de la entrada de stock (Cantidad + Botón Agregar) se alinea hacia la derecha.

Indicadores de Progreso: Se mantiene el porcentaje global del objetivo y se incorpora una barra/indicador de porcentaje parcial por objeto.

Visualización Colapsable (Acordeón Autorretráctil): Por defecto, la tarjeta del ítem se muestra en Modo Completo. Se añade un control tipo toggle para que el usuario pueda contraer la información detallada y dejar visible únicamente el nombre del objeto.

2. Estructura de Datos (Esquema del Objeto)
TypeScript
interface ObjectiveItem {
  id: string;
  name: string;
  quantityRequired: number;
  quantityInStock: number;
  isCollapsed?: boolean; // Control de estado para contraer/desplegar detalles (por defecto: false)
}
3. Reglas de Estilos y Paleta de Colores
Estado En Progreso (quantityInStock < quantityRequired):

Necesario: #8A00F2 (Violeta Intenso)

Juntado: #FFFFFF (Blanco)

Faltante: #F20000 (Rojo Intenso)

Estado Completado (quantityInStock >= quantityRequired):

Necesario / Juntado / Faltante: #00FF7F o #00E676 (Verde Completado)

4. Layout e Interfaz de la Tarjeta de Objeto (UI/UX)
A. Estado Desplegado (Modo Completo - Por Defecto)
+-----------------------------------------------------------------------------------------+
| [v] [ Nombre del Objeto ]                             [ Progreso Parcial: XX% ] [Trash] |
| --------------------------------------------------------------------------------------- |
|  Métricas (Izquierda)                  |  Interacción (Derecha)                         |
|  • Necesario: XX (#8A00F2)             |  [ Campo Cantidad ]  [ Botón "Agregar" ]        |
|  • Juntado:   XX (#FFFFFF)             |                                                |
|  • Faltan:    XX (#F20000)             |                                                |
| --------------------------------------------------------------------------------------- |
|  [||||||||||||||||||||||....................] Barra de progreso parcial                 |
+-----------------------------------------------------------------------------------------+
B. Estado Contraído (Modo Colapsado)
+-----------------------------------------------------------------------------------------+
| [>] [ Nombre del Objeto ]                                               [Trash]         |
+-----------------------------------------------------------------------------------------+
5. Flujo Completo Integrado para Agente de Código (Prompt Final)
Markdown
### REQUERIMIENTO COMPLETO DE DESARROLLO: MÓDULO DE OBJETIVOS E ÍTEMS

1. ESTRUCTURA DE LA PANTALLA PRINCIPAL
- Mostrar Avatar del Usuario en la parte superior.
- Portada del Juego posicionada inmediatamente debajo del Avatar y sobre la lista de objetivos (con fondo desenfocado CSS backdrop-filter blur).
- Encabezado de Sección "Objetivos" acompañado de un botón iconográfico [+] para crear un nuevo objetivo.

2. LISTA Y NAVEGACIÓN DE OBJETIVOS
- Muestra los objetivos mediante tarjetas seleccionables que incluyen opción de eliminación directa [Trash].
- Al hacer clic en un objetivo, se navega a la Vista de Detalle utilizando como título el NOMBRE DEL OBJETIVO.

3. VISTA DE DETALLE DEL OBJETIVO
- Muestra el Porcentaje Global de avance del objetivo.
- Permite la creación y eliminación [Trash] de objetos/materiales individuales dentro del objetivo.

4. DISEÑO DE TARJETAS DE MATERIALES / ÍTEMS
- Mapeo visual dividido en dos columnas horizontales:
  * LADO IZQUIERDO: Métricas de cantidad.
    - Necesario: Color #8A00F2 (mientras esté incompleto).
    - Juntado: Color #FFFFFF.
    - Faltante: Color #F20000 (mientras esté incompleto).
    - Si el objeto se completa (Juntado >= Necesario), todo el bloque de texto pasa a VERDE.
  * LADO DERECHO: Campo de entrada numérica de Cantidad + Botón "Agregar".
- Porcentaje Parcial por Objeto: Barra de progreso e indicador numérico del % recolectado por cada ítem.
- Funcionalidad Autorretráctil:
  * Estado por defecto: COMPLETO (desplegado).
  * Control interactivo (botón/flecha) para contraer la tarjeta y ocultar los controles/métrica
## Estado de implementación: materiales en detalle

- El detalle permite agregar nuevos materiales al objetivo guardado. Una transacción valida objetivo/juego, rechaza duplicados normalizados, reutiliza el objeto del catálogo o lo crea, e inicia el nuevo requisito con cantidad poseída 0.
- Cada material muestra porcentaje y barra de progreso accesibles con rango 0–100%. En progreso se usan #8A00F2 para necesario, #FFFFFF para juntado y #F20000 para faltante; completado cambia las tres métricas a #00E676.
- Las tarjetas de material comienzan expandidas y se pueden contraer. Contraer oculta porcentajes, barra, métricas y formulario de «Agregar», y deja nombre, control y papelera visibles. El estado vive solo en React y no se persiste.
- En escritorio, métricas/progreso quedan a la izquierda y cantidad + «Agregar» a la derecha; en móvil se apilan.
- Se mantienen los borrados confirmados/transaccionales, cover/avatar, RAWG, esquema y respaldos. No se agregó migración.

Criterios verificados: `npm run typecheck` y `npm run build` pasan. No se probó la interacción manual en navegador ni IndexedDB real.
