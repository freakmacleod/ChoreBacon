using ChoreBacon.Models;

namespace ChoreBacon.Services.Interfaces;

public interface IAuthService
{
    User? CurrentUser { get; }
    bool IsLoggedIn { get; }

    Task<User?> LoginWithGoogleAsync();
    Task<User?> LoginWithFacebookAsync();
    Task LogoutAsync();
}
