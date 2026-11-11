using System.Net;
using ChoreBacon.Helpers;
using ChoreBacon.Resources.Strings;
using ChoreBacon.Services.Api;
using ChoreBacon.Services.Ui;
using CommunityToolkit.Mvvm.ComponentModel;

namespace ChoreBacon.ViewModels;

/// <summary>Base for pages backed by the API: busy state, a Swedish error message, and session-expiry handling.</summary>
public abstract partial class ApiViewModel(INavigator navigator) : BaseViewModel
{
    [ObservableProperty]
    public partial string ErrorMessage { get; set; } = string.Empty;

    /// <summary>
    /// Runs one API operation. On failure sets <see cref="ErrorMessage"/> (or, if the session is gone, returns to
    /// the login page) and returns false. Overlapping calls are ignored.
    /// </summary>
    protected async Task<bool> RunAsync(Func<Task> operation, CancellationToken cancellationToken)
    {
        if (IsBusy) return false;
        IsBusy = true;
        ErrorMessage = string.Empty;
        try
        {
            await operation();
            return true;
        }
        catch (ApiException ex) when (ex.StatusCode == HttpStatusCode.Unauthorized)
        {
            // The handler already tried to refresh; the session is over.
            ErrorMessage = AppResources.Error_SessionExpired;
            await navigator.GoToAsync(Routes.Login);
        }
        catch (ApiException ex)
        {
            OnApiError(ex);
        }
        catch (HttpRequestException)
        {
            ErrorMessage = AppResources.Error_Network;
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            // Page went away; nothing to show.
        }
        catch (Exception)
        {
            ErrorMessage = AppResources.Error_Generic;
        }
        finally
        {
            IsBusy = false;
        }
        return false;
    }

    /// <summary>Shows the Swedish message for the API's error code; pages can react to specific codes first.</summary>
    protected virtual void OnApiError(ApiException ex) => ErrorMessage = ApiMessages.For(ex.Code);

    /// <summary>Status line for achievements unlocked by the last action.</summary>
    protected static IEnumerable<string> UnlockedLines(IEnumerable<Contracts.Progress.AchievementDto> unlocked) =>
        unlocked.Select(a => string.Format(AppResources.Achievement_Unlocked, a.Title));
}
