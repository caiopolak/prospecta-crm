# setup-sip.ps1
# Le o .env e envia as credenciais Twilio ao backend via PUT /api/sip-config
# Uso: preencha o .env e rode:  powershell -ExecutionPolicy Bypass -File setup-sip.ps1

$ErrorActionPreference = "Stop"

$envPath = Join-Path $PSScriptRoot ".env"
if (-not (Test-Path $envPath)) {
    Write-Host "ERRO: arquivo .env nao encontrado em $envPath" -ForegroundColor Red
    exit 1
}

# Parse do .env (linhas KEY=value; ignora comentarios e linhas vazias)
$envVars = @{}
Get-Content $envPath | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith("#")) {
        $parts = $line -split "=", 2
        if ($parts.Count -eq 2) {
            $envVars[$parts[0].Trim()] = $parts[1].Trim()
        }
    }
}

$required = @("TWILIO_WS", "TWILIO_DOMAIN", "TWILIO_USER", "TWILIO_PASS", "TWILIO_CALLER")
$missing = @()
$placeholders = @()

foreach ($key in $required) {
    if (-not $envVars.ContainsKey($key) -or [string]::IsNullOrWhiteSpace($envVars[$key])) {
        $missing += $key
    }
    elseif ($envVars[$key] -match "SEU-|SUA-" -or $envVars[$key] -eq "+551100000000") {
        $placeholders += "$key=$($envVars[$key])"
    }
}

if ($missing.Count -gt 0) {
    Write-Host "ERRO: variaveis ausentes no .env: $($missing -join ', ')" -ForegroundColor Red
    exit 1
}

if ($placeholders.Count -gt 0) {
    Write-Host "ERRO: valores ainda sao placeholders. Preencha no .env:" -ForegroundColor Red
    $placeholders | ForEach-Object { Write-Host "  $_" -ForegroundColor Yellow }
    Write-Host "Edite o arquivo e rode o script novamente." -ForegroundColor Yellow
    exit 1
}

# Monta o payload conforme o contrato do PUT /api/sip-config (src/app.ts:933)
$body = @{
    provider_name = "Twilio"
    is_simulator  = 0
    ws_server     = $envVars["TWILIO_WS"]
    sip_domain    = $envVars["TWILIO_DOMAIN"]
    username      = $envVars["TWILIO_USER"]
    password      = $envVars["TWILIO_PASS"]
    caller_id     = $envVars["TWILIO_CALLER"]
    auto_record   = 1
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3002/api/sip-config" -Method Put -Body $body -ContentType "application/json"
    Write-Host "SUCESSO: configuracao SIP Twilio enviada ao backend." -ForegroundColor Green
    Write-Host "Proximo passo: abra o VoIP e clique Conectar (deve mostrar 'registrado')." -ForegroundColor Cyan
} catch {
    Write-Host "ERRO ao chamar PUT /api/sip-config: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Verifique se o servidor esta rodando na porta 3002 (ex: node dist\app.js)." -ForegroundColor Yellow
    exit 1
}
