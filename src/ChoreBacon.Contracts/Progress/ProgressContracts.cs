using System.Text.Json.Serialization;

namespace ChoreBacon.Contracts.Progress;

// Mirrors web/lib/progress/service.ts. The API is the source of truth for every number here.

[JsonConverter(typeof(JsonStringEnumConverter<ChoreFrequency>))]
public enum ChoreFrequency
{
    [JsonStringEnumMemberName("daily")] Daily,
    [JsonStringEnumMemberName("weekly")] Weekly,
    [JsonStringEnumMemberName("monthly")] Monthly,
    [JsonStringEnumMemberName("once")] Once,
}

[JsonConverter(typeof(JsonStringEnumConverter<CompletionStatus>))]
public enum CompletionStatus
{
    [JsonStringEnumMemberName("pending")] Pending,
    [JsonStringEnumMemberName("approved")] Approved,
    [JsonStringEnumMemberName("rejected")] Rejected,
}

[JsonConverter(typeof(JsonStringEnumConverter<RedemptionStatus>))]
public enum RedemptionStatus
{
    [JsonStringEnumMemberName("pending")] Pending,
    [JsonStringEnumMemberName("fulfilled")] Fulfilled,
    [JsonStringEnumMemberName("cancelled")] Cancelled,
}

[JsonConverter(typeof(JsonStringEnumConverter<AchievementRule>))]
public enum AchievementRule
{
    [JsonStringEnumMemberName("chores_completed")] ChoresCompleted,
    [JsonStringEnumMemberName("lifetime_points_earned")] LifetimePointsEarned,
    [JsonStringEnumMemberName("streak_days")] StreakDays,
    [JsonStringEnumMemberName("points_spent")] PointsSpent,
}

[JsonConverter(typeof(JsonStringEnumConverter<AchievementRarity>))]
public enum AchievementRarity
{
    [JsonStringEnumMemberName("common")] Common,
    [JsonStringEnumMemberName("uncommon")] Uncommon,
    [JsonStringEnumMemberName("rare")] Rare,
    [JsonStringEnumMemberName("epic")] Epic,
    [JsonStringEnumMemberName("legendary")] Legendary,
}

[JsonConverter(typeof(JsonStringEnumConverter<ComboPeriod>))]
public enum ComboPeriod
{
    [JsonStringEnumMemberName("day")] Day,
    [JsonStringEnumMemberName("week")] Week,
}

/// <param name="CompletedThisPeriod">Done in the current Stockholm window (today, this ISO week, this month, or ever).</param>
/// <param name="IsFamilyItem">The family's own chore (false for the global catalog).</param>
/// <param name="ExpiresAt">Set for a temporary chore: it disappears then if nobody has done it, and the first one in the family to do it takes it.</param>
public sealed record ChoreDto(
    Guid Id,
    string Title,
    string Description,
    string Icon,
    int Points,
    ChoreFrequency Frequency,
    bool CompletedThisPeriod,
    CompletionStatus? CompletionStatus,
    bool IsFamilyItem = false,
    DateTimeOffset? ExpiresAt = null);

public sealed record CompletionDto(Guid Id, Guid ChoreId, string LocalDate, string PeriodKey, CompletionStatus Status, DateTimeOffset CompletedAt);

/// <param name="PointsPending">Points waiting for a parent's approval (then PointsEarned is 0).</param>
/// <param name="ComboBonuses">Combos this completion finished (none while it waits for approval).</param>
public sealed record CompleteChoreResponse(
    CompletionDto Completion,
    int PointsEarned,
    int PointsPending,
    int Balance,
    IReadOnlyList<AchievementDto> UnlockedAchievements,
    IReadOnlyList<ComboBonusDto>? ComboBonuses = null);

/// <summary>A combo bonus that was just paid.</summary>
public sealed record ComboBonusDto(Guid ComboId, string Title, string Icon, int BonusPoints);

/// <param name="Done">Done in the combo's current day or week (approved, or waiting for approval).</param>
/// <param name="Pending">Done but still waiting for a parent's approval.</param>
public sealed record ComboChoreDto(Guid ChoreId, string Title, string Icon, bool Done, bool Pending);

/// <summary>All of <paramref name="Chores"/> done within the same Stockholm day or ISO week pays <paramref name="BonusPoints"/> once.</summary>
/// <param name="AwardedThisPeriod">The bonus was already paid for the current day or week.</param>
public sealed record ComboDto(
    Guid Id,
    string Title,
    string Description,
    string Icon,
    int BonusPoints,
    ComboPeriod Period,
    IReadOnlyList<ComboChoreDto> Chores,
    bool AwardedThisPeriod,
    bool IsFamilyItem = false);

/// <param name="Stock">Null = unlimited, 0 = sold out.</param>
/// <param name="IsFamilyItem">The family's own reward (false for the global catalog).</param>
public sealed record RewardDto(Guid Id, string Title, string Description, string Icon, int Cost, int? Stock, bool IsFamilyItem = false);

public sealed record RedemptionDto(Guid Id, Guid RewardId, int Cost, RedemptionStatus Status, DateTimeOffset CreatedAt);

public sealed record RedeemRewardResponse(
    RedemptionDto Redemption,
    int Balance,
    IReadOnlyList<AchievementDto> UnlockedAchievements);

/// <param name="UnlockedAt">Null while locked.</param>
public sealed record AchievementDto(
    Guid Id,
    string Code,
    string Title,
    string Description,
    string Icon,
    AchievementRule RuleType,
    int Threshold,
    int BonusPoints,
    AchievementRarity Rarity,
    DateTimeOffset? UnlockedAt,
    bool IsFamilyItem = false);

/// <param name="LifetimeEarned">All points ever earned; spending never lowers it.</param>
public sealed record ProgressResponse(
    int Balance,
    int LifetimeEarned,
    int PointsSpent,
    int ChoresCompleted,
    int StreakDays,
    int ChoresDoneThisPeriod,
    int ChoresTotal,
    IReadOnlyList<AchievementDto> RecentAchievements,
    string? FamilyName = null);

/// <summary>Stable error codes returned by the chore and reward endpoints.</summary>
public static class ProgressErrorCodes
{
    public const string ChoreNotFound = "chore_not_found";
    public const string AlreadyCompletedToday = "chore_already_completed_today";
    public const string AlreadyCompletedThisWeek = "chore_already_completed_this_week";
    public const string AlreadyCompletedThisMonth = "chore_already_completed_this_month";
    public const string AlreadyCompleted = "chore_already_completed";
    public const string ChoreExpired = "chore_expired";
    public const string ChoreTaken = "chore_taken";
    public const string RewardNotFound = "reward_not_found";
    public const string RewardOutOfStock = "reward_out_of_stock";
    public const string InsufficientPoints = "insufficient_points";
}
