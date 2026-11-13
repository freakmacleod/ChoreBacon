namespace ChoreBacon.Services.Push;

/// <summary>The platform's push service (Firebase Cloud Messaging on Android).</summary>
public interface IPushTokenSource
{
    /// <summary>False where push is not available: other platforms, or a build without a Firebase config.</summary>
    bool IsSupported { get; }

    /// <summary>Sent to the API with the token: <c>android</c> or <c>ios</c>.</summary>
    string Platform { get; }

    /// <summary>Asks for permission to show notifications (Android 13+); true if granted.</summary>
    Task<bool> RequestPermissionAsync();

    /// <summary>This device's current registration token.</summary>
    Task<string> GetTokenAsync(CancellationToken cancellationToken);
}

/// <summary>Platforms without push: nothing to register.</summary>
public sealed class NoPushTokenSource : IPushTokenSource
{
    public bool IsSupported => false;
    public string Platform => "none";
    public Task<bool> RequestPermissionAsync() => Task.FromResult(false);
    public Task<string> GetTokenAsync(CancellationToken cancellationToken) => throw new NotSupportedException();
}
