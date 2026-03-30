using SQLite;

namespace ChoreBacon.Models;

[Table("Achievements")]
public class Achievement
{
    [PrimaryKey, AutoIncrement]
    public int Id { get; set; }

    [NotNull]
    public string Name { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public string IconName { get; set; } = "achievement_default";

    public AchievementType Type { get; set; } = AchievementType.ChoresCompleted;

    public int RequiredCount { get; set; } = 1;

    public int BonusPoints { get; set; } = 0;

    public AchievementRarity Rarity { get; set; } = AchievementRarity.Common;
}

public enum AchievementType
{
    ChoresCompleted,
    PointsEarned,
    StreakDays,
    SpecificChore,
    PointsSpent
}

public enum AchievementRarity
{
    Common,
    Uncommon,
    Rare,
    Epic,
    Legendary
}
