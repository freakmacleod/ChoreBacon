using System.Net;
using ChoreBacon.App.Tests.Fakes;
using ChoreBacon.Contracts.Auth;
using ChoreBacon.Services.Auth;
using Microsoft.Extensions.Time.Testing;

namespace ChoreBacon.App.Tests.Services;

public class AuthenticatedHttpHandlerTests
{
    private readonly InMemoryTokenStore _store = new();
    private readonly FakeAuthApi _api = new();
    private readonly TokenManager _tokens;

    public AuthenticatedHttpHandlerTests() =>
        _tokens = new TokenManager(_store, _api, new FakeTimeProvider(DateTimeOffset.UtcNow));

    private HttpClient ClientWith(RecordingHandler terminal) =>
        new(new AuthenticatedHttpHandler(_tokens) { InnerHandler = terminal }) { BaseAddress = new Uri("https://api.test/") };

    [Fact]
    public async Task Sends_without_authorization_when_signed_out()
    {
        var terminal = new RecordingHandler(_ => new HttpResponseMessage(HttpStatusCode.OK));
        await ClientWith(terminal).GetAsync("api/v1/me", TestContext.Current.CancellationToken);

        Assert.Null(Assert.Single(terminal.Requests).Authorization);
    }

    [Fact]
    public async Task Attaches_the_bearer_token()
    {
        await _tokens.SaveAsync(new TokenResponse("access-0", "refresh-0", "Bearer", 900));
        var terminal = new RecordingHandler(_ => new HttpResponseMessage(HttpStatusCode.OK));

        await ClientWith(terminal).GetAsync("api/v1/me", TestContext.Current.CancellationToken);

        Assert.Equal("Bearer access-0", Assert.Single(terminal.Requests).Authorization);
    }

    [Fact]
    public async Task On_401_refreshes_once_and_replays_the_request_with_its_body()
    {
        await _tokens.SaveAsync(new TokenResponse("access-0", "refresh-0", "Bearer", 900));
        var terminal = new RecordingHandler(req =>
            new HttpResponseMessage(req.Headers.Authorization?.Parameter == "access-0" ? HttpStatusCode.Unauthorized : HttpStatusCode.OK));

        var response = await ClientWith(terminal).PostAsync("api/v1/x", new StringContent("{\"a\":1}"), TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(1, _api.RefreshCalls);
        Assert.Collection(terminal.Requests,
            first => Assert.Equal(("Bearer access-0", "{\"a\":1}"), first),
            retry => Assert.Equal(("Bearer access-1", "{\"a\":1}"), retry));
    }

    [Fact]
    public async Task Returns_the_401_when_the_session_cannot_be_refreshed()
    {
        await _tokens.SaveAsync(new TokenResponse("access-0", "refresh-0", "Bearer", 900));
        _api.OnRefresh = _ => throw FakeAuthApi.Unauthorized(AuthErrorCodes.RefreshTokenReused);
        var terminal = new RecordingHandler(_ => new HttpResponseMessage(HttpStatusCode.Unauthorized));

        var response = await ClientWith(terminal).GetAsync("api/v1/me", TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Single(terminal.Requests);
        Assert.Null(_store.Tokens);
    }
}
