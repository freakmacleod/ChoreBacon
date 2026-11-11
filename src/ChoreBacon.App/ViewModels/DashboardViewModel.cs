using System.Collections.ObjectModel;
using ChoreBacon.Contracts.Progress;
using ChoreBacon.Resources.Strings;
using ChoreBacon.Services.Api;
using ChoreBacon.Services.Interfaces;
using ChoreBacon.Services.Ui;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace ChoreBacon.ViewModels;

public partial class DashboardViewModel : ApiViewModel
{
    private readonly IChoreBaconApi _api;
    private readonly IAuthService _auth;
    private readonly INavigator _navigator;

    [ObservableProperty]
    public partial string UserName { get; set; } = string.Empty;

    [ObservableProperty]
    public partial int Balance { get; set; }

    [ObservableProperty]
    public partial int LifetimeEarned { get; set; }

    [ObservableProperty]
    public partial int StreakDays { get; set; }

    [ObservableProperty]
    public partial int ChoresDone { get; set; }

    [ObservableProperty]
    public partial int ChoresTotal { get; set; }

    public ObservableCollection<AchievementDto> RecentAchievements { get; } = [];

    public DashboardViewModel(IChoreBaconApi api, IAuthService auth, INavigator navigator) : base(navigator)
    {
        _api = api;
        _auth = auth;
        _navigator = navigator;
        Title = AppResources.Tab_Dashboard;
    }

    [RelayCommand]
    private Task LoadAsync(CancellationToken cancellationToken) => RunAsync(async () =>
    {
        UserName = _auth.CurrentUser?.DisplayName ?? string.Empty;
        var progress = await _api.GetProgressAsync(cancellationToken);
        Balance = progress.Balance;
        LifetimeEarned = progress.LifetimeEarned;
        StreakDays = progress.StreakDays;
        ChoresDone = progress.ChoresDoneThisPeriod;
        ChoresTotal = progress.ChoresTotal;

        RecentAchievements.Clear();
        foreach (var achievement in progress.RecentAchievements)
            RecentAchievements.Add(achievement);
    }, cancellationToken);

    [RelayCommand]
    private async Task LogoutAsync(CancellationToken cancellationToken)
    {
        await _auth.LogoutAsync(cancellationToken);
        await _navigator.GoToAsync(Routes.Login);
    }

    [RelayCommand]
    private Task NavigateToChoresAsync() => _navigator.GoToAsync(Routes.Chores);

    [RelayCommand]
    private Task NavigateToStoreAsync() => _navigator.GoToAsync(Routes.Store);

    [RelayCommand]
    private Task NavigateToAchievementsAsync() => _navigator.GoToAsync(Routes.Achievements);
}
