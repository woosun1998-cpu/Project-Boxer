# Standalone PowerShell: resume book-zbbr0 CPU run (close Cursor terminal safely).
# Usage: powershell -ExecutionPolicy Bypass -File .\scripts\resume_book_zbbr0_in_powershell.ps1

$ErrorActionPreference = "Stop"
Set-Location "c:\Users\EZ\Boxing_Test"

$lastPt = "c:\Users\EZ\Boxing_Test\runs\detect\runs\obstacle\book-zbbr0-v1-fixed-cpu-rerun\weights\last.pt"
$log = "c:\Users\EZ\Boxing_Test\runs\detect\runs\obstacle\book-zbbr0-v1-fixed-cpu-rerun\train_powershell_resume.log"
$py = "c:\Users\EZ\Boxing_Test\backend\venv\Scripts\python.exe"

if (-not (Test-Path $lastPt)) { throw "Missing checkpoint: $lastPt" }
if (-not (Test-Path $py)) { throw "Missing venv python: $py" }

Write-Host "Resuming from: $lastPt"
Write-Host "Log file: $log"
Write-Host ""

& $py ".\scripts\train_yolo_obstacle.py" --resume $lastPt *>&1 | Tee-Object -FilePath $log -Append
$code = $LASTEXITCODE
Write-Host "Exit code: $code"
Read-Host "Press Enter to close"
