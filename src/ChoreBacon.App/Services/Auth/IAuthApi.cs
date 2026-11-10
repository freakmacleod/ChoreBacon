using ChoreBacon.Contracts.Auth;

namespace ChoreBacon.Services.Auth;

/// <summary>Unauthenticated token endpoints. Deliberately not behind <see cref="AuthenticatedHttpHandler"/>.</summary>
public interface IAuthApi
{
    Task<TokenResponse> RefreshAsync(string refreshToken, CancellationToken cancellationToken);
    Task LogoutAsync(string refreshToken, CancellationToken cancellationToken);
    Task<TokenResponse> DevLoginAsync(string name, CancellationToken cancellationToken);
}
