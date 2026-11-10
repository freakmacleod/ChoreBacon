using ChoreBacon.Contracts.Auth;
using ChoreBacon.Resources.Strings;
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
}
