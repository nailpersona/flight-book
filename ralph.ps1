# Ralph Loop - Autonomous Task Executor for Fly-Book
# Usage: .\ralph.ps1 [-Infinite] [-MaxIterations 15] [-SleepSeconds 2]
#
# Loop: /ralph-start → detect signal → repeat until done
#
# Examples:
#   .\ralph.ps1                    # Default: 15 iterations max
#   .\ralph.ps1 -MaxIterations 50  # Up to 50 iterations
#   .\ralph.ps1 -Infinite          # Run until ALL stories done (or blocked)

param(
    [int]$MaxIterations = 15,
    [int]$SleepSeconds = 2,
    [switch]$Infinite = $false
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Colors
function Write-Ralph { param($msg) Write-Host "[RALPH] $msg" -ForegroundColor Cyan }
function Write-Success { param($msg) Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Fail { param($msg) Write-Host "[FAIL] $msg" -ForegroundColor Red }
function Write-Info { param($msg) Write-Host "[INFO] $msg" -ForegroundColor Yellow }

# Check PRD file
if (-not (Test-Path "PRD.md")) {
    Write-Fail "PRD.md not found!"
    exit 1
}

# Clean stop signal from previous run
if (Test-Path ".ralph-stop") { Remove-Item ".ralph-stop" -Force }

Write-Ralph "Starting Ralph Loop"
if ($Infinite) {
    Write-Info "Mode: INFINITE (until all done or blocked)"
    $MaxIterations = 999999
} else {
    Write-Info "Max iterations: $MaxIterations"
}
Write-Info "Stop: create file '.ralph-stop'"
Write-Host ""

for ($i = 1; $i -le $MaxIterations; $i++) {
    # Check stop signal
    if (Test-Path ".ralph-stop") {
        Write-Info "Stop signal received."
        Remove-Item ".ralph-stop" -Force
        exit 0
    }

    Write-Host "==========================================" -ForegroundColor Magenta
    if ($Infinite) {
        Write-Ralph "Iteration $i (infinite mode)"
    } else {
        Write-Ralph "Iteration $i of $MaxIterations"
    }
    Write-Host "==========================================" -ForegroundColor Magenta

    # Run Claude with /ralph-start skill
    $result = ""
    try {
        $result = (& claude --dangerously-skip-permissions -p "/ralph-start" 2>&1 | Out-String)
        Write-Host $result
    }
    catch {
        Write-Fail "Claude error: $_"
        Start-Sleep -Seconds $SleepSeconds
        continue
    }

    # Check for BLOCKED signal
    if ($result -match "===RALPH_BLOCKED===") {
        Write-Host ""
        Write-Fail "Story blocked! Manual intervention required."
        exit 1
    }

    # Check for DONE signal
    if ($result -match "===RALPH_DONE===") {
        # Extract remaining count
        if ($result -match "Remaining:\s*(\d+)") {
            $remaining = $matches[1]
            Write-Success "Story done. Remaining: $remaining"

            if ($remaining -eq "0") {
                Write-Host ""
                Write-Host "==========================================" -ForegroundColor Green
                Write-Success "ALL STORIES COMPLETE!"
                Write-Host "==========================================" -ForegroundColor Green
                exit 0
            }
        }
    }

    # Check stop signal after iteration
    if (Test-Path ".ralph-stop") {
        Write-Info "Stop signal received."
        Remove-Item ".ralph-stop" -Force
        exit 0
    }

    Write-Info "Next iteration in $SleepSeconds sec (context will be fresh)..."
    Start-Sleep -Seconds $SleepSeconds
}

Write-Fail "Reached max iterations ($MaxIterations). Check PRD.md for remaining [ ] tasks."
exit 1
