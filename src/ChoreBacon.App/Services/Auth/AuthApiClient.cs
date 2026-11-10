using System.Net.Http.Json;
using ChoreBacon.Contracts;
using ChoreBacon.Contracts.Auth;
using ChoreBacon.Services.Api;

namespace ChoreBacon.Services.Auth;

public sealed class AuthApiClient(HttpClient http) : IAuthApi
{
    public Task<TokenResponse> RefreshAsync(string refreshToken, CancellationToken cancellationToken) =>
        PostForTokensAsync("api/v1/auth/refresh",
            JsonContent.Create(new RefreshRequest(refreshToken), ContractsJsonContext.Default.RefreshRequest), cancellationToken);

    public Task<TokenResponse> DevLoginAsync(string name, CancellationToken cancellationToken) =>
        PostForTokensAsync("api/v1/auth/dev",
            JsonContent.Create(new DevLoginRequest(name), ContractsJsonContext.Default.DevLoginRequest), cancellationToken);

    public async Task LogoutAsync(string refreshToken, CancellationToken cancellationToken)
    {
        using var response = await http.PostAsync("api/v1/auth/logout",
            JsonContent.Create(new LogoutRequest(refreshToken), ContractsJsonContext.Default.LogoutRequest), cancellationToken);
        await ApiException.EnsureSuccessAsync(response, cancellationToken);
    }

    private async Task<TokenResponse> PostForTokensAsync(string path, HttpContent content, CancellationToken cancellationToken)
    {
        using var response = await http.PostAsync(path, content, cancellationToken);
        await ApiException.EnsureSuccessAsync(response, cancellationToken);
        return (await response.Content.ReadFromJsonAsync(ContractsJsonContext.Default.TokenResponse, cancellationToken))!;
    }
}
