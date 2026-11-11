using ChoreBacon.Contracts.Family;
using ChoreBacon.Services.Api;

namespace ChoreBacon.App.Tests.Fakes;

/// <summary>Scriptable <see cref="IFamilyApi"/>: records calls; unset handlers throw.</summary>
internal sealed class FakeFamilyApi : IFamilyApi
{
    public FamilyDto? Family { get; set; }
    public Func<string, FamilyDto> OnJoin { get; set; } = _ => throw new NotSupportedException();
    public Func<Task>? OnLeave { get; set; }
    public List<IReadOnlyList<PendingCompletionDto>> CompletionLists { get; } = [];
    public IReadOnlyList<PendingCompletionDto> Completions { get; set; } = [];
    public IReadOnlyList<PendingRedemptionDto> Redemptions { get; set; } = [];
    public Func<Guid, bool, ReviewCompletionResponse> OnReview { get; set; } = (_, _) => new(Contracts.Progress.CompletionStatus.Approved, []);
    public IReadOnlyList<FamilyChoreDto> Chores { get; set; } = [];
    public IReadOnlyList<FamilyRewardDto> Rewards { get; set; } = [];

    public List<string> Calls { get; } = [];
    public List<UpdateFamilyRequest> Updates { get; } = [];
    public List<(Guid Id, ChoreSettingsRequest Settings)> ChoreSettings { get; } = [];
    public List<(Guid Id, RewardSettingsRequest Settings)> RewardSettings { get; } = [];
    public List<FamilyChoreRequest> CreatedChores { get; } = [];
    public List<FamilyRewardRequest> CreatedRewards { get; } = [];
    public List<(Guid Id, FamilyChoreRequest Chore)> UpdatedChores { get; } = [];

    public Task<FamilyDto?> GetFamilyAsync(CancellationToken cancellationToken) => Task.FromResult(Family);

    public Task<FamilyDto> CreateFamilyAsync(string name, CancellationToken cancellationToken)
    {
        Calls.Add($"create {name}");
        Family = Make.Family(name, FamilyRole.Parent, inviteCode: "K7PQ-4XMR");
        return Task.FromResult(Family);
    }

    public Task<FamilyDto> JoinFamilyAsync(string code, CancellationToken cancellationToken)
    {
        Calls.Add($"join {code}");
        Family = OnJoin(code);
        return Task.FromResult(Family);
    }

    public Task<FamilyDto> UpdateFamilyAsync(UpdateFamilyRequest changes, CancellationToken cancellationToken)
    {
        Updates.Add(changes);
        Family = Family! with { RequiresApproval = changes.RequiresApproval ?? Family.RequiresApproval, Name = changes.Name ?? Family.Name };
        return Task.FromResult(Family);
    }

    public async Task LeaveFamilyAsync(CancellationToken cancellationToken)
    {
        Calls.Add("leave");
        if (OnLeave is not null) await OnLeave();
        Family = null;
    }

    public Task<string> RegenerateInviteCodeAsync(CancellationToken cancellationToken) => Task.FromResult("NEWC-ODE2");

    public Task SetMemberRoleAsync(Guid userId, FamilyRole role, CancellationToken cancellationToken)
    {
        Calls.Add($"role {userId} {role}");
        return Task.CompletedTask;
    }

    public Task RemoveMemberAsync(Guid userId, CancellationToken cancellationToken)
    {
        Calls.Add($"remove {userId}");
        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<PendingCompletionDto>> GetPendingCompletionsAsync(CancellationToken cancellationToken) => Task.FromResult(Completions);

    public Task<ReviewCompletionResponse> ReviewCompletionAsync(Guid completionId, bool approve, CancellationToken cancellationToken)
    {
        Calls.Add($"{(approve ? "approve" : "reject")} {completionId}");
        return Task.FromResult(OnReview(completionId, approve));
    }

    public Task<IReadOnlyList<PendingRedemptionDto>> GetPendingRedemptionsAsync(CancellationToken cancellationToken) => Task.FromResult(Redemptions);

    public Task FulfilRedemptionAsync(Guid redemptionId, CancellationToken cancellationToken)
    {
        Calls.Add($"fulfil {redemptionId}");
        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<FamilyChoreDto>> GetFamilyChoresAsync(CancellationToken cancellationToken) => Task.FromResult(Chores);

    public Task SetChoreSettingsAsync(Guid choreId, ChoreSettingsRequest settings, CancellationToken cancellationToken)
    {
        ChoreSettings.Add((choreId, settings));
        return Task.CompletedTask;
    }

    public Task<Guid> CreateFamilyChoreAsync(FamilyChoreRequest chore, CancellationToken cancellationToken)
    {
        CreatedChores.Add(chore);
        return Task.FromResult(Guid.NewGuid());
    }

    public Task UpdateFamilyChoreAsync(Guid choreId, FamilyChoreRequest chore, CancellationToken cancellationToken)
    {
        UpdatedChores.Add((choreId, chore));
        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<FamilyRewardDto>> GetFamilyRewardsAsync(CancellationToken cancellationToken) => Task.FromResult(Rewards);

    public Task SetRewardSettingsAsync(Guid rewardId, RewardSettingsRequest settings, CancellationToken cancellationToken)
    {
        RewardSettings.Add((rewardId, settings));
        return Task.CompletedTask;
    }

    public Task<Guid> CreateFamilyRewardAsync(FamilyRewardRequest reward, CancellationToken cancellationToken)
    {
        CreatedRewards.Add(reward);
        return Task.FromResult(Guid.NewGuid());
    }

    public Task UpdateFamilyRewardAsync(Guid rewardId, FamilyRewardRequest reward, CancellationToken cancellationToken) => Task.CompletedTask;
}

internal static class Make
{
    public static readonly Guid Me = Guid.Parse("11111111-1111-4111-8111-111111111111");

    public static FamilyDto Family(string name = "Familjen", FamilyRole role = FamilyRole.Parent, bool requiresApproval = false,
        string? inviteCode = "K7PQ-4XMR", params FamilyMemberDto[] others) =>
        new(Guid.NewGuid(), name, requiresApproval, role == FamilyRole.Parent ? inviteCode : null, role,
            [new FamilyMemberDto(Me, "Anna Andersson", role, 10), .. others]);

    public static FamilyMemberDto Member(string name, FamilyRole role) => new(Guid.NewGuid(), name, role, 0);
}
