using ChoreBacon.Models;

namespace ChoreBacon.Services.Interfaces;

public interface IStoreService
{
    Task<List<RewardItem>> GetRewardsAsync();
    Task<bool> RedeemRewardAsync(int rewardId, int userId);
    Task<RewardItem> CreateRewardAsync(RewardItem reward);
    Task DeleteRewardAsync(int rewardId);
    Task SeedDefaultRewardsAsync();
}
