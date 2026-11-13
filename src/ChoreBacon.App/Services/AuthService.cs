using System.Net;
using ChoreBacon.Contracts.Auth;
using ChoreBacon.Services.Api;
using ChoreBacon.Services.Auth;
using ChoreBacon.Services.Interfaces;
using ChoreBacon.Services.Push;

namespace ChoreBacon.Services;

/// <summary>
/// Signs in through the ChoreBacon API: the system browser runs the Google/Facebook OAuth flow against
/// the backend, which answers with its own tokens on <c>chorebacon://auth</c>. Tokens live only in
/// SecureStorage (via <see cref="TokenManager"/>).
/// </summary>
public class AuthService(
    IWebAuthenticator webAuthenticator,
    IAuthApi authApi,
    IChoreBaconApi api,
    TokenManager tokens,
    ApiConfig config,
    IPushRegistration push) : IAuthService
{
    public MeResponse? CurrentUser { get; private set; }
    public bool IsLoggedIn => CurrentUser is not null;

    public Task<MeResponse?> LoginWithGoogleAsync(CancellationToken cancellationToken = default) =>
        LoginWithProviderAsync("google", cancellationToken);

    public Task<MeResponse?> LoginWithFacebookAsync(CancellationToken cancellationToken = default) =>
        LoginWithProviderAsync("facebook", cancellationToken);

    private async Task<MeResponse?> LoginWithProviderAsync(string provider, CancellationToken cancellationToken)
    {
        WebAuthenticatorResult result;
        try
        {
            result = await webAuthenticator.AuthenticateAsync(
                new WebAuthenticatorOptions
                {
                    Url = config.AuthStartUri(provider),
                    CallbackUrl = new Uri(ApiConfig.CallbackUrl),
                },
                cancellationToken);
        }
        catch (TaskCanceledException)
        {
            return null; // user closed the browser
        }

        var properties = result.Properties;
        if (properties.TryGetValue("error", out var error))
            throw new AuthException(error);

        if (!properties.TryGetValue("access_token", out var accessToken) ||
            !properties.TryGetValue("refresh_token", out var refreshToken) ||
            !properties.TryGetValue("expires_in", out var expiresIn) ||
            !int.TryParse(expiresIn, out var expiresInSeconds))
            throw new AuthException(AuthErrorCodes.ProviderError);

        await tokens.SaveAsync(new TokenResponse(accessToken, refreshToken, "Bearer", expiresInSeconds));
        return await CompleteSignInAsync(cancellationToken);
    }

    public async Task<MeResponse> LoginAsDevAsync(CancellationToken cancellationToken = default)
    {
        TokenResponse issued;
        try
        {
            issued = await authApi.DevLoginAsync("Testanvändare", cancellationToken);
        }
        catch (HttpRequestException ex)
        {
            throw new AuthException(AuthException.NetworkError, ex);
        }
        catch (ApiException ex)
        {
            throw new AuthException(ex.Code, ex);
        }

        await tokens.SaveAsync(issued);
        return await CompleteSignInAsync(cancellationToken);
    }

    public async Task<bool> TryRestoreSessionAsync(CancellationToken cancellationToken = default)
    {
        if (await tokens.LoadAsync() is null)
            return false;

        try
        {
            // GetMe goes through AuthenticatedHttpHandler, which refreshes an expired access token.
            await CompleteSignInAsync(cancellationToken);
            return true;
        }
        catch (AuthException ex) when (ex.Code == AuthException.NetworkError)
        {
            // Offline: keep the tokens so the next start can resume, but show the login page for now.
            return false;
        }
        catch (AuthException)
        {
            await tokens.ClearAsync();
            return false;
        }
    }

    public async Task LogoutAsync(CancellationToken cancellationToken = default)
    {
        var stored = await tokens.LoadAsync();
        // While the session still works: this device should stop getting the user's notifications.
        if (stored is not null)
            await push.UnregisterAsync(cancellationToken);
        await tokens.ClearAsync();
        CurrentUser = null;

        if (stored is null)
            return;
        try
        {
            await authApi.LogoutAsync(stored.RefreshToken, cancellationToken);
        }
        catch (Exception ex) when (ex is HttpRequestException or ApiException)
        {
            // Best effort: the local session is already gone; the server chain expires on its own.
        }
    }

    public async Task DeleteAccountAsync(CancellationToken cancellationToken = default)
    {
        await api.DeleteAccountAsync(cancellationToken);
        // The server already revoked every session, so there is nothing to log out from.
        await tokens.ClearAsync();
        CurrentUser = null;
    }

    private async Task<MeResponse> CompleteSignInAsync(CancellationToken cancellationToken)
    {
        MeResponse me;
        try
        {
            me = await api.GetMeAsync(cancellationToken);
        }
        catch (HttpRequestException ex)
        {
            throw new AuthException(AuthException.NetworkError, ex);
        }
        catch (ApiException ex)
        {
            if (ex.StatusCode == HttpStatusCode.Unauthorized)
                await tokens.ClearAsync();
            throw new AuthException(ex.Code, ex);
        }

        CurrentUser = me;
        // Not awaited: it may show the notification permission dialog, and sign-in must not wait for it.
        _ = push.RegisterAsync(CancellationToken.None);
        return me;
    }
}
