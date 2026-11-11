using System.Net;
using System.Net.Http.Json;
using ChoreBacon.Contracts;
using ChoreBacon.Contracts.Family;

namespace ChoreBacon.Services.Api;

public sealed class FamilyApiClient(HttpClient http) : ApiClientBase(http), IFamilyApi
{
    private static ContractsJsonContext Json => ContractsJsonContext.Default;

    public async Task<FamilyDto?> GetFamilyAsync(CancellationToken cancellationToken)
    {
        try
        {
            return await GetAsync("api/v1/me/family", Json.FamilyDto, cancellationToken);
        }
        catch (ApiException ex) when (ex.StatusCode == HttpStatusCode.NotFound && ex.Code == FamilyErrorCodes.NoFamily)
        {
            return null;
        }
    }

    public Task<FamilyDto> CreateFamilyAsync(string name, CancellationToken cancellationToken) =>
        SendAsync(HttpMethod.Post, "api/v1/families", new CreateFamilyRequest(name), Json.CreateFamilyRequest, Json.FamilyDto, cancellationToken);

    public Task<FamilyDto> JoinFamilyAsync(string code, CancellationToken cancellationToken) =>
        SendAsync(HttpMethod.Post, "api/v1/families/join", new JoinFamilyRequest(code), Json.JoinFamilyRequest, Json.FamilyDto, cancellationToken);

    public Task<FamilyDto> UpdateFamilyAsync(UpdateFamilyRequest changes, CancellationToken cancellationToken) =>
        SendAsync(HttpMethod.Patch, "api/v1/me/family", changes, Json.UpdateFamilyRequest, Json.FamilyDto, cancellationToken);

    public Task LeaveFamilyAsync(CancellationToken cancellationToken) =>
        SendAsync(HttpMethod.Post, "api/v1/me/family/leave", content: null, cancellationToken);

    public async Task<string> RegenerateInviteCodeAsync(CancellationToken cancellationToken) =>
        (await PostAsync("api/v1/me/family/invite-code", Json.InviteCodeResponse, cancellationToken)).InviteCode;

    public Task SetMemberRoleAsync(Guid userId, FamilyRole role, CancellationToken cancellationToken) =>
        SendAsync(HttpMethod.Patch, $"api/v1/me/family/members/{userId}",
            JsonContent.Create(new MemberRoleRequest(role), Json.MemberRoleRequest), cancellationToken);

    public Task RemoveMemberAsync(Guid userId, CancellationToken cancellationToken) =>
        SendAsync(HttpMethod.Delete, $"api/v1/me/family/members/{userId}", content: null, cancellationToken);

    public async Task<IReadOnlyList<PendingCompletionDto>> GetPendingCompletionsAsync(CancellationToken cancellationToken) =>
        await GetAsync("api/v1/me/family/completions", Json.ListPendingCompletionDto, cancellationToken);

    public Task<ReviewCompletionResponse> ReviewCompletionAsync(Guid completionId, bool approve, CancellationToken cancellationToken) =>
        PostAsync($"api/v1/me/family/completions/{completionId}/{(approve ? "approve" : "reject")}", Json.ReviewCompletionResponse, cancellationToken);

    public async Task<IReadOnlyList<PendingRedemptionDto>> GetPendingRedemptionsAsync(CancellationToken cancellationToken) =>
        await GetAsync("api/v1/me/family/redemptions", Json.ListPendingRedemptionDto, cancellationToken);

    public Task FulfilRedemptionAsync(Guid redemptionId, CancellationToken cancellationToken) =>
        SendAsync(HttpMethod.Post, $"api/v1/me/family/redemptions/{redemptionId}/fulfil", content: null, cancellationToken);

    public async Task<IReadOnlyList<FamilyChoreDto>> GetFamilyChoresAsync(CancellationToken cancellationToken) =>
        await GetAsync("api/v1/me/family/chores", Json.ListFamilyChoreDto, cancellationToken);

    public Task SetChoreSettingsAsync(Guid choreId, ChoreSettingsRequest settings, CancellationToken cancellationToken) =>
        SendAsync(HttpMethod.Put, $"api/v1/me/family/chores/{choreId}/settings",
            JsonContent.Create(settings, Json.ChoreSettingsRequest), cancellationToken);

    public async Task<Guid> CreateFamilyChoreAsync(FamilyChoreRequest chore, CancellationToken cancellationToken) =>
        (await SendAsync(HttpMethod.Post, "api/v1/me/family/chores", chore, Json.FamilyChoreRequest, Json.IdResponse, cancellationToken)).Id;

    public Task UpdateFamilyChoreAsync(Guid choreId, FamilyChoreRequest chore, CancellationToken cancellationToken) =>
        SendAsync(HttpMethod.Patch, $"api/v1/me/family/chores/{choreId}", JsonContent.Create(chore, Json.FamilyChoreRequest), cancellationToken);

    public async Task<IReadOnlyList<FamilyRewardDto>> GetFamilyRewardsAsync(CancellationToken cancellationToken) =>
        await GetAsync("api/v1/me/family/rewards", Json.ListFamilyRewardDto, cancellationToken);

    public Task SetRewardSettingsAsync(Guid rewardId, RewardSettingsRequest settings, CancellationToken cancellationToken) =>
        SendAsync(HttpMethod.Put, $"api/v1/me/family/rewards/{rewardId}/settings",
            JsonContent.Create(settings, Json.RewardSettingsRequest), cancellationToken);

    public async Task<Guid> CreateFamilyRewardAsync(FamilyRewardRequest reward, CancellationToken cancellationToken) =>
        (await SendAsync(HttpMethod.Post, "api/v1/me/family/rewards", reward, Json.FamilyRewardRequest, Json.IdResponse, cancellationToken)).Id;

    public Task UpdateFamilyRewardAsync(Guid rewardId, FamilyRewardRequest reward, CancellationToken cancellationToken) =>
        SendAsync(HttpMethod.Patch, $"api/v1/me/family/rewards/{rewardId}", JsonContent.Create(reward, Json.FamilyRewardRequest), cancellationToken);
}
