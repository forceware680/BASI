try {
    $dialog = New-Object -ComObject WIA.CommonDialog
    if ($dialog) {
        Write-Output "WIA_OK"
    }
} catch {
    Write-Output "WIA_ERR: $($_.Exception.Message)"
}
