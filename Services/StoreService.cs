using ChoreBacon.Models;
using ChoreBacon.Services.Interfaces;

namespace ChoreBacon.Services;

public class StoreService : IStoreService
{
    private readonly IDatabaseService _db;

    public StoreService(IDatabaseService db)
    {
        _db = db;
    }

    public Task<List<RewardItem>> GetRewardsAsync() => _db.GetAvailableRewardsAsync();

    public async Task<bool> RedeemRewardAsync(int rewardId, int userId)
    {
        var rewards = await _db.GetAvailableRewardsAsync();
        var reward = rewards.FirstOrDefault(r => r.Id == rewardId);
        if (reward is null) return false;

        var user = await _db.GetUserByIdAsync(userId);
        if (user is null || user.TotalPoints < reward.PointCost)
            return false;

        user.TotalPoints -= reward.PointCost;
        await _db.SaveUserAsync(user);

        if (reward.StockQuantity > 0)
        {
            reward.StockQuantity--;
            if (reward.StockQuantity == 0)
                reward.IsAvailable = false;
            await _db.SaveRewardItemAsync(reward);
        }

        await _db.SaveTransactionAsync(new PointTransaction
        {
            UserId = userId,
            Amount = -reward.PointCost,
            Type = TransactionType.RewardRedeemed,
            Description = $"Redeemed: {reward.Name}",
            ReferenceId = rewardId
        });

        return true;
    }

    public async Task<RewardItem> CreateRewardAsync(RewardItem reward)
    {
        await _db.SaveRewardItemAsync(reward);
        return reward;
    }

    public async Task DeleteRewardAsync(int rewardId)
    {
        var rewards = await _db.GetAvailableRewardsAsync();
        var reward = rewards.FirstOrDefault(r => r.Id == rewardId);
        if (reward is null) return;
        reward.IsAvailable = false;
        await _db.SaveRewardItemAsync(reward);
    }

    public async Task SeedDefaultRewardsAsync()
    {
        var existing = await _db.GetAvailableRewardsAsync();
        if (existing.Count > 0)
            return;

        var defaults = new List<RewardItem>
        {
            new() { Name = "Extra Screen Time",    Description = "30 minutes of extra screen time",  PointCost = 50,  Category = RewardCategory.Privilege, IconName = "reward_screen"  },
            new() { Name = "Choose Dinner",        Description = "Pick what's for dinner tonight",   PointCost = 75,  Category = RewardCategory.Privilege, IconName = "reward_dinner"  },
            new() { Name = "Ice Cream Trip",       Description = "Trip to get ice cream",            PointCost = 100, Category = RewardCategory.Treat,     IconName = "reward_icecream"},
            new() { Name = "Movie Night",          Description = "Pick a movie for family night",    PointCost = 150, Category = RewardCategory.Activity,  IconName = "reward_movie"   },
            new() { Name = "Skip One Chore",       Description = "Skip any one chore (one-time)",    PointCost = 80,  Category = RewardCategory.Privilege, IconName = "reward_skip", StockQuantity = 1 },
            new() { Name = "Video Game Hour",      Description = "An extra hour of video games",     PointCost = 60,  Category = RewardCategory.Digital,   IconName = "reward_game"    },
            new() { Name = "Stay Up Late",         Description = "30-minute bedtime extension",      PointCost = 120, Category = RewardCategory.Privilege, IconName = "reward_late"    },
            new() { Name = "Pizza Night",          Description = "Order pizza for dinner",           PointCost = 200, Category = RewardCategory.Treat,     IconName = "reward_pizza"   },
        };

        foreach (var reward in defaults)
            await _db.SaveRewardItemAsync(reward);
    }
}
