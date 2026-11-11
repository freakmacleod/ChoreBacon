using ChoreBacon.Contracts.Auth;

namespace ChoreBacon.Services.Api;

/// <summary>Authenticated API calls. The bearer token and refresh-on-401 are handled by <see cref="Auth.AuthenticatedHttpHandler"/>.</summary>
public interface IChoreBaconApi
{
    Task<MeResponse> GetMeAsync(CancellationToken cancellationToken);
}
