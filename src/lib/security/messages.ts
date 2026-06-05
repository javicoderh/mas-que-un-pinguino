export const securityMessages = {
  genericFailure: "No pudimos procesar tu firma. Inténtalo nuevamente en un momento.",
  invalidSubmission: "Detectamos un problema con el envío. Revisa los datos e inténtalo otra vez.",
  duplicate: "Parece que esta firma ya fue registrada o está en revisión.",
  duplicateRut: "Ya existe una firma registrada con ese RUT o está en revisión.",
  review: "Recibimos tu firma y quedó en revisión breve.",
  success: "Tu firma fue registrada. Gracias por sumarte.",
  rateLimited: "Estamos recibiendo muchos envíos. Inténtalo nuevamente en un momento.",
  eventSuccess: "Recibimos tu propuesta de evento. Quedó pendiente de revisión.",
  eventDuplicate: "Ya existe una propuesta muy similar para ese evento o está en revisión.",
  adminInvalidCredentials: "Las credenciales no son válidas.",
  adminUnauthorized: "Necesitas iniciar sesión para realizar esta acción."
} as const;
