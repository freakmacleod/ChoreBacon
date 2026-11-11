using ChoreBacon.Contracts.Auth;

namespace ChoreBacon.Services.Interfaces;

public interface IAuthService
{
    MeResponse? CurrentUser { get; }
    bool IsLoggedIn { get; }

    /// <returns>The signed-in user, or null if the user cancelled.</returns>
    /// <exception cref="Auth.AuthException">Sign-in failed; <c>Code</c> says why.</exception>
    Task<MeResponse?> LoginWithGoogleAsync(CancellationToken cancellationToken = default);

    /// <inheritdoc cref="LoginWithGoogleAsync"/>
    Task<MeResponse?> LoginWithFacebookAsync(CancellationToken cancellationToken = default);

    /// <summary>Test login against <c>/api/v1/auth/dev</c>. Only offered in DEBUG builds; the API answers 404 in production.</summary>
    Task<MeResponse> LoginAsDevAsync(CancellationToken cancellationToken = default);

    /// <summary>Resumes the stored session (refreshing tokens as needed). Run at startup before showing login.</summary>
    Task<bool> TryRestoreSessionAsync(CancellationToken cancellationToken = default);

    Task LogoutAsync(CancellationToken cancellationToken = default);
}
