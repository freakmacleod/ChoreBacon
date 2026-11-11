using System.Collections.ObjectModel;
using ChoreBacon.Contracts.Family;
using ChoreBacon.Resources.Strings;
using ChoreBacon.Services.Api;
using ChoreBacon.Services.Interfaces;
using ChoreBacon.Services.Ui;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace ChoreBacon.ViewModels;

/// <summary>The family tab: create or join a family, or see it (members, invite code and settings for parents).</summary>
public partial class FamilyViewModel : ApiViewModel
{
    private readonly IFamilyApi _api;
    private readonly IAuthService _auth;
    private readonly IDialogs _dialogs;
    private readonly INavigator _navigator;

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(HasFamily), nameof(HasNoFamily), nameof(IsParent), nameof(Name), nameof(InviteCodeText), nameof(ApprovalText))]
    public partial FamilyDto? Family { get; set; }

    /// <summary>False until the first load, so the page shows neither state before it knows.</summary>
    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(HasFamily), nameof(HasNoFamily))]
    public partial bool IsLoaded { get; set; }

    public bool HasFamily => IsLoaded && Family is not null;
    public bool HasNoFamily => IsLoaded && Family is null;
    public bool IsParent => Family?.Role == FamilyRole.Parent;
    public string Name => Family?.Name ?? string.Empty;
    public string InviteCodeText => Family?.InviteCode is { } code ? string.Format(AppResources.Family_InviteCode, code) : string.Empty;
    public string ApprovalText => Family?.RequiresApproval == true ? AppResources.Family_ApprovalOn : AppResources.Family_ApprovalOff;

    public ObservableCollection<FamilyMemberItemViewModel> Members { get; } = [];

    public FamilyViewModel(IFamilyApi api, IAuthService auth, IDialogs dialogs, INavigator navigator) : base(navigator)
    {
        _api = api;
        _auth = auth;
        _dialogs = dialogs;
        _navigator = navigator;
        Title = AppResources.Tab_Family;
    }

    [RelayCommand]
    private Task LoadAsync(CancellationToken cancellationToken) => RunAsync(async () =>
    {
        Show(await _api.GetFamilyAsync(cancellationToken));
    }, cancellationToken);

    [RelayCommand]
    private async Task CreateAsync(CancellationToken cancellationToken)
    {
        var name = await _dialogs.PromptAsync(AppResources.Family_Create, AppResources.Family_CreatePrompt, AppResources.Common_Ok, AppResources.Common_Cancel, 60);
        if (string.IsNullOrWhiteSpace(name)) return;
        await RunAsync(async () => Show(await _api.CreateFamilyAsync(name.Trim(), cancellationToken)), cancellationToken);
    }

    [RelayCommand]
    private async Task JoinAsync(CancellationToken cancellationToken)
    {
        var code = await _dialogs.PromptAsync(AppResources.Family_Join, AppResources.Family_JoinPrompt, AppResources.Common_Ok, AppResources.Common_Cancel, 12);
        if (string.IsNullOrWhiteSpace(code)) return;
        await RunAsync(async () => Show(await _api.JoinFamilyAsync(code.Trim(), cancellationToken)), cancellationToken);
    }

    [RelayCommand]
    private async Task LeaveAsync(CancellationToken cancellationToken)
    {
        if (Family is null) return;
        if (!await Confirm(string.Format(AppResources.Family_LeaveConfirm, Family.Name))) return;
        await RunAsync(async () =>
        {
            await _api.LeaveFamilyAsync(cancellationToken);
            Show(null);
        }, cancellationToken);
    }

    [RelayCommand]
    private async Task NewInviteCodeAsync(CancellationToken cancellationToken)
    {
        if (Family is null || !await Confirm(AppResources.Family_NewCodeConfirm)) return;
        await RunAsync(async () =>
        {
            var code = await _api.RegenerateInviteCodeAsync(cancellationToken);
            Family = Family with { InviteCode = code };
        }, cancellationToken);
    }

    [RelayCommand]
    private Task ToggleApprovalAsync(CancellationToken cancellationToken) => Family is null ? Task.CompletedTask : RunAsync(async () =>
    {
        Show(await _api.UpdateFamilyAsync(new UpdateFamilyRequest(RequiresApproval: !Family.RequiresApproval), cancellationToken));
    }, cancellationToken);

    [RelayCommand]
    private Task ChangeRoleAsync(FamilyMemberItemViewModel member, CancellationToken cancellationToken) => RunAsync(async () =>
    {
        var role = member.Member.Role == FamilyRole.Parent ? FamilyRole.Child : FamilyRole.Parent;
        await _api.SetMemberRoleAsync(member.Member.UserId, role, cancellationToken);
        Show(await _api.GetFamilyAsync(cancellationToken));
    }, cancellationToken);

    [RelayCommand]
    private async Task RemoveMemberAsync(FamilyMemberItemViewModel member, CancellationToken cancellationToken)
    {
        if (!await Confirm(string.Format(AppResources.Family_RemoveConfirm, member.Member.DisplayName))) return;
        await RunAsync(async () =>
        {
            await _api.RemoveMemberAsync(member.Member.UserId, cancellationToken);
            Show(await _api.GetFamilyAsync(cancellationToken));
        }, cancellationToken);
    }

    [RelayCommand]
    private Task OpenApprovalsAsync() => _navigator.GoToAsync(Routes.Approvals);

    [RelayCommand]
    private Task OpenCatalogAsync() => _navigator.GoToAsync(Routes.FamilyCatalog);

    private Task<bool> Confirm(string message) =>
        _dialogs.ConfirmAsync(AppResources.Tab_Family, message, AppResources.Common_Ok, AppResources.Common_Cancel);

    private void Show(FamilyDto? family)
    {
        Family = family;
        IsLoaded = true;
        Members.Clear();
        if (family is null) return;
        var self = _auth.CurrentUser?.Id;
        foreach (var member in family.Members)
            Members.Add(new FamilyMemberItemViewModel(member, member.UserId == self, family.Role == FamilyRole.Parent));
    }
}

public sealed class FamilyMemberItemViewModel(FamilyMemberDto member, bool isSelf, bool viewerIsParent)
{
    public FamilyMemberDto Member { get; } = member;
    public bool IsSelf { get; } = isSelf;
    public string RoleText => Member.Role == FamilyRole.Parent ? AppResources.Family_RoleParent : AppResources.Family_RoleChild;

    /// <summary>Parents manage other members; everyone leaves themselves via "Lämna familjen".</summary>
    public bool CanManage => viewerIsParent && !IsSelf;
    public string ChangeRoleText => Member.Role == FamilyRole.Parent ? AppResources.Family_MakeChild : AppResources.Family_MakeParent;
}
