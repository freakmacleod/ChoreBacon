using System.Net.Http.Json;
using ChoreBacon.Contracts;
using ChoreBacon.Contracts.Auth;

namespace ChoreBacon.Services.Api;

public sealed class ChoreBaconApiClient(HttpClient http) : IChoreBaconApi
{
    public async Task<MeResponse> GetMeAsync(CancellationToken cancellationToken)
    {
        using var response = await http.GetAsync("api/v1/me", cancellationToken);
        await ApiException.EnsureSuccessAsync(response, cancellationToken);
        return (await response.Content.ReadFromJsonAsync(ContractsJsonContext.Default.MeResponse, cancellationToken))!;
    }
}
