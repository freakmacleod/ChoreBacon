using ChoreBacon.ViewModels;

namespace ChoreBacon.Views;

public partial class AchievementsPage : ContentPage
{
    private readonly AchievementsViewModel _vm;

    public AchievementsPage(AchievementsViewModel vm)
    {
        InitializeComponent();
        BindingContext = vm;
        _vm = vm;
    }

    protected override async void OnAppearing()
    {
        base.OnAppearing();
        await _vm.LoadCommand.ExecuteAsync(null);
    }
}
