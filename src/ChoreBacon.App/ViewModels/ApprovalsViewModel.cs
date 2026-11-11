using System.Collections.ObjectModel;
using ChoreBacon.Contracts.Family;
using ChoreBacon.Resources.Strings;
using ChoreBacon.Services.Api;
using ChoreBacon.Services.Ui;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace ChoreBacon.ViewModels;

/// <summary>Parents: approve or reject children's completed chores, and mark redeemed rewards as handed over.</summary>
public partial class ApprovalsViewModel : ApiViewModel
{
    private readonly IFamilyApi _api;

    [ObservableProperty]
    public partial string StatusMessage { get; set; } = string.Empty;

    public ObservableCollection<PendingCompletionDto> Completions { get; } = [];
    public ObservableCollection<PendingRedemptionDto> Redemptions { get; } = [];

    public ApprovalsViewModel(IFamilyApi api, INavigator navigator) : base(navigator)
    {
        _api = api;
        Title = AppResources.Family_Approvals;
    }

    [RelayCommand]
    private Task LoadAsync(CancellationToken cancellationToken) => RunAsync(async () =>
    {
        var completions = _api.GetPendingCompletionsAsync(cancellationToken);
        var redemptions = _api.GetPendingRedemptionsAsync(cancellationToken);
        await Task.WhenAll(completions, redemptions);
        Replace(Completions, completions.Result);
        Replace(Redemptions, redemptions.Result);
    }, cancellationToken);

    [RelayCommand]
    private Task ApproveAsync(PendingCompletionDto item, CancellationToken cancellationToken) => Review(item, true, cancellationToken);

    [RelayCommand]
    private Task RejectAsync(PendingCompletionDto item, CancellationToken cancellationToken) => Review(item, false, cancellationToken);

    private async Task Review(PendingCompletionDto item, bool approve, CancellationToken cancellationToken)
    {
        StatusMessage = string.Empty;
        var done = await RunAsync(async () =>
        {
            await _api.ReviewCompletionAsync(item.Id, approve, cancellationToken);
            StatusMessage = approve
                ? string.Format(AppResources.Approvals_Approved, item.DisplayName, item.Points)
                : string.Format(AppResources.Approvals_Rejected, item.ChoreTitle);
        }, cancellationToken);
        // Gone either way once handled (also when someone else already did: not_pending).
        if (done || ErrorMessage == AppResources.Error_NotPending) Completions.Remove(item);
    }

    [RelayCommand]
    private async Task FulfilAsync(PendingRedemptionDto item, CancellationToken cancellationToken)
    {
        StatusMessage = string.Empty;
        var done = await RunAsync(async () =>
        {
            await _api.FulfilRedemptionAsync(item.Id, cancellationToken);
            StatusMessage = string.Format(AppResources.Approvals_Fulfilled, item.RewardTitle);
        }, cancellationToken);
        if (done || ErrorMessage == AppResources.Error_NotPending) Redemptions.Remove(item);
    }

    private static void Replace<T>(ObservableCollection<T> target, IEnumerable<T> items)
    {
        target.Clear();
        foreach (var item in items) target.Add(item);
    }
}
