using ChoreBacon.Models;
using ChoreBacon.Services.Interfaces;

namespace ChoreBacon.App.Tests.Fakes;

/// <summary>Only the user methods AuthService needs; everything else is out of scope for these tests.</summary>
internal sealed class FakeDatabaseService : IDatabaseService
{
    public List<User> Users { get; } = [];

    public Task<User?> GetUserByExternalIdAsync(string externalId, string provider) =>
        Task.FromResult(Users.FirstOrDefault(u => u.ExternalId == externalId && u.Provider == provider));

    public Task<User?> GetUserByIdAsync(int id) => Task.FromResult(Users.FirstOrDefault(u => u.Id == id));

    public Task<int> SaveUserAsync(User user)
    {
        if (user.Id == 0)
        {
            user.Id = Users.Count + 1;
            Users.Add(user);
        }
        return Task.FromResult(1);
    }

    public Task InitializeAsync() => Task.CompletedTask;
    public Task<List<Chore>> GetActiveChoresAsync() => throw new NotSupportedException();
    public Task<int> SaveChoreAsync(Chore chore) => throw new NotSupportedException();
    public Task<int> DeleteChoreAsync(Chore chore) => throw new NotSupportedException();
    public Task<List<ChoreCompletion>> GetCompletionsForUserAsync(int userId) => throw new NotSupportedException();
    public Task<List<ChoreCompletion>> GetCompletionsForUserTodayAsync(int userId) => throw new NotSupportedException();
    public Task<int> SaveChoreCompletionAsync(ChoreCompletion completion) => throw new NotSupportedException();
    public Task<int> GetUserStreakAsync(int userId) => throw new NotSupportedException();
    public Task<List<Achievement>> GetAllAchievementsAsync() => throw new NotSupportedException();
    public Task<int> SaveAchievementAsync(Achievement achievement) => throw new NotSupportedException();
    public Task<List<UserAchievement>> GetUserAchievementsAsync(int userId) => throw new NotSupportedException();
    public Task<int> SaveUserAchievementAsync(UserAchievement userAchievement) => throw new NotSupportedException();
    public Task<List<RewardItem>> GetAvailableRewardsAsync() => throw new NotSupportedException();
    public Task<int> SaveRewardItemAsync(RewardItem reward) => throw new NotSupportedException();
    public Task<List<PointTransaction>> GetTransactionsForUserAsync(int userId) => throw new NotSupportedException();
    public Task<int> SaveTransactionAsync(PointTransaction transaction) => throw new NotSupportedException();
}
