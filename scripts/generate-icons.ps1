Add-Type -AssemblyName System.Drawing

$text = "ग्रं"
$bgColor = [System.Drawing.ColorTranslator]::FromHtml("#0D5C63")
$textColor = [System.Drawing.Color]::White
$sizes = @(192, 512)

# Try Devanagari fonts available on Windows
$fontNames = @("Nirmala UI", "Mangal", "Kokila", "Arial Unicode MS", "Segoe UI")
$fontName = $null
foreach ($fn in $fontNames) {
    try {
        $testFont = New-Object System.Drawing.Font($fn, 12)
        $fontName = $fn
        break
    } catch {}
}

if (-not $fontName) {
    Write-Error "No suitable Devanagari font found"
    exit 1
}

Write-Host "Using font: $fontName"

foreach ($size in $sizes) {
    $bitmap = New-Object System.Drawing.Bitmap($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    # Fill background
    $graphics.Clear($bgColor)

    # Calculate font size (roughly 50% of icon size)
    $fontSize = [int]($size * 0.5)
    $font = New-Object System.Drawing.Font($fontName, $fontSize, [System.Drawing.FontStyle]::Bold)

    # Measure text to center it
    $textSize = $graphics.MeasureString($text, $font)
    $x = ($size - $textSize.Width) / 2
    $y = ($size - $textSize.Height) / 2 + ($textSize.Height * 0.1)  # Slight vertical adjustment

    # Draw text
    $brush = New-Object System.Drawing.SolidBrush($textColor)
    $graphics.DrawString($text, $font, $brush, $x, $y)

    # Save
    $outputPath = Join-Path $PSScriptRoot "..\static\icon-$size.png"
    $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Host "Created $outputPath ($size x $size)"

    $graphics.Dispose()
    $bitmap.Dispose()
    $font.Dispose()
    $brush.Dispose()
}

Write-Host "Done!"
