using ChoreBacon.Models;

namespace ChoreBacon.Services.Interfaces;

public interface IDatabaseService
{
    Task InitializeAsync();

    // Users
    Task<User?> GetUserByExternalIdAsync(string externalId, string provider);
    Task<User?> GetUserByIdAsync(int id);
    Task<int> SaveUserAsync(User user);

    // Chores
    Task<List<Chore>> GetActiveChoresAsync();
    Task<int> SaveChoreAsync(Chore chore);
    Task<int> DeleteChoreAsync(Chore chore);

    // Chore Completions
    Task<List<ChoreCompletion>> GetCompletionsForUserAsync(int userId);
    Task<List<ChoreCompletion>> GetCompletionsForUserTodayAsync(int userId);
    Task<int> SaveChoreCompletionAsync(ChoreCompletion completion);
    Task<int> GetUserStreakAsync(int userId);

    // Achievements
    Task<List<Achievement>> GetAllAchievementsAsync();
    Task<int> SaveAchievementAsync(Achievement achievement);
    Task<List<UserAchievement>> GetUserAchievementsAsync(int userId);
    Task<int> SaveUserAchievementAsync(UserAchievement userAchievement);

    // Rewards
    Task<List<RewardItem>> GetAvailableRewardsAsync();
    Task<int> SaveRewardItemAsync(RewardItem reward);

    // Point Transactions
    Task<List<PointTransaction>> GetTransactionsForUserAsync(int userId);
    Task<int> SaveTransactionAsync(PointTransaction transaction);
}
