using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using ChoreBacon.Models;
using ChoreBacon.Services.Interfaces;
using System.Collections.ObjectModel;

namespace ChoreBacon.ViewModels;

public partial class AchievementsViewModel : BaseViewModel
{
    private readonly IAchievementService _achievements;
    private readonly IAuthService _auth;

    [ObservableProperty] private int _unlockedCount;
    [ObservableProperty] private int _totalCount;

    public ObservableCollection<AchievementItemViewModel> Achievements { get; } = [];

    public AchievementsViewModel(IAchievementService achievements, IAuthService auth)
    {
        _achievements = achievements;
        _auth = auth;
        Title = "Achievements";
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

            var all = await _achievements.GetAllAchievementsAsync();
            var userAchievements = await _achievements.GetUserAchievementsAsync(user.Id);
            var unlockedIds = userAchievements.ToDictionary(ua => ua.AchievementId, ua => ua.UnlockedAt);

            TotalCount = all.Count;
            UnlockedCount = unlockedIds.Count;

            Achievements.Clear();
            foreach (var ach in all.OrderBy(a => a.Rarity).ThenBy(a => a.Name))
            {
                bool isUnlocked = unlockedIds.TryGetValue(ach.Id, out var unlockedAt);
                Achievements.Add(new AchievementItemViewModel(ach, isUnlocked, isUnlocked ? unlockedAt : null));
            }
        }
        finally
        {
            IsBusy = false;
        }
    }
}

public class AchievementItemViewModel
{
    public Achievement Achievement { get; }
    public bool IsUnlocked { get; }
    public DateTime? UnlockedAt { get; }
    public string RarityColor => Achievement.Rarity switch
    {
        AchievementRarity.Common    => "#9E9E9E",
        AchievementRarity.Uncommon  => "#4CAF50",
        AchievementRarity.Rare      => "#2196F3",
        AchievementRarity.Epic      => "#9C27B0",
        AchievementRarity.Legendary => "#FF9800",
        _                           => "#9E9E9E"
    };

    public AchievementItemViewModel(Achievement achievement, bool isUnlocked, DateTime? unlockedAt)
    {
        Achievement = achievement;
        IsUnlocked = isUnlocked;
        UnlockedAt = unlockedAt;
    }
}
