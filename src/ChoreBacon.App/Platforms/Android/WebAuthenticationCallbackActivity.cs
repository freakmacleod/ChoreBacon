using Android.App;
using Android.Content;
using Android.Content.PM;

namespace ChoreBacon;

/// <summary>
/// Receives the backend's <c>chorebacon://auth#…</c> redirect after Google/Facebook sign-in and hands it
/// back to <see cref="Microsoft.Maui.Authentication.WebAuthenticator"/>.
/// </summary>
[Activity(NoHistory = true, LaunchMode = LaunchMode.SingleTop, Exported = true)]
[IntentFilter(
    [Intent.ActionView],
    Categories = [Intent.CategoryDefault, Intent.CategoryBrowsable],
    DataScheme = "chorebacon",
    DataHost = "auth")]
public class WebAuthenticationCallbackActivity : Microsoft.Maui.Authentication.WebAuthenticatorCallbackActivity;
