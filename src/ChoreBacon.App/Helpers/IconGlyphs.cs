using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace ChoreBacon.Helpers;

/// <summary>
/// Maps catalog icon keys to a display glyph so raw keys are never shown. The set comes from
/// web/lib/icons/catalog-icons.json (embedded), the same file the admin icon picker uses. Emoji are
/// placeholders until real artwork exists; unknown keys fall back to a default per kind.
/// </summary>
public static class IconGlyphs
{
    public const string Default = "⭐";

    public const string Chores = "chore";
    public const string Rewards = "reward";

    private static readonly Lazy<IReadOnlyList<IconGroup>> Groups = new(LoadGroups);
    private static readonly Lazy<IReadOnlyDictionary<string, string>> Glyphs = new(Load);

    /// <summary>The icons a parent can pick for a new item of this kind (<see cref="Chores"/> or <see cref="Rewards"/>).</summary>
    public static IReadOnlyList<IconOption> Choices(string kind) =>
        Groups.Value.Where(group => group.Kind == kind).SelectMany(group => group.Icons)
            .Select(icon => new IconOption(icon.Key, icon.Glyph, icon.Label)).ToList();

    /// <summary>The icon a new item of this kind gets when none is picked.</summary>
    public static string FallbackKey(string kind) => Groups.Value.Single(group => group.Kind == kind).Fallback;

    public static string For(string? key)
    {
        var glyphs = Glyphs.Value;
        if (key is not null && glyphs.TryGetValue(key, out var glyph))
            return glyph;
        return key switch
        {
            not null when key.StartsWith("reward_", StringComparison.Ordinal) => glyphs.GetValueOrDefault("reward_default", Default),
            not null when key.StartsWith("ach_", StringComparison.Ordinal) => glyphs.GetValueOrDefault("achievement_default", Default),
            _ => Default,
        };
    }

    internal static IReadOnlyDictionary<string, string> Load() =>
        Groups.Value.SelectMany(group => group.Icons).ToDictionary(icon => icon.Key, icon => icon.Glyph);

    private static IReadOnlyList<IconGroup> LoadGroups()
    {
        using var stream = typeof(IconGlyphs).Assembly.GetManifestResourceStream("catalog-icons.json")
            ?? throw new InvalidOperationException("The embedded icon set catalog-icons.json is missing.");
        var file = JsonSerializer.Deserialize(stream, IconJsonContext.Default.IconFile)
            ?? throw new InvalidOperationException("The embedded icon set catalog-icons.json is empty.");
        return file.Groups;
    }
}

/// <summary>One pickable icon: the key that is stored, the glyph that is shown, and a label for screen readers.</summary>
public sealed record IconOption(string Key, string Glyph, string Label);

internal sealed record IconFile(IReadOnlyList<IconGroup> Groups);

internal sealed record IconGroup(string Kind, string Fallback, IReadOnlyList<IconEntry> Icons);

internal sealed record IconEntry(string Key, string Glyph, string Label);

[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase)]
[JsonSerializable(typeof(IconFile))]
internal sealed partial class IconJsonContext : JsonSerializerContext;

public class IconKeyConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture) => IconGlyphs.For(value as string);

    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        => throw new NotImplementedException();
}
