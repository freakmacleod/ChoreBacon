namespace ChoreBacon.Contracts;

/// <summary>Body of every non-2xx API response: <c>{ "error": { "code", "message" } }</c>.</summary>
public sealed record ApiErrorResponse(ApiError Error);

/// <param name="Code">Stable, machine-readable; the app maps it to a localized message.</param>
/// <param name="Message">Developer-facing fallback, not shown to users.</param>
public sealed record ApiError(string Code, string Message);
