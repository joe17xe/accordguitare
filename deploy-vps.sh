#!/usr/bin/env bash
#
# Déploiement de AccordGuitare sur le VPS (serveur web Nginx)
# ----------------------------------------------------------
# À lancer SUR le VPS (par le Claude installé dessus, ou en SSH).
#
#   git pull  →  npm install  →  npm run build  →  copie dans la racine web  →  reload nginx
#
# Personnalisation : modifie les variables ci-dessous, ou surcharge-les
# à l'appel, ex. :
#   WEB_ROOT=/var/www/mon-site ./deploy-vps.sh
#
set -euo pipefail

# ---- Configuration (à adapter au VPS) ---------------------------------------
BRANCH="${BRANCH:-main}"                       # branche à déployer
WEB_ROOT="${WEB_ROOT:-/var/www/accordguitare}" # racine web servie par Nginx
NGINX_SERVICE="${NGINX_SERVICE:-nginx}"        # nom du service systemd
BUILD_DIR="dist"                               # sortie de `npm run build`
# Chemin de base de l'app pour un VPS servant le site à la racine du domaine.
export VITE_APP_BASE_PATH="${VITE_APP_BASE_PATH:-/}"
# -----------------------------------------------------------------------------

GREEN='\033[0;32m'; BLUE='\033[0;34m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${BLUE}▶ $*${NC}"; }
ok()    { echo -e "${GREEN}✓ $*${NC}"; }
warn()  { echo -e "${YELLOW}⚠ $*${NC}"; }
fail()  { echo -e "${RED}✗ $*${NC}" >&2; exit 1; }

# Se placer dans le dossier du script (racine du dépôt)
cd "$(dirname "$0")"

info "Déploiement de AccordGuitare (branche: ${BRANCH}) vers ${WEB_ROOT}"

# 1. Récupérer la dernière version
info "1/5 Mise à jour du code (git pull)…"
git fetch origin "${BRANCH}"
git checkout "${BRANCH}"
git reset --hard "origin/${BRANCH}"
ok "Code à jour ($(git rev-parse --short HEAD))"

# 2. Dépendances
info "2/5 Installation des dépendances (npm install)…"
npm install --no-audit --no-fund
ok "Dépendances installées"

# 3. Build
info "3/5 Build de production (npm run build)…"
npm run build
[ -d "${BUILD_DIR}" ] || fail "Le dossier de build '${BUILD_DIR}' est introuvable après le build."
ok "Build terminé"

# 4. Copie atomique vers la racine web
info "4/5 Copie des fichiers vers ${WEB_ROOT}…"
SUDO=""
if [ ! -w "$(dirname "${WEB_ROOT}")" ] && [ "$(id -u)" -ne 0 ]; then
  SUDO="sudo"
  warn "Écriture dans ${WEB_ROOT} via sudo."
fi
$SUDO mkdir -p "${WEB_ROOT}"
# rsync = copie incrémentale + suppression des fichiers obsolètes (--delete)
if command -v rsync >/dev/null 2>&1; then
  $SUDO rsync -a --delete "${BUILD_DIR}/" "${WEB_ROOT}/"
else
  warn "rsync absent, utilisation de cp (pas de nettoyage des anciens fichiers)."
  $SUDO rm -rf "${WEB_ROOT:?}/"*
  $SUDO cp -r "${BUILD_DIR}/." "${WEB_ROOT}/"
fi
ok "Fichiers copiés"

# 5. Recharger Nginx
info "5/5 Rechargement de Nginx…"
if $SUDO nginx -t 2>/dev/null; then
  $SUDO systemctl reload "${NGINX_SERVICE}" && ok "Nginx rechargé" \
    || warn "Impossible de recharger ${NGINX_SERVICE} (vérifie le nom du service)."
else
  warn "Configuration Nginx invalide ou 'nginx -t' inaccessible — reload ignoré."
fi

echo
ok "Déploiement terminé ! Le site est publié sur le VPS."
