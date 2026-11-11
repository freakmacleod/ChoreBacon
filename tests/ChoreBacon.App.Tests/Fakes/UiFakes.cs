using ChoreBacon.Contracts.Auth;
using ChoreBacon.Contracts.Progress;
using ChoreBacon.Services.Interfaces;
using ChoreBacon.Services.Ui;

namespace ChoreBacon.App.Tests.Fakes;

internal sealed class FakeNavigator : INavigator
{
    public List<string> Routes { get; } = [];

    public Task GoToAsync(string route)
    {
        Routes.Add(route);
        return Task.CompletedTask;
    }
}

internal sealed class FakeDialogs(bool answer = true) : IDialogs
{
    public List<string> Messages { get; } = [];

    public Task<bool> ConfirmAsync(string title, string message, string accept, string cancel)
    {
        Messages.Add(message);
        return Task.FromResult(answer);
    }
}

internal sealed class FakeAuthService : IAuthService
{
    public MeResponse? CurrentUser { get; set; } = new(Guid.NewGuid(), "google", "Anna Andersson", null, "user");
    public bool IsLoggedIn => CurrentUser is not null;
    public int Logouts { get; private set; }

    public Task<MeResponse?> LoginWithGoogleAsync(CancellationToken cancellationToken = default) => throw new NotSupportedException();
    public Task<MeResponse?> LoginWithFacebookAsync(CancellationToken cancellationToken = default) => throw new NotSupportedException();
    public Task<MeResponse> LoginAsDevAsync(CancellationToken cancellationToken = default) => throw new NotSupportedException();
    public Task<bool> TryRestoreSessionAsync(CancellationToken cancellationToken = default) => throw new NotSupportedException();

    public Task LogoutAsync(CancellationToken cancellationToken = default)
    {
        Logouts++;
        CurrentUser = null;
        return Task.CompletedTask;
    }
}

/// <summary>Small builders for API DTOs.</summary>
internal static class Dto
{
    public static ChoreDto Chore(string title = "Diska", int points = 10, bool done = false,
        ChoreFrequency frequency = ChoreFrequency.Daily, CompletionStatus? status = null) =>
        new(Guid.NewGuid(), title, "", "dishes", points, frequency, done, done ? status ?? CompletionStatus.Approved : null);

    public static RewardDto Reward(string title = "Glass", int cost = 50, int? stock = null) =>
        new(Guid.NewGuid(), title, "", "reward_icecream", cost, stock);

    public static AchievementDto Achievement(string title = "Första steget", DateTimeOffset? unlockedAt = null,
        AchievementRarity rarity = AchievementRarity.Common, int bonus = 5) =>
        new(Guid.NewGuid(), "first_chore", title, "", "ach_first", AchievementRule.ChoresCompleted, 1, bonus, rarity, unlockedAt);

    public static ProgressResponse Progress(int balance = 0, int lifetime = 0, int streak = 0, int done = 0, int total = 0,
        params AchievementDto[] recent) =>
        new(balance, lifetime, lifetime - balance, done, streak, done, total, recent);

    public static CompleteChoreResponse Completed(ChoreDto chore, int balance, params AchievementDto[] unlocked) =>
        new(new CompletionDto(Guid.NewGuid(), chore.Id, "2026-11-11", "2026-11-11", CompletionStatus.Approved, DateTimeOffset.UtcNow),
            chore.Points, balance, unlocked);

    public static RedeemRewardResponse Redeemed(RewardDto reward, int balance) =>
        new(new RedemptionDto(Guid.NewGuid(), reward.Id, reward.Cost, RedemptionStatus.Pending, DateTimeOffset.UtcNow), balance, []);
}
