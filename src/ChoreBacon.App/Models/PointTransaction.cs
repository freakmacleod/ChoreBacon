using SQLite;

namespace ChoreBacon.Models;

[Table("PointTransactions")]
public class PointTransaction
{
    [PrimaryKey, AutoIncrement]
    public int Id { get; set; }

    [Indexed]
    public int UserId { get; set; }

    public int Amount { get; set; } // positive = earned, negative = spent

    public TransactionType Type { get; set; }

    public string Description { get; set; } = string.Empty;

    public int? ReferenceId { get; set; } // ChoreId, RewardItemId, AchievementId

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public enum TransactionType
{
    ChoreCompleted,
    RewardRedeemed,
    AchievementBonus,
    AdminAdjustment
}
