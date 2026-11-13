using ChoreBacon.Services.Api;
using ChoreBacon.Services.Auth;

namespace ChoreBacon.Services.Push;

/// <summary>
/// Tells the API which device to send push notifications to: after sign-in, whenever the platform
/// rotates the token, and (removing it) before sign-out. Push is a nice-to-have, so every step is best
/// effort: no failure here may ever break signing in or out.
/// </summary>
public sealed class PushRegistration(IPushTokenSource source, IChoreBaconApi api, ITokenStore tokens) : IPushRegistration
{
    public async Task RegisterAsync(CancellationToken cancellationToken)
    {
        if (!source.IsSupported) return;
        try
        {
            if (!await source.RequestPermissionAsync()) return;
            await api.RegisterDeviceAsync(await source.GetTokenAsync(cancellationToken), source.Platform, cancellationToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // Offline, API error, or the platform push service failing: try again at the next sign-in or token rotation.
        }
    }

    public async Task TokenRefreshedAsync(string token)
    {
        if (!source.IsSupported) return;
        try
        {
            // Only for a signed-in user; otherwise the next sign-in registers it.
            if (await tokens.LoadAsync() is null) return;
            await api.RegisterDeviceAsync(token, source.Platform, CancellationToken.None);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // As above: best effort.
        }
    }

    public async Task UnregisterAsync(CancellationToken cancellationToken)
    {
        if (!source.IsSupported) return;
        try
        {
            await api.UnregisterDeviceAsync(await source.GetTokenAsync(cancellationToken), cancellationToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // The server also drops tokens that FCM reports dead, so a missed unregister heals itself.
        }
    }
}

public interface IPushRegistration
{
    /// <summary>After sign-in: asks for permission and registers this device.</summary>
    Task RegisterAsync(CancellationToken cancellationToken);

    /// <summary>The platform issued a new token (called from the messaging service).</summary>
    Task TokenRefreshedAsync(string token);

    /// <summary>Before sign-out, while the session is still valid.</summary>
    Task UnregisterAsync(CancellationToken cancellationToken);
}
