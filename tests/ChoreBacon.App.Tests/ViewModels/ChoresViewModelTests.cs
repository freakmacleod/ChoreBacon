using System.Net;
using ChoreBacon.App.Tests.Fakes;
using ChoreBacon.Contracts.Progress;
using ChoreBacon.Resources.Strings;
using ChoreBacon.Services.Api;
using ChoreBacon.Services.Ui;
using ChoreBacon.ViewModels;

namespace ChoreBacon.App.Tests.ViewModels;

public class ChoresViewModelTests
{
    private readonly FakeChoreBaconApi _api = new();
    private readonly FakeNavigator _navigator = new();
    private readonly ChoresViewModel _vm;

    public ChoresViewModelTests()
    {
        _vm = new ChoresViewModel(_api, _navigator);
        _api.OnGetProgress = () => Task.FromResult(Dto.Progress(balance: 40));
    }

    private async Task<ChoreItemViewModel> LoadWith(ChoreDto chore)
    {
        _api.OnGetChores = () => Task.FromResult<IReadOnlyList<ChoreDto>>([chore]);
        await _vm.LoadCommand.ExecuteAsync(null);
        return Assert.Single(_vm.Chores);
    }

    [Fact]
    public async Task Load_shows_chores_with_their_period_state_and_the_balance()
    {
        _api.OnGetChores = () => Task.FromResult<IReadOnlyList<ChoreDto>>(
            [Dto.Chore("Diska", done: true), Dto.Chore("Tvätta", frequency: ChoreFrequency.Weekly)]);

        await _vm.LoadCommand.ExecuteAsync(null);

        Assert.Equal(40, _vm.Balance);
        Assert.Equal([true, false], _vm.Chores.Select(c => c.IsCompleted));
        Assert.Equal(AppResources.Chores_Done, _vm.Chores[0].ActionText);
        Assert.Equal(AppResources.Frequency_Weekly, _vm.Chores[1].FrequencyText);
        Assert.False(_vm.IsBusy);
    }

    [Fact]
    public async Task Completing_shows_the_points_and_balance_from_the_API()
    {
        var chore = Dto.Chore("Diska", points: 10);
        var item = await LoadWith(chore);
        _api.OnCompleteChore = _ => Task.FromResult(Dto.Completed(chore, balance: 55, Dto.Achievement("Första steget")));

        await _vm.CompleteChoreCommand.ExecuteAsync(item);

        Assert.True(item.IsCompleted);
        Assert.Equal(55, _vm.Balance); // the API's balance, including the achievement bonus
        Assert.Equal(
            string.Join('\n', string.Format(AppResources.Chores_PointsEarned, 10, "Diska"), string.Format(AppResources.Achievement_Unlocked, "Första steget")),
            _vm.StatusMessage);
    }

    [Fact]
    public async Task A_child_waiting_for_approval_sees_pending_points_not_earned_ones()
    {
        var chore = Dto.Chore("Diska", points: 10);
        var item = await LoadWith(chore);
        _api.OnCompleteChore = _ => Task.FromResult(Dto.PendingApproval(chore, balance: 40));

        await _vm.CompleteChoreCommand.ExecuteAsync(item);

        Assert.True(item.IsPending);
        Assert.Equal(AppResources.Chores_Pending, item.ActionText);
        Assert.Equal(40, _vm.Balance);
        Assert.Equal(string.Format(AppResources.Chores_PendingApproval, 10, "Diska"), _vm.StatusMessage);
    }

    [Fact]
    public async Task Already_completed_409_marks_the_chore_done_and_shows_the_Swedish_reason()
    {
        var item = await LoadWith(Dto.Chore());
        _api.OnCompleteChore = _ => throw new ApiException(HttpStatusCode.Conflict, ProgressErrorCodes.AlreadyCompletedThisWeek, "");

        await _vm.CompleteChoreCommand.ExecuteAsync(item);

        Assert.True(item.IsCompleted);
        Assert.Equal(AppResources.Error_AlreadyCompletedThisWeek, _vm.ErrorMessage);
        Assert.Equal(40, _vm.Balance);
    }

    [Fact]
    public async Task A_completed_chore_is_not_sent_again()
    {
        var item = await LoadWith(Dto.Chore(done: true));

        await _vm.CompleteChoreCommand.ExecuteAsync(item);

        Assert.Empty(_api.Completed);
    }

    [Fact]
    public async Task Pending_approval_is_shown_as_waiting()
    {
        var item = await LoadWith(Dto.Chore(done: true, status: CompletionStatus.Pending));

        Assert.True(item.IsPending);
        Assert.Equal(AppResources.Chores_Pending, item.ActionText);
    }

    [Fact]
    public async Task An_expired_session_returns_to_login()
    {
        _api.OnGetChores = () => throw new ApiException(HttpStatusCode.Unauthorized, "unauthorized", "");

        await _vm.LoadCommand.ExecuteAsync(null);

        Assert.Equal([Routes.Login], _navigator.Routes);
        Assert.Equal(AppResources.Error_SessionExpired, _vm.ErrorMessage);
    }

    [Fact]
    public async Task Offline_shows_the_network_message()
    {
        _api.OnGetChores = () => throw new HttpRequestException("offline");

        await _vm.LoadCommand.ExecuteAsync(null);

        Assert.Equal(AppResources.Error_Network, _vm.ErrorMessage);
        Assert.Empty(_navigator.Routes);
        Assert.False(_vm.IsBusy);
    }

    [Fact]
    public async Task Load_shows_combos_with_their_progress()
    {
        _api.OnGetChores = () => Task.FromResult<IReadOnlyList<ChoreDto>>([Dto.Chore()]);
        _api.OnGetCombos = () => Task.FromResult<IReadOnlyList<ComboDto>>(
        [
            Dto.Combo("Morgonrutin", chores: [Dto.ComboChore("Bädda", done: true), Dto.ComboChore("Diska", done: true, pending: true), Dto.ComboChore("Sopor")]),
            Dto.Combo("Veckans hjälte", period: ComboPeriod.Week, awarded: true),
        ]);

        await _vm.LoadCommand.ExecuteAsync(null);

        Assert.True(_vm.HasCombos);
        var (day, week) = (_vm.Combos[0], _vm.Combos[1]);
        Assert.Equal(string.Format(AppResources.Combos_Progress, 2, 3), day.ProgressText);
        Assert.Equal(AppResources.Combos_Today, day.PeriodText);
        Assert.Equal(
            string.Join('\n', string.Format(AppResources.Combos_ChoreDone, "Bädda"), string.Format(AppResources.Combos_ChorePending, "Diska"),
                string.Format(AppResources.Combos_ChoreTodo, "Sopor")),
            day.ChoresText);
        Assert.Equal(AppResources.Combos_Awarded, week.ProgressText);
        Assert.Equal(AppResources.Combos_ThisWeek, week.PeriodText);
    }

    [Fact]
    public async Task Completing_the_last_chore_of_a_combo_shows_the_bonus_and_refreshes_the_combos()
    {
        var chore = Dto.Chore("Diska", points: 10);
        _api.OnGetCombos = () => Task.FromResult<IReadOnlyList<ComboDto>>([Dto.Combo(chores: [Dto.ComboChore("Diska")])]);
        var item = await LoadWith(chore);
        _api.OnCompleteChore = _ => Task.FromResult(
            Dto.Completed(chore, balance: 70) with { ComboBonuses = [new ComboBonusDto(Guid.NewGuid(), "Morgonrutin", "combo_fire", 20)] });
        _api.OnGetCombos = () => Task.FromResult<IReadOnlyList<ComboDto>>([Dto.Combo(awarded: true, chores: [Dto.ComboChore("Diska", done: true)])]);

        await _vm.CompleteChoreCommand.ExecuteAsync(item);

        Assert.Equal(70, _vm.Balance);
        Assert.Equal(
            string.Join('\n', string.Format(AppResources.Chores_PointsEarned, 10, "Diska"), string.Format(AppResources.Combos_Earned, "Morgonrutin", 20)),
            _vm.StatusMessage);
        Assert.Equal(AppResources.Combos_Awarded, Assert.Single(_vm.Combos).ProgressText);
    }

    [Fact]
    public async Task Without_combos_the_section_is_hidden()
    {
        await LoadWith(Dto.Chore());
        Assert.False(_vm.HasCombos);
        Assert.Empty(_vm.Combos);
    }
}
