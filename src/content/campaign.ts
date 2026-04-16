const externalLinks = {
  letterPdf: "/assets/carta-abierta-pinguino-humboldt.pdf",
  form: "/firma",
  linktree: "",
  instagram: "https://www.instagram.com/esmasqueunpinguino/",
  tiktok: "https://www.tiktok.com/@esmasqueunpinguino",
  youtube: "https://www.youtube.com/Esmasqueunpinguino"
} as const;

export const campaignConfig = {
  site: {
    name: "Es más que un pingüino",
    siteUrl: "https://esmasqueunpinguino.cl",
    locale: "es_CL",
    language: "es-CL",
    title: "Es más que un pingüino | Firma por su protección",
    description:
      "Campaña ciudadana para apoyar la protección del pingüino de Humboldt desde la ciencia y la participación informada. Lee la carta, firma y comparte.",
    themeColor: "#05070B",
    contactEmail: "pinguinodehumboldtmn@gmail.com",
    author: "Equipo Es más que un pingüino"
  },
  theme: {
    colors: {
      bg: "#05070B",
      surface: "#0E1722",
      surfaceStrong: "#122536",
      text: "#FFFFFF",
      textMuted: "#C9D3DE",
      border: "rgba(255,255,255,0.12)",
      sky: "#38B6FF",
      ocean: "#0097B2",
      warm: "#E8CF63",
      pink: "#FFA2D1",
      blush: "#F4B7D3",
      black: "#000000",
      white: "#FFFFFF"
    }
  },
  assets: {
    logo: "/assets/logo-pinguino.png",
    ogImage: "/assets/og-cover.svg",
    favicon: "/favicon.svg",
    publicLetterPdf: "/assets/carta-abierta-pinguino-humboldt.pdf",
    publicLetterPdfEn: "/assets/open-letter-humboldt-penguin-en.pdf"
  },
  links: externalLinks,
  dates: {
    signatureDeadlineIso: "2026-04-20T23:59:59-04:00",
    signatureDeadlineLabel: "20 de abril de 2026"
  },
  hero: {
    mode: "static-dark" as "static-dark" | "video",
    videoSrc: "",
    eyebrow: "Campaña ciudadana por la protección del pingüino de Humboldt",
    title: "Es más que un pingüino",
    subtitle:
      "En solo 5 años, la población reproductiva del pingüino de Humboldt cayó un 63% en las colonias estudiadas de Chile. Tu firma puede apoyar una protección oportuna, basada en evidencia científica, para esta especie y su ecosistema.",
    rotatingLines: [
      "Cuidar esta especie también es cuidar el mar que compartimos.",
      "Infórmate, firma y comparte.",
      "Cada pingüino cuenta. Cada persona cuenta.",
      "La ciencia nos ayuda a comprender por qué protegerlos importa."
    ],
    buttons: {
      readLetter: "Leer la carta",
      signNow: "Firmar ahora",
      floating: "FIRMA LA CARTA AQUÍ"
    },
    signaturesCounter: {
      enabled: true,
      label: "Firmas reunidas",
      value: "0",
      note: "Conteo público actualizado desde la campaña."
    }
  },
  problem: {
    title: "La evidencia nos invita a actuar",
    intro:
      "En marzo de 2026, se retiró de la Contraloría el decreto que otorgaba protección absoluta al pingüino de Humboldt como Monumento Natural. Esto ocurre mientras la especie enfrenta un estado crítico tras perder miles de individuos por la Influenza Aviar y el fenómeno de El Niño. Por eso, hoy es importante acompañar con participación ciudadana una protección basada en evidencia.",
    cards: [
      {
        value: "63%",
        label: "Caída reproductiva",
        detail: "Descenso reportado en 5 años en colonias estudiadas de Chile."
      },
      {
        value: "2026",
        label: "Decreto retirado",
        detail: "El retiro del decreto dejó en pausa una protección decisiva."
      },
      {
        value: "20 Abr",
        label: "Fecha clave",
        detail: "Es una oportunidad para sumar apoyo ciudadano informado antes de esa fecha."
      }
    ]
  },
  ecosystem: {
    title: "Proteger al pingüino es cuidar un sistema completo",
    body:
      "¿Por qué es más que un pingüino? Porque es un bioindicador clave de la corriente de Humboldt. Su presencia ayuda a entender la salud del océano y los cambios que pueden afectar la productividad marina, la pesca artesanal y el turismo del que dependen miles de familias chilenas. Protegerlo también es cuidar nuestro futuro.",
    pillars: [
      {
        title: "Océano",
        icon: "◌",
        description:
          "El pingüino de Humboldt alerta cuando la salud del mar cambia y la cadena alimentaria se desestabiliza."
      },
      {
        title: "Pesca y economía",
        icon: "≈",
        description:
          "La productividad marina sostiene empleos, alimentación y la economía costera de comunidades enteras."
      },
      {
        title: "Turismo",
        icon: "✦",
        description:
          "La biodiversidad viva sostiene experiencias, identidad local y un futuro posible para el territorio."
      }
    ]
  },
  conversion: {
    title: "Cada pingüino cuenta, cada firma cuenta.",
    cardTitle: "Firma antes del 20 de abril",
    cardText:
      "La carta abierta busca reunir apoyo ciudadano informado para acompañar la protección del pingüino de Humboldt como Monumento Natural.",
    shareTitle: "¿Ya firmaste? Ayuda a que más personas conozcan esta causa. Síguenos y comparte.",
    shareText:
      "No olvides compartir la página usando el hashtag #esmasqueunpinguino y el emoji 🐧.",
    reminder:
      "Apoyar esta causa es una forma cercana de cuidar un hogar natural único. Cada firma ayuda a visibilizar, desde la ciencia, por qué proteger al pingüino de Humboldt importa.",
    hashtags: ["#esmasqueunpinguino", "#PingüinoDeHumboldt", "#MonumentoNatural"]
  },
  signatureForm: {
    title: "Firma la carta ciudadana",
    intro:
      "Tu firma respalda una solicitud ciudadana para acompañar, desde la evidencia científica, la protección del pingüino de Humboldt.",
    helper:
      "Completa tus datos y acepta el consentimiento. La integración definitiva del envío se conecta desde el config del proyecto sin rehacer esta interfaz.",
    submitLabel: "Firmar la carta",
    rutHelp: "Ingresa tu RUT con puntos o sin puntos. El dígito verificador puede ser número o K.",
    privacyNote:
      "Tus datos se usan únicamente para gestionar tu firma, respaldar esta campaña y, si lo autorizas, enviarte actualizaciones del proceso. Para consultas sobre privacidad o tratamiento de datos, escríbenos a pinguinodehumboldtmn@gmail.com.",
    configuredNote:
      "El formulario está listo para conectarse a un endpoint o proveedor externo desde `src/content/campaign.ts`.",
    trustPoints: [
      "Campaña pacífica y ciudadana",
      "Base científica y transparencia pública",
      "Participación abierta y responsable"
    ],
    fields: {
      firstName: "Nombre",
      lastName: "Apellido",
      rut: "RUT",
      email: "Correo electrónico",
      age: "Edad",
      country: "País",
      legalNature: "¿Eres persona natural o jurídica?",
      region: "Región",
      commune: "Comuna",
      affiliation: "Organización o vínculo con el territorio",
      message: "¿Por qué firmas?",
      adultDeclaration: "Declaro ser mayor de 18 años.",
      consent: "Acepto respaldar esta carta y el uso de mis datos para esta campaña, y acepto la",
      updates: "Quiero recibir actualizaciones de la campaña."
    }
  },
  transparency: {
    title: "Transparencia, ciencia y participación ciudadana",
    body:
      "Esta campaña es ciudadana, colaborativa y ambientalmente responsable. Se apoya en evidencia científica, participación abierta y una invitación respetuosa a cuidar al pingüino de Humboldt y el ecosistema que sostiene.",
    publicReadinessTitle: "Señales públicas y técnicas del sitio",
    publicReadinessBody:
      "Además de la campaña pública, el sitio expone documentos, rutas y señales técnicas mínimas para buscadores, validadores y scrapers legítimos.",
    principles: [
      "No violencia",
      "Empatía",
      "Colaboración",
      "Alegría",
      "Ciencia como base",
      "Responsabilidad ambiental",
      "Participación ciudadana"
    ],
    publicReadinessLinks: [
      { href: "/robots.txt", label: "robots.txt" },
      { href: "/sitemap.xml", label: "sitemap.xml" },
      { href: "/.well-known/security.txt", label: "security.txt" },
      { href: "/privacidad", label: "Política de privacidad" },
      { href: "/contacto", label: "Contacto" }
    ]
  },
  navigation: [
    { href: "/", label: "Inicio" },
    { href: "/ciencia", label: "Ciencia" },
    { href: "/eventos", label: "Pingüieventos" },
    { href: "/noticias", label: "Pingüinoticias" },
    { href: "/carta", label: "Carta" },
    { href: "/faq", label: "FAQ" },
    { href: "/firma", label: "Firma" },
    { href: "/contacto", label: "Contacto" }
  ],
  knowledgeHub: [
    {
      href: "/pinguino-de-humboldt",
      label: "Pingüino de Humboldt",
      description: "Contexto general sobre la especie, su ecosistema y por qué importa protegerla."
    },
    {
      href: "/monumento-natural-pinguino-de-humboldt",
      label: "Monumento Natural",
      description: "Explicación clara sobre la figura de protección y su relevancia para la especie."
    },
    {
      href: "/amenazas",
      label: "Amenazas",
      description: "Factores que hoy afectan al pingüino de Humboldt y a su hábitat."
    },
    {
      href: "/ciencia",
      label: "Ciencia",
      description: "Resumen divulgativo de la base científica y de la metodología pública de la campaña."
    },
    {
      href: "/faq",
      label: "Preguntas frecuentes",
      description: "Respuestas claras sobre la carta, la firma, el uso de datos y la participación ciudadana."
    },
    {
      href: "/noticias",
      label: "Pingüinoticias",
      description: "Hitos, novedades y avances publicados con fecha para mantener frescura editorial."
    }
  ],
  socialLinks: [
    { href: externalLinks.instagram, label: "Instagram" },
    { href: externalLinks.tiktok, label: "TikTok" },
    { href: externalLinks.youtube, label: "YouTube" },
    { href: externalLinks.linktree, label: "Linktree" }
  ],
  futureRoutes: [
    {
      phase: "Fase 2",
      route: "/glosario",
      description: "Glosario ciudadano para explicar conceptos ecológicos, jurídicos y científicos del sitio."
    },
    {
      phase: "Fase 3",
      route: "/material-educativo",
      description: "Recursos pedagógicos y contenido científico descargable."
    },
    {
      phase: "Fase 4",
      route: "/participa",
      description: "Mapa y calendario de acciones ciudadanas enviadas por la comunidad."
    }
  ]
} as const;

export type CampaignConfig = typeof campaignConfig;
