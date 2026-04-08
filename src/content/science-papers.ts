const paperAssetModules = import.meta.glob("../assets/papers/HUPE_ACMU/*.pdf", {
  eager: true,
  import: "default"
}) as Record<string, string>;

export type SciencePaperKind =
  | "Artículo científico"
  | "Informe técnico"
  | "Informe final"
  | "Manual técnico"
  | "Tesis de magíster"
  | "Instrumento público";

interface SciencePaperDefinition {
  slug: string;
  fileName: string;
  title: string;
  authors: string;
  year: number;
  source: string;
  kind: SciencePaperKind;
  pages: number;
  language: "Español" | "Inglés";
  doi?: string;
  note?: string;
}

export interface SciencePaperRecord extends SciencePaperDefinition {
  url: string;
  downloadName: string;
}

const definitions: SciencePaperDefinition[] = [
  {
    slug: "bastias-aguilar-2026-overlap-fisheries-feeding-areas",
    fileName: "Bastias Aguilera et al 2026 PeerJ.pdf",
    title: "Spatio-temporal overlap between purse seine fisheries and Humboldt penguin feeding areas in northern Chile",
    authors: "Isabel Bastías-Aguilar, Thomas Mattern, Ursula Ellenberg, Maximiliano Daigre y Alejandro Simeone",
    year: 2026,
    source: "PeerJ",
    kind: "Artículo científico",
    pages: 28,
    language: "Inglés",
    doi: "10.7717/peerj.20714"
  },
  {
    slug: "decreto-1-2024-plan-recoge-pinguino-humboldt",
    fileName: "Decreto 1_2024_ APRUEBA PLAN RECOGE PINGÜINO DE HUMBOLDT (SPHENISCUS HUMBOLDTI).pdf",
    title: "Aprueba Plan de Recuperación, Conservación y Gestión del Pingüino de Humboldt (Spheniscus humboldti)",
    authors: "Ministerio del Medio Ambiente de Chile",
    year: 2024,
    source: "Biblioteca del Congreso Nacional de Chile",
    kind: "Instrumento público",
    pages: 32,
    language: "Español",
    note: "Texto oficial del decreto que aprueba el Plan RECOGE para la especie."
  },
  {
    slug: "arce-2024-manual-censos-pinguino-humboldt",
    fileName: "Arce P 2024_Manual de metodologías de monitoreo del pingüino de Humboldt en Chile_ Informe Oikonos.pdf",
    title: "Manual técnico y metodológico para realizar censos de pingüino de Humboldt (Spheniscus humboldti) en Chile",
    authors: "Paulina Arce Escobar",
    year: 2024,
    source: "Oikonos Ecosystem Knowledge",
    kind: "Manual técnico",
    pages: 37,
    language: "Español"
  },
  {
    slug: "munoz-2024-h5n1-mass-mortality",
    fileName: "Munoz et al 2024 H5N1.pdf",
    title: "Stranding and mass mortality in Humboldt penguins (Spheniscus humboldti), associated to HPAIV H5N1 outbreak in Chile",
    authors: "Gabriela Muñoz et al.",
    year: 2024,
    source: "Preventive Veterinary Medicine",
    kind: "Artículo científico",
    pages: 8,
    language: "Inglés",
    doi: "10.1016/j.prevetmed.2024.106206"
  },
  {
    slug: "simeone-2023-unravelling-population-size-foraging",
    fileName: "Simeone et al 2023_Unravelibg the population_Final_report.pdf",
    title: "Unravelling the population size and the foraging behaviour of Humboldt penguins in Chile",
    authors: "Alejandro Simeone, Guillermo Luna-Jorquera, Ursula Ellenberg y Thomas Mattern",
    year: 2023,
    source: "Project Final Report",
    kind: "Informe final",
    pages: 53,
    language: "Inglés",
    note: "El nombre del archivo tiene un error tipográfico, pero el título interno del documento está corregido."
  },
  {
    slug: "lerma-2023-corticosterone-foraging-diving",
    fileName: "Lerma et al 2023_Corticosterone levels, leukocyte pro!les, and foraging and diving behaviours of Humboldt penguins_EMU.pdf",
    title: "Corticosterone levels, leukocyte profiles, and foraging and diving behaviours of Humboldt penguins during chick rearing in Northern Chile",
    authors: "Miriam Lerma et al.",
    year: 2023,
    source: "EMU - Austral Ornithology",
    kind: "Artículo científico",
    pages: 8,
    language: "Inglés",
    doi: "10.1080/01584197.2022.2153699"
  },
  {
    slug: "conaf-2022-propuesta-plan-recuperacion",
    fileName: "CONAF 2022_Propuesta Plan de Recuperación, Conservación y Gestión del Pingüino de Humboldt (Spheniscus humboldti).pdf",
    title: "Propuesta Plan de Recuperación, Conservación y Gestión del Pingüino de Humboldt (Spheniscus humboldti)",
    authors: "Departamento de Áreas Silvestres Protegidas, CONAF Región de Coquimbo",
    year: 2022,
    source: "Corporación Nacional Forestal",
    kind: "Informe técnico",
    pages: 45,
    language: "Español"
  },
  {
    slug: "celis-2022-excrements-trace-levels",
    fileName: "Celis 2022_Assessing the influence of Humboldt penguin (Spheniscus humboldti) by excrements on the levels of trace LAJAR.pdf",
    title: "Assessing the influence of Humboldt penguin (Spheniscus humboldti) excrements on the levels of trace elements",
    authors: "José E. Celis et al.",
    year: 2022,
    source: "Latin American Journal of Aquatic Research",
    kind: "Artículo científico",
    pages: 8,
    language: "Inglés",
    doi: "10.3856/vol50-issue5-fulltext-2933"
  },
  {
    slug: "vargas-rodriguez-2022-monitoreo-institucional-isla-choros",
    fileName: "Vargas Rodriguez 2022_Biodiversidata_Pinguinode Humboldt.pdf",
    title: "Monitoreo institucional de largo plazo de la colonia reproductiva del pingüino de Humboldt (Spheniscus humboldti) en la isla Choros de la Reserva Nacional Pingüino de Humboldt",
    authors: "Vargas Rodríguez et al.",
    year: 2022,
    source: "Biodiversidata / documento técnico",
    kind: "Informe técnico",
    pages: 10,
    language: "Español"
  },
  {
    slug: "mcgill-2021-phva-informe-final-espanol",
    fileName: "McGill 2021_Pingüino de Humboldt. Taller de Evaluación de Viabilidad de Población y Hábitat (PHVA) Informe Final (Español).pdf",
    title: "Pingüino de Humboldt: Taller de Evaluación de Viabilidad de Población y Hábitat (PHVA), informe final (español)",
    authors: "ACOREMA",
    year: 2021,
    source: "PHVA / informe técnico",
    kind: "Informe técnico",
    pages: 130,
    language: "Español",
    note: "Versión en español del informe PHVA distribuida desde una copia asociada a ACOREMA y ResearchGate."
  },
  {
    slug: "phva-2021-informe-final-spanish",
    fileName: "Pingüino de Humboldt PHVA Informe Final_Spanish.pdf",
    title: "Pingüino de Humboldt (Spheniscus humboldti): Taller de Evaluación de Viabilidad de Población y Hábitat, informe final",
    authors: "ACOREMA, Saint Louis Zoo e IUCN SSC Conservation Planning Specialist Group",
    year: 2021,
    source: "PHVA / informe técnico",
    kind: "Informe técnico",
    pages: 129,
    language: "Español",
    note: "Documento muy cercano a la otra versión PHVA de la carpeta; conviene revisar si ambas copias son necesarias."
  },
  {
    slug: "quispe-2020-foraging-ranges-tilgo-island",
    fileName: "Quispe et al 2020. Foraging ranges of Humboldt penguins Spheniscus humboldti from Tilgo island_Marine Ornithology 48_2_205-208.pdf",
    title: "Foraging ranges of Humboldt penguins Spheniscus humboldti from Tilgo Island: the critical need for protecting a unique marine habitat",
    authors: "René Quispe et al.",
    year: 2020,
    source: "Marine Ornithology",
    kind: "Artículo científico",
    pages: 5,
    language: "Inglés"
  },
  {
    slug: "informe-fipa-2018-43-estado-poblacional-reservas-marinas",
    fileName: "Informe Final Proyecto FIPA 2018-43 .pdf",
    title: "Determinación del estado poblacional en las reservas marinas Isla Chañaral e Islas Choros y Damas, de las especies delfín nariz de botella, chungungo, pingüino de Humboldt y cetáceos",
    authors: "Universidad de Valparaíso",
    year: 2020,
    source: "Proyecto FIPA 2018-43",
    kind: "Informe final",
    pages: 441,
    language: "Español"
  },
  {
    slug: "dantas-2019-population-structure-pacific-coast",
    fileName: "Dantas et al 2019_Uncovering population structure in the Humboldt penguin along the Pacific coast at South America_PlosONE 14e0215293.pdf",
    title: "Uncovering population structure in the Humboldt penguin (Spheniscus humboldti) along the Pacific coast at South America",
    authors: "Gisele P. M. Dantas et al.",
    year: 2019,
    source: "PLOS ONE",
    kind: "Artículo científico",
    pages: 19,
    language: "Inglés",
    doi: "10.1371/journal.pone.0215293"
  },
  {
    slug: "portflitt-toro-2018-aves-marinas-varadas-coquimbo",
    fileName: "Portflitt-Toro et al 2018_Aves marinas varadas en la bahía de Coquimbo, norte de Chile ¿Qué especies y cuántas mueren_RevBioMAr.pdf",
    title: "Aves marinas varadas en la bahía de Coquimbo, norte de Chile: ¿Qué especies y cuántas mueren?",
    authors: "Matías Portflitt-Toro et al.",
    year: 2018,
    source: "Revista de Biología Marina y Oceanografía",
    kind: "Artículo científico",
    pages: 10,
    language: "Español",
    doi: "10.22370/rbmo.2018.53.2.1292"
  },
  {
    slug: "alvarez-varas-2018-mercury-exposure",
    fileName: "Alvarez et al 2018 Mercury Exposure in Humboldt (Spheniscus humboldti) and Chinstrap (Pygoscelis antarcticus) Penguins Throughout the Chile.pdf",
    title: "Mercury Exposure in Humboldt (Spheniscus humboldti) and Chinstrap (Pygoscelis antarcticus) Penguins Throughout the Chilean Coast and Antarctica",
    authors: "Rocío Álvarez-Varas et al.",
    year: 2018,
    source: "Archives of Environmental Contamination and Toxicology",
    kind: "Artículo científico",
    pages: 12,
    language: "Inglés",
    doi: "10.1007/s00244-018-0529-7"
  },
  {
    slug: "fipa-2016-33-censo-pinguinos-humboldt",
    fileName: "INFORME FINAL Proyecto FIPA N°2016-33_2018  “Censo de Pingüinos de Humboldt”.pdf",
    title: "Informe final Proyecto FIPA N°2016-33: Censo de pingüinos de Humboldt",
    authors: "Corporación CULTAM y Alejandro Simeone C.",
    year: 2018,
    source: "Proyecto FIPA 2016-33",
    kind: "Informe final",
    pages: 62,
    language: "Español"
  },
  {
    slug: "celis-2014-trace-metals-porphyrins-excreta",
    fileName: "Celis et al 2014_Assessment of trace metals and porphyrins in excreta of Humboldt penguins_EnvironMonit Assess.pdf",
    title: "Assessment of trace metals and porphyrins in excreta of Humboldt penguins (Spheniscus humboldti) in different locations of the northern coast of Chile",
    authors: "José E. Celis, Winfred Espejo, Daniel González-Acuña, Solange Jara y Ricardo Barra",
    year: 2014,
    source: "Environmental Monitoring and Assessment",
    kind: "Artículo científico",
    pages: 10,
    language: "Inglés",
    doi: "10.1007/s10661-013-3495-6"
  },
  {
    slug: "vianna-2014-changes-abundance-distribution",
    fileName: "Vianna et al 2014_Changes in abundance and distribution of humboldt Penguin Spheniscus humboldti_MO42_2_153-159.pdf",
    title: "Changes in abundance and distribution of Humboldt Penguin Spheniscus humboldti",
    authors: "Juliana A. Vianna et al.",
    year: 2014,
    source: "Marine Ornithology",
    kind: "Artículo científico",
    pages: 7,
    language: "Inglés"
  },
  {
    slug: "simeone-luna-jorquera-2012-rat-predation",
    fileName: "Simeone & Luna Jorquera 2012_Estimating rat predation on Humboldt Penguin colonies.pdf",
    title: "Estimating rat predation on Humboldt Penguin colonies in north-central Chile",
    authors: "Alejandro Simeone y Guillermo Luna-Jorquera",
    year: 2012,
    source: "Journal of Ornithology",
    kind: "Artículo científico",
    pages: 7,
    language: "Inglés",
    doi: "10.1007/s10336-012-0837-z"
  },
  {
    slug: "plaza-2010-sitios-nidificacion-tesis",
    fileName: "Plaza_P 2010_Uso_de_sitios_de_nidificacion del Pinguino de Humboldt_Tesis de Magister UNAB.pdf",
    title: "Uso de sitios de nidificación del pingüino de Humboldt",
    authors: "P. Plaza",
    year: 2010,
    source: "Universidad Andrés Bello",
    kind: "Tesis de magíster",
    pages: 55,
    language: "Español"
  },
  {
    slug: "ucn-2008-linea-base-reservas-marinas",
    fileName: "UCN 2008_INFORME FINAL PROYECTO FIP 2006-56 EVALUACION DE LINEA BASE DE LAS RESERVAS MARINAS “ISLA CHAÑARAL” E “ISLA CHOROSDAMAS”.pdf",
    title: "Informe final proyecto FIP 2006-56: evaluación de línea base de las reservas marinas Isla Chañaral e Isla Choros-Damas",
    authors: "Facultad de Ciencias del Mar, Universidad Católica del Norte",
    year: 2008,
    source: "Proyecto FIP 2006-56",
    kind: "Informe final",
    pages: 532,
    language: "Español"
  },
  {
    slug: "ellenberg-2006-human-disturbance",
    fileName: "Ellenberg et al 2006 Physiological and reproductive consequences of human disturbance in Humboldt Penguin_BC133.pdf",
    title: "Physiological and reproductive consequences of human disturbance in Humboldt penguins: The need for species-specific visitor management",
    authors: "Ursula Ellenberg, Thomas Mattern, Philip J. Seddon y Guillermo Luna-Jorquera",
    year: 2006,
    source: "Biological Conservation",
    kind: "Artículo científico",
    pages: 12,
    language: "Inglés",
    doi: "10.1016/j.biocon.2006.05.019"
  },
  {
    slug: "herling-2005-diet-northern-southern-chile",
    fileName: "Herling et al 2005_Diet of the Humboldt penguin (Spheniscus humboldti _Marine Biology 147_13-25.pdf",
    title: "Diet of the Humboldt penguin (Spheniscus humboldti) in northern and southern Chile",
    authors: "C. Herling, B. M. Culik y J. C. Hennicke",
    year: 2005,
    source: "Marine Biology",
    kind: "Artículo científico",
    pages: 13,
    language: "Inglés",
    doi: "10.1007/s00227-004-1547-8"
  },
  {
    slug: "mattern-2004-census-isla-chanaral",
    fileName: "Mattern et al 2004_Humboldt Penguin Census on Isla Chañaral, Chile Recent Increase or Past Underestimate of.pdf",
    title: "Humboldt Penguin Census on Isla Chañaral, Chile: Recent Increase or Past Underestimate of Penguin Numbers?",
    authors: "Thomas Mattern, Ursula Ellenberg, Guillermo Luna-Jorquera y Lloyd S. Davis",
    year: 2004,
    source: "Waterbirds",
    kind: "Artículo científico",
    pages: 10,
    language: "Inglés"
  },
  {
    slug: "simeone-2004-thermoregulation-roosting",
    fileName: "Simeone et al 2004_Seasonal variations in the behavioural thermoregulation of roosting_fornithology.pdf",
    title: "Seasonal variations in the behavioural thermoregulation of roosting Humboldt penguins",
    authors: "Alejandro Simeone et al.",
    year: 2004,
    source: "Journal of Ornithology",
    kind: "Artículo científico",
    pages: 6,
    language: "Inglés",
    doi: "10.1007/s10336-003-0005-6"
  },
  {
    slug: "culik-luna-jorquera-1997-satellite-tracking",
    fileName: "Culik & Luna-Jorquera 1997 Satellite tracking of Humboldt penguins (Spheniscus humboldti )_Marine Biology.pdf",
    title: "Satellite tracking of Humboldt penguins (Spheniscus humboldti) in northern Chile",
    authors: "B. M. Culik y G. Luna-Jorquera",
    year: 1997,
    source: "Marine Biology",
    kind: "Artículo científico",
    pages: 10,
    language: "Inglés"
  },
  {
    slug: "luna-jorquera-1996-thermal-conductance",
    fileName: "Luna-Jorquera et al. 1997. Observations on the thermal conductance of Adélie and Humboldt Penguin. Pol Bio.pdf",
    title: "Observations on the thermal conductance of Adélie (Pygoscelis adeliae) and Humboldt (Spheniscus humboldti) penguins",
    authors: "Guillermo Luna-Jorquera et al.",
    year: 1996,
    source: "Polar Biology",
    kind: "Artículo científico",
    pages: 6,
    language: "Inglés",
    doi: "10.1007/s003000050106"
  },
  {
    slug: "wilson-1989-diving-behaviour-prey",
    fileName: "Wilson, et al 1989. Diving behaviour and prey of the Humboldt penguin (Spheniscus humboldti). JFOrnithol.pdf",
    title: "Diving behaviour and prey of the Humboldt Penguin (Spheniscus humboldti)",
    authors: "R. P. Wilson et al.",
    year: 1989,
    source: "Journal of Ornithology",
    kind: "Artículo científico",
    pages: 6,
    language: "Inglés",
    doi: "10.1007/BF01647164"
  }
];

const resolvePaperUrl = (fileName: string) => {
  const modulePath = `../assets/papers/HUPE_ACMU/${fileName}`;
  const assetUrl = paperAssetModules[modulePath];
  if (!assetUrl) {
    throw new Error(`Paper asset not found for ${fileName}`);
  }
  return assetUrl;
};

export const sciencePapers: SciencePaperRecord[] = definitions
  .map((paper) => ({
    ...paper,
    url: resolvePaperUrl(paper.fileName),
    downloadName: paper.fileName
  }))
  .sort((a, b) => b.year - a.year || a.title.localeCompare(b.title, "es"));

