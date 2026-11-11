using System.Text.Json.Serialization;
using ChoreBacon.Contracts.Progress;

namespace ChoreBacon.Contracts.Family;

// Mirrors web/lib/family/service.ts and the /api/v1/families and /api/v1/me/family endpoints.

[JsonConverter(typeof(JsonStringEnumConverter<FamilyRole>))]
public enum FamilyRole
{
    [JsonStringEnumMemberName("parent")] Parent,
    [JsonStringEnumMemberName("child")] Child,
}

public sealed record FamilyMemberDto(Guid UserId, string DisplayName, FamilyRole Role, int Balance);

/// <param name="InviteCode">Shown as XXXX-XXXX; only returned to parents.</param>
/// <param name="Role">The caller's role in the family.</param>
public sealed record FamilyDto(
    Guid Id,
    string Name,
    bool RequiresApproval,
    string? InviteCode,
    FamilyRole Role,
    IReadOnlyList<FamilyMemberDto> Members);

public sealed record CreateFamilyRequest(string Name);

public sealed record JoinFamilyRequest(string Code);

/// <summary>Only the properties that are set are sent (the API treats a missing property as "unchanged").</summary>
public sealed record UpdateFamilyRequest(
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Name = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] bool? RequiresApproval = null);

public sealed record MemberRoleRequest(FamilyRole Role);

public sealed record InviteCodeResponse(string InviteCode);

public sealed record PendingCompletionDto(
    Guid Id,
    Guid UserId,
    string DisplayName,
    Guid ChoreId,
    string ChoreTitle,
    int Points,
    string LocalDate,
    DateTimeOffset CompletedAt);

public sealed record ReviewCompletionResponse(CompletionStatus Status, IReadOnlyList<AchievementDto> UnlockedAchievements);

public sealed record PendingRedemptionDto(
    Guid Id,
    Guid UserId,
    string DisplayName,
    Guid RewardId,
    string RewardTitle,
    int Cost,
    DateTimeOffset CreatedAt);

/// <param name="IsFamilyChore">False for global chores, which the family can only switch off or re-price.</param>
public sealed record FamilyChoreDto(
    Guid Id,
    string Title,
    string Description,
    string Icon,
    int Points,
    ChoreFrequency Frequency,
    bool IsFamilyChore,
    bool IsActive,
    int? PointsOverride);

/// <param name="Stock">The family's stock; null = unlimited.</param>
public sealed record FamilyRewardDto(
    Guid Id,
    string Title,
    string Description,
    string Icon,
    int Cost,
    bool IsFamilyReward,
    bool IsActive,
    int? CostOverride,
    int? Stock);

/// <param name="PointsOverride">Null = the catalog's points.</param>
public sealed record ChoreSettingsRequest(bool IsActive, int? PointsOverride);

/// <param name="Stock">Null = unlimited. Setting it is an explicit restock.</param>
public sealed record RewardSettingsRequest(bool IsActive, int? CostOverride, int? Stock);

public sealed record FamilyChoreRequest(string Title, string Description, string Icon, int Points, ChoreFrequency Frequency, bool IsActive);

public sealed record FamilyRewardRequest(string Title, string Description, string Icon, int Cost, int? Stock, bool IsActive);

public sealed record IdResponse(Guid Id);

/// <summary>Stable error codes returned by the family endpoints.</summary>
public static class FamilyErrorCodes
{
    public const string NoFamily = "no_family";
    public const string AlreadyInFamily = "already_in_family";
    public const string InvalidInviteCode = "invalid_invite_code";
    public const string NotParent = "not_parent";
    public const string LastParent = "last_parent";
    public const string MemberNotFound = "member_not_found";
    public const string NotPending = "not_pending";
    public const string CompletionNotFound = "completion_not_found";
    public const string RedemptionNotFound = "redemption_not_found";
}
