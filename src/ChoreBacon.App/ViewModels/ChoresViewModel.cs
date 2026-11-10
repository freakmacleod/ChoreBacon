using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using ChoreBacon.Models;
using ChoreBacon.Services.Interfaces;
using System.Collections.ObjectModel;

namespace ChoreBacon.ViewModels;

public partial class ChoresViewModel : BaseViewModel
{
    private readonly IChoreService _chores;
    private readonly IAuthService _auth;
    private readonly IAchievementService _achievements;

    [ObservableProperty] private int _userPoints;
    [ObservableProperty] private string _statusMessage = string.Empty;

    public ObservableCollection<ChoreItemViewModel> Chores { get; } = [];

    public ChoresViewModel(IChoreService chores, IAuthService auth, IAchievementService achievements)
    {
        _chores = chores;
        _auth = auth;
        _achievements = achievements;
        Title = "Chores";
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
            var allChores = await _chores.GetChoresAsync();
            var todayCompletions = await _chores.GetTodayCompletionsAsync(user.Id);
            var completedIds = todayCompletions.Select(c => c.ChoreId).ToHashSet();

            Chores.Clear();
            foreach (var chore in allChores)
                Chores.Add(new ChoreItemViewModel(chore, completedIds.Contains(chore.Id)));
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task CompleteChoreAsync(ChoreItemViewModel item)
    {
        if (IsBusy || item.IsCompleted) return;
        IsBusy = true;
        try
        {
            var user = _auth.CurrentUser!;
            var completion = await _chores.CompleteChoreAsync(item.Chore.Id, user.Id);
            item.IsCompleted = true;
            UserPoints += completion.PointsEarned;
            StatusMessage = $"+{completion.PointsEarned} points for {item.Chore.Name}!";

            var newAchievements = await _achievements.CheckAndUnlockAchievementsAsync(user.Id);
            foreach (var ach in newAchievements)
                StatusMessage += $"\n🏆 Achievement unlocked: {ach.Name}!";
        }
        catch (InvalidOperationException ex)
        {
            StatusMessage = ex.Message;
        }
        finally
        {
            IsBusy = false;
        }
    }
}

public partial class ChoreItemViewModel : ObservableObject
{
    public Chore Chore { get; }

    [ObservableProperty]
    private bool _isCompleted;

    public ChoreItemViewModel(Chore chore, bool isCompleted)
    {
        Chore = chore;
        _isCompleted = isCompleted;
    }
}
