using System.Net;
using System.Net.Http.Json;
using ChoreBacon.Contracts;

namespace ChoreBacon.Services.Api;

/// <summary>A non-success API response, carrying the API's stable error code.</summary>
public sealed class ApiException(HttpStatusCode statusCode, string code, string message)
    : Exception($"{(int)statusCode} {code}: {message}")
{
    public HttpStatusCode StatusCode { get; } = statusCode;
    public string Code { get; } = code;

    public static async Task EnsureSuccessAsync(HttpResponseMessage response, CancellationToken cancellationToken)
    {
        if (response.IsSuccessStatusCode)
            return;

        ApiError? error = null;
        try
        {
            error = (await response.Content.ReadFromJsonAsync(ContractsJsonContext.Default.ApiErrorResponse, cancellationToken))?.Error;
        }
        catch (Exception ex) when (ex is System.Text.Json.JsonException or NotSupportedException)
        {
            // Not our error format (e.g. a proxy or platform error page); fall back to the status code.
        }

        throw new ApiException(response.StatusCode, error?.Code ?? "http_" + (int)response.StatusCode, error?.Message ?? response.ReasonPhrase ?? "");
    }
}
