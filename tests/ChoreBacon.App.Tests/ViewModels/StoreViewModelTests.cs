using System.Net;
using ChoreBacon.App.Tests.Fakes;
using ChoreBacon.Contracts.Progress;
using ChoreBacon.Resources.Strings;
using ChoreBacon.Services.Api;
using ChoreBacon.ViewModels;

namespace ChoreBacon.App.Tests.ViewModels;

public class StoreViewModelTests
{
    private readonly FakeChoreBaconApi _api = new();
    private int _balance = 100;
    private List<RewardDto> _rewards = [];

    public StoreViewModelTests()
    {
        _api.OnGetProgress = () => Task.FromResult(Dto.Progress(balance: _balance));
        _api.OnGetRewards = () => Task.FromResult<IReadOnlyList<RewardDto>>(_rewards);
    }

    private async Task<StoreViewModel> LoadedStore(bool confirm = true, params RewardDto[] rewards)
    {
        _rewards = [.. rewards];
        var vm = new StoreViewModel(_api, new FakeDialogs(confirm), new FakeNavigator());
        await vm.LoadCommand.ExecuteAsync(null);
        return vm;
    }

    [Theory]
    [InlineData(50, null, true, "")]
    [InlineData(150, null, false, "")] // too expensive
    [InlineData(50, 0, false, "Slutsåld")]
    [InlineData(50, 3, true, "3 kvar")]
    public void Rewards_show_whether_they_can_be_redeemed(int cost, int? stock, bool canRedeem, string stockText)
    {
        var item = new RewardItemViewModel(Dto.Reward(cost: cost, stock: stock), balance: 100);

        Assert.Equal(canRedeem, item.CanRedeem);
        Assert.Equal(stockText, item.StockText);
    }

    [Fact]
    public async Task Cancelling_the_confirmation_redeems_nothing()
    {
        var vm = await LoadedStore(confirm: false, Dto.Reward());

        await vm.RedeemRewardCommand.ExecuteAsync(vm.Rewards[0]);

        Assert.Empty(_api.Redeemed);
    }

    [Fact]
    public async Task Redeeming_shows_the_result_and_reloads_balance_and_stock()
    {
        var reward = Dto.Reward("Glass", cost: 30, stock: 1);
        var vm = await LoadedStore(true, reward);
        _api.OnRedeemReward = _ =>
        {
            _balance = 70;
            _rewards = [reward with { Stock = 0 }];
            return Task.FromResult(Dto.Redeemed(reward, 70));
        };

        await vm.RedeemRewardCommand.ExecuteAsync(vm.Rewards[0]);

        Assert.Equal([reward.Id], _api.Redeemed);
        Assert.Equal(string.Format(AppResources.Store_Redeemed, "Glass"), vm.StatusMessage);
        Assert.Equal(70, vm.Balance);
        Assert.True(vm.Rewards[0].IsSoldOut);
    }

    [Fact]
    public async Task A_refused_redemption_keeps_the_reason_and_shows_fresh_state()
    {
        var reward = Dto.Reward(cost: 50, stock: 2);
        var vm = await LoadedStore(true, reward);
        _api.OnRedeemReward = _ =>
        {
            _rewards = [reward with { Stock = 0 }]; // someone else took the last ones
            throw new ApiException(HttpStatusCode.Conflict, ProgressErrorCodes.RewardOutOfStock, "");
        };

        await vm.RedeemRewardCommand.ExecuteAsync(vm.Rewards[0]);

        Assert.Equal(AppResources.Error_OutOfStock, vm.ErrorMessage);
        Assert.True(vm.Rewards[0].IsSoldOut);
        Assert.False(vm.IsBusy);
    }
}
