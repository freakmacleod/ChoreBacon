using System.Globalization;

namespace ChoreBacon.Services.Auth;

public sealed class SecureTokenStore(ISecureStorage storage) : ITokenStore
{
    private const string AccessKey = "auth.access_token";
    private const string RefreshKey = "auth.refresh_token";
    private const string ExpiresKey = "auth.access_expires_at";

    public async Task<AuthTokens?> LoadAsync()
    {
        var access = await storage.GetAsync(AccessKey);
        var refresh = await storage.GetAsync(RefreshKey);
        var expires = await storage.GetAsync(ExpiresKey);

        if (string.IsNullOrEmpty(access) || string.IsNullOrEmpty(refresh) ||
            !DateTimeOffset.TryParse(expires, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var expiresAt))
            return null;

        return new AuthTokens(access, refresh, expiresAt);
    }

    public async Task SaveAsync(AuthTokens tokens)
    {
        await storage.SetAsync(AccessKey, tokens.AccessToken);
        await storage.SetAsync(RefreshKey, tokens.RefreshToken);
        await storage.SetAsync(ExpiresKey, tokens.AccessTokenExpiresAt.ToString("O", CultureInfo.InvariantCulture));
    }

    public Task ClearAsync()
    {
        storage.Remove(AccessKey);
        storage.Remove(RefreshKey);
        storage.Remove(ExpiresKey);
        return Task.CompletedTask;
    }
}
