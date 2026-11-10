using System.Net;
using System.Net.Http.Headers;

namespace ChoreBacon.Services.Auth;

/// <summary>Attaches the bearer token and, on a 401, refreshes once and retries the request.</summary>
public sealed class AuthenticatedHttpHandler(TokenManager tokens) : DelegatingHandler
{
    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var accessToken = await tokens.GetAccessTokenAsync(cancellationToken);
        if (accessToken is null)
            return await base.SendAsync(request, cancellationToken);

        // A request message can only be sent once, so buffer the body to be able to replay it.
        if (request.Content is not null)
            await request.Content.LoadIntoBufferAsync(cancellationToken);

        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        var response = await base.SendAsync(request, cancellationToken);
        if (response.StatusCode != HttpStatusCode.Unauthorized)
            return response;

        var refreshed = await tokens.RefreshAsync(accessToken, cancellationToken);
        if (refreshed is null)
            return response;

        response.Dispose();
        var retry = await CloneAsync(request, cancellationToken);
        retry.Headers.Authorization = new AuthenticationHeaderValue("Bearer", refreshed);
        return await base.SendAsync(retry, cancellationToken);
    }

    private static async Task<HttpRequestMessage> CloneAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var clone = new HttpRequestMessage(request.Method, request.RequestUri) { Version = request.Version };
        foreach (var header in request.Headers)
            clone.Headers.TryAddWithoutValidation(header.Key, header.Value);

        if (request.Content is not null)
        {
            clone.Content = new ByteArrayContent(await request.Content.ReadAsByteArrayAsync(cancellationToken));
            foreach (var header in request.Content.Headers)
                clone.Content.Headers.TryAddWithoutValidation(header.Key, header.Value);
        }
        return clone;
    }
}
