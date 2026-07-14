#!/bin/bash

# Script de synchronisation rapide vers GitHub

# Couleurs pour le terminal
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Synchronisation vers GitHub ===${NC}"

# Demander le message de commit
echo -e "${YELLOW}Entrez un message pour décrire vos modifications (ou appuyez sur Entrée pour 'Mise à jour'):${NC}"
read -r commit_message

if [ -z "$commit_message" ]; then
  commit_message="Mise à jour"
fi

# Stage les fichiers
echo -e "${BLUE}1. Préparation des fichiers...${NC}"
git add .

# Vérifier s'il y a des changements à commiter
if git diff-index --quiet HEAD --; then
  echo -e "${YELLOW}Aucun changement détecté en local.${NC}"
else
  # Commit
  echo -e "${BLUE}2. Enregistrement des modifications (${commit_message})...${NC}"
  git commit -m "$commit_message"
fi

# Push
echo -e "${BLUE}3. Envoi vers GitHub...${NC}"
if git push origin main; then
  echo -e "${GREEN}✓ Code envoyé avec succès sur GitHub !${NC}"
  echo -e "${GREEN}Le déploiement automatique vers Hostinger va démarrer sur GitHub Actions.${NC}"
else
  echo -e "${RED}✗ Échec de l'envoi vers GitHub. Vérifiez votre connexion ou les paramètres du dépôt.${NC}"
fi
