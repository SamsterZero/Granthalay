$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$staticDir = Join-Path $PSScriptRoot "..\static"

$sizes = @(192, 512)
foreach ($size in $sizes) {
    $svgPath = Join-Path $PSScriptRoot "icon-${size}.svg"
    $pngPath = Join-Path $staticDir "icon-${size}.png"
    $fileUrl = [Uri]::new($svgPath).AbsoluteUri

    $proc = Start-Process -FilePath $chrome -ArgumentList @(
        "--headless",
        "--disable-gpu",
        "--no-sandbox",
        "--screenshot=$pngPath",
        "--window-size=${size},${size}",
        "--hide-scrollbars",
        $fileUrl
    ) -Wait -PassThru

    if ($proc.ExitCode -ne 0) {
        Write-Error "Chrome failed for icon-${size}.png"
        exit 1
    }

    Write-Host "Created $pngPath"
}

Write-Host "Done!"
