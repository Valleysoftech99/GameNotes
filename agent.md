# Instrucciones generales del proyecto

## Producto
Anotador gamer genérico para organizar objetos, objetivos, requisitos, sub-objetivos y recordatorios por juego. `App.md` resume la experiencia y reglas funcionales; `AppStructure.md` define las entidades, relaciones y vistas. `Stack.md` contiene una propuesta tecnológica, no una decisión implementada.

## Principios de trabajo
- Antes de editar, lee la documentación pertinente y confirma el comportamiento existente en el código. Distingue lo documentado, lo implementado y lo propuesto.
- Mantén cada juego aislado y evita duplicar objetos compartidos por varios objetivos. El progreso se calcula desde el stock y los requisitos según las reglas documentadas.
- No inventes comportamiento ni conviertas puntos abiertos en requisitos. Si una decisión de producto afecta datos, flujo o alcance, registra la duda para Coordinator.
- Protege los datos del usuario: valida entradas, evita pérdida accidental de registros y no expongas contenido privado en errores o logs.
- Conserva cambios preexistentes y limita cada modificación al pedido.
- Ejecuta solo las comprobaciones pertinentes y autorizadas. Informa con precisión qué se comprobó y qué no.

## Flujo de trabajo
Prompt/spec → Coordinator → Implementer → Secure → auditoría en `Security.md`.

- Coordinator interpreta el pedido, inspecciona el contexto necesario, define alcance y criterios, y asigna trabajo al Implementer.
- Implementer realiza el cambio asignado y reporta archivos, decisiones y comprobaciones.
- Secure revisa cada fase en busca de vulnerabilidades y riesgos de privacidad, sin implementar cambios. Mantiene en `Security.md` hallazgos observados y riesgos pendientes por fase, con alcance, severidad, evidencia y estado. Los hallazgos normales se remedian en lotes al cerrar cada dos fases (2, 4, 6); los Críticos y Altos se corrigen de inmediato.
- Coordinator resuelve hallazgos y cierra el trabajo con el resultado y las comprobaciones. Los únicos subagentes del proyecto son Coordinator, Implementer y Secure.

No se mantienen Explorer, Reviewer ni Verifier. Para cambios simples, Coordinator puede ejecutar directamente las etapas aplicables sin delegación artificial.

