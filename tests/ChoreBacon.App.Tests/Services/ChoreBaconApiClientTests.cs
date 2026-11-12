using System.Net;
using System.Text;
using ChoreBacon.Contracts.Progress;
using ChoreBacon.Services.Api;

namespace ChoreBacon.App.Tests.Services;

// Response bodies are copied from the API (web/app/api/v1/...) so contract drift fails here.
public class ChoreBaconApiClientTests
{
    private readonly CancellationToken _ct = TestContext.Current.CancellationToken;
    private readonly List<HttpRequestMessage> _requests = [];

    private ChoreBaconApiClient Client(HttpStatusCode status, string json) =>
        new(new HttpClient(new StubHandler(_requests, status, json)) { BaseAddress = new Uri("https://api.test/") });

    private const string Achievement = """
        {"id":"7c3f6a2e-4f7e-4a59-9f0a-0d1c2b3a4e5f","code":"first_chore","title":"Första steget","description":"Gör din första syssla",
         "icon":"ach_first","ruleType":"chores_completed","threshold":1,"bonusPoints":5,"rarity":"common","unlockedAt":"2026-11-11T17:43:51.123Z"}
        """;

    [Fact]
    public async Task Chores_are_read_with_frequency_and_period_state()
    {
        const string json = """
            [{"id":"a83ee39f-dd1e-471c-8925-c50eb5c76dac","title":"Bädda sängen","description":"Bädda din säng ordentligt","icon":"bed",
              "points":5,"frequency":"daily","completedThisPeriod":true,"completionStatus":"approved"},
             {"id":"b83ee39f-dd1e-471c-8925-c50eb5c76dac","title":"Tvätta","description":"","icon":"laundry",
              "points":20,"frequency":"weekly","completedThisPeriod":false,"completionStatus":null,"isFamilyItem":true}]
            """;

        var chores = await Client(HttpStatusCode.OK, json).GetChoresAsync(_ct);

        Assert.Equal("https://api.test/api/v1/chores", _requests.Single().RequestUri!.ToString());
        Assert.Equal(2, chores.Count);
        Assert.Equal((ChoreFrequency.Daily, true, CompletionStatus.Approved), (chores[0].Frequency, chores[0].CompletedThisPeriod, chores[0].CompletionStatus));
        Assert.Equal((ChoreFrequency.Weekly, false, (CompletionStatus?)null), (chores[1].Frequency, chores[1].CompletedThisPeriod, chores[1].CompletionStatus));
        // Older servers omit isFamilyItem: it then means a global chore.
        Assert.Equal([false, true], chores.Select(c => c.IsFamilyItem));
    }

    [Fact]
    public async Task Completing_a_chore_posts_and_returns_points_and_unlocks()
    {
        var json = $$"""
            {"completion":{"id":"c1a2b3c4-0000-4000-8000-000000000001","choreId":"a83ee39f-dd1e-471c-8925-c50eb5c76dac","localDate":"2026-11-11",
              "periodKey":"2026-11-11","status":"approved","completedAt":"2026-11-11T17:43:51.123Z"},
             "pointsEarned":5,"balance":10,"unlockedAchievements":[{{Achievement}}]}
            """;
        var choreId = Guid.Parse("a83ee39f-dd1e-471c-8925-c50eb5c76dac");

        var result = await Client(HttpStatusCode.Created, json).CompleteChoreAsync(choreId, _ct);

        var request = _requests.Single();
        Assert.Equal(HttpMethod.Post, request.Method);
        Assert.Equal($"https://api.test/api/v1/chores/{choreId}/complete", request.RequestUri!.ToString());
        Assert.Equal((5, 10), (result.PointsEarned, result.Balance));
        var unlocked = Assert.Single(result.UnlockedAchievements);
        Assert.Equal((AchievementRule.ChoresCompleted, AchievementRarity.Common), (unlocked.RuleType, unlocked.Rarity));
        Assert.NotNull(unlocked.UnlockedAt);
    }

    [Fact]
    public async Task A_409_surfaces_the_error_code()
    {
        const string json = """{"error":{"code":"chore_already_completed_today","message":"Already completed in this period"}}""";

        var ex = await Assert.ThrowsAsync<ApiException>(() => Client(HttpStatusCode.Conflict, json).CompleteChoreAsync(Guid.NewGuid(), _ct));

        Assert.Equal(HttpStatusCode.Conflict, ex.StatusCode);
        Assert.Equal(ProgressErrorCodes.AlreadyCompletedToday, ex.Code);
    }

    [Fact]
    public async Task Rewards_keep_unlimited_and_sold_out_stock_apart()
    {
        const string json = """
            [{"id":"d1a2b3c4-0000-4000-8000-000000000001","title":"Extra skärmtid","description":"30 minuter","icon":"reward_screen","cost":50,"stock":null},
             {"id":"d1a2b3c4-0000-4000-8000-000000000002","title":"Pizzakväll","description":"","icon":"reward_pizza","cost":200,"stock":0}]
            """;

        var rewards = await Client(HttpStatusCode.OK, json).GetRewardsAsync(_ct);

        Assert.Null(rewards[0].Stock);
        Assert.Equal(0, rewards[1].Stock);
    }

    [Fact]
    public async Task Redeeming_posts_and_returns_the_new_balance()
    {
        const string json = """
            {"redemption":{"id":"e1a2b3c4-0000-4000-8000-000000000001","rewardId":"d1a2b3c4-0000-4000-8000-000000000001","cost":50,
              "status":"pending","createdAt":"2026-11-11T18:00:00.000Z"},"balance":25,"unlockedAchievements":[]}
            """;
        var rewardId = Guid.Parse("d1a2b3c4-0000-4000-8000-000000000001");

        var result = await Client(HttpStatusCode.Created, json).RedeemRewardAsync(rewardId, _ct);

        Assert.Equal($"https://api.test/api/v1/rewards/{rewardId}/redeem", _requests.Single().RequestUri!.ToString());
        Assert.Equal((50, RedemptionStatus.Pending, 25), (result.Redemption.Cost, result.Redemption.Status, result.Balance));
        Assert.Empty(result.UnlockedAchievements);
    }

    [Fact]
    public async Task Achievements_and_progress_are_read()
    {
        var locked = Achievement.Replace("\"2026-11-11T17:43:51.123Z\"", "null");
        var achievements = await Client(HttpStatusCode.OK, $"[{Achievement},{locked}]").GetAchievementsAsync(_ct);
        Assert.NotNull(achievements[0].UnlockedAt);
        Assert.Null(achievements[1].UnlockedAt);

        var progressJson = $$"""
            {"balance":10,"lifetimeEarned":10,"pointsSpent":0,"choresCompleted":1,"streakDays":1,
             "choresDoneThisPeriod":1,"choresTotal":8,"recentAchievements":[{{Achievement}}],"familyName":"Familjen E2E"}
            """;
        var progress = await Client(HttpStatusCode.OK, progressJson).GetProgressAsync(_ct);
        Assert.Equal("https://api.test/api/v1/me/progress", _requests.Last().RequestUri!.ToString());
        Assert.Equal((10, 10, 1, 1, 8), (progress.Balance, progress.LifetimeEarned, progress.StreakDays, progress.ChoresDoneThisPeriod, progress.ChoresTotal));
        Assert.Single(progress.RecentAchievements);
        Assert.Equal("Familjen E2E", progress.FamilyName);
    }

    private sealed class StubHandler(List<HttpRequestMessage> requests, HttpStatusCode status, string json) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            requests.Add(request);
            return Task.FromResult(new HttpResponseMessage(status) { Content = new StringContent(json, Encoding.UTF8, "application/json") });
        }
    }
}
