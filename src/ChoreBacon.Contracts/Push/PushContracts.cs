namespace ChoreBacon.Contracts.Push;

// Mirrors web/lib/push/schemas.ts.

/// <param name="Token">The Firebase Cloud Messaging registration token of this device.</param>
/// <param name="Platform"><c>android</c> or <c>ios</c>.</param>
public sealed record RegisterDeviceRequest(string Token, string Platform);

public sealed record UnregisterDeviceRequest(string Token);
