using ChoreBacon.Contracts;
using ChoreBacon.Contracts.Auth;
using ChoreBacon.Contracts.Progress;

namespace ChoreBacon.Services.Api;

public sealed class ChoreBaconApiClient(HttpClient http) : ApiClientBase(http), IChoreBaconApi
{
    private static ContractsJsonContext Json => ContractsJsonContext.Default;

    public Task<MeResponse> GetMeAsync(CancellationToken cancellationToken) =>
        GetAsync("api/v1/me", Json.MeResponse, cancellationToken);

    public Task<ProgressResponse> GetProgressAsync(CancellationToken cancellationToken) =>
        GetAsync("api/v1/me/progress", Json.ProgressResponse, cancellationToken);

    public async Task<IReadOnlyList<ChoreDto>> GetChoresAsync(CancellationToken cancellationToken) =>
        await GetAsync("api/v1/chores", Json.ListChoreDto, cancellationToken);

    public Task<CompleteChoreResponse> CompleteChoreAsync(Guid choreId, CancellationToken cancellationToken) =>
        PostAsync($"api/v1/chores/{choreId}/complete", Json.CompleteChoreResponse, cancellationToken);

    public async Task<IReadOnlyList<ComboDto>> GetCombosAsync(CancellationToken cancellationToken) =>
        await GetAsync("api/v1/combos", Json.ListComboDto, cancellationToken);

    public async Task<IReadOnlyList<RewardDto>> GetRewardsAsync(CancellationToken cancellationToken) =>
        await GetAsync("api/v1/rewards", Json.ListRewardDto, cancellationToken);

    public Task<RedeemRewardResponse> RedeemRewardAsync(Guid rewardId, CancellationToken cancellationToken) =>
        PostAsync($"api/v1/rewards/{rewardId}/redeem", Json.RedeemRewardResponse, cancellationToken);

    public async Task<IReadOnlyList<AchievementDto>> GetAchievementsAsync(CancellationToken cancellationToken) =>
        await GetAsync("api/v1/achievements", Json.ListAchievementDto, cancellationToken);

    public Task DeleteAccountAsync(CancellationToken cancellationToken) =>
        SendAsync(HttpMethod.Delete, "api/v1/me", content: null, cancellationToken);
}
