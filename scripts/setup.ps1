# One-shot dev setup for Windows PowerShell.
$ErrorActionPreference = 'Stop'
$Root = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $Root

function Copy-IfMissing($src, $dst) {
  if (-not (Test-Path $dst)) {
    Copy-Item $src $dst
    Write-Host "  + created $dst"
  } else {
    Write-Host "  . $dst already exists, leaving untouched"
  }
}

Write-Host "[1/4] Copying .env.example files..."
Copy-IfMissing '.env.example' '.env'
Copy-IfMissing 'apps/api/.env.example' 'apps/api/.env'
Copy-IfMissing 'apps/mobile/.env.example' 'apps/mobile/.env'
Copy-IfMissing 'docker/.env.example' 'docker/.env'

Write-Host "[2/4] Installing dependencies..."
npm install

Write-Host "[3/4] Starting Postgres..."
docker compose -f docker/docker-compose.yml up -d

Write-Host "[4/4] Generating Prisma client + running migrations..."
npm run --workspace @planner/api db:generate
npm run --workspace @planner/api db:migrate -- --name init

Write-Host ""
Write-Host "Done. Next:"
Write-Host "  npm run dev:api      # in one terminal"
Write-Host "  npm run dev:mobile   # in another"
