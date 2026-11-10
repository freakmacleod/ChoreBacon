using SQLite;

namespace ChoreBacon.Models;

[Table("RewardItems")]
public class RewardItem
{
    [PrimaryKey, AutoIncrement]
    public int Id { get; set; }

    [NotNull]
    public string Name { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public string IconName { get; set; } = "reward_default";

    public int PointCost { get; set; } = 50;

    public int StockQuantity { get; set; } = -1; // -1 = unlimited

    public bool IsAvailable { get; set; } = true;

    public RewardCategory Category { get; set; } = RewardCategory.Treat;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public enum RewardCategory
{
    Treat,
    Activity,
    Privilege,
    Digital,
    Other
}
