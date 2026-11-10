using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using ChoreBacon.Services;
using ChoreBacon.Services.Interfaces;

namespace ChoreBacon.ViewModels;

public partial class LoginViewModel : BaseViewModel
{
    private readonly IAuthService _auth;

    [ObservableProperty]
    private string _errorMessage = string.Empty;

    public LoginViewModel(IAuthService auth)
    {
        _auth = auth;
        Title = "Welcome to ChoreBacon";
    }

    [RelayCommand]
    private async Task LoginWithGoogleAsync()
    {
        if (IsBusy) return;
        IsBusy = true;
        ErrorMessage = string.Empty;
        try
        {
            var user = await _auth.LoginWithGoogleAsync();
            if (user is not null)
                await Shell.Current.GoToAsync("//dashboard");
        }
        catch (NotImplementedException)
        {
            ErrorMessage = "Google login is not yet configured.";
        }
        catch (Exception ex)
        {
            ErrorMessage = $"Login failed: {ex.Message}";
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task LoginWithFacebookAsync()
    {
        if (IsBusy) return;
        IsBusy = true;
        ErrorMessage = string.Empty;
        try
        {
            var user = await _auth.LoginWithFacebookAsync();
            if (user is not null)
                await Shell.Current.GoToAsync("//dashboard");
        }
        catch (NotImplementedException)
        {
            ErrorMessage = "Facebook login is not yet configured.";
        }
        catch (Exception ex)
        {
            ErrorMessage = $"Login failed: {ex.Message}";
        }
        finally
        {
            IsBusy = false;
        }
    }
}
