# Quick switch between Claude (Anthropic) and ZAI
# Usage: .\switch-ai-provider.ps1 zai
#        .\switch-ai-provider.ps1 claude

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('zai', 'claude')]
    [string]$Provider
)

$settingsPath = "$env:USERPROFILE\.claude\settings.json"

# Check if file exists
if (!(Test-Path $settingsPath)) {
    Write-Host "ERROR: File not found: $settingsPath" -ForegroundColor Red
    Write-Host "Run Claude Code first to create settings file"
    exit 1
}

# Read current settings
$settings = Get-Content $settingsPath -Raw | ConvertFrom-Json

if ($null -eq $settings.env) {
    $settings | Add-Member -Type NoteProperty -Name "env" -Value (New-Object PSObject)
}

# API keys
$ZAI_API_KEY = "3a24a23aea764cffa62f8a4fef50a5bf.qKZJDk9YJDMHth02"

switch ($Provider) {
    'zai' {
        $settings.env | Add-Member -Type NoteProperty -Name "ANTHROPIC_BASE_URL" -Value "https://api.z.ai/api/anthropic" -Force
        $settings.env | Add-Member -Type NoteProperty -Name "ANTHROPIC_AUTH_TOKEN" -Value $ZAI_API_KEY -Force
        $settings.env | Add-Member -Type NoteProperty -Name "ANTHROPIC_DEFAULT_HAIKU_MODEL" -Value "glm-4.5-air" -Force
        $settings.env | Add-Member -Type NoteProperty -Name "ANTHROPIC_DEFAULT_SONNET_MODEL" -Value "glm-4.7" -Force
        $settings.env | Add-Member -Type NoteProperty -Name "ANTHROPIC_DEFAULT_OPUS_MODEL" -Value "glm-4.7" -Force
        $settings.env | Add-Member -Type NoteProperty -Name "API_TIMEOUT_MS" -Value "3000000" -Force

        $settings | ConvertTo-Json -Depth 10 | Set-Content $settingsPath -Encoding UTF8

        Write-Host ""
        Write-Host "============================================" -ForegroundColor Green
        Write-Host "  SWITCHED TO ZAI (GLM-4.7)" -ForegroundColor Green
        Write-Host "============================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "  Endpoint: https://api.z.ai/api/anthropic" -ForegroundColor Cyan
        Write-Host "  Models:   glm-4.7 (sonnet/opus), glm-4.5-air (haiku)" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "  Now run: claude" -ForegroundColor Yellow
        Write-Host ""
    }

    'claude' {
        # Clear all settings to use Claude subscription
        $properties = @('ANTHROPIC_BASE_URL', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_DEFAULT_HAIKU_MODEL', 'ANTHROPIC_DEFAULT_SONNET_MODEL', 'ANTHROPIC_DEFAULT_OPUS_MODEL')

        foreach ($prop in $properties) {
            if ($settings.env.PSObject.Properties.Name -contains $prop) {
                $settings.env.PSObject.Properties.Remove($prop)
            }
        }

        $settings | ConvertTo-Json -Depth 10 | Set-Content $settingsPath -Encoding UTF8

        Write-Host ""
        Write-Host "============================================" -ForegroundColor Green
        Write-Host "  SWITCHED TO CLAUDE (Subscription)" -ForegroundColor Green
        Write-Host "============================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "  Using: Claude subscription" -ForegroundColor Cyan
        Write-Host "  Models:  claude-sonnet-4.5, claude-opus-4.5, claude-haiku-4" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "  Now run: claude" -ForegroundColor Yellow
        Write-Host ""
    }
}

Write-Host "Settings file: $settingsPath" -ForegroundColor Gray
