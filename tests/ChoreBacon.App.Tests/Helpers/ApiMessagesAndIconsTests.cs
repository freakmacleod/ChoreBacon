using ChoreBacon.Contracts.Progress;
using ChoreBacon.Helpers;
using ChoreBacon.Resources.Strings;

namespace ChoreBacon.App.Tests.Helpers;

public class ApiMessagesTests
{
    [Theory]
    [InlineData(ProgressErrorCodes.AlreadyCompletedToday, nameof(AppResources.Error_AlreadyCompletedToday))]
    [InlineData(ProgressErrorCodes.AlreadyCompletedThisWeek, nameof(AppResources.Error_AlreadyCompletedThisWeek))]
    [InlineData(ProgressErrorCodes.AlreadyCompletedThisMonth, nameof(AppResources.Error_AlreadyCompletedThisMonth))]
    [InlineData(ProgressErrorCodes.AlreadyCompleted, nameof(AppResources.Error_AlreadyCompleted))]
    [InlineData(ProgressErrorCodes.RewardOutOfStock, nameof(AppResources.Error_OutOfStock))]
    [InlineData(ProgressErrorCodes.InsufficientPoints, nameof(AppResources.Error_InsufficientPoints))]
    [InlineData("something_new", nameof(AppResources.Error_Generic))]
    public void Error_codes_map_to_Swedish_messages(string code, string resourceName)
    {
        var expected = AppResources.ResourceManager.GetString(resourceName);

        Assert.False(string.IsNullOrWhiteSpace(expected));
        Assert.Equal(expected, ApiMessages.For(code));
    }

    [Fact]
    public void Only_frequency_conflicts_count_as_already_completed()
    {
        Assert.True(ApiMessages.IsAlreadyCompleted(ProgressErrorCodes.AlreadyCompletedToday));
        Assert.False(ApiMessages.IsAlreadyCompleted(ProgressErrorCodes.ChoreNotFound));
    }
}

public class IconGlyphsTests
{
    [Theory]
    [InlineData("dishes", "🍽️")]
    [InlineData("ach_first", "👣")]
    [InlineData("reward_pizza", "🍕")]
    [InlineData("dog_walk", "🐕")]
    [InlineData("reward_unknown", "🎁")]
    [InlineData("ach_unknown", "🏆")]
    [InlineData("whatever", IconGlyphs.Default)]
    [InlineData(null, IconGlyphs.Default)]
    public void Icon_keys_map_to_glyphs_and_never_show_the_raw_key(string? key, string expected)
    {
        Assert.Equal(expected, IconGlyphs.For(key));
    }

    [Fact]
    public void The_shared_icon_set_is_embedded_with_every_seeded_key()
    {
        var glyphs = IconGlyphs.Load();
        string[] seeded = ["dishes", "vacuum", "trash", "laundry", "bathroom", "lawn", "pet", "bed", "chore_default",
            "reward_screen", "reward_dinner", "reward_icecream", "reward_movie", "reward_skip", "reward_game", "reward_late",
            "reward_pizza", "reward_default", "ach_first", "ach_10", "ach_50", "ach_100", "ach_pts100", "ach_pts500",
            "ach_streak3", "ach_streak7", "ach_streak30", "ach_spend", "achievement_default"];
        Assert.All(seeded, key => Assert.True(glyphs.ContainsKey(key), key));
    }
}
