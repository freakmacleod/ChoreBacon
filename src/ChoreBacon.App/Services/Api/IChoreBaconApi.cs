using ChoreBacon.Contracts.Auth;
using ChoreBacon.Contracts.Progress;

namespace ChoreBacon.Services.Api;

/// <summary>
/// Authenticated API calls. The bearer token and refresh-on-401 are handled by <see cref="Auth.AuthenticatedHttpHandler"/>.
/// Failures throw <see cref="ApiException"/> (with the API's error code) or <see cref="HttpRequestException"/> (offline).
/// </summary>
public interface IChoreBaconApi
{
    Task<MeResponse> GetMeAsync(CancellationToken cancellationToken);
    Task<ProgressResponse> GetProgressAsync(CancellationToken cancellationToken);
    Task<IReadOnlyList<ChoreDto>> GetChoresAsync(CancellationToken cancellationToken);
    Task<CompleteChoreResponse> CompleteChoreAsync(Guid choreId, CancellationToken cancellationToken);
    Task<IReadOnlyList<RewardDto>> GetRewardsAsync(CancellationToken cancellationToken);
    Task<RedeemRewardResponse> RedeemRewardAsync(Guid rewardId, CancellationToken cancellationToken);
    Task<IReadOnlyList<AchievementDto>> GetAchievementsAsync(CancellationToken cancellationToken);

    /// <summary>Deletes (anonymises) the signed-in account. 409 <c>last_parent</c> while the user is their family's only parent.</summary>
    Task DeleteAccountAsync(CancellationToken cancellationToken);
}
