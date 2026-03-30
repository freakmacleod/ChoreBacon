using ChoreBacon.ViewModels;

namespace ChoreBacon.Views;

public partial class ChoresPage : ContentPage
{
    private readonly ChoresViewModel _vm;

    public ChoresPage(ChoresViewModel vm)
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
