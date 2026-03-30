using ChoreBacon.Models;
using ChoreBacon.Services.Interfaces;

namespace ChoreBacon.Services;

/// <summary>
/// Handles OAuth login via Google and Facebook.
/// OAuth client IDs must be configured in Platforms/Android/AndroidManifest.xml
/// and Platforms/iOS/Info.plist before use.
/// </summary>
public class AuthService : IAuthService
{
    private readonly IDatabaseService _db;

    public User? CurrentUser { get; private set; }
    public bool IsLoggedIn => CurrentUser is not null;

    public AuthService(IDatabaseService db)
    {
        _db = db;
    }

    public async Task<User?> LoginWithGoogleAsync()
    {
        // TODO: Replace with WebAuthenticator OAuth flow using your Google Client ID.
        // Example integration point — wire in your OAuth redirect URI here.
        //
        // var result = await WebAuthenticator.Default.AuthenticateAsync(
        //     new Uri("https://accounts.google.com/o/oauth2/v2/auth?..."),
        //     new Uri("chorebacon://oauth/google"));
        //
        // string idToken = result.Properties["id_token"];
        // Decode idToken (JWT) to extract sub, name, email, picture.

        throw new NotImplementedException(
            "Google OAuth not yet configured. Add your Google Client ID to AuthService.");
    }

    public async Task<User?> LoginWithFacebookAsync()
    {
        // TODO: Replace with WebAuthenticator OAuth flow using your Facebook App ID.
        //
        // var result = await WebAuthenticator.Default.AuthenticateAsync(
        //     new Uri("https://www.facebook.com/dialog/oauth?..."),
        //     new Uri("chorebacon://oauth/facebook"));
        //
        // string accessToken = result.AccessToken;
        // Call https://graph.facebook.com/me?fields=id,name,email,picture

        throw new NotImplementedException(
            "Facebook OAuth not yet configured. Add your Facebook App ID to AuthService.");
    }

    public async Task LogoutAsync()
    {
        CurrentUser = null;
        await SecureStorage.Default.SetAsync("current_user_id", string.Empty);
    }

    protected async Task<User> UpsertUserAsync(string externalId, string provider,
        string displayName, string email, string pictureUrl)
    {
        var existing = await _db.GetUserByExternalIdAsync(externalId, provider);
        if (existing is not null)
        {
            existing.DisplayName = displayName;
            existing.Email = email;
            existing.ProfilePictureUrl = pictureUrl;
            existing.LastLoginAt = DateTime.UtcNow;
            await _db.SaveUserAsync(existing);
            CurrentUser = existing;
            return existing;
        }

        var newUser = new User
        {
            ExternalId = externalId,
            Provider = provider,
            DisplayName = displayName,
            Email = email,
            ProfilePictureUrl = pictureUrl
        };
        await _db.SaveUserAsync(newUser);
        CurrentUser = newUser;
        await SecureStorage.Default.SetAsync("current_user_id", newUser.Id.ToString());
        return newUser;
    }

    public async Task<bool> TryRestoreSessionAsync()
    {
        var idStr = await SecureStorage.Default.GetAsync("current_user_id");
        if (string.IsNullOrWhiteSpace(idStr) || !int.TryParse(idStr, out var id))
            return false;

        var user = await _db.GetUserByIdAsync(id);
        if (user is null)
            return false;

        CurrentUser = user;
        return true;
    }
}
