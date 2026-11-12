using System.Net;
using ChoreBacon.App.Tests.Fakes;
using ChoreBacon.Contracts.Auth;
using ChoreBacon.Services;
using ChoreBacon.Services.Api;
using ChoreBacon.Services.Auth;
using Microsoft.Extensions.Time.Testing;

namespace ChoreBacon.App.Tests.Services;

public class AuthServiceTests
{
    private static readonly MeResponse Me = new(Guid.Parse("e1b8ce10-45c2-4cd7-b694-cb7339d72acf"), "google", "Anna Andersson", "anna@example.se", "user");

    private readonly InMemoryTokenStore _store = new();
    private readonly FakeAuthApi _authApi = new();
    private readonly FakeChoreBaconApi _api = new() { OnGetMe = () => Task.FromResult(Me) };
    private readonly ApiConfig _config = new(new Uri("https://api.test"));
    private readonly CancellationToken _ct = TestContext.Current.CancellationToken;

    private AuthService CreateService(FakeWebAuthenticator? web = null)
    {
        var time = new FakeTimeProvider(new DateTimeOffset(2026, 11, 10, 12, 0, 0, TimeSpan.Zero));
        return new AuthService(
            web ?? new FakeWebAuthenticator(_ => throw new InvalidOperationException("browser not expected")),
            _authApi, _api, new TokenManager(_store, _authApi, time), _config);
    }

    [Fact]
    public async Task Google_sign_in_stores_tokens_and_loads_the_profile_from_the_API()
    {
        var web = new FakeWebAuthenticator(_ => FakeWebAuthenticator.Callback("access_token=a.b.c&refresh_token=r1&expires_in=900"));
        var auth = CreateService(web);

        var user = await auth.LoginWithGoogleAsync(_ct);

        Assert.Equal(new Uri("https://api.test/api/v1/auth/google/start"), web.LastOptions!.Url);
        Assert.Equal(new Uri("chorebacon://auth"), web.LastOptions.CallbackUrl);
        Assert.Equal("r1", _store.Tokens!.RefreshToken);
        Assert.NotNull(user);
        Assert.Equal(Me, user);
        Assert.Same(user, auth.CurrentUser);
    }

    [Fact]
    public async Task Returning_user_gets_a_new_session()
    {
        // Business rule 6: returning users get fresh tokens too, not only new users.
        var callbacks = new Queue<string>(["access_token=a1&refresh_token=r1&expires_in=900", "access_token=a2&refresh_token=r2&expires_in=900"]);
        var auth = CreateService(new FakeWebAuthenticator(_ => FakeWebAuthenticator.Callback(callbacks.Dequeue())));

        var first = await auth.LoginWithGoogleAsync(_ct);
        await auth.LogoutAsync(_ct);
        var second = await auth.LoginWithGoogleAsync(_ct);

        Assert.Equal(first!.Id, second!.Id);
        Assert.Equal("r2", _store.Tokens!.RefreshToken);
    }

    [Theory]
    [InlineData(AuthErrorCodes.AccessDenied)]
    [InlineData(AuthErrorCodes.InvalidState)]
    [InlineData(AuthErrorCodes.ProviderError)]
    public async Task Error_in_the_callback_fails_sign_in_with_that_code(string code)
    {
        var auth = CreateService(new FakeWebAuthenticator(_ => FakeWebAuthenticator.Callback($"error={code}")));

        var ex = await Assert.ThrowsAsync<AuthException>(() => auth.LoginWithGoogleAsync(_ct));

        Assert.Equal(code, ex.Code);
        Assert.Null(_store.Tokens);
        Assert.False(auth.IsLoggedIn);
    }

    [Fact]
    public async Task Closing_the_browser_is_a_cancel_not_an_error()
    {
        var auth = CreateService(new FakeWebAuthenticator(_ => throw new TaskCanceledException()));

        Assert.Null(await auth.LoginWithFacebookAsync(_ct));
        Assert.False(auth.IsLoggedIn);
    }

    [Fact]
    public async Task Restore_without_stored_tokens_shows_login()
    {
        Assert.False(await CreateService().TryRestoreSessionAsync(_ct));
    }

    [Fact]
    public async Task Restore_with_a_valid_session_signs_in()
    {
        _store.Tokens = new AuthTokens("a", "r", DateTimeOffset.MaxValue);
        var auth = CreateService();

        Assert.True(await auth.TryRestoreSessionAsync(_ct));
        Assert.Equal("Anna Andersson", auth.CurrentUser!.DisplayName);
    }

    [Fact]
    public async Task Restore_with_a_revoked_session_clears_tokens()
    {
        _store.Tokens = new AuthTokens("a", "r", DateTimeOffset.MaxValue);
        _api.OnGetMe = () => throw new ApiException(HttpStatusCode.Unauthorized, "unauthorized", "");

        Assert.False(await CreateService().TryRestoreSessionAsync(_ct));
        Assert.Null(_store.Tokens);
    }

    [Fact]
    public async Task Restore_while_offline_keeps_tokens_for_next_start()
    {
        _store.Tokens = new AuthTokens("a", "r", DateTimeOffset.MaxValue);
        _api.OnGetMe = () => throw new HttpRequestException("offline");

        Assert.False(await CreateService().TryRestoreSessionAsync(_ct));
        Assert.NotNull(_store.Tokens);
    }

    [Fact]
    public async Task Deleting_the_account_forgets_the_local_session()
    {
        _store.Tokens = new AuthTokens("a", "r", DateTimeOffset.MaxValue);
        var auth = CreateService();
        await auth.TryRestoreSessionAsync(_ct);

        await auth.DeleteAccountAsync(_ct);

        Assert.Equal(1, _api.Deletions);
        Assert.Null(_store.Tokens);
        Assert.False(auth.IsLoggedIn);
    }

    [Fact]
    public async Task A_refused_deletion_keeps_the_user_signed_in()
    {
        _store.Tokens = new AuthTokens("a", "r", DateTimeOffset.MaxValue);
        _api.OnDeleteAccount = () => throw new ApiException(HttpStatusCode.Conflict, "last_parent", "");
        var auth = CreateService();
        await auth.TryRestoreSessionAsync(_ct);

        await Assert.ThrowsAsync<ApiException>(() => auth.DeleteAccountAsync(_ct));

        Assert.NotNull(_store.Tokens);
        Assert.True(auth.IsLoggedIn);
    }

    [Fact]
    public async Task Logout_clears_tokens_and_revokes_the_server_session()
    {
        _store.Tokens = new AuthTokens("a", "r", DateTimeOffset.MaxValue);
        var auth = CreateService();
        await auth.TryRestoreSessionAsync(_ct);

        await auth.LogoutAsync(_ct);

        Assert.Null(_store.Tokens);
        Assert.False(auth.IsLoggedIn);
        Assert.Equal(["r"], _authApi.LoggedOut);
    }
}
