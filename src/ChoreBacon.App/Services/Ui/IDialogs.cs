namespace ChoreBacon.Services.Ui;

/// <summary>Alerts behind an interface so view models stay testable.</summary>
public interface IDialogs
{
    Task<bool> ConfirmAsync(string title, string message, string accept, string cancel);
}

public sealed class ShellDialogs : IDialogs
{
    public Task<bool> ConfirmAsync(string title, string message, string accept, string cancel) =>
        Shell.Current.DisplayAlertAsync(title, message, accept, cancel);
}
