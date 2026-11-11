namespace ChoreBacon.Services.Ui;

/// <summary>Alerts behind an interface so view models stay testable.</summary>
public interface IDialogs
{
    Task<bool> ConfirmAsync(string title, string message, string accept, string cancel);

    /// <returns>The text entered, or null if cancelled.</returns>
    Task<string?> PromptAsync(string title, string message, string accept, string cancel, int maxLength);
}

public sealed class ShellDialogs : IDialogs
{
    public Task<bool> ConfirmAsync(string title, string message, string accept, string cancel) =>
        Shell.Current.DisplayAlertAsync(title, message, accept, cancel);

    public Task<string?> PromptAsync(string title, string message, string accept, string cancel, int maxLength) =>
        Shell.Current.DisplayPromptAsync(title, message, accept, cancel, maxLength: maxLength);
}
