using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using ChoreBacon.Models;
using ChoreBacon.Services.Interfaces;
using System.Collections.ObjectModel;

namespace ChoreBacon.ViewModels;

public partial class DashboardViewModel : BaseViewModel
{
    private readonly IAuthService _auth;
    private readonly IChoreService _chores;
    private readonly IAchievementService _achievements;

    [ObservableProperty] private string _userName = string.Empty;
    [ObservableProperty] private string _userAvatar = string.Empty;
    [ObservableProperty] private int _totalPoints;
    [ObservableProperty] private int _streakDays;
    [ObservableProperty] private int _choresCompletedToday;
    [ObservableProperty] private int _totalChores;

    public ObservableCollection<Achievement> RecentAchievements { get; } = [];

    public DashboardViewModel(IAuthService auth, IChoreService chores, IAchievementService achievements)
    {
        _auth = auth;
        _chores = chores;
        _achievements = achievements;
        Title = "Dashboard";
    }

    [RelayCommand]
    public async Task LoadAsync()
    {
        if (IsBusy) return;
        IsBusy = true;
        try
        {
            var user = _auth.CurrentUser;
            if (user is null) return;

            UserName = user.DisplayName;
            UserAvatar = user.ProfilePictureUrl;
            TotalPoints = user.TotalPoints;
            StreakDays = await _chores.GetStreakAsync(user.Id);

            var allChores = await _chores.GetChoresAsync();
            var todayCompletions = await _chores.GetTodayCompletionsAsync(user.Id);
            TotalChores = allChores.Count;
            ChoresCompletedToday = todayCompletions.Count;

            var userAchievements = await _achievements.GetUserAchievementsAsync(user.Id);
            var allAchievements = await _achievements.GetAllAchievementsAsync();

            RecentAchievements.Clear();
            foreach (var ua in userAchievements.OrderByDescending(a => a.UnlockedAt).Take(3))
            {
                var ach = allAchievements.FirstOrDefault(a => a.Id == ua.AchievementId);
                if (ach is not null) RecentAchievements.Add(ach);
            }
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task NavigateToChoresAsync() => await Shell.Current.GoToAsync("//chores");

    [RelayCommand]
    private async Task NavigateToStoreAsync() => await Shell.Current.GoToAsync("//store");

    [RelayCommand]
    private async Task NavigateToAchievementsAsync() => await Shell.Current.GoToAsync("//achievements");
}
