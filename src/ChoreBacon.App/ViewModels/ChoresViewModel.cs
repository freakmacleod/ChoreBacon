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
        await Task.WhenAll(chores, progress);

        Balance = progress.Result.Balance;
        Chores.Clear();
        foreach (var chore in chores.Result)
            Chores.Add(new ChoreItemViewModel(chore));
    }, cancellationToken);

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
                StatusMessage = string.Join('\n', UnlockedLines(result.UnlockedAchievements).Prepend(headline));
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

    public string FrequencyText => Chore.Frequency switch
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
