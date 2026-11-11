using ChoreBacon.ViewModels;

namespace ChoreBacon.Views;

public partial class ApprovalsPage : ContentPage
{
    private readonly ApprovalsViewModel _vm;

    public ApprovalsPage(ApprovalsViewModel vm)
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
