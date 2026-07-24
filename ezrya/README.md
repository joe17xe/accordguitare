# EZRYA — Quittances de loyer (siège social)

Documents justificatifs de la mise à disposition d'un bureau (siège social)
par **Joe & Josette ABI NADER** à la **SASU EZRYA**, en exécution de la
**convention de mise à disposition de locaux du 17/02/2026**.

## Contexte (rappel de la convention)

| Élément | Valeur |
|---|---|
| Bailleurs (propriétaires) | Joe ABI NADER **et** Josette ABI NADER |
| Preneur | SASU EZRYA — RCS Versailles 101 329 365 |
| Bien | Bureau d'env. 20 m² (sur 110 m²), 30 rue d'Armagnac, 78450 Villepreux |
| Prise d'effet | 17/02/2026 |
| Loyer (indemnité, art. 5) | **445,00 €/mois** — *non soumise à TVA* |
| Charges (électricité + internet, art. 5) | **70,00 €/mois** (forfait) |
| **Total mensuel** | **515,00 €/mois** |

## Quittances émises — rapprochement avec les dépenses EZRYA

Chaque quittance correspond à une opération de débit du compte EZRYA :

| Quittance | Période | Loyer | Charges | **Total** | Payé le | Opération bancaire |
|---|---|---:|---:|---:|---|---|
| [`2026-001`](quittances/Quittance_EZRYA_2026-001.pdf) | 17/02 → 31/05/2026 | 1 509,54 € | 237,46 € | **1 747,00 €** | 20/05/2026 | « Location Siège social 17 février à mai » |
| [`2026-002`](quittances/Quittance_EZRYA_2026-002.pdf) | Juin 2026 | 445,00 € | 70,00 € | **515,00 €** | 01/06/2026 | « Loyer mensuel siège social » |

### Détail de la quittance 2026-001 (rattrapage 17/02 → mai)

| Période | Loyer | Charges | Total |
|---|---:|---:|---:|
| Février 2026 (prorata à compter du 17/02) | 174,54 € | 27,46 € | 202,00 € |
| Mars 2026 | 445,00 € | 70,00 € | 515,00 € |
| Avril 2026 | 445,00 € | 70,00 € | 515,00 € |
| Mai 2026 | 445,00 € | 70,00 € | 515,00 € |
| **Total** | **1 509,54 €** | **237,46 €** | **1 747,00 €** |

> Le mois de février est calculé au prorata à compter de la prise d'effet
> (17/02/2026). Le montant retenu (202,00 €) est celui qui permet de
> retrouver exactement la somme réglée (1 747,00 €). À ajuster si un autre
> mode de calcul du prorata a été appliqué.

## Facture ou quittance ?

Les bailleurs sont des **particuliers** et l'indemnité **n'est pas soumise à
la TVA** (art. 5 de la convention). Dans ce cas, le document approprié n'est
pas une « facture » commerciale (réservée aux assujettis à la TVA) mais une
**quittance de loyer**, qui vaut pièce justificative pour la comptabilité
d'EZRYA. Ces quittances sont donc les justificatifs à rattacher aux deux
dépenses ci-dessus.

Si le cabinet comptable souhaite un format « avis d'échéance / appel de
loyer » (émis *avant* paiement), il peut être généré sur simple demande.

## Régénérer les PDF

Les sources HTML et le script se trouvent dans [`sources/`](sources/).

```bash
# 1) (re)générer le HTML
python3 sources/generate_quittances.py
# 2) convertir en PDF (Chromium headless)
CHROME=/opt/pw-browsers/chromium-1194/chrome-linux/chrome
for n in 2026-001 2026-002; do
  "$CHROME" --headless --disable-gpu --no-sandbox --no-pdf-header-footer \
    --print-to-pdf="quittances/Quittance_EZRYA_$n.pdf" \
    "file://$PWD/sources/Quittance_EZRYA_$n.html"
done
```
