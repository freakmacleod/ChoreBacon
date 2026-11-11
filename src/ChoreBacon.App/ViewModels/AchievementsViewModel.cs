using System.Collections.ObjectModel;
using ChoreBacon.Contracts.Progress;
using ChoreBacon.Resources.Strings;
using ChoreBacon.Services.Api;
using ChoreBacon.Services.Ui;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace ChoreBacon.ViewModels;

public partial class AchievementsViewModel : ApiViewModel
{
    private readonly IChoreBaconApi _api;

    [ObservableProperty]
    public partial int UnlockedCount { get; set; }

    [ObservableProperty]
    public partial int TotalCount { get; set; }

    public ObservableCollection<AchievementItemViewModel> Achievements { get; } = [];

    public AchievementsViewModel(IChoreBaconApi api, INavigator navigator) : base(navigator)
    {
        _api = api;
        Title = AppResources.Tab_Achievements;
    }

    [RelayCommand]
    private Task LoadAsync(CancellationToken cancellationToken) => RunAsync(async () =>
    {
        // The API returns them ordered by rarity, then threshold.
        var all = await _api.GetAchievementsAsync(cancellationToken);
        TotalCount = all.Count;
        UnlockedCount = all.Count(a => a.UnlockedAt is not null);

        Achievements.Clear();
        foreach (var achievement in all)
            Achievements.Add(new AchievementItemViewModel(achievement));
    }, cancellationToken);
}

public sealed class AchievementItemViewModel(AchievementDto achievement)
{
    public AchievementDto Achievement { get; } = achievement;
    public bool IsUnlocked => Achievement.UnlockedAt is not null;

    public string RarityColor => Achievement.Rarity switch
    {
        AchievementRarity.Uncommon => "#4CAF50",
        AchievementRarity.Rare => "#2196F3",
        AchievementRarity.Epic => "#9C27B0",
        AchievementRarity.Legendary => "#FF9800",
        _ => "#9E9E9E",
    };
}
