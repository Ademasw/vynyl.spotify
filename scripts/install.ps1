# Builds the Vinyl page and installs it into Spotify via Spicetify.
# Safe to run again after every change or after a Spotify update.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

if (-not (Get-Command spicetify -ErrorAction SilentlyContinue)) {
    throw "Spicetify is not installed. See README.md."
}

Push-Location $root
try {
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "Build failed" }

    $target = Join-Path $env:APPDATA "spicetify\CustomApps\vinyl"
    New-Item -ItemType Directory -Force -Path $target | Out-Null
    Copy-Item -Force (Join-Path $root "dist\index.js") $target
    Copy-Item -Force (Join-Path $root "manifest.json") $target

    $apps = ((spicetify config custom_apps) -join "|") -split "[|\s]+"
    if ($apps -notcontains "vinyl") {
        spicetify config custom_apps vinyl
        if ($LASTEXITCODE -ne 0) { throw "Could not register vinyl in Spicetify config" }
    }

    spicetify apply
    if ($LASTEXITCODE -ne 0) {
        throw "spicetify apply failed. After a Spotify update run: spicetify backup apply"
    }
    Write-Host "Vinyl installed. Open it from the Spotify top bar (record icon next to Home)."
}
finally {
    Pop-Location
}
