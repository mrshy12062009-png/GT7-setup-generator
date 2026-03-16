$base = "https://ddm999.github.io/gt7info/data/db"
$files = @(
  "cars.csv",
  "maker.csv",
  "country.csv",
  "course.csv",
  "crsbase.csv",
  "stockperf.csv",
  "engineswaps.csv"
)

$target = Join-Path $PSScriptRoot "data"
New-Item -ItemType Directory -Path $target -Force | Out-Null

foreach ($file in $files) {
  $url = "$base/$file"
  $out = Join-Path $target $file
  Write-Host "Downloading $file..."
  Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing
}

Write-Host "Done."
