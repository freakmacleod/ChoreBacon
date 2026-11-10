using SQLite;

namespace ChoreBacon.Models;

[Table("Chores")]
public class Chore
{
    [PrimaryKey, AutoIncrement]
    public int Id { get; set; }

    [NotNull]
    public string Name { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public string IconName { get; set; } = "chore_default";

    public int PointValue { get; set; } = 10;

    public ChoreFrequency Frequency { get; set; } = ChoreFrequency.Daily;

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public enum ChoreFrequency
{
    OneTime,
    Daily,
    Weekly,
    Monthly
}
