using ChoreBacon.ViewModels;

namespace ChoreBacon.Views;

public partial class FamilyPage : ContentPage
{
    private readonly FamilyViewModel _vm;

    public FamilyPage(FamilyViewModel vm)
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
