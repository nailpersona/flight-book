# Check Ralph Status - quick diagnostic script
# Usage: .\check-ralph.ps1

Write-Host "=== Ralph Status Check ===" -ForegroundColor Cyan
Write-Host ""

# Check PRD.md exists
if (Test-Path "PRD.md") {
    $totalTasks = (Select-String -Path "PRD.md" -Pattern "^- \[" | Measure-Object).Count
    $completedTasks = (Select-String -Path "PRD.md" -Pattern "^- \[x\]" | Measure-Object).Count
    $remainingTasks = $totalTasks - $completedTasks
    Write-Host "PRD.md: $completedTasks/$totalTasks tasks completed, $remainingTasks remaining" -ForegroundColor $(if ($remainingTasks -eq 0) { "Green" } else { "Yellow" })
} else {
    Write-Host "PRD.md: NOT FOUND" -ForegroundColor Red
}

# Check progress.txt exists
if (Test-Path "progress.txt") {
    $iterations = (Select-String -Path "progress.txt" -Pattern "^## Iteration" | Measure-Object).Count
    Write-Host "progress.txt: $iterations iterations logged" -ForegroundColor Green
} else {
    Write-Host "progress.txt: NOT FOUND" -ForegroundColor Yellow
}

# Check Ralph process
$ralphProcess = Get-Process -Name powershell -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like '*ralph.ps1*' }

if ($ralphProcess) {
    Write-Host "Ralph process: RUNNING (PID: $($ralphProcess.Id))" -ForegroundColor Green
} else {
    Write-Host "Ralph process: NOT RUNNING" -ForegroundColor Yellow
}

# Check watchdog process
$watchdogProcess = Get-Process -Name powershell -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like '*ralph-watchdog.ps1*' }

if ($watchdogProcess) {
    Write-Host "Watchdog process: RUNNING (PID: $($watchdogProcess.Id))" -ForegroundColor Green
} else {
    Write-Host "Watchdog process: NOT RUNNING" -ForegroundColor Yellow
}

# Check stop signal
if (Test-Path ".ralph-stop") {
    Write-Host "Stop signal: PRESENT (.ralph-stop exists)" -ForegroundColor Red
} else {
    Write-Host "Stop signal: none" -ForegroundColor Green
}

# Last commit
$lastCommit = git log -1 --format="%h %s (%cr)" 2>$null
if ($lastCommit) {
    Write-Host "Last commit: $lastCommit" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "Commands:" -ForegroundColor White
Write-Host "  .\ralph.ps1              # Start Ralph"
Write-Host "  .\ralph.ps1 -PauseAfterEach  # Interactive mode"
Write-Host "  .\ralph-watchdog.ps1     # Start watchdog"
Write-Host "  echo '' > .ralph-stop    # Stop gracefully"
