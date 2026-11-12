using ChoreBacon.Contracts.Auth;
using ChoreBacon.Contracts.Progress;
using ChoreBacon.Services.Api;

namespace ChoreBacon.App.Tests.Fakes;

/// <summary>Scriptable <see cref="IChoreBaconApi"/>: each call runs its <c>On…</c> delegate; unset ones throw.</summary>
internal sealed class FakeChoreBaconApi : IChoreBaconApi
{
    public Func<Task<MeResponse>> OnGetMe { get; set; } = () => throw new NotSupportedException();
    public Func<Task<ProgressResponse>> OnGetProgress { get; set; } = () => throw new NotSupportedException();
    public Func<Task<IReadOnlyList<ChoreDto>>> OnGetChores { get; set; } = () => throw new NotSupportedException();
    public Func<Guid, Task<CompleteChoreResponse>> OnCompleteChore { get; set; } = _ => throw new NotSupportedException();
    public Func<Task<IReadOnlyList<RewardDto>>> OnGetRewards { get; set; } = () => throw new NotSupportedException();
    public Func<Guid, Task<RedeemRewardResponse>> OnRedeemReward { get; set; } = _ => throw new NotSupportedException();
    public Func<Task<IReadOnlyList<AchievementDto>>> OnGetAchievements { get; set; } = () => throw new NotSupportedException();
    public Func<Task> OnDeleteAccount { get; set; } = () => Task.CompletedTask;
    public int Deletions { get; private set; }

    public List<Guid> Completed { get; } = [];
    public List<Guid> Redeemed { get; } = [];

    public Task<MeResponse> GetMeAsync(CancellationToken cancellationToken) => OnGetMe();
    public Task<ProgressResponse> GetProgressAsync(CancellationToken cancellationToken) => OnGetProgress();
    public Task<IReadOnlyList<ChoreDto>> GetChoresAsync(CancellationToken cancellationToken) => OnGetChores();
    public Task<IReadOnlyList<RewardDto>> GetRewardsAsync(CancellationToken cancellationToken) => OnGetRewards();
    public Task<IReadOnlyList<AchievementDto>> GetAchievementsAsync(CancellationToken cancellationToken) => OnGetAchievements();

    public Task<CompleteChoreResponse> CompleteChoreAsync(Guid choreId, CancellationToken cancellationToken)
    {
        Completed.Add(choreId);
        return OnCompleteChore(choreId);
    }

    public Task DeleteAccountAsync(CancellationToken cancellationToken)
    {
        Deletions++;
        return OnDeleteAccount();
    }

    public Task<RedeemRewardResponse> RedeemRewardAsync(Guid rewardId, CancellationToken cancellationToken)
    {
        Redeemed.Add(rewardId);
        return OnRedeemReward(rewardId);
    }
}
