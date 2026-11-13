using System.Net;
using ChoreBacon.Contracts.Auth;
using ChoreBacon.Services.Api;
using ChoreBacon.Services.Auth;

namespace ChoreBacon.App.Tests.Fakes;

internal sealed class InMemoryTokenStore : ITokenStore
{
    public AuthTokens? Tokens { get; set; }
    public Task<AuthTokens?> LoadAsync() => Task.FromResult(Tokens);
    public Task SaveAsync(AuthTokens tokens) { Tokens = tokens; return Task.CompletedTask; }
    public Task ClearAsync() { Tokens = null; return Task.CompletedTask; }
}

internal sealed class FakeAuthApi : IAuthApi
{
    private int _issued;
    public int RefreshCalls;
    public List<string> LoggedOut { get; } = [];
    public Func<string, Task<TokenResponse>>? OnRefresh { get; set; }

    public TokenResponse NextTokens(int expiresIn = 900)
    {
        var n = Interlocked.Increment(ref _issued);
        return new TokenResponse($"access-{n}", $"refresh-{n}", "Bearer", expiresIn);
    }

    public Task<TokenResponse> RefreshAsync(string refreshToken, CancellationToken cancellationToken)
    {
        Interlocked.Increment(ref RefreshCalls);
        return OnRefresh?.Invoke(refreshToken) ?? Task.FromResult(NextTokens());
    }

    public Task LogoutAsync(string refreshToken, CancellationToken cancellationToken)
    {
        LoggedOut.Add(refreshToken);
        return Task.CompletedTask;
    }

    public Task<TokenResponse> DevLoginAsync(string name, CancellationToken cancellationToken) => Task.FromResult(NextTokens());

    public static ApiException Unauthorized(string code) => new(HttpStatusCode.Unauthorized, code, "Sign in again");
}

/// <summary>Terminal handler: records each request (with its body) and answers from a callback.</summary>
internal sealed class RecordingHandler(Func<HttpRequestMessage, HttpResponseMessage> respond) : HttpMessageHandler
{
    public List<(string? Authorization, string? Body)> Requests { get; } = [];

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var body = request.Content is null ? null : await request.Content.ReadAsStringAsync(cancellationToken);
        Requests.Add((request.Headers.Authorization?.ToString(), body));
        return respond(request);
    }
}

internal sealed class FakeWebAuthenticator(Func<WebAuthenticatorOptions, WebAuthenticatorResult> respond) : IWebAuthenticator
{
    public WebAuthenticatorOptions? LastOptions { get; private set; }

    public Task<WebAuthenticatorResult> AuthenticateAsync(WebAuthenticatorOptions webAuthenticatorOptions) =>
        AuthenticateAsync(webAuthenticatorOptions, CancellationToken.None);

    public Task<WebAuthenticatorResult> AuthenticateAsync(WebAuthenticatorOptions webAuthenticatorOptions, CancellationToken cancellationToken)
    {
        LastOptions = webAuthenticatorOptions;
        return Task.FromResult(respond(webAuthenticatorOptions));
    }

    public static WebAuthenticatorResult Callback(string fragment) =>
        new(new Uri($"chorebacon://auth#{fragment}"));
}

/// <summary>Counts push registrations; records whether the user was still signed in when unregistering.</summary>
internal sealed class FakePushRegistration(InMemoryTokenStore store) : ChoreBacon.Services.Push.IPushRegistration
{
    public int Registrations { get; private set; }
    public List<bool> UnregisteredWhileSignedIn { get; } = [];

    public Task RegisterAsync(CancellationToken cancellationToken) { Registrations++; return Task.CompletedTask; }
    public Task TokenRefreshedAsync(string token) => Task.CompletedTask;
    public Task UnregisterAsync(CancellationToken cancellationToken) { UnregisteredWhileSignedIn.Add(store.Tokens is not null); return Task.CompletedTask; }
}
