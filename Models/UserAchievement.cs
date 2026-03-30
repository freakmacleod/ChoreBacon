using SQLite;

namespace ChoreBacon.Models;

[Table("UserAchievements")]
public class UserAchievement
{
    [PrimaryKey, AutoIncrement]
    public int Id { get; set; }

    [Indexed]
    public int UserId { get; set; }

    [Indexed]
    public int AchievementId { get; set; }

    public DateTime UnlockedAt { get; set; } = DateTime.UtcNow;

    public bool IsNew { get; set; } = true;
}
