EspecificaciÃ³n TÃ©cnica: RefactorizaciÃ³n de Modelos de Datos e Interfaz en la app (IntegraciÃ³n API RAWG y ReorganizaciÃ³n de Funcionalidades)
Esta especificaciÃ³n define las modificaciones de arquitectura, refactorizaciÃ³n de interfaz de usuario e integraciÃ³n con la API de RAWG para el proyecto App. El documento estÃ¡ estructurado para ser interpretado directamente por un agente de cÃ³digo con IA o por un equipo de desarrollo.

1. Objetivos y Resumen de Cambios
Objetivo principal: Simplificar el seguimiento de objetivos/misiones en los juegos, integrar la API de RAWG para la obtenciÃ³n automÃ¡tica de metadatos y carÃ¡tulas, centralizar las herramientas de respaldo/restauraciÃ³n dentro del perfil de usuario y ampliar la vista de detalles de los juegos.

Eliminaciones: DepuraciÃ³n completa de los campos y lÃ³gica de subobjetivos, selecciÃ³n de opciones (tipos principal/secundario) y los campos "objetivo" y "tipo" dentro de los requisitos.

Nuevas Funcionalidades:

Campo libre y editable por teclado objeto (ejemplo: "Juntar madera").

Soporte de API key de RAWG configurable desde el perfil.

Vista extendida en "Mis Juegos" con informaciÃ³n tÃ©cnica y carÃ¡tulas traÃ­das desde RAWG.

MigraciÃ³n de toda la lÃ³gica y UI de copia de seguridad (backup) y restauraciÃ³n al Perfil de Usuario.

2. EspecificaciÃ³n TÃ©cnica Detallada
A. RefactorizaciÃ³n de Objetivos y Requisitos
Eliminar todos los modelos de datos anidados, subobjetivos y menÃºs desplegables de clasificaciÃ³n lÃ³gica en los formularios de seguimiento.

Eliminaciones (CÃ³digo e Interfaz):

Eliminar por completo el arreglo/array subobjetivos y su lÃ³gica asociada.

Eliminar la lÃ³gica de opciones (principal) y sus componentes de selecciÃ³n.

Dentro del bloque de requisitos, eliminar los campos objetivo y tipo.

Nuevo Campo (objeto):

Nombre del campo: objeto (String / Texto).

Comportamiento: Campo de texto directamente editable por el usuario mediante teclado.

Ejemplo de valor: "Juntar madera", "Derrotar al jefe final", "Conseguir 10 pociones".

B. IntegraciÃ³n con la API de RAWG (ConfiguraciÃ³n en Perfil)
Permitir al usuario ingresar y almacenar su clave de API de RAWG desde su perfil para realizar peticiones de informaciÃ³n de videojuegos.

Ajustes en el Perfil de Usuario:

Campo nuevo: rawgApiKey (Almacenado de forma segura en el estado/base de datos local).

Componente de UI: Campo de entrada de texto en la pantalla de ajustes de perfil donde el usuario pueda pegar, probar y guardar su token personal de la API de RAWG ([https://rawg.io/apidocs](https://rawg.io/apidocs)).

Servicio de API (Client Layer):

Crear un mÃ³dulo o servicio cliente (rawgService) para realizar bÃºsquedas y consultas a los endpoints de RAWG (/games y /games/{id}) autenticando con la clave guardada en el perfil.

C. RelocalizaciÃ³n de Copia de Seguridad y RestauraciÃ³n
Centralizar las funciones de exportaciÃ³n, importaciÃ³n y resguardo de datos en una sola ubicaciÃ³n lÃ³gica.

MigraciÃ³n de UI:

Mover todos los botones, controles y modales de "Respaldar datos" y "Restaurar datos" fuera de los menÃºs secundarios o tableros generales.

Ubicarlos exclusivamente en la vista de Perfil de Usuario, dentro de un mÃ³dulo o tarjeta dedicada al almacenamiento y datos.

D. InformaciÃ³n Extendida de Juegos y CarÃ¡tulas ("Mis Juegos")
Enriquecer la secciÃ³n "Mis Juegos" con los metadatos e imÃ¡genes provenientes de RAWG.

ActualizaciÃ³n del Modelo de Datos para Juegos:

Extender la entidad de juego para almacenar identificadores y cachÃ© de RAWG: rawgId, coverUrl, releaseDate, genres, platforms, developers, metacriticScore y description.

ActualizaciÃ³n de UI en "Mis Juegos":

Mostrar la carÃ¡tula del juego (imagen obtenida de la API).

Desplegar un bloque con la informaciÃ³n detallada del juego (aÃ±o de lanzamiento, gÃ©neros, desarrolladores, plataformas y puntuaciÃ³n).

Incluir un mecanismo de bÃºsqueda/sincronizaciÃ³n para vincular un juego de la biblioteca del usuario con el resultado correspondiente en RAWG.

3. Lista de VerificaciÃ³n (Checklist) para Agentes de CÃ³digo
[ ] MigraciÃ³n de Base de Datos y Modelos:

Eliminar atributos/columnas de subobjetivos, opciones, objetivo (en requisitos) y tipo (en requisitos).

Agregar el campo objeto (TEXT) en la estructura correspondiente a los objetos/Ã­tems.

Agregar los campos rawg_id, cover_url y rawg_metadata en la tabla/modelo de juegos.

[ ] ActualizaciÃ³n del Perfil de Usuario:

Agregar la entrada de texto para rawgApiKey en el formulario del perfil.

Reubicar la interfaz grÃ¡fica y eventos de Respaldar/Restaurar datos al mÃ³dulo de perfil.

[ ] Servicio de API de RAWG:

Implementar las funciones de consulta HTTP hacia RAWG utilizando la API key del perfil.

[ ] RefactorizaciÃ³n de Componentes de UI:

Limpiar la interfaz de creaciÃ³n/ediciÃ³n removiendo selectores viejos de subobjetivos y tipos.

Implementar la caja de texto editable por teclado para objeto.

Actualizar la vista de la biblioteca "Mis Juegos" para renderizar la carÃ¡tula e informaciÃ³n obtenida de RAWG.
## AclaraciÃ³n funcional de producto â€” alta de juego con ficha RAWG (2026-10-29)

La bÃºsqueda de RAWG forma parte del flujo Â«Nuevo juegoÂ». La persona busca y elige una ficha con portada y datos antes de agregar el juego a su biblioteca. La ficha queda visible en Â«Mis juegosÂ» y, desde esa tarjeta, se entra al espacio del juego para crear listas y anotaciones. No se debe presentar la bÃºsqueda solo como una herramienta separada en la biblioteca. El alta manual sigue disponible si no hay clave o si la persona no quiere vincular RAWG. La selecciÃ³n no sobrescribe el nombre local que la persona edite y las actualizaciones conservan ese nombre.

## AclaraciÃ³n de automatizaciÃ³n de bÃºsqueda (2026-10-29)

En Â«Nuevo juegoÂ», RAWG consulta automÃ¡ticamente el nombre escrito despuÃ©s de una pausa breve y muestra coincidencias con carÃ¡tula. La persona elige la ficha correcta; no se vincula automÃ¡ticamente el primer resultado porque pueden existir distintas ediciones/plataformas. El nombre y la clave se envÃ­an al proveedor cuando se escribe y se pausa, por lo que el formulario debe avisar de esta consulta. La carga manual sigue como alternativa si falta la clave o no hay coincidencias.

## Ajuste funcional: varios objetos por objetivo y faltantes (2026-10-29)`r`n`r`nSe actualizó el comportamiento en la sección «Regla actualizada de objetos en objetivos»: los materiales son datos propios de cada objetivo, se capturan al crearlo y la lista queda fija después de guardar.`r`n`r`n## Regla actualizada de objetos en objetivos (2026-10-29)

La lista de objetos se crea junto con el objetivo y queda fija tras guardarlo. En el alta inicial se pueden incluir varios objetos, cada uno con `cantidad_necesaria` positiva y `cantidad_poseida` no negativa; el faltante se calcula automÃ¡ticamente como `max(0, cantidad_necesaria - cantidad_poseida)`. La ediciÃ³n posterior solo permite modificar los metadatos del objetivo. No existe acciÃ³n ni endpoint para agregar o editar objetos/condiciones despuÃ©s de crear el objetivo. IndexedDB v5 inicializa cantidades poseÃ­das antiguas desde stock y el respaldo v3 convierte respaldos v1/v2.

