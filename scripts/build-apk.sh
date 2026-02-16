#!/bin/bash
# =============================================================
# AlphaBot Connect — Build + Sync + APK em um único comando
# Uso: bash scripts/build-apk.sh [--release]
# =============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${CYAN}[BUILD]${NC} $1"; }
ok()   { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
fail() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

RELEASE=false
[[ "$1" == "--release" ]] && RELEASE=true

# 1. Verificar dependências
log "Verificando ambiente..."
command -v node  >/dev/null 2>&1 || fail "Node.js não encontrado"
command -v npx   >/dev/null 2>&1 || fail "npx não encontrado"
ok "Node $(node -v)"

# 2. Instalar dependências (se necessário)
if [ ! -d "node_modules" ]; then
  log "Instalando dependências..."
  npm install
fi

# 3. Build web (Vite)
log "Gerando build de produção (Vite)..."
npm run build
ok "Build web concluído → dist/"

# 4. Capacitor sync
log "Sincronizando com Android (cap sync)..."
npx cap sync android
ok "Capacitor sync concluído"

# 5. Gerar APK via Gradle
log "Gerando APK..."
cd android

if $RELEASE; then
  ./gradlew assembleRelease
  APK_PATH="app/build/outputs/apk/release/app-release-unsigned.apk"
  ok "APK Release gerado"
else
  ./gradlew assembleDebug
  APK_PATH="app/build/outputs/apk/debug/app-debug.apk"
  ok "APK Debug gerado"
fi

cd ..

# 6. Resultado
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN} APK pronto!${NC}"
echo -e "${GREEN} 📦 android/${APK_PATH}${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 7. Instalar no dispositivo conectado (opcional)
if command -v adb >/dev/null 2>&1; then
  DEVICES=$(adb devices | grep -w "device" | grep -v "List")
  if [ -n "$DEVICES" ]; then
    warn "Dispositivo detectado via ADB"
    read -p "Instalar no dispositivo? (s/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Ss]$ ]]; then
      adb install -r "android/${APK_PATH}"
      ok "APK instalado no dispositivo!"
    fi
  fi
fi
