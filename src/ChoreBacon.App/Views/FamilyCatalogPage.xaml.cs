using ChoreBacon.ViewModels;

namespace ChoreBacon.Views;

public partial class FamilyCatalogPage : ContentPage
{
    private readonly FamilyCatalogViewModel _vm;

    public FamilyCatalogPage(FamilyCatalogViewModel vm)
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
