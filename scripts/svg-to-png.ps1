$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$staticDir = Join-Path $PSScriptRoot "..\static"

$icons = @(
    @{ Name = "icon-192"; Size = 192 },
    @{ Name = "icon-512"; Size = 512 },
    @{ Name = "icon-maskable"; Size = 512 }
)

foreach ($icon in $icons) {

    $svgPath = Join-Path $PSScriptRoot "..\src\lib\assets\$($icon.Name).svg"
    $pngPath = Join-Path $staticDir "$($icon.Name).png"
    $fileUrl = [Uri]::new($svgPath).AbsoluteUri

    $proc = Start-Process -FilePath $chrome -ArgumentList @(
        "--headless",
        "--disable-gpu",
        "--no-sandbox",
        "--screenshot=$pngPath",
        "--window-size=$($icon.Size),$($icon.Size)",
        "--hide-scrollbars",
        $fileUrl
    ) -Wait -PassThru

    if ($proc.ExitCode -ne 0) {
        Write-Error "Chrome failed for $($icon.Name).png"
        exit 1
    }

    Write-Host "Created $pngPath"
}

Write-Host "Done!"