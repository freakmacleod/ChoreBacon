namespace ChoreBacon.Services.Auth;

public sealed record AuthTokens(string AccessToken, string RefreshToken, DateTimeOffset AccessTokenExpiresAt);

/// <summary>Persists the API tokens. Production implementation uses SecureStorage only — never Preferences or SQLite.</summary>
public interface ITokenStore
{
    Task<AuthTokens?> LoadAsync();
    Task SaveAsync(AuthTokens tokens);
    Task ClearAsync();
}
