# Roboflow bottle 데이터 다운로드 후 통합 dataset 재생성
# 사용 전 PowerShell 에서 API 키 설정 (저장소에 키를 넣지 마세요):
#   $env:ROBOFLOW_API_KEY = "여기에_키"

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

if (-not $env:ROBOFLOW_API_KEY) {
    Write-Error "ROBOFLOW_API_KEY 가 설정되지 않았습니다. `$env:ROBOFLOW_API_KEY = '...' 후 다시 실행하세요."
    exit 1
}

$py = Join-Path $PWD "backend\venv\Scripts\python.exe"
$pip = Join-Path $PWD "backend\venv\Scripts\pip.exe"

& $pip install -q roboflow
& $py "scripts\download_roboflow_bottle.py"
& $py "scripts\merge_past_datasets_into_unified.py" --yes

Write-Host "[끝] 통합 병합 완료. 학습 예: python scripts/train_yolo_obstacle.py --data dataset/data.yaml --name unified-with-bottle --device cpu --batch 4"
