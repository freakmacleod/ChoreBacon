using Android.App;
using Android.Content;
using Android.Gms.Extensions;
using AndroidX.Core.App;
using ChoreBacon.Resources.Strings;
using ChoreBacon.Services.Push;
using Firebase;
using Firebase.Messaging;

namespace ChoreBacon;

/// <summary>Firebase Cloud Messaging as the app's push service.</summary>
public sealed class FirebasePushTokenSource : IPushTokenSource
{
    // Firebase starts itself from google-services.json; a build without that file has no default app.
    public bool IsSupported => FirebaseApp.GetApps(Android.App.Application.Context).Count > 0;

    public string Platform => "android";

    public async Task<bool> RequestPermissionAsync()
    {
        // Before Android 13 notifications need no runtime permission.
        if (!OperatingSystem.IsAndroidVersionAtLeast(33)) return true;
        var status = await MainThread.InvokeOnMainThreadAsync(Permissions.RequestAsync<Permissions.PostNotifications>);
        return status == PermissionStatus.Granted;
    }

    public async Task<string> GetTokenAsync(CancellationToken cancellationToken)
    {
        // The binding marks getToken() obsolete, but it is FCM's current way to read the token.
#pragma warning disable CS0618
        var token = await FirebaseMessaging.Instance.GetToken().AsAsync<Java.Lang.String>().WaitAsync(cancellationToken);
#pragma warning restore CS0618
        return token.ToString();
    }
}

/// <summary>
/// Receives token rotations and the messages that arrive while the app is open. (With the app in the
/// background, Android shows FCM notifications by itself, on the channel set in AndroidManifest.xml.)
/// </summary>
[Service(Exported = false)]
[IntentFilter(["com.google.firebase.MESSAGING_EVENT"])]
public class ChoreBaconMessagingService : FirebaseMessagingService
{
    // Obsolete only in the binding's metadata; onNewToken is how FCM reports a new token.
#pragma warning disable CS0672
    public override void OnNewToken(string token)
    {
        var push = IPlatformApplication.Current?.Services.GetService<IPushRegistration>();
        if (push is not null)
            _ = push.TokenRefreshedAsync(token);
    }
#pragma warning restore CS0672

    public override void OnMessageReceived(RemoteMessage message)
    {
        if (message.GetNotification() is { } notification)
            PushNotifications.Show(this, notification.Title, notification.Body);
    }
}

internal static class PushNotifications
{
    /// <summary>Must match ANDROID_CHANNEL in web/lib/push/fcm.ts and the manifest's default channel.</summary>
    public const string ChannelId = "chorebacon_default";

    public static void CreateChannel(Context context)
    {
        if (!OperatingSystem.IsAndroidVersionAtLeast(26)) return;
        var channel = new NotificationChannel(ChannelId, AppResources.Notifications_ChannelName, NotificationImportance.Default)
        {
            Description = AppResources.Notifications_ChannelDescription,
        };
        (context.GetSystemService(Context.NotificationService) as NotificationManager)?.CreateNotificationChannel(channel);
    }

    /// <summary>Shows a notification that opens the app when tapped.</summary>
    public static void Show(Context context, string? title, string? body)
    {
        var launch = context.PackageManager?.GetLaunchIntentForPackage(context.PackageName!);
        if (launch is null) return;
        launch.AddFlags(ActivityFlags.SingleTop | ActivityFlags.ClearTop);
        var tap = PendingIntent.GetActivity(context, 0, launch, PendingIntentFlags.Immutable | PendingIntentFlags.UpdateCurrent);

        var builder = new NotificationCompat.Builder(context, ChannelId);
        builder.SetSmallIcon(Resource.Drawable.ic_notification);
        builder.SetContentTitle(title);
        builder.SetContentText(body);
        builder.SetStyle(new NotificationCompat.BigTextStyle().BigText(body));
        builder.SetAutoCancel(true);
        builder.SetContentIntent(tap);

        // Without the notification permission Android would drop it anyway.
        var manager = NotificationManagerCompat.From(context);
        if (manager is not null && manager.AreNotificationsEnabled())
            manager.Notify(Environment.TickCount, builder.Build());
    }
}
