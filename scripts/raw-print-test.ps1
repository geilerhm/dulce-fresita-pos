param(
  [string]$PrinterName = "POS-80"
)

Add-Type -TypeDefinition @"
using System;
using System.IO;
using System.Runtime.InteropServices;

public class RawPrinter
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct DOCINFOW
    {
        [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
    }

    [DllImport("winspool.Drv", EntryPoint = "OpenPrinterW", SetLastError = true, CharSet = CharSet.Unicode, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPWStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterW", SetLastError = true, CharSet = CharSet.Unicode, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern int StartDocPrinter(IntPtr hPrinter, int level, ref DOCINFOW di);

    [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

    public static bool SendBytes(string printerName, byte[] bytes)
    {
        IntPtr hPrinter;
        if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero))
            throw new Exception("OpenPrinter failed: " + Marshal.GetLastWin32Error());
        try
        {
            DOCINFOW di = new DOCINFOW();
            di.pDocName = "RAW Print Test";
            di.pDataType = "RAW";
            int jobId = StartDocPrinter(hPrinter, 1, ref di);
            if (jobId == 0) throw new Exception("StartDocPrinter failed: " + Marshal.GetLastWin32Error());
            try
            {
                if (!StartPagePrinter(hPrinter)) throw new Exception("StartPagePrinter failed: " + Marshal.GetLastWin32Error());
                IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(bytes.Length);
                try
                {
                    Marshal.Copy(bytes, 0, pUnmanagedBytes, bytes.Length);
                    int written;
                    if (!WritePrinter(hPrinter, pUnmanagedBytes, bytes.Length, out written))
                        throw new Exception("WritePrinter failed: " + Marshal.GetLastWin32Error());
                }
                finally { Marshal.FreeCoTaskMem(pUnmanagedBytes); }
                EndPagePrinter(hPrinter);
            }
            finally { EndDocPrinter(hPrinter); }
        }
        finally { ClosePrinter(hPrinter); }
        return true;
    }
}
"@

# Build ESC/POS payload
$ms = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter($ms)

# ESC @  init
$bw.Write([byte[]](0x1B,0x40))
# ESC a 1  center
$bw.Write([byte[]](0x1B,0x61,0x01))
# GS ! 0x11  double width + height
$bw.Write([byte[]](0x1D,0x21,0x11))
$bw.Write([System.Text.Encoding]::ASCII.GetBytes("PRUEBA`n"))
# GS ! 0  normal
$bw.Write([byte[]](0x1D,0x21,0x00))
$bw.Write([System.Text.Encoding]::ASCII.GetBytes("Dulce Fresita POS`n"))
$bw.Write([System.Text.Encoding]::ASCII.GetBytes((Get-Date).ToString("yyyy-MM-dd HH:mm:ss") + "`n"))
$bw.Write([System.Text.Encoding]::ASCII.GetBytes("--------------------------------`n"))
$bw.Write([System.Text.Encoding]::ASCII.GetBytes("Si lee este mensaje, la`n"))
$bw.Write([System.Text.Encoding]::ASCII.GetBytes("impresora termica funciona OK.`n"))
$bw.Write([System.Text.Encoding]::ASCII.GetBytes("--------------------------------`n"))
# ESC d 4  feed 4 lines
$bw.Write([byte[]](0x1B,0x64,0x04))
# GS V 0  full cut
$bw.Write([byte[]](0x1D,0x56,0x00))

$bw.Flush()
$bytes = $ms.ToArray()

Write-Output ("Sending " + $bytes.Length + " bytes to '" + $PrinterName + "'")
[RawPrinter]::SendBytes($PrinterName, $bytes) | Out-Null
Write-Output "OK"
