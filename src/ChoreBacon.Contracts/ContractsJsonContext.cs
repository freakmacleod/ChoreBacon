using System.Text.Json;
using System.Text.Json.Serialization;
using ChoreBacon.Contracts.Auth;
using ChoreBacon.Contracts.Family;
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
[JsonSerializable(typeof(FamilyDto))]
[JsonSerializable(typeof(CreateFamilyRequest))]
[JsonSerializable(typeof(JoinFamilyRequest))]
[JsonSerializable(typeof(UpdateFamilyRequest))]
[JsonSerializable(typeof(MemberRoleRequest))]
[JsonSerializable(typeof(InviteCodeResponse))]
[JsonSerializable(typeof(List<PendingCompletionDto>))]
[JsonSerializable(typeof(ReviewCompletionResponse))]
[JsonSerializable(typeof(List<PendingRedemptionDto>))]
[JsonSerializable(typeof(List<FamilyChoreDto>))]
[JsonSerializable(typeof(List<FamilyRewardDto>))]
[JsonSerializable(typeof(ChoreSettingsRequest))]
[JsonSerializable(typeof(RewardSettingsRequest))]
[JsonSerializable(typeof(FamilyChoreRequest))]
[JsonSerializable(typeof(FamilyRewardRequest))]
[JsonSerializable(typeof(IdResponse))]
public sealed partial class ContractsJsonContext : JsonSerializerContext;
