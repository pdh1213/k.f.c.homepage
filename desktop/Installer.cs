using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Windows.Forms;
using Microsoft.Win32;

[assembly: AssemblyTitle("K.F.C. Chat 설치")]
[assembly: AssemblyVersion("1.0.0.0")]

static class Installer
{
    const string Title = "K.F.C. Chat";
    const string RegistryPath = @"Software\Microsoft\Windows\CurrentVersion\Uninstall\KfcChat";
    static readonly string Folder = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "KfcChat");
    static readonly string App = Path.Combine(Folder, "KfcChat.exe");
    static readonly string Uninstaller = Path.Combine(Folder, "Uninstall.exe");
    static readonly string Shortcut = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.Programs), "K.F.C. Chat.lnk");

    [STAThread]
    static void Main(string[] args)
    {
        Application.EnableVisualStyles();
        try
        {
            if (args.Length == 2 && args[0] == "--finish-uninstall")
            {
                int parentId;
                if (!Int32.TryParse(args[1], out parentId)) return;
                try
                {
                    using (var parent = Process.GetProcessById(parentId))
                        if (!parent.WaitForExit(10000)) throw new IOException("제거 프로그램을 다시 실행해 주세요.");
                }
                catch (ArgumentException) { }
                Remove();
            }
            else if (args.Length == 1 && args[0] == "--uninstall")
            {
                BeginRemove();
            }
            else if (args.Length == 0)
            {
                Install();
            }
        }
        catch (Exception error)
        {
            MessageBox.Show("작업을 완료할 수 없습니다.\r\n\r\n" + error.Message,
                Title, MessageBoxButtons.OK, MessageBoxIcon.Error);
            Environment.ExitCode = 1;
        }
    }

    static void Install()
    {
        if (MessageBox.Show("K.F.C. Chat을 이 Windows 계정에 설치하시겠습니까?\r\n설치 후 시작 메뉴에서 열 수 있습니다.",
            Title, MessageBoxButtons.OKCancel, MessageBoxIcon.Information) != DialogResult.OK) return;

        Directory.CreateDirectory(Folder);
        Directory.CreateDirectory(Path.GetDirectoryName(Shortcut));
        ReplaceFile(Uninstaller, stream =>
        {
            using (var source = File.OpenRead(Application.ExecutablePath)) source.CopyTo(stream);
        });
        ReplaceFile(App, stream =>
        {
            using (var source = Assembly.GetExecutingAssembly().GetManifestResourceStream("KfcChat.exe"))
            {
                if (source == null) throw new IOException("설치 파일을 다시 내려받아 주세요.");
                source.CopyTo(stream);
            }
        });

        var shellType = Type.GetTypeFromProgID("WScript.Shell", true);
        dynamic shell = Activator.CreateInstance(shellType);
        dynamic link = shell.CreateShortcut(Shortcut);
        link.TargetPath = App;
        link.WorkingDirectory = Folder;
        link.Description = Title;
        link.Save();

        using (var key = Registry.CurrentUser.CreateSubKey(RegistryPath))
        {
            key.SetValue("DisplayName", Title);
            key.SetValue("DisplayVersion", "1.0.0");
            key.SetValue("Publisher", "K.F.C. 로봇동아리");
            key.SetValue("InstallLocation", Folder);
            key.SetValue("DisplayIcon", App);
            key.SetValue("UninstallString", "\"" + Uninstaller + "\" --uninstall");
            key.SetValue("NoModify", 1, RegistryValueKind.DWord);
            key.SetValue("NoRepair", 1, RegistryValueKind.DWord);
        }

        if (MessageBox.Show("설치가 완료되었습니다. 지금 앱을 여시겠습니까?", Title,
            MessageBoxButtons.YesNo, MessageBoxIcon.Information) == DialogResult.Yes)
            Process.Start(App);
    }

    static void ReplaceFile(string destination, Action<Stream> write)
    {
        var temp = Path.Combine(Folder, Guid.NewGuid().ToString("N") + ".tmp");
        try
        {
            using (var stream = File.Open(temp, FileMode.CreateNew, FileAccess.Write)) write(stream);
            if (File.Exists(destination)) File.Replace(temp, destination, null);
            else File.Move(temp, destination);
        }
        finally { if (File.Exists(temp)) File.Delete(temp); }
    }

    static void BeginRemove()
    {
        if (MessageBox.Show("K.F.C. Chat을 제거하시겠습니까? 실행 중인 채팅 앱을 먼저 닫아 주세요.",
            Title, MessageBoxButtons.OKCancel, MessageBoxIcon.Question) != DialogResult.OK) return;
        var copy = Path.Combine(Path.GetTempPath(), "KfcChat-Uninstall-" + Guid.NewGuid().ToString("N") + ".exe");
        File.Copy(Application.ExecutablePath, copy);
        using (var current = Process.GetCurrentProcess())
        {
            Process.Start(copy, "--finish-uninstall " + current.Id);
        }
    }

    static void Remove()
    {
        File.Delete(App);
        File.Delete(Uninstaller);
        File.Delete(Shortcut);
        if (Directory.Exists(Folder) && Directory.GetFileSystemEntries(Folder).Length == 0) Directory.Delete(Folder);
        Registry.CurrentUser.DeleteSubKeyTree(RegistryPath, false);
        MessageBox.Show("K.F.C. Chat을 제거했습니다.", Title, MessageBoxButtons.OK, MessageBoxIcon.Information);
    }
}
