using ChoreBacon.ViewModels;

namespace ChoreBacon.Views;

public partial class StorePage : ContentPage
{
    private readonly StoreViewModel _vm;

    public StorePage(StoreViewModel vm)
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
