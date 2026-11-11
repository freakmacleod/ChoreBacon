using System.Net.Http.Json;
using System.Text.Json.Serialization.Metadata;

namespace ChoreBacon.Services.Api;

/// <summary>Shared request plumbing for the typed API clients: JSON via source-generated metadata, errors as <see cref="ApiException"/>.</summary>
public abstract class ApiClientBase(HttpClient http)
{
    protected async Task<T> GetAsync<T>(string path, JsonTypeInfo<T> type, CancellationToken cancellationToken)
    {
        using var response = await http.GetAsync(path, cancellationToken);
        return await ReadAsync(response, type, cancellationToken);
    }

    /// <summary>Sends a request with an optional JSON body and reads a JSON response.</summary>
    protected async Task<TResponse> SendAsync<TRequest, TResponse>(
        HttpMethod method, string path, TRequest? body, JsonTypeInfo<TRequest> requestType, JsonTypeInfo<TResponse> responseType,
        CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(method, path) { Content = body is null ? null : JsonContent.Create(body, requestType) };
        using var response = await http.SendAsync(request, cancellationToken);
        return await ReadAsync(response, responseType, cancellationToken);
    }

    /// <summary>POST without a body, reading a JSON response.</summary>
    protected async Task<T> PostAsync<T>(string path, JsonTypeInfo<T> type, CancellationToken cancellationToken)
    {
        using var response = await http.PostAsync(path, content: null, cancellationToken);
        return await ReadAsync(response, type, cancellationToken);
    }

    /// <summary>A request whose success response has no body we need (204 or an ignored body).</summary>
    protected async Task SendAsync(HttpMethod method, string path, HttpContent? content, CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(method, path) { Content = content };
        using var response = await http.SendAsync(request, cancellationToken);
        await ApiException.EnsureSuccessAsync(response, cancellationToken);
    }

    private static async Task<T> ReadAsync<T>(HttpResponseMessage response, JsonTypeInfo<T> type, CancellationToken cancellationToken)
    {
        await ApiException.EnsureSuccessAsync(response, cancellationToken);
        return (await response.Content.ReadFromJsonAsync(type, cancellationToken))!;
    }
}
