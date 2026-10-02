/** Traducción a lenguaje simple de los errores de envío más comunes de la Cloud API. */
const MESSAGES: Record<number, string> = {
  131047: 'Pasaron más de 24 h desde que el cliente te escribió: solo puedes enviarle una plantilla.',
  131026: 'El mensaje no se pudo entregar: el número no tiene WhatsApp o no aceptó las condiciones.',
  131050: 'El cliente pidió no recibir más mensajes de marketing tuyos.',
  131049: 'Meta frenó este mensaje de marketing para cuidar la experiencia del usuario. No lo reintentes enseguida.',
  131048: 'Meta limitó tus envíos porque muchos los marcaron como spam.',
  131056: 'Le enviaste demasiados mensajes seguidos a este mismo contacto.',
  131031: 'Tu cuenta de WhatsApp Business está bloqueada.',
  132001: 'La plantilla no existe o no está aprobada en ese idioma.',
  132000: 'La cantidad de variables no coincide con la plantilla.',
  130472: 'El número del cliente está en un experimento de Meta y no recibe marketing por ahora.',
  131042: 'Hay un problema con el método de pago de tu cuenta de Meta.',
  368: 'Tu cuenta tiene una restricción temporal por políticas de Meta.',
}

export function explainMetaError(code: number | null, title: string | null): string {
  if (code !== null && MESSAGES[code]) return MESSAGES[code]
  if (title) return `Meta rechazó el envío: ${title}${code ? ` (código ${code})` : ''}.`
  return 'El envío falló sin un motivo claro de Meta.'
}
