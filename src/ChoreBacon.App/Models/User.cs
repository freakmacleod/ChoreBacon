using SQLite;

namespace ChoreBacon.Models;

[Table("Users")]
public class User
{
    [PrimaryKey, AutoIncrement]
    public int Id { get; set; }

    [Unique, NotNull]
    public string ExternalId { get; set; } = string.Empty; // Google/Facebook sub/id

    public string Provider { get; set; } = string.Empty; // "google" | "facebook"

    public string DisplayName { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public string ProfilePictureUrl { get; set; } = string.Empty;

    public int TotalPoints { get; set; } = 0;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime LastLoginAt { get; set; } = DateTime.UtcNow;
}
