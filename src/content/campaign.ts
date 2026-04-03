const externalLinks = {
  letterPdf: "LETTER_PDF_URL",
  form: "FORM_URL",
  linktree: "LINKTREE_URL",
  instagram: "https://www.instagram.com/esmasqueunpinguino/",
  tiktok: "https://www.tiktok.com/@esmasqueunpinguino",
  youtube: "https://www.youtube.com/Esmasqueunpinguino"
} as const;

export const campaignConfig = {
  site: {
    name: "Es más que un pingüino",
    siteUrl: "https://masqueunpinguino.cl",
    locale: "es_CL",
    title: "Es más que un pingüino | Firma por su protección",
    description:
      "Campaña ciudadana para proteger al pingüino de Humboldt y exigir la restitución de su decreto como Monumento Natural. Lee la carta, firma y comparte."
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
    favicon: "/favicon.svg"
  },
  links: externalLinks,
  dates: {
    signatureDeadlineIso: "2026-04-25T23:59:59-04:00",
    signatureDeadlineLabel: "25 de abril de 2026"
  },
  hero: {
    mode: "static-dark" as "static-dark" | "video",
    videoSrc: "",
    eyebrow: "Campaña ciudadana por la protección del pingüino de Humboldt",
    title: "Es más que un pingüino",
    subtitle:
      "En solo 5 años, la población reproductiva del pingüino de Humboldt cayó un 63% en las colonias estudiadas de Chile. Necesitamos tu firma para exigir que el Gobierno devuelva el decreto de Monumento Natural a la Contraloría antes del 25 de abril.",
    rotatingLines: [
      "No es un trámite. Es su última oportunidad de sobrevivir.",
      "Léelo, fírmalo y decrétalo.",
      "Cada pingüino cuenta. Cada persona cuenta.",
      "Entre tod@s le damos el valor."
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
    title: "La urgencia no es simbólica",
    intro:
      "En marzo de 2026, el Gobierno retiró de la Contraloría el decreto que otorgaba protección absoluta al pingüino de Humboldt como Monumento Natural. Esto ocurre mientras la especie enfrenta un estado crítico tras perder miles de individuos por la Influenza Aviar y el fenómeno de El Niño. No podemos permitir que la burocracia extinga a nuestra fauna.",
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
        value: "25 Abr",
        label: "Fecha límite",
        detail: "Necesitamos presión ciudadana antes de esa fecha clave."
      }
    ]
  },
  ecosystem: {
    title: "Si cae el pingüino, cae un sistema completo",
    body:
      "¿Por qué es más que un pingüino? Porque es el bioindicador clave de la corriente de Humboldt. Si él desaparece, significa que nuestro océano está colapsando, afectando la productividad marina, la pesca artesanal y el turismo del que dependen miles de familias chilenas. Salvarlos es salvar nuestro futuro.",
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
    title: "Tu firma puede mover al Estado",
    cardTitle: "Firma antes del 25 de abril",
    cardText:
      "La carta abierta busca demostrar respaldo ciudadano real para que el decreto de Monumento Natural vuelva a la Contraloría.",
    shareTitle: "¿Ya firmaste? Ahora haz que el Gobierno escuche. Síguenos y comparte.",
    shareText:
      "No olvides compartir la página usando el hashtag #esmasqueunpinguino y el emoji 🐧.",
    reminder: "Cada firma suma legitimidad. Cada persona que comparte multiplica la presión pública.",
    hashtags: ["#esmasqueunpinguino", "#PingüinoDeHumboldt", "#MonumentoNatural"]
  },
  signatureForm: {
    title: "Firma la carta ciudadana",
    intro:
      "Tu firma respalda una exigencia concreta: que el decreto de Monumento Natural vuelva a la Contraloría antes del 25 de abril.",
    helper:
      "Completa tus datos y acepta el consentimiento. La integración definitiva del envío se conecta desde el config del proyecto sin rehacer esta interfaz.",
    submitLabel: "Firmar la carta",
    rutHelp: "Ingresa tu RUT con puntos o sin puntos. El dígito verificador puede ser número o K.",
    privacyNote:
      "Tus datos solo deben usarse para respaldar esta campaña y, si lo autorizas, para enviarte actualizaciones del proceso.",
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
      region: "Región",
      commune: "Comuna",
      affiliation: "Organización o vínculo con el territorio",
      message: "¿Por qué firmas?",
      consent: "Acepto respaldar esta carta y el uso de mis datos para esta campaña.",
      updates: "Quiero recibir actualizaciones de la campaña."
    }
  },
  transparency: {
    title: "Transparencia, ciencia y acción colectiva",
    body:
      "Esta campaña es pacífica, ciudadana, colaborativa y ambientalmente responsable. Se apoya en evidencia científica, participación abierta y coordinación no violenta para proteger al pingüino de Humboldt y el ecosistema que sostiene.",
    principles: [
      "No violencia",
      "Empatía",
      "Colaboración",
      "Alegría",
      "Ciencia como base",
      "Responsabilidad ambiental",
      "Participación ciudadana"
    ]
  },
  navigation: [
    { href: "/", label: "Inicio" },
    { href: "/carta", label: "Carta" },
    { href: "/firma", label: "Firma" },
    { href: "/transparencia", label: "Transparencia" },
    { href: "/contacto", label: "Contacto" }
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
      route: "/noticias",
      description: "Cobertura de hitos, avances y llamados públicos."
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
