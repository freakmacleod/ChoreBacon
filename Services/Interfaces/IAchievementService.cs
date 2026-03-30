using ChoreBacon.Models;

namespace ChoreBacon.Services.Interfaces;

public interface IAchievementService
{
    Task<List<Achievement>> GetAllAchievementsAsync();
    Task<List<UserAchievement>> GetUserAchievementsAsync(int userId);
    Task<List<Achievement>> CheckAndUnlockAchievementsAsync(int userId);
    Task SeedDefaultAchievementsAsync();

}
