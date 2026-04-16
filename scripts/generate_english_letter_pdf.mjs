/**
 * Generates the English version of the open letter as a PDF.
 * Based on the original Spanish letter: "Carta abierta de la comunidad científica"
 * Run: node scripts/generate_english_letter_pdf.mjs
 * Output: public/assets/open-letter-humboldt-penguin-en.pdf
 */
import PDFDocument from "pdfkit";
import { createWriteStream } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputPath = join(__dirname, "../public/assets/open-letter-humboldt-penguin-en.pdf");

const doc = new PDFDocument({
  size: "LETTER",
  margins: { top: 70, bottom: 70, left: 72, right: 72 },
  info: {
    Title: "Concern for the Conservation Status of the Humboldt Penguin in Chile",
    Author: "Scientific Community — Es más que un pingüino Campaign",
    Subject: "Open letter requesting reinstatement of the Natural Monument decree for the Humboldt Penguin",
    Keywords: "Humboldt Penguin, Natural Monument, Chile, conservation, open letter, scientific community",
    CreationDate: new Date("2026-04-01")
  }
});

const stream = createWriteStream(outputPath);
doc.pipe(stream);

// ── Colours ───────────────────────────────────────────────────────────────────
const navy   = "#05070B";
const sky    = "#38B6FF";
const muted  = "#4A5568";
const body   = "#1A202C";
const rule   = "#CBD5E0";

const W = doc.page.width - doc.page.margins.left - doc.page.margins.right;

// ── Top rule ──────────────────────────────────────────────────────────────────
doc.rect(0, 0, doc.page.width, 6).fill(sky);

// ── Header ────────────────────────────────────────────────────────────────────
doc.moveDown(0.6);
doc.font("Helvetica-Bold").fontSize(7.5).fillColor(sky)
  .text("ES MÁS QUE UN PINGÜINO  ·  CITIZEN CAMPAIGN  ·  esmasqueunpinguino.cl",
        { align: "center", characterSpacing: 1.2 });

doc.moveDown(1);
doc.font("Helvetica-Bold").fontSize(11).fillColor(muted)
  .text("Chile, April 2026", { align: "center" });

doc.moveDown(0.6);
doc.font("Helvetica-Bold").fontSize(17).fillColor(navy)
  .text(
    "Concern for the Conservation Status of the Humboldt Penguin\n" +
    "in Chile and the Case for Reinstating the Natural Monument Decree",
    { align: "center", lineGap: 4 }
  );

doc.moveDown(0.6);
doc.font("Helvetica-BoldOblique").fontSize(12).fillColor(sky)
  .text("Open letter from the scientific community", { align: "center" });

// ── Divider ───────────────────────────────────────────────────────────────────
doc.moveDown(0.9);
doc.moveTo(72, doc.y).lineTo(72 + W, doc.y).strokeColor(rule).lineWidth(0.8).stroke();
doc.moveDown(0.8);

// ── Body helper ───────────────────────────────────────────────────────────────
const para = (text) => {
  doc.font("Helvetica").fontSize(10.5).fillColor(body)
    .text(text, { align: "justify", lineGap: 2.5 });
  doc.moveDown(0.65);
};

// ── Body ──────────────────────────────────────────────────────────────────────
para(
  "We, the undersigned scientists dedicated to the study and conservation of the Humboldt Penguin, " +
  "wish to express the importance of reinstating to formal proceedings the decree that declares the " +
  "Humboldt Penguin (Spheniscus humboldti) a Natural Monument species."
);

para(
  "The most recent scientific evidence is robust and conclusive: the latest census conducted in 2025 " +
  "across the main reproductive colonies in Chile indicates that the population has declined to fewer " +
  "than 2,000 breeding pairs. This figure represents a critical level of abundance and reflects a " +
  "sustained downward population trend over recent decades — the reason the species was reclassified " +
  "as Endangered in 2025."
);

para(
  "The colonies of north-central Chile have experienced a reduction of more than 60% over the last " +
  "5 years. These figures stand in stark contrast with historical estimates that indicated significantly " +
  "larger populations, exceeding 30,000 individuals toward the end of the last century. Since 2017, " +
  "evidence has already shown signs of decline, which has intensified alarmingly in recent years. " +
  "Chile has historically hosted 80% of the global Humboldt Penguin population. Currently, in Peru, " +
  "where the remaining 20% reside, historically low population figures have also been recorded."
);

para(
  "In recent years, events have arisen that make protecting this species even more necessary. Between " +
  "2022 and 2023, SERNAPESCA documented the deaths of more than 3,000 individuals as a consequence of " +
  "Highly Pathogenic Avian Influenza (HPAI), of which only a fraction could be confirmed as directly " +
  "related to the disease — suggesting that other factors also contributed to these deaths. Concurrently, " +
  "the El Niño phenomenon intensified during this period, causing reduced prey availability, which led " +
  "to the interruption of breeding. Added to this is the constant pressure of threats such as incidental " +
  "capture in fishing nets, competition for resources, pollution (hydrocarbons and plastics), and " +
  "habitat disturbance from increasing anthropogenic pressure — all intensifying their effects on " +
  "the species. Consequently, there is an urgent need to increase its protection effectively across " +
  "the entire territory, including by implementing the Natural Monument decree."
);

para(
  "The Humboldt Penguin is supported by a legal and technical protection framework. At the international " +
  "level, its conservation is backed by its inclusion in Appendices I and II of the Convention on the " +
  "Conservation of Migratory Species (CMS) and Appendix I of CITES, and it is still categorised as " +
  "\"Vulnerable\" on the IUCN Red List pending an update of supporting data."
);

para(
  "At the national level, its status has recently been elevated to \"Endangered\" in accordance with " +
  "the Species Classification Regulation (Decree 54/2025, MMA). It is also considered a hydrobiological " +
  "resource under the General Fisheries and Aquaculture Act (Law 18,892 of 1989 and its amendments), " +
  "which entails specific protections. Complementing this is Decree 204/2025 (SUBPESCA), which renews " +
  "the national extractive ban for a period of 30 years, and Decree 38/2011 on the observation of " +
  "marine mammals, reptiles, and birds, establishing norms for their observation and approach. " +
  "Additionally, the species has a Recovery, Conservation and Management Plan (Decree 01/2024, MMA), " +
  "developed through participatory planning."
);

para(
  "The Humboldt Penguin is a key bioindicator of the health of the marine ecosystem of the Humboldt " +
  "Current. Marine birds and mammals are relevant components of the Humboldt Current System, as they " +
  "contribute, among other functions, essential nutrients for marine productivity, which in turn " +
  "sustains fishery resources of global importance. Their decline reflects a broader deterioration " +
  "of the ocean, upon which — directly and indirectly — all human life depends."
);

para(
  "Despite this critical scenario, biological evidence indicates that the Humboldt Penguin has " +
  "recovery capacity, given its reproductive potential of up to two breeding events per year. " +
  "Previous experiences in Peru have demonstrated that the species can recover even after severe " +
  "declines, provided that threats are reduced and adequate environmental conditions are ensured. " +
  "Recovery is possible, but it depends on the urgent, effective, and sustained implementation of " +
  "conservation measures based on the best available scientific evidence."
);

para(
  "The presence of Avian Influenza detected in Chile in March 2026, combined with climate projections " +
  "suggesting the recurrence of an extremely strong El Niño event during the current year, raises the " +
  "alert level for the conservation of the species along the Chilean coast."
);

para(
  "In this context, advancing and strengthening protective measures is not optional — it is urgent. " +
  "Instruments such as the Natural Monument designation constitute concrete tools for safeguarding " +
  "the species, granting it a higher level of protection and highlighting its ecological and social " +
  "relevance. This process also has significant public support, evidenced by the participation of " +
  "more than 9,000 people in the associated public consultation."
);

para(
  "The challenge is clear: to align science, public policy, and civic engagement to ensure the " +
  "protection of this emblematic species of the ecosystem it represents."
);

para(
  "Protecting the Humboldt Penguin means not only safeguarding a species, but also preserving the " +
  "health of the ocean and, with it, the well-being of present and future generations."
);

// ── Signatories ───────────────────────────────────────────────────────────────
doc.moveDown(0.3);
doc.moveTo(72, doc.y).lineTo(72 + W, doc.y).strokeColor(rule).lineWidth(0.5).stroke();
doc.moveDown(0.7);

doc.font("Helvetica-Bold").fontSize(10.5).fillColor(body)
  .text("This letter is signed by:");
doc.moveDown(0.3);
doc.font("Helvetica-Oblique").fontSize(10.5).fillColor(body)
  .text(
    "Alejandro Simeone, Guillermo Luna-Jorquera, and Verónica López Latorre,\n" +
    "on behalf of the scientific community studying the Humboldt Penguin in Chile.",
    { lineGap: 2.5 }
  );
doc.moveDown(0.5);
doc.font("Helvetica").fontSize(10.5).fillColor(body)
  .text("Endorsed by the citizens who have signed this open letter.", { align: "justify" });

// ── Footer ────────────────────────────────────────────────────────────────────
doc.moveDown(1);
doc.moveTo(72, doc.y).lineTo(72 + W, doc.y).strokeColor(rule).lineWidth(0.5).stroke();
doc.moveDown(0.5);
doc.font("Helvetica").fontSize(8.5).fillColor(muted)
  .text(
    "Sign and learn more at esmasqueunpinguino.cl  ·  Signature collection open until April 20, 2026  ·  @esmasqueunpinguino",
    { align: "center" }
  );

// ── Bottom rule ───────────────────────────────────────────────────────────────
doc.rect(0, doc.page.height - 6, doc.page.width, 6).fill(sky);

doc.end();

stream.on("finish", () => {
  console.log(`✓ PDF written to: ${outputPath}`);
});
stream.on("error", (err) => {
  console.error("PDF generation failed:", err);
  process.exit(1);
});
