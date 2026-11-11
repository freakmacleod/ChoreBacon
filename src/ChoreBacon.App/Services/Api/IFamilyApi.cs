using ChoreBacon.Contracts.Family;

namespace ChoreBacon.Services.Api;

/// <summary>Family endpoints. Parent-only calls answer 403 <c>not_parent</c> for children.</summary>
public interface IFamilyApi
{
    /// <returns>The caller's family, or null if they are not in one.</returns>
    Task<FamilyDto?> GetFamilyAsync(CancellationToken cancellationToken);
    Task<FamilyDto> CreateFamilyAsync(string name, CancellationToken cancellationToken);
    Task<FamilyDto> JoinFamilyAsync(string code, CancellationToken cancellationToken);
    Task<FamilyDto> UpdateFamilyAsync(UpdateFamilyRequest changes, CancellationToken cancellationToken);
    Task LeaveFamilyAsync(CancellationToken cancellationToken);
    Task<string> RegenerateInviteCodeAsync(CancellationToken cancellationToken);
    Task SetMemberRoleAsync(Guid userId, FamilyRole role, CancellationToken cancellationToken);
    Task RemoveMemberAsync(Guid userId, CancellationToken cancellationToken);

    Task<IReadOnlyList<PendingCompletionDto>> GetPendingCompletionsAsync(CancellationToken cancellationToken);
    Task<ReviewCompletionResponse> ReviewCompletionAsync(Guid completionId, bool approve, CancellationToken cancellationToken);
    Task<IReadOnlyList<PendingRedemptionDto>> GetPendingRedemptionsAsync(CancellationToken cancellationToken);
    Task FulfilRedemptionAsync(Guid redemptionId, CancellationToken cancellationToken);

    Task<IReadOnlyList<FamilyChoreDto>> GetFamilyChoresAsync(CancellationToken cancellationToken);
    Task SetChoreSettingsAsync(Guid choreId, ChoreSettingsRequest settings, CancellationToken cancellationToken);
    Task<Guid> CreateFamilyChoreAsync(FamilyChoreRequest chore, CancellationToken cancellationToken);
    Task UpdateFamilyChoreAsync(Guid choreId, FamilyChoreRequest chore, CancellationToken cancellationToken);
    Task<IReadOnlyList<FamilyRewardDto>> GetFamilyRewardsAsync(CancellationToken cancellationToken);
    Task SetRewardSettingsAsync(Guid rewardId, RewardSettingsRequest settings, CancellationToken cancellationToken);
    Task<Guid> CreateFamilyRewardAsync(FamilyRewardRequest reward, CancellationToken cancellationToken);
    Task UpdateFamilyRewardAsync(Guid rewardId, FamilyRewardRequest reward, CancellationToken cancellationToken);
}
