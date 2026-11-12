using System.Net;
using ChoreBacon.App.Tests.Fakes;
using ChoreBacon.Contracts.Family;
using ChoreBacon.Contracts.Progress;
using ChoreBacon.Helpers;
using ChoreBacon.Resources.Strings;
using ChoreBacon.Services.Api;
using ChoreBacon.Services.Ui;
using ChoreBacon.ViewModels;

namespace ChoreBacon.App.Tests.ViewModels;

public class FamilyViewModelTests
{
    private readonly FakeFamilyApi _api = new();
    private readonly FakeDialogs _dialogs = new();
    private readonly FakeNavigator _navigator = new();

    private FamilyViewModel Create() => new(_api, new FakeAuthService(), _dialogs, _navigator);

    [Fact]
    public async Task Without_a_family_offers_create_and_join()
    {
        var vm = Create();
        Assert.False(vm.HasFamily || vm.HasNoFamily); // nothing shown before the first load

        await vm.LoadCommand.ExecuteAsync(null);

        Assert.True(vm.HasNoFamily);
        Assert.False(vm.HasFamily);
    }

    [Fact]
    public async Task Creating_asks_for_a_name_and_shows_the_invite_code()
    {
        var vm = Create();
        _dialogs.PromptAnswers.Enqueue("  Familjen Andersson ");

        await vm.CreateCommand.ExecuteAsync(null);

        Assert.Equal(["create Familjen Andersson"], _api.Calls);
        Assert.True(vm.IsParent);
        Assert.Equal(string.Format(AppResources.Family_InviteCode, "K7PQ-4XMR"), vm.InviteCodeText);
    }

    [Fact]
    public async Task Cancelling_the_prompt_does_nothing()
    {
        var vm = Create();
        await vm.JoinCommand.ExecuteAsync(null);
        Assert.Empty(_api.Calls);
    }

    [Fact]
    public async Task A_wrong_invite_code_shows_a_Swedish_message()
    {
        _api.OnJoin = _ => throw new ApiException(HttpStatusCode.NotFound, FamilyErrorCodes.InvalidInviteCode, "");
        var vm = Create();
        _dialogs.PromptAnswers.Enqueue("AAAA-AAAA");

        await vm.JoinCommand.ExecuteAsync(null);

        Assert.Equal(AppResources.Error_InvalidInviteCode, vm.ErrorMessage);
    }

    [Fact]
    public async Task Children_see_no_code_and_cannot_manage_members()
    {
        _api.Family = Make.Family(role: FamilyRole.Child, others: Make.Member("Pappa", FamilyRole.Parent));
        var vm = Create();

        await vm.LoadCommand.ExecuteAsync(null);

        Assert.False(vm.IsParent);
        Assert.Equal(string.Empty, vm.InviteCodeText);
        Assert.All(vm.Members, m => Assert.False(m.CanManage));
    }

    [Fact]
    public async Task Parents_manage_others_but_not_themselves()
    {
        var child = Make.Member("Lisa", FamilyRole.Child);
        _api.Family = Make.Family(others: child);
        var vm = Create();
        await vm.LoadCommand.ExecuteAsync(null);

        var self = vm.Members.Single(m => m.IsSelf);
        var lisa = vm.Members.Single(m => !m.IsSelf);
        Assert.False(self.CanManage);
        Assert.True(lisa.CanManage);
        Assert.Equal(AppResources.Family_MakeParent, lisa.ChangeRoleText);

        await vm.ChangeRoleCommand.ExecuteAsync(lisa);
        Assert.Contains($"role {child.UserId} Parent", _api.Calls);
    }

    [Fact]
    public async Task Toggling_approval_sends_only_that_setting()
    {
        _api.Family = Make.Family(requiresApproval: false);
        var vm = Create();
        await vm.LoadCommand.ExecuteAsync(null);
        Assert.Equal(AppResources.Family_ApprovalOff, vm.ApprovalText);

        await vm.ToggleApprovalCommand.ExecuteAsync(null);

        Assert.Equal([new UpdateFamilyRequest(RequiresApproval: true)], _api.Updates);
        Assert.Equal(AppResources.Family_ApprovalOn, vm.ApprovalText);
    }

    [Fact]
    public async Task The_last_parent_is_told_why_they_cannot_leave()
    {
        _api.Family = Make.Family(others: Make.Member("Lisa", FamilyRole.Child));
        _api.OnLeave = () => throw new ApiException(HttpStatusCode.Conflict, FamilyErrorCodes.LastParent, "");
        var vm = Create();
        await vm.LoadCommand.ExecuteAsync(null);

        await vm.LeaveCommand.ExecuteAsync(null);

        Assert.Equal(AppResources.Error_LastParent, vm.ErrorMessage);
        Assert.True(vm.HasFamily);
    }

    [Fact]
    public async Task Parents_open_approvals_and_the_family_catalog()
    {
        var vm = Create();
        await vm.OpenApprovalsCommand.ExecuteAsync(null);
        await vm.OpenCatalogCommand.ExecuteAsync(null);
        Assert.Equal([Routes.Approvals, Routes.FamilyCatalog], _navigator.Routes);
    }
}

public class ApprovalsViewModelTests
{
    private static PendingCompletionDto Completion(string chore = "Diska") =>
        new(Guid.NewGuid(), Guid.NewGuid(), "Lisa", Guid.NewGuid(), chore, 10, "2026-11-11", DateTimeOffset.UtcNow);

    [Fact]
    public async Task Approving_and_rejecting_remove_the_item_with_a_message()
    {
        var (a, b) = (Completion("Diska"), Completion("Bädda"));
        var api = new FakeFamilyApi { Completions = [a, b] };
        var vm = new ApprovalsViewModel(api, new FakeNavigator());
        await vm.LoadCommand.ExecuteAsync(null);

        await vm.ApproveCommand.ExecuteAsync(a);
        Assert.Equal(string.Format(AppResources.Approvals_Approved, "Lisa", 10), vm.StatusMessage);
        await vm.RejectCommand.ExecuteAsync(b);
        Assert.Equal(string.Format(AppResources.Approvals_Rejected, "Bädda"), vm.StatusMessage);

        Assert.Empty(vm.Completions);
        Assert.Equal([$"approve {a.Id}", $"reject {b.Id}"], api.Calls);
    }

    [Fact]
    public async Task Something_already_handled_elsewhere_disappears_too()
    {
        var item = Completion();
        var api = new FakeFamilyApi
        {
            Completions = [item],
            OnReview = (_, _) => throw new ApiException(HttpStatusCode.Conflict, FamilyErrorCodes.NotPending, ""),
        };
        var vm = new ApprovalsViewModel(api, new FakeNavigator());
        await vm.LoadCommand.ExecuteAsync(null);

        await vm.ApproveCommand.ExecuteAsync(item);

        Assert.Empty(vm.Completions);
        Assert.Equal(AppResources.Error_NotPending, vm.ErrorMessage);
    }

    [Fact]
    public async Task Handing_over_a_reward_marks_it_fulfilled()
    {
        var redemption = new PendingRedemptionDto(Guid.NewGuid(), Guid.NewGuid(), "Lisa", Guid.NewGuid(), "Glass", 50, DateTimeOffset.UtcNow);
        var api = new FakeFamilyApi { Redemptions = [redemption] };
        var vm = new ApprovalsViewModel(api, new FakeNavigator());
        await vm.LoadCommand.ExecuteAsync(null);

        await vm.FulfilCommand.ExecuteAsync(redemption);

        Assert.Empty(vm.Redemptions);
        Assert.Equal([$"fulfil {redemption.Id}"], api.Calls);
    }
}

public class FamilyCatalogViewModelTests
{
    private static FamilyChoreDto GlobalChore(int? pointsOverride = null) =>
        new(Guid.NewGuid(), "Diska", "", "dishes", 10, ChoreFrequency.Daily, false, true, pointsOverride);

    [Theory]
    [InlineData("", 1, true, null)]
    [InlineData(" 25 ", 1, true, 25)]
    [InlineData("0", 1, false, null)]
    [InlineData("0", 0, true, 0)]
    [InlineData("2.5", 1, false, null)]
    [InlineData("abc", 0, false, null)]
    public void Optional_numbers_are_empty_or_whole_numbers(string text, int min, bool ok, int? expected)
    {
        Assert.Equal(ok, FamilyCatalogViewModel.TryParseOptional(text, min, out var value));
        Assert.Equal(expected, value);
    }

    [Fact]
    public async Task Saving_a_global_chore_sends_the_family_settings()
    {
        var chore = GlobalChore();
        var api = new FakeFamilyApi { Chores = [chore] };
        var vm = new FamilyCatalogViewModel(api, new FakeNavigator());
        await vm.LoadCommand.ExecuteAsync(null);
        var item = vm.Chores.Single();
        Assert.Equal(string.Empty, item.OverrideText); // no override: catalog value

        item.IsActive = false;
        item.OverrideText = "25";
        await vm.SaveChoreCommand.ExecuteAsync(item);

        Assert.Equal([(chore.Id, new ChoreSettingsRequest(false, 25))], api.ChoreSettings);
        Assert.Equal(AppResources.Catalog_Saved, vm.StatusMessage);
    }

    [Fact]
    public async Task Saving_a_family_chore_updates_the_chore_itself()
    {
        var own = new FamilyChoreDto(Guid.NewGuid(), "Rasta hunden", "", "pet", 15, ChoreFrequency.Daily, true, true, null);
        var api = new FakeFamilyApi { Chores = [own] };
        var vm = new FamilyCatalogViewModel(api, new FakeNavigator());
        await vm.LoadCommand.ExecuteAsync(null);
        var item = vm.Chores.Single();
        Assert.Equal("15", item.OverrideText);

        item.OverrideText = "20";
        await vm.SaveChoreCommand.ExecuteAsync(item);

        Assert.Equal(20, api.UpdatedChores.Single().Chore.Points);
        Assert.Empty(api.ChoreSettings);
    }

    [Fact]
    public async Task Invalid_numbers_are_refused_before_calling_the_API()
    {
        var reward = new FamilyRewardDto(Guid.NewGuid(), "Glass", "", "reward_icecream", 50, false, true, null, null);
        var api = new FakeFamilyApi { Rewards = [reward] };
        var vm = new FamilyCatalogViewModel(api, new FakeNavigator());
        await vm.LoadCommand.ExecuteAsync(null);
        var item = vm.Rewards.Single();

        item.StockText = "-1";
        await vm.SaveRewardCommand.ExecuteAsync(item);
        Assert.Equal(AppResources.Catalog_InvalidStock, vm.ErrorMessage);
        Assert.Empty(api.RewardSettings);

        item.StockText = "3";
        await vm.SaveRewardCommand.ExecuteAsync(item);
        Assert.Equal([(reward.Id, new RewardSettingsRequest(true, null, 3))], api.RewardSettings);
    }

    [Fact]
    public async Task Adding_a_family_reward_and_chore()
    {
        var api = new FakeFamilyApi();
        var vm = new FamilyCatalogViewModel(api, new FakeNavigator())
        {
            NewChoreTitle = "Bära in ved",
            NewChorePoints = "7",
            NewChoreFrequency = 1,
            NewRewardTitle = "Bio",
            NewRewardCost = "40",
            NewRewardStock = "",
        };

        await vm.AddChoreCommand.ExecuteAsync(null);
        await vm.AddRewardCommand.ExecuteAsync(null);

        Assert.Equal(new FamilyChoreRequest("Bära in ved", "", "chore_default", 7, ChoreFrequency.Weekly, true), api.CreatedChores.Single());
        Assert.Equal(new FamilyRewardRequest("Bio", "", "reward_default", 40, null, true), api.CreatedRewards.Single());
        Assert.Equal(string.Empty, vm.NewChoreTitle);
    }

    [Fact]
    public async Task A_picked_icon_is_sent_and_reset_after_adding()
    {
        var api = new FakeFamilyApi();
        var vm = new FamilyCatalogViewModel(api, new FakeNavigator()) { NewChoreTitle = "Rasta hunden", NewChorePoints = "15" };
        vm.NewChoreIcon = vm.ChoreIcons.Single(icon => icon.Key == "dog_walk");
        vm.NewRewardTitle = "Glass";
        vm.NewRewardCost = "30";
        vm.NewRewardIcon = vm.RewardIcons.Single(icon => icon.Key == "reward_icecream");

        await vm.AddChoreCommand.ExecuteAsync(null);
        await vm.AddRewardCommand.ExecuteAsync(null);

        Assert.Equal("dog_walk", api.CreatedChores.Single().Icon);
        Assert.Equal("reward_icecream", api.CreatedRewards.Single().Icon);
        Assert.Null(vm.NewChoreIcon);
        Assert.Null(vm.NewRewardIcon);
    }

    [Fact]
    public void Parents_pick_from_the_icons_of_the_item_kind()
    {
        var vm = new FamilyCatalogViewModel(new FakeFamilyApi(), new FakeNavigator());
        Assert.Contains(vm.ChoreIcons, icon => icon.Key == "dishes");
        Assert.DoesNotContain(vm.ChoreIcons, icon => icon.Key.StartsWith("reward_", StringComparison.Ordinal));
        Assert.All(vm.RewardIcons, icon => Assert.StartsWith("reward_", icon.Key));
        Assert.All(vm.ChoreIcons, icon => Assert.Equal(IconGlyphs.For(icon.Key), icon.Glyph));
    }

    [Fact]
    public async Task A_missing_name_is_refused()
    {
        var api = new FakeFamilyApi();
        var vm = new FamilyCatalogViewModel(api, new FakeNavigator()) { NewChorePoints = "5" };
        await vm.AddChoreCommand.ExecuteAsync(null);
        Assert.Equal(AppResources.Catalog_TitleRequired, vm.ErrorMessage);
        Assert.Empty(api.CreatedChores);
    }
}
