#!/bin/bash
# Herdeploy-script voor devrijebaan.nl op de TransIP-VPS (xander8714-vps,
# 85.10.139.24). Dit is het ENIGE getrackte deploy-script — zowel de
# handmatige deploy als scripts/ververs-clubdata.ts roepen dit bestand aan,
# dus wijzigingen hier gelden voor allebei.
#
# Draai na elke git push naar master, vanuit /opt/vrijebaan op de VPS:
#   ssh xander8714@85.10.139.24 'bash /opt/vrijebaan/deploy.sh'
# (/opt/vrijebaan/deploy.sh is een dunne, niet-getrackte wrapper die naar dit
# bestand doorverwijst — zie de wrapper zelf. Gecorrigeerd 5 aug 2026: deze
# docstring verwees eerder naar het niet-bestaande pad
# "/opt/vrijebaan/deploy-vps.sh", waardoor een deploy-poging met "No such
# file or directory" faalde. Er bleken op de VPS twee bijna-identieke
# deploy-scripts te bestaan die uit de pas liepen — deploy.sh is nu bewust
# een wrapper om dat te voorkomen.)
set -e
cd /opt/vrijebaan

echo '==> git pull'
git pull origin master

echo '==> npm install'
npm install

echo '==> build'
npm run build

echo '==> statische assets kopieren naar standalone-build'
cp -r public .next/standalone/public
cp -r .next/static .next/standalone/.next/static

# Next.js standalone-output trace mist niet-JS bestanden van playwright-core
# (zoals browsers.json), omdat die via fs i.p.v. require geladen worden en
# de tracer ze daardoor niet meeneemt. Zonder deze stap faalt elke
# Playtomic/Meet & Play-club met 'Cannot find module .../browsers.json'
# (ontdekt en gefixt 3 aug 2026, direct na de eerste deploy op deze VPS —
# zichtbaar als "alleen Peakz/Foys doet het, de rest niet").
echo '==> playwright-fix voor standalone-build'
rm -rf .next/standalone/node_modules/playwright-core .next/standalone/node_modules/playwright
cp -r node_modules/playwright-core .next/standalone/node_modules/playwright-core
cp -r node_modules/playwright .next/standalone/node_modules/playwright

echo '==> service herstarten'
sudo systemctl restart vrijebaan.service
sleep 2
sudo systemctl is-active vrijebaan.service

echo '==> klaar'
