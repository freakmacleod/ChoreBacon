using System.Collections.ObjectModel;
using ChoreBacon.Contracts.Progress;
using ChoreBacon.Resources.Strings;
using ChoreBacon.Services.Api;
using ChoreBacon.Services.Ui;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace ChoreBacon.ViewModels;

public partial class StoreViewModel : ApiViewModel
{
    private readonly IChoreBaconApi _api;
    private readonly IDialogs _dialogs;

    [ObservableProperty]
    public partial int Balance { get; set; }

    [ObservableProperty]
    public partial string StatusMessage { get; set; } = string.Empty;

    public ObservableCollection<RewardItemViewModel> Rewards { get; } = [];

    public StoreViewModel(IChoreBaconApi api, IDialogs dialogs, INavigator navigator) : base(navigator)
    {
        _api = api;
        _dialogs = dialogs;
        Title = AppResources.Tab_Store;
    }

    [RelayCommand]
    private Task LoadAsync(CancellationToken cancellationToken) => RunAsync(async () =>
    {
        StatusMessage = string.Empty;
        await RefreshAsync(cancellationToken);
    }, cancellationToken);

    [RelayCommand]
    private async Task RedeemRewardAsync(RewardItemViewModel item, CancellationToken cancellationToken)
    {
        if (IsBusy || !item.CanRedeem) return;

        var reward = item.Reward;
        var confirmed = await _dialogs.ConfirmAsync(
            AppResources.Store_ConfirmTitle,
            string.Format(AppResources.Store_ConfirmMessage, reward.Title, reward.Cost),
            AppResources.Store_ConfirmAccept,
            AppResources.Store_ConfirmCancel);
        if (!confirmed) return;

        var redeemed = await RunAsync(async () =>
        {
            StatusMessage = string.Empty;
            // Balance and stock are checked atomically by the API; a 409 lands in ErrorMessage.
            var result = await _api.RedeemRewardAsync(reward.Id, cancellationToken);
            StatusMessage = string.Join('\n',
                UnlockedLines(result.UnlockedAchievements).Prepend(string.Format(AppResources.Store_Redeemed, reward.Title)));
            await RefreshAsync(cancellationToken);
        }, cancellationToken);

        // After a refused redemption (sold out, not enough points) show the current state.
        if (!redeemed && !string.IsNullOrEmpty(ErrorMessage))
        {
            var error = ErrorMessage;
            await RunAsync(() => RefreshAsync(cancellationToken), cancellationToken);
            ErrorMessage = error;
        }
    }

    private async Task RefreshAsync(CancellationToken cancellationToken)
    {
        var rewards = _api.GetRewardsAsync(cancellationToken);
        var progress = _api.GetProgressAsync(cancellationToken);
        await Task.WhenAll(rewards, progress);

        Balance = progress.Result.Balance;
        Rewards.Clear();
        foreach (var reward in rewards.Result)
            Rewards.Add(new RewardItemViewModel(reward, Balance));
    }
}

public sealed class RewardItemViewModel(RewardDto reward, int balance)
{
    public RewardDto Reward { get; } = reward;
    public bool IsSoldOut => Reward.Stock == 0;
    public bool CanAfford => balance >= Reward.Cost;
    public bool CanRedeem => !IsSoldOut && CanAfford;

    /// <summary>"Slutsåld", "3 kvar", or empty for unlimited stock.</summary>
    public string StockText => Reward.Stock switch
    {
        null => string.Empty,
        0 => AppResources.Store_SoldOut,
        var left => string.Format(AppResources.Store_StockLeft, left),
    };
}
