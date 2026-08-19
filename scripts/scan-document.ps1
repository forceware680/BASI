param(
    [string]$OutputPath = ""
)

$ErrorActionPreference = "Stop"

if (-not $OutputPath) {
    $tempDir = [System.IO.Path]::GetTempPath()
    $uniqueName = "simbasi_scan_" + [Guid]::NewGuid().ToString("N") + ".jpg"
    $OutputPath = [System.IO.Path]::Combine($tempDir, $uniqueName)
}

try {
    $dialog = New-Object -ComObject WIA.CommonDialog
    # ShowAcquireImage(DeviceType, Intent, Bias, FormatID, AlwaysSelectDevice, UseDevicePage, CancelError)
    # DeviceType: 1 = ScannerDeviceType
    # Intent: 0 = UnspecifiedIntent (atau 1 = Color, 2 = Grayscale, 4 = Text)
    # FormatID: "{B96B3CAE-0728-11D3-9D7B-0000F81EF32E}" = JPEG
    $image = $dialog.ShowAcquireImage(1, 0, 131072, "{B96B3CAE-0728-11D3-9D7B-0000F81EF32E}", $false, $true, $true)
    
    if ($null -eq $image) {
        Write-Output "RESULT:CANCELED"
        exit 0
    }

    if (Test-Path $OutputPath) {
        Remove-Item -Force $OutputPath
    }

    $image.SaveFile($OutputPath)
    Write-Output "RESULT:SUCCESS:$OutputPath"
} catch {
    $hresult = $_.Exception.HResult
    # 0x80210064 (-2145320860) = WIA_S_NO_DEVICE_AVAILABLE / User cancelled
    # 0x80210015 (-2145320939) = WIA_ERROR_OFFLINE / No device found
    # 0x80210006 (-2145320954) = WIA_ERROR_BUSY
    if ($hresult -eq -2145320860 -or $_.Exception.Message -match "0x80210064" -or $_.Exception.Message -match "cancel") {
        Write-Output "RESULT:CANCELED"
    } elseif ($hresult -eq -2145320939 -or $_.Exception.Message -match "0x80210015" -or $_.Exception.Message -match "offline") {
        Write-Output "RESULT:ERROR:Perangkat scanner tidak terdeteksi atau sedang offline. Pastikan kabel scanner terpasang dan daya menyala."
    } elseif ($hresult -eq -2145320954 -or $_.Exception.Message -match "0x80210006" -or $_.Exception.Message -match "busy") {
        Write-Output "RESULT:ERROR:Perangkat scanner sedang sibuk digunakan oleh aplikasi lain."
    } else {
        Write-Output "RESULT:ERROR:$($_.Exception.Message)"
    }
}
