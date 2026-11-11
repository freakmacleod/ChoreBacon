using System.Collections.ObjectModel;
using ChoreBacon.Contracts.Family;
using ChoreBacon.Contracts.Progress;
using ChoreBacon.Resources.Strings;
using ChoreBacon.Services.Api;
using ChoreBacon.Services.Ui;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace ChoreBacon.ViewModels;

/// <summary>
/// Parents: tailor the catalog for the family — switch global chores/rewards off, override points and
/// prices, set the family's stock — and add the family's own chores and rewards.
/// </summary>
public partial class FamilyCatalogViewModel : ApiViewModel
{
    private readonly IFamilyApi _api;

    [ObservableProperty]
    public partial string StatusMessage { get; set; } = string.Empty;

    [ObservableProperty]
    public partial string NewChoreTitle { get; set; } = string.Empty;

    [ObservableProperty]
    public partial string NewChorePoints { get; set; } = string.Empty;

    /// <summary>Index into <see cref="Frequencies"/>.</summary>
    [ObservableProperty]
    public partial int NewChoreFrequency { get; set; }

    [ObservableProperty]
    public partial string NewRewardTitle { get; set; } = string.Empty;

    [ObservableProperty]
    public partial string NewRewardCost { get; set; } = string.Empty;

    [ObservableProperty]
    public partial string NewRewardStock { get; set; } = string.Empty;

    public ObservableCollection<FamilyChoreItemViewModel> Chores { get; } = [];
    public ObservableCollection<FamilyRewardItemViewModel> Rewards { get; } = [];

    public IReadOnlyList<string> Frequencies { get; } =
        [AppResources.Frequency_Daily, AppResources.Frequency_Weekly, AppResources.Frequency_Monthly, AppResources.Frequency_Once];

    public FamilyCatalogViewModel(IFamilyApi api, INavigator navigator) : base(navigator)
    {
        _api = api;
        Title = AppResources.Family_Catalog;
    }

    [RelayCommand]
    private Task LoadAsync(CancellationToken cancellationToken) => RunAsync(() => ReloadAsync(cancellationToken), cancellationToken);

    [RelayCommand]
    private Task SaveChoreAsync(FamilyChoreItemViewModel item, CancellationToken cancellationToken)
    {
        StatusMessage = string.Empty;
        if (!TryParseOptional(item.OverrideText, min: 1, out var points)) return Invalid(AppResources.Catalog_InvalidNumber);
        var chore = item.Chore;
        return RunAsync(async () =>
        {
            if (chore.IsFamilyChore)
                await _api.UpdateFamilyChoreAsync(chore.Id,
                    new FamilyChoreRequest(chore.Title, chore.Description, chore.Icon, points ?? chore.Points, chore.Frequency, item.IsActive), cancellationToken);
            else
                await _api.SetChoreSettingsAsync(chore.Id, new ChoreSettingsRequest(item.IsActive, points), cancellationToken);
            StatusMessage = AppResources.Catalog_Saved;
        }, cancellationToken);
    }

    [RelayCommand]
    private Task SaveRewardAsync(FamilyRewardItemViewModel item, CancellationToken cancellationToken)
    {
        StatusMessage = string.Empty;
        if (!TryParseOptional(item.OverrideText, min: 1, out var cost)) return Invalid(AppResources.Catalog_InvalidNumber);
        if (!TryParseOptional(item.StockText, min: 0, out var stock)) return Invalid(AppResources.Catalog_InvalidStock);
        var reward = item.Reward;
        return RunAsync(async () =>
        {
            if (reward.IsFamilyReward)
                await _api.UpdateFamilyRewardAsync(reward.Id,
                    new FamilyRewardRequest(reward.Title, reward.Description, reward.Icon, cost ?? reward.Cost, stock, item.IsActive), cancellationToken);
            else
                await _api.SetRewardSettingsAsync(reward.Id, new RewardSettingsRequest(item.IsActive, cost, stock), cancellationToken);
            StatusMessage = AppResources.Catalog_Saved;
        }, cancellationToken);
    }

    [RelayCommand]
    private Task AddChoreAsync(CancellationToken cancellationToken)
    {
        StatusMessage = string.Empty;
        if (string.IsNullOrWhiteSpace(NewChoreTitle)) return Invalid(AppResources.Catalog_TitleRequired);
        if (!TryParseOptional(NewChorePoints, min: 1, out var points) || points is null) return Invalid(AppResources.Catalog_InvalidNumber);
        var title = NewChoreTitle.Trim();
        var frequency = (ChoreFrequency)Math.Clamp(NewChoreFrequency, 0, Frequencies.Count - 1);
        return RunAsync(async () =>
        {
            await _api.CreateFamilyChoreAsync(new FamilyChoreRequest(title, "", "chore_default", points.Value, frequency, true), cancellationToken);
            NewChoreTitle = NewChorePoints = string.Empty;
            await ReloadAsync(cancellationToken);
            StatusMessage = string.Format(AppResources.Catalog_Added, title);
        }, cancellationToken);
    }

    [RelayCommand]
    private Task AddRewardAsync(CancellationToken cancellationToken)
    {
        StatusMessage = string.Empty;
        if (string.IsNullOrWhiteSpace(NewRewardTitle)) return Invalid(AppResources.Catalog_TitleRequired);
        if (!TryParseOptional(NewRewardCost, min: 1, out var cost) || cost is null) return Invalid(AppResources.Catalog_InvalidNumber);
        if (!TryParseOptional(NewRewardStock, min: 0, out var stock)) return Invalid(AppResources.Catalog_InvalidStock);
        var title = NewRewardTitle.Trim();
        return RunAsync(async () =>
        {
            await _api.CreateFamilyRewardAsync(new FamilyRewardRequest(title, "", "reward_default", cost.Value, stock, true), cancellationToken);
            NewRewardTitle = NewRewardCost = NewRewardStock = string.Empty;
            await ReloadAsync(cancellationToken);
            StatusMessage = string.Format(AppResources.Catalog_Added, title);
        }, cancellationToken);
    }

    private async Task ReloadAsync(CancellationToken cancellationToken)
    {
        var chores = _api.GetFamilyChoresAsync(cancellationToken);
        var rewards = _api.GetFamilyRewardsAsync(cancellationToken);
        await Task.WhenAll(chores, rewards);
        Chores.Clear();
        foreach (var chore in chores.Result) Chores.Add(new FamilyChoreItemViewModel(chore));
        Rewards.Clear();
        foreach (var reward in rewards.Result) Rewards.Add(new FamilyRewardItemViewModel(reward));
    }

    private Task Invalid(string message)
    {
        ErrorMessage = message;
        return Task.CompletedTask;
    }

    /// <summary>Empty = null (use the catalog value / unlimited); otherwise a whole number of at least <paramref name="min"/>.</summary>
    internal static bool TryParseOptional(string? text, int min, out int? value)
    {
        value = null;
        if (string.IsNullOrWhiteSpace(text)) return true;
        if (!int.TryParse(text.Trim(), out var parsed) || parsed < min) return false;
        value = parsed;
        return true;
    }
}

public partial class FamilyChoreItemViewModel(FamilyChoreDto chore) : ObservableObject
{
    public FamilyChoreDto Chore { get; } = chore;

    [ObservableProperty]
    public partial bool IsActive { get; set; } = chore.IsActive;

    /// <summary>Family chores edit their own points; global chores get an override (empty = catalog value).</summary>
    [ObservableProperty]
    public partial string OverrideText { get; set; } = (chore.IsFamilyChore ? chore.Points : chore.PointsOverride)?.ToString() ?? string.Empty;

    public string OverrideLabel => string.Format(AppResources.Catalog_PointsOverride, Chore.Points);
    public bool IsFamilyChore => Chore.IsFamilyChore;
}

public partial class FamilyRewardItemViewModel(FamilyRewardDto reward) : ObservableObject
{
    public FamilyRewardDto Reward { get; } = reward;

    [ObservableProperty]
    public partial bool IsActive { get; set; } = reward.IsActive;

    [ObservableProperty]
    public partial string OverrideText { get; set; } = (reward.IsFamilyReward ? reward.Cost : reward.CostOverride)?.ToString() ?? string.Empty;

    [ObservableProperty]
    public partial string StockText { get; set; } = reward.Stock?.ToString() ?? string.Empty;

    public string OverrideLabel => string.Format(AppResources.Catalog_CostOverride, Reward.Cost);
    public bool IsFamilyReward => Reward.IsFamilyReward;
}
