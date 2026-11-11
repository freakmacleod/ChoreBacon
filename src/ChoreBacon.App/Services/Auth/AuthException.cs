namespace ChoreBacon.Services.Auth;

/// <summary>Sign-in failed. <see cref="Code"/> is an API error code (see <c>AuthErrorCodes</c>) or <see cref="NetworkError"/>.</summary>
public sealed class AuthException(string code, Exception? innerException = null)
    : Exception($"Sign-in failed: {code}", innerException)
{
    public const string NetworkError = "network_error";

    public string Code { get; } = code;
}
