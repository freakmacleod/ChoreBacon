using System.Text.Json;
using System.Text.Json.Serialization;
using ChoreBacon.Contracts.Auth;
using ChoreBacon.Contracts.Progress;

namespace ChoreBacon.Contracts;

/// <summary>Source-generated System.Text.Json metadata for all API contracts (trim/AOT safe).</summary>
[JsonSourceGenerationOptions(JsonSerializerDefaults.Web)]
[JsonSerializable(typeof(ApiErrorResponse))]
[JsonSerializable(typeof(TokenResponse))]
[JsonSerializable(typeof(RefreshRequest))]
[JsonSerializable(typeof(LogoutRequest))]
[JsonSerializable(typeof(DevLoginRequest))]
[JsonSerializable(typeof(MeResponse))]
[JsonSerializable(typeof(List<ChoreDto>))]
[JsonSerializable(typeof(CompleteChoreResponse))]
[JsonSerializable(typeof(List<RewardDto>))]
[JsonSerializable(typeof(RedeemRewardResponse))]
[JsonSerializable(typeof(List<AchievementDto>))]
[JsonSerializable(typeof(ProgressResponse))]
public sealed partial class ContractsJsonContext : JsonSerializerContext;
