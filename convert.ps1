$Excel = New-Object -ComObject Excel.Application
$Excel.Visible = $false
$Excel.DisplayAlerts = $false
try {
    $FilePath = Join-Path (Get-Location) 'data.xlsb'
    $CsvPath = Join-Path (Get-Location) 'tarefas.csv'
    
    $Workbook = $Excel.Workbooks.Open($FilePath)
    $Sheet = $Workbook.Sheets.Item('Tarefas')
    $Sheet.SaveAs($CsvPath, 6) # 6 = csv
    $Workbook.Close($false)
    Write-Host "Success: CSV saved to $CsvPath"
} catch {
    Write-Error "PowerShell Error: $_"
} finally {
    $Excel.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($Excel) | Out-Null
}
