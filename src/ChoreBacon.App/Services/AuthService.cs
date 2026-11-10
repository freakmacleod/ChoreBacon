using System.Net;
using ChoreBacon.Contracts.Auth;
using ChoreBacon.Models;
using ChoreBacon.Services.Api;
using ChoreBacon.Services.Auth;
using ChoreBacon.Services.Interfaces;

namespace ChoreBacon.Services;

/// <summary>
/// Signs in through the ChoreBacon API: the system browser runs the Google/Facebook OAuth flow against
/// the backend, which answers with its own tokens on <c>chorebacon://auth</c>. Tokens live only in
/// SecureStorage (via <see cref="TokenManager"/>).
/// </summary>
/// <remarks>
/// Until the API replaces SQLite (backlog item 5), the signed-in API user is mirrored into the local
/// Users table so the existing chore/store/achievement services keep working.
/// </remarks>
public class AuthService(
    IWebAuthenticator webAuthenticator,
    IAuthApi authApi,
    IChoreBaconApi api,
    TokenManager tokens,
    ApiConfig config,
    IDatabaseService db,
    TimeProvider time) : IAuthService
{
    public User? CurrentUser { get; private set; }
    public bool IsLoggedIn => CurrentUser is not null;

    public Task<User?> LoginWithGoogleAsync(CancellationToken cancellationToken = default) =>
        LoginWithProviderAsync("google", cancellationToken);

    public Task<User?> LoginWithFacebookAsync(CancellationToken cancellationToken = default) =>
        LoginWithProviderAsync("facebook", cancellationToken);

    private async Task<User?> LoginWithProviderAsync(string provider, CancellationToken cancellationToken)
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

    public async Task<User> LoginAsDevAsync(CancellationToken cancellationToken = default)
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

    private async Task<User> CompleteSignInAsync(CancellationToken cancellationToken)
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

        CurrentUser = await MirrorLocalUserAsync(me);
        return CurrentUser;
    }

    private async Task<User> MirrorLocalUserAsync(MeResponse me)
    {
        var externalId = me.Id.ToString();
        var user = await db.GetUserByExternalIdAsync(externalId, me.Provider) ?? new User
        {
            ExternalId = externalId,
            Provider = me.Provider,
        };
        user.DisplayName = me.DisplayName;
        user.Email = me.Email ?? string.Empty;
        user.LastLoginAt = time.GetUtcNow().UtcDateTime;
        await db.SaveUserAsync(user);
        return user;
    }
}
