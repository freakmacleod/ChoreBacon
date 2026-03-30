using ChoreBacon.Models;
using ChoreBacon.Services.Interfaces;
using SQLite;

namespace ChoreBacon.Services;

public class DatabaseService : IDatabaseService
{
    private SQLiteAsyncConnection? _db;

    private async Task<SQLiteAsyncConnection> GetConnectionAsync()
    {
        if (_db is not null)
            return _db;

        var dbPath = Path.Combine(FileSystem.AppDataDirectory, "chorebacon.db3");
        _db = new SQLiteAsyncConnection(dbPath, SQLiteOpenFlags.ReadWrite | SQLiteOpenFlags.Create | SQLiteOpenFlags.SharedCache);
        await _db.CreateTablesAsync<User, Chore, ChoreCompletion, Achievement, UserAchievement, RewardItem, PointTransaction>();
        return _db;
    }

    public async Task InitializeAsync()
    {
        await GetConnectionAsync();
    }

    // ── Users ─────────────────────────────────────────────────────────────────

    public async Task<User?> GetUserByExternalIdAsync(string externalId, string provider)
    {
        var db = await GetConnectionAsync();
        return await db.Table<User>()
            .Where(u => u.ExternalId == externalId && u.Provider == provider)
            .FirstOrDefaultAsync();
    }

    public async Task<User?> GetUserByIdAsync(int id)
    {
        var db = await GetConnectionAsync();
        return await db.FindAsync<User>(id);
    }

    public async Task<int> SaveUserAsync(User user)
    {
        var db = await GetConnectionAsync();
        return user.Id == 0 ? await db.InsertAsync(user) : await db.UpdateAsync(user);
    }

    // ── Chores ────────────────────────────────────────────────────────────────

    public async Task<List<Chore>> GetActiveChoresAsync()
    {
        var db = await GetConnectionAsync();
        return await db.Table<Chore>().Where(c => c.IsActive).ToListAsync();
    }

    public async Task<int> SaveChoreAsync(Chore chore)
    {
        var db = await GetConnectionAsync();
        return chore.Id == 0 ? await db.InsertAsync(chore) : await db.UpdateAsync(chore);
    }

    public async Task<int> DeleteChoreAsync(Chore chore)
    {
        var db = await GetConnectionAsync();
        return await db.DeleteAsync(chore);
    }

    // ── Completions ───────────────────────────────────────────────────────────

    public async Task<List<ChoreCompletion>> GetCompletionsForUserAsync(int userId)
    {
        var db = await GetConnectionAsync();
        return await db.Table<ChoreCompletion>()
            .Where(c => c.UserId == userId)
            .OrderByDescending(c => c.CompletedAt)
            .ToListAsync();
    }

    public async Task<List<ChoreCompletion>> GetCompletionsForUserTodayAsync(int userId)
    {
        var db = await GetConnectionAsync();
        var todayStart = DateTime.UtcNow.Date;
        var todayEnd = todayStart.AddDays(1);
        return await db.Table<ChoreCompletion>()
            .Where(c => c.UserId == userId && c.CompletedAt >= todayStart && c.CompletedAt < todayEnd)
            .ToListAsync();
    }

    public async Task<int> SaveChoreCompletionAsync(ChoreCompletion completion)
    {
        var db = await GetConnectionAsync();
        return await db.InsertAsync(completion);
    }

    public async Task<int> GetUserStreakAsync(int userId)
    {
        var db = await GetConnectionAsync();
        var completions = await db.Table<ChoreCompletion>()
            .Where(c => c.UserId == userId)
            .OrderByDescending(c => c.CompletedAt)
            .ToListAsync();

        if (completions.Count == 0)
            return 0;

        int streak = 0;
        var checkDate = DateTime.UtcNow.Date;

        while (true)
        {
            var hasCompletion = completions.Any(c => c.CompletedAt.Date == checkDate);
            if (!hasCompletion)
                break;
            streak++;
            checkDate = checkDate.AddDays(-1);
        }

        return streak;
    }

    // ── Achievements ──────────────────────────────────────────────────────────

    public async Task<List<Achievement>> GetAllAchievementsAsync()
    {
        var db = await GetConnectionAsync();
        return await db.Table<Achievement>().ToListAsync();
    }

    public async Task<int> SaveAchievementAsync(Achievement achievement)
    {
        var db = await GetConnectionAsync();
        return achievement.Id == 0 ? await db.InsertAsync(achievement) : await db.UpdateAsync(achievement);
    }

    public async Task<List<UserAchievement>> GetUserAchievementsAsync(int userId)
    {
        var db = await GetConnectionAsync();
        return await db.Table<UserAchievement>()
            .Where(ua => ua.UserId == userId)
            .ToListAsync();
    }

    public async Task<int> SaveUserAchievementAsync(UserAchievement userAchievement)
    {
        var db = await GetConnectionAsync();
        return await db.InsertAsync(userAchievement);
    }

    // ── Rewards ───────────────────────────────────────────────────────────────

    public async Task<List<RewardItem>> GetAvailableRewardsAsync()
    {
        var db = await GetConnectionAsync();
        return await db.Table<RewardItem>().Where(r => r.IsAvailable).ToListAsync();
    }

    public async Task<int> SaveRewardItemAsync(RewardItem reward)
    {
        var db = await GetConnectionAsync();
        return reward.Id == 0 ? await db.InsertAsync(reward) : await db.UpdateAsync(reward);
    }

    // ── Transactions ──────────────────────────────────────────────────────────

    public async Task<List<PointTransaction>> GetTransactionsForUserAsync(int userId)
    {
        var db = await GetConnectionAsync();
        return await db.Table<PointTransaction>()
            .Where(t => t.UserId == userId)
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync();
    }

    public async Task<int> SaveTransactionAsync(PointTransaction transaction)
    {
        var db = await GetConnectionAsync();
        return await db.InsertAsync(transaction);
    }
}
