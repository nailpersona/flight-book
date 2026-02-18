# Ralph Watchdog - automatic monitoring and restart for Ralph loop
# Usage: .\ralph-watchdog.ps1

param(
    [int]$CheckIntervalMinutes = 10,
    [int]$MaxRestarts = 3
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Continue'

function Write-Watchdog { param($msg) Write-Host "[WATCHDOG] $msg" -ForegroundColor Magenta }
function Write-Alert { param($msg) Write-Host "[ALERT] $msg" -ForegroundColor Yellow }

Write-Watchdog "Starting Ralph Watchdog"
Write-Watchdog "Check interval: $CheckIntervalMinutes minutes"
Write-Watchdog "Max restarts: $MaxRestarts"
Write-Host ""

$restartCount = 0
$lastCommitHash = (git log -1 --format="%H" 2>$null)
$lastCheckTime = Get-Date

while ($true) {
    Start-Sleep -Seconds ($CheckIntervalMinutes * 60)

    $currentCommitHash = (git log -1 --format="%H" 2>$null)
    $currentTime = Get-Date
    $elapsedMinutes = ($currentTime - $lastCheckTime).TotalMinutes

    Write-Host ""
    Write-Watchdog "Checking progress... ($([math]::Round($elapsedMinutes, 1)) min elapsed)"

    # Check if there's a new commit
    if ($currentCommitHash -eq $lastCommitHash) {
        Write-Alert "No new commits in last $CheckIntervalMinutes minutes!"

        # Check if Ralph is still running
        $ralphProcess = Get-Process -Name powershell -ErrorAction SilentlyContinue |
            Where-Object { $_.CommandLine -like '*ralph.ps1*' }

        if ($ralphProcess) {
            Write-Alert "Ralph process found but stuck. Killing process..."
            $ralphProcess | Stop-Process -Force
            Start-Sleep -Seconds 2
        } else {
            Write-Alert "Ralph process not found (may have crashed or completed)"
        }

        # Check if all tasks are done
        $remainingTasks = (Select-String -Path "PRD.md" -Pattern "^- \[ \]" 2>$null | Measure-Object).Count

        if ($remainingTasks -eq 0) {
            Write-Watchdog "All tasks completed! Stopping watchdog."
            exit 0
        }

        # Restart Ralph
        if ($restartCount -lt $MaxRestarts) {
            $restartCount++
            Write-Alert "Restarting Ralph (attempt $restartCount of $MaxRestarts)..."

            # Clean stop signal if exists
            if (Test-Path ".ralph-stop") { Remove-Item ".ralph-stop" -Force }

            # Start new Ralph process
            Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass -File ralph.ps1" -NoNewWindow

            Write-Watchdog "Ralph restarted!"
            $lastCheckTime = Get-Date
            Start-Sleep -Seconds 30  # Give time to start
            $lastCommitHash = (git log -1 --format="%H" 2>$null)
        } else {
            Write-Alert "Max restarts ($MaxRestarts) reached. Stopping watchdog."
            Write-Alert "Please check PRD.md and progress.txt manually."
            exit 1
        }
    } else {
        # New commit - everything works
        $commitMessage = (git log -1 --format="%s" 2>$null)
        Write-Watchdog "OK New commit detected: $commitMessage"
        $lastCommitHash = $currentCommitHash
        $lastCheckTime = $currentTime
        $restartCount = 0  # Reset restart counter
    }
}
