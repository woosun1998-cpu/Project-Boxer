# 학습(train_yolo_obstacle.py)이 끝난 뒤 PC를 종료합니다.
# 성공(exit 0)일 때만 기본적으로 종료합니다. 실패 시에도 끄려면 -ShutdownEvenIfFailed
#
# 사용 예 (프로젝트 루트에서):
#   .\scripts\train_yolo_obstacle_then_shutdown.ps1 `
#     --data dataset\data.yaml `
#     --name powershell-train `
#     --resume dataset\runs\detect\runs\obstacle\powershell-train\weights\last.pt `
#     --device cpu --batch 4 --imgsz 640
#
# 옵션만 바꿀 때:
#   .\scripts\train_yolo_obstacle_then_shutdown.ps1 -ShutdownDelaySeconds 180 --data dataset\data.yaml ...
#
# 종료 예약 취소 (타이머 도는 동안):
#   shutdown /a

param(
    [int]$ShutdownDelaySeconds = 120,
    [switch]$ShutdownEvenIfFailed,
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$TrainArgs
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

$PythonExe = Join-Path $ProjectRoot "backend\venv\Scripts\python.exe"
$TrainScript = Join-Path $ProjectRoot "scripts\train_yolo_obstacle.py"

if (-not (Test-Path $PythonExe)) {
    Write-Error "Python 없음: $PythonExe"
    exit 1
}

Write-Host "[train] 프로젝트: $ProjectRoot" -ForegroundColor Cyan
Write-Host "[train] 인자: $($TrainArgs -join ' ')" -ForegroundColor Gray

& $PythonExe $TrainScript @TrainArgs
$exitCode = $LASTEXITCODE

if ($exitCode -eq 0) {
    Write-Host "[train] 정상 종료 (코드 0)." -ForegroundColor Green
    Write-Host "[shutdown] ${ShutdownDelaySeconds}초 후 PC 종료. 취소: shutdown /a" -ForegroundColor Yellow
    shutdown.exe /s /t $ShutdownDelaySeconds
} elseif ($ShutdownEvenIfFailed) {
    Write-Host "[train] 비정상 종료 (코드 $exitCode) 이지만 -ShutdownEvenIfFailed 로 종료합니다." -ForegroundColor Yellow
    shutdown.exe /s /t $ShutdownDelaySeconds
} else {
    Write-Host "[train] 비정상 종료 (코드 $exitCode). 자동 PC 종료를 건너뜁니다." -ForegroundColor Red
    exit $exitCode
}
