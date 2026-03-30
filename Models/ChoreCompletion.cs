using SQLite;

namespace ChoreBacon.Models;

[Table("ChoreCompletions")]
public class ChoreCompletion
{
    [PrimaryKey, AutoIncrement]
    public int Id { get; set; }

    [Indexed]
    public int ChoreId { get; set; }

    [Indexed]
    public int UserId { get; set; }

    public int PointsEarned { get; set; }

    public DateTime CompletedAt { get; set; } = DateTime.UtcNow;

    public string Notes { get; set; } = string.Empty;
}
