using ChoreBacon.App.Tests.Fakes;
using ChoreBacon.Contracts.Progress;
using ChoreBacon.Services.Ui;
using ChoreBacon.ViewModels;

namespace ChoreBacon.App.Tests.ViewModels;

public class DashboardViewModelTests
{
    private readonly FakeChoreBaconApi _api = new();
    private readonly FakeAuthService _auth = new();
    private readonly FakeNavigator _navigator = new();

    [Fact]
    public async Task Load_shows_the_API_progress()
    {
        var achievement = Dto.Achievement(unlockedAt: DateTimeOffset.UtcNow);
        _api.OnGetProgress = () => Task.FromResult(Dto.Progress(balance: 15, lifetime: 120, streak: 3, done: 2, total: 8, achievement));
        var vm = new DashboardViewModel(_api, _auth, _navigator);

        await vm.LoadCommand.ExecuteAsync(null);

        Assert.Equal("Anna Andersson", vm.UserName);
        Assert.Equal((15, 120, 3, 2, 8), (vm.Balance, vm.LifetimeEarned, vm.StreakDays, vm.ChoresDone, vm.ChoresTotal));
        Assert.Equal([achievement], vm.RecentAchievements);
    }

    [Fact]
    public async Task Logout_ends_the_session_and_shows_login()
    {
        var vm = new DashboardViewModel(_api, _auth, _navigator);

        await vm.LogoutCommand.ExecuteAsync(null);

        Assert.Equal(1, _auth.Logouts);
        Assert.Equal([Routes.Login], _navigator.Routes);
    }
}

public class AchievementsViewModelTests
{
    [Fact]
    public async Task Load_counts_unlocked_achievements_and_colours_rarity()
    {
        var api = new FakeChoreBaconApi
        {
            OnGetAchievements = () => Task.FromResult<IReadOnlyList<AchievementDto>>(
            [
                Dto.Achievement("A", unlockedAt: DateTimeOffset.UtcNow),
                Dto.Achievement("B", rarity: AchievementRarity.Legendary),
            ]),
        };
        var vm = new AchievementsViewModel(api, new FakeNavigator());

        await vm.LoadCommand.ExecuteAsync(null);

        Assert.Equal((1, 2), (vm.UnlockedCount, vm.TotalCount));
        Assert.Equal([true, false], vm.Achievements.Select(a => a.IsUnlocked));
        Assert.Equal("#FF9800", vm.Achievements[1].RarityColor);
    }
}
