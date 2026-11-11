using ChoreBacon.ViewModels;

namespace ChoreBacon.Views;

public partial class LoginPage : ContentPage
{
    private readonly LoginViewModel _vm;

    public LoginPage(LoginViewModel vm)
    {
        InitializeComponent();
        BindingContext = vm;
        _vm = vm;
    }

    // Startup lands here first: resume a stored session before offering sign-in.
    protected override async void OnAppearing()
    {
        base.OnAppearing();
        await _vm.InitializeCommand.ExecuteAsync(null);
    }
}
