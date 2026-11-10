using System.Text.Json.Serialization;

namespace ChoreBacon.Contracts.Auth;

// Token endpoints follow OAuth naming (snake_case); the rest of the API is camelCase.

public sealed record TokenResponse(
    [property: JsonPropertyName("access_token")] string AccessToken,
    [property: JsonPropertyName("refresh_token")] string RefreshToken,
    [property: JsonPropertyName("token_type")] string TokenType,
    [property: JsonPropertyName("expires_in")] int ExpiresIn);

public sealed record RefreshRequest([property: JsonPropertyName("refresh_token")] string RefreshToken);

public sealed record LogoutRequest([property: JsonPropertyName("refresh_token")] string RefreshToken);

public sealed record DevLoginRequest(string Name);

public sealed record MeResponse(Guid Id, string Provider, string DisplayName, string? Email, string Role);

/// <summary>Stable error codes returned by the auth endpoints.</summary>
public static class AuthErrorCodes
{
    public const string InvalidRefreshToken = "invalid_refresh_token";
    public const string RefreshTokenExpired = "refresh_token_expired";
    public const string RefreshTokenReused = "refresh_token_reused";
    public const string SessionRevoked = "session_revoked";

    // Returned to the app in the chorebacon://auth#error=… fragment.
    public const string InvalidState = "invalid_state";
    public const string AccessDenied = "access_denied";
    public const string MissingCode = "missing_code";
    public const string ProviderError = "provider_error";
}
