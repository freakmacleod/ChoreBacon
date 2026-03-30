using ChoreBacon.Models;
using ChoreBacon.Services.Interfaces;

namespace ChoreBacon.Services;

public class AchievementService : IAchievementService
{
    private readonly IDatabaseService _db;

    public AchievementService(IDatabaseService db)
    {
        _db = db;
    }

    public Task<List<Achievement>> GetAllAchievementsAsync() => _db.GetAllAchievementsAsync();

    public Task<List<UserAchievement>> GetUserAchievementsAsync(int userId) =>
        _db.GetUserAchievementsAsync(userId);

    public async Task<List<Achievement>> CheckAndUnlockAchievementsAsync(int userId)
    {
        var allAchievements = await _db.GetAllAchievementsAsync();
        var userAchievements = await _db.GetUserAchievementsAsync(userId);
        var unlockedIds = userAchievements.Select(ua => ua.AchievementId).ToHashSet();
        var user = await _db.GetUserByIdAsync(userId);
        if (user is null) return [];

        var completions = await _db.GetCompletionsForUserAsync(userId);
        var streak = await _db.GetUserStreakAsync(userId);
        var newlyUnlocked = new List<Achievement>();

        foreach (var achievement in allAchievements.Where(a => !unlockedIds.Contains(a.Id)))
        {
            bool unlocked = achievement.Type switch
            {
                AchievementType.ChoresCompleted => completions.Count >= achievement.RequiredCount,
                AchievementType.PointsEarned    => user.TotalPoints >= achievement.RequiredCount,
                AchievementType.StreakDays       => streak >= achievement.RequiredCount,
                AchievementType.PointsSpent     => await GetTotalPointsSpentAsync(userId) >= achievement.RequiredCount,
                _                               => false
            };

            if (!unlocked) continue;

            await _db.SaveUserAchievementAsync(new UserAchievement
            {
                UserId = userId,
                AchievementId = achievement.Id
            });

            if (achievement.BonusPoints > 0)
            {
                user.TotalPoints += achievement.BonusPoints;
                await _db.SaveUserAsync(user);
                await _db.SaveTransactionAsync(new PointTransaction
                {
                    UserId = userId,
                    Amount = achievement.BonusPoints,
                    Type = TransactionType.AchievementBonus,
                    Description = $"Achievement unlocked: {achievement.Name}",
                    ReferenceId = achievement.Id
                });
            }

            newlyUnlocked.Add(achievement);
        }

        return newlyUnlocked;
    }

    private async Task<int> GetTotalPointsSpentAsync(int userId)
    {
        var transactions = await _db.GetTransactionsForUserAsync(userId);
        return transactions
            .Where(t => t.Type == TransactionType.RewardRedeemed)
            .Sum(t => Math.Abs(t.Amount));
    }

    public async Task SeedDefaultAchievementsAsync()
    {
        var existing = await _db.GetAllAchievementsAsync();
        if (existing.Count > 0)
            return;

        var defaults = new List<Achievement>
        {
            new() { Name = "First Step",       Description = "Complete your first chore",          Type = AchievementType.ChoresCompleted, RequiredCount = 1,    BonusPoints = 5,   Rarity = AchievementRarity.Common,    IconName = "ach_first"    },
            new() { Name = "Getting Started",  Description = "Complete 10 chores",                 Type = AchievementType.ChoresCompleted, RequiredCount = 10,   BonusPoints = 10,  Rarity = AchievementRarity.Common,    IconName = "ach_10"       },
            new() { Name = "Chore Champion",   Description = "Complete 50 chores",                 Type = AchievementType.ChoresCompleted, RequiredCount = 50,   BonusPoints = 25,  Rarity = AchievementRarity.Uncommon,  IconName = "ach_50"       },
            new() { Name = "Legend",           Description = "Complete 100 chores",                Type = AchievementType.ChoresCompleted, RequiredCount = 100,  BonusPoints = 50,  Rarity = AchievementRarity.Rare,      IconName = "ach_100"      },
            new() { Name = "Point Collector",  Description = "Earn 100 points",                    Type = AchievementType.PointsEarned,    RequiredCount = 100,  BonusPoints = 10,  Rarity = AchievementRarity.Common,    IconName = "ach_pts100"   },
            new() { Name = "High Roller",      Description = "Earn 500 points",                    Type = AchievementType.PointsEarned,    RequiredCount = 500,  BonusPoints = 50,  Rarity = AchievementRarity.Uncommon,  IconName = "ach_pts500"   },
            new() { Name = "On a Roll",        Description = "Maintain a 3-day streak",            Type = AchievementType.StreakDays,       RequiredCount = 3,    BonusPoints = 15,  Rarity = AchievementRarity.Common,    IconName = "ach_streak3"  },
            new() { Name = "Unstoppable",      Description = "Maintain a 7-day streak",            Type = AchievementType.StreakDays,       RequiredCount = 7,    BonusPoints = 30,  Rarity = AchievementRarity.Uncommon,  IconName = "ach_streak7"  },
            new() { Name = "Iron Will",        Description = "Maintain a 30-day streak",           Type = AchievementType.StreakDays,       RequiredCount = 30,   BonusPoints = 100, Rarity = AchievementRarity.Legendary, IconName = "ach_streak30" },
            new() { Name = "Big Spender",      Description = "Spend 100 points in the store",      Type = AchievementType.PointsSpent,     RequiredCount = 100,  BonusPoints = 0,   Rarity = AchievementRarity.Common,    IconName = "ach_spend"    },
        };

        foreach (var achievement in defaults)
            await _db.SaveAchievementAsync(achievement);
    }
}
