using System.Text.Json;
using System.Text.Json.Serialization;
using ChoreBacon.Contracts.Auth;

namespace ChoreBacon.Contracts;

/// <summary>Source-generated System.Text.Json metadata for all API contracts (trim/AOT safe).</summary>
[JsonSourceGenerationOptions(JsonSerializerDefaults.Web)]
[JsonSerializable(typeof(ApiErrorResponse))]
[JsonSerializable(typeof(TokenResponse))]
[JsonSerializable(typeof(RefreshRequest))]
[JsonSerializable(typeof(LogoutRequest))]
[JsonSerializable(typeof(DevLoginRequest))]
[JsonSerializable(typeof(MeResponse))]
public sealed partial class ContractsJsonContext : JsonSerializerContext;
