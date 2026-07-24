#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Génère les quittances de loyer de la SASU EZRYA au titre de la
convention de mise à disposition de locaux du 17/02/2026.

Produit un fichier HTML par quittance dans ./ (sources), destiné à être
converti en PDF via Chromium (--print-to-pdf).
"""
import os

# --------------------------------------------------------------------------
# Données de référence (issues de la convention et des relevés bancaires)
# --------------------------------------------------------------------------
BAILLEURS = "Monsieur Joe ABI NADER et Madame Josette ABI NADER"
BAILLEUR_ADRESSE = "30 rue d'Armagnac, 78450 Villepreux"

PRENEUR_NOM = "SASU EZRYA"
PRENEUR_DETAIL = [
    "Société par actions simplifiée unipersonnelle au capital de 500,00 €",
    "Siège social : 30 rue d'Armagnac, 78450 Villepreux",
    "RCS Versailles 101 329 365",
    "Représentée par M. Joe ABI NADER, Président",
]

BIEN = ("Un bureau d'une superficie d'environ 20 m² faisant partie de "
        "l'ensemble immobilier (110 m²) sis 30 rue d'Armagnac, 78450 Villepreux")

CONVENTION_DATE = "17/02/2026"
LOYER_MENSUEL = 445.00   # indemnité mensuelle, non soumise à TVA (art. 5)
CHARGES_MENSUEL = 70.00  # forfait électricité + internet (art. 5)

LIEU = "Villepreux"


def eur(x):
    """Formate un montant en euros à la française : 1 747,00 €."""
    s = f"{x:,.2f}".replace(",", " ").replace(".", ",")
    return f"{s} €"


# --------------------------------------------------------------------------
# Gabarit HTML
# --------------------------------------------------------------------------
CSS = """
* { box-sizing: border-box; }
@page { size: A4; margin: 16mm 18mm; }
html, body { margin: 0; padding: 0; }
body {
  font-family: 'Liberation Sans', 'DejaVu Sans', Arial, sans-serif;
  color: #1f2a37; font-size: 11.2px; line-height: 1.5;
}
.doc { max-width: 100%; }
.head {
  display: flex; justify-content: space-between; align-items: flex-start;
  border-bottom: 3px solid #14425f; padding-bottom: 12px; margin-bottom: 18px;
}
.head .title { font-size: 22px; font-weight: 700; color: #14425f; letter-spacing: .5px; }
.head .subtitle { font-size: 11px; color: #5b6b7a; margin-top: 3px; }
.head .ref { text-align: right; font-size: 10.5px; color: #5b6b7a; }
.head .ref b { color: #14425f; }
.parties { display: flex; gap: 14px; margin-bottom: 16px; }
.card {
  flex: 1; border: 1px solid #d8dee6; border-radius: 6px; padding: 10px 12px;
  background: #f7f9fb;
}
.card .lbl {
  font-size: 9px; text-transform: uppercase; letter-spacing: .8px;
  color: #14425f; font-weight: 700; margin-bottom: 4px;
}
.card .name { font-weight: 700; font-size: 12px; }
.card .line { font-size: 10px; color: #46566a; }
.section-lbl {
  font-size: 9px; text-transform: uppercase; letter-spacing: .8px;
  color: #14425f; font-weight: 700; margin: 16px 0 6px;
}
.body-text { text-align: justify; }
.body-text .amount { font-weight: 700; color: #14425f; }
table.detail { width: 100%; border-collapse: collapse; margin-top: 6px; }
table.detail th {
  background: #14425f; color: #fff; font-size: 9.5px; text-transform: uppercase;
  letter-spacing: .5px; padding: 7px 9px; text-align: left; font-weight: 600;
}
table.detail th.num, table.detail td.num { text-align: right; }
table.detail td { padding: 6px 9px; border-bottom: 1px solid #e5e9ef; }
table.detail tr:nth-child(even) td { background: #f7f9fb; }
table.detail tr.total td {
  font-weight: 700; color: #14425f; border-top: 2px solid #14425f;
  background: #eef3f7; font-size: 12px;
}
.recap { display: flex; gap: 14px; margin-top: 14px; }
.recap .box {
  flex: 1; border: 1px solid #d8dee6; border-radius: 6px; padding: 8px 12px;
}
.recap .box .k { font-size: 9px; text-transform: uppercase; color: #5b6b7a; letter-spacing:.6px;}
.recap .box .v { font-size: 13px; font-weight: 700; color: #14425f; margin-top:2px;}
.recap .box.big { background:#14425f; border-color:#14425f; }
.recap .box.big .k { color:#b9cddb; }
.recap .box.big .v { color:#fff; font-size: 16px; }
.sign { display: flex; justify-content: space-between; align-items: flex-end;
  margin-top: 26px; }
.sign .place { font-size: 10.5px; color:#46566a; }
.sign .sigbox { text-align: center; }
.sign .sigbox .lbl { font-size: 10px; color:#5b6b7a; margin-bottom: 4px; }
.sign .sigbox .area {
  width: 210px; height: 66px; border: 1px dashed #b8c2ce; border-radius: 6px;
}
.sign .sigbox .who { font-size: 9.5px; color:#46566a; margin-top: 4px; }
.legal {
  margin-top: 26px; padding-top: 10px; border-top: 1px solid #e5e9ef;
  font-size: 8.6px; color: #7a8794; line-height: 1.45;
}
.legal b { color:#5b6b7a; }
"""


def render(qnum, period_label, intro_period_phrase, rows, total, total_letters,
           loyer_total, charges_total, paid_date, made_date):
    """Construit le HTML d'une quittance."""
    detail_rows = "".join(
        f"<tr><td>{lib}</td><td class='num'>{eur(l)}</td>"
        f"<td class='num'>{eur(c)}</td><td class='num'>{eur(l + c)}</td></tr>"
        for (lib, l, c) in rows
    )
    return f"""<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><style>{CSS}</style></head>
<body><div class="doc">

  <div class="head">
    <div>
      <div class="title">QUITTANCE DE LOYER</div>
      <div class="subtitle">Mise à disposition de locaux à usage de bureau &middot; {period_label}</div>
    </div>
    <div class="ref">
      Quittance <b>N&deg; {qnum}</b><br>
      Convention du {CONVENTION_DATE}<br>
      Établie le {made_date}
    </div>
  </div>

  <div class="parties">
    <div class="card">
      <div class="lbl">Bailleurs</div>
      <div class="name">{BAILLEURS}</div>
      <div class="line">{BAILLEUR_ADRESSE}</div>
      <div class="line">Propriétaires du bien</div>
    </div>
    <div class="card">
      <div class="lbl">Preneur / Locataire</div>
      <div class="name">{PRENEUR_NOM}</div>
      {''.join(f'<div class="line">{d}</div>' for d in PRENEUR_DETAIL)}
    </div>
  </div>

  <div class="section-lbl">Bien loué</div>
  <div class="body-text">{BIEN}</div>

  <div class="section-lbl">Quittance</div>
  <div class="body-text">
    Nous soussignés, {BAILLEURS}, déclarons avoir reçu de la société
    <b>EZRYA</b> la somme de <span class="amount">{total_letters}</span>
    (<span class="amount">{eur(total)}</span>), au titre du paiement du loyer et
    des charges {intro_period_phrase}, en exécution de la convention de mise à
    disposition de locaux en date du {CONVENTION_DATE}, et lui en donnons
    quittance, sous réserve de tous nos droits.
  </div>

  <div class="section-lbl">Détail du règlement</div>
  <table class="detail">
    <thead><tr>
      <th>Période</th><th class="num">Loyer</th>
      <th class="num">Provision&nbsp;pour&nbsp;charges</th><th class="num">Total</th>
    </tr></thead>
    <tbody>
      {detail_rows}
      <tr class="total"><td>TOTAL</td><td class="num">{eur(loyer_total)}</td>
      <td class="num">{eur(charges_total)}</td><td class="num">{eur(total)}</td></tr>
    </tbody>
  </table>

  <div class="recap">
    <div class="box"><div class="k">Date du paiement</div><div class="v">{paid_date}</div></div>
    <div class="box"><div class="k">Mode</div><div class="v">Virement bancaire</div></div>
    <div class="box big"><div class="k">Montant acquitté</div><div class="v">{eur(total)}</div></div>
  </div>

  <div class="sign">
    <div class="place">Fait à {LIEU}, le {made_date}.<br>Établie en deux exemplaires.</div>
    <div class="sigbox">
      <div class="lbl">Signature des bailleurs</div>
      <div class="area"></div>
      <div class="who">Joe ABI NADER &nbsp;&middot;&nbsp; Josette ABI NADER</div>
    </div>
  </div>

  <div class="legal">
    <b>Indemnité d'occupation non soumise à la TVA</b> (article&nbsp;5 de la convention).
    La présente quittance vaut justificatif de paiement pour la période indiquée et
    annule tout reçu partiel qui aurait pu être établi précédemment pour la même
    échéance. Document à conserver par les parties à titre de pièce justificative.
  </div>

</div></body></html>"""


# --------------------------------------------------------------------------
# Quittance N° 2026-001 — rattrapage 17/02/2026 au 31/05/2026 (1 747,00 €)
# --------------------------------------------------------------------------
# Février au prorata à compter du 17/02/2026 : solde permettant d'atteindre
# le montant effectivement réglé (1 747,00 €), réparti loyer/charges au
# prorata 445/70.
fev_total = 1747.00 - 3 * (LOYER_MENSUEL + CHARGES_MENSUEL)  # 202,00
fev_loyer = round(fev_total * LOYER_MENSUEL / (LOYER_MENSUEL + CHARGES_MENSUEL), 2)
fev_charges = round(fev_total - fev_loyer, 2)

rows1 = [
    ("Février 2026 (prorata à compter du 17/02)", fev_loyer, fev_charges),
    ("Mars 2026", LOYER_MENSUEL, CHARGES_MENSUEL),
    ("Avril 2026", LOYER_MENSUEL, CHARGES_MENSUEL),
    ("Mai 2026", LOYER_MENSUEL, CHARGES_MENSUEL),
]
loyer_total_1 = round(sum(r[1] for r in rows1), 2)
charges_total_1 = round(sum(r[2] for r in rows1), 2)
total_1 = round(loyer_total_1 + charges_total_1, 2)
assert total_1 == 1747.00, total_1

html1 = render(
    qnum="2026-001",
    period_label="Février (à compter du 17) à mai 2026",
    intro_period_phrase="pour la période de location du 17/02/2026 au 31/05/2026",
    rows=rows1, total=total_1, total_letters="mille sept cent quarante-sept euros",
    loyer_total=loyer_total_1, charges_total=charges_total_1,
    paid_date="20/05/2026", made_date="20/05/2026",
)

# --------------------------------------------------------------------------
# Quittance N° 2026-002 — Juin 2026 (515,00 €)
# --------------------------------------------------------------------------
rows2 = [("Juin 2026", LOYER_MENSUEL, CHARGES_MENSUEL)]
total_2 = round(LOYER_MENSUEL + CHARGES_MENSUEL, 2)
assert total_2 == 515.00

html2 = render(
    qnum="2026-002",
    period_label="Juin 2026",
    intro_period_phrase="pour la période de location du 01/06/2026 au 30/06/2026",
    rows=rows2, total=total_2, total_letters="cinq cent quinze euros",
    loyer_total=LOYER_MENSUEL, charges_total=CHARGES_MENSUEL,
    paid_date="01/06/2026", made_date="01/06/2026",
)

here = os.path.dirname(os.path.abspath(__file__))
out1 = os.path.join(here, "Quittance_EZRYA_2026-001.html")
out2 = os.path.join(here, "Quittance_EZRYA_2026-002.html")
with open(out1, "w", encoding="utf-8") as f:
    f.write(html1)
with open(out2, "w", encoding="utf-8") as f:
    f.write(html2)

print("Février prorata :", eur(fev_total), "=> loyer", eur(fev_loyer), "+ charges", eur(fev_charges))
print("Quittance 2026-001 total :", eur(total_1), "(loyer", eur(loyer_total_1), "+ charges", eur(charges_total_1), ")")
print("Quittance 2026-002 total :", eur(total_2))
print("Écrit :", out1)
print("Écrit :", out2)
