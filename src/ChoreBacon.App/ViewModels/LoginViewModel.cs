using ChoreBacon.Contracts.Auth;
using ChoreBacon.Models;
using ChoreBacon.Resources.Strings;
using ChoreBacon.Services.Auth;
using ChoreBacon.Services.Interfaces;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace ChoreBacon.ViewModels;

public partial class LoginViewModel : BaseViewModel
{
    private readonly IAuthService _auth;

    [ObservableProperty]
    public partial string ErrorMessage { get; set; } = string.Empty;

    /// <summary>True while checking for a stored session; the sign-in buttons stay hidden until it is done.</summary>
    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(CanSignIn))]
    public partial bool IsRestoring { get; set; } = true;

    public bool CanSignIn => !IsRestoring;

#if DEBUG
    public bool IsDevLoginAvailable => true;
#else
    public bool IsDevLoginAvailable => false;
#endif

    public LoginViewModel(IAuthService auth)
    {
        _auth = auth;
        Title = AppResources.Login_Title;
    }

    [RelayCommand]
    private async Task InitializeAsync(CancellationToken cancellationToken)
    {
        IsRestoring = true;
        try
        {
            if (await _auth.TryRestoreSessionAsync(cancellationToken))
                await GoToMainAsync();
        }
        finally
        {
            IsRestoring = false;
        }
    }

    [RelayCommand]
    private Task LoginWithGoogleAsync(CancellationToken cancellationToken) =>
        SignInAsync(_auth.LoginWithGoogleAsync, cancellationToken);

    [RelayCommand]
    private Task LoginWithFacebookAsync(CancellationToken cancellationToken) =>
        SignInAsync(_auth.LoginWithFacebookAsync, cancellationToken);

    [RelayCommand]
    private Task LoginAsDevAsync(CancellationToken cancellationToken) =>
        SignInAsync(async ct => await _auth.LoginAsDevAsync(ct), cancellationToken);

    private async Task SignInAsync(Func<CancellationToken, Task<User?>> signIn, CancellationToken cancellationToken)
    {
        if (IsBusy) return;
        IsBusy = true;
        ErrorMessage = string.Empty;
        try
        {
            if (await signIn(cancellationToken) is not null)
                await GoToMainAsync();
        }
        catch (AuthException ex)
        {
            ErrorMessage = MessageFor(ex.Code);
        }
        catch (Exception)
        {
            ErrorMessage = AppResources.Login_Error_Generic;
        }
        finally
        {
            IsBusy = false;
        }
    }

    /// <summary>Maps an API/auth error code to a user-facing (Swedish) message.</summary>
    internal static string MessageFor(string code) => code switch
    {
        AuthErrorCodes.AccessDenied => AppResources.Login_Error_AccessDenied,
        AuthException.NetworkError => AppResources.Login_Error_Network,
        AuthErrorCodes.RefreshTokenExpired or AuthErrorCodes.RefreshTokenReused or AuthErrorCodes.SessionRevoked
            => AppResources.Login_Error_SessionExpired,
        _ => AppResources.Login_Error_Generic,
    };

    private static Task GoToMainAsync() => Shell.Current.GoToAsync("//dashboard");
}
