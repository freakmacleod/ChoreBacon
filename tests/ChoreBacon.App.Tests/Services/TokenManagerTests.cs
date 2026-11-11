using ChoreBacon.App.Tests.Fakes;
using ChoreBacon.Contracts.Auth;
using ChoreBacon.Services.Auth;
using Microsoft.Extensions.Time.Testing;

namespace ChoreBacon.App.Tests.Services;

public class TokenManagerTests
{
    private readonly FakeTimeProvider _time = new(new DateTimeOffset(2026, 11, 10, 12, 0, 0, TimeSpan.Zero));
    private readonly InMemoryTokenStore _store = new();
    private readonly FakeAuthApi _api = new();
    private readonly TokenManager _tokens;

    public TokenManagerTests() => _tokens = new TokenManager(_store, _api, _time);

    private Task SignInAsync(int expiresIn = 900) =>
        _tokens.SaveAsync(new TokenResponse("access-0", "refresh-0", "Bearer", expiresIn));

    [Fact]
    public async Task No_session_means_no_token_and_no_refresh()
    {
        Assert.Null(await _tokens.GetAccessTokenAsync(TestContext.Current.CancellationToken));
        Assert.Equal(0, _api.RefreshCalls);
    }

    [Fact]
    public async Task Fresh_token_is_used_as_is()
    {
        await SignInAsync();
        _time.Advance(TimeSpan.FromMinutes(13)); // 2 min left, outside the 60 s skew

        Assert.Equal("access-0", await _tokens.GetAccessTokenAsync(TestContext.Current.CancellationToken));
        Assert.Equal(0, _api.RefreshCalls);
    }

    [Fact]
    public async Task Token_about_to_expire_is_refreshed_and_rotated_tokens_are_stored()
    {
        await SignInAsync();
        _time.Advance(TimeSpan.FromMinutes(14.5)); // 30 s left, inside the skew

        Assert.Equal("access-1", await _tokens.GetAccessTokenAsync(TestContext.Current.CancellationToken));
        Assert.Equal(1, _api.RefreshCalls);
        Assert.Equal("refresh-1", _store.Tokens!.RefreshToken);
        Assert.Equal(_time.GetUtcNow().AddSeconds(900), _store.Tokens.AccessTokenExpiresAt);
    }

    [Fact]
    public async Task Rejected_refresh_ends_the_session()
    {
        await SignInAsync();
        _api.OnRefresh = _ => throw FakeAuthApi.Unauthorized(AuthErrorCodes.SessionRevoked);

        Assert.Null(await _tokens.RefreshAsync("access-0", TestContext.Current.CancellationToken));
        Assert.Null(_store.Tokens);
    }

    [Fact]
    public async Task Network_failure_keeps_the_session_for_a_later_retry()
    {
        await SignInAsync();
        _api.OnRefresh = _ => throw new HttpRequestException("offline");

        await Assert.ThrowsAsync<HttpRequestException>(() => _tokens.RefreshAsync("access-0", TestContext.Current.CancellationToken));
        Assert.Equal("refresh-0", _store.Tokens!.RefreshToken);
    }

    [Fact]
    public async Task Concurrent_refreshes_use_the_refresh_token_only_once()
    {
        // The API revokes the whole session if a refresh token is presented twice.
        await SignInAsync();
        var release = new TaskCompletionSource();
        _api.OnRefresh = async _ =>
        {
            await release.Task;
            return _api.NextTokens();
        };

        var calls = Enumerable.Range(0, 5)
            .Select(_ => _tokens.RefreshAsync("access-0", TestContext.Current.CancellationToken))
            .ToArray();
        release.SetResult();
        var results = await Task.WhenAll(calls);

        Assert.Equal(1, _api.RefreshCalls);
        Assert.All(results, token => Assert.Equal("access-1", token));
    }
}
