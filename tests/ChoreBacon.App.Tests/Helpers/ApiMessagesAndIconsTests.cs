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
    [InlineData("reward_unknown", "🎁")]
    [InlineData("ach_unknown", "🏆")]
    [InlineData("whatever", IconGlyphs.Default)]
    [InlineData(null, IconGlyphs.Default)]
    public void Icon_keys_map_to_glyphs_and_never_show_the_raw_key(string? key, string expected)
    {
        Assert.Equal(expected, IconGlyphs.For(key));
    }
}
