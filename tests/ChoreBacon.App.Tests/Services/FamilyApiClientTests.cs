using System.Net;
using System.Text;
using ChoreBacon.Contracts.Family;
using ChoreBacon.Services.Api;

namespace ChoreBacon.App.Tests.Services;

// Response bodies follow the API (web/app/api/v1/me/family/...), so contract drift fails here.
public class FamilyApiClientTests
{
    private readonly CancellationToken _ct = TestContext.Current.CancellationToken;
    private readonly List<(HttpMethod Method, string Uri, string? Body)> _requests = [];

    private FamilyApiClient Client(HttpStatusCode status, string json) =>
        new(new HttpClient(new StubHandler(_requests, status, json)) { BaseAddress = new Uri("https://api.test/") });

    [Fact]
    public async Task Reads_the_family_as_the_API_returns_it()
    {
        const string json = """
            {"id":"3b0d7a52-1d0e-4bd7-a1e5-2f1c0f6a9d10","name":"Familjen E2E","requiresApproval":true,"inviteCode":"VYG3-REE7","role":"parent",
             "members":[{"userId":"a1b2c3d4-0000-4000-8000-000000000001","displayName":"Förälder","role":"parent","balance":0},
                        {"userId":"a1b2c3d4-0000-4000-8000-000000000002","displayName":"Barn","role":"child","balance":10}]}
            """;

        var family = await Client(HttpStatusCode.OK, json).GetFamilyAsync(_ct);

        Assert.NotNull(family);
        Assert.Equal(("VYG3-REE7", FamilyRole.Parent, true), (family.InviteCode, family.Role, family.RequiresApproval));
        Assert.Equal([FamilyRole.Parent, FamilyRole.Child], family.Members.Select(m => m.Role));
    }

    [Fact]
    public async Task No_family_is_null_not_an_error()
    {
        var family = await Client(HttpStatusCode.NotFound, """{"error":{"code":"no_family","message":"Not a member of a family"}}""").GetFamilyAsync(_ct);
        Assert.Null(family);
    }

    [Fact]
    public async Task Other_404s_still_throw()
    {
        await Assert.ThrowsAsync<ApiException>(() =>
            Client(HttpStatusCode.NotFound, """{"error":{"code":"not_found","message":""}}""").GetFamilyAsync(_ct));
    }

    [Fact]
    public async Task Updates_send_only_the_changed_setting()
    {
        const string json = """{"id":"3b0d7a52-1d0e-4bd7-a1e5-2f1c0f6a9d10","name":"F","requiresApproval":true,"inviteCode":null,"role":"parent","members":[]}""";

        await Client(HttpStatusCode.OK, json).UpdateFamilyAsync(new UpdateFamilyRequest(RequiresApproval: true), _ct);

        var request = _requests.Single();
        Assert.Equal((HttpMethod.Patch, "https://api.test/api/v1/me/family"), (request.Method, request.Uri));
        Assert.Equal("""{"requiresApproval":true}""", request.Body);
    }

    [Fact]
    public async Task Settings_send_null_explicitly_to_clear_an_override()
    {
        var choreId = Guid.NewGuid();

        await Client(HttpStatusCode.OK, $$"""{"id":"{{choreId}}"}""").SetChoreSettingsAsync(choreId, new ChoreSettingsRequest(true, null), _ct);

        Assert.Equal((HttpMethod.Put, $"https://api.test/api/v1/me/family/chores/{choreId}/settings"), (_requests[0].Method, _requests[0].Uri));
        Assert.Equal("""{"isActive":true,"pointsOverride":null}""", _requests[0].Body);
    }

    [Fact]
    public async Task Review_posts_to_approve_or_reject()
    {
        var id = Guid.NewGuid();
        const string json = """{"status":"approved","unlockedAchievements":[]}""";
        await Client(HttpStatusCode.OK, json).ReviewCompletionAsync(id, approve: true, _ct);
        await Client(HttpStatusCode.OK, json.Replace("approved", "rejected")).ReviewCompletionAsync(id, approve: false, _ct);
        Assert.Equal([$"https://api.test/api/v1/me/family/completions/{id}/approve", $"https://api.test/api/v1/me/family/completions/{id}/reject"],
            _requests.Select(r => r.Uri));
    }

    [Fact]
    public async Task Creating_a_family_reward_sends_unlimited_stock_as_null()
    {
        var created = Guid.NewGuid();
        var id = await Client(HttpStatusCode.Created, $$"""{"id":"{{created}}"}""")
            .CreateFamilyRewardAsync(new FamilyRewardRequest("Bio", "", "reward_movie", 40, null, true), _ct);

        Assert.Equal(created, id);
        Assert.Equal("""{"title":"Bio","description":"","icon":"reward_movie","cost":40,"stock":null,"isActive":true}""", _requests[0].Body);
    }

    private sealed class StubHandler(List<(HttpMethod, string, string?)> requests, HttpStatusCode status, string json) : HttpMessageHandler
    {
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var body = request.Content is null ? null : await request.Content.ReadAsStringAsync(cancellationToken);
            requests.Add((request.Method, request.RequestUri!.ToString(), body));
            return new HttpResponseMessage(status) { Content = new StringContent(json, Encoding.UTF8, "application/json") };
        }
    }
}
