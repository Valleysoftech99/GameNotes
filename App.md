# Anotador gamer

## Visión
Una aplicación web instalable para acompañar las sesiones de juego. Permite anotar qué se quiere conseguir, para qué sirve cada objeto y cuánto falta, y consultar rápidamente el plan desde el celular.

La aplicación es genérica: sirve para juegos de autos, RPG y otros géneros. Cada juego tiene su propio espacio de datos.

## Experiencia

1. Al abrirla por primera vez, la persona configura un perfil local con nombre y avatar.
2. En «Mis juegos», crea un juego o retoma uno existente.
3. Dentro del juego, registra objetivos (por ejemplo, fabricar una espada), objetos necesarios, cantidades y condiciones como completar una misión.
4. Actualiza el stock de objetos a medida que juega y añade ubicaciones o notas para recordar dónde conseguirlos.
5. Consulta objetivos, totales por objeto o una lista de faltantes agrupada por ubicación.

La interfaz apunta primero al uso en celular: navegación simple, controles táctiles y lectura clara durante una partida. La estética propuesta usa fondo azul oscuro, acentos violeta, fucsia y azul, con flores de estilo glow. Los efectos decorativos deben conservar buen contraste y no competir con la información.

## Modelo funcional

- **Juego:** espacio aislado que contiene sus objetos y objetivos.
- **Objeto:** se registra una sola vez por juego y puede ser requerido por varios objetivos. Incluye nombre, stock disponible, ubicaciones conocidas y nota general.
- **Objetivo:** una finalidad con nombre, estado activo/pausado, prioridad, ubicación opcional, nota y posibles sub-objetivos.
- **Requisito:** relación entre un objetivo y un objeto o condición. Indica cantidad necesaria y puede tener una nota propia (por ejemplo, «solo aparece de noche»).
- **Recordatorio:** objetivo sin requisitos, con estado pendiente/hecho. También puede formar parte de otro objetivo como sub-objetivo.

El avance se calcula a partir del stock y de los requisitos, para evitar guardar porcentajes que puedan quedar desactualizados. En el MVP no se reserva stock: el stock común se usa para calcular el avance de cada objetivo, y la vista agregada suma la demanda total y descuenta el stock una sola vez. El porcentaje de un objetivo es el promedio simple de sus requisitos directos; cada condición aporta 0% o 100%. Un objetivo sin requisitos (recordatorio) usa un check pendiente/hecho. Un objetivo puede mezclar materiales y condiciones no materiales, como alcanzar cierto nivel o hablar con un personaje. Si no se conoce la ubicación de un faltante, se muestra bajo «Sin ubicación».

## Vistas

- **Objetivos:** requisitos y avance por objetivo; los recordatorios se muestran como tareas con check.
- **Objetos:** stock y necesidad total, con desglose por objetivo. Los recordatorios no se agregan aquí.
- **Faltantes:** pendientes agrupados por ubicación, incluidos los recordatorios.
- **Objetivos:** lista plana de objetivos con texto libre de acción, progreso y requisitos asociados.

Las vistas reflejan los mismos datos. Abrir un requisito lleva al objeto relacionado y sus notas; modificar el stock actualiza los avances que dependen de él.

## Datos, privacidad y respaldo

Los datos se guardan localmente en el dispositivo. No se requiere una cuenta ni un servidor para el uso descrito. La clave RAWG personal, si se guarda, queda localmente sin cifrado y no se incluye en respaldos. El respaldo JSON versión 2 excluye la clave, acepta versión 1 con conversión en memoria y valida el archivo completo antes de modificar datos. En reemplazo se conserva la clave local si el archivo trae perfil; si no trae perfil, se elimina con ese perfil.

La publicación prevista es un sitio estático en GitHub Pages que se pueda instalar como PWA. La instalación y algunas capacidades sin conexión dependen del navegador y del dispositivo.

## Decisiones de implementación vigentes

- Los objetivos son planos; se conservan los registros y requisitos existentes y se elimina solo el vínculo de subobjetivo.
- Los requisitos mantienen sus relaciones internas (`goalId`, `kind`); se crean desde el objetivo con acciones contextuales.
- Cada objetivo tiene `objectDescription`, un texto libre de objeto/acción.
- La clave RAWG se guarda sin cifrado, se puede borrar desde el perfil y queda fuera del archivo de respaldo.

La estructura detallada de entidades y relaciones está en `AppStructure.md`. La propuesta tecnológica está en `Stack.md`.




