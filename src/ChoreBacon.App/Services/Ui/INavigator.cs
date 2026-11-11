namespace ChoreBacon.Services.Ui;

/// <summary>Shell navigation behind an interface so view models stay testable.</summary>
public interface INavigator
{
    Task GoToAsync(string route);
}

public sealed class ShellNavigator : INavigator
{
    public Task GoToAsync(string route) => Shell.Current.GoToAsync(route);
}

/// <summary>Absolute Shell routes (see AppShell.xaml).</summary>
public static class Routes
{
    public const string Login = "//login";
    public const string Dashboard = "//dashboard";
    public const string Chores = "//chores";
    public const string Store = "//store";
    public const string Achievements = "//achievements";
    public const string Family = "//family";
    public const string Approvals = "approvals";
    public const string FamilyCatalog = "familycatalog";
}
