$ErrorActionPreference = "Stop"

# 최신 학습 가중치(best.pt)를 찾아서 안전 백업 스크립트를 실행합니다.
$root = (Resolve-Path "$PSScriptRoot\..").Path
$pythonExe = Join-Path $root "backend\venv\Scripts\python.exe"
$backupScript = Join-Path $root "scripts\secure_model_backup.py"
$searchRoot = Join-Path $root "runs\detect\runs\obstacle"

if (-not (Test-Path $pythonExe)) {
    throw "Python 실행 파일을 찾을 수 없습니다: $pythonExe"
}
if (-not (Test-Path $backupScript)) {
    throw "백업 스크립트를 찾을 수 없습니다: $backupScript"
}
if (-not (Test-Path $searchRoot)) {
    throw "학습 결과 폴더를 찾을 수 없습니다: $searchRoot"
}

$latest = Get-ChildItem -Path $searchRoot -Recurse -Filter "best.pt" -File |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

if (-not $latest) {
    throw "best.pt 파일을 찾지 못했습니다: $searchRoot"
}

Write-Host "[백업] 최신 가중치:" $latest.FullName

& $pythonExe $backupScript `
    --source $latest.FullName `
    --backup-root (Join-Path $root "model_backups") `
    --tag "latest" `
    --notes "학습 직후 자동 백업" `
    --copy-to-models (Join-Path $root "models\weights\latest-best.pt")

Write-Host "[백업] 완료"
