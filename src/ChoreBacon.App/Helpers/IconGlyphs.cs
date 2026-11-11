using System.Globalization;

namespace ChoreBacon.Helpers;

/// <summary>
/// Maps catalog icon keys to a display glyph so raw keys are never shown. Emoji are placeholders until
/// bundled artwork exists (backlog item 8); unknown keys fall back to a default per kind.
/// </summary>
public static class IconGlyphs
{
    public const string Default = "⭐";

    private static readonly Dictionary<string, string> Glyphs = new()
    {
        // Chores
        ["dishes"] = "🍽️", ["vacuum"] = "🧹", ["trash"] = "🗑️", ["laundry"] = "🧺",
        ["bathroom"] = "🛁", ["lawn"] = "🌱", ["pet"] = "🐾", ["bed"] = "🛏️", ["chore_default"] = "🧽",
        // Rewards
        ["reward_screen"] = "📱", ["reward_dinner"] = "🍝", ["reward_icecream"] = "🍦", ["reward_movie"] = "🎬",
        ["reward_skip"] = "⏭️", ["reward_game"] = "🎮", ["reward_late"] = "🌙", ["reward_pizza"] = "🍕", ["reward_default"] = "🎁",
        // Achievements
        ["ach_first"] = "👣", ["ach_10"] = "💪", ["ach_50"] = "🏅", ["ach_100"] = "👑",
        ["ach_pts100"] = "💰", ["ach_pts500"] = "💎", ["ach_streak3"] = "🔥", ["ach_streak7"] = "⚡",
        ["ach_streak30"] = "🏆", ["ach_spend"] = "🛍️", ["achievement_default"] = "🏆",
    };

    public static string For(string? key)
    {
        if (key is not null && Glyphs.TryGetValue(key, out var glyph))
            return glyph;
        return key switch
        {
            not null when key.StartsWith("reward_", StringComparison.Ordinal) => Glyphs["reward_default"],
            not null when key.StartsWith("ach_", StringComparison.Ordinal) => Glyphs["achievement_default"],
            _ => Default,
        };
    }
}

public class IconKeyConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture) => IconGlyphs.For(value as string);

    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        => throw new NotImplementedException();
}
