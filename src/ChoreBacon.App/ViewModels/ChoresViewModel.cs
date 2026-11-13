using System.Collections.ObjectModel;
using ChoreBacon.Contracts.Progress;
using ChoreBacon.Helpers;
using ChoreBacon.Resources.Strings;
using ChoreBacon.Services.Api;
using ChoreBacon.Services.Ui;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace ChoreBacon.ViewModels;

public partial class ChoresViewModel : ApiViewModel
{
    private readonly IChoreBaconApi _api;
    private ChoreItemViewModel? _completing;

    [ObservableProperty]
    public partial int Balance { get; set; }

    [ObservableProperty]
    public partial string StatusMessage { get; set; } = string.Empty;

    public ObservableCollection<ChoreItemViewModel> Chores { get; } = [];

    /// <summary>Bonus combos for today or this week, shown above the chores.</summary>
    public ObservableCollection<ComboItemViewModel> Combos { get; } = [];

    [ObservableProperty]
    public partial bool HasCombos { get; set; }

    public ChoresViewModel(IChoreBaconApi api, INavigator navigator) : base(navigator)
    {
        _api = api;
        Title = AppResources.Tab_Chores;
    }

    [RelayCommand]
    private Task LoadAsync(CancellationToken cancellationToken) => RunAsync(async () =>
    {
        StatusMessage = string.Empty;
        var chores = _api.GetChoresAsync(cancellationToken);
        var progress = _api.GetProgressAsync(cancellationToken);
        var combos = _api.GetCombosAsync(cancellationToken);
        await Task.WhenAll(chores, progress, combos);

        Balance = progress.Result.Balance;
        Chores.Clear();
        foreach (var chore in chores.Result)
            Chores.Add(new ChoreItemViewModel(chore));
        ShowCombos(combos.Result);
    }, cancellationToken);

    private void ShowCombos(IReadOnlyList<ComboDto> combos)
    {
        Combos.Clear();
        foreach (var combo in combos)
            Combos.Add(new ComboItemViewModel(combo));
        HasCombos = Combos.Count > 0;
    }

    [RelayCommand]
    private async Task CompleteChoreAsync(ChoreItemViewModel item, CancellationToken cancellationToken)
    {
        if (item.IsCompleted) return;
        _completing = item;
        try
        {
            await RunAsync(async () =>
            {
                StatusMessage = string.Empty;
                // The API decides whether points were earned; the app only shows the result.
                var result = await _api.CompleteChoreAsync(item.Chore.Id, cancellationToken);
                item.MarkCompleted(result.Completion.Status);
                Balance = result.Balance;
                var headline = result.Completion.Status == CompletionStatus.Pending
                    ? string.Format(AppResources.Chores_PendingApproval, result.PointsPending, item.Chore.Title)
                    : string.Format(AppResources.Chores_PointsEarned, result.PointsEarned, item.Chore.Title);
                var comboLines = (result.ComboBonuses ?? []).Select(c => string.Format(AppResources.Combos_Earned, c.Title, c.BonusPoints));
                StatusMessage = string.Join('\n', comboLines.Concat(UnlockedLines(result.UnlockedAchievements)).Prepend(headline));
                // The completion may tick a box in a combo; the API decides, so ask it again.
                if (HasCombos)
                    ShowCombos(await _api.GetCombosAsync(cancellationToken));
            }, cancellationToken);
        }
        finally
        {
            _completing = null;
        }
    }

    protected override void OnApiError(ApiException ex)
    {
        // Done elsewhere (another device, or the list was stale): show it as done.
        if (_completing is not null && ApiMessages.IsAlreadyCompleted(ex.Code))
            _completing.MarkCompleted(CompletionStatus.Approved);
        // Past its deadline, or a sibling took it: it is no longer there.
        if (_completing is not null && ApiMessages.IsChoreGone(ex.Code))
            Chores.Remove(_completing);
        base.OnApiError(ex);
    }
}

public partial class ChoreItemViewModel(ChoreDto chore) : ObservableObject
{
    public ChoreDto Chore { get; } = chore;

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(ActionText))]
    public partial bool IsCompleted { get; set; } = chore.CompletedThisPeriod;

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(ActionText))]
    public partial bool IsPending { get; set; } = chore.CompletionStatus == CompletionStatus.Pending;

    public string ActionText => IsPending ? AppResources.Chores_Pending
        : IsCompleted ? AppResources.Chores_Done
        : AppResources.Chores_Do;

    public bool IsTemporary => Chore.ExpiresAt is not null;

    /// <summary>The deadline of a temporary chore in Swedish time, e.g. "⏳ Senast fre 20 nov. 18:00".</summary>
    public string DeadlineText => Chore.ExpiresAt is { } deadline
        ? string.Format(SwedishTime.Culture, AppResources.Chores_Deadline, SwedishTime.ToStockholm(deadline))
        : string.Empty;

    public string FrequencyText => IsTemporary ? AppResources.Chores_Temporary : Chore.Frequency switch
    {
        ChoreFrequency.Daily => AppResources.Frequency_Daily,
        ChoreFrequency.Weekly => AppResources.Frequency_Weekly,
        ChoreFrequency.Monthly => AppResources.Frequency_Monthly,
        _ => AppResources.Frequency_Once,
    };

    internal void MarkCompleted(CompletionStatus status)
    {
        IsCompleted = true;
        IsPending = status == CompletionStatus.Pending;
    }
}

public sealed class ComboItemViewModel(ComboDto combo)
{
    public ComboDto Combo { get; } = combo;

    public string BonusText => string.Format(AppResources.Combos_Bonus, Combo.BonusPoints);

    public string PeriodText => Combo.Period == ComboPeriod.Week ? AppResources.Combos_ThisWeek : AppResources.Combos_Today;

    public string ProgressText => Combo.AwardedThisPeriod
        ? AppResources.Combos_Awarded
        : string.Format(AppResources.Combos_Progress, Combo.Chores.Count(c => c.Done), Combo.Chores.Count);

    /// <summary>One line per chore: done, waiting for approval, or still to do.</summary>
    public string ChoresText => string.Join('\n', Combo.Chores.Select(c => string.Format(
        c.Pending ? AppResources.Combos_ChorePending : c.Done ? AppResources.Combos_ChoreDone : AppResources.Combos_ChoreTodo, c.Title)));
}
