using System.Net;
using ChoreBacon.App.Tests.Fakes;
using ChoreBacon.Services.Api;
using ChoreBacon.Services.Auth;
using ChoreBacon.Services.Push;

namespace ChoreBacon.App.Tests.Services;

public class PushRegistrationTests
{
    private readonly FakeChoreBaconApi _api = new();
    private readonly InMemoryTokenStore _store = new();
    private readonly FakePushSource _source = new();
    private readonly CancellationToken _ct = TestContext.Current.CancellationToken;

    private PushRegistration Create() => new(_source, _api, _store);

    [Fact]
    public async Task Registers_the_device_token_once_permission_is_granted()
    {
        await Create().RegisterAsync(_ct);
        Assert.Equal([("fcm-token", "android")], _api.RegisteredDevices);
    }

    [Fact]
    public async Task Does_nothing_without_permission_or_without_push_support()
    {
        _source.Granted = false;
        await Create().RegisterAsync(_ct);
        var unsupported = new PushRegistration(new NoPushTokenSource(), _api, _store);
        await unsupported.RegisterAsync(_ct);
        await unsupported.UnregisterAsync(_ct);
        await unsupported.TokenRefreshedAsync("x");
        Assert.Empty(_api.RegisteredDevices);
        Assert.Empty(_api.UnregisteredDevices);
    }

    [Fact]
    public async Task Never_lets_a_push_failure_escape()
    {
        _api.OnRegisterDevice = _ => throw new HttpRequestException("offline");
        _api.OnUnregisterDevice = _ => throw new ApiException(HttpStatusCode.InternalServerError, "server_error", "");
        _store.Tokens = new AuthTokens("a", "r", DateTimeOffset.MaxValue);
        var push = Create();

        await push.RegisterAsync(_ct);
        await push.TokenRefreshedAsync("new-token");
        await push.UnregisterAsync(_ct);
        _source.Fails = true;
        await push.RegisterAsync(_ct);
    }

    [Fact]
    public async Task A_rotated_token_is_sent_only_while_signed_in()
    {
        var push = Create();
        await push.TokenRefreshedAsync("rotated-1");
        _store.Tokens = new AuthTokens("a", "r", DateTimeOffset.MaxValue);
        await push.TokenRefreshedAsync("rotated-2");
        Assert.Equal([("rotated-2", "android")], _api.RegisteredDevices);
    }

    [Fact]
    public async Task Unregisters_the_current_token()
    {
        await Create().UnregisterAsync(_ct);
        Assert.Equal(["fcm-token"], _api.UnregisteredDevices);
    }

    private sealed class FakePushSource : IPushTokenSource
    {
        public bool Granted { get; set; } = true;
        public bool Fails { get; set; }
        public bool IsSupported => true;
        public string Platform => "android";
        public Task<bool> RequestPermissionAsync() => Task.FromResult(Granted);
        public Task<string> GetTokenAsync(CancellationToken cancellationToken) =>
            Fails ? throw new InvalidOperationException("Firebase not initialised") : Task.FromResult("fcm-token");
    }
}
