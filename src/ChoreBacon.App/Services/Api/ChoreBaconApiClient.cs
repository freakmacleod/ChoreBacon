using System.Net.Http.Json;
using System.Text.Json.Serialization.Metadata;
using ChoreBacon.Contracts;
using ChoreBacon.Contracts.Auth;
using ChoreBacon.Contracts.Progress;

namespace ChoreBacon.Services.Api;

public sealed class ChoreBaconApiClient(HttpClient http) : IChoreBaconApi
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

    public async Task<IReadOnlyList<RewardDto>> GetRewardsAsync(CancellationToken cancellationToken) =>
        await GetAsync("api/v1/rewards", Json.ListRewardDto, cancellationToken);

    public Task<RedeemRewardResponse> RedeemRewardAsync(Guid rewardId, CancellationToken cancellationToken) =>
        PostAsync($"api/v1/rewards/{rewardId}/redeem", Json.RedeemRewardResponse, cancellationToken);

    public async Task<IReadOnlyList<AchievementDto>> GetAchievementsAsync(CancellationToken cancellationToken) =>
        await GetAsync("api/v1/achievements", Json.ListAchievementDto, cancellationToken);

    private async Task<T> GetAsync<T>(string path, JsonTypeInfo<T> type, CancellationToken cancellationToken)
    {
        using var response = await http.GetAsync(path, cancellationToken);
        return await ReadAsync(response, type, cancellationToken);
    }

    private async Task<T> PostAsync<T>(string path, JsonTypeInfo<T> type, CancellationToken cancellationToken)
    {
        using var response = await http.PostAsync(path, content: null, cancellationToken);
        return await ReadAsync(response, type, cancellationToken);
    }

    private static async Task<T> ReadAsync<T>(HttpResponseMessage response, JsonTypeInfo<T> type, CancellationToken cancellationToken)
    {
        await ApiException.EnsureSuccessAsync(response, cancellationToken);
        return (await response.Content.ReadFromJsonAsync(type, cancellationToken))!;
    }
}
