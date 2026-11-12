using ChoreBacon.Contracts.Auth;
using ChoreBacon.Resources.Strings;
using ChoreBacon.Services.Api;
using ChoreBacon.Services.Auth;
using ChoreBacon.ViewModels;

namespace ChoreBacon.App.Tests.ViewModels;

public class LoginViewModelTests
{
    [Theory]
    [InlineData(AuthErrorCodes.AccessDenied, nameof(AppResources.Login_Error_AccessDenied))]
    [InlineData(AuthException.NetworkError, nameof(AppResources.Login_Error_Network))]
    [InlineData(AuthErrorCodes.SessionRevoked, nameof(AppResources.Login_Error_SessionExpired))]
    [InlineData(AuthErrorCodes.RefreshTokenReused, nameof(AppResources.Login_Error_SessionExpired))]
    [InlineData(AuthErrorCodes.InvalidState, nameof(AppResources.Login_Error_Generic))]
    [InlineData("something_new", nameof(AppResources.Login_Error_Generic))]
    public void Error_codes_map_to_Swedish_messages(string code, string resourceName)
    {
        var expected = AppResources.ResourceManager.GetString(resourceName);

        Assert.False(string.IsNullOrWhiteSpace(expected));
        Assert.Equal(expected, LoginViewModel.MessageFor(code));
    }

    [Fact]
    public void Default_strings_are_Swedish()
    {
        Assert.Equal("Fortsätt med Google", AppResources.Login_ContinueWithGoogle);
    }

    [Fact]
    public async Task The_privacy_policy_opens_in_the_browser()
    {
        var browser = new RecordingBrowser();
        var vm = new LoginViewModel(new Fakes.FakeAuthService(), new Fakes.FakeNavigator(), browser, new ApiConfig(new Uri("https://chorebacon.vercel.app/")));

        await vm.OpenPrivacyPolicyCommand.ExecuteAsync(null);

        Assert.Equal(new Uri("https://chorebacon.vercel.app/integritet"), browser.Opened);
    }

    private sealed class RecordingBrowser : IBrowser
    {
        public Uri? Opened { get; private set; }

        public Task<bool> OpenAsync(Uri uri, BrowserLaunchOptions options)
        {
            Opened = uri;
            return Task.FromResult(true);
        }
    }
}
