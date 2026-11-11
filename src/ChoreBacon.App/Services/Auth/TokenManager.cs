using System.Net;
using ChoreBacon.Contracts.Auth;
using ChoreBacon.Services.Api;

namespace ChoreBacon.Services.Auth;

/// <summary>
/// Owns the token lifecycle: hands out a valid access token, refreshing it when it is about to expire
/// or the API rejected it. Refreshes are serialized — the backend treats a second use of the same
/// refresh token as theft and revokes the session, so two concurrent refreshes must never happen.
/// </summary>
public sealed class TokenManager(ITokenStore store, IAuthApi authApi, TimeProvider time)
{
    /// <summary>Refresh this long before expiry so a token never expires mid-request.</summary>
    internal static readonly TimeSpan ExpirySkew = TimeSpan.FromSeconds(60);

    private readonly SemaphoreSlim _refreshGate = new(1, 1);

    public Task SaveAsync(TokenResponse tokens) =>
        store.SaveAsync(new AuthTokens(tokens.AccessToken, tokens.RefreshToken, time.GetUtcNow().AddSeconds(tokens.ExpiresIn)));

    public Task<AuthTokens?> LoadAsync() => store.LoadAsync();

    public Task ClearAsync() => store.ClearAsync();

    /// <returns>A usable access token, or null when there is no session.</returns>
    public async Task<string?> GetAccessTokenAsync(CancellationToken cancellationToken)
    {
        var tokens = await store.LoadAsync();
        if (tokens is null)
            return null;
        return IsFresh(tokens) ? tokens.AccessToken : await RefreshAsync(tokens.AccessToken, cancellationToken);
    }

    /// <summary>
    /// Refreshes after <paramref name="rejectedAccessToken"/> failed or expired. If another caller already
    /// refreshed meanwhile, returns that newer token instead of refreshing again.
    /// </summary>
    /// <returns>The new access token, or null when the session is over (tokens are then cleared).</returns>
    /// <exception cref="HttpRequestException">Network failure; tokens are kept so a later retry can succeed.</exception>
    public async Task<string?> RefreshAsync(string rejectedAccessToken, CancellationToken cancellationToken)
    {
        await _refreshGate.WaitAsync(cancellationToken);
        try
        {
            var tokens = await store.LoadAsync();
            if (tokens is null)
                return null;
            if (tokens.AccessToken != rejectedAccessToken && IsFresh(tokens))
                return tokens.AccessToken;

            TokenResponse refreshed;
            try
            {
                refreshed = await authApi.RefreshAsync(tokens.RefreshToken, cancellationToken);
            }
            catch (ApiException ex) when (ex.StatusCode == HttpStatusCode.Unauthorized)
            {
                await store.ClearAsync();
                return null;
            }

            await SaveAsync(refreshed);
            return refreshed.AccessToken;
        }
        finally
        {
            _refreshGate.Release();
        }
    }

    private bool IsFresh(AuthTokens tokens) => tokens.AccessTokenExpiresAt - ExpirySkew > time.GetUtcNow();
}
