using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using ChoreBacon.Models;
using ChoreBacon.Services.Interfaces;
using System.Collections.ObjectModel;

namespace ChoreBacon.ViewModels;

public partial class StoreViewModel : BaseViewModel
{
    private readonly IStoreService _store;
    private readonly IAuthService _auth;

    [ObservableProperty] private int _userPoints;
    [ObservableProperty] private string _statusMessage = string.Empty;

    public ObservableCollection<RewardItem> Rewards { get; } = [];

    public StoreViewModel(IStoreService store, IAuthService auth)
    {
        _store = store;
        _auth = auth;
        Title = "Reward Store";
    }

    [RelayCommand]
    public async Task LoadAsync()
    {
        if (IsBusy) return;
        IsBusy = true;
        StatusMessage = string.Empty;
        try
        {
            var user = _auth.CurrentUser;
            if (user is null) return;

            UserPoints = user.TotalPoints;
            var rewards = await _store.GetRewardsAsync();
            Rewards.Clear();
            foreach (var r in rewards)
                Rewards.Add(r);
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task RedeemRewardAsync(RewardItem reward)
    {
        if (IsBusy) return;
        var user = _auth.CurrentUser;
        if (user is null) return;

        if (user.TotalPoints < reward.PointCost)
        {
            StatusMessage = $"Not enough points. Need {reward.PointCost}, have {user.TotalPoints}.";
            return;
        }

        bool confirm = await Shell.Current.DisplayAlert(
            "Confirm Redemption",
            $"Redeem \"{reward.Name}\" for {reward.PointCost} points?",
            "Redeem", "Cancel");

        if (!confirm) return;

        IsBusy = true;
        try
        {
            var success = await _store.RedeemRewardAsync(reward.Id, user.Id);
            if (success)
            {
                UserPoints -= reward.PointCost;
                user.TotalPoints = UserPoints;
                StatusMessage = $"Redeemed: {reward.Name}!";
                await LoadAsync();
            }
            else
            {
                StatusMessage = "Redemption failed. Please try again.";
            }
        }
        finally
        {
            IsBusy = false;
        }
    }
}
