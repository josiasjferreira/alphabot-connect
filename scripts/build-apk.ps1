# =============================================================
# AlphaBot Connect v1.1.1 — Build + Sign APK (PowerShell)
# Uso: .\scripts\build-apk.ps1 [-Release] [-Install]
# Requisitos: Node.js, JDK 17, Android SDK, Gradle
# =============================================================

param(
    [switch]$Release,
    [switch]$Install
)

$ErrorActionPreference = "Stop"

# ── Cores ──
function Log($msg)  { Write-Host "[BUILD] $msg" -ForegroundColor Cyan }
function Ok($msg)   { Write-Host "[✓] $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "[!] $msg" -ForegroundColor Yellow }
function Fail($msg) { Write-Host "[✗] $msg" -ForegroundColor Red; exit 1 }

# ── 0. Banner ──
Write-Host ""
Write-Host "╔══════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  AlphaBot Companion v1.1.1 — APK Builder    ║" -ForegroundColor Cyan
Write-Host "║  Iascom Ltda • JDK 17 • Capacitor 6         ║" -ForegroundColor Cyan
Write-Host "║  Inclui: Bluetooth Serial (SPP/RFCOMM)       ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ── 1. Verificar JDK 17 ──
Log "Verificando JDK..."
try {
    $javaVersion = & java -version 2>&1 | Select-String -Pattern '"(\d+)'
    if ($javaVersion -match '"17') {
        Ok "JDK 17 detectado"
    } else {
        Warn "JDK encontrado mas não é 17. Tentando JAVA_HOME..."
    }
} catch {
    Fail "Java não encontrado. Instale o JDK 17."
}

# Forçar JDK 17 via JAVA_HOME se disponível
$jdk17Paths = @(
    "C:\Program Files\Eclipse Adoptium\jdk-17*",
    "C:\Program Files\Java\jdk-17*",
    "C:\Program Files\Microsoft\jdk-17*",
    "C:\Program Files\Zulu\zulu-17*",
    "$env:USERPROFILE\.jdks\corretto-17*",
    "$env:USERPROFILE\.jdks\temurin-17*"
)

foreach ($pattern in $jdk17Paths) {
    $found = Get-ChildItem -Path $pattern -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) {
        $env:JAVA_HOME = $found.FullName
        Ok "JAVA_HOME definido: $($found.FullName)"
        break
    }
}

if (-not $env:JAVA_HOME) {
    Warn "JAVA_HOME não definido. Usando java do PATH."
}

# ── 2. Verificar Node.js ──
Log "Verificando Node.js..."
try {
    $nodeVer = & node -v
    Ok "Node.js $nodeVer"
} catch {
    Fail "Node.js não encontrado. Instale em https://nodejs.org"
}

# ── 3. Verificar Android SDK ──
Log "Verificando Android SDK..."
if (-not $env:ANDROID_HOME -and -not $env:ANDROID_SDK_ROOT) {
    $defaultSdk = "$env:LOCALAPPDATA\Android\Sdk"
    if (Test-Path $defaultSdk) {
        $env:ANDROID_HOME = $defaultSdk
        Ok "Android SDK: $defaultSdk"
    } else {
        Warn "ANDROID_HOME não definido. Gradle pode falhar."
    }
} else {
    Ok "Android SDK: $($env:ANDROID_HOME ?? $env:ANDROID_SDK_ROOT)"
}

# ── 4. Instalar dependências ──
if (-not (Test-Path "node_modules")) {
    Log "Instalando dependências npm..."
    & npm install
    if ($LASTEXITCODE -ne 0) { Fail "npm install falhou" }
    Ok "Dependências instaladas"
} else {
    Ok "node_modules presente"
}

# ── 5. Build web (Vite) ──
Log "Gerando build de produção (Vite)..."
& npm run build
if ($LASTEXITCODE -ne 0) { Fail "Build Vite falhou" }
Ok "Build web concluído → dist/"

# ── 6. Capacitor sync ──
Log "Sincronizando com Android (cap sync)..."
& npx cap sync android
if ($LASTEXITCODE -ne 0) { Fail "Capacitor sync falhou" }
Ok "Capacitor sync concluído (inclui @e-is/capacitor-bluetooth-serial)"

# ── 7. Gerar APK via Gradle ──
Log "Gerando APK..."
Push-Location android

$gradlew = ".\gradlew.bat"
if (-not (Test-Path $gradlew)) {
    $gradlew = ".\gradlew"
}

if ($Release) {
    Log "Modo RELEASE selecionado"
    & $gradlew assembleRelease --no-daemon
    $apkPath = "app\build\outputs\apk\release\app-release-unsigned.apk"
    $signedApk = "app\build\outputs\apk\release\alphabot-v1.1.1-release.apk"
} else {
    & $gradlew assembleDebug --no-daemon
    $apkPath = "app\build\outputs\apk\debug\app-debug.apk"
    $signedApk = $null
}

if ($LASTEXITCODE -ne 0) {
    Pop-Location
    Fail "Gradle build falhou"
}

# ── 8. Assinar APK Release (se aplicável) ──
if ($Release -and (Test-Path $apkPath)) {
    Log "Assinando APK Release..."

    $keystorePath = "..\keystore\alphabot-release.jks"
    $keystoreAlias = "alphabot"

    if (-not (Test-Path $keystorePath)) {
        Warn "Keystore não encontrado em $keystorePath"
        Warn "Criando keystore de desenvolvimento..."

        $keystoreDir = "..\keystore"
        if (-not (Test-Path $keystoreDir)) { New-Item -ItemType Directory -Path $keystoreDir | Out-Null }

        & keytool -genkeypair `
            -v `
            -keystore $keystorePath `
            -keyalg RSA `
            -keysize 2048 `
            -validity 10000 `
            -alias $keystoreAlias `
            -dname "CN=AlphaBot, OU=Dev, O=Iascom Ltda, L=Brasil, ST=SP, C=BR" `
            -storepass alphabot123 `
            -keypass alphabot123

        if ($LASTEXITCODE -ne 0) { Warn "Falha ao criar keystore. APK ficará não assinado." }
        else { Ok "Keystore criado: $keystorePath" }
    }

    if (Test-Path $keystorePath) {
        # Alinhar com zipalign
        $buildToolsPath = Get-ChildItem "$($env:ANDROID_HOME)\build-tools" -Directory -ErrorAction SilentlyContinue |
            Sort-Object Name -Descending | Select-Object -First 1

        if ($buildToolsPath) {
            $zipalign = Join-Path $buildToolsPath.FullName "zipalign.exe"
            $apksigner = Join-Path $buildToolsPath.FullName "apksigner.bat"
            $alignedApk = $apkPath -replace '\.apk$', '-aligned.apk'

            if (Test-Path $zipalign) {
                Log "Alinhando APK (zipalign)..."
                & $zipalign -v -p 4 $apkPath $alignedApk
                if ($LASTEXITCODE -eq 0) {
                    Ok "APK alinhado"
                    # Assinar com apksigner
                    if (Test-Path $apksigner) {
                        Log "Assinando com apksigner..."
                        & $apksigner sign `
                            --ks $keystorePath `
                            --ks-key-alias $keystoreAlias `
                            --ks-pass "pass:alphabot123" `
                            --key-pass "pass:alphabot123" `
                            --out $signedApk `
                            $alignedApk

                        if ($LASTEXITCODE -eq 0) {
                            Ok "APK assinado: $signedApk"
                            $apkPath = $signedApk
                        } else {
                            Warn "apksigner falhou. Tentando jarsigner..."
                        }
                    }
                }
            }
        }

        # Fallback: jarsigner
        if (-not (Test-Path $signedApk)) {
            Log "Assinando com jarsigner (fallback)..."
            & jarsigner `
                -verbose `
                -sigalg SHA256withRSA `
                -digestalg SHA-256 `
                -keystore $keystorePath `
                -storepass alphabot123 `
                -keypass alphabot123 `
                $apkPath $keystoreAlias

            if ($LASTEXITCODE -eq 0) {
                Ok "APK assinado com jarsigner"
            } else {
                Warn "Assinatura falhou. APK não assinado."
            }
        }
    }
}

Pop-Location

# ── 9. Resultado ──
Write-Host ""
Write-Host "════════════════════════════════════════════════" -ForegroundColor Green
Write-Host " ✅ APK v1.1.1 pronto!" -ForegroundColor Green
Write-Host " 📦 android\$apkPath" -ForegroundColor Green
Write-Host " 🔧 JDK 17 • Gradle 8.9 • Capacitor 6" -ForegroundColor Green
Write-Host " 📡 Bluetooth Serial (SPP) incluído" -ForegroundColor Green
Write-Host "════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""

# ── 10. Instalar via ADB (opcional) ──
if ($Install) {
    Log "Verificando dispositivos ADB..."
    try {
        $devices = & adb devices 2>&1 | Select-String "device$"
        if ($devices) {
            Log "Dispositivo detectado. Instalando APK..."
            & adb install -r "android\$apkPath"
            if ($LASTEXITCODE -eq 0) {
                Ok "APK instalado no dispositivo!"
            } else {
                Warn "Falha ao instalar via ADB"
            }
        } else {
            Warn "Nenhum dispositivo conectado via ADB"
        }
    } catch {
        Warn "ADB não encontrado no PATH"
    }
} else {
    Write-Host "💡 Para instalar: .\scripts\build-apk.ps1 -Install" -ForegroundColor Yellow
    Write-Host "💡 Release assinado: .\scripts\build-apk.ps1 -Release -Install" -ForegroundColor Yellow
}
