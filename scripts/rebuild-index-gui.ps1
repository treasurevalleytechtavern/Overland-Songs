param(
  [string]$SiteRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$siteRootPath = [IO.Path]::GetFullPath($SiteRoot)
$builderPath = Join-Path $siteRootPath "scripts\build-search-index.ps1"
$defaultSongsPath = Join-Path $siteRootPath "songs.csv"
$defaultThemePath = Join-Path $siteRootPath "theme_days.csv"
$indexPath = Join-Path $siteRootPath "songs.index.json"
$backupRoot = Join-Path $siteRootPath ".local-backups"

function New-Backup {
  param([Parameter(Mandatory = $true)][string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    return
  }

  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $folder = Join-Path $backupRoot $stamp
  New-Item -ItemType Directory -Path $folder -Force | Out-Null
  Copy-Item -LiteralPath $Path -Destination (Join-Path $folder (Split-Path -Leaf $Path)) -Force
}

function Copy-IfNeeded {
  param(
    [Parameter(Mandatory = $true)][string]$Source,
    [Parameter(Mandatory = $true)][string]$Destination
  )

  $sourceFull = [IO.Path]::GetFullPath($Source)
  $destinationFull = [IO.Path]::GetFullPath($Destination)

  if ($sourceFull.Equals($destinationFull, [StringComparison]::OrdinalIgnoreCase)) {
    return
  }

  New-Backup -Path $destinationFull
  Copy-Item -LiteralPath $sourceFull -Destination $destinationFull -Force
}

function Select-CsvFile {
  param([string]$InitialPath)

  $dialog = New-Object System.Windows.Forms.OpenFileDialog
  $dialog.Filter = "CSV files (*.csv)|*.csv|All files (*.*)|*.*"
  $dialog.Title = "Choose CSV file"

  if ($InitialPath -and (Test-Path -LiteralPath $InitialPath)) {
    $dialog.InitialDirectory = Split-Path -Parent $InitialPath
    $dialog.FileName = Split-Path -Leaf $InitialPath
  }

  if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
    return $dialog.FileName
  }

  return $null
}

function Set-Status {
  param(
    [Parameter(Mandatory = $true)][System.Windows.Forms.TextBox]$StatusBox,
    [Parameter(Mandatory = $true)][string]$Text
  )

  $StatusBox.Text = $Text
  $StatusBox.SelectionStart = $StatusBox.Text.Length
  $StatusBox.ScrollToCaret()
  [System.Windows.Forms.Application]::DoEvents()
}

function Start-Rebuild {
  param(
    [Parameter(Mandatory = $true)][string]$SelectedSongsPath,
    [Parameter(Mandatory = $true)][bool]$CopySongs,
    [Parameter(Mandatory = $true)][string]$SelectedThemePath,
    [Parameter(Mandatory = $true)][bool]$CopyTheme,
    [Parameter(Mandatory = $true)][System.Windows.Forms.TextBox]$StatusBox
  )

  if (-not (Test-Path -LiteralPath $builderPath)) {
    throw "Missing builder script: $builderPath"
  }

  if (-not (Test-Path -LiteralPath $SelectedSongsPath)) {
    throw "Choose a valid songs CSV before rebuilding."
  }

  Set-Status -StatusBox $StatusBox -Text "Preparing rebuild..."

  $csvForBuild = $SelectedSongsPath

  if ($CopySongs) {
    Set-Status -StatusBox $StatusBox -Text "Copying songs CSV to site folder..."
    Copy-IfNeeded -Source $SelectedSongsPath -Destination $defaultSongsPath
    $csvForBuild = $defaultSongsPath
  }

  if ($CopyTheme -and $SelectedThemePath -and (Test-Path -LiteralPath $SelectedThemePath)) {
    Set-Status -StatusBox $StatusBox -Text "Copying theme_days.csv to site folder..."
    Copy-IfNeeded -Source $SelectedThemePath -Destination $defaultThemePath
  }

  Set-Status -StatusBox $StatusBox -Text "Backing up current songs.index.json..."
  New-Backup -Path $indexPath

  Set-Status -StatusBox $StatusBox -Text "Building songs.index.json..."
  Push-Location $siteRootPath
  try {
    $output = & $builderPath -CsvPath $csvForBuild -IndexPath "songs.index.json" 2>&1 | Out-String
  } finally {
    Pop-Location
  }

  if (-not (Test-Path -LiteralPath $indexPath)) {
    throw "The build finished, but songs.index.json was not found."
  }

  $indexInfo = Get-Item -LiteralPath $indexPath
  $message = @(
    "Done.",
    "",
    $output.Trim(),
    "",
    "Updated:",
    $indexInfo.FullName,
    "",
    "Next step:",
    "Upload or commit songs.csv, songs.index.json, and theme_days.csv if you changed it."
  ) -join [Environment]::NewLine

  Set-Status -StatusBox $StatusBox -Text $message
}

[System.Windows.Forms.Application]::EnableVisualStyles()

$form = New-Object System.Windows.Forms.Form
$form.Text = "Overland Karaoke Index Rebuilder"
$form.StartPosition = "CenterScreen"
$form.Size = New-Object System.Drawing.Size(760, 470)
$form.MinimumSize = New-Object System.Drawing.Size(680, 430)

$title = New-Object System.Windows.Forms.Label
$title.Text = "Overland Karaoke Index Rebuilder"
$title.Font = New-Object System.Drawing.Font("Segoe UI", 14, [System.Drawing.FontStyle]::Bold)
$title.AutoSize = $true
$title.Location = New-Object System.Drawing.Point(18, 16)
$form.Controls.Add($title)

$description = New-Object System.Windows.Forms.Label
$description.Text = "Choose your song CSV, then rebuild the local songs.index.json file for upload."
$description.AutoSize = $true
$description.Location = New-Object System.Drawing.Point(20, 48)
$form.Controls.Add($description)

$songsLabel = New-Object System.Windows.Forms.Label
$songsLabel.Text = "Songs CSV"
$songsLabel.AutoSize = $true
$songsLabel.Location = New-Object System.Drawing.Point(20, 84)
$form.Controls.Add($songsLabel)

$songsPathBox = New-Object System.Windows.Forms.TextBox
$songsPathBox.Location = New-Object System.Drawing.Point(20, 106)
$songsPathBox.Size = New-Object System.Drawing.Size(590, 25)
$songsPathBox.Text = $defaultSongsPath
$form.Controls.Add($songsPathBox)

$songsBrowseButton = New-Object System.Windows.Forms.Button
$songsBrowseButton.Text = "Browse..."
$songsBrowseButton.Location = New-Object System.Drawing.Point(620, 104)
$songsBrowseButton.Size = New-Object System.Drawing.Size(95, 29)
$songsBrowseButton.Add_Click({
  $selected = Select-CsvFile -InitialPath $songsPathBox.Text
  if ($selected) {
    $songsPathBox.Text = $selected
  }
})
$form.Controls.Add($songsBrowseButton)

$copySongsCheck = New-Object System.Windows.Forms.CheckBox
$copySongsCheck.Text = "Copy selected songs CSV into this site as songs.csv"
$copySongsCheck.Checked = $true
$copySongsCheck.AutoSize = $true
$copySongsCheck.Location = New-Object System.Drawing.Point(20, 138)
$form.Controls.Add($copySongsCheck)

$themeLabel = New-Object System.Windows.Forms.Label
$themeLabel.Text = "Theme Days CSV (optional)"
$themeLabel.AutoSize = $true
$themeLabel.Location = New-Object System.Drawing.Point(20, 170)
$form.Controls.Add($themeLabel)

$themePathBox = New-Object System.Windows.Forms.TextBox
$themePathBox.Location = New-Object System.Drawing.Point(20, 192)
$themePathBox.Size = New-Object System.Drawing.Size(590, 25)
$themePathBox.Text = $defaultThemePath
$form.Controls.Add($themePathBox)

$themeBrowseButton = New-Object System.Windows.Forms.Button
$themeBrowseButton.Text = "Browse..."
$themeBrowseButton.Location = New-Object System.Drawing.Point(620, 190)
$themeBrowseButton.Size = New-Object System.Drawing.Size(95, 29)
$themeBrowseButton.Add_Click({
  $selected = Select-CsvFile -InitialPath $themePathBox.Text
  if ($selected) {
    $themePathBox.Text = $selected
  }
})
$form.Controls.Add($themeBrowseButton)

$copyThemeCheck = New-Object System.Windows.Forms.CheckBox
$copyThemeCheck.Text = "Copy selected theme CSV into this site as theme_days.csv"
$copyThemeCheck.Checked = $true
$copyThemeCheck.AutoSize = $true
$copyThemeCheck.Location = New-Object System.Drawing.Point(20, 224)
$form.Controls.Add($copyThemeCheck)

$buildButton = New-Object System.Windows.Forms.Button
$buildButton.Text = "Rebuild Index"
$buildButton.Font = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
$buildButton.Location = New-Object System.Drawing.Point(20, 262)
$buildButton.Size = New-Object System.Drawing.Size(150, 38)
$form.Controls.Add($buildButton)

$openFolderButton = New-Object System.Windows.Forms.Button
$openFolderButton.Text = "Open Site Folder"
$openFolderButton.Location = New-Object System.Drawing.Point(184, 262)
$openFolderButton.Size = New-Object System.Drawing.Size(130, 38)
$openFolderButton.Add_Click({
  Start-Process explorer.exe -ArgumentList $siteRootPath
})
$form.Controls.Add($openFolderButton)

$statusBox = New-Object System.Windows.Forms.TextBox
$statusBox.Multiline = $true
$statusBox.ReadOnly = $true
$statusBox.ScrollBars = "Vertical"
$statusBox.Location = New-Object System.Drawing.Point(20, 316)
$statusBox.Size = New-Object System.Drawing.Size(695, 95)
$statusBox.Anchor = "Left,Right,Top,Bottom"
$statusBox.Text = "Ready."
$form.Controls.Add($statusBox)

$buildButton.Add_Click({
  try {
    $buildButton.Enabled = $false
    Start-Rebuild `
      -SelectedSongsPath $songsPathBox.Text `
      -CopySongs $copySongsCheck.Checked `
      -SelectedThemePath $themePathBox.Text `
      -CopyTheme $copyThemeCheck.Checked `
      -StatusBox $statusBox
  } catch {
    Set-Status -StatusBox $statusBox -Text "Error:`r`n$($_.Exception.Message)"
    [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, "Index rebuild failed", "OK", "Error") | Out-Null
  } finally {
    $buildButton.Enabled = $true
  }
})

[void]$form.ShowDialog()
