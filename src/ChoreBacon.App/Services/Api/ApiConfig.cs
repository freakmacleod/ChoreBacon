using System.Reflection;

namespace ChoreBacon.Services.Api;

/// <summary>
/// Where the API lives. The base URL is baked in at build time from the <c>ChoreBaconApiBaseUrl</c>
/// MSBuild property (Debug → local dev server, Release → production); override with
/// <c>dotnet build -p:ChoreBaconApiBaseUrl=https://…/</c>.
/// </summary>
public sealed class ApiConfig
{
    /// <summary>Registered as an Android intent filter and an iOS URL type.</summary>
    public const string CallbackUrl = "chorebacon://auth";

    public ApiConfig(Uri baseAddress)
    {
        // HttpClient only combines relative paths correctly when the base ends with '/'.
        BaseAddress = baseAddress.AbsoluteUri.EndsWith('/') ? baseAddress : new Uri(baseAddress.AbsoluteUri + "/");
    }

    public Uri BaseAddress { get; }

    public Uri AuthStartUri(string provider) => new(BaseAddress, $"api/v1/auth/{provider}/start");

    public static ApiConfig FromAssemblyMetadata()
    {
        var value = typeof(ApiConfig).Assembly
            .GetCustomAttributes<AssemblyMetadataAttribute>()
            .FirstOrDefault(a => a.Key == "ApiBaseUrl")?.Value;

        return string.IsNullOrWhiteSpace(value)
            ? throw new InvalidOperationException("ApiBaseUrl assembly metadata is missing; set ChoreBaconApiBaseUrl.")
            : new ApiConfig(new Uri(value));
    }
}
